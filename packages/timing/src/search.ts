/**
 * Transit search: "when does Saturn next hit my Moon?", "next Jupiter return",
 * "when does Mars enter Leo?", "next Mercury retrograde".
 *
 * Everything is computed from the ephemeris (no lookup tables), so dates are
 * exact to the minute and work for any year the ephemeris covers.
 *
 * - `searchTransits(eph, natal, query)` finds the events for a structured query.
 * - `parseTransitQuestion(text)` turns a plain-English (or Sanskrit-named) question
 *   into that query using a fixed set of patterns. No AI involved.
 */
import { type Ephemeris, type NatalChart, type Planet, type PlanetPosition, PLANETS, SIGNS } from './types';
import { DAY_MS, addDays, houseFrom, norm360, ordinal, signName, signOf } from './astro';
import { STEP_DAYS, findIngresses, findStations } from './events';
import { SPECIAL_ASPECTS } from './classical';

// ---------------------------------------------------------------------------
// Query model

/** A natal point a transit can contact. */
export type NatalPoint = Planet | 'Ascendant';
export const NATAL_POINTS: NatalPoint[] = [...PLANETS, 'Ascendant'];

/**
 * Aspect kinds. Vedic aspects are counted in houses from the transiting planet:
 * every graha aspects the 7th, Mars also the 4th and 8th, Jupiter (and the nodes,
 * by the common convention) the 5th and 9th, Saturn the 3rd and 10th.
 * For exact (degree) hits, the nth-house aspect lands (n-1)*30 degrees ahead.
 */
export type AspectKind = 'conjunction' | 'opposition' | 'special' | 'any';


export type TransitQuery =
  /** Exact degree contacts with a natal point (conjunction / Vedic aspects). */
  | { kind: 'aspect'; planet: Planet; target: NatalPoint; aspect: AspectKind }
  /** The planet back on its own natal degree. */
  | { kind: 'return'; planet: Planet }
  /** Sign changes; `sign` limits to one sign (0 = Aries). */
  | { kind: 'ingress'; planet: Planet; sign?: number }
  /** Retrograde / direct stations. */
  | { kind: 'station'; planet: Planet; station?: 'retrograde' | 'direct' };

export interface SearchOptions {
  /** Start of the search (default now). */
  from?: Date;
  /** End of the search (default depends on the planet's speed). */
  to?: Date;
  /** Maximum number of results (default 12). */
  limit?: number;
  /** Orb in degrees for the "in range" window around exact hits (default 1). */
  orb?: number;
}

export interface TransitPass {
  date: Date;
  /** True when the planet was retrograde as it crossed the point. */
  retrograde: boolean;
}

export interface TransitHit {
  /** Stable key for lists. */
  id: string;
  kind: TransitQuery['kind'];
  planet: Planet;
  /** Short label, e.g. "Saturn conjunct natal Moon". */
  title: string;
  /** One-sentence explanation including the natal house involved. */
  detail: string;
  /** The date to jump to: the first exact pass (or the ingress / station). */
  date: Date;
  /** All exact passes. A retrograde loop gives up to three passes over the same degree. */
  passes: TransitPass[];
  /** When the planet first comes within the orb and finally leaves it (aspects and returns). */
  start: Date | null;
  end: Date | null;
  /** Sidereal longitude the transit reaches at `date`. */
  longitude: number;
}

export interface TransitSearchResult {
  query: TransitQuery;
  /** Human sentence for the query, e.g. "Saturn conjunct your natal Moon". */
  label: string;
  from: Date;
  to: Date;
  hits: TransitHit[];
}

// ---------------------------------------------------------------------------
// Defaults

/** Look-ahead (years) long enough to see a few cycles of each planet. */
export const DEFAULT_YEARS: Record<Planet, number> = {
  Moon: 1, Sun: 3, Mercury: 3, Venus: 4, Mars: 6, Jupiter: 25, Saturn: 60, Rahu: 40, Ketu: 40,
};

const pos = (eph: Ephemeris, p: Planet, d: Date): PlanetPosition =>
  eph.position ? eph.position(p, d) : eph.positions(d)[p];

