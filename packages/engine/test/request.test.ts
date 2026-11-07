import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CHART_REQUEST_VERSION,
  MIGRATIONS,
  chartRequestFromJson,
  chartRequestToEngine,
  chartRequestToJson,
  decodeChartRequest,
  encodeChartRequest,
  type ChartRequest,
} from '../src/request';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/share-links.json', import.meta.url), 'utf8')) as {
  links: { id: string; version: number; hash: string; expect: Omit<ChartRequest, 'v'> }[];
  compare: { id: string; version: number; hash: string; expectNames: string[] }[];
};

const ok = (r: ReturnType<typeof decodeChartRequest>) => {
  if (!r.ok) throw new Error(`${r.reason}: ${r.message}`);
  return r;
};

describe('share links already in the wild still open', () => {
  for (const f of fixtures.links)
    it(f.id, () => {
      const r = ok(decodeChartRequest(f.hash));
      expect(r.fromVersion).toBe(f.version);
      expect(r.warnings).toEqual([]);
      expect(r.request).toEqual({ v: CHART_REQUEST_VERSION, ...f.expect });
    });

  for (const f of fixtures.compare)
    it(f.id, () => {
      const q = new URLSearchParams(f.hash.slice(1));
      const names = q.getAll('c').map((c) => ok(decodeChartRequest(c)).request.name);
      expect(names).toEqual(f.expectNames);
    });

  it('every version from 0 to the current one has a fixture', () => {
    const seen = new Set(fixtures.links.map((f) => f.version));
    for (let v = 0; v <= CHART_REQUEST_VERSION; v++) expect(seen, `no fixture for format ${v}`).toContain(v);
  });

  it('every older version has a migration', () => {
    for (let v = 0; v < CHART_REQUEST_VERSION; v++) expect(MIGRATIONS[v], `no migration from ${v}`).toBeTypeOf('function');
  });
});

describe('encodeChartRequest', () => {
  it('writes the version first and round-trips every fixture', () => {
    for (const f of fixtures.links) {
      const req = ok(decodeChartRequest(f.hash)).request;
      const enc = encodeChartRequest(req);
      expect(enc.startsWith(`v=${CHART_REQUEST_VERSION}&`)).toBe(true);
      expect(ok(decodeChartRequest(enc)).request).toEqual(req);
      expect(ok(decodeChartRequest('#' + enc)).fromVersion).toBe(CHART_REQUEST_VERSION);
    }
  });

  it('can leave the name out', () => {
    const req = ok(decodeChartRequest(fixtures.links[0].hash)).request;
    expect(new URLSearchParams(encodeChartRequest(req, { includeName: false })).has('n')).toBe(false);
  });

  it('keeps links short: default ayanamsa and missing offset are omitted', () => {
    const enc = encodeChartRequest({
      v: 1, date: '2000-01-01', time: '00:00', place: { latitude: 0, longitude: 0, timezone: 'UTC' }, ayanamsa: 'lahiri',
    });
    expect(enc).toBe('v=1&d=2000-01-01&t=00%3A00&lat=0&lon=0&tz=UTC');
  });
});

describe('decodeChartRequest refuses what it cannot read', () => {
  it('ignores other hash routes', () => {
    for (const h of ['', '#', '#sample', '#famous=gandhi', '#timing', '#c=abc'])
      expect(decodeChartRequest(h)).toMatchObject({ ok: false, reason: 'not_a_chart' });
  });

  it('says a link from a newer app is too new instead of half-reading it', () => {
    const r = decodeChartRequest('#v=99&d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC');
    expect(r).toMatchObject({ ok: false, reason: 'too_new', fromVersion: 99 });
  });

  it.each([
    ['bad version', '#v=one&d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC'],
    ['bad date', '#d=2000-13-01&t=00:00&lat=0&lon=0&tz=UTC'],
    ['bad time', '#d=2000-01-01&t=24:00&lat=0&lon=0&tz=UTC'],
    ['bad lat', '#d=2000-01-01&t=00:00&lat=91&lon=0&tz=UTC'],
    ['missing lon', '#d=2000-01-01&t=00:00&lat=0&tz=UTC'],
    ['bad zone', '#d=2000-01-01&t=00:00&lat=0&lon=0&tz=Mars%2FOlympus'],
    ['bad offset', '#v=1&d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC&off=99999'],
    ['NaN offset', '#v=1&d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC&off=abc'],
  ])('%s', (_, h) => {
    expect(decodeChartRequest(h)).toMatchObject({ ok: false, reason: 'invalid' });
  });

  it('keeps the chart but warns on an unknown ayanamsa', () => {
    const r = ok(decodeChartRequest('#d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC&ay=lahiri2'));
    expect(r.request.ayanamsa).toBe('lahiri');
    expect(r.warnings[0]).toMatch(/unknown ayanamsa/);
  });

  it('caps the name and place length', () => {
    const r = ok(decodeChartRequest(`#n=${'x'.repeat(500)}&p=${'y'.repeat(500)}&d=2000-01-01&t=00:00&lat=0&lon=0&tz=UTC`));
    expect(r.request.name).toHaveLength(80);
    expect(r.request.place.name).toHaveLength(200);
  });
});

describe('JSON form', () => {
  const req: ChartRequest = {
    v: 1, name: 'A', date: '1990-08-15', time: '06:30',
    place: { name: 'Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' }, utcOffsetMinutes: 330, ayanamsa: 'raman',
  };
  it('round-trips', () => {
    const r = chartRequestFromJson(JSON.parse(JSON.stringify(chartRequestToJson(req))));
    expect(r).toMatchObject({ ok: true, request: req, fromVersion: 1 });
  });
  it('reads an object with no version as format 0', () => {
    const { v: _v, ...old } = req;
    expect(chartRequestFromJson(old)).toMatchObject({ ok: true, fromVersion: 0, request: req });
  });
  it('refuses newer and malformed versions', () => {
    expect(chartRequestFromJson({ ...req, v: 7 })).toMatchObject({ ok: false, reason: 'too_new' });
    expect(chartRequestFromJson({ ...req, v: '1' })).toMatchObject({ ok: false, reason: 'invalid' });
    expect(chartRequestFromJson(null)).toMatchObject({ ok: false, reason: 'not_a_chart' });
  });
  it('maps to engine arguments', () => {
    expect(chartRequestToEngine(req)).toEqual({
      input: { name: 'A', date: '1990-08-15', time: '06:30', place: req.place, utcOffsetMinutes: 330 },
      options: { ayanamsa: 'raman' },
    });
  });
});

describe('optional calendar, Rodden rating and time confidence', () => {
  it('travel in a v1 link and come back', () => {
    const r = decodeChartRequest('v=1&d=1642-12-25&t=01:38&lat=52.80&lon=-0.63&tz=Europe%2FLondon&cal=julian&rr=AA&tc=exact');
    expect(r).toMatchObject({ ok: true, request: { calendar: 'julian', rodden: 'AA', timeConfidence: 'exact' } });
    if (!r.ok) return;
    const again = decodeChartRequest(encodeChartRequest(r.request));
    expect(again).toMatchObject({ ok: true, request: r.request });
    expect(chartRequestToEngine(r.request).input.calendar).toBe('julian');
  });
  it('drops an unknown calendar with a warning', () => {
    const r = decodeChartRequest('v=1&d=1990-08-15&t=06:30&lat=28.6&lon=77.2&tz=Asia%2FKolkata&cal=mayan');
    expect(r).toMatchObject({ ok: true });
    if (r.ok) {
      expect(r.request.calendar).toBeUndefined();
      expect(r.warnings.join(' ')).toMatch(/calendar/);
    }
  });
});
