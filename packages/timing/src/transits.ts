/**
 * Gochara (transits) over the natal chart: house-from-Moon results with vedha,
 * ashtakavarga bindus and kakshya, natal contacts, plus Sade Sati and other
 * Saturn phases, and a sampled favourability series.
 */
import { type Ephemeris, type NatalChart, type Planet, PLANETS, type Positions, type Reason, type Scored, type SevenPlanet } from './types';
import { DAY_MS, houseFrom, norm360, ordinal, scored, signName, signOf } from './astro';
import { type Ashtakavarga, BAV_TOTALS, computeAshtakavarga, kakshya } from './ashtakavarga';
import { findIngresses } from './events';
import { HOUSE_TOPICS } from './dasha';

/** Favourable houses from the natal Moon and their vedha (obstruction) houses. */
export const GOCHARA: Record<Planet, Record<number, number>> = {
  Sun: { 3: 9, 6: 12, 10: 4, 11: 5 },
  Moon: { 1: 5, 3: 9, 6: 12, 7: 2, 10: 4, 11: 8 },
  Mars: { 3: 12, 6: 9, 11: 5 },
  Mercury: { 2: 5, 4: 3, 6: 9, 8: 1, 10: 8, 11: 12 },
  Jupiter: { 2: 12, 5: 4, 7: 3, 9: 10, 11: 8 },
  Venus: { 1: 8, 2: 7, 3: 1, 4: 10, 5: 9, 8: 5, 9: 11, 11: 6, 12: 3 },
  Saturn: { 3: 12, 6: 9, 11: 5 },
  Rahu: { 3: 12, 6: 9, 11: 5 },
  Ketu: { 3: 12, 6: 9, 11: 5 },
};

/** Relative impact of each transiting planet (slow planets dominate). */
export const TRANSIT_WEIGHT: Record<Planet, number> = {
  Saturn: 22, Jupiter: 22, Rahu: 12, Ketu: 9, Mars: 9, Sun: 5, Venus: 5, Mercury: 4, Moon: 2,
};

/**
 * Unfavourable-house weight per planet, chosen so a planet's long-run average
 * over all 12 houses is near zero (Saturn is good in only 3 houses, Venus in 9).
 */
const UNFAV_SCALE = Object.fromEntries(
  (Object.keys(GOCHARA) as Planet[]).map((p) => {
    const n = Object.keys(GOCHARA[p]).length;
    return [p, Math.min(1.2, Math.max(0.4, n / (12 - n)))];
  }),
) as Record<Planet, number>;

const NO_VEDHA: [Planet, Planet][] = [['Sun', 'Saturn'], ['Moon', 'Mercury']];
const vedhaExempt = (a: Planet, b: Planet) => NO_VEDHA.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

const SPECIAL: Partial<Record<Planet, Record<number, string>>> = {
  Saturn: { 12: 'Sade Sati (rising phase)', 1: 'Sade Sati (peak, over the Moon)', 2: 'Sade Sati (setting phase)', 4: 'Kantaka/Ardhashtama Shani', 8: 'Ashtama Shani' },
  Jupiter: { 8: 'Jupiter 8th from Moon', 12: 'Jupiter 12th from Moon', 1: 'Jupiter over the Moon (Janma Guru)' },
  Rahu: { 1: 'Rahu over the Moon', 8: 'Rahu 8th from Moon' },
};

export interface PlanetTransit extends Scored {
  planet: Planet;
  sign: number;
  houseFromMoon: number;
  houseFromLagna: number;
  favourable: boolean;
  obstructedBy: Planet | null;
  bindus: number | null;
  kakshyaLord: string | null;
  kakshyaHasBindu: boolean | null;
  retrograde: boolean;
  contacts: { natal: Planet | 'Ascendant'; orb: number; kind: 'conjunction' | 'opposition' }[];
  label?: string;
}

export interface TransitSnapshot extends Scored {
  date: Date;
  planets: PlanetTransit[];
}

