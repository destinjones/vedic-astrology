import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type BirthInput, type Chart, type Engine } from '@vedic/engine';
import { fromEngineChart, interpretChart, type ChartInterpretation } from '@vedic/interpretations';
import {
  ayanamsaDiff,
  capsuleRecord,
  capsuleState,
  chartRarity,
  chartStory,
  controlBirth,
  countdownFrom,
  findingsOf,
  foldLine,
  openCapsule,
  panchangaDays,
  panchangaIcs,
  parseCapsules,
  posterSvg,
  randomBirth,
  RARITY,
  rarityOf,
  rarityScore,
  sadeSatiCountdown,
  scoreCapsule,
  scorePercentile,
  sealCapsule,
  tarabala,
  tithiOf,
  todayBrief,
  verifyCapsule,
  viewFindings,
  yogaLevel,
} from '../src';

let engine: Engine;
const DELHI = { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
const SAMPLE: BirthInput = { date: '1990-08-15', time: '06:30', place: DELHI, name: 'Sample' };
let chart: Chart;
let report: ChartInterpretation;

beforeAll(async () => {
  engine = await createEngine();
  chart = engine.computeChart(SAMPLE, { dashaLevels: 2 });
  report = interpretChart(fromEngineChart(chart));
});

/** First date from `start` whose Moon is in `sign` (1–12). */
function birthWithMoonIn(sign: number, start = '1990-01-01'): Chart {
  const t0 = Date.parse(start + 'T00:00:00Z');
  for (let d = 0; d < 40; d++) {
    const date = new Date(t0 + d * 86_400_000).toISOString().slice(0, 10);
    const c = engine.computeChart({ date, time: '12:00', place: DELHI }, { dashaLevels: 1, strength: false });
    if (c.planets.moon.sign === sign && c.planets.moon.degreeInSign > 5 && c.planets.moon.degreeInSign < 25) return c;
  }
  throw new Error('no such day');
}

describe('today brief', () => {
  it('counts tara from the birth star', () => {
    expect(tarabala(4, 4).name).toBe('Janma');
    expect(tarabala(4, 5).name).toBe('Sampat');
    expect(tarabala(4, 10).number).toBe(7);
    expect(tarabala(4, 10).quality).toBe('hard');
    expect(tarabala(27, 1).name).toBe('Sampat');
    expect(tarabala(1, 10).name).toBe('Janma'); // the 10th star starts the second round of nine
    expect(tarabala(1, 13).name).toBe('Kshema');
    expect(tarabala(1, 18).name).toBe('Parama Mitra');
  });

  it('works out tithi the way the engine does', () => {
    expect(tithiOf(0, 0).number).toBe(1);
    expect(tithiOf(0, 179).name).toBe('Purnima');
    expect(tithiOf(0, 359).name).toBe('Amavasya');
    expect(tithiOf(10, 0).paksha).toBe('krishna');
    const t = tithiOf(chart.planets.sun.longitude, chart.planets.moon.longitude);
    expect(t.number).toBe(chart.panchanga.tithi);
    expect(t.name).toBe(chart.panchanga.tithiName);
  });

  it('flags Chandrashtama when the Moon is 8th from the birth Moon', () => {
    // find a moment in the next month when the transit Moon is in the 8th from the natal Moon
    const start = Date.parse('2026-11-01T00:00:00Z');
    let seen = { on: false, off: false };
    for (let h = 0; h < 30 * 24; h += 6) {
      const b = todayBrief(engine, chart, new Date(start + h * 3_600_000));
      if (b.moon.houseFromMoon === 8) {
        seen.on = true;
        expect(b.chandrashtama.active).toBe(true);
        expect(b.overall).toBe('careful');
        expect(Date.parse(b.chandrashtama.endsAt!)).toBeLessThan(start + h * 3_600_000 + 3 * 86_400_000);
      } else {
        seen.off = true;
        expect(b.chandrashtama.active).toBe(false);
        expect(Date.parse(b.chandrashtama.nextAt!)).toBeLessThan(start + h * 3_600_000 + 29 * 86_400_000);
      }
      expect(b.moonLine.length).toBeGreaterThan(20);
    }
    expect(seen).toEqual({ on: true, off: true });
  });
});

describe('Sade Sati countdown', () => {
  it('ends on 2025-03-29 for a Capricorn Moon, when Saturn entered sidereal Pisces', () => {
    const c = birthWithMoonIn(10);
    const s = sadeSatiCountdown(engine, c, new Date('2024-06-01T00:00:00Z'))!;
    expect(s.state).toBe('in');
    expect(s.spell.end.slice(0, 10)).toBe('2025-03-29');
    expect(s.phase?.kind).toBe('sade-sati-setting');
    expect(s.days).toBeGreaterThan(290);
    expect(s.days).toBeLessThan(310);
    expect(s.headline).toContain('2025-03-29');
  });

  it('counts down to the next one when you are not in it', () => {
    const c = birthWithMoonIn(10);
    const s = sadeSatiCountdown(engine, c, new Date('2026-01-01T00:00:00Z'))!;
    expect(s.state).toBe('upcoming');
    expect(s.progress).toBe(0);
    expect(s.previousEnd?.slice(0, 10)).toBe('2025-03-29');
    // the next one starts ~27 years after the last one began (Saturn's cycle is ~29.5 years)
    expect(new Date(s.spell.start).getUTCFullYear()).toBeGreaterThanOrEqual(2046);
    expect(s.headline).toMatch(/not in Sade Sati/);
  });

  it('picks the current spell from a list', () => {
    const mk = (a: string, b: string) => ({ start: new Date(a), end: new Date(b), phases: [], bindus: [3, 4, 5], severity: { score: 50, tone: 'mixed' as const, reasons: [] } });
    const list = [mk('2000-01-01', '2007-06-01'), mk('2030-01-01', '2037-06-01')];
    expect(countdownFrom(list, new Date('2005-01-01'))?.state).toBe('in');
    expect(countdownFrom(list, new Date('2010-01-01'))?.state).toBe('upcoming');
    expect(countdownFrom(list, new Date('2040-01-01'))).toBeNull();
  });
});

describe('ayanamsa diff', () => {
  it('shifts every body by the same arcminutes', () => {
    const d = ayanamsaDiff(engine, SAMPLE);
    expect(d.ayanamsas).toEqual(['lahiri', 'true_chitra', 'raman', 'krishnamurti']);
    for (const a of d.ayanamsas) {
      const deltas = d.rows.map((r) => r.cells[a].deltaArcmin);
      for (const x of deltas) expect(Math.abs(x - deltas[0])).toBeLessThan(0.05);
      // and the shift is the difference between the ayanamsa values (sidereal = tropical - ayanamsa)
      expect(Math.abs(deltas[0] + d.values[a].deltaArcmin)).toBeLessThan(0.05);
    }
    expect(d.rows[0].cells.lahiri.deltaArcmin).toBe(0);
    // Raman is about 1°27' behind Lahiri, KP about 6' ahead in 1990
    expect(d.values.raman.deltaArcmin).toBeLessThan(-80);
    expect(Math.abs(d.values.krishnamurti.deltaArcmin)).toBeLessThan(10);
    expect(d.notes.length).toBeGreaterThan(0);
  });

  it('notices placements that cross a boundary and dasha dates that move', () => {
    const d = ayanamsaDiff(engine, SAMPLE);
    const crossing = d.rows.filter((r) => r.cells.raman.changes.pada);
    for (const r of crossing) expect(r.differs).toBe(true);
    // 1.45° of the Moon is ~1/9 of a nakshatra, worth roughly 1-2 years of the first dasha
    expect(Math.abs(d.dasha.raman.shiftDays)).toBeGreaterThan(100);
  });
});

describe('severity and beginner mode', () => {
  it('levels yogas by category, strength and rarity', () => {
    expect(yogaLevel({ category: 'mahapurusha', strength: 'strong' })).toBe(1);
    expect(yogaLevel({ category: 'raja', strength: 'strong' }, 0.86)).toBe(2);
    expect(yogaLevel({ category: 'lunar', strength: 'strong' })).toBe(2);
    expect(yogaLevel({ category: 'lunar', strength: 'moderate' }, 0.01)).toBe(2);
    expect(yogaLevel({ category: 'other', strength: 'weak' })).toBe(3);
  });

  it('orders findings headline first and hides afflictions for beginners', () => {
    const f = findingsOf(report);
    for (let i = 1; i < f.length; i++) expect(f[i].level).toBeGreaterThanOrEqual(f[i - 1].level);
    const full = viewFindings(f, { beginner: false });
    expect(full.yogas.length + full.doshas.length).toBe(f.length);
    const easy = viewFindings(f, { beginner: true, cap: 3 });
    expect(easy.doshas).toEqual([]);
    expect(easy.yogas.length).toBeLessThanOrEqual(3);
    expect(easy.yogas.every((y) => !y.difficult)).toBe(true);
    expect(easy.hidden.doshas).toBe(full.doshas.length);
    expect(easy.yogas.length + easy.hidden.yogas).toBe(full.yogas.length);
    expect(new Set(f.map((x) => x.key)).size).toBe(f.length);
  });
});

describe('rarity', () => {
  it('ships a table built from 10,000 charts', () => {
    expect(RARITY.charts).toBe(10_000);
    expect(RARITY.scoreQuantiles).toHaveLength(101);
    for (let i = 1; i < 101; i++) expect(RARITY.scoreQuantiles[i]).toBeGreaterThanOrEqual(RARITY.scoreQuantiles[i - 1]);
    // raja yoga in some form is found in most charts; kemadruma is rare
    expect(rarityOf('yoga', 'raja')!.frequency).toBeGreaterThan(0.5);
    expect(rarityOf('dosha', 'kemadruma')!.band).toMatch(/rare/);
    expect(rarityOf('yoga', 'no-such-yoga')).toBeNull();
  });

  it('turns a chart into a percentile', () => {
    expect(scorePercentile(-1)).toBe(0);
    expect(scorePercentile(1e9)).toBe(100);
    expect(scorePercentile(RARITY.scoreQuantiles[50])).toBeGreaterThanOrEqual(45);
    expect(scorePercentile(RARITY.scoreQuantiles[50])).toBeLessThanOrEqual(55);
    expect(rarityScore(['sankhya-yuga'])).toBeGreaterThan(rarityScore(['raja']));
    const r = chartRarity(report);
    expect(r.percentile).toBeGreaterThanOrEqual(0);
    expect(r.percentile).toBeLessThanOrEqual(100);
    expect(r.headline).toMatch(/random charts/);
  });

  it('samples random births deterministically', () => {
    expect(randomBirth(1, 5)).toEqual(randomBirth(1, 5));
    expect(randomBirth(1, 5)).not.toEqual(randomBirth(1, 6));
    for (let i = 0; i < 200; i++) {
      const b = randomBirth(7, i);
      expect(b.place.latitude).toBeGreaterThanOrEqual(-55);
      expect(b.place.latitude).toBeLessThanOrEqual(65);
      expect(b.date >= '1930-01-01' && b.date < '2016-01-01').toBe(true);
    }
  });

  it('the table matches a fresh sample of the same seed', () => {
    // re-cast the first 200 charts of the shipped sample and check counts are consistent
    let raja = 0;
    for (let i = 0; i < 200; i++) {
      const c = engine.computeChart(randomBirth(RARITY.seed, i), { dashaLevels: 1, strength: false });
      if (interpretChart(fromEngineChart(c)).yogas.some((y) => y.id === 'raja')) raja++;
    }
    expect(Math.abs(raja / 200 - rarityOf('yoga', 'raja')!.frequency)).toBeLessThan(0.08);
  });
});

describe('control chart', () => {
  it('keeps the place, moves the moment, and is stable', () => {
    const input = { date: '1990-08-15', time: '06:30', place: 'Delhi', latitude: 28.6, longitude: 77.2 };
    const c = controlBirth(input);
    expect(c).toEqual(controlBirth(input));
    expect(c.place).toBe('Delhi');
    expect(c.latitude).toBe(28.6);
    const years = Math.abs(Date.parse(c.date) - Date.parse(input.date)) / (365.25 * 86_400_000);
    expect(years).toBeGreaterThanOrEqual(2.9);
    expect(years).toBeLessThanOrEqual(15.1);
    expect(c.time).toMatch(/^\d{2}:\d{2}$/);
    expect(controlBirth(input, 'again')).not.toEqual(c);
  });
});

describe('chart story', () => {
  it('tells the chart in order, starting with the rising sign', () => {
    const s = chartStory(chart, report, new Date('2026-11-07T00:00:00Z'));
    expect(s[0].id).toBe('rising');
    expect(s[0].title).toContain(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'][chart.ascendant.sign - 1]);
    expect(s.map((c) => c.id)).toContain('mind');
    expect(s.map((c) => c.id)).toContain('now');
    expect(s[s.length - 1].id).toBe('end');
    for (const c of s) {
      expect(c.paragraphs.length).toBeGreaterThan(0);
      for (const p of c.paragraphs) expect(p).not.toMatch(/undefined|NaN|\[object/);
    }
  });
});

describe('time capsule', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  it('seals, verifies and detects tampering', async () => {
    const c = await sealCapsule({ chartKey: 'k', label: 'Me', prediction: 'A move abroad before next autumn.', now });
    expect(c.seal).toMatch(/^[0-9a-f]{64}$/);
    expect(c.opensAt.slice(0, 10)).toBe('2027-11-07');
    expect(await verifyCapsule(c)).toBe(true);
    expect(await verifyCapsule({ ...c, prediction: 'Something I knew afterwards.' })).toBe(false);
    expect(await verifyCapsule({ ...c, opensAt: '2026-12-01T00:00:00.000Z' })).toBe(false);
    await expect(sealCapsule({ chartKey: 'k', label: '', prediction: '  ', now })).rejects.toThrow();
    await expect(sealCapsule({ chartKey: 'k', label: '', prediction: 'x', now, opensAt: new Date('2020-01-01') })).rejects.toThrow();
  });

  it('moves from sealed to ready to scored', async () => {
    const c = await sealCapsule({ chartKey: 'k', label: 'Me', prediction: 'p', now, opensAt: new Date('2027-01-01') });
    expect(capsuleState(c, now)).toBe('sealed');
    expect(capsuleState(c, new Date('2027-01-02'))).toBe('ready');
    const early = openCapsule(c, now);
    expect(early.openedEarly).toBe(true);
    expect(capsuleState(early, now)).toBe('open');
    const s = scoreCapsule(c, 3, 'close enough', new Date('2027-01-05'));
    expect(capsuleState(s)).toBe('scored');
    expect(s.openedEarly).toBe(false);
    expect(await verifyCapsule(s)).toBe(true); // scoring does not break the seal
    expect(capsuleRecord([s, c])).toEqual({ scored: 1, percent: 75, onTime: 1 });
    expect(parseCapsules([s, { v: 2 }, null, { ...c, score: 9 }])).toEqual([s]);
  });
});

describe('poster', () => {
  it('is drawn from the chart and only from the chart', () => {
    const a = posterSvg(chart, { title: 'Sample' });
    expect(a).toBe(posterSvg(chart, { title: 'Sample' }));
    expect(a.startsWith('<svg')).toBe(true);
    expect(a).toContain('Sample');
    const later = engine.computeChart({ ...SAMPLE, time: '06:34' }, { dashaLevels: 1, strength: false });
    expect(posterSvg(later, { title: 'Sample' })).not.toBe(a);
    expect(a).not.toContain('1990-08-15');
    expect(posterSvg(chart, { showBirthData: true })).toContain('1990-08-15');
    expect(posterSvg(chart, { title: '<script>' })).not.toContain('<script>');
    expect(a).not.toMatch(/NaN|undefined/);
  });
});

describe('panchanga calendar', () => {
  it('lists each local day at sunrise', () => {
    const days = panchangaDays(engine, { place: DELHI, from: new Date('2026-11-01T12:00:00Z'), days: 60, natalMoon: chart.planets.moon.longitude });
    expect(days).toHaveLength(60);
    expect(days[0].date).toBe('2026-11-01');
    expect(days[59].date).toBe('2026-12-30');
    for (const d of days) {
      expect(d.sunriseLocal >= '06:00' && d.sunriseLocal <= '07:30').toBe(true);
      expect(d.personal).toBeDefined();
    }
    const purnima = days.filter((d) => d.observance === 'Purnima').length;
    const ekadashi = days.filter((d) => d.observance === 'Ekadashi').length;
    expect(purnima).toBeGreaterThanOrEqual(1);
    expect(purnima).toBeLessThanOrEqual(3);
    expect(ekadashi).toBeGreaterThanOrEqual(3);
    // Chandrashtama comes round every month for two or three days
    const ca = days.filter((d) => d.personal!.chandrashtama).length;
    expect(ca).toBeGreaterThanOrEqual(3);
    expect(ca).toBeLessThanOrEqual(8);
  });

  it('writes a valid iCalendar feed', () => {
    const days = panchangaDays(engine, { place: DELHI, from: new Date('2026-11-01T12:00:00Z'), days: 30 });
    const ics = panchangaIcs(days, { name: 'Panchanga · New Delhi', place: DELHI, uidSuffix: 'delhi', now: new Date('2026-11-01T00:00:00Z') });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(30);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261101');
    expect(ics).toContain('UID:2026-11-01-delhi@jyotisha-explorer');
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    // unfolding gives back the text
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toMatch(/DESCRIPTION:Tithi: (Shukla|Krishna) paksha/);
  });

  it('folds long lines without breaking characters', () => {
    const long = 'SUMMARY:' + 'ॐ'.repeat(60);
    const folded = foldLine(long);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});