const natalLon = (natal: NatalChart, p: NatalPoint) => (p === 'Ascendant' ? natal.ascendant : natal.planets[p].longitude);
const natalName = (p: NatalPoint) => (p === 'Ascendant' ? 'Ascendant' : `natal ${p}`);

// ---------------------------------------------------------------------------
// Root finding

/** Upper bound on daily motion (degrees/day), used to skip safely through stretches far from the target. */
const MAX_SPEED: Record<Planet, number> = {
  Moon: 16, Sun: 1.03, Mercury: 2.3, Venus: 1.3, Mars: 0.85, Jupiter: 0.26, Saturn: 0.14, Rahu: 0.5, Ketu: 0.5,
};

/** Every time `planet` crosses `target` longitude between from and to, in order. */
export function findCrossings(eph: Ephemeris, planet: Planet, target: number, from: Date, to: Date, max = Infinity): TransitPass[] {
  // Nodes move slowly but the true node wobbles daily, so sample them finely enough not to miss a back-and-forth.
  const step = (planet === 'Rahu' || planet === 'Ketu' ? 2 : STEP_DAYS[planet]) * DAY_MS;
  const delta = (t: number) => ((norm360(pos(eph, planet, new Date(t)).longitude - target) + 540) % 360) - 180;
  const out: TransitPass[] = [];
  const end = to.getTime();
  let t0 = from.getTime();
  let d0 = delta(t0);
  while (t0 < end && out.length < max) {
    // Far from the target the planet cannot get there faster than its top speed, so skip ahead.
    const safe = (Math.abs(d0) / MAX_SPEED[planet]) * 0.8 * DAY_MS;
    const t1 = Math.min(t0 + Math.max(step, safe), end);
    const d1 = delta(t1);
    // A sign change near 0 (not the ±180 wrap) is a crossing.
    if (d0 !== 0 && Math.sign(d1) !== Math.sign(d0) && Math.abs(d1 - d0) < 90) {
      let lo = t0, hi = t1;
      const s = Math.sign(d0);
      while (hi - lo > 30_000) {
        const mid = (lo + hi) / 2;
        if (Math.sign(delta(mid)) === s) lo = mid; else hi = mid;
      }
      const at = new Date((lo + hi) / 2);
      out.push({ date: at, retrograde: pos(eph, planet, at).speed < 0 });
    }
    t0 = t1; d0 = d1;
  }
  return out;
}

/** Passes closer together than this belong to the same transit (one retrograde loop). */
const GROUP_DAYS: Record<Planet, number> = {
  Moon: 5, Sun: 20, Mercury: 60, Venus: 80, Mars: 120, Jupiter: 300, Saturn: 330, Rahu: 120, Ketu: 120,
};

function groupPasses(planet: Planet, passes: TransitPass[]): TransitPass[][] {
  const groups: TransitPass[][] = [];
  for (const p of passes) {
    const g = groups[groups.length - 1];
    if (g && (p.date.getTime() - g[g.length - 1].date.getTime()) / DAY_MS < GROUP_DAYS[planet]) g.push(p);
    else groups.push([p]);
  }
  return groups;
}

/** When the planet comes within `orb` of `target` before `at` (searching back) and when it leaves after. */
function orbWindow(eph: Ephemeris, planet: Planet, target: number, first: Date, last: Date, orb: number, from: Date) {
  const look = GROUP_DAYS[planet] * 2;
  const within = (t: Date) => Math.abs(((norm360(pos(eph, planet, t).longitude - target) + 540) % 360) - 180) <= orb;
  const edge = (a: Date, b: Date) => {
    // find the moment `within` flips between a and b
    let lo = a.getTime(), hi = b.getTime();
    const wa = within(a);
    while (hi - lo > 60_000) {
      const mid = (lo + hi) / 2;
      if (within(new Date(mid)) === wa) lo = mid; else hi = mid;
    }
    return new Date((lo + hi) / 2);
  };
  const step = STEP_DAYS[planet] / 2;
  let start: Date | null = null;
  for (let t = first, i = 0; i * step < look; i++) {
    const prev = addDays(t, -step);
    if (!within(prev)) { start = edge(prev, t); break; }
    t = prev;
  }
  let end: Date | null = null;
  for (let t = last, i = 0; i * step < look; i++) {
    const next = addDays(t, step);
    if (!within(next)) { end = edge(t, next); break; }
    t = next;
  }
  if (start && start < from) start = from;
  return { start, end };
}

