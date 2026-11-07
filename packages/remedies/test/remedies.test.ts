import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type Chart, type GrahaId } from '@vedic/engine';
import type { ChartInput } from '@vedic/interpretations';
import {
  DASHA_YEARS,
  GRAHAS,
  ISHTA_DEITY,
  REMEDY_SETS,
  SOURCES,
  afflictionFactors,
  functionalNature,
  remedies,
  severityOf,
  yantraGrid,
  type Citation,
} from '../src';

/** Bare engine-shaped chart: sign and degree for each graha, everything else neutral. */
function fakeChart(asc: number, at: Partial<Record<GrahaId, [number, number, Partial<Chart['planets']['sun']>?]>>): Chart {
  const defaults: Record<GrahaId, [number, number]> = {
    sun: [1, 10], moon: [5, 11], mars: [3, 12], mercury: [2, 13], jupiter: [9, 14],
    venus: [12, 15], saturn: [11, 16], rahu: [4, 17], ketu: [10, 17],
  };
  const planets = {} as Chart['planets'];
  for (const g of GRAHAS) {
    const [sign, deg, extra] = at[g] ?? defaults[g];
    planets[g] = { id: g, sign, longitude: (sign - 1) * 30 + deg, house: 1, retrograde: false, combust: false, nakshatra: 1, pada: 1, speed: 1, ...extra } as never;
  }
  return { ascendant: { sign: asc, longitude: (asc - 1) * 30 + 5 }, planets } as unknown as Chart;
}

const ids = (c: Chart, g: GrahaId) => afflictionFactors(c, g).map((f) => f.id);

describe('afflictions', () => {
  it('flags debilitation, combustion and the difficult houses', () => {
    // Aries lagna, Saturn debilitated in Aries.
    const c = fakeChart(1, { saturn: [1, 20, { combust: true }] });
    expect(ids(c, 'saturn')).toEqual(expect.arrayContaining(['debilitated', 'combust']));
    const d = fakeChart(1, { mercury: [8, 2] });
    expect(ids(d, 'mercury')).toContain('dusthana');
  });

  it('reads a node with a luminary as an eclipse, not also as a malefic conjunction', () => {
    const c = fakeChart(1, { moon: [4, 5], rahu: [4, 20], ketu: [10, 20] });
    const f = ids(c, 'moon');
    expect(f).toContain('eclipsed_luminary');
    expect(f).not.toContain('malefic_conjunction');
  });

  it('finds papakartari when malefics sit on both sides', () => {
    const c = fakeChart(1, { venus: [6, 10], mars: [5, 10], saturn: [7, 10] });
    expect(ids(c, 'venus')).toContain('papakartari');
  });

  it('counts Saturn and Mars aspects, and lets Jupiter soften them', () => {
    // Venus in Libra, Saturn in Capricorn aspects it by its 10th; Jupiter in Aquarius aspects it by its 9th.
    const c = fakeChart(1, { venus: [7, 10], saturn: [10, 10], jupiter: [11, 10], mars: [3, 5] });
    const f = afflictionFactors(c, 'venus');
    expect(f.find((x) => x.id === 'malefic_aspect')?.reason).toMatch(/Saturn/);
    expect(f.some((x) => x.id === 'jupiter_support')).toBe(true);
    expect(f.some((x) => x.id === 'strong_dignity')).toBe(true);
  });

  it('marks a dark Moon', () => {
    const c = fakeChart(1, { sun: [1, 10], moon: [2, 5] });
    expect(ids(c, 'moon')).toContain('weak_moon');
  });

  it('maps scores to severity', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map((s) => severityOf(s))).toEqual(['none', 'none', 'mild', 'mild', 'moderate', 'moderate', 'strong', 'strong']);
  });
});

describe('functional nature (BPHS lordship rules)', () => {
  const input = (asc: number) => ({ ascendantSign: asc, planets: {} } as unknown as ChartInput);
  it('makes trikona lords benefic, including the yogakaraka', () => {
    expect(functionalNature(input(7), 'saturn').nature).toBe('benefic'); // Libra: 4th + 5th
    expect(functionalNature(input(1), 'sun').nature).toBe('benefic'); // Aries: 5th
  });
  it('makes 3rd, 6th and 11th lords malefic', () => {
    expect(functionalNature(input(7), 'jupiter')).toEqual({ nature: 'malefic', rules: [3, 6] });
    expect(functionalNature(input(7), 'sun').nature).toBe('malefic'); // 11th
  });
  it('spares the Sun and Moon the 8th-lord blemish', () => {
    expect(functionalNature(input(9), 'moon').nature).toBe('neutral'); // Sagittarius: Moon rules the 8th only
    expect(functionalNature(input(6), 'mars').nature).toBe('malefic'); // Virgo: 3rd + 8th
    expect(functionalNature(input(10), 'sun').nature).toBe('neutral'); // Capricorn: Sun rules the 8th only
  });
  it('treats the nodes separately', () => {
    expect(functionalNature(input(1), 'rahu').nature).toBe('node');
  });
});

