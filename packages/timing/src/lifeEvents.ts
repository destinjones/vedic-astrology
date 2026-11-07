/**
 * Life event checker: for a past event (marriage, new job, a loss...), which
 * dashas, transits, Sade Sati phases and retrogrades were running, and which of
 * them the tradition would connect with that kind of event.
 *
 * The event model (`LifeEvent`, `LIFE_EVENT_KINDS`, `EVENT_SIGNIFICATIONS`) is
 * shared: birth time rectification scores the same events against candidate
 * charts, and saved client profiles store them.
 */
import { type Ephemeris, type NatalChart, type Planet, PLANETS } from './types';
import { DAY_MS, SIGN_LORD, addDays, houseFrom, housesRuled, ordinal, signName, signOf } from './astro';
import { DASHA_ORDER, HOUSE_TOPICS, moonNakshatra } from './dasha';
import { computeAshtakavarga, type Ashtakavarga } from './ashtakavarga';
import { SATURN_PHASE_TEXT, saturnPhases, type SaturnPhase, transitSnapshot, type PlanetTransit } from './transits';
import { findRetrogrades, RETRO_MEANING, RETRO_PLANETS, retroStatusAt } from './retrograde';

// ---------------------------------------------------------------- event model

export type LifeEventKind =
  | 'marriage' | 'relationship' | 'separation' | 'childbirth' | 'sibling-birth'
  | 'job' | 'promotion' | 'job-loss' | 'business'
  | 'education' | 'relocation' | 'foreign-travel' | 'property'
  | 'wealth' | 'financial-loss' | 'illness' | 'accident'
  | 'loss-of-father' | 'loss-of-mother' | 'bereavement'
  | 'spiritual' | 'legal' | 'other';

/** How exactly the date is known. A month or year is checked across the whole span. */
export type DatePrecision = 'day' | 'month' | 'year';

export interface LifeEvent {
  id: string;
  kind: LifeEventKind;
  /** Local calendar date, YYYY-MM-DD (for month or year precision, the first day of it). */
  date: string;
  precision?: DatePrecision;
  /** Optional short label, e.g. "Married Priya". */
  title?: string;
  note?: string;
}

export interface EventSignification {
  label: string;
  group: 'Relationships' | 'Career and money' | 'Home and movement' | 'Health and loss' | 'Other';
  /** Houses from the lagna the event belongs to; the first is the primary house. */
  houses: number[];
  /** Natural significators (karakas). */
  karakas: Planet[];
  /** One line of the classical reasoning, shown to the user. */
  rule: string;
}