// ---------------------------------------------------------------------------
// Search

const aspectOffsets = (planet: Planet, aspect: AspectKind): { house: number; offset: number }[] => {
  const special = (SPECIAL_ASPECTS[planet] ?? []).map((h) => ({ house: h, offset: (h - 1) * 30 }));
  const conj = { house: 1, offset: 0 }, opp = { house: 7, offset: 180 };
  switch (aspect) {
    case 'conjunction': return [conj];
    case 'opposition': return [opp];
    case 'special': return special;
    case 'any': return [conj, opp, ...special];
  }
};

const ASPECT_WORD = (house: number) => (house === 1 ? 'conjunct' : house === 7 ? 'opposite' : `${ordinal(house)}-house aspect on`);

export function describeQuery(q: TransitQuery): string {
  switch (q.kind) {
    case 'aspect': {
      const t = q.target === 'Ascendant' ? 'your Ascendant' : `your natal ${q.target}`;
      if (q.aspect === 'conjunction') return `${q.planet} over ${t}`;
      if (q.aspect === 'opposition') return `${q.planet} opposite ${t}`;
      if (q.aspect === 'special') return `${q.planet}'s special aspects on ${t}`;
      return `${q.planet} conjunct or aspecting ${t}`;
    }
    case 'return': return `${q.planet} return (back to its natal degree)`;
    case 'ingress': return q.sign === undefined ? `${q.planet} changing sign` : `${q.planet} entering ${SIGNS[q.sign]}`;
    case 'station': return q.station === 'direct' ? `${q.planet} turning direct` : q.station === 'retrograde' ? `${q.planet} turning retrograde` : `${q.planet} stations`;
  }
}

/** Which queries a planet supports (stations need real retrograde motion). */
export const canStation = (p: Planet) => p !== 'Sun' && p !== 'Moon' && p !== 'Rahu' && p !== 'Ketu';