describe('remedy data', () => {
  it('has a full set for each graha', () => {
    for (const g of GRAHAS) {
      const s = REMEDY_SETS[g];
      expect(s.graha).toBe(g);
      expect(s.mantra.count).toBeGreaterThan(0);
      expect(s.mantra.vimshottariCount).toBe(DASHA_YEARS[g] * 1000);
      expect(s.charity.items.length).toBeGreaterThan(0);
      expect(ISHTA_DEITY[g].deity).toBeTruthy();
    }
  });

  it('builds each yantra as a magic square adding to 15 … 39', () => {
    GRAHAS.forEach((g, i) => {
      const m = yantraGrid(g);
      const total = 15 + 3 * i;
      expect(REMEDY_SETS[g].yantra.total).toBe(total);
      for (let r = 0; r < 3; r++) expect(m[r][0] + m[r][1] + m[r][2]).toBe(total);
      for (let c = 0; c < 3; c++) expect(m[0][c] + m[1][c] + m[2][c]).toBe(total);
      expect(m[0][0] + m[1][1] + m[2][2]).toBe(total);
      expect(m[0][2] + m[1][1] + m[2][0]).toBe(total);
    });
  });

  it('cites only sources that exist', () => {
    const cites: Citation[] = [];
    for (const g of GRAHAS) {
      const s = REMEDY_SETS[g];
      cites.push(...s.gem.cite, ...s.mantra.cite, s.mantra.vedic.cite, ...s.yantra.cite, ...s.charity.cite, ...s.fast.cite, s.stotra.cite);
    }
    for (const c of cites) expect(SOURCES[c.source], c.source).toBeDefined();
    // Every Vedic mantra carries a verse.
    for (const g of GRAHAS) expect(REMEDY_SETS[g].mantra.vedic.cite.locus).toMatch(/^\d+(\.\d+)+$/);
  });
});

describe('a real chart (Gandhi, Libra lagna)', () => {
  let chart: Chart;
  beforeAll(async () => {
    const engine = await createEngine();
    chart = engine.computeChart({
      date: '1869-10-02', time: '07:11',
      place: { name: 'Porbandar, India', latitude: 21.6417, longitude: 69.6293 },
    });
  });

  it('flags the eclipsed Moon and orders the afflicted worst first', () => {
    const r = remedies(chart, { at: '1930-03-12' });
    expect(r.grahas).toHaveLength(9);
    const moon = r.grahas.find((g) => g.graha === 'moon')!;
    expect(moon.factors.map((f) => f.id)).toContain('eclipsed_luminary');
    for (let i = 1; i < r.afflicted.length; i++) expect(r.afflicted[i - 1].score).toBeGreaterThanOrEqual(r.afflicted[i].score);
    expect(r.afflicted.every((g) => g.afflicted && g.priority[0] === 'mantra')).toBe(true);
  });

  it('never advises a gem for a functional malefic', () => {
    const r = remedies(chart);
    const jupiter = r.grahas.find((g) => g.graha === 'jupiter')!; // rules the 3rd and 6th for Libra
    expect(jupiter.functional).toBe('malefic');
    expect(jupiter.gem.advice).toBe('avoid');
    expect(jupiter.priority).not.toContain('gem');
    expect(r.grahas.find((g) => g.graha === 'saturn')!.gem.advice).toBe('consider'); // yogakaraka
  });

  it('marks the running dasha lords', () => {
    const r = remedies(chart, { at: '1930-03-12' });
    expect(r.grahas.filter((g) => g.runningDasha === 'mahadasha')).toHaveLength(1);
    expect(r.grahas.filter((g) => g.runningDasha === 'antardasha').length).toBeLessThanOrEqual(1);
  });

  it('reads the Ishta devata from the 12th from the Karakamsa', () => {
    const { ishtaDevata: d } = remedies(chart);
    expect(d.twelfth).toBe(((d.karakamsa + 10) % 12) + 1);
    if (d.basis === 'lord') expect(d.occupants).toEqual([]);
    else expect(d.occupants).toContain(d.significator);
    expect(d.deity).toBe(ISHTA_DEITY[d.significator].deity);
    expect(d.cite.map((c) => c.source)).toContain('bphs_karakamsa');
  });

  it('always carries the disclaimers', () => {
    expect(remedies(chart).disclaimers.join(' ')).toMatch(/not medical/);
  });
});
