/**
 * Yoga rules as data, for the visual rule builder.
 *
 * A rule is a tree of conditions joined by "all of" / "any of". The same tree can be
 *   - evaluated against a chart (evaluateRule), with a trace of which conditions held,
 *   - described in plain English (describeRule), and
 *   - exported as TypeScript (ruleToTypeScript) written against the helpers in chart-utils,
 *     in the style of yogas.ts, ready to paste into this package.
 * The evaluator and the generated code use the same helpers, and a test checks they agree.
 */
import {
  aspectsPlanet,
  dignityOf,
  exchange,
  houseFromPlanet,
  houseOf,
  isBenefic,
  isStrong,
  isWeak,
  lordOfHouse,
  mutualAspect,
  related,
  sameSign,
} from './chart-utils';
import type { ChartInput, Dignity, PlanetId, Tone, YogaCategory } from './types';
import { PLANETS } from './types';

/** A planet by name, the lord of a house, or "any of" a list (the condition holds if it holds for one). */
export type PlanetRef = PlanetId | { lordOf: number } | { anyOf: PlanetId[] };

export type RelationKind = 'conjunction' | 'aspects' | 'mutual-aspect' | 'exchange' | 'sambandha';

export type Condition =
  | { kind: 'house'; planet: PlanetRef; houses: number[]; from: 'lagna' | PlanetId }
  | { kind: 'sign'; planet: PlanetRef; signs: number[] }
  | { kind: 'dignity'; planet: PlanetRef; dignities: Dignity[] }
  | { kind: 'relation'; a: PlanetRef; b: PlanetRef; via: RelationKind }
  | { kind: 'state'; planet: PlanetRef; state: 'retrograde' | 'combust' | 'strong' | 'weak' | 'benefic' };

export interface RuleGroup {
  kind: 'group';
  op: 'all' | 'any';
  /** "none of" when combined with op 'any', "not all of" with 'all'. */
  negate?: boolean;
  items: RuleNode[];
}

export type RuleNode = Condition | RuleGroup;

export interface YogaRule {
  /** kebab-case, becomes the YOGA_DEFINITIONS key. */
  id: string;
  name: string;
  category: YogaCategory;
  tone: Tone;
  /** One-sentence summary of what the yoga gives. */
  summary: string;
  root: RuleGroup;
}

export const DIGNITIES: Dignity[] = ['exalted', 'moolatrikona', 'own', 'great_friend', 'friend', 'neutral', 'enemy', 'great_enemy', 'debilitated'];

// ------------------------------------------------------------------ evaluate

const refPlanets = (chart: ChartInput, r: PlanetRef): PlanetId[] =>
  typeof r === 'string' ? [r] : 'lordOf' in r ? [lordOfHouse(chart, r.lordOf)] : r.anyOf;

function holds(chart: ChartInput, c: Condition): boolean {
  const some = (r: PlanetRef, f: (p: PlanetId) => boolean) => refPlanets(chart, r).some(f);
  switch (c.kind) {
    case 'house':
      return some(c.planet, (p) => c.houses.includes(c.from === 'lagna' ? houseOf(chart, p) : houseFromPlanet(chart, c.from, p)));
    case 'sign':
      return some(c.planet, (p) => c.signs.includes(chart.planets[p].sign));
    case 'dignity':
      return some(c.planet, (p) => c.dignities.includes(dignityOf(chart, p)));
    case 'state':
      return some(c.planet, (p) => {
        switch (c.state) {
          case 'retrograde': return chart.planets[p].retrograde === true;
          case 'combust': return !!chart.planets[p].combust;
          case 'strong': return isStrong(chart, p);
          case 'weak': return isWeak(chart, p);
          case 'benefic': return isBenefic(chart, p);
        }
      });
    case 'relation':
      return some(c.a, (a) => some(c.b, (b) => relationHolds(chart, c.via, a, b)));
  }
}

function relationHolds(chart: ChartInput, via: RelationKind, a: PlanetId, b: PlanetId): boolean {
  switch (via) {
    case 'conjunction': return sameSign(chart, a, b);
    case 'aspects': return aspectsPlanet(chart, a, b);
    case 'mutual-aspect': return mutualAspect(chart, a, b);
    case 'exchange': return exchange(chart, a, b);
    case 'sambandha': return a === b || !!related(chart, a, b);
  }
}

export interface TraceLine { node: RuleNode; depth: number; pass: boolean }

