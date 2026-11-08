/**
 * Client snapshot: one page to read before a session. The chart's top
 * strengths and challenges, the running dasha and what it is about, the slow
 * transits now, and the flags an astrologer should not miss (Sade Sati,
 * Kantaka or Ashtama Shani, Mangal dosha and other doshas, a dasha change
 * coming up, Chandrashtama today).
 *
 * Everything comes from the existing engine and rule sets; nothing here is
 * generated text from a model.
 */
import { DOSHA_SOURCES, NAKSHATRAS, YOGA_SOURCES } from '@vedic/interpretations';
import { findingsOf, sadeSatiCountdown, todayBrief } from '@vedic/personal';
import {
  type Planet,
  type Tone,
  DAY_MS,
  HOUSE_TOPICS,
  SATURN_PHASE_TEXT,
  findIngresses,
  ordinal,
  saturnPhases,
  signName,
  transitSnapshot,
} from '@vedic/timing';
import type { PointTone } from './areas';
import { citeOf, monthYear, runningChain, subPeriods, isoDay, joinList, type ConsultContext } from './context';

export interface SnapshotItem {
  title: string;
  text: string;
  source?: string;
}

export interface SnapshotPeriod {
  lord: Planet;
  start: string;
  end: string;
  score: number;
  tone: Tone;
}

export interface SnapshotTransit {
  planet: Planet;
  signName: string;
  houseFromLagna: number;
  houseFromMoon: number;
  retrograde: boolean;
  tone: PointTone;
  text: string;
  /** ISO date it changes sign, if within three years. */
  until?: string;
}

export type FlagLevel = 'high' | 'watch' | 'info';

export interface SnapshotFlag {
  id: string;
  label: string;
  level: FlagLevel;
  text: string;
  source?: string;
}

export interface ClientSnapshot {
  name: string;
  at: string;
  bigThree: { lagna: string; moon: string; nakshatra: string };
  strengths: SnapshotItem[];
  challenges: SnapshotItem[];
  dasha: {
    maha?: SnapshotPeriod;
    antar?: SnapshotPeriod;
    pratyantar?: SnapshotPeriod;
    /** "Saturn–Mercury brings career, status… and wealth, family… to the front." */
    theme: string;
    /** The scoring rules behind the period, strongest first. */
    reasons: string[];
    next?: { at: string; path: Planet[]; level: 'mahadasha' | 'antardasha' };
  };
  transits: SnapshotTransit[];
  flags: SnapshotFlag[];
}

/** "career and status" from the house topic list. */
const topicOf = (h: number) => HOUSE_TOPICS[h].split(',').slice(0, 2).map((x) => x.trim()).join(' and ');

const SLOW: Planet[] = ['Saturn', 'Jupiter', 'Rahu', 'Ketu'];

const period = (p: { lord: Planet; start: Date; end: Date; score: number; tone: Tone }): SnapshotPeriod =>
  ({ lord: p.lord, start: p.start.toISOString(), end: p.end.toISOString(), score: p.score, tone: p.tone });

const toneWord = (t: Tone) => (t === 'excellent' || t === 'good' ? 'supportive' : t === 'mixed' ? 'mixed' : 'demanding');

function strengthsOf(ctx: ConsultContext): SnapshotItem[] {
  const out: SnapshotItem[] = [];
  const seen = new Set<string>();
  const yogas = findingsOf(ctx.report).filter((f) => f.kind === 'yoga' && !f.difficult && f.level <= 2);
  for (const f of yogas) {
    if (seen.has(f.id) || out.length >= 3) continue;
    seen.add(f.id);
    const y = ctx.report.yogas.find((x) => x.id === f.id)!;
    out.push({ title: y.name, text: `${y.reading.summary} ${y.reason}`.trim(), source: citeOf(YOGA_SOURCES[y.id]) });
  }
  for (const r of ctx.report.highlights.strengths) {
    if (out.length >= 5) break;
    if (r.score <= 0 || seen.has(r.title)) continue;
    seen.add(r.title);
    out.push({ title: r.title, text: r.summary, source: citeOf(r.source) });
  }
  return out;
}