export function searchTransits(eph: Ephemeris, natal: NatalChart, query: TransitQuery, opts: SearchOptions = {}): TransitSearchResult {
  const from = opts.from ?? new Date();
  const to = opts.to ?? addDays(from, 365.25 * DEFAULT_YEARS[query.planet]);
  const limit = opts.limit ?? 12;
  const orb = opts.orb ?? 1;
  const asc = signOf(natal.ascendant);
  const houseNote = (lon: number) => `${ordinal(houseFrom(asc, signOf(lon)))} house from your Lagna`;
  const hits: TransitHit[] = [];

  if (query.kind === 'aspect' || query.kind === 'return') {
    const target: NatalPoint = query.kind === 'return' ? query.planet : query.target;
    const tlon = natalLon(natal, target);
    const offsets = query.kind === 'return' ? [{ house: 1, offset: 0 }] : aspectOffsets(query.planet, query.aspect);
    for (const { house, offset } of offsets) {
      // The planet aspects the point `offset` degrees ahead of itself, so it must stand at target - offset.
      const at = norm360(tlon - offset);
      const passes = findCrossings(eph, query.planet, at, from, to, limit * 3);
      for (const g of groupPasses(query.planet, passes)) {
        const w = orbWindow(eph, query.planet, at, g[0].date, g[g.length - 1].date, orb, from);
        const title = query.kind === 'return'
          ? `${query.planet} return`
          : `${query.planet} ${ASPECT_WORD(house)} ${natalName(target)}`;
        const where = `${signName(signOf(at))} ${(norm360(at) % 30).toFixed(1)}°, your ${houseNote(at)}`;
        const loop = g.length > 1 ? ` It crosses the degree ${g.length} times because of retrograde motion.` : '';
        hits.push({
          id: `${query.kind}-${query.planet}-${target}-${house}-${g[0].date.getTime()}`,
          kind: query.kind, planet: query.planet, title,
          detail: `${query.planet} reaches ${where}.${loop}`,
          date: g[0].date, passes: g, start: w.start, end: w.end, longitude: at,
        });
      }
    }
  } else if (query.kind === 'ingress') {
    for (const ing of findIngresses(eph, query.planet, from, to)) {
      if (query.sign !== undefined && ing.toSign !== query.sign) continue;
      hits.push({
        id: `ingress-${query.planet}-${ing.date.getTime()}`,
        kind: 'ingress', planet: query.planet,
        title: `${query.planet} enters ${signName(ing.toSign)}${ing.retrograde ? ' (retrograde)' : ''}`,
        detail: `Leaves ${signName(ing.fromSign)} for ${signName(ing.toSign)}, your ${ordinal(houseFrom(asc, ing.toSign))} house from Lagna and ${ordinal(houseFrom(signOf(natal.planets.Moon.longitude), ing.toSign))} from the Moon.`,
        date: ing.date, passes: [{ date: ing.date, retrograde: ing.retrograde }], start: null, end: null, longitude: ing.toSign * 30,
      });
    }
  } else {
    if (canStation(query.planet)) {
      for (const st of findStations(eph, query.planet, from, to)) {
        if (query.station && st.type !== query.station) continue;
        hits.push({
          id: `station-${query.planet}-${st.date.getTime()}`,
          kind: 'station', planet: query.planet,
          title: `${query.planet} stations ${st.type}`,
          detail: `Stands still at ${signName(signOf(st.longitude))} ${(norm360(st.longitude) % 30).toFixed(1)}°, your ${houseNote(st.longitude)}.`,
          date: st.date, passes: [{ date: st.date, retrograde: st.type === 'retrograde' }], start: null, end: null, longitude: st.longitude,
        });
      }
    }
  }

  hits.sort((a, b) => a.date.getTime() - b.date.getTime());
  return { query, label: describeQuery(query), from, to, hits: hits.slice(0, limit) };
}

// ---------------------------------------------------------------------------
// Question parser

const PLANET_WORDS: [RegExp, Planet][] = [
  [/\b(sun|surya|ravi)\b/, 'Sun'],
  [/\b(moon|chandra|soma)\b/, 'Moon'],
  [/\b(mars|mangal|mangala|kuja|angaraka)\b/, 'Mars'],
  [/\b(mercury|budh|budha)\b/, 'Mercury'],
  [/\b(jupiter|guru|brihaspati|brhaspati)\b/, 'Jupiter'],
  [/\b(venus|shukra|sukra)\b/, 'Venus'],
  [/\b(saturn|shani|sani)\b/, 'Saturn'],
  [/\b(rahu|north node)\b/, 'Rahu'],
  [/\b(ketu|south node)\b/, 'Ketu'],
];

const SIGN_WORDS: [RegExp, number][] = [
  [/\b(aries|mesha|mesh)\b/, 0], [/\b(taurus|vrishabha|vrishabh|vrisha)\b/, 1], [/\b(gemini|mithuna|mithun)\b/, 2],
  [/\b(cancer|karka|karkata|kataka)\b/, 3], [/\b(leo|simha|singh)\b/, 4], [/\b(virgo|kanya)\b/, 5],
  [/\b(libra|tula|thula)\b/, 6], [/\b(scorpio|vrischika|vrishchika|vrischik)\b/, 7], [/\b(sagittarius|dhanu|dhanus)\b/, 8],
  [/\b(capricorn|makara|makar)\b/, 9], [/\b(aquarius|kumbha|kumbh)\b/, 10], [/\b(pisces|meena|meen|mina)\b/, 11],
];

/** Planet mentions in the order they appear in the text. */
function planetsIn(text: string): { planet: Planet; index: number }[] {
  const out: { planet: Planet; index: number }[] = [];
  for (const [re, p] of PLANET_WORDS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) out.push({ planet: p, index: m.index });
  }
  return out.sort((a, b) => a.index - b.index);
}