/** Does the chart satisfy the rule? `trace` lists every node in order with its result. */
export function evaluateRule(root: RuleNode, chart: ChartInput): { pass: boolean; trace: TraceLine[] } {
  const trace: TraceLine[] = [];
  const walk = (n: RuleNode, depth: number): boolean => {
    const at = trace.push({ node: n, depth, pass: false }) - 1;
    let pass: boolean;
    if (n.kind === 'group') {
      // every child is evaluated (no short-circuit) so the trace is complete
      const results = n.items.map((i) => walk(i, depth + 1));
      const raw = n.items.length === 0 ? n.op === 'all' : n.op === 'all' ? results.every(Boolean) : results.some(Boolean);
      pass = n.negate ? !raw : raw;
    } else {
      pass = holds(chart, n);
    }
    trace[at].pass = pass;
    return pass;
  };
  return { pass: walk(root, 0), trace };
}

// ------------------------------------------------------------------ describe

const PLANET_NAME: Record<PlanetId, string> = {
  sun: 'the Sun', moon: 'the Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu',
};
const SIGN_NAME = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const DIGNITY_NAME: Record<Dignity, string> = {
  exalted: 'exalted', moolatrikona: 'in its moolatrikona', own: 'in its own sign', great_friend: 'in a great friend’s sign', friend: 'in a friend’s sign',
  neutral: 'in a neutral sign', enemy: 'in an enemy’s sign', great_enemy: 'in a great enemy’s sign', debilitated: 'debilitated',
};
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const orList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const HOUSE_GROUPS: [string, number[]][] = [
  ['a kendra', [1, 4, 7, 10]], ['a trikona', [1, 5, 9]], ['a dusthana', [6, 8, 12]], ['an upachaya', [3, 6, 10, 11]],
];

export function describeRef(r: PlanetRef): string {
  if (typeof r === 'string') return PLANET_NAME[r];
  if ('lordOf' in r) return `the ${ord(r.lordOf)} lord`;
  return `any of ${orList(r.anyOf.map((p) => PLANET_NAME[p]))}`;
}

function describeHouses(hs: number[]): string {
  const sorted = [...hs].sort((a, b) => a - b);
  const group = HOUSE_GROUPS.find(([, g]) => g.length === sorted.length && g.every((x, i) => x === sorted[i]));
  if (group) return `${group[0]} (${sorted.join(', ')})`;
  return sorted.length === 1 ? `the ${ord(sorted[0])} house` : `the ${orList(sorted.map(ord))} house`;
}

export function describeCondition(c: Condition): string {
  switch (c.kind) {
    case 'house':
      return `${cap(describeRef(c.planet))} in ${describeHouses(c.houses)}${c.from === 'lagna' ? '' : ` from ${PLANET_NAME[c.from]}`}`;
    case 'sign':
      return `${cap(describeRef(c.planet))} in ${orList(c.signs.map((s) => SIGN_NAME[s - 1]))}`;
    case 'dignity':
      return `${cap(describeRef(c.planet))} ${orList(c.dignities.map((d) => DIGNITY_NAME[d]))}`;
    case 'state':
      return `${cap(describeRef(c.planet))} ${c.state === 'strong' ? 'strong (exalted, moolatrikona or own sign)' : c.state === 'weak' ? 'weak (debilitated or combust)' : c.state === 'benefic' ? 'acting as a benefic' : c.state}`;
    case 'relation': {
      const a = cap(describeRef(c.a));
      const b = describeRef(c.b);
      switch (c.via) {
        case 'conjunction': return `${a} conjunct ${b} (same sign)`;
        case 'aspects': return `${a} aspects ${b}`;
        case 'mutual-aspect': return `${a} and ${b} in mutual aspect`;
        case 'exchange': return `${a} and ${b} exchange signs`;
        case 'sambandha': return `${a} related to ${b} by conjunction, mutual aspect or exchange (or the same planet)`;
      }
    }
  }
}

/** The rule as one plain sentence, for YogaDefinition.rule. */
export function describeRule(n: RuleNode): string {
  if (n.kind !== 'group') return describeCondition(n);
  const parts = n.items.map((i) => (i.kind === 'group' && i.items.length > 1 ? `(${describeRule(i)})` : describeRule(i)));
  if (!parts.length) return n.op === 'all' ? 'Always' : 'Never';
  const joined = parts.length === 1 ? parts[0] : n.op === 'all' ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : orList(parts);
  if (!n.negate) return joined;
  return n.op === 'any' ? `None of: ${joined}` : `Not all of: ${joined}`;
}