export function transitSnapshot(chart: NatalChart, pos: Positions, date: Date, av: Ashtakavarga = computeAshtakavarga(chart)): TransitSnapshot {
  const moonSign = signOf(chart.planets.Moon.longitude);
  const ascSign = signOf(chart.ascendant);
  const houseOf = (p: Planet) => houseFrom(moonSign, signOf(pos[p].longitude));
  const planets: PlanetTransit[] = [];
  const all: Reason[] = [];

  for (const p of PLANETS) {
    const sign = signOf(pos[p].longitude);
    const h = houseOf(p);
    const table = GOCHARA[p];
    const favourable = h in table;
    let obstructedBy: Planet | null = null;
    if (favourable) {
      const vh = table[h];
      obstructedBy = PLANETS.find((q) => q !== p && !vedhaExempt(p, q) && houseOf(q) === vh) ?? null;
    }
    const w = TRANSIT_WEIGHT[p];
    const reasons: Reason[] = [];
    const special = SPECIAL[p]?.[h];
    if (favourable && !obstructedBy) reasons.push({ weight: w, text: `${p} transits the ${ordinal(h)} from your Moon (favourable)` });
    else if (favourable && obstructedBy) reasons.push({ weight: w * 0.15, text: `${p} in the ${ordinal(h)} from Moon would help, but ${obstructedBy} causes vedha (blocks it)` });
    else reasons.push({ weight: -w * (UNFAV_SCALE[p] + (special ? 0.45 : 0)), text: `${p} transits the ${ordinal(h)} from your Moon${special ? `: ${special}` : ''} (${HOUSE_TOPICS[houseFrom(ascSign, sign)].split(',')[0]} area from lagna)` });

    let bindus: number | null = null, kLord: string | null = null, kHas: boolean | null = null;
    if (p in av.bav) {
      const sp = p as SevenPlanet;
      bindus = av.bav[sp][sign];
      const adj = (bindus - BAV_TOTALS[sp] / 12) / 4; // centred on the planet's average bindus per sign
      reasons.push({ weight: adj * w * 0.8, text: `${bindus} of 8 ashtakavarga bindus for ${p} in ${signName(sign)}` });
      const k = kakshya(pos[p].longitude);
      kLord = k.lord;
      kHas = av.prastara[sp][sign].includes(k.lord as never);
      if (w >= 9) reasons.push({ weight: (kHas ? 0.15 : -0.1) * w, text: `in the ${k.lord} kakshya, which ${kHas ? 'gives' : 'does not give'} a bindu` });
    }

    const contacts: PlanetTransit['contacts'] = [];
    if (['Saturn', 'Jupiter', 'Rahu', 'Ketu', 'Mars'].includes(p)) {
      const targets: [Planet | 'Ascendant', number][] = [...PLANETS.map((q) => [q, chart.planets[q].longitude] as [Planet, number]), ['Ascendant', chart.ascendant]];
      for (const [name, lon] of targets) {
        for (const [kind, off] of [['conjunction', 0], ['opposition', 180]] as const) {
          const orb = Math.abs(((norm360(pos[p].longitude - lon - off) + 540) % 360) - 180);
          if (orb <= 2.5) {
            contacts.push({ natal: name, orb: Math.round(orb * 10) / 10, kind });
            const benefic = p === 'Jupiter';
            const sens = name === 'Moon' || name === 'Sun' || name === 'Ascendant' ? 1.4 : 1;
            reasons.push({ weight: (benefic ? 0.35 : -0.35) * w * sens * (kind === 'conjunction' ? 1 : 0.6), text: `${p} ${kind === 'conjunction' ? 'conjoins' : 'opposes'} natal ${name} (${orb.toFixed(1)}°)` });
          }
        }
      }
    }
    all.push(...reasons);
    planets.push({
      ...scored(reasons, w * 1.2), planet: p, sign, houseFromMoon: h, houseFromLagna: houseFrom(ascSign, sign), favourable, obstructedBy,
      bindus, kakshyaLord: kLord, kakshyaHasBindu: kHas, retrograde: pos[p].speed < 0 && p !== 'Rahu' && p !== 'Ketu', contacts, label: special,
    });
  }
  return { ...scored(all, 60), date, planets };
}

export interface SeriesPoint {
  date: Date;
  transit: number;
  /** Per-planet transit sub-score, for stacked views. */
  byPlanet: Record<Planet, number>;
}

/**
 * The chart's long-run average transit score (one ~30 year Saturn cycle around
 * now). Classical gochara has more unfavourable than favourable houses, so raw
 * scores lean negative; subtracting this baseline shows what is better or worse
 * *for this person* than usual.
 */
export function transitBaseline(eph: Ephemeris, chart: NatalChart, around = new Date(), years = 30, stepDays = 23): number {
  const av = computeAshtakavarga(chart);
  const from = around.getTime() - (years / 2) * 365.25 * DAY_MS;
  let sum = 0, n = 0;
  for (let t = from; t < from + years * 365.25 * DAY_MS; t += stepDays * DAY_MS) {
    const d = new Date(t);
    sum += transitSnapshot(chart, eph.positions(d), d, av).score;
    n++;
  }
  return sum / n;
}

export function transitSeries(eph: Ephemeris, chart: NatalChart, from: Date, to: Date, stepDays = 7): SeriesPoint[] {
  const av = computeAshtakavarga(chart);
  const out: SeriesPoint[] = [];
  for (let t = from.getTime(); t <= to.getTime(); t += stepDays * DAY_MS) {
    const d = new Date(t);
    const snap = transitSnapshot(chart, eph.positions(d), d, av);
    const byPlanet = {} as Record<Planet, number>;
    for (const p of snap.planets) byPlanet[p.planet] = p.score;
    out.push({ date: d, transit: snap.score, byPlanet });
  }
  return out;
}

