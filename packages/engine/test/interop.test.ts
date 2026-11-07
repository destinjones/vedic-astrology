import { describe, expect, it } from 'vitest';
import { deltaArcminutes, parseLongitude, parsePositionTable } from '../src/interop';

const close = (a: number | null, b: number) => {
  expect(a).not.toBeNull();
  expect(Math.abs((a as number) - b)).toBeLessThan(1e-9);
};

describe('parseLongitude', () => {
  const leo = 120 + 3 + 27 / 60 + 12 / 3600;
  it('reads decimal degrees', () => {
    close(parseLongitude('123.4567'), 123.4567);
    close(parseLongitude('123,4567°'), 123.4567);
    close(parseLongitude('0'), 0);
  });
  it('reads absolute DMS', () => close(parseLongitude(`123°27'12"`), leo));
  it('reads the sign styles other programs print', () => {
    for (const s of [`3°Le27'12"`, `3 Le 27' 12"`, `Leo 3°27'12"`, `3:27:12 Simha`, `♌ 3°27'12"`, `3°27′12″ Leo`, `3 leo 27 12`, `3Le27'12" R`, `3° Le 27' 12'' Rx`]) {
      close(parseLongitude(s), leo);
    }
  });
  it('reads seconds with decimals', () => close(parseLongitude(`29 Pi 59' 59.99"`), 330 + 29 + 59 / 60 + 59.99 / 3600));
  it('refuses what it cannot read for sure', () => {
    for (const s of ['', 'hello', '400', `31 Le 00'`, `3 Le 61'`, '-12', `Leo 3 Virgo 2`, `3.5 27'`, '1 2 3 4']) {
      expect(parseLongitude(s), s).toBeNull();
    }
  });
});

describe('parsePositionTable', () => {
  it('reads a pasted Astro.com style block', () => {
    const rows = parsePositionTable([
      'Sun        22°Cn12\'03"',
      'Moon       5 Sc 01\' 10"',
      'Mercury R  10°Le02\'',
      'True Node  4°Ge30\'',
      'Ascendant  Virgo 12°00\'',
      'House 2    nothing here',
      'Mean Node  3 Ge 10',
    ].join('\n'));
    expect(rows.map((r) => r.body)).toEqual(['sun', 'moon', 'mercury', 'rahu', 'asc', 'rahu']);
    close(rows[0].longitude, 90 + 22 + 12 / 60 + 3 / 3600);
    close(rows[2].longitude, 120 + 10 + 2 / 60);
    expect(rows[3].node).toBe('true');
    expect(rows[5].node).toBe('mean');
    close(rows[4].longitude, 162);
  });
  it('ignores trailing columns such as speed or nakshatra', () => {
    const [r] = parsePositionTable('Jupiter\t14 Ta 22\' 08"\tRohini\t0.21');
    expect(r.body).toBe('jupiter');
    close(r.longitude, 30 + 14 + 22 / 60 + 8 / 3600);
  });
});

describe('deltaArcminutes', () => {
  it('is signed and takes the short way round', () => {
    expect(deltaArcminutes(10, 10.5)).toBeCloseTo(30);
    expect(deltaArcminutes(10.5, 10)).toBeCloseTo(-30);
    expect(deltaArcminutes(359.9, 0.1)).toBeCloseTo(12);
    expect(deltaArcminutes(0.1, 359.9)).toBeCloseTo(-12);
  });
});