// ------------------------------------------------------------------ export as TypeScript

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (xs: (string | number)[]) => `[${xs.map((x) => (typeof x === 'number' ? String(x) : q(x))).join(', ')}]`;

/** Code for a condition, given a way to name each planet reference. */
function conditionCode(c: Condition, vars: { next: () => string }): { code: string; uses: Set<string> } {
  const uses = new Set<string>();
  // a planet reference becomes either an expression or, for "any of", a .some() loop
  const withRef = (r: PlanetRef, body: (expr: string) => string): string => {
    if (typeof r === 'string') return body(q(r));
    if ('lordOf' in r) { uses.add('lordOfHouse'); return body(`lordOfHouse(chart, ${r.lordOf})`); }
    const v = vars.next();
    return `(${arr(r.anyOf)} as PlanetId[]).some((${v}) => ${body(v)})`;
  };
  let code: string;
  switch (c.kind) {
    case 'house':
      if (c.from === 'lagna') uses.add('houseOf'); else uses.add('houseFromPlanet');
      code = withRef(c.planet, (p) => `${arr(c.houses)}.includes(${c.from === 'lagna' ? `houseOf(chart, ${p})` : `houseFromPlanet(chart, ${q(c.from)}, ${p})`})`);
      break;
    case 'sign':
      code = withRef(c.planet, (p) => `${arr(c.signs)}.includes(chart.planets[${p}].sign)`);
      break;
    case 'dignity':
      uses.add('dignityOf');
      code = withRef(c.planet, (p) => `(${arr(c.dignities)} as Dignity[]).includes(dignityOf(chart, ${p}))`);
      break;
    case 'state': {
      const f = { retrograde: (p: string) => `chart.planets[${p}].retrograde === true`, combust: (p: string) => `!!chart.planets[${p}].combust`, strong: (p: string) => `isStrong(chart, ${p})`, weak: (p: string) => `isWeak(chart, ${p})`, benefic: (p: string) => `isBenefic(chart, ${p})` }[c.state];
      if (c.state === 'strong') uses.add('isStrong');
      if (c.state === 'weak') uses.add('isWeak');
      if (c.state === 'benefic') uses.add('isBenefic');
      code = withRef(c.planet, f);
      break;
    }
    case 'relation': {
      const fn = { conjunction: 'sameSign', aspects: 'aspectsPlanet', 'mutual-aspect': 'mutualAspect', exchange: 'exchange', sambandha: 'related' }[c.via];
      uses.add(fn);
      code = withRef(c.a, (a) => withRef(c.b, (b) => (c.via === 'sambandha' ? `(${a} === ${b} || !!related(chart, ${a}, ${b}))` : `${fn}(chart, ${a}, ${b})`)));
      break;
    }
  }
  return { code, uses };
}

function nodeCode(n: RuleNode, indent: string, vars: { next: () => string }, uses: Set<string>): string {
  if (n.kind !== 'group') {
    const c = conditionCode(n, vars);
    c.uses.forEach((u) => uses.add(u));
    return `${c.code} /* ${describeCondition(n).replace(/\*\//g, '* /')} */`;
  }
  if (!n.items.length) return n.negate ? String(n.op !== 'all') : String(n.op === 'all');
  const inner = indent + '  ';
  const join = n.op === 'all' ? ' &&' : ' ||';
  const body = n.items.map((i) => inner + nodeCode(i, inner, vars, uses)).join(`${join}\n`);
  const grouped = `(\n${body}\n${indent})`;
  return n.negate ? `!${grouped}` : grouped;
}

const pascal = (id: string) => id.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Custom';