export const EVENT_SIGNIFICATIONS: Record<LifeEventKind, EventSignification> = {
  marriage: { label: 'Marriage', group: 'Relationships', houses: [7, 2, 11], karakas: ['Venus', 'Jupiter'], rule: '7th house of partnership, 2nd of family, 11th of fulfilment; Venus (and Jupiter) as karakas' },
  relationship: { label: 'Relationship began', group: 'Relationships', houses: [7, 5, 11], karakas: ['Venus'], rule: '5th of romance, 7th of partnership, 11th of desires fulfilled; Venus as karaka' },
  separation: { label: 'Separation or divorce', group: 'Relationships', houses: [7, 6, 8, 12], karakas: ['Venus'], rule: 'the 7th afflicted, with the 6th (disputes), 8th (breaks) and 12th (loss)' },
  childbirth: { label: 'Birth of a child', group: 'Relationships', houses: [5, 9, 2], karakas: ['Jupiter'], rule: '5th of children (9th is the 5th from the 5th), 2nd of family growth; Jupiter as putra karaka' },
  'sibling-birth': { label: 'Birth of a sibling', group: 'Relationships', houses: [3, 11], karakas: ['Mars'], rule: '3rd of younger and 11th of elder siblings; Mars as bhratru karaka' },
  job: { label: 'New job', group: 'Career and money', houses: [10, 6, 2, 11], karakas: ['Sun', 'Saturn', 'Mercury'], rule: '10th of career, 6th of service, 2nd and 11th of income' },
  promotion: { label: 'Promotion or recognition', group: 'Career and money', houses: [10, 11, 9, 1], karakas: ['Sun', 'Jupiter'], rule: '10th of status, 11th of gains, 9th of fortune' },
  'job-loss': { label: 'Lost a job', group: 'Career and money', houses: [12, 8, 9, 6], karakas: ['Saturn'], rule: '12th of loss, 8th of disruption, 9th (12th from the 10th) ends the post' },
  business: { label: 'Started a business', group: 'Career and money', houses: [7, 10, 11, 3], karakas: ['Mercury'], rule: '7th of trade and clients, 10th of enterprise, 3rd of initiative, 11th of profit' },
  wealth: { label: 'Financial gain', group: 'Career and money', houses: [2, 11, 5, 9], karakas: ['Jupiter', 'Venus'], rule: '2nd and 11th are the dhana houses, 5th and 9th bring fortune' },
  'financial-loss': { label: 'Financial loss or debt', group: 'Career and money', houses: [12, 8, 6], karakas: ['Saturn'], rule: '12th of expense, 8th of sudden loss, 6th of debt' },
  education: { label: 'Education or degree', group: 'Other', houses: [4, 5, 9, 2], karakas: ['Mercury', 'Jupiter'], rule: '4th of schooling, 5th of intellect, 9th of higher learning' },
  relocation: { label: 'Moved home', group: 'Home and movement', houses: [4, 3, 12], karakas: ['Moon'], rule: '4th of home; the 3rd (12th from the 4th) and the 12th move you from it' },
  'foreign-travel': { label: 'Moved or travelled abroad', group: 'Home and movement', houses: [12, 9, 3], karakas: ['Rahu', 'Moon'], rule: '12th of foreign lands, 9th of long journeys; Rahu as the foreigner' },
  property: { label: 'Bought property or a vehicle', group: 'Home and movement', houses: [4, 11, 2], karakas: ['Mars', 'Venus'], rule: '4th of land, houses and vehicles; Mars rules land, Venus vehicles' },
  illness: { label: 'Illness', group: 'Health and loss', houses: [6, 8, 1, 12], karakas: ['Saturn', 'Sun'], rule: '6th of disease, 8th of chronic trouble, the lagna for the body' },
  accident: { label: 'Accident or surgery', group: 'Health and loss', houses: [8, 6, 1], karakas: ['Mars', 'Saturn', 'Rahu'], rule: '8th of sudden events and surgery, Mars for cuts and blood' },
  'loss-of-father': { label: 'Loss of father', group: 'Health and loss', houses: [9, 10, 3, 8], karakas: ['Sun'], rule: '9th is the father; the 10th and 3rd are its maraka (2nd and 7th from it); Sun as karaka' },
  'loss-of-mother': { label: 'Loss of mother', group: 'Health and loss', houses: [4, 5, 10, 8], karakas: ['Moon'], rule: '4th is the mother; the 5th and 10th are its maraka (2nd and 7th from it); Moon as karaka' },
  bereavement: { label: 'Other bereavement', group: 'Health and loss', houses: [8, 2, 7, 12], karakas: ['Saturn'], rule: '8th of endings, 2nd and 7th are maraka houses, 12th of loss' },
  spiritual: { label: 'Spiritual turning point', group: 'Other', houses: [9, 12, 5, 8], karakas: ['Jupiter', 'Ketu'], rule: '9th of dharma, 12th of moksha, 8th of transformation; Jupiter and Ketu' },
  legal: { label: 'Legal case or dispute', group: 'Other', houses: [6, 7, 12], karakas: ['Saturn', 'Mars'], rule: '6th of litigation and enemies, 7th of open opponents, 12th of confinement' },
  other: { label: 'Other event', group: 'Other', houses: [], karakas: [], rule: 'no fixed signification: the periods and transits are listed without a relevance check' },
};

export const LIFE_EVENT_KINDS = Object.keys(EVENT_SIGNIFICATIONS) as LifeEventKind[];

