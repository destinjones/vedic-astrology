import { beforeAll, describe, expect, it } from 'vitest';
import {
  SBC_BOARD,
  createEngine,
  findMuhurtas,
  mukhaOf,
  bhadraLoka,
  panchangaDay,
  panchangaMonth,
  sarvatobhadra,
  sbcLines,
  sbcNakshatra,
  type Engine,
  type GrahaId,
} from '../src/index';

let engine: Engine;
beforeAll(async () => {
  engine = await createEngine();
});

const delhi = { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
const ist = (s?: string) => (s ? new Date(new Date(s).getTime() + 330 * 60000).toISOString().slice(11, 16) : '');

describe('panchangaDay', () => {
  it('gives the day periods and horas for a Monday in Delhi', () => {
    const d = panchangaDay(engine, '2026-11-09', delhi);
    expect(d.weekday).toBe(1);
    expect(d.dayLord).toBe('moon');
    expect(ist(d.sunrise) >= '06:30' && ist(d.sunrise) <= '06:45').toBe(true);
    // Monday: Rahu kalam is the 2nd eighth, Yamaganda the 4th, Gulika the 6th
    expect(ist(d.rahuKalam!.start) >= '07:55' && ist(d.rahuKalam!.start) <= '08:10').toBe(true);
    expect(d.yamaganda!.startJd).toBeCloseTo(d.sunrise ? d.rahuKalam!.startJd + 2 * (d.rahuKalam!.endJd - d.rahuKalam!.startJd) : 0, 6);
    expect(d.gulikaKalam!.startJd).toBeGreaterThan(d.yamaganda!.startJd);
    expect(d.abhijit).toBeDefined();
    expect(d.horas).toHaveLength(24);
    expect(d.horas.slice(0, 4).map((h) => h.lord)).toEqual(['moon', 'saturn', 'jupiter', 'mars']);
    expect(d.horas[12].startJd).toBeCloseTo(new Date(d.sunset!).getTime() / 86400000 + 2440587.5, 4);
  });
  it('finds the new Moon and the changes through the day', () => {
    const d = panchangaDay(engine, '2026-11-09', delhi);
    expect(d.atSunrise.tithiName).toBe('Amavasya');
    const t = d.changes.find((c) => c.limb === 'tithi')!;
    expect(t.value).toBe(1);
    // new Moon 9 Nov 2026 about 07:02 UT = 12:32 IST
    expect(ist(t.at) >= '12:20' && ist(t.at) <= '12:45').toBe(true);
    for (let i = 1; i < d.changes.length; i++) expect(d.changes[i].atJd).toBeGreaterThanOrEqual(d.changes[i - 1].atJd);
  });
  it('skips Abhijit on Wednesday and reports Chandrashtama spans', () => {
    const d = panchangaDay(engine, '2026-11-11', { ...delhi, natals: [{ moonNakshatra: 4, moonSign: 2 }] });
    expect(d.weekday).toBe(3);
    expect(d.abhijit).toBeUndefined();
    const m = panchangaMonth(engine, 2026, 11, { ...delhi, natals: [{ moonNakshatra: 4, moonSign: 2 }] });
    expect(m).toHaveLength(30);
    // the Moon passes Sagittarius (8th from Taurus) once a month
    expect(m.some((x) => x.personal[0].chandrashtama.length > 0)).toBe(true);
    expect(m.some((x) => x.bhadra.length > 0)).toBe(true);
  });
});

describe('Muhurta components', () => {
  it('classifies nakshatra mukha and Bhadra dwelling', () => {
    expect(mukhaOf(4)).toBe('urdhva');
    expect(mukhaOf(2)).toBe('adho');
    expect(mukhaOf(1)).toBe('tiryak');
    expect(bhadraLoka(4)).toBe('earth');
    expect(bhadraLoka(1)).toBe('heaven');
    expect(bhadraLoka(6)).toBe('netherworld');
  });
  it('checks both partners and blocks for either', () => {
    const r = findMuhurtas(engine, {
      ...delhi, activity: 'marriage', start: '2027-02-01T00:00:00Z', end: '2027-03-01T00:00:00Z', stepMinutes: 30,
      natals: [{ label: 'A', moonNakshatra: 4, moonSign: 2 }, { label: 'B', moonNakshatra: 17, moonSign: 8 }],
    });
    const w = r.windows[0];
    expect(w.state.personal).toHaveLength(2);
    expect(w.factors.some((f) => f.key === 'tara-0')).toBe(true);
    expect(w.factors.some((f) => f.key === 'tara-1')).toBe(true);
    // Chandrashtama for B (Moon in Gemini, 8th from Scorpio) blocks the window
    const gem = r.windows.filter((x) => x.state.moonSign === 3);
    expect(gem.length).toBeGreaterThan(0);
    expect(gem.every((x) => x.grade === 'avoid')).toBe(true);
    expect(r.best.every((x) => x.state.moonSign !== 3 && x.state.moonSign !== 9)).toBe(true);
  });
  it('closes weddings in Kharmas and adds panchaka rahita', () => {
    const r = findMuhurtas(engine, { ...delhi, activity: 'marriage', start: '2026-12-20T00:00:00Z', end: '2026-12-22T00:00:00Z' });
    expect(r.windows.every((w) => w.factors.some((f) => f.key === 'kharmas' && f.blocker))).toBe(true);
    expect(r.windows.every((w) => w.factors.some((f) => f.key === 'rahita'))).toBe(true);
  });
  it('applies disha shoola for travel', () => {
    // Monday spears the east
    const r = findMuhurtas(engine, { ...delhi, activity: 'travel', direction: 'east', start: '2026-11-09T02:00:00Z', end: '2026-11-09T10:00:00Z' });
    expect(r.windows.every((w) => w.state.weekday !== 1 || w.factors.some((f) => f.key === 'shoola'))).toBe(true);
  });
});

describe('Sarvatobhadra chakra', () => {
  const ends = (n: number) => Object.fromEntries(sbcLines(n).map((l) => [l.line, l.target]));
  it('places the 28 stars, 12 signs and 20 letters', () => {
    const cells = SBC_BOARD.flat();
    expect(cells.filter((c) => c.kind === 'nakshatra')).toHaveLength(28);
    expect(cells.filter((c) => c.kind === 'sign')).toHaveLength(12);
    expect(cells.filter((c) => c.kind === 'letter')).toHaveLength(20);
    expect(cells.filter((c) => c.kind === 'vowel')).toHaveLength(16);
    expect(cells.filter((c) => c.kind === 'tithi')).toHaveLength(5);
  });
  it('gives the classical vedhas', () => {
    expect(ends(3)).toEqual({ forward: 16, opposite: 22, backward: 2 }); // Krittika: Vishakha, Shravana, Bharani
    expect(ends(1)).toEqual({ forward: 4, opposite: 11, backward: 18 }); // Ashwini: Rohini, P.Phalguni, Jyeshtha
    expect(ends(15)).toEqual({ forward: 18, opposite: 24, backward: 4 }); // Swati: Jyeshtha, Shatabhisha, Rohini
    expect(ends(20)).toEqual({ forward: 26, opposite: 6, backward: 13 }); // P.Ashadha: U.Bhadra, Ardra, Hasta
  });
  it('knows Abhijit', () => {
    expect(sbcNakshatra(278)).toBe(28);
    expect(sbcNakshatra(275)).toBe(21);
    expect(sbcNakshatra(282)).toBe(22);
  });
  it('reports strikes on natal points', () => {
    const planets = {} as Record<GrahaId, { longitude: number; speed: number }>;
    for (const g of ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as GrahaId[]) planets[g] = { longitude: 100, speed: 1 };
    planets.saturn = { longitude: 30, speed: 0.05 }; // Krittika, direct: forward vedha to Vishakha
    const r = sarvatobhadra({ planets, natal: { moonNakshatra: 16, moonSign: 2, nameLetter: 'Ravi' } });
    const s = r.hits.filter((h) => h.planet === 'saturn' && h.point === 'janma_nakshatra');
    expect(s).toHaveLength(1);
    expect(s[0].line).toBe('forward');
    expect(s[0].primary).toBe(true);
    expect(r.natal.find((n) => n.key === 'name_letter')?.cells).toEqual([{ row: 5, col: 7 }]);
  });
});
