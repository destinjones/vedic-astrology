/**
 * Guided birth time rectification.
 *
 *   const r = rectify(engine, {
 *     date: '1990-08-15', from: '05:00', to: '08:00',
 *     place: { latitude: 28.61, longitude: 77.21, timezone: 'Asia/Kolkata' },
 *     events: [{ kind: 'marriage', date: '2016-02' }, { kind: 'childbirth', date: '2018-11-03' }],
 *   });
 *   r.candidates[0].localTime   // best time, with explanations per event
 *   r.changePoints              // when the lagna, navamsa (D9), D60 and Moon nakshatra change
 *
 * Method: every instant on a grid across the window is cast as a light chart;
 * each life event is scored against it (see score.ts); candidates are grouped
 * by lagna + navamsa, since those are what a time correction really changes,
 * and the groups are ranked.
 */
import {
  NAKSHATRAS,
  NAKSHATRA_SPAN,
  SIGN_NAMES,
  dateToJd,
  jdToDate,
  localToUtc,
  timezoneAt,
  vargaSign,
  type AyanamsaId,
  type Engine,
  type GrahaId,
  type NodeType,
  type SignNumber,
} from '@vedic/engine';
import { candidateChart, dashaChain, type CandidateChart, type ChartSettings, type Place } from './chart';
import { EVENT_DEFS, eventSpan, spanSamples, type DatePrecision, type EventDef, type LifeEvent } from './events';
import { PLANET_LABEL, WEIGHTS, dashaMatch, transitMatch, type TransitPositions } from './score';
import { shashtiamsaOf, type Shashtiamsa } from './shashtiamsa';

export interface RectifyInput {
  /** Local civil date of birth, YYYY-MM-DD */
  date: string;
  /** Earliest possible local time, HH:mm */
  from: string;
  /** Latest possible local time, HH:mm. Earlier than `from` means the next day. */
  to: string;
  place: Place & { timezone?: string };
  utcOffsetMinutes?: number;
  events: LifeEvent[];
  ayanamsa?: AyanamsaId;
  nodeType?: NodeType;
  /** Grid spacing; default scales with the window (1–5 min) */
  stepMinutes?: number;
  /** A remembered time ("around 6:30") nudges nearby candidates */
  likely?: { time: string; plusMinusMinutes?: number };
  /** How many ranked candidates to return, default 5 */
  top?: number;
}

export type ChangeKind = 'lagna' | 'navamsa' | 'shashtiamsa' | 'nakshatra';

export interface ChangePoint {
  kind: ChangeKind;
  jd: number;
  utc: string;
  /** Local civil "YYYY-MM-DD HH:mm:ss" at the birthplace */
  local: string;
  from: string;
  to: string;
}

export interface Segment {
  startJd: number;
  endJd: number;
  startLocal: string;
  endLocal: string;
  sign: SignNumber;
  signName: string;
}

export interface EventFit {
  event: LifeEvent;
  label: string;
  /** 0–100 */
  score: number;
  /** This candidate is within 8% of the best time for this event */
  fitsBest: boolean;
  /** When in the event's span the match was strongest */
  peak: string;
  dasha: { chain: string; parts: { lord: string; level: number; value: number; reasons: string[] }[] };
  transits: string[];
  summary: string;
}

export interface Candidate {
  rank: number;
  jd: number;
  utc: string;
  local: string;
  localTime: string;
  /** 0–100 */
  score: number;
  /** Range of birth times sharing this lagna + navamsa */
  window: { startLocal: string; endLocal: string; minutes: number };
  lagna: { sign: SignNumber; name: string; degree: number };
  navamsa: { sign: SignNumber; name: string };
  d60: Shashtiamsa & { sign: SignNumber; signName: string };
  moon: { nakshatra: string; pada: number; dashaLord: string; balanceYears: number };
  fits: number;
  events: EventFit[];
  summary: string;
}

export interface CurvePoint {
  jd: number;
  local: string;
  score: number;
  lagna: SignNumber;
  navamsa: SignNumber;
}

export interface RectifyResult {
  timezone: string;
  utcOffsetMinutes: number;
  window: { startJd: number; endJd: number; startLocal: string; endLocal: string; minutes: number };
  stepMinutes: number;
  changePoints: ChangePoint[];
  lagnaSegments: Segment[];
  navamsaSegments: Segment[];
  curve: CurvePoint[];
  candidates: Candidate[];
  confidence: 'clear' | 'moderate' | 'close' | 'none';
  notes: string[];
}

const MIN = 1 / 1440;
const SEC = 1 / 86400;