/** The span of time a recorded event covers, in UTC, given its precision. */
export function eventWindow(ev: Pick<LifeEvent, 'date' | 'precision'>): { start: Date; end: Date; mid: Date } {
  const [y, m, d] = ev.date.split('-').map(Number);
  const precision = ev.precision ?? 'day';
  const start = precision === 'year' ? new Date(Date.UTC(y, 0, 1)) : precision === 'month' ? new Date(Date.UTC(y, m - 1, 1)) : new Date(Date.UTC(y, m - 1, d));
  const end = precision === 'year' ? new Date(Date.UTC(y + 1, 0, 1)) : precision === 'month' ? new Date(Date.UTC(y, m, 1)) : new Date(Date.UTC(y, m - 1, d + 1));
  return { start, end, mid: new Date((start.getTime() + end.getTime()) / 2) };
}

// ---------------------------------------------------------------- relevance

export type Relevance = 'strong' | 'supporting' | 'none';

export interface RelevanceCheck {
  relevance: Relevance;
  /** 0.. ; strong >= 3, supporting >= 1.5 */
  points: number;
  /** Why it is (or is not) connected to the event, most important first. */
  links: string[];
}

/** Graha drishti: houses counted from the planet's own (1 = same sign). */
export const ASPECTS: Record<Planet, number[]> = {
  Sun: [7], Moon: [7], Mercury: [7], Venus: [7],
  Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10], Rahu: [5, 7, 9], Ketu: [5, 7, 9],
};

/** Sign numbers (0 = Aries) a planet in `sign` aspects. */
export const aspectedSigns = (p: Planet, sign: number) => ASPECTS[p].map((n) => (sign + n - 1) % 12);

const nakLordOf = (lon: number) => moonNakshatra(lon).lord;
const strongest = (r: Relevance, s: Relevance): Relevance => (r === 'strong' || s === 'strong' ? 'strong' : r === 'supporting' || s === 'supporting' ? 'supporting' : 'none');
const relevanceOf = (points: number): Relevance => (points >= 3 ? 'strong' : points >= 1.5 ? 'supporting' : 'none');

/**
 * How a natal planet, as a dasha lord, connects to an event's houses:
 * ownership, occupation, aspect, karakatva, its nakshatra lord, and for the
 * nodes their dispositor.
 */
export function lordRelevance(chart: NatalChart, lord: Planet, kind: LifeEventKind, depth = 0): RelevanceCheck {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return { relevance: 'none', points: 0, links: [] };
  const asc = signOf(chart.ascendant);
  const primary = sig.houses[0];
  const sign = signOf(chart.planets[lord].longitude);
  const occupies = houseFrom(asc, sign);
  const rules = housesRuled(lord, asc);
  const links: { w: number; text: string }[] = [];
  const add = (w: number, text: string) => links.push({ w, text });

  for (const h of sig.houses) {
    const main = h === primary;
    if (rules.includes(h)) add(main ? 2.5 : 1.5, `rules your ${ordinal(h)} house (${HOUSE_TOPICS[h].split(',')[0]})`);
  }
  if (sig.houses.includes(occupies)) add(occupies === primary ? 2 : 1.25, `sits in your ${ordinal(occupies)} house`);
  const aspected = aspectedSigns(lord, sign).map((s) => houseFrom(asc, s));
  if (aspected.includes(primary)) add(1, `aspects your ${ordinal(primary)} house`);
  // with the lord of the primary house
  const primaryLord = SIGN_LORD[(asc + primary - 1) % 12];
  if (primaryLord !== lord && signOf(chart.planets[primaryLord].longitude) === sign) add(1, `is conjunct your ${ordinal(primary)} lord ${primaryLord}`);
  if (sig.karakas.includes(lord)) add(1.25, `is the natural karaka`);

  if (depth === 0) {
    // A planet gives the results of its nakshatra lord; the nodes also act for their sign lord.
    const star = nakLordOf(chart.planets[lord].longitude);
    if (star !== lord) {
      const s = lordRelevance(chart, star, kind, 1);
      if (s.points >= 1.5) add(Math.min(1.5, s.points * 0.4), `is in the nakshatra of ${star}, which ${s.links[0]}`);
    }
    if (lord === 'Rahu' || lord === 'Ketu') {
      const disp = SIGN_LORD[sign];
      const s = lordRelevance(chart, disp, kind, 1);
      if (s.points >= 1.5) add(Math.min(2, s.points * 0.6), `acts for its sign lord ${disp}, which ${s.links[0]}`);
    }
  }
  links.sort((a, b) => b.w - a.w);
  const points = Math.round(links.reduce((a, l) => a + l.w, 0) * 100) / 100;
  return { relevance: relevanceOf(points), points, links: links.map((l) => l.text) };
}

