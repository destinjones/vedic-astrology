import { describe, expect, it } from 'vitest';
import gaz from '../src/data/gazetteer.json';
import { parseGazetteer, searchPlacesIn } from '../src/lib/gazetteer';
import { normaliseDate, normaliseTime, parseAaf, parseAny, parseAstroDatabank, parseBulk, parseCsv, parseDegMin, parseJhd, profilesToAaf, profilesToCsv } from '../src/lib/interop';
import type { Profile } from '../src/lib/profiles';

const places = parseGazetteer(gaz as never);
const resolve = async (q: string) => searchPlacesIn(places, q, 1)[0] ?? null;

describe('offline gazetteer', () => {
  it('finds big cities first and narrows by country', () => {
    expect(searchPlacesIn(places, 'Mumbai')[0].name).toMatch(/^Mumbai, India/);
    expect(searchPlacesIn(places, 'Mumbai')[0].timezone).toBe('Asia/Kolkata');
    const london = searchPlacesIn(places, 'London, Canada')[0];
    expect(london.name).toMatch(/London.*Canada/);
    expect(london.timezone).toBe('America/Toronto');
  });
  it('searches former names under the modern one', () => {
    const r = searchPlacesIn(places, 'Madras')[0];
    expect(r.name).toMatch(/^Chennai/);
    expect(r.formerly).toBe('Madras');
  });
});

describe('formats', () => {
  it('reads degree-minute notation', () => {
    expect(parseDegMin('28n36')).toBeCloseTo(28.6, 6);
    expect(parseDegMin('0w10')).toBeCloseTo(-10 / 60, 6);
    expect(parseDegMin('33s52')).toBeCloseTo(-33.8667, 3);
  });
  it('normalises dates and times', () => {
    expect(normaliseDate('15.08.1990')).toBe('1990-08-15');
    expect(normaliseDate('2 October 1869')).toBe('1869-10-02');
    expect(normaliseTime('11:45 pm')).toBe('23:45');
    expect(normaliseTime('12:05 a.m.')).toBe('00:05');
  });
  it('reads a Jagannatha Hora file (east negative, H.MMSS)', () => {
    // a sample from the Astrosoft project: 17 April 1957, 7:10, IST, Erode
    const [d] = parseJhd('4\n17\n1957\n7.1000\n-5.30\n-77.44\n11.22\n', 'elango.jhd');
    expect(d.input).toMatchObject({ name: 'elango', date: '1957-04-17', time: '07:10:00', utcOffsetMinutes: 330, timezone: 'Asia/Kolkata' });
    expect(d.input!.longitude).toBeCloseTo(77 + 44 / 60, 6);
    expect(d.input!.latitude).toBeCloseTo(11 + 22 / 60, 6);
  });
  it('reads AAF record pairs', () => {
    const [d] = parseAaf('#A93:Gandhi,Mohandas,m,2.10.1869,7:12,Porbandar,IND\n#B93:2403972.0882,21n38,69e36,4he38,0');
    expect(d.input).toMatchObject({ name: 'Mohandas Gandhi', date: '1869-10-02', time: '07:12', timezone: 'Asia/Kolkata' });
    expect(d.input!.longitude).toBeCloseTo(69.6, 6);
  });
  it('reads text copied from an Astro-Databank page', () => {
    const [d] = parseAstroDatabank(`Name Gandhi, Mohandas Gender: M
      born on Saturday, 2 October 1869 at 07:12 (= 07:12 AM )
      Place Porbandar, India, 21n38, 69e36
      Timezone LMT m69e36 (is local mean time)
      Rodden Rating AA`);
    expect(d.input).toMatchObject({ date: '1869-10-02', time: '07:12', rodden: 'AA', utcOffsetMinutes: 278 });
    expect(d.input!.place).toMatch(/Porbandar/);
  });
  it('bulk paste: names, dates, times, places or coordinates', async () => {
    const drafts = await parseBulk(`Asha, 1990-08-15, 06:30, New Delhi
Ravi; 3/11/1985; 11:45 pm; 19.076, 72.8777; Asia/Kolkata
Nobody, sometime, nowhere`, resolve);
    expect(drafts[0].input).toMatchObject({ name: 'Asha', date: '1990-08-15', time: '06:30', timezone: 'Asia/Kolkata' });
    expect(drafts[1].input).toMatchObject({ name: 'Ravi', date: '1985-11-03', time: '23:45', latitude: 19.076, timezone: 'Asia/Kolkata' });
    expect(drafts[2].error).toBeTruthy();
  });
  it('CSV export reads back through the importer, and AAF too', async () => {
    const p: Profile = { id: '1', label: 'Asha, "A"', savedAt: '', updatedAt: '', input: { name: 'Asha Rao', date: '1990-08-15', time: '06:30', place: 'New Delhi, India', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri', rodden: 'A', timeConfidence: 'exact' } };
    const back = parseCsv(profilesToCsv([p]));
    expect(back[0].input).toEqual(p.input);
    const aaf = await parseAny(profilesToAaf([p]), 'x.aaf', resolve);
    expect(aaf[0].input).toMatchObject({ name: 'Asha Rao', date: '1990-08-15', time: '06:30' });
    expect(aaf[0].input!.latitude).toBeCloseTo(28.6139, 1);
  });
  it('neutralises spreadsheet formulas in CSV', () => {
    const p = { id: '1', label: '=HYPERLINK("x")', savedAt: '', updatedAt: '', input: { date: '1990-08-15', time: '06:30', place: 'x', latitude: 1, longitude: 1, timezone: 'UTC', ayanamsa: 'lahiri' as const } };
    expect(profilesToCsv([p]).split('\r\n')[1].startsWith(`"'=HYPERLINK`)).toBe(true);
  });
});