function challengesOf(ctx: ConsultContext): SnapshotItem[] {
  const out: SnapshotItem[] = [];
  const rank = { high: 0, moderate: 1, low: 2, cancelled: 3 } as const;
  const doshas = ctx.report.doshas.filter((d) => d.present && d.severity !== 'cancelled' && d.severity !== 'low').sort((a, b) => rank[a.severity] - rank[b.severity]);
  for (const d of doshas.slice(0, 2)) out.push({ title: d.name, text: `${d.reading.summary} ${d.reason}`.trim(), source: citeOf(DOSHA_SOURCES[d.id]) });
  const arishta = ctx.report.yogas.filter((y) => y.category === 'arishta' && y.strength !== 'weak');
  for (const y of arishta) {
    if (out.length >= 2) break;
    out.push({ title: y.name, text: `${y.reading.summary} ${y.reason}`.trim(), source: citeOf(YOGA_SOURCES[y.id]) });
  }
  for (const r of ctx.report.highlights.challenges) {
    if (out.length >= 3) break;
    if (r.score >= 0 || out.some((o) => o.title === r.title)) continue;
    out.push({ title: r.title, text: r.summary, source: citeOf(r.source) });
  }
  return out;
}

function dashaOf(ctx: ConsultContext): ClientSnapshot['dasha'] {
  const chain = runningChain(ctx);
  const [maha, antar, praty] = chain;
  if (!maha) return { theme: 'No running Vimshottari period was found for this date.', reasons: [] };
  const deepest = antar ?? maha;
  const themes = [...maha.themes, ...(antar?.themes ?? [])];
  const houses = [...new Set(themes.map((t) => t.house))].slice(0, 3);
  const theme = `${maha.lord}${antar && antar.lord !== maha.lord ? `–${antar.lord}` : ''} brings ${joinList(houses.map((h) => `${topicOf(h)} (${ordinal(h)})`))} to the front. The period scores ${deepest.score > 0 ? '+' : ''}${deepest.score} for this chart, ${toneWord(deepest.tone)}.`;
  // a sub-period's reasons repeat its parent's with a "[Lord] " prefix; keep each rule once
  const reasons = [...new Set([...deepest.reasons].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).map((r) => r.text.replace(/^\[\w+\]\s*/, '')))].slice(0, 4);

  // the next change: antardasha boundary, or mahadasha if that comes first
  let next: ClientSnapshot['dasha']['next'];
  if (antar) {
    const subs = subPeriods(ctx, maha);
    const i = subs.indexOf(antar);
    const after = subs[i + 1];
    if (after) next = { at: after.start.toISOString(), path: [maha.lord, after.lord], level: 'antardasha' };
    else {
      const nm = ctx.dashas[ctx.dashas.indexOf(maha) + 1];
      if (nm) next = { at: nm.start.toISOString(), path: [nm.lord], level: 'mahadasha' };
    }
  }
  return { maha: period(maha), antar: antar && period(antar), pratyantar: praty && period(praty), theme, reasons, next };
}

function transitsOf(ctx: ConsultContext): SnapshotTransit[] {
  const snap = transitSnapshot(ctx.natal, ctx.eph.positions(ctx.now), ctx.now, ctx.av);
  const horizon = new Date(ctx.now.getTime() + 3 * 365.25 * DAY_MS);
  return SLOW.map((p) => {
    const t = snap.planets.find((x) => x.planet === p)!;
    const ing = findIngresses(ctx.eph, p, ctx.now, horizon)[0];
    const area = topicOf(t.houseFromLagna);
    const contact = t.contacts[0];
    const text = `${p}${t.retrograde ? ' (retrograde)' : ''} in ${signName(t.sign)}: ${ordinal(t.houseFromLagna)} from the lagna (${area}), ${ordinal(t.houseFromMoon)} from the Moon, ${t.favourable && !t.obstructedBy ? 'favourable' : t.obstructedBy ? `blocked by ${t.obstructedBy}` : 'not favourable'} by gochara${t.bindus !== null ? `, ${t.bindus} bindus` : ''}.${contact ? ` ${contact.kind === 'conjunction' ? 'Over' : 'Opposite'} natal ${contact.natal} (${contact.orb}°).` : ''}`;
    const tone: PointTone = t.tone === 'excellent' || t.tone === 'good' ? 'good' : t.tone === 'mixed' ? 'mixed' : 'hard';
    return { planet: p, signName: signName(t.sign), houseFromLagna: t.houseFromLagna, houseFromMoon: t.houseFromMoon, retrograde: t.retrograde, tone, text, until: ing?.date.toISOString() };
  });
}