/** For sign-based dashas (Kalachakra, Chara): how the period's sign connects. */
export function signRelevance(chart: NatalChart, sign: number, kind: LifeEventKind): RelevanceCheck {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return { relevance: 'none', points: 0, links: [] };
  const h = houseFrom(signOf(chart.ascendant), sign);
  const links: string[] = [];
  let points = 0;
  if (sig.houses.includes(h)) { points += h === sig.houses[0] ? 2.5 : 1.5; links.push(`${signName(sign)} is your ${ordinal(h)} house`); }
  for (const p of PLANETS) {
    if (sig.karakas.includes(p) && signOf(chart.planets[p].longitude) === sign) { points += 1; links.push(`holds the karaka ${p}`); }
  }
  return { relevance: relevanceOf(points), points, links };
}

// ---------------------------------------------------------------- dasha systems

/** Any dasha tree: planet-lord systems (Vimshottari, Yogini, Ashtottari) or sign systems (Kalachakra, Chara). */
export interface DashaNode {
  lord: Planet;
  /** Sign (0 = Aries) for sign-based systems. */
  sign?: number;
  /** Display name when not simply the lord, e.g. a yogini or a sign. */
  name?: string;
  start: Date;
  end: Date;
  children?: DashaNode[];
}

export interface DashaSystemInput {
  /** 'vimshottari', 'yogini', 'ashtottari', 'kalachakra', 'chara'... */
  system: string;
  label: string;
  periods: DashaNode[];
  /** e.g. Ashtottari is classically used only when Rahu is placed a certain way. */
  note?: string;
}

const LEVEL_NAMES = ['Mahadasha', 'Antardasha', 'Pratyantardasha', 'Sookshma', 'Prana'];

export interface ActivePeriod {
  level: number;
  levelName: string;
  lord: Planet;
  name: string;
  sign?: number;
  start: Date;
  end: Date;
  check: RelevanceCheck;
}

export interface SystemAtEvent {
  system: string;
  label: string;
  note?: string;
  /** Maha down to the deepest level available, at the middle of the event window. */
  chain: ActivePeriod[];
  /** For month/year precision: every antardasha that overlaps the window. */
  overlapping: ActivePeriod[];
  relevance: Relevance;
  summary: string;
}

function chainAt(nodes: DashaNode[] | undefined, at: Date): DashaNode[] {
  const out: DashaNode[] = [];
  let list = nodes;
  while (list) {
    const hit = list.find((p) => p.start <= at && at < p.end);
    if (!hit) break;
    out.push(hit);
    list = hit.children;
  }
  return out;
}

function describe(chart: NatalChart, n: DashaNode, level: number, kind: LifeEventKind): ActivePeriod {
  let check = lordRelevance(chart, n.lord, kind);
  if (n.sign !== undefined) {
    const s = signRelevance(chart, n.sign, kind);
    check = { relevance: strongest(check.relevance, s.relevance), points: Math.max(check.points, s.points), links: [...s.links, ...check.links.map((l) => `its lord ${n.lord} ${l}`)] };
  }
  return { level, levelName: LEVEL_NAMES[level - 1] ?? `Level ${level}`, lord: n.lord, name: n.name ?? n.lord, sign: n.sign, start: n.start, end: n.end, check };
}

