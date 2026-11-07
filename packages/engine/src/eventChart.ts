/**
 * Event chart: a chart cast for the moment something happened (a wedding, an
 * accident, signing a contract, a company's founding), read on its own and
 * against a birth chart.
 *
 * Unlike a Prashna it is not a question, and unlike a birth chart it has no
 * dasha of its own that matters. What is read is the sky at that moment: its
 * lagna and Moon, and, against the natal chart, which natal house each planet
 * of the moment fell in, the exact contacts it made with natal points, and the
 * natal Vimshottari periods (down to sookshma) that were running.
 */
import { GRAHAS, PLANET_NAMES, SIGN_NAMES } from './constants';
import type { Engine } from './engine';
import { dashaAt, vimshottari } from './dasha';
import type { BirthInput, Chart, ChartOptions, GrahaId } from './types';

export type ContactKind = 'conjunction' | 'opposition' | 'square' | 'trine';

export interface EventContact {
  /** Planet of the event moment */
  planet: GrahaId;
  /** Natal point: a graha or 'asc' */
  natal: GrahaId | 'asc';
  kind: ContactKind;
  /** Exactness, degrees */
  orb: number;
}

export interface EventChartReading {
  chart: Chart;
  /** Present when a natal chart was given */
  natal?: {
    /** Natal house (whole sign from the natal lagna) of each event planet */
    houses: Record<GrahaId, number>;
    /** Natal house the event's lagna falls in */
    lagnaHouse: number;
    contacts: EventContact[];
    /** Natal Vimshottari periods at the event, maha down to sookshma */
    dasha: { lord: GrahaId; start: string; end: string }[];
    /** Age at the event, years */
    age: number;
  };
  summary: string;
}

const ASPECTS: [ContactKind, number, number][] = [
  ['conjunction', 0, 3],
  ['opposition', 180, 3],
  ['square', 90, 2],
  ['trine', 120, 2],
];

const sep = (a: number, b: number) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
};
const houseFrom = (lagnaSign: number, sign: number) => ((sign - lagnaSign + 12) % 12) + 1;

/** Contacts between two sets of longitudes, tightest first. */
export function contactsBetween(event: Record<GrahaId, number>, natal: Record<GrahaId | 'asc', number>): EventContact[] {
  const out: EventContact[] = [];
  for (const p of GRAHAS) {
    for (const n of [...GRAHAS, 'asc'] as (GrahaId | 'asc')[]) {
      // the nodes are always opposite each other: skip the trivial node–node contacts
      if ((p === 'rahu' || p === 'ketu') && (n === 'rahu' || n === 'ketu')) continue;
      const d = sep(event[p], natal[n]);
      for (const [kind, angle, orb] of ASPECTS) {
        const o = Math.abs(d - angle);
        if (o <= orb) out.push({ planet: p, natal: n, kind, orb: Math.round(o * 100) / 100 });
      }
    }
  }
  return out.sort((a, b) => a.orb - b.orb);
}

export function castEventChart(engine: Engine, event: BirthInput, natal?: Chart, opts: ChartOptions = {}): EventChartReading {
  const chart = engine.computeChart(event, { ayanamsa: natal?.meta.ayanamsa ?? opts.ayanamsa, nodeType: natal?.meta.nodeType ?? opts.nodeType, dashaLevels: 1, ...opts });
  const lagna = SIGN_NAMES[chart.ascendant.sign - 1];
  const moon = chart.planets.moon;
  let summary = `${lagna} rising, Moon in ${SIGN_NAMES[moon.sign - 1]} (${moon.nakshatraName} ${moon.pada}).`;
  if (!natal) return { chart, summary };

  const houses = {} as Record<GrahaId, number>;
  for (const g of GRAHAS) houses[g] = houseFrom(natal.ascendant.sign, chart.planets[g].sign);
  const lagnaHouse = houseFrom(natal.ascendant.sign, chart.ascendant.sign);
  const ev = {} as Record<GrahaId, number>;
  const na = {} as Record<GrahaId | 'asc', number>;
  for (const g of GRAHAS) { ev[g] = chart.planets[g].longitude; na[g] = natal.planets[g].longitude; }
  na.asc = natal.ascendant.longitude;
  const contacts = contactsBetween(ev, na);

  // natal dasha at the event, rebuilt to the sookshma for that one moment
  const eventJd = chart.meta.jdUt;
  const deep = vimshottari(natal.planets.moon.longitude, natal.meta.jdUt, { levels: 4, yearDays: natal.dasha.yearDays });
  const dasha = dashaAt(deep, eventJd).map((p) => ({ lord: p.lord, start: p.start, end: p.end }));
  const age = (eventJd - natal.meta.jdUt) / 365.2425;

  const tight = contacts.filter((c) => c.kind === 'conjunction' || c.kind === 'opposition').slice(0, 3)
    .map((c) => `${PLANET_NAMES[c.planet]} ${c.kind === 'conjunction' ? 'on' : 'opposite'} natal ${c.natal === 'asc' ? 'lagna' : PLANET_NAMES[c.natal]} (${c.orb.toFixed(1)}°)`);
  summary += ` The event lagna falls in the natal ${ordinal(lagnaHouse)} house, during ${dasha.map((d) => PLANET_NAMES[d.lord]).join('–')} periods.`;
  if (tight.length) summary += ` Tightest contacts: ${tight.join('; ')}.`;
  return { chart, natal: { houses, lagnaHouse, contacts, dasha, age }, summary };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