/** Normalises a name into a YOGA_DEFINITIONS key. */
export const ruleId = (name: string) => name.toLowerCase().replace(/\byoga\b/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom';

/**
 * TypeScript for the rule: a YogaDefinition and a detector, using only the package's exported helpers.
 * Paste it into a file under packages/interpretations/src (or adapt the import to '@vedic/interpretations').
 */
export function ruleToTypeScript(rule: YogaRule, importFrom = './index'): string {
  let k = 0;
  const vars = { next: () => `p${k++}` };
  const uses = new Set<string>();
  const expr = nodeCode(rule.root, '  ', vars, uses);
  const helpers = [...uses].sort();
  const name = pascal(rule.id);
  const text = describeRule(rule.root);
  const lines = [
    `// ${rule.name}: made with the Jyotisha Explorer yoga rule builder.`,
    `// Rule: ${text}`,
    ...(helpers.length ? [`import { ${helpers.join(', ')} } from ${q(importFrom)};`] : []),
    `import type { ChartInput, Dignity, PlanetId, YogaDefinition } from ${q(importFrom)};`,
    '',
    `export const ${name.charAt(0).toLowerCase() + name.slice(1)}Definition: YogaDefinition = {`,
    `  id: ${q(rule.id)},`,
    `  name: ${q(rule.name)},`,
    `  category: ${q(rule.category)},`,
    `  rule: ${q(text + '.')},`,
    `  reading: {`,
    `    id: ${q(`yoga:${rule.id}`)},`,
    `    title: ${q(rule.name)},`,
    `    summary: ${q(rule.summary)},`,
    `    detail: [],`,
    `    strengths: [],`,
    `    challenges: [],`,
    `    keywords: [${q(rule.category)}],`,
    `    tone: ${q(rule.tone)},`,
    `    score: ${rule.tone === 'benefic' ? 2 : rule.tone === 'challenging' ? -2 : 0},`,
    `  },`,
    `};`,
    '',
    `/** True when the chart forms ${rule.name.replace(/\*\//g, '')}. */`,
    `export function detect${name}(chart: ChartInput): boolean {`,
    `  return ${expr};`,
    `}`,
    '',
  ];
  // keep the type imports honest: drop the ones the code does not use
  let out = lines.join('\n');
  if (!/\bDignity\[\]/.test(expr)) out = out.replace('ChartInput, Dignity, PlanetId,', 'ChartInput, PlanetId,');
  if (!/as PlanetId\[\]/.test(expr)) out = out.replace('ChartInput, Dignity, PlanetId,', 'ChartInput, Dignity,').replace('ChartInput, PlanetId,', 'ChartInput,');
  return out;
}

// ------------------------------------------------------------------ helpers for editors

export const isPlanetId = (x: unknown): x is PlanetId => typeof x === 'string' && (PLANETS as readonly string[]).includes(x);

/** Checks untrusted JSON (a shared link, a pasted rule) and returns a clean rule or null. */
export function parseRule(raw: unknown): YogaRule | null {
  try {
    const o = raw as YogaRule;
    if (!o || typeof o !== 'object' || typeof o.name !== 'string') return null;
    const ref = (r: unknown): PlanetRef | null => {
      if (isPlanetId(r)) return r;
      if (r && typeof r === 'object' && 'lordOf' in r) { const n = Number((r as { lordOf: unknown }).lordOf); return n >= 1 && n <= 12 ? { lordOf: Math.trunc(n) } : null; }
      if (r && typeof r === 'object' && 'anyOf' in r && Array.isArray((r as { anyOf: unknown }).anyOf)) {
        const xs = (r as { anyOf: unknown[] }).anyOf.filter(isPlanetId);
        return xs.length ? { anyOf: [...new Set(xs)] } : null;
      }
      return null;
    };
    const nums = (xs: unknown, max: number) => (Array.isArray(xs) ? [...new Set(xs.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= max))] : []);
    const node = (n: unknown, depth: number): RuleNode | null => {
      if (!n || typeof n !== 'object' || depth > 6) return null;
      const x = n as Record<string, unknown>;
      if (x.kind === 'group') {
        const items = Array.isArray(x.items) ? x.items.map((i) => node(i, depth + 1)).filter((i): i is RuleNode => !!i) : [];
        return { kind: 'group', op: x.op === 'any' ? 'any' : 'all', negate: x.negate === true || undefined, items };
      }
      if (x.kind === 'house') {
        const planet = ref(x.planet);
        const from = x.from === 'lagna' || isPlanetId(x.from) ? x.from : 'lagna';
        return planet ? { kind: 'house', planet, houses: nums(x.houses, 12), from } : null;
      }
      if (x.kind === 'sign') { const planet = ref(x.planet); return planet ? { kind: 'sign', planet, signs: nums(x.signs, 12) } : null; }
      if (x.kind === 'dignity') {
        const planet = ref(x.planet);
        const dignities = Array.isArray(x.dignities) ? x.dignities.filter((d): d is Dignity => DIGNITIES.includes(d as Dignity)) : [];
        return planet ? { kind: 'dignity', planet, dignities } : null;
      }
      if (x.kind === 'state') {
        const planet = ref(x.planet);
        const state = ['retrograde', 'combust', 'strong', 'weak', 'benefic'].includes(x.state as string) ? (x.state as 'retrograde') : null;
        return planet && state ? { kind: 'state', planet, state } : null;
      }
      if (x.kind === 'relation') {
        const a = ref(x.a); const b = ref(x.b);
        const via = ['conjunction', 'aspects', 'mutual-aspect', 'exchange', 'sambandha'].includes(x.via as string) ? (x.via as RelationKind) : null;
        return a && b && via ? { kind: 'relation', a, b, via } : null;
      }
      return null;
    };
    const root = node(o.root, 0);
    if (!root || root.kind !== 'group') return null;
    const categories: YogaCategory[] = ['raja', 'dhana', 'mahapurusha', 'lunar', 'solar', 'nabhasa', 'parivartana', 'viparita', 'neecha-bhanga', 'spiritual', 'arishta', 'other'];
    const tones: Tone[] = ['benefic', 'mixed', 'challenging'];
    return {
      id: ruleId(typeof o.id === 'string' && o.id ? o.id : o.name),
      name: o.name.slice(0, 80),
      category: categories.includes(o.category) ? o.category : 'other',
      tone: tones.includes(o.tone) ? o.tone : 'benefic',
      summary: typeof o.summary === 'string' ? o.summary.slice(0, 300) : '',
      root,
    };
  } catch {
    return null;
  }
}

