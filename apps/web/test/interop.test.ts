import { describe, expect, it } from 'vitest';
import gaz from '../src/data/gazetteer.json';
import { parseGazetteer, searchPlacesIn } from '../src/lib/gazetteer';
import { normaliseDate, normaliseTime, parseAaf, parseAny, parseAstroDatabank, parseBulk, parseCsv, parseDegMin, parseJhd, parseQuickChart, profilesToAaf, profilesToCsv } from '../src/lib/interop';
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

import { parseAdbXml, parseAstrolog, parseIcs } from '../src/lib/interop';

describe('more formats', () => {
  it('reads an Astrolog chart info file (.as / .chtk), with its west-positive zone', () => {
    const [d] = parseAstrolog(`@AI800  ; Astrolog chart info.
/qb Nov 19 1971 11:01am ST +8:00 122:19:59W 47:36:35N
/zi "Walter D. Pullen" "Seattle, WA, USA"`, 'pullen.chtk');
    expect(d.input).toMatchObject({ name: 'Walter D. Pullen', date: '1971-11-19', time: '11:01', place: 'Seattle, WA, USA', utcOffsetMinutes: -480, timezone: 'America/Los_Angeles' });
    expect(d.input!.longitude).toBeCloseTo(-(122 + 19 / 60 + 59 / 3600), 6);
    expect(d.input!.latitude).toBeCloseTo(47 + 36 / 60 + 35 / 3600, 6);
    // daylight time adds an hour; a month number works too
    const [s] = parseAstrolog('@AI740\n/qb 7 4 1990 12:00 DT +5:00 74:00W 40:43N\n/zi "Someone" "New York"');
    expect(s.input).toMatchObject({ date: '1990-07-04', utcOffsetMinutes: -240 });
    expect(parseAstrolog('/qb Nov 19 1971 11:01am ST +8:00 122:19:59W 47:36:35N')[0].error).toMatch(/@AI/);
  });
  it('reads Astro-Databank XML, taking the offset from jd_ut and the Rodden rating', () => {
    const xml = `<?xml version="1.0"?><astrodatabank_export><adb_entry adb_id="1">
      <public_data><name>Gandhi, Mohandas</name><gender csex="m"/><roddenrating rrc="1">AA</roddenrating>
      <bdata><sbdate ccalendar="g" iyear="1869" imonth="10" iday="2">2 October 1869</sbdate>
      <sbtime ctimetype="l" jd_ut="2403971.606667" sznabbr="LMT">07:12</sbtime>
      <place slati="21n38" slong="69e36">Porbandar</place><country>India</country></bdata></public_data></adb_entry></astrodatabank_export>`;
    const [d] = parseAdbXml(xml);
    expect(d.input).toMatchObject({ name: 'Gandhi, Mohandas', date: '1869-10-02', time: '07:12', rodden: 'AA', place: 'Porbandar, India', utcOffsetMinutes: 278 });
  });
  it('reads iCalendar events, local, UTC and date-only', async () => {
    const drafts = await parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:Asha born
DTSTART;TZID=Asia/Kolkata:19900815T063000
LOCATION:New Delhi
END:VEVENT
BEGIN:VEVENT
SUMMARY:Ravi
DTSTART:19851103T181500Z
GEO:19.076;72.8777
END:VEVENT
BEGIN:VEVENT
SUMMARY:Grandad
DTSTART;VALUE=DATE:19400101
LOCATION:Mumbai
END:VEVENT
END:VCALENDAR`, resolve);
    expect(drafts[0].input).toMatchObject({ name: 'Asha born', date: '1990-08-15', time: '06:30', timezone: 'Asia/Kolkata' });
    expect(drafts[1].input).toMatchObject({ name: 'Ravi', date: '1985-11-03', time: '23:45:00', timezone: 'Asia/Kolkata' });
    expect(drafts[1].input!.utcOffsetMinutes).toBeUndefined();
    expect(drafts[2].input).toMatchObject({ date: '1940-01-01', timeConfidence: 'unknown' });
  });
  it('parseAny sniffs the new formats', async () => {
    expect((await parseAny('@AI800\n/qb Nov 19 1971 11:01am ST +8:00 122:19:59W 47:36:35N', 'x', resolve))[0].input?.date).toBe('1971-11-19');
    expect((await parseAny('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20000101T000000Z\nGEO:0;0\nEND:VEVENT\nEND:VCALENDAR', 'x.ics', resolve))[0].input).toBeTruthy();
  });
});

describe('Solar Fire formats', () => {
  const QCK = [
    "Stoppard,Miriam        MAY 12, 193705:00:00 AM BST-01:00001W35'00 54N59'00 Newcastle upon Tyne, Engla",
    "Roberts,Robin          NOV 23, 196010:30:00 AM CST+06:00089W14'51 30N18'56 Pass Christian, Mississipp",
  ].join('\r\n');
  it('reads Quick*Chart records by their fixed columns', async () => {
    const [a, b] = await parseAny(QCK, 'export.dat', async () => null);
    expect(a.input).toMatchObject({ name: 'Miriam Stoppard', date: '1937-05-12', time: '05:00:00', utcOffsetMinutes: 60, place: 'Newcastle upon Tyne, Engla' });
    expect(a.input!.longitude).toBeCloseTo(-(1 + 35 / 60), 6);
    expect(a.input!.latitude).toBeCloseTo(54 + 59 / 60, 6);
    expect(a.note).toMatch(/no Rodden rating/);
    expect(b.input).toMatchObject({ name: 'Robin Roberts', date: '1960-11-23', time: '10:30:00', utcOffsetMinutes: -360 });
    expect(b.input!.longitude).toBeCloseTo(-(89 + 14 / 60 + 51 / 3600), 6);
    expect(b.input!.latitude).toBeCloseTo(30 + 18 / 60 + 56 / 3600, 6);
  });
  it('one bad Quick*Chart line does not sink the rest', () => {
    const drafts = parseQuickChart(`${QCK}\r\nBroken,Line            XYZ 99, 19xx`);
    expect(drafts.filter((d) => d.input)).toHaveLength(2);
    expect(drafts[2].error).toBeTruthy();
  });
  it('reads the charts.txt text export, with ST, explicit offsets and comments', async () => {
    const seattle = { name: 'Seattle', latitude: 47.6062, longitude: -122.3321, timezone: 'America/Los_Angeles' };
    const resolve = async (q: string) => (/^seattle/i.test(q) ? seattle : null);
    const text = '\nWalter D. Pullen\nNov 19 1971 11:01 am ST\nSeattle, WA, USA\n\nSomeone Else\nJuly 4, 1980 3:15 pm -05:00\nSeattle, WA, USA\na comment line\n\nNowhere Person\nJan 1 1990 9:00 am ST\nAtlantis\n';
    const drafts = await parseAny(text, 'charts.txt', resolve);
    expect(drafts[0].input).toMatchObject({ name: 'Walter D. Pullen', date: '1971-11-19', time: '11:01', utcOffsetMinutes: -480, place: 'Seattle, WA, USA' });
    // July in Seattle is daylight time, but ST means standard: still UTC−8; an explicit -05:00 is west-positive, so UTC+5
    expect(drafts[1].input).toMatchObject({ date: '1980-07-04', time: '15:15', utcOffsetMinutes: 300 });
    expect(drafts[2].error).toMatch(/Atlantis/);
  });
});