export function rectify(engine: Engine, input: RectifyInput): RectifyResult {
  const settings: ChartSettings = { ayanamsa: input.ayanamsa ?? 'lahiri', nodeType: input.nodeType ?? 'mean' };
  const { place } = input;
  const timezone = place.timezone || timezoneAt(place.latitude, place.longitude);
  const start = localToUtc(input.date, input.from, timezone, input.utcOffsetMinutes, place.longitude);
  let end = localToUtc(input.date, input.to, timezone, input.utcOffsetMinutes, place.longitude);
  if (end.utc.getTime() <= start.utc.getTime()) end = { ...end, utc: new Date(end.utc.getTime() + 86400000) };
  const startJd = dateToJd(start.utc), endJd = dateToJd(end.utc);
  const minutes = Math.round((endJd - startJd) / MIN);
  if (minutes < 4) throw new Error('The time window must be at least a few minutes long');
  if (minutes > 36 * 60) throw new Error('The time window can be at most 36 hours');
  const offset = start.utcOffsetMinutes;
  const local = (jd: number) => new Date(Math.round(jdToDate(jd).getTime() / 1000) * 1000 + offset * 60000).toISOString().slice(0, 19).replace('T', ' ');

  // ---------------------------------------------------------- change points
  const ascAt = (jd: number) => engine.ascendantAt(jd, place.latitude, place.longitude, settings.ayanamsa);
  const moonAt = (jd: number) => engine.longitudeAt('moon', jd, settings).longitude;
  const changePoints: ChangePoint[] = [];
  const track = (kind: ChangeKind, sample: number, f: (jd: number) => number, label: (k: number) => string) => {
    let a = startJd, ka = f(a);
    while (a < endJd) {
      const b = Math.min(a + sample, endJd);
      if (f(b) === ka) { a = b; continue; }
      let lo = a, hi = b;
      while (hi - lo > SEC) {
        const mid = (lo + hi) / 2;
        if (f(mid) === ka) lo = mid; else hi = mid;
      }
      const k2 = f(hi);
      changePoints.push({ kind, jd: hi, utc: jdToDate(hi).toISOString(), local: local(hi), from: label(ka), to: label(k2) });
      a = hi; ka = k2;
    }
  };
  const signLabel = (s: number) => SIGN_NAMES[s - 1];
  const d60Key = (l: number) => Math.floor(((l % 360) + 360) % 360 * 2); // 720 parts of 0°30'
  const d60Label = (k: number) => { const lon = k / 2 + 0.01, s = shashtiamsaOf(lon); return `${signLabel(Math.floor(lon / 30) + 1)} D60 ${s.index} ${s.name}`; };
  track('lagna', 5 * MIN, (jd) => vargaSign(ascAt(jd), 'D1'), signLabel);
  track('navamsa', 1 * MIN, (jd) => vargaSign(ascAt(jd), 'D9'), signLabel);
  track('shashtiamsa', 15 * SEC, (jd) => d60Key(ascAt(jd)), d60Label);
  const nkKey = (jd: number) => Math.floor(moonAt(jd) / (NAKSHATRA_SPAN / 4)); // pada index 0–107
  track('nakshatra', 30 * MIN, nkKey, (k) => `${NAKSHATRAS[Math.floor(k / 4)].name} pada ${(k % 4) + 1}`);
  changePoints.sort((x, y) => x.jd - y.jd);

  const segments = (kind: ChangeKind, signAt: (jd: number) => SignNumber): Segment[] => {
    const cuts = [startJd, ...changePoints.filter((c) => c.kind === kind).map((c) => c.jd), endJd];
    return cuts.slice(0, -1).map((a, i) => {
      const b = cuts[i + 1], s = signAt((a + b) / 2);
      return { startJd: a, endJd: b, startLocal: local(a), endLocal: local(b), sign: s, signName: signLabel(s) };
    });
  };
  const lagnaSegments = segments('lagna', (jd) => vargaSign(ascAt(jd), 'D1'));
  const navamsaSegments = segments('navamsa', (jd) => vargaSign(ascAt(jd), 'D9'));

  // ---------------------------------------------------------- event samples
  const prepared = input.events.filter((ev) => ev.kind !== 'other').map((ev) => {
    const def = EVENT_DEFS[ev.kind];
    if (!def) throw new Error(`Unknown life event "${ev.kind}"`);
    const span = eventSpan(ev);
    const samples = spanSamples(span).map((d) => {
      const jd = dateToJd(d);
      const p = engine.positionsAt(jd, settings).planets;
      const t: TransitPositions = { jupiter: p.jupiter.longitude, saturn: p.saturn.longitude, rahu: p.rahu.longitude, ketu: p.ketu.longitude, mars: p.mars.longitude };
      return { jd, date: d, t };
    });
    // an exact day is worth checking down to the sookshma, which runs for days to weeks
    const levels = WEIGHTS.levels[span.precision].length;
    return { ev, def, precision: span.precision, samples, weight: ev.weight ?? 1, levels };
  });
  const totalWeight = prepared.reduce((s, p) => s + p.weight, 0);

  type Eval = { value: number; sample: number };
  const evaluate = (c: CandidateChart, p: (typeof prepared)[number]): Eval => {
    let best = { value: -1, sample: 0 };
    p.samples.forEach((s, i) => {
      const chain = dashaChain(c, s.jd, p.levels);
      const v = WEIGHTS.dasha * dashaMatch(c, chain, p.def, p.precision).value + WEIGHTS.transit * transitMatch(c, s.t, p.def).value;
      if (v > best.value) best = { value: v, sample: i };
    });
    return best;
  };

  // ---------------------------------------------------------- candidate grid
  const stepMinutes = input.stepMinutes ?? Math.min(5, Math.max(1, Math.round(minutes / 300)));
  const likely = input.likely
    ? { jd: likelyJd(input, timezone, startJd, endJd), sigma: Math.max(5, input.likely.plusMinusMinutes ?? 30) * MIN }
    : null;
  const grid: { c: CandidateChart; evals: Eval[]; score: number }[] = [];
  const steps = Math.floor(minutes / stepMinutes + 1e-9);
  for (let i = 0; i <= steps; i++) {
    const jd = startJd + i * stepMinutes * MIN;
    const c = candidateChart(engine, jd, place, settings);
    const evals = prepared.map((p) => evaluate(c, p));
    let s = totalWeight ? evals.reduce((acc, e, i) => acc + e.value * prepared[i].weight, 0) / totalWeight : 0;
    if (likely) {
      const prior = Math.exp(-(((jd - likely.jd) / likely.sigma) ** 2) / 2);
      s = totalWeight ? 0.85 * s + 0.15 * prior : prior;
    }
    grid.push({ c, evals, score: s });
  }
  const bestPerEvent = prepared.map((_, i) => Math.max(...grid.map((g) => g.evals[i].value)));

  const curve: CurvePoint[] = grid.map((g) => ({
    jd: g.c.jd, local: local(g.c.jd), score: round1(g.score * 100), lagna: g.c.ascSign, navamsa: vargaSign(g.c.asc, 'D9'),
  }));

  // ---------------------------------------------------------- group + rank
  type Group = { from: number; to: number; best: number; mean: number };
  const groups: Group[] = [];
  grid.forEach((g, i) => {
    const key = `${g.c.ascSign}-${vargaSign(g.c.asc, 'D9')}`;
    const prev = groups[groups.length - 1];
    if (prev && keyOf(grid[prev.to]) === key) prev.to = i;
    else groups.push({ from: i, to: i, best: i, mean: 0 });
  });
  for (const gr of groups) {
    let sum = 0;
    for (let i = gr.from; i <= gr.to; i++) {
      sum += grid[i].score;
      if (grid[i].score > grid[gr.best].score) gr.best = i;
    }
    gr.mean = sum / (gr.to - gr.from + 1);
  }
  const rankValue = (gr: Group) => 0.75 * grid[gr.best].score + 0.25 * gr.mean;
  const ranked = [...groups].sort((a, b) => rankValue(b) - rankValue(a)).slice(0, input.top ?? 5);

  const navSeg = (jd: number) => navamsaSegments.find((s) => jd >= s.startJd && jd <= s.endJd) ?? navamsaSegments[navamsaSegments.length - 1];
  const candidates: Candidate[] = ranked.map((gr, rank) => {
    const g = grid[gr.best];
    const c = g.c;
    const seg = navSeg(c.jd);
    const nkIdx = Math.min(26, Math.floor(c.lon.moon / NAKSHATRA_SPAN));
    const events = prepared.map((p, i) => explain(c, p, g.evals[i], bestPerEvent[i]));
    const d60 = shashtiamsaOf(c.asc);
    const d60Sign = vargaSign(c.asc, 'D60');
    const fits = events.filter((e) => e.fitsBest).length;
    const lagnaName = SIGN_NAMES[c.ascSign - 1], navName = SIGN_NAMES[vargaSign(c.asc, 'D9') - 1];
    const strongest = [...events].sort((a, b) => b.score - a.score)[0];
    return {
      rank: rank + 1,
      jd: c.jd,
      utc: jdToDate(c.jd).toISOString(),
      local: local(c.jd),
      localTime: local(c.jd).slice(11, 16),
      score: round1(g.score * 100),
      window: { startLocal: seg.startLocal, endLocal: seg.endLocal, minutes: Math.round((seg.endJd - seg.startJd) / MIN) },
      lagna: { sign: c.ascSign, name: lagnaName, degree: round2(c.asc % 30) },
      navamsa: { sign: vargaSign(c.asc, 'D9'), name: navName },
      d60: { ...d60, sign: d60Sign, signName: SIGN_NAMES[d60Sign - 1] },
      moon: {
        nakshatra: NAKSHATRAS[nkIdx].name,
        pada: Math.min(3, Math.floor(((c.lon.moon % NAKSHATRA_SPAN) / NAKSHATRA_SPAN) * 4)) + 1,
        dashaLord: PLANET_LABEL[NAKSHATRAS[nkIdx].lord],
        balanceYears: round2(c.balanceYears),
      },
      fits,
      events,
      summary: prepared.length
        ? `${lagnaName} lagna with ${navName} navamsa. Fits ${fits} of ${prepared.length} event${prepared.length === 1 ? '' : 's'} as well as any time in the window${strongest ? `; strongest match: ${strongest.label.toLowerCase()} (${Math.round(strongest.score)}/100)` : ''}.`
        : `${lagnaName} lagna with ${navName} navamsa.`,
    };
  });

  const notes: string[] = [];
  if (!prepared.length) notes.push('Add life events with dates to rank the times; without them only the change points are shown.');
  if (prepared.length > 0 && prepared.length < 3) notes.push('Three or more dated events (ideally a mix such as marriage, a child, a career change, a parent’s passing) make the ranking much more reliable.');
  if (lagnaSegments.length > 1) notes.push(`The window crosses ${lagnaSegments.length - 1} lagna change${lagnaSegments.length > 2 ? 's' : ''}, so the rising sign itself is in question.`);
  if (changePoints.some((c) => c.kind === 'nakshatra' && c.from.split(' pada')[0] !== c.to.split(' pada')[0]))
    notes.push('The Moon changes nakshatra inside the window, so the whole dasha sequence differs on either side of that moment.');
  if (start.localMeanTime) notes.push('This date is before standard time at the birthplace, so local mean time was used.');

  let confidence: RectifyResult['confidence'] = 'none';
  if (prepared.length && candidates.length > 1) {
    const gap = candidates[0].score - candidates[1].score;
    confidence = gap >= 6 ? 'clear' : gap >= 2.5 ? 'moderate' : 'close';
  } else if (prepared.length && candidates.length === 1) confidence = 'clear';

  return {
    timezone,
    utcOffsetMinutes: offset,
    window: { startJd, endJd, startLocal: local(startJd), endLocal: local(endJd), minutes },
    stepMinutes,
    changePoints,
    lagnaSegments,
    navamsaSegments,
    curve,
    candidates,
    confidence,
    notes,
  };

  function keyOf(g: (typeof grid)[number]) {
    return `${g.c.ascSign}-${vargaSign(g.c.asc, 'D9')}`;
  }

  function explain(c: CandidateChart, p: (typeof prepared)[number], e: Eval, best: number): EventFit {
    const s = p.samples[e.sample];
    const chain = dashaChain(c, s.jd, p.levels);
    const dm = dashaMatch(c, chain, p.def, p.precision);
    const tm = transitMatch(c, s.t, p.def);
    const chainLabel = chain.map((g) => PLANET_LABEL[g]).join('–');
    const strong = dm.parts.filter((x) => x.value >= 0.35).map((x) => PLANET_LABEL[x.lord]);
    return {
      event: p.ev,
      label: p.def.label,
      score: round1(e.value * 100),
      fitsBest: best > 0 && e.value >= best * 0.92,
      peak: s.date.toISOString().slice(0, 10),
      dasha: { chain: chainLabel, parts: dm.parts.map((x) => ({ lord: PLANET_LABEL[x.lord], level: x.level, value: round2(x.value), reasons: x.reasons })) },
      transits: tm.reasons,
      summary: summarise(p.def, p.precision, chainLabel, strong, tm.reasons.length),
    };
  }
}

function summarise(def: EventDef, precision: DatePrecision, chain: string, strong: string[], transitHits: number) {
  const lead = `${chain} periods were running`;
  const sig = strong.length ? `; ${strong.join(' and ')} ${strong.length > 1 ? 'are' : 'is'} strongly tied to ${def.label.toLowerCase()} in this chart` : `, but none of these lords is strongly tied to ${def.label.toLowerCase()} here`;
  const tr = transitHits ? `, with ${transitHits} supporting transit${transitHits > 1 ? 's' : ''}` : '';
  const prec = precision === 'year' ? ' (the date is only known to the year, so the sub-period counts less)' : '';
  return `${lead}${sig}${tr}.${prec}`;
}

function likelyJd(input: RectifyInput, tz: string, startJd: number, endJd: number) {
  const r = localToUtc(input.date, input.likely!.time, tz, input.utcOffsetMinutes, input.place.longitude);
  let jd = dateToJd(r.utc);
  if (jd < startJd) jd += 1;
  return Math.min(endJd, Math.max(startJd, jd));
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

export type { GrahaId };