function flagsOf(ctx: ConsultContext, dasha: ClientSnapshot['dasha'], transits: SnapshotTransit[]): SnapshotFlag[] {
  const out: SnapshotFlag[] = [];
  const day = (iso: string) => monthYear(new Date(iso));

  const ss = sadeSatiCountdown(ctx.engine, ctx.chart, ctx.now);
  if (ss?.state === 'in') {
    out.push({ id: 'sade-sati', label: 'Sade Sati', level: 'high', text: `${ss.phase ? `${ss.phase.label}. ` : ''}Runs until ${day(ss.spell.end)}. Saturn has ${ss.spell.bindus.join(', ')} bindus in the three signs.` });
  } else if (ss && ss.days < 730) {
    out.push({ id: 'sade-sati', label: 'Sade Sati soon', level: 'watch', text: `Begins ${day(ss.spell.start)}, in about ${Math.round(ss.days / 30.44)} months.` });
  }
  const from = new Date(ctx.now.getTime() - 3 * 365.25 * DAY_MS), to = new Date(ctx.now.getTime() + 3 * 365.25 * DAY_MS);
  const ph = saturnPhases(ctx.eph, ctx.natal, from, to).phases.find((p) => (p.kind === 'kantaka' || p.kind === 'ashtama') && p.start <= ctx.now && ctx.now < p.end);
  if (ph) out.push({ id: ph.kind, label: ph.kind === 'kantaka' ? 'Kantaka Shani' : 'Ashtama Shani', level: ph.kind === 'ashtama' ? 'high' : 'watch', text: `${SATURN_PHASE_TEXT[ph.kind]} Until ${day(ph.end.toISOString())}.` });

  const sev: Record<string, FlagLevel> = { high: 'high', moderate: 'watch', low: 'info' };
  for (const d of ctx.report.doshas) {
    if (!d.present) continue;
    if (d.severity === 'cancelled') {
      if (d.id === 'manglik') out.push({ id: d.id, label: `${d.name} (cancelled)`, level: 'info', text: d.cancellations[0] ?? d.reason, source: citeOf(DOSHA_SOURCES[d.id]) });
      continue;
    }
    out.push({ id: d.id, label: d.name, level: sev[d.severity], text: d.reason, source: citeOf(DOSHA_SOURCES[d.id]) });
  }

  if (dasha.next) {
    const days = (Date.parse(dasha.next.at) - ctx.now.getTime()) / DAY_MS;
    const limit = dasha.next.level === 'mahadasha' ? 365 : 90;
    if (days <= limit) out.push({ id: 'dasha-change', label: dasha.next.level === 'mahadasha' ? 'Mahadasha change' : 'Sub-period change', level: dasha.next.level === 'mahadasha' ? 'high' : 'watch', text: `${dasha.next.path.join('–')} begins ${isoDay(new Date(dasha.next.at))}, in ${Math.max(1, Math.round(days))} days.` });
  }

  for (const t of transits) if (/Over natal (Moon|Sun|Ascendant)|Opposite natal (Moon|Ascendant)/.test(t.text)) {
    out.push({ id: `contact-${t.planet}`, label: `${t.planet} on a sensitive point`, level: t.planet === 'Jupiter' ? 'info' : 'watch', text: t.text });
  }

  const today = todayBrief(ctx.engine, ctx.chart, ctx.now);
  if (today.chandrashtama.active) out.push({ id: 'chandrashtama', label: 'Chandrashtama today', level: 'info', text: `The Moon is 8th from the birth Moon until ${today.chandrashtama.endsAt!.slice(0, 16).replace('T', ' ')} UTC. Not a day for the client to start something big.` });
  else if (today.tara.number === 7) out.push({ id: 'naidhana-tara', label: 'Naidhana tara today', level: 'info', text: today.tara.text });

  const order: Record<FlagLevel, number> = { high: 0, watch: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

export function clientSnapshot(ctx: ConsultContext, name = ''): ClientSnapshot {
  const c = ctx.chart;
  const moon = c.planets.moon;
  const dasha = dashaOf(ctx);
  const transits = transitsOf(ctx);
  return {
    name: name || 'Client',
    at: ctx.now.toISOString(),
    bigThree: {
      lagna: signName(c.ascendant.sign - 1),
      moon: signName(moon.sign - 1),
      nakshatra: `${NAKSHATRAS[moon.nakshatra - 1].name} pada ${moon.pada}`,
    },
    strengths: strengthsOf(ctx),
    challenges: challengesOf(ctx),
    dasha,
    transits,
    flags: flagsOf(ctx, dasha, transits),
  };
}
