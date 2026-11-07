/**
 * Prediction scoring loop.
 *
 * The timeline flags windows as favourable or challenging and says why: the
 * dasha lords and the rules that scored them, and the transits pushing
 * hardest. Once a window is in the past the user can say whether it
 * delivered ("happened") or not ("didn't"). Each mark keeps a snapshot of the
 * rules behind the window, so the record survives changes to the scoring,
 * and the hit rate of every rule can be read off the marks.
 *
 * This is deliberately simple counting, shown with the number of marks
 * behind it. A rule with three marks proves nothing, and the UI says so.
 */
import { type Ephemeris, type NatalChart, type Planet, PLANETS } from './types';
import { DAY_MS, toneOf } from './astro';
import { activeDashas, type DashaPeriod } from './dasha';
import { transitBaseline, transitSeries } from './transits';
import { findWindows, type CombinedPoint, type Window } from './timeline';
import { windowId } from './ics';

export type Outcome = 'happened' | 'didnt';

export interface PredictionRule {
  /** Stable key, e.g. "placement-kendra" or "transit-Jupiter-up" */
  key: string;
  label: string;
  /** Which part of the method it belongs to */
  family: 'dasha lord' | 'dignity' | 'placement' | 'lordship' | 'period pair' | 'condition' | 'transit';
}

export interface PredictionMark {
  /** windowId() of the window */
  id: string;
  outcome: Outcome;
  tone: Window['tone'];
  /** ISO dates */
  start: string;
  end: string;
  dashaPath: Planet[];
  rules: PredictionRule[];
  /** Optional note on what happened */
  note?: string;
  /** ISO time of marking */
  markedAt: string;
}