export function systemAtEvent(chart: NatalChart, sys: DashaSystemInput, kind: LifeEventKind, window: { start: Date; end: Date; mid: Date }): SystemAtEvent {
  const chain = chainAt(sys.periods, window.mid).map((n, i) => describe(chart, n, i + 1, kind));
  const overlapping: ActivePeriod[] = [];
  if (window.end.getTime() - window.start.getTime() > 2 * DAY_MS) {
    for (const maha of sys.periods) {
      if (maha.end <= window.start || maha.start >= window.end) continue;
      for (const antar of maha.children ?? []) {
        if (antar.end <= window.start || antar.start >= window.end) continue;
        overlapping.push(describe(chart, antar, 2, kind));
      }
    }
  }
  // Maha and antar carry the event; a matching third level sharpens the timing.
  const [maha, antar, prat] = chain;
  const strongCount = [maha, antar].filter((p) => p?.check.relevance === 'strong').length;
  const anyCount = [maha, antar, prat].filter((p) => p && p.check.relevance !== 'none').length;
  const relevance: Relevance = strongCount >= 1 && anyCount >= 2 ? 'strong' : anyCount >= 1 ? 'supporting' : 'none';
  const names = chain.slice(0, 3).map((p) => p.name).join('–');
  const linked = chain.slice(0, 3).filter((p) => p.check.relevance !== 'none').map((p) => p.name);
  const summary = !chain.length ? 'No period found at this date'
    : linked.length ? `${names}: ${linked.join(' and ')} ${linked.length > 1 ? 'are' : 'is'} linked to the event`
      : `${names}: no classical link to this kind of event`;
  return { system: sys.system, label: sys.label, note: sys.note, chain, overlapping, relevance, summary };
}

// ---------------------------------------------------------------- transits

export interface TransitAtEvent {
  planet: Planet;
  sign: number;
  houseFromLagna: number;
  houseFromMoon: number;
  retrograde: boolean;
  bindus: number | null;
  /** Classical label, e.g. "Ashtama Shani". */
  label?: string;
  favourableFromMoon: boolean;
  check: RelevanceCheck;
}

export interface DoubleTransit {
  active: boolean;
  /** House the rule was checked for (the event's primary house). */
  house: number;
  jupiter: string[];
  saturn: string[];
}

const SLOW_TRANSITS: Planet[] = ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Mars'];

/** How a transiting planet touches the event's houses: occupying, aspecting, or crossing the primary lord or karaka. */
export function transitRelevance(chart: NatalChart, p: Planet, transitSign: number, kind: LifeEventKind): RelevanceCheck {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return { relevance: 'none', points: 0, links: [] };
  const asc = signOf(chart.ascendant);
  const primary = sig.houses[0];
  const primarySign = (asc + primary - 1) % 12;
  const primaryLord = SIGN_LORD[primarySign];
  const lordSign = signOf(chart.planets[primaryLord].longitude);
  const links: string[] = [];
  let points = 0;
  const h = houseFrom(asc, transitSign);
  if (h === primary) { points += 2; links.push(`transits your ${ordinal(h)} house`); }
  else if (sig.houses.includes(h)) { points += 1; links.push(`transits your ${ordinal(h)} house`); }
  const asp = aspectedSigns(p, transitSign);
  if (h !== primary && asp.includes(primarySign)) { points += 1.5; links.push(`aspects your ${ordinal(primary)} house`); }
  if (transitSign === lordSign) { points += 1.5; links.push(`passes over your ${ordinal(primary)} lord ${primaryLord}`); }
  else if (asp.includes(lordSign)) { points += 1; links.push(`aspects your ${ordinal(primary)} lord ${primaryLord}`); }
  for (const k of sig.karakas) {
    if (k !== p && signOf(chart.planets[k].longitude) === transitSign) { points += 0.75; links.push(`passes over natal ${k}, the karaka`); }
  }
  return { relevance: relevanceOf(points), points, links };
}

