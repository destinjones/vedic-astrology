/**
 * When will it happen? KP timing for a Prashna.
 *
 * KP times a horary answer with the Vimshottari dasha of the question itself:
 * the dasha is started from the Moon's position at the moment of asking, and
 * the matter fructifies in the first dasha–bhukti–antara (DBA) whose lords
 * all signify the houses that fulfil the question and not, mainly, the ones
 * that deny it (K. S. Krishnamurti, KP Reader VI, "Horary Astrology"). The
 * ruling planets of the moment are used to pick among candidates: a period
 * run by ruling planets is preferred.
 *
 * This finds those periods over a horizon that suits the question (months for
 * a lost item or an exam, two years for most matters) and narrows the first
 * one to the sookshma level where the fourth lord agrees too.
 */
import { GRAHAS, PLANET_NAMES } from './constants';
import { dateToJd, jdToIso } from './time';
import { vimshottari } from './dasha';
import type { DashaPeriod, GrahaId } from './types';
import type { KpChart } from './kp';
import type { PrashnaResult, PrashnaTopic } from './prashna';

export interface LordVerdict {
  planet: GrahaId;
  /** Signifies a fulfilling house more than a denying one */
  fulfils: boolean;
  favourable: number[];
  adverse: number[];
  /** Weighted (level A 4 … level D 1) fulfilling minus denying */
  net: number;
  ruling: boolean;
}

export interface PrashnaTimingWindow {
  start: string;
  end: string;
  /** Dasha – bhukti – antara lords */
  path: GrahaId[];
  score: number;
  why: string;
  /** For the first window: sookshmas inside it whose lord agrees too */
  sookshma?: { start: string; end: string; lord: GrahaId }[];
}

export interface PrashnaTiming {
  /** The dasha of the question, at the moment of asking */
  running: GrahaId[];
  horizonDays: number;
  lords: Record<GrahaId, LordVerdict>;
  /** Fruitful periods in time order (at most `limit`) */
  windows: PrashnaTimingWindow[];
  /** The earliest window, the usual KP answer */
  first: PrashnaTimingWindow | null;
  summary: string;
}

/** How far ahead it is worth looking for each kind of question. */
const HORIZON_DAYS: Partial<Record<PrashnaTopic, number>> = {
  lost_item: 120,
  exam: 240,
  travel: 365,
  health: 365,
  vehicle: 540,
};

const name = (g: GrahaId) => PLANET_NAMES[g];

function weighted(chart: KpChart, g: GrahaId) {
  const s = chart.significations[g];
  const w = new Map<number, number>();
  const add = (hs: number[], v: number) => hs.forEach((h) => w.set(h, Math.max(w.get(h) ?? 0, v)));
  add(s.levelD, 1);
  add(s.levelC, 2);
  add(s.agent, 2);
  add(s.levelB, 3);
  add(s.levelA, 4);
  return w;
}

export function lordVerdicts(res: Pick<PrashnaResult, 'chart' | 'topic'>): Record<GrahaId, LordVerdict> {
  const out = {} as Record<GrahaId, LordVerdict>;
  const rp = res.chart.ruling.planets;
  for (const g of GRAHAS) {
    const w = weighted(res.chart, g);
    const favourable = res.topic.favourable.filter((h) => w.has(h));
    const adverse = res.topic.adverse.filter((h) => w.has(h));
    const net = favourable.reduce((s, h) => s + (w.get(h) ?? 0), 0) - adverse.reduce((s, h) => s + (w.get(h) ?? 0), 0);
    out[g] = { planet: g, favourable, adverse, net, fulfils: favourable.length > 0 && net > 0, ruling: rp.includes(g) };
  }
  return out;
}

