/**
 * Fuzzing the inputs a person (or a server) controls: the place parser, the
 * geocoder's handling of whatever the API returns, the time zone resolver and
 * the share-link decoder. The rule for each: never crash with anything but a
 * clear Error, and never hand back NaN or an out-of-range value.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeChartRequest, geocode, localToUtc, normalizePlaceName, placeAlias, timezoneAt } from '../src/index';

const RUNS = Number(process.env.FC_RUNS ?? 200);
const text = fc.oneof(fc.string({ maxLength: 60 }), fc.string({ unit: 'grapheme', maxLength: 40 }), fc.string({ unit: 'binary', maxLength: 40 }));

describe('place parser', () => {
  it('normalizePlaceName is total, idempotent and ASCII', () => {
    fc.assert(
      fc.property(text, (s) => {
        const n = normalizePlaceName(s);
        expect(normalizePlaceName(n)).toBe(n);
        expect(/^[a-z0-9 ]*$/.test(n)).toBe(true);
        expect(n).toBe(n.trim());
      }),
      { numRuns: RUNS },
    );
  });

  it('placeAlias never throws and only returns known aliases', () => {
    fc.assert(
      fc.property(text, (s) => {
        const a = placeAlias(s);
        if (a) expect(typeof a.modern === 'string' && a.modern.length > 0).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });

  it('geocode survives any API response and returns only real coordinates', async () => {
    const junk = fc.oneof(
      fc.constant(null),
      fc.string(),
      fc.double(),
      fc.boolean(),
      fc.record({ results: fc.array(fc.dictionary(fc.constantFrom('name', 'latitude', 'longitude', 'country', 'admin1', 'timezone'), fc.oneof(fc.string(), fc.double(), fc.constant(null)))) }),
      fc.array(fc.dictionary(fc.constantFrom('display_name', 'lat', 'lon'), fc.oneof(fc.string(), fc.double()))),
    );
    await fc.assert(
      fc.asyncProperty(text, junk, fc.boolean(), fc.boolean(), async (q, body, okStatus, nominatim) => {
        const fakeFetch = (async () => ({ ok: okStatus, status: okStatus ? 200 : 500, json: async () => body })) as unknown as typeof fetch;
        let out;
        try {
          out = await geocode(q, { fetch: fakeFetch, nominatimFallback: nominatim });
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
          return;
        }
        expect(Array.isArray(out)).toBe(true);
        for (const r of out) {
          expect(Number.isFinite(r.latitude) && Math.abs(r.latitude) <= 90).toBe(true);
          expect(Number.isFinite(r.longitude) && Math.abs(r.longitude) <= 180).toBe(true);
          expect(typeof r.name).toBe('string');
          expect(typeof r.timezone).toBe('string');
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe('time zone resolver', () => {
  const zones = Intl.supportedValuesOf('timeZone');
  it('timezoneAt returns a real zone for every coordinate', () => {
    fc.assert(
      fc.property(fc.double({ min: -90, max: 90, noNaN: true }), fc.double({ min: -180, max: 180, noNaN: true }), (lat, lon) => {
        const z = timezoneAt(lat, lon);
        expect(() => new Intl.DateTimeFormat('en', { timeZone: z })).not.toThrow();
      }),
      { numRuns: RUNS },
    );
  });

  it('localToUtc on well-formed input gives a finite instant and a sane offset', () => {
    const pad = (n: number, w = 2) => String(n).padStart(w, '0');
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 9999 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.integer({ min: 0, max: 23 }),
        fc.integer({ min: 0, max: 59 }),
        fc.constantFrom(...zones),
        fc.option(fc.double({ min: -180, max: 180, noNaN: true }), { nil: undefined }),
        (y, mo, d, h, mi, zone, lon) => {
          const r = localToUtc(`${pad(y, 4)}-${pad(mo)}-${pad(d)}`, `${pad(h)}:${pad(mi)}`, zone, undefined, lon, 0);
          expect(Number.isFinite(r.utc.getTime())).toBe(true);
          expect(Number.isFinite(r.utcOffsetMinutes)).toBe(true);
          expect(Math.abs(r.utcOffsetMinutes)).toBeLessThanOrEqual(16 * 60);
          for (const w of r.warnings) expect(w.message.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: RUNS },
    );
  });

  it('localToUtc on garbage throws an Error, never returns NaN', () => {
    fc.assert(
      fc.property(text, text, fc.oneof(text, fc.constantFrom(...zones.slice(0, 50))), (date, time, zone) => {
        try {
          const r = localToUtc(date, time, zone);
          expect(Number.isFinite(r.utc.getTime())).toBe(true);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
        }
      }),
      { numRuns: RUNS },
    );
  });
});

describe('share-link decoder', () => {
  const keys = fc.constantFrom('v', 'n', 'd', 't', 'p', 'lat', 'lon', 'tz', 'off', 'ay', 'c', 'x');
  const values = fc.oneof(text, fc.double().map(String), fc.constantFrom('1', '0', '99', 'UTC', 'Asia/Kolkata', '2000-01-01', '12:00', 'lahiri'));
  it('never throws, and anything it accepts is valid', () => {
    fc.assert(
      fc.property(fc.oneof(text, fc.array(fc.tuple(keys, values), { maxLength: 12 }).map((kv) => '#' + new URLSearchParams(kv).toString())), (hash) => {
        const r = decodeChartRequest(hash);
        if (!r.ok) {
          expect(['not_a_chart', 'too_new', 'invalid']).toContain(r.reason);
          return;
        }
        const { place } = r.request;
        expect(Number.isFinite(place.latitude) && Math.abs(place.latitude) <= 90).toBe(true);
        expect(Number.isFinite(place.longitude) && Math.abs(place.longitude) <= 180).toBe(true);
        expect(() => localToUtc(r.request.date, r.request.time, place.timezone, r.request.utcOffsetMinutes)).not.toThrow();
      }),
      { numRuns: RUNS * 5 },
    );
  });
});