/** Classify a dasha reason's free text into a stable rule. */
const PATTERNS: [RegExp, Omit<PredictionRule, 'key'> & { key: string }][] = [
  [/neecha bhanga/i, { key: 'neecha-bhanga', label: 'Debilitation cancelled (neecha bhanga)', family: 'dignity' }],
  [/debilitated/i, { key: 'dignity-debilitated', label: 'Period lord debilitated', family: 'dignity' }],
  [/exalted/i, { key: 'dignity-exalted', label: 'Period lord exalted', family: 'dignity' }],
  [/\bis (own|moolatrikona)\b/i, { key: 'dignity-own', label: 'Period lord in own sign or moolatrikona', family: 'dignity' }],
  [/is (great friend|friend) \(compound/i, { key: 'dignity-friendly', label: 'Period lord in a friendly sign', family: 'dignity' }],
  [/is (great enemy|enemy) \(compound/i, { key: 'dignity-enemy', label: 'Period lord in an enemy sign', family: 'dignity' }],
  [/Viparita/i, { key: 'viparita', label: 'Viparita raja yoga (dusthana lord in a dusthana)', family: 'placement' }],
  [/placed in the (1st|4th|7th|10th) house/i, { key: 'placement-kendra', label: 'Period lord in a kendra (1, 4, 7, 10)', family: 'placement' }],
  [/placed in the (5th|9th) house/i, { key: 'placement-trikona', label: 'Period lord in a trikona (5, 9)', family: 'placement' }],
  [/placed in the 11th house/i, { key: 'placement-11', label: 'Period lord in the 11th (gains)', family: 'placement' }],
  [/(placed in the (8th|12th) house|in the 6th house \(dusthana)/i, { key: 'placement-dusthana', label: 'Period lord in a dusthana (6, 8, 12)', family: 'placement' }],
  [/malefic in the 6th|placed in the 3rd house \(upachaya, good/i, { key: 'placement-upachaya-malefic', label: 'Malefic period lord in an upachaya (3, 6)', family: 'placement' }],
  [/yogakaraka/i, { key: 'yogakaraka', label: 'Period lord is the yogakaraka', family: 'lordship' }],
  [/functionally benefic/i, { key: 'functional-benefic', label: 'Functional benefic for the lagna', family: 'lordship' }],
  [/functionally malefic/i, { key: 'functional-malefic', label: 'Functional malefic for the lagna', family: 'lordship' }],
  [/acts for its dispositor/i, { key: 'node-dispositor', label: 'Rahu or Ketu acting for its dispositor', family: 'lordship' }],
  [/raja yoga in this period/i, { key: 'pair-raja-yoga', label: 'Kendra and trikona lords linked in the period (raja yoga)', family: 'period pair' }],
  [/6\/8\/12 from the main lord/i, { key: 'pair-6-8-12', label: 'Sub-lord 6/8/12 from the main lord', family: 'period pair' }],
  [/\(trine\) from/i, { key: 'pair-trine', label: 'Sub-lord in trine to the main lord', family: 'period pair' }],
  [/\(kendra\) from/i, { key: 'pair-kendra', label: 'Sub-lord in kendra to the main lord', family: 'period pair' }],
  [/is conjunct \w+: they work together/i, { key: 'pair-conjunct', label: 'Sub-lord conjunct the main lord', family: 'period pair' }],
  [/is 11th from/i, { key: 'pair-11', label: 'Sub-lord 11th from the main lord', family: 'period pair' }],
  [/combust/i, { key: 'combust', label: 'Period lord combust', family: 'condition' }],
  [/retrograde: strong/i, { key: 'retrograde', label: 'Period lord retrograde', family: 'condition' }],
  [/avastha/i, { key: 'avastha-weak', label: 'Period lord in a weak baladi avastha', family: 'condition' }],
  [/from the Moon \(taxing/i, { key: 'moon-6-8-12', label: 'Period lord 6/8/12 from the Moon', family: 'condition' }],
  [/from the Moon \(supports/i, { key: 'moon-kendra-trikona', label: 'Period lord in kendra or trikona from the Moon', family: 'condition' }],
];

export function classifyReason(text: string): PredictionRule | null {
  for (const [re, rule] of PATTERNS) if (re.test(text)) return { ...rule };
  return null;
}

/**
 * The rules behind a window: its maha and antar lords, the dasha reasons
 * pushing in the window's direction at its peak, and the transit drivers.
 */
export function windowRules(w: Window, dashas: DashaPeriod[]): PredictionRule[] {
  const sign = w.tone === 'favourable' ? 1 : -1;
  const out = new Map<string, PredictionRule>();
  const add = (r: PredictionRule | null) => { if (r && !out.has(r.key)) out.set(r.key, r); };
  const [maha, antar] = w.dashaPath;
  if (maha) add({ key: `maha-${maha}`, label: `${maha} mahadasha`, family: 'dasha lord' });
  if (antar) add({ key: `antar-${antar}`, label: `${antar} antardasha`, family: 'dasha lord' });
  const mid = new Date((w.start.getTime() + w.end.getTime()) / 2);
  const chain = activeDashas(dashas, mid);
  const leaf = chain[chain.length - 1];
  if (leaf) {
    const pushing = leaf.reasons
      .filter((r) => sign * r.weight >= 2)
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 6);
    for (const r of pushing) add(classifyReason(r.text));
  }
  for (const d of w.drivers) {
    const m = /^(\w+) transit \(([+-]?\d+)\)/.exec(d);
    if (!m) continue;
    const up = Number(m[2]) > 0;
    add({ key: `transit-${m[1]}-${up ? 'up' : 'down'}`, label: `${m[1]} transit ${up ? 'supportive' : 'testing'}`, family: 'transit' });
  }
  return [...out.values()];
}

/** A mark for a window, ready to store. */
export function markWindow(w: Window, dashas: DashaPeriod[], outcome: Outcome, note?: string, now = new Date()): PredictionMark {
  return {
    id: windowId(w),
    outcome,
    tone: w.tone,
    start: w.start.toISOString().slice(0, 10),
    end: w.end.toISOString().slice(0, 10),
    dashaPath: w.dashaPath,
    rules: windowRules(w, dashas),
    note: note?.trim() || undefined,
    markedAt: now.toISOString(),
  };
}

export interface RuleRecord {
  rule: PredictionRule;
  hits: number;
  misses: number;
  n: number;
  /** hits / n */
  rate: number;
  /** Wilson 90% interval on the rate, so small samples read as uncertain */
  low: number;
  high: number;
  /** Separate counts for the two tones */
  favourable: { hits: number; n: number };
  challenging: { hits: number; n: number };
}

export interface PredictionRecord {
  total: number;
  hits: number;
  rate: number;
  favourable: { hits: number; n: number };
  challenging: { hits: number; n: number };
  rules: RuleRecord[];
}

/** Wilson score interval. */
export function wilson(hits: number, n: number, z = 1.645): { low: number; high: number } {
  if (!n) return { low: 0, high: 1 };
  const p = hits / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { low: Math.max(0, (c - r) / d), high: Math.min(1, (c + r) / d) };
}

/** Hit rates overall, per tone and per rule, most-tested rules first. */
export function predictionRecord(marks: PredictionMark[]): PredictionRecord {
  const tone = (t: Window['tone']) => {
    const m = marks.filter((x) => x.tone === t);
    return { hits: m.filter((x) => x.outcome === 'happened').length, n: m.length };
  };
  const byRule = new Map<string, RuleRecord>();
  for (const m of marks) {
    for (const r of m.rules) {
      let rec = byRule.get(r.key);
      if (!rec) {
        rec = { rule: r, hits: 0, misses: 0, n: 0, rate: 0, low: 0, high: 1, favourable: { hits: 0, n: 0 }, challenging: { hits: 0, n: 0 } };
        byRule.set(r.key, rec);
      }
      const hit = m.outcome === 'happened';
      rec.n++;
      if (hit) rec.hits++; else rec.misses++;
      rec[m.tone].n++;
      if (hit) rec[m.tone].hits++;
    }
  }
  const rules = [...byRule.values()].map((r) => ({ ...r, rate: r.hits / r.n, ...wilson(r.hits, r.n) }));
  rules.sort((a, b) => b.n - a.n || b.rate - a.rate || a.rule.label.localeCompare(b.rule.label));
  const hits = marks.filter((m) => m.outcome === 'happened').length;
  return { total: marks.length, hits, rate: marks.length ? hits / marks.length : 0, favourable: tone('favourable'), challenging: tone('challenging'), rules };
}

/** Clean stored marks: drops anything malformed. */
export function sanitizeMarks(raw: unknown): PredictionMark[] {
  if (!Array.isArray(raw)) return [];
  const out: PredictionMark[] = [];
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  for (const x of raw.slice(0, 2000)) {
    if (!x || typeof x !== 'object') continue;
    const m = x as Record<string, unknown>;
    if (typeof m.id !== 'string' || (m.outcome !== 'happened' && m.outcome !== 'didnt')) continue;
    if (m.tone !== 'favourable' && m.tone !== 'challenging') continue;
    if (typeof m.start !== 'string' || !iso.test(m.start) || typeof m.end !== 'string' || !iso.test(m.end)) continue;
    const dashaPath = Array.isArray(m.dashaPath) ? m.dashaPath.filter((p): p is Planet => PLANETS.includes(p as Planet)) : [];
    const rules = Array.isArray(m.rules)
      ? m.rules.filter((r): r is PredictionRule => !!r && typeof r === 'object' && typeof (r as PredictionRule).key === 'string' && typeof (r as PredictionRule).label === 'string')
        .map((r) => ({ key: r.key.slice(0, 80), label: r.label.slice(0, 160), family: r.family }))
      : [];
    out.push({
      id: m.id.slice(0, 120), outcome: m.outcome, tone: m.tone, start: m.start, end: m.end, dashaPath, rules,
      note: typeof m.note === 'string' ? m.note.slice(0, 1000) : undefined,
      markedAt: typeof m.markedAt === 'string' ? m.markedAt : new Date(0).toISOString(),
    });
  }
  return out;
}

export interface PastWindowsOptions {
  from: Date;
  to: Date;
  /** Default 7 */
  stepDays?: number;
  /** Default 0.6, as on the timeline */
  dashaShare?: number;
}

/**
 * Favourable and challenging windows over a past span, on a fixed weekly grid
 * so the same window keeps the same id whatever range the timeline shows.
 */
export function pastWindows(eph: Ephemeris, chart: NatalChart, dashas: DashaPeriod[], opts: PastWindowsOptions): Window[] {
  const step = opts.stepDays ?? 7;
  const share = opts.dashaShare ?? 0.6;
  // anchor the grid to the birth instant so every call samples the same days
  const birth = chart.birth.getTime();
  const k = Math.max(0, Math.ceil((opts.from.getTime() - birth) / (step * DAY_MS)));
  const from = new Date(birth + k * step * DAY_MS);
  if (from >= opts.to) return [];
  // a fixed anchor (age 30) keeps the baseline, and so the windows, the same from one day to the next
  const baseline = transitBaseline(eph, chart, new Date(birth + 30 * 365.25 * DAY_MS));
  const series: CombinedPoint[] = transitSeries(eph, chart, from, opts.to, step).map((pt) => {
    const relTransit = Math.max(-100, Math.min(100, pt.transit - baseline));
    const chain = activeDashas(dashas, pt.date);
    const leaf = chain[chain.length - 1];
    const dasha = leaf?.score ?? 0;
    const combined = Math.round(share * dasha + (1 - share) * relTransit);
    return { ...pt, relTransit: Math.round(relTransit), dasha, combined, tone: toneOf(combined), dashaPath: leaf?.path ?? [] };
  });
  return findWindows(series, step);
}
