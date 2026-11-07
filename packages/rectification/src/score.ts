/**
 * How well a candidate birth time explains one life event.
 *
 *  1. Dasha (65%): the maha / antar / pratyantar lords running on the event
 *     date must signify the event in this candidate's chart: rule or occupy
 *     its houses from the lagna, aspect them, be its karaka, and repeat the
 *     promise in the event's divisional chart. Rahu and Ketu also give the
 *     results of their dispositor. The antardasha weighs most, as in practice.
 *  2. Transits (35%): the double transit of Jupiter and Saturn over the
 *     event's main house or its lord (K. N. Rao's rule), and slow planets
 *     crossing the degree of the lagna or the event's bhava madhya (lagna
 *     degree + 30° per house), which moves 1° every ~4 minutes of birth time.
 *
 * Both parts are 0–1. The weights are a reasoned synthesis, not one canonical
 * formula; they live here for tuning.
 */
import { SIGN_NAMES, angularDistance, norm360, signLord, signOf, type GrahaId, type SignNumber } from '@vedic/engine';
import { aspects, houseOf, housesRuled, lordOfHouse, signOfHouse, vargaView, type CandidateChart } from './chart';
import type { DatePrecision, EventDef } from './events';

export const WEIGHTS = {
  dasha: 0.65,
  transit: 0.35,
  /** maha, antar, pratyantar (and sookshma for an exact day) by how precisely the event date is known */
  levels: { day: [0.8, 1, 0.8, 0.45], month: [0.8, 1, 0.6], year: [0.8, 1, 0.3] } as Record<DatePrecision, number[]>,
  ownsPrimary: 0.45,
  inPrimary: 0.35,
  aspectsPrimary: 0.12,
  ownsSecondary: 0.2,
  inSecondary: 0.15,
  karaka: 0.25,
  withPrimaryLord: 0.1,
  vargaPlacement: 0.2,
  vargaLordship: 0.2,
  vargaCap: 0.3,
  nodeDispositor: 0.6,
  doubleTransit: 0.45,
  singleTransit: 0.12,
  degreeContact: { saturn: 0.3, jupiter: 0.3, rahu: 0.25, ketu: 0.2, mars: 0.12 } as Partial<Record<GrahaId, number>>,
  lordContact: 0.12,
  orb: 3,
};

export const PLANET_LABEL: Record<GrahaId, string> = {
  sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter',
  venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
};
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

export interface Signification {
  value: number;
  reasons: string[];
}

/** How strongly a graha signifies an event in a candidate chart (0–1). */
export function signification(c: CandidateChart, g: GrahaId, def: EventDef, depth = 0): Signification {
  const reasons: string[] = [];
  let v = 0;
  const ruled = housesRuled(c.ascSign, g);
  const h = houseOf(c, g);
  for (const p of def.primary) {
    if (ruled.includes(p)) { v += WEIGHTS.ownsPrimary; reasons.push(`lord of the ${ord(p)}`); }
    if (h === p) { v += WEIGHTS.inPrimary; reasons.push(`sits in the ${ord(p)}`); }
    else if (aspects(g, c.sign[g], signOfHouse(c.ascSign, p))) { v += WEIGHTS.aspectsPrimary; reasons.push(`aspects the ${ord(p)}`); }
  }
  for (const s of def.secondary) {
    if (ruled.includes(s)) { v += WEIGHTS.ownsSecondary; reasons.push(`lord of the ${ord(s)}`); }
    if (h === s) { v += WEIGHTS.inSecondary; reasons.push(`sits in the ${ord(s)}`); }
  }
  if (def.karakas.includes(g)) { v += WEIGHTS.karaka; reasons.push(`natural significator (karaka) of ${def.label.toLowerCase()}`); }
  const mainLord = lordOfHouse(c.ascSign, def.primary[0]);
  if (mainLord !== g && c.sign[mainLord] === c.sign[g]) { v += WEIGHTS.withPrimaryLord; reasons.push(`joins the ${ord(def.primary[0])} lord ${PLANET_LABEL[mainLord]}`); }

  if (def.varga !== 'D1') {
    const vv = vargaView(c, def.varga);
    let vargaPart = 0;
    const vh = ((vv.sign[g] - vv.lagna + 12) % 12) + 1;
    if (def.primary.includes(vh as never)) { vargaPart += WEIGHTS.vargaPlacement; reasons.push(`in the ${ord(vh)} of the ${def.varga}`); }
    const vRuled = housesRuled(vv.lagna, g).filter((x) => def.primary.includes(x));
    if (vRuled.length) { vargaPart += WEIGHTS.vargaLordship; reasons.push(`rules the ${vRuled.map(ord).join(' and ')} of the ${def.varga}`); }
    v += Math.min(WEIGHTS.vargaCap, vargaPart);
  }

  if ((g === 'rahu' || g === 'ketu') && depth === 0) {
    const disp = signLord(c.sign[g]);
    const d = signification(c, disp, def, 1);
    if (d.value > 0) {
      v += WEIGHTS.nodeDispositor * d.value;
      reasons.push(`gives the results of its dispositor ${PLANET_LABEL[disp]} (${d.reasons.slice(0, 2).join(', ')})`);
    }
  }
  return { value: Math.min(1, v), reasons };
}

