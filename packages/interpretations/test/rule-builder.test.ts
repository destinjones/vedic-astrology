import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import * as lib from '../src';
import {
  describeRule, detectYogas, emptyRule, evaluateRule, parseRule, PLANETS, RULE_EXAMPLES, ruleToTypeScript,
  type ChartInput, type PlanetId, type SignNumber, type YogaRule,
} from '../src';

/** Deterministic random charts: every planet in a random sign at a random degree. */
function randomCharts(n: number, seed = 7): ChartInput[] {
  let x = seed;
  const rnd = () => ((x = (x * 1103515245 + 12345) % 2147483648) / 2147483648);
  return Array.from({ length: n }, () => {
    const asc = (Math.floor(rnd() * 12) + 1) as SignNumber;
    const planets = {} as ChartInput['planets'];
    for (const p of PLANETS) {
      const lon = rnd() * 360;
      const sign = (Math.floor(lon / 30) + 1) as SignNumber;
      planets[p] = { sign, house: (((sign - asc + 12) % 12) + 1) as SignNumber, longitude: lon, retrograde: rnd() < 0.2, combust: rnd() < 0.15, nakshatra: Math.floor(lon / (360 / 27)) + 1, pada: 1 };
    }
    planets.ketu = { ...planets.ketu, longitude: (planets.rahu.longitude + 180) % 360, sign: ((planets.rahu.sign + 5) % 12 + 1) as SignNumber };
    return { ascendantSign: asc, planets };
  });
}

/** Compiles the exported TypeScript and returns its detector. */
function compile(rule: YogaRule): (c: ChartInput) => boolean {
  const js = ts.transpileModule(ruleToTypeScript(rule, 'lib'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', js)(() => lib, mod, mod.exports);
  const fn = Object.entries(mod.exports).find(([k]) => k.startsWith('detect'))![1];
  return fn as (c: ChartInput) => boolean;
}

const charts = randomCharts(600);

describe('rule builder', () => {
  it('reproduces the built-in detectors for the classical examples', () => {
    for (const rule of RULE_EXAMPLES) {
      let hits = 0;
      for (const c of charts) {
        const builtIn = detectYogas(c).some((y) => y.id === rule.id);
        expect(evaluateRule(rule.root, c).pass, `${rule.id}`).toBe(builtIn);
        if (builtIn) hits++;
      }
      // each example both forms and fails somewhere, so the comparison means something
      expect(hits).toBeGreaterThan(0);
      expect(hits).toBeLessThan(charts.length);
    }
  });

  it('exports TypeScript that agrees with the evaluator', () => {
    const extra: YogaRule = {
      ...emptyRule(), id: 'kitchen-sink', name: 'Kitchen Sink',
      root: { kind: 'group', op: 'any', items: [
        { kind: 'group', op: 'all', items: [
          { kind: 'dignity', planet: { lordOf: 1 }, dignities: ['exalted', 'own'] },
          { kind: 'state', planet: { anyOf: ['mars', 'saturn'] }, state: 'retrograde' },
        ] },
        { kind: 'relation', a: { anyOf: ['venus', 'mercury'] }, b: { lordOf: 7 }, via: 'aspects' },
        { kind: 'group', op: 'all', negate: true, items: [{ kind: 'state', planet: 'moon', state: 'benefic' }, { kind: 'sign', planet: 'sun', signs: [1, 5] }] },
        { kind: 'relation', a: 'jupiter', b: 'saturn', via: 'exchange' },
        { kind: 'house', planet: 'rahu', houses: [3, 6, 11], from: 'jupiter' },
      ] },
    };
    for (const rule of [...RULE_EXAMPLES, extra]) {
      const detect = compile(rule);
      for (const c of charts) expect(detect(c), rule.id).toBe(evaluateRule(rule.root, c).pass);
    }
  });

  it('writes the generated code against real helper names only', () => {
    const code = ruleToTypeScript(RULE_EXAMPLES[2]);
    expect(code).toContain("import { lordOfHouse, related } from './index';");
    expect(code).toContain('export function detectDharmaKarmadhipati(chart: ChartInput): boolean');
    const exported = new Set(Object.keys(lib));
    const imported = /import \{ ([^}]+) \} from/.exec(code)![1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of imported) expect(exported.has(name), name).toBe(true);
  });

  it('describes rules in plain English', () => {
    expect(describeRule(RULE_EXAMPLES[0].root)).toBe('Jupiter in a kendra (1, 4, 7, 10) from the Moon');
    expect(describeRule(RULE_EXAMPLES[1].root)).toBe('Mars in Aries, Scorpio or Capricorn and Mars in a kendra (1, 4, 7, 10)');
  });

  it('cleans untrusted rules', () => {
    expect(parseRule({ name: 'x', root: { kind: 'group', op: 'all', items: [{ kind: 'house', planet: 'pluto', houses: [1] }, { kind: 'sign', planet: 'sun', signs: [0, 3, 3, 99] }] } }))
      .toEqual({ id: 'x', name: 'x', category: 'other', tone: 'benefic', summary: '', root: { kind: 'group', op: 'all', negate: undefined, items: [{ kind: 'sign', planet: 'sun', signs: [3] }] } });
    expect(parseRule('nope')).toBeNull();
    expect(parseRule(RULE_EXAMPLES[4])?.root).toEqual(JSON.parse(JSON.stringify(RULE_EXAMPLES[4].root)));
    const p: PlanetId = 'sun';
    expect(p).toBe('sun');
  });
});