export function prashnaTiming(res: Pick<PrashnaResult, 'chart' | 'topic'>, opts: { horizonDays?: number; limit?: number; from?: Date } = {}): PrashnaTiming {
  const horizonDays = opts.horizonDays ?? HORIZON_DAYS[res.topic.id] ?? 730;
  const limit = opts.limit ?? 4;
  const jd = res.chart.jdUt;
  const fromJd = opts.from ? dateToJd(opts.from) : jd;
  const toJd = fromJd + horizonDays;
  const dasha = vimshottari(res.chart.planets.moon.longitude, jd, { levels: 4 });
  const lords = lordVerdicts(res);

  const antaras: DashaPeriod[] = [];
  const walk = (ps: DashaPeriod[] | undefined) => {
    for (const p of ps ?? []) {
      if (p.endJd <= fromJd || p.startJd >= toJd) continue;
      if (p.level === 3) antaras.push(p);
      else walk(p.children);
    }
  };
  walk(dasha.periods);

  const running = (() => {
    const chain: GrahaId[] = [];
    let list: DashaPeriod[] | undefined = dasha.periods;
    while (list && chain.length < 3) {
      const p: DashaPeriod | undefined = list.find((x) => jd >= x.startJd && jd < x.endJd);
      if (!p) break;
      chain.push(p.lord);
      list = p.children;
    }
    return chain;
  })();

  // a DBA is fruitful when the bhukti and antara lords both fulfil; the dasha lord
  // sets the background and only adds to the score
  const windows: PrashnaTimingWindow[] = [];
  let lastEndJd = -Infinity;
  for (const p of antaras) {
    const [d, b, a] = p.path;
    const lb = lords[b], la = lords[a], ld = lords[d];
    if (!lb.fulfils || !la.fulfils) continue;
    const score = lb.net + la.net + Math.max(0, ld.net) * 0.5 + (lb.ruling ? 3 : 0) + (la.ruling ? 3 : 0) + (ld.ruling ? 1 : 0);
    const bits = [b, a].map((g) => `${name(g)} (${lords[g].favourable.join(', ')}${lords[g].ruling ? ', a ruling planet' : ''})`);
    const why = `${name(b)} bhukti and ${name(a)} antara both signify the fulfilling houses: ${bits.join('; ')}${ld.fulfils ? `, inside ${name(d)} dasha, which agrees` : ''}.`;
    const start = Math.max(p.startJd, fromJd);
    const prev = windows[windows.length - 1];
    // merge back-to-back antaras with the same bhukti into one window
    if (prev && prev.path[0] === d && prev.path[1] === b && Math.abs(lastEndJd - p.startJd) < 1e-6) {
      prev.end = p.end;
      lastEndJd = p.endJd;
      prev.path = [d, b, ...prev.path.slice(2), a];
      prev.score = Math.max(prev.score, score);
      prev.why = `${name(b)} bhukti with the ${prev.path.slice(2).map(name).join(' and ')} antaras: each lord signifies the fulfilling houses.`;
      continue;
    }
    windows.push({ start: jdToIso(start), end: p.end, path: [d, b, a], score: Math.round(score * 10) / 10, why });
    lastEndJd = p.endJd;
  }

  const shown = windows.slice(0, limit);
  const first = shown[0] ?? null;
  if (first) {
    const s = dateToJd(new Date(first.start)), e = dateToJd(new Date(first.end));
    const subs: { start: string; end: string; lord: GrahaId }[] = [];
    const walk4 = (ps: DashaPeriod[] | undefined) => {
      for (const p of ps ?? []) {
        if (p.endJd <= s || p.startJd >= e) continue;
        if (p.level === 4) { if (lords[p.lord].fulfils) subs.push({ start: jdToIso(Math.max(p.startJd, s)), end: p.end, lord: p.lord }); }
        else walk4(p.children);
      }
    };
    walk4(dasha.periods);
    first.sookshma = subs.slice(0, 6);
  }

  const fmt = (iso: string) => iso.slice(0, 10);
  const summary = first
    ? `By the dasha of the question (${running.map(name).join('–')} running when you asked), the first fruitful period is ${fmt(first.start)} to ${fmt(first.end)}, ${first.path.slice(1).map(name).join('–')}${first.sookshma?.length ? `, most likely in the ${name(first.sookshma[0].lord)} sookshma from ${fmt(first.sookshma[0].start)}` : ''}.`
    : `No dasha–bhukti–antara in the next ${horizonDays >= 365 ? `${Math.round(horizonDays / 365)} year${horizonDays >= 730 ? 's' : ''}` : `${Math.round(horizonDays / 30)} months`} has both lords signifying the fulfilling houses, so the chart gives no clear time inside that span.`;
  return { running, horizonDays, lords, windows: shown, first, summary };
}