export interface DashaMatch {
  value: number;
  chain: GrahaId[];
  parts: { lord: GrahaId; level: number; value: number; reasons: string[] }[];
}

export function dashaMatch(c: CandidateChart, chain: GrahaId[], def: EventDef, precision: DatePrecision): DashaMatch {
  const w = WEIGHTS.levels[precision];
  let sum = 0, wsum = 0;
  const parts: DashaMatch['parts'] = [];
  chain.forEach((lord, i) => {
    if (w[i] === undefined) return;
    const s = signification(c, lord, def);
    sum += w[i] * s.value;
    wsum += w[i];
    parts.push({ lord, level: i + 1, value: s.value, reasons: s.reasons });
  });
  return { value: wsum ? sum / wsum : 0, chain, parts };
}

/** Sidereal longitudes of the slow movers on a date, computed once per event sample. */
export type TransitPositions = Record<'jupiter' | 'saturn' | 'rahu' | 'ketu' | 'mars', number>;

export interface TransitMatch {
  value: number;
  reasons: string[];
}

export function transitMatch(c: CandidateChart, t: TransitPositions, def: EventDef): TransitMatch {
  const reasons: string[] = [];
  const main = def.primary[0];
  const houseSign = signOfHouse(c.ascSign, main);
  const lord = lordOfHouse(c.ascSign, main);
  const lordSign = c.sign[lord];
  const touches = (g: 'jupiter' | 'saturn', target: SignNumber) => {
    const from = signOf(t[g]);
    return from === target || aspects(g, from, target);
  };
  const jh = touches('jupiter', houseSign), jl = touches('jupiter', lordSign);
  const sh = touches('saturn', houseSign), sl = touches('saturn', lordSign);
  const j = jh || jl, s = sh || sl;
  let v = 0;
  const what = (h: boolean, l: boolean) => (h && l ? `the ${ord(main)} and its lord` : h ? `the ${ord(main)} (${SIGN_NAMES[houseSign - 1]})` : `the ${ord(main)} lord ${PLANET_LABEL[lord]}`);
  if (j && s) {
    v += WEIGHTS.doubleTransit;
    reasons.push(`double transit: Jupiter reaches ${what(jh, jl)} and Saturn ${what(sh, sl)}`);
  } else if (j || s) {
    v += WEIGHTS.singleTransit;
    reasons.push(j ? `Jupiter reaches ${what(jh, jl)}` : `Saturn reaches ${what(sh, sl)}`);
  }

  const points = new Set<number>([1, ...def.primary]);
  for (const [g, wt] of Object.entries(WEIGHTS.degreeContact) as [GrahaId, number][]) {
    const tl = t[g as keyof TransitPositions];
    for (const h of points) {
      const pt = norm360(c.asc + (h - 1) * 30);
      const orb = angularDistance(tl, pt);
      if (orb <= WEIGHTS.orb) {
        v += wt * (1 - orb / (WEIGHTS.orb * 2));
        reasons.push(`${PLANET_LABEL[g]} within ${orb.toFixed(1)}° of the ${h === 1 ? 'lagna degree' : `${ord(h)} house point`}`);
      }
    }
    if ((g === 'saturn' || g === 'jupiter') && angularDistance(tl, c.lon[lord]) <= WEIGHTS.orb) {
      v += WEIGHTS.lordContact;
      reasons.push(`${PLANET_LABEL[g]} crosses the natal ${ord(main)} lord ${PLANET_LABEL[lord]}`);
    }
  }
  return { value: Math.min(1, v), reasons };
}