/** Classical yogas written as rules: starting points for the builder, and a check on it. */
export const RULE_EXAMPLES: YogaRule[] = [
  {
    id: 'gaja-kesari', name: 'Gaja Kesari Yoga', category: 'lunar', tone: 'benefic',
    summary: 'The elephant and the lion: lasting reputation, wisdom and resilience.',
    root: { kind: 'group', op: 'all', items: [{ kind: 'house', planet: 'jupiter', houses: [1, 4, 7, 10], from: 'moon' }] },
  },
  {
    id: 'ruchaka', name: 'Ruchaka Yoga', category: 'mahapurusha', tone: 'benefic',
    summary: 'Mars-born greatness: courage, command and physical strength.',
    root: { kind: 'group', op: 'all', items: [
      { kind: 'sign', planet: 'mars', signs: [1, 8, 10] },
      { kind: 'house', planet: 'mars', houses: [1, 4, 7, 10], from: 'lagna' },
    ] },
  },
  {
    id: 'dharma-karmadhipati', name: 'Dharma-Karmadhipati Yoga', category: 'raja', tone: 'benefic',
    summary: 'Purpose and career aligned: one of the strongest Raja yogas.',
    root: { kind: 'group', op: 'all', items: [{ kind: 'relation', a: { lordOf: 9 }, b: { lordOf: 10 }, via: 'sambandha' }] },
  },
  {
    id: 'harsha', name: 'Harsha Yoga', category: 'viparita', tone: 'benefic',
    summary: 'Viparita Raja yoga: enemies and illness defeat themselves.',
    root: { kind: 'group', op: 'all', items: [{ kind: 'house', planet: { lordOf: 6 }, houses: [6, 8, 12], from: 'lagna' }] },
  },
  {
    id: 'sunapha', name: 'Sunapha Yoga', category: 'lunar', tone: 'benefic',
    summary: 'Self-made wealth and a resourceful mind.',
    root: { kind: 'group', op: 'all', items: [
      { kind: 'house', planet: { anyOf: ['mars', 'mercury', 'jupiter', 'venus', 'saturn'] }, houses: [2], from: 'moon' },
      // with planets on both sides of the Moon it is Durudhara instead
      { kind: 'group', op: 'any', negate: true, items: [
        { kind: 'house', planet: { anyOf: ['mars', 'mercury', 'jupiter', 'venus', 'saturn'] }, houses: [12], from: 'moon' },
      ] },
    ] },
  },
];

export const emptyRule = (): YogaRule => ({
  id: 'my-yoga', name: 'My Yoga', category: 'other', tone: 'benefic', summary: '',
  root: { kind: 'group', op: 'all', items: [{ kind: 'house', planet: 'jupiter', houses: [1, 4, 7, 10], from: 'lagna' }] },
});