const signIn = (text: string) => SIGN_WORDS.find(([re]) => re.test(text))?.[1];

export interface ParsedQuestion {
  query: TransitQuery;
  /** Search range when the question names years ("in 2030", "between 2027 and 2032", "after 2028"). */
  from?: Date;
  to?: Date;
  /** Natal sign or house the question pointed at, resolved later against the chart. */
  natalSign?: { of: NatalPoint } | { house: number };
}

export type ParseResult = { ok: true; parsed: ParsedQuestion } | { ok: false; error: string };

export const EXAMPLE_QUESTIONS = [
  'When does Saturn next hit my Moon?',
  'Next Jupiter return',
  'When does Jupiter enter my 10th house?',
  'When does Saturn enter Aquarius?',
  'Next Mercury retrograde',
  'When does Mars aspect my Ascendant?',
  'When does Shani transit my Moon sign?',
  'When does Rahu cross my Sun after 2030?',
];

function yearsIn(text: string): { from?: Date; to?: Date } {
  const between = text.match(/\b(?:between|from)\s+(\d{4})\s+(?:and|to|-|–)\s+(\d{4})\b/);
  if (between) return { from: new Date(Date.UTC(+between[1], 0, 1)), to: new Date(Date.UTC(+between[2] + 1, 0, 1)) };
  const after = text.match(/\b(?:after|from|since)\s+(\d{4})\b/);
  if (after) return { from: new Date(Date.UTC(+after[1], 0, 1)) };
  const before = text.match(/\b(?:before|by|until)\s+(\d{4})\b/);
  if (before) return { to: new Date(Date.UTC(+before[1], 0, 1)) };
  const inYear = text.match(/\b(?:in|during)\s+(\d{4})\b/);
  if (inYear) return { from: new Date(Date.UTC(+inYear[1], 0, 1)), to: new Date(Date.UTC(+inYear[1] + 1, 0, 1)) };
  return {};
}

/**
 * Parse a question about future transits. Understands, among others:
 * "when does Saturn hit/cross/conjunct my Moon", "Saturn opposite my Sun",
 * "Jupiter aspect my Lagna", "next Saturn return", "when does Mars enter Leo",
 * "Jupiter into my 7th house", "Shani in my Moon sign", "next Mercury retrograde",
 * "when does Saturn go direct", and year limits ("in 2030", "after 2028").
 */