/** K. N. Rao's double transit: Jupiter and Saturn both influence the event house or its lord (by sign or aspect). */
export function doubleTransit(chart: NatalChart, jupiterSign: number, saturnSign: number, house: number): DoubleTransit {
  const asc = signOf(chart.ascendant);
  const hSign = (asc + house - 1) % 12;
  const lord = SIGN_LORD[hSign];
  const lordSign = signOf(chart.planets[lord].longitude);
  const touch = (p: Planet, s: number) => {
    const out: string[] = [];
    if (s === hSign) out.push(`in your ${ordinal(house)} house`);
    else if (aspectedSigns(p, s).includes(hSign)) out.push(`aspects your ${ordinal(house)} house`);
    if (s === lordSign) out.push(`over your ${ordinal(house)} lord ${lord}`);
    else if (aspectedSigns(p, s).includes(lordSign)) out.push(`aspects your ${ordinal(house)} lord ${lord}`);
    return out;
  };
  const jupiter = touch('Jupiter', jupiterSign);
  const saturn = touch('Saturn', saturnSign);
  return { active: jupiter.length > 0 && saturn.length > 0, house, jupiter, saturn };
}

// ---------------------------------------------------------------- the check

export interface SaturnAtEvent {
  phase: SaturnPhase | null;
  text: string | null;
}

export interface RetrogradeAtEvent {
  planet: Planet;
  status: 'pre-shadow' | 'retrograde' | 'post-shadow';
  meaning: string;
  /** Planet is a karaka of the event or rules its primary house. */
  relevant: boolean;
}

export interface EventCheck {
  event: LifeEvent;
  signification: EventSignification;
  window: { start: Date; end: Date; mid: Date };
  /** Age at the event, in years. */
  age: number;
  dashas: SystemAtEvent[];
  transits: TransitAtEvent[];
  doubleTransit: DoubleTransit | null;
  saturn: SaturnAtEvent;
  retrogrades: RetrogradeAtEvent[];
  /** The most telling links, in plain sentences. */
  highlights: string[];
  /** 0–100: how many classical indications line up (raw, not calibrated). */
  fit: number;
  /**
   * Share (0–100) of the dates in this person's life that line up less well for
   * this kind of event. Needs `baseline`; this is what the label is based on.
   */
  percentile: number | null;
  fitLabel: 'strong' | 'moderate' | 'weak' | 'n/a';
}

export interface CheckOptions {
  /** Dasha systems to check; Vimshottari is computed if none are given. */
  systems?: DashaSystemInput[];
  /** Reuse across many events (saturnPhases over a lifetime is the slow part). */
  saturn?: { phases: SaturnPhase[] };
  ashtakavarga?: Ashtakavarga;
  /** Calibrates the fit against the rest of this person's life (see `eventBaseline`). */
  baseline?: EventBaseline;
}

/** Lifetime Saturn phases for a chart, to pass to several `checkLifeEvent` calls. */
export function lifetimeSaturn(eph: Ephemeris, chart: NatalChart) {
  return saturnPhases(eph, chart, addDays(chart.birth, 1), addDays(chart.birth, 365.25 * 100));
}

