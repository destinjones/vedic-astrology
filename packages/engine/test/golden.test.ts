/**
 * Golden-file chart fixtures. Each case below is computed and reduced to a
 * readable digest (positions at 4 decimals, signs, houses, nakshatras, varga
 * signs, dasha dates, panchanga, Shadbala), which must match the committed
 * file in test/fixtures/golden/ exactly. Any drift fails, so a refactor cannot
 * silently move a planet, a dasha date or a varga sign.
 *
 * When a change is meant to move the numbers (a bug fix, a new ephemeris),
 * regenerate and review the diff in the pull request:
 *
 *   UPDATE_GOLDEN=1 npx vitest run test/golden.test.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  GRAHAS,
  VARGA_IDS,
  createEngine,
  roundDegree,
  type BirthInput,
  type Chart,
  type ChartOptions,
  type Engine,
} from '../src/index';

interface GoldenCase {
  id: string;
  about: string;
  input: BirthInput;
  options?: ChartOptions;
}

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'gandhi-1869',
    about: 'Pre-standard-time LMT birth, Lahiri, the project reference chart',
    input: { date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } },
  },
  {
    id: 'delhi-1990-raman',
    about: 'Modern IST birth, Raman ayanamsa, true nodes',
    input: { date: '1990-08-15', time: '06:30', place: { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } },
    options: { ayanamsa: 'raman', nodeType: 'true' },
  },
  {
    id: 'santiago-2001-kp',
    about: 'Southern and western hemisphere, Krishnamurti ayanamsa, Placidus cusps, outer planets',
    input: { date: '2001-02-28', time: '23:59', place: { name: 'Santiago', latitude: -33.45, longitude: -70.66667, timezone: 'America/Santiago' } },
    options: { ayanamsa: 'krishnamurti', houseSystem: 'placidus', includeOuterPlanets: true },
  },
  {
    id: 'london-1944-war',
    about: 'British Double Summer Time',
    input: { date: '1944-06-06', time: '12:00', place: { name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' } },
  },
  {
    id: 'tromso-2010-polar',
    about: 'Above the Arctic Circle in midsummer: no sunrise, and the ascendant still resolves',
    input: { date: '2010-06-21', time: '00:30', place: { name: 'Tromsø', latitude: 69.6492, longitude: 18.9553, timezone: 'Europe/Oslo' } },
  },
  {
    id: 'atlanta-1929-manual-offset',
    about: 'Manual UTC offset overriding the zone',
    input: { date: '1929-01-15', time: '12:00', place: { name: 'Atlanta', latitude: 33.749, longitude: -84.388, timezone: 'America/New_York' }, utcOffsetMinutes: -360 },
  },
];

const r4 = (x: number) => roundDegree(x);
const r2 = (x: number) => Math.round(x * 100) / 100;

/** A readable, rounded summary of a chart. Stable key order. */
export function digest(c: Chart) {
  const planets = Object.fromEntries(
    Object.entries(c.planets).map(([id, p]) => [
      id,
      { lon: r4(p.longitude), sign: p.sign, house: p.house, nak: p.nakshatra, pada: p.pada, retro: p.retrograde, combust: p.combust ?? false },
    ]),
  );
  const vargas = Object.fromEntries(
    VARGA_IDS.map((v) => {
      const vc = c.vargas[v];
      if (!vc) return [v, null];
      return [v, [vc.ascendant.sign, ...GRAHAS.map((g) => vc.planets[g]?.sign ?? 0)].join(' ')];
    }),
  );
  const minute = (iso: string) => iso.slice(0, 16);
  return {
    meta: {
      utc: c.meta.utc,
      timezone: c.meta.timezone,
      utcOffsetMinutes: r4(c.meta.utcOffsetMinutes),
      localMeanTime: c.meta.localMeanTime,
      ayanamsa: c.meta.ayanamsa,
      ayanamsaValue: r4(c.meta.ayanamsaValue),
      houseSystem: c.meta.houseSystem,
      nodeType: c.meta.nodeType,
      timeWarnings: (c.meta.timeWarnings ?? []).map((w) => w.ref ?? w.code),
    },
    ascendant: { lon: r4(c.ascendant.longitude), sign: c.ascendant.sign, nak: c.ascendant.nakshatra, pada: c.ascendant.pada },
    midheaven: r4(c.midheaven.longitude),
    cusps: c.houses.map((h) => r4(h.cusp)),
    planets,
    vargas,
    dasha: c.dasha.periods.slice(0, 9).map((p) => `${p.lord} ${minute(p.start)}`),
    panchanga: {
      tithi: c.panchanga.tithi,
      vara: c.panchanga.vara,
      nakshatra: c.panchanga.nakshatra,
      yoga: c.panchanga.yoga,
      karana: c.panchanga.karana,
      sunrise: c.panchanga.sunrise ? minute(c.panchanga.sunrise) : null,
    },
    shadbala: c.strength
      ? Object.fromEntries(Object.entries(c.strength.shadbala.planets).map(([k, v]) => [k, r2(v.total)]))
      : null,
  };
}

export const hashOf = (d: unknown) => createHash('sha256').update(JSON.stringify(d)).digest('hex');

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});

const UPDATE = !!process.env.UPDATE_GOLDEN;

describe('golden charts', () => {
  for (const g of GOLDEN_CASES)
    it(`${g.id}: ${g.about}`, () => {
      const d = digest(engine.computeChart(g.input, g.options));
      const file = new URL(`./fixtures/golden/${g.id}.json`, import.meta.url);
      const body = { id: g.id, about: g.about, input: g.input, options: g.options ?? {}, sha256: hashOf(d), digest: d };
      if (UPDATE || !existsSync(file)) {
        writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
        if (!UPDATE) throw new Error(`Wrote missing golden file ${g.id}.json; commit it and re-run`);
        return;
      }
      const want = JSON.parse(readFileSync(file, 'utf8'));
      // the digest diff is what a reviewer reads; the hash catches anything the diff hides
      expect(d).toEqual(want.digest);
      expect(hashOf(d)).toBe(want.sha256);
    });
});