export function parseTransitQuestion(input: string): ParseResult {
  const text = ` ${input.toLowerCase().replace(/[’']/g, "'").replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ')} `;
  const range = yearsIn(text);
  const mentions = planetsIn(text);
  const lagna = /\b(ascendant|lagna|rising|asc)\b/.test(text);
  if (!mentions.length) {
    return { ok: false, error: 'Name a planet to search for, for example "When does Saturn next hit my Moon?"' };
  }
  const planet = mentions[0].planet;
  const done = (query: TransitQuery, natalSign?: ParsedQuestion['natalSign']): ParseResult => ({ ok: true, parsed: { query, ...range, natalSign } });

  // Stations
  if (/\b(retro|retrograde|rx)\b/.test(text) && !/\b(my|natal)\b/.test(text.replace(/\bmy (?:own )?(?:chart|life)\b/, ''))) {
    if (!canStation(planet)) return { ok: false, error: `${planet} never turns retrograde${planet === 'Rahu' || planet === 'Ketu' ? ' or direct: the nodes always move backwards' : ''}.` };
    return done({ kind: 'station', planet, station: 'retrograde' });
  }
  if (/\b(direct|stations?|stationary|turns? around)\b/.test(text) && !/\bmy\b/.test(text)) {
    if (!canStation(planet)) return { ok: false, error: `${planet} does not station.` };
    return done({ kind: 'station', planet, station: /\bdirect\b/.test(text) ? 'direct' : undefined });
  }

  // Returns ("next Jupiter return", "my Saturn return"); "Saturn returns to my Moon" is a contact instead.
  const second = mentions.find((m) => m.planet !== planet)?.planet;
  if (/\breturns?\b/.test(text) && !second && !lagna) return done({ kind: 'return', planet });

  // House ingress: "Jupiter into my 10th house"
  const house = text.match(/\b(\d{1,2})(?:st|nd|rd|th)? house\b/) ?? text.match(/\bhouse (\d{1,2})\b/);
  const houseWord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
    .findIndex((w) => new RegExp(`\\b${w} house\\b`).test(text));
  const houseNo = house ? +house[1] : houseWord >= 0 ? houseWord + 1 : 0;
  if (houseNo) {
    if (houseNo < 1 || houseNo > 12) return { ok: false, error: 'Houses run from 1 to 12.' };
    return done({ kind: 'ingress', planet }, { house: houseNo });
  }

  // Sign of a natal point: "Saturn into my Moon sign", "Shani transit my rashi"
  if (/\b(sign|rashi|rasi)\b/.test(text) && /\bmy\b/.test(text) && (second || lagna || /\b(moon sign|rashi|rasi)\b/.test(text))) {
    const of: NatalPoint = lagna && !second ? 'Ascendant' : second ?? 'Moon';
    return done({ kind: 'ingress', planet }, { of });
  }

  // Named sign: "Saturn enters Aquarius"
  const sign = signIn(text);
  if (sign !== undefined && !(second && /\bmy\b/.test(text))) return done({ kind: 'ingress', planet, sign });

  // Contacts with a natal point
  if (second || lagna) {
    const target: NatalPoint = second ?? 'Ascendant';
    let aspect: AspectKind = 'conjunction';
    if (/\b(oppos\w*|opposite)\b/.test(text)) aspect = 'opposition';
    else if (/\b(special aspect|drishti|drshti)\b/.test(text)) aspect = 'special';
    else if (/\b(aspects?|aspecting|influence|look at|looks at|contacts?)\b/.test(text)) aspect = 'any';
    if (target === planet) return done({ kind: 'return', planet });
    return done({ kind: 'aspect', planet, target, aspect });
  }

  // Bare "when does Saturn change sign" / "next Jupiter ingress"
  if (/\b(sign|ingress|enters?|moves?|changes?|transit)\b/.test(text)) return done({ kind: 'ingress', planet });

  return {
    ok: false,
    error: `I couldn't tell what to look for with ${planet}. Try "${planet} over my Moon", "next ${planet} return" or "${planet} enters Aquarius".`,
  };
}

/** Resolve a parsed question's natal sign/house against a chart into a concrete query. */
export function resolveQuestion(parsed: ParsedQuestion, natal: NatalChart): { query: TransitQuery; note?: string } {
  if (!parsed.natalSign || parsed.query.kind !== 'ingress') return { query: parsed.query };
  const asc = signOf(natal.ascendant);
  if ('house' in parsed.natalSign) {
    const sign = (asc + parsed.natalSign.house - 1) % 12;
    return { query: { ...parsed.query, sign }, note: `Your ${ordinal(parsed.natalSign.house)} house is ${signName(sign)} (whole-sign from your Lagna).` };
  }
  const of = parsed.natalSign.of;
  const sign = signOf(natalLon(natal, of));
  return { query: { ...parsed.query, sign }, note: `Your ${of === 'Ascendant' ? 'Lagna' : `natal ${of}`} is in ${signName(sign)}.` };
}

/** One-call helper for the UI: parse, resolve and search. */
export function answerTransitQuestion(eph: Ephemeris, natal: NatalChart, text: string, opts: SearchOptions = {}):
  { ok: true; result: TransitSearchResult; note?: string } | { ok: false; error: string } {
  const p = parseTransitQuestion(text);
  if ('error' in p) return { ok: false, error: p.error };
  const { query, note } = resolveQuestion(p.parsed, natal);
  const from = p.parsed.from ?? opts.from;
  const to = p.parsed.to ?? opts.to;
  return { ok: true, result: searchTransits(eph, natal, query, { ...opts, from, to }), note };
}
