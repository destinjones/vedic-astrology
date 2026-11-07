/**
 * A light candidate chart: only what rectification needs, computed for many
 * instants inside the birth window. Planets other than the Moon barely move in
 * a day; what changes is the lagna (every ~2 h), its divisional signs (D9 every
 * ~13 min, D60 every ~2 min), the lagna degree (1° every ~4 min) and, through
 * the Moon, the balance of the Vimshottari dasha.
 */
import {
  DASHA_ORDER,
  DASHA_TOTAL_YEARS,
  DASHA_YEARS,
  DEFAULT_DASHA_YEAR_DAYS,
  GRAHAS,
  NAKSHATRA_SPAN,
  NAKSHATRAS,
  addSigns,
  houseFrom,
  signLord,
  signOf,
  vargaSign,
  type AyanamsaId,
  type Engine,
  type GrahaId,
  type HouseNumber,
  type NodeType,
  type SignNumber,
  type VargaId,
} from '@vedic/engine';

export interface CandidateChart {
  jd: number;
  asc: number;
  ascSign: SignNumber;
  lon: Record<GrahaId, number>;
  sign: Record<GrahaId, SignNumber>;
  /** Vimshottari: first lord index in DASHA_ORDER and the JD the cycle starts */
  dashaStartIdx: number;
  dashaStartJd: number;
  /** Remaining balance of the first mahadasha at birth, years */
  balanceYears: number;
  vargaCache: Map<VargaId, VargaView>;
}

export interface VargaView {
  lagna: SignNumber;
  sign: Record<GrahaId, SignNumber>;
}

export interface Place {
  latitude: number;
  longitude: number;
}

export interface ChartSettings {
  ayanamsa: AyanamsaId;
  nodeType: NodeType;
}

export function candidateChart(engine: Engine, jd: number, place: Place, s: ChartSettings): CandidateChart {
  const snap = engine.positionsAt(jd, { ayanamsa: s.ayanamsa, nodeType: s.nodeType });
  const asc = engine.ascendantAt(jd, place.latitude, place.longitude, s.ayanamsa);
  const lon = {} as Record<GrahaId, number>;
  const sign = {} as Record<GrahaId, SignNumber>;
  for (const g of GRAHAS) {
    lon[g] = snap.planets[g].longitude;
    sign[g] = signOf(lon[g]);
  }
  const nkIdx = Math.min(26, Math.floor(lon.moon / NAKSHATRA_SPAN));
  const frac = (lon.moon - nkIdx * NAKSHATRA_SPAN) / NAKSHATRA_SPAN;
  const first = NAKSHATRAS[nkIdx].lord;
  const years = DASHA_YEARS[first];
  return {
    jd,
    asc,
    ascSign: signOf(asc),
    lon,
    sign,
    dashaStartIdx: DASHA_ORDER.indexOf(first),
    dashaStartJd: jd - frac * years * DEFAULT_DASHA_YEAR_DAYS,
    balanceYears: years * (1 - frac),
    vargaCache: new Map(),
  };
}

export function vargaView(c: CandidateChart, id: VargaId): VargaView {
  let v = c.vargaCache.get(id);
  if (!v) {
    const sign = {} as Record<GrahaId, SignNumber>;
    for (const g of GRAHAS) sign[g] = vargaSign(c.lon[g], id);
    v = { lagna: vargaSign(c.asc, id), sign };
    c.vargaCache.set(id, v);
  }
  return v;
}

export const houseOf = (c: CandidateChart, g: GrahaId): HouseNumber => houseFrom(c.ascSign, c.sign[g]);
export const signOfHouse = (lagna: SignNumber, h: number): SignNumber => addSigns(lagna, h - 1);
export const lordOfHouse = (lagna: SignNumber, h: number): GrahaId => signLord(signOfHouse(lagna, h));

/** Houses (from a lagna) a graha rules. Rahu and Ketu rule none here. */
export function housesRuled(lagna: SignNumber, g: GrahaId): HouseNumber[] {
  const out: HouseNumber[] = [];
  for (let h = 1; h <= 12; h++) if (lordOfHouse(lagna, h) === g) out.push(h as HouseNumber);
  return out;
}

/** Graha drishti: every planet aspects the 7th; Mars 4/8, Jupiter (and the nodes) 5/9, Saturn 3/10. */
const SPECIAL_ASPECTS: Partial<Record<GrahaId, number[]>> = {
  mars: [4, 8],
  jupiter: [5, 9],
  saturn: [3, 10],
  rahu: [5, 9],
  ketu: [5, 9],
};
export function aspects(g: GrahaId, from: SignNumber, target: SignNumber): boolean {
  const d = houseFrom(from, target);
  return d === 7 || (SPECIAL_ASPECTS[g]?.includes(d) ?? false);
}

/**
 * Active Vimshottari chain [maha, antar, pratyantar] at a JD, matching
 * @vedic/engine's own dasha (same year length and subdivision rule).
 */
export function dashaChain(c: CandidateChart, jd: number, levels = 3): GrahaId[] {
  const yd = DEFAULT_DASHA_YEAR_DAYS;
  const cycle = DASHA_TOTAL_YEARS * yd;
  let t = jd - c.dashaStartJd;
  if (t < 0) return [];
  t %= cycle;
  const chain: GrahaId[] = [];
  let startIdx = c.dashaStartIdx;
  let span = cycle;
  for (let level = 0; level < levels; level++) {
    for (let i = 0; i < 9; i++) {
      const lord = DASHA_ORDER[(startIdx + i) % 9];
      const len = (span * DASHA_YEARS[lord]) / DASHA_TOTAL_YEARS;
      if (t < len || i === 8) {
        chain.push(lord);
        startIdx = DASHA_ORDER.indexOf(lord);
        span = len;
        break;
      }
      t -= len;
    }
  }
  return chain;
}