// ---------------- Saturn phases / Sade Sati ----------------

export type SaturnPhaseKind = 'sade-sati-rising' | 'sade-sati-peak' | 'sade-sati-setting' | 'kantaka' | 'ashtama';
export interface SaturnPhase {
  kind: SaturnPhaseKind;
  start: Date;
  end: Date;
  sign: number;
  /** True when this stint is a retrograde re-entry. */
  reentry: boolean;
}
export interface SadeSatiSpell {
  start: Date;
  end: Date;
  phases: SaturnPhase[];
  /** Saturn's ashtakavarga bindus in each of the three signs. */
  bindus: number[];
  severity: Scored;
}

const PHASE_BY_HOUSE: Record<number, SaturnPhaseKind> = { 12: 'sade-sati-rising', 1: 'sade-sati-peak', 2: 'sade-sati-setting', 4: 'kantaka', 8: 'ashtama' };
export const SATURN_PHASE_TEXT: Record<SaturnPhaseKind, string> = {
  'sade-sati-rising': 'Rising phase: pressure on expenses, sleep and the head; the old order begins to loosen.',
  'sade-sati-peak': 'Peak: Saturn over the Moon. Emotional weight, responsibility, health of mind and body; deep maturing.',
  'sade-sati-setting': 'Setting phase: strain on finances, family and speech; lessons consolidate and things start to ease.',
  kantaka: 'Kantaka (Ardhashtama) Shani: Saturn 4th from the Moon. Domestic stress, property and peace of mind need care.',
  ashtama: 'Ashtama Shani: Saturn 8th from the Moon. Obstacles, sudden changes and health vigilance.',
};

export function saturnPhases(eph: Ephemeris, chart: NatalChart, from: Date, to: Date): { phases: SaturnPhase[]; sadeSati: SadeSatiSpell[] } {
  const moonSign = signOf(chart.planets.Moon.longitude);
  const ingresses = findIngresses(eph, 'Saturn', from, to);
  const startSign = signOf(eph.positions(from).Saturn.longitude);
  const stints: { sign: number; start: Date; end: Date; reentry: boolean }[] = [];
  let cur = { sign: startSign, start: from, reentry: false };
  const seen = new Set<number>([startSign]);
  for (const ing of ingresses) {
    stints.push({ ...cur, end: ing.date });
    cur = { sign: ing.toSign, start: ing.date, reentry: seen.has(ing.toSign) };
    seen.add(ing.toSign);
  }
  stints.push({ ...cur, end: to });

  const phases: SaturnPhase[] = [];
  for (const s of stints) {
    const kind = PHASE_BY_HOUSE[houseFrom(moonSign, s.sign)];
    if (kind) phases.push({ kind, start: s.start, end: s.end, sign: s.sign, reentry: s.reentry });
  }

  const av = computeAshtakavarga(chart);
  const ss = phases.filter((p) => p.kind.startsWith('sade-sati'));
  const spells: SadeSatiSpell[] = [];
  for (const ph of ss) {
    const last = spells[spells.length - 1];
    // phases separated by under ~3 years belong to one spell (retrograde back-and-forth)
    if (last && ph.start.getTime() - last.end.getTime() < 3 * 365 * DAY_MS) { last.phases.push(ph); last.end = ph.end; }
    else spells.push({ start: ph.start, end: ph.end, phases: [ph], bindus: [], severity: { score: 0, tone: 'mixed', reasons: [] } });
  }
  for (const sp of spells) {
    const signs = [(moonSign + 11) % 12, moonSign, (moonSign + 1) % 12];
    sp.bindus = signs.map((s) => av.bav.Saturn[s]);
    const reasons: Reason[] = [{ weight: -35, text: 'Sade Sati: Saturn transits the 12th, 1st and 2nd from your Moon over about 7.5 years' }];
    signs.forEach((s, i) => reasons.push({ weight: (sp.bindus[i] - 4) * 6, text: `${['Rising', 'Peak', 'Setting'][i]} phase in ${signName(s)}: Saturn has ${sp.bindus[i]} bindus there${sp.bindus[i] >= 4 ? ' (softens it)' : ' (intensifies it)'}` }));
    const ascSign = signOf(chart.ascendant);
    if ([1, 6, 9, 10].includes(ascSign)) reasons.push({ weight: 18, text: `Saturn is a functional benefic for ${signName(ascSign)} lagna, so the period builds lasting results` });
    if ([6, 9, 10].includes(moonSign)) reasons.push({ weight: 8, text: `Moon in a Saturn-friendly sign (${signName(moonSign)})` });
    sp.severity = scored(reasons, 60);
  }
  return { phases, sadeSati: spells };
}