export function checkLifeEvent(eph: Ephemeris, chart: NatalChart, event: LifeEvent, opts: CheckOptions = {}): EventCheck {
  const sig = EVENT_SIGNIFICATIONS[event.kind] ?? EVENT_SIGNIFICATIONS.other;
  const window = eventWindow(event);
  const at = window.mid;
  const av = opts.ashtakavarga ?? computeAshtakavarga(chart);
  const systems = opts.systems ?? [];
  const dashas = systems.map((s) => systemAtEvent(chart, s, event.kind, window));

  const snap = transitSnapshot(chart, eph.positions(at), at, av);
  const byPlanet = new Map<Planet, PlanetTransit>(snap.planets.map((p) => [p.planet, p]));
  const transits: TransitAtEvent[] = snap.planets.filter((p) => p.planet !== 'Moon').map((t) => ({
    planet: t.planet, sign: t.sign, houseFromLagna: t.houseFromLagna, houseFromMoon: t.houseFromMoon,
    retrograde: t.retrograde, bindus: t.bindus, label: t.label, favourableFromMoon: t.favourable && !t.obstructedBy,
    check: transitRelevance(chart, t.planet, t.sign, event.kind),
  }));
  const dt = sig.houses.length ? doubleTransit(chart, byPlanet.get('Jupiter')!.sign, byPlanet.get('Saturn')!.sign, sig.houses[0]) : null;

  const phases = opts.saturn?.phases ?? lifetimeSaturn(eph, chart).phases;
  const phase = phases.find((p) => p.start <= at && at < p.end) ?? null;
  const saturn: SaturnAtEvent = { phase, text: phase ? SATURN_PHASE_TEXT[phase.kind] : null };

  const retroPeriods = findRetrogrades(eph, chart, addDays(at, -1), addDays(at, 1));
  const asc = signOf(chart.ascendant);
  const primaryLord = sig.houses.length ? SIGN_LORD[(asc + sig.houses[0] - 1) % 12] : null;
  const retrogrades: RetrogradeAtEvent[] = [];
  for (const p of RETRO_PLANETS) {
    const status = retroStatusAt(retroPeriods, p, at);
    if (status) retrogrades.push({ planet: p, status, meaning: RETRO_MEANING[p], relevant: sig.karakas.includes(p) || p === primaryLord });
  }

  // ---- highlights
  const highlights: string[] = [];
  if (dt?.active) highlights.push(`Double transit: Jupiter ${dt.jupiter[0]} and Saturn ${dt.saturn[0]}`);
  for (const d of dashas) {
    for (const p of d.chain.slice(0, 2)) {
      if (p.check.relevance !== 'none') highlights.push(`${d.label} ${p.levelName.toLowerCase()} of ${p.name}: ${p.check.links[0]}`);
    }
  }
  for (const t of transits) {
    if (SLOW_TRANSITS.includes(t.planet) && t.check.relevance === 'strong') highlights.push(`${t.planet} ${t.check.links[0]}`);
  }
  if (phase) highlights.push(`${phase.kind.startsWith('sade-sati') ? 'Sade Sati' : phase.kind === 'kantaka' ? 'Kantaka Shani' : 'Ashtama Shani'} was running (${signName(phase.sign)})`);
  for (const r of retrogrades) if (r.relevant) highlights.push(`${r.planet} was ${r.status === 'retrograde' ? 'retrograde' : `in its ${r.status}`}`);

  const raw = rawFit(event.kind, dashas, transits, dt, phase);
  const percentile = sig.houses.length && opts.baseline ? opts.baseline.percentile(event.kind, raw) : null;
  const fitLabel: EventCheck['fitLabel'] = !sig.houses.length ? 'n/a'
    : percentile !== null ? (percentile >= 75 ? 'strong' : percentile >= 45 ? 'moderate' : 'weak')
      : raw >= 60 ? 'strong' : raw >= 35 ? 'moderate' : 'weak';
  const age = Math.round(((at.getTime() - chart.birth.getTime()) / (365.2425 * DAY_MS)) * 10) / 10;
  return { event, signification: sig, window, age, dashas, transits, doubleTransit: dt, saturn, retrogrades, highlights, fit: sig.houses.length ? raw : 0, percentile, fitLabel };
}

/** Raw 0–100 fit: dasha links (all systems, Vimshottari weighted most), double transit, slow transits, Saturn phase. */
function rawFit(kind: LifeEventKind, dashas: SystemAtEvent[], transits: Pick<TransitAtEvent, 'planet' | 'check'>[], dt: DoubleTransit | null, phase: SaturnPhase | null): number {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return 0;
  const pts = (r: Relevance | undefined, strong: number) => (r === 'strong' ? strong : r === 'supporting' ? strong / 2 : 0);
  let fit = 0, max = 0;
  dashas.forEach((d, i) => {
    const w = i === 0 ? 1 : 0.45;
    const [maha, antar, prat] = d.chain;
    fit += w * (pts(maha?.check.relevance, 18) + pts(antar?.check.relevance, 22) + pts(prat?.check.relevance, 8));
    max += w * 48;
  });
  if (dt?.active) fit += 18;
  for (const t of transits) {
    if (!SLOW_TRANSITS.includes(t.planet)) continue;
    fit += pts(t.check.relevance, t.planet === 'Jupiter' || t.planet === 'Saturn' ? 7 : 3);
  }
  if (phase && sig.group === 'Health and loss') fit += 6;
  max += 18 + 14 + 9 + (sig.group === 'Health and loss' ? 6 : 0);
  return Math.round((100 * fit) / max);
}

