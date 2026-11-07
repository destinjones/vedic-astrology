import type { BirthInput, Chart, DashaPeriod, SignNum, PlanetId, PlanetPosition, VargaChart, VargaId } from '../types/chart';
import { ALL_VARGAS, buildVarga } from '../lib/vargas';

/**
 * Structural view of @vedic/engine's Chart (only the fields the UI reads).
 * Kept local so the UI compiles before the engine package exists.
 */
interface EnginePoint {
  longitude: number; sign: number; degreeInSign: number; nakshatra: number; pada: number;
}
interface EnginePlanet extends EnginePoint {
  speed: number; house: number; retrograde: boolean; combust: boolean;
}
interface EngineDashaNode {
  lord: PlanetId; name?: string; sign?: SignNum; start: string; end: string; children?: EngineDashaNode[];
}
interface EngineDashas {
  yogini: { periods: EngineDashaNode[]; startYogini: number };
  ashtottari: { periods: EngineDashaNode[]; applicable?: boolean };
  kalachakra: {
    periods: EngineDashaNode[]; direction: 'savya' | 'apasavya'; pada: number;
    paramayus: number; deha: SignNum; jeeva: SignNum;
  };
}
export interface EngineChart {
  meta: { ayanamsaValue: number };
  ascendant: EnginePoint;
  planets: Partial<Record<string, EnginePlanet>>;
  vargas?: Partial<Record<VargaId, { ascendant: { sign: number }; planets: Partial<Record<string, { sign: number; house: number }>> }>>;
  dasha?: { periods: EngineDashaNode[] };
  dashas?: EngineDashas;
}

const SIGN_NAME = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

function otherDashas(d: EngineDashas | undefined): Chart['dashaSystems'] {
  if (!d) return undefined;
  const k = d.kalachakra;
  return {
    yogini: {
      periods: d.yogini.periods.map(toDasha),
      note: `Eight yoginis in a 36-year cycle. Your Moon's nakshatra starts you in ${d.yogini.periods[0]?.name ?? 'the first'} yogini.`,
    },
    ashtottari: {
      periods: d.ashtottari.periods.map(toDasha),
      note: `Eight planets over 108 years, without Ketu. Tradition uses it when Rahu sits in a kendra or trikona from the lagna lord and not in the lagna, ${
        d.ashtottari.applicable ? 'which is true in your chart' : 'which is not the case in your chart, so read it alongside Vimshottari'}.`,
    },
    kalachakra: {
      periods: d.kalachakra.periods.map(toDasha),
      note: `Signs instead of planets. Your Moon is in pada ${k.pada} of ${k.direction === 'savya' ? 'a savya (direct)' : 'an apasavya (reverse)'} nakshatra, which gives a cycle of ${k.paramayus} years with ${SIGN_NAME[k.deha - 1]} as deha (body) and ${SIGN_NAME[k.jeeva - 1]} as jeeva (life). Very sensitive to birth time.`,
    },
  };
}

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

const toDasha = (n: EngineDashaNode): DashaPeriod => ({
  lord: n.lord, start: n.start, end: n.end, sub: n.children?.map(toDasha),
  ...(n.name ? { name: n.name } : {}), ...(n.sign ? { sign: n.sign } : {}),
});

export function fromEngine(input: BirthInput, c: EngineChart): Chart {
  const planets: PlanetPosition[] = IDS.filter((id) => c.planets[id]).map((id) => {
    const p = c.planets[id]!;
    return {
      id, longitude: p.longitude, sign: p.sign, degreeInSign: p.degreeInSign,
      nakshatra: p.nakshatra, pada: p.pada, house: p.house,
      retrograde: p.retrograde, combust: p.combust, speed: p.speed,
    };
  });
  const vargas: Partial<Record<VargaId, VargaChart>> = {};
  for (const id of ALL_VARGAS) {
    const v = c.vargas?.[id];
    if (v) {
      const pl = {} as VargaChart['planets'];
      IDS.forEach((pid) => { const x = v.planets[pid]; if (x) pl[pid] = { sign: x.sign, house: x.house }; });
      vargas[id] = { id, ascSign: v.ascendant.sign, planets: pl };
    } else {
      vargas[id] = buildVarga(id, c.ascendant.longitude, planets);
    }
  }
  return {
    input,
    ascendant: {
      longitude: c.ascendant.longitude, sign: c.ascendant.sign, degreeInSign: c.ascendant.degreeInSign,
      nakshatra: c.ascendant.nakshatra, pada: c.ascendant.pada,
    },
    planets,
    vargas,
    dasha: c.dasha?.periods.map(toDasha),
    dashaSystems: otherDashas(c.dashas),
    meta: { ayanamsaValue: c.meta.ayanamsaValue, source: 'engine' },
  };
}
