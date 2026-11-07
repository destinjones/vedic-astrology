import type { BirthInput, Chart, DashaPeriod, PlanetId, PlanetPosition } from '../types/chart';
import { NAK_SPAN, NAKSHATRAS, PLANET_BY_ID } from '../data/constants';
import { houseOf, nakshatraOf, norm360, signOf } from '../lib/astro';
import { ALL_VARGAS, buildVarga } from '../lib/vargas';

/**
 * PREVIEW ONLY. Mean-motion approximation so the UI has something
 * realistic-looking to render before the real engine (Swiss Ephemeris)
 * is wired in. Do not use for actual readings.
 */

const DAY = 86400000;
const J2000 = Date.UTC(2000, 0, 1, 12);

/** offset in minutes of an IANA zone at a given UTC instant */
function zoneOffsetMinutes(zone: string, utcMs: number): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const parts = Object.fromEntries(dtf.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]));
    const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return Math.round((asUtc - utcMs) / 60000);
  } catch {
    return 0;
  }
}

export function localToUtc(input: BirthInput): number {
  const [y, mo, d] = input.date.split('-').map(Number);
  const [h, mi, s = 0] = input.time.split(':').map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi, s);
  let utc = naive - zoneOffsetMinutes(input.timezone, naive) * 60000;
  utc = naive - zoneOffsetMinutes(input.timezone, utc) * 60000;
  return utc;
}

const AYANAMSA_BASE: Record<BirthInput['ayanamsa'], number> = {
  lahiri: 23.853, raman: 22.41, krishnamurti: 23.758, true_chitra: 23.86,
};

export function mockChart(input: BirthInput): Chart {
  const utc = localToUtc(input);
  const d = (utc - J2000) / DAY;
  const ayan = AYANAMSA_BASE[input.ayanamsa] + (d / 365.25) * (50.29 / 3600);
  const sid = (tropical: number) => norm360(tropical - ayan);

  const sunT = 280.46 + 0.9856474 * d + 1.915 * Math.sin(((357.528 + 0.9856003 * d) * Math.PI) / 180);
  const sun = sid(sunT);
  const moon = sid(218.316 + 13.176396 * d + 6.289 * Math.sin(((134.963 + 13.064993 * d) * Math.PI) / 180));
  const mercury = norm360(sun + 22 * Math.sin((d / 115.88) * 2 * Math.PI));
  const venus = norm360(sun + 44 * Math.sin((d / 583.92) * 2 * Math.PI));
  const outer = (L0: number, rate: number, synodic: number, amp: number) =>
    sid(L0 + rate * d + amp * Math.sin((d / synodic) * 2 * Math.PI));
  const mars = outer(355.433, 0.524039, 779.94, 16);
  const jupiter = outer(34.35, 0.083091, 398.88, 10);
  const saturn = outer(50.08, 0.033459, 378.09, 6);
  const rahu = sid(125.04 - 0.052954 * d);
  const ketu = norm360(rahu + 180);

  // Ascendant: rough local sidereal time approach
  const gmst = norm360(280.46061837 + 360.98564736629 * d);
  const lst = norm360(gmst + input.longitude);
  const eps = (23.4393 * Math.PI) / 180;
  const ramc = (lst * Math.PI) / 180;
  const lat = (input.latitude * Math.PI) / 180;
  const ascT = norm360(
    (Math.atan2(Math.cos(ramc), -(Math.sin(ramc) * Math.cos(eps) + Math.tan(lat) * Math.sin(eps))) * 180) / Math.PI,
  );
  const ascLon = sid(ascT);
  const ascSign = signOf(ascLon);

  const synodicPhase = (period: number) => Math.cos((d / period) * 2 * Math.PI);
  const raw: [PlanetId, number, number][] = [
    ['sun', sun, 0.9856],
    ['moon', moon, 13.18],
    ['mars', mars, 0.52 + 0.9 * synodicPhase(779.94)],
    ['mercury', mercury, 1.2 + 2 * synodicPhase(115.88)],
    ['jupiter', jupiter, 0.083 + 0.2 * synodicPhase(398.88)],
    ['venus', venus, 1.0 + 1.4 * synodicPhase(583.92)],
    ['saturn', saturn, 0.034 + 0.1 * synodicPhase(378.09)],
    ['rahu', rahu, -0.053],
    ['ketu', ketu, -0.053],
  ];

  const COMBUST_ORB: Partial<Record<PlanetId, number>> = { moon: 12, mars: 17, mercury: 14, jupiter: 11, venus: 10, saturn: 15 };

  const planets: PlanetPosition[] = raw.map(([id, lon, speed]) => {
    const sign = signOf(lon);
    const { nakshatra, pada } = nakshatraOf(lon);
    const sep = Math.abs(((lon - sun + 540) % 360) - 180);
    const orb = COMBUST_ORB[id];
    return {
      id,
      longitude: lon,
      sign,
      degreeInSign: lon - (sign - 1) * 30,
      nakshatra,
      pada,
      house: houseOf(sign, ascSign),
      retrograde: id === 'rahu' || id === 'ketu' ? true : speed < 0,
      combust: orb !== undefined && sep < orb,
      speed,
    };
  });

  const ascNak = nakshatraOf(ascLon);
  const vargas = Object.fromEntries(ALL_VARGAS.map((v) => [v, buildVarga(v, ascLon, planets)]));

  return {
    input,
    ascendant: { longitude: ascLon, sign: ascSign, degreeInSign: ascLon - (ascSign - 1) * 30, ...ascNak },
    planets,
    vargas,
    dasha: vimshottari(moon, utc),
    meta: { ayanamsaValue: ayan, source: 'mock' },
  };
}

const ORDER: PlanetId[] = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];
const YEAR = 365.2425 * DAY;

export function vimshottari(moonLon: number, birthUtc: number): DashaPeriod[] {
  const n = Math.floor(norm360(moonLon) / NAK_SPAN);
  const lord = NAKSHATRAS[n].lord;
  const fracDone = (norm360(moonLon) - n * NAK_SPAN) / NAK_SPAN;
  let idx = ORDER.indexOf(lord);
  // start of the first mahadasha (before birth)
  let t = birthUtc - fracDone * PLANET_BY_ID[lord].dashaYears * YEAR;
  const out: DashaPeriod[] = [];
  for (let i = 0; i < 9; i++) {
    const L = ORDER[(idx + i) % 9];
    const len = PLANET_BY_ID[L].dashaYears * YEAR;
    const sub: DashaPeriod[] = [];
    let st = t;
    for (let j = 0; j < 9; j++) {
      const A = ORDER[(ORDER.indexOf(L) + j) % 9];
      const al = (len * PLANET_BY_ID[A].dashaYears) / 120;
      sub.push({ lord: A, start: new Date(st).toISOString(), end: new Date(st + al).toISOString() });
      st += al;
    }
    out.push({ lord: L, start: new Date(t).toISOString(), end: new Date(t + len).toISOString(), sub });
    t += len;
  }
  idx = 0;
  return out;
}