export interface EventBaseline {
  /** Percent of sampled dates (0–100) with a lower raw fit for this kind of event. */
  percentile(kind: LifeEventKind, raw: number): number;
}

/**
 * Samples the person's life (every `stepDays`, birth to `to`) so a fit can be
 * read as "better than N% of your life". Without this, broad houses make
 * almost any date look linked to something.
 */
export function eventBaseline(eph: Ephemeris, chart: NatalChart, systems: DashaSystemInput[], saturn: { phases: SaturnPhase[] }, to = addDays(chart.birth, 365.25 * 80), stepDays = 30): EventBaseline {
  const samples: { at: Date; signs: Partial<Record<Planet, number>>; phase: SaturnPhase | null }[] = [];
  for (let t = chart.birth.getTime() + 30 * DAY_MS; t < to.getTime(); t += stepDays * DAY_MS) {
    const at = new Date(t);
    const pos = eph.positions(at);
    const signs: Partial<Record<Planet, number>> = {};
    for (const p of SLOW_TRANSITS) signs[p] = signOf(pos[p].longitude);
    samples.push({ at, signs, phase: saturn.phases.find((ph) => ph.start <= at && at < ph.end) ?? null });
  }
  const cache = new Map<LifeEventKind, number[]>();
  const fits = (kind: LifeEventKind) => {
    if (!cache.has(kind)) {
      const sig = EVENT_SIGNIFICATIONS[kind];
      const arr = samples.map((s) => {
        const win = { start: s.at, end: s.at, mid: s.at };
        const d = systems.map((sys) => systemAtEvent(chart, sys, kind, win));
        const tr = SLOW_TRANSITS.map((p) => ({ planet: p, check: transitRelevance(chart, p, s.signs[p]!, kind) }));
        const dt = sig.houses.length ? doubleTransit(chart, s.signs.Jupiter!, s.signs.Saturn!, sig.houses[0]) : null;
        return rawFit(kind, d, tr, dt, s.phase);
      }).sort((a, b) => a - b);
      cache.set(kind, arr);
    }
    return cache.get(kind)!;
  };
  return {
    percentile(kind, raw) {
      const arr = fits(kind);
      if (!arr.length) return 50;
      let below = 0, equal = 0;
      for (const v of arr) { if (v < raw) below++; else if (v === raw) equal++; }
      return Math.round((100 * (below + equal / 2)) / arr.length);
    },
  };
}

export interface EventPattern {
  planet: Planet;
  /** Number of events where it was maha or antar lord (in any system) with a link. */
  events: number;
  kinds: LifeEventKind[];
}

/** Which planets keep showing up as linked dasha lords across a person's events. */
export function recurringLords(checks: EventCheck[]): EventPattern[] {
  const map = new Map<Planet, Set<number>>();
  const kinds = new Map<Planet, Set<LifeEventKind>>();
  checks.forEach((c, i) => {
    for (const d of c.dashas) {
      for (const p of d.chain.slice(0, 2)) {
        if (p.check.relevance === 'none') continue;
        if (!map.has(p.lord)) { map.set(p.lord, new Set()); kinds.set(p.lord, new Set()); }
        map.get(p.lord)!.add(i);
        kinds.get(p.lord)!.add(c.event.kind);
      }
    }
  });
  return [...map.entries()]
    .map(([planet, s]) => ({ planet, events: s.size, kinds: [...kinds.get(planet)!] }))
    .filter((p) => p.events >= 2)
    .sort((a, b) => b.events - a.events || DASHA_ORDER.indexOf(a.planet) - DASHA_ORDER.indexOf(b.planet));
}
