import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AYANAMSA_CODES,
  AYANAMSA_IDS,
  Ayanamsa,
  DEGREE_DECIMALS,
  arcminutesBetween,
  degreeDelta,
  isAyanamsaId,
  normDegree,
  parseAyanamsa,
  roundDegree,
  sameDegree,
  toAyanamsa,
  UnknownAyanamsaError,
} from '../src/index';

describe('precision policy', () => {
  it('rounds to four decimals and never returns -0', () => {
    expect(DEGREE_DECIMALS).toBe(4);
    expect(roundDegree(123.456789)).toBe(123.4568);
    expect(Object.is(roundDegree(-0.00001), 0)).toBe(true);
  });
  it('sameDegree tolerates float noise and the 0/360 seam', () => {
    expect(0.1 + 0.2 === 0.3).toBe(false);
    expect(sameDegree(0.1 + 0.2, 0.3)).toBe(true);
    expect(sameDegree(359.99996, 0.00003)).toBe(true);
    expect(sameDegree(10, 10.001)).toBe(false);
    expect(sameDegree(10, 10.001, 0.01)).toBe(true);
    expect(sameDegree(NaN, NaN)).toBe(false);
  });
  it('degreeDelta is the short way round', () => {
    expect(degreeDelta(350, 10)).toBeCloseTo(20, 12);
    expect(degreeDelta(10, 350)).toBeCloseTo(-20, 12);
    expect(degreeDelta(0, 180)).toBe(180);
    expect(arcminutesBetween(100, 100.5)).toBeCloseTo(30, 9);
  });
  it('normDegree is always in [0, 360)', () => {
    for (const x of [-720, -360, -1e-15, 0, 359.9999999999999, 360, 725.5]) {
      const n = normDegree(x);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(360);
    }
  });
});

/**
 * Rule 3 of the policy, enforced: no `===`/`!==` between degree-valued
 * expressions in package sources. Matches identifiers that hold angles.
 * A deliberate exact comparison can opt out with `// precision-ok` on the line.
 */
describe('no exact equality on degrees in sources', () => {
  const ANGLE = String.raw`[\w.]*(?:longitude|Longitude|degree|Degree|deg\b|lon\b|cusp|Cusp|ayanamsaValue)[\w.]*`;
  const NUM = String.raw`-?\d+(?:\.\d+)?`;
  const BAD = new RegExp(String.raw`${ANGLE}\s*[!=]==\s*(?:${ANGLE}|${NUM})|(?:${NUM})\s*[!=]==\s*${ANGLE}`);
  const roots = ['../src', '../../interpretations/src', '../../timing/src', '../../jaimini/src', '../../tajika/src', '../../rectification/src'];
  const files = roots.flatMap((r) => walk(new URL(r, import.meta.url).pathname));
  it('scans the package sources', () => expect(files.length).toBeGreaterThan(20));
  it('finds none', () => {
    const hits: string[] = [];
    for (const f of files)
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (BAD.test(line) && !line.includes('precision-ok')) hits.push(`${f.split('/packages/')[1]}:${i + 1}: ${line.trim()}`);
      });
    expect(hits, 'use sameDegree() instead of === on degrees').toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('typed Ayanamsa at the boundary', () => {
  it('names every engine ayanamsa exactly once', () => {
    expect([...AYANAMSA_IDS].sort()).toEqual(Object.keys(AYANAMSA_CODES).sort());
    expect(Ayanamsa.Lahiri).toBe('lahiri');
  });
  it('parses case-insensitively and rejects everything else', () => {
    expect(parseAyanamsa(' Lahiri ')).toBe('lahiri');
    for (const bad of ['', 'lahiri2', 'toString', 'constructor', '__proto__', 1, null, undefined, {}])
      expect(() => parseAyanamsa(bad)).toThrow(UnknownAyanamsaError);
    expect(isAyanamsaId('hasOwnProperty')).toBe(false);
  });
  it('toAyanamsa falls back', () => {
    expect(toAyanamsa('raman')).toBe('raman');
    expect(toAyanamsa('nope')).toBe('lahiri');
    expect(toAyanamsa(undefined, 'raman')).toBe('raman');
  });
});
