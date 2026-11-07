/**
 * Compiles the YAML readings in content/ into src/data/generated/content.ts.
 *
 *   npm run content -w @vedic/interpretations          rebuild after editing YAML
 *   npm run content:check -w @vedic/interpretations    CI: fail if YAML is invalid or the build is stale
 *
 * Validation is the JSON Schemas in content/schema plus the house style in content/STYLE.md.
 * Errors name the file and the reading, so a contributor never has to read this script.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { parse } from 'yaml';

const root = fileURLToPath(new URL('../', import.meta.url));
const contentDir = `${root}content/`;
const outFile = `${root}src/data/generated/content.ts`;
const creditsFile = `${root}src/data/generated/credits.ts`;
const check = process.argv.includes('--check');

export const PLANET_ORDER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'] as const;
export const SIGN_SLUGS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
export const NAKSHATRA_SLUGS = ['ashwini', 'bharani', 'krittika', 'rohini', 'mrigashira', 'ardra', 'punarvasu', 'pushya', 'ashlesha', 'magha', 'purva-phalguni', 'uttara-phalguni', 'hasta', 'chitra', 'swati', 'vishakha', 'anuradha', 'jyeshtha', 'mula', 'purva-ashadha', 'uttara-ashadha', 'shravana', 'dhanishta', 'shatabhisha', 'purva-bhadrapada', 'uttara-bhadrapada', 'revati'];

interface Text { summary: string; detail: string | string[]; strengths: string[]; challenges: string[]; score?: number; credit?: string[] }
interface FileOf { planet: (typeof PLANET_ORDER)[number]; readings: Record<string, Text> }

const errors: string[] = [];
const ajv = new Ajv({ allErrors: true, strict: false });
for (const f of readdirSync(`${contentDir}schema`)) ajv.addSchema(JSON.parse(readFileSync(`${contentDir}schema/${f}`, 'utf8')));

function load<T>(rel: string, schema: string): T | undefined {
  const text = readFileSync(contentDir + rel, 'utf8');
  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    errors.push(`${rel}: not valid YAML: ${(e as Error).message}`);
    return undefined;
  }
  const validate = ajv.getSchema(schema)!;
  if (!validate(data)) for (const e of validate.errors ?? []) errors.push(`${rel}: ${e.instancePath || '(file)'} ${e.message}${e.params && 'allowedValues' in e.params ? ` (${(e.params.allowedValues as string[]).join(', ')})` : ''}`);
  return data as T;
}

/** House style that a schema cannot express. See content/STYLE.md. */
function style(where: string, t: Text) {
  const all = [t.summary, ...[t.detail].flat(), ...t.strengths, ...t.challenges];
  for (const s of all) {
    if (/\w'\w/.test(s)) errors.push(`${where}: use a curly apostrophe (’) not a straight one in “${s.slice(0, 40)}…”`);
    if (/ {2}/.test(s)) errors.push(`${where}: double space in “${s.slice(0, 40)}…”`);
    if (/\s$|^\s/.test(s)) errors.push(`${where}: leading or trailing space in “${s.slice(0, 40)}…”`);
    if (/\b(will definitely|guaranteed|certainly will|you will die|death of)\b/i.test(s)) errors.push(`${where}: no fatalistic or guaranteed predictions (“${s.slice(0, 40)}…”). See STYLE.md.`);
  }
  if (!/[.!?]$/.test(t.summary)) errors.push(`${where}: summary should end with a full stop`);
  for (const p of [t.detail].flat()) if (!/[.!?)”]$/.test(p)) errors.push(`${where}: each detail paragraph should end with a full stop`);
  for (const s of [...t.strengths, ...t.challenges]) if (/[.]$/.test(s)) errors.push(`${where}: strengths and challenges are short phrases without a full stop (“${s}”)`);
}

const credits = new Map<string, string[]>();
const credit = (id: string, t: Text) => { for (const n of t.credit ?? []) credits.set(n, [...(credits.get(n) ?? []), id]); };
const para = (d: string | string[]) => [d].flat();

const inSign: Record<string, unknown[]> = {};
const inHouse: Record<string, unknown[]> = {};
const inNak: Record<string, Record<number, unknown>> = {};
for (const p of PLANET_ORDER) {
  const s = load<FileOf>(`planet-in-sign/${p}.yaml`, 'planet-in-sign.schema.json');
  const h = load<FileOf>(`planet-in-house/${p}.yaml`, 'planet-in-house.schema.json');
  if (s) {
    if (s.planet !== p) errors.push(`planet-in-sign/${p}.yaml: planet should be ${p}`);
    inSign[p] = SIGN_SLUGS.map((k) => {
      const t = s.readings?.[k];
      if (!t) return null;
      style(`planet-in-sign/${p}.yaml ${k}`, t);
      credit(`sign:${p}:${SIGN_SLUGS.indexOf(k) + 1}`, t);
      return [t.summary, t.detail, t.strengths, t.challenges];
    });
  }
  if (h) {
    if (h.planet !== p) errors.push(`planet-in-house/${p}.yaml: planet should be ${p}`);
    inHouse[p] = Array.from({ length: 12 }, (_, i) => {
      const t = h.readings?.[String(i + 1)];
      if (!t) return null;
      style(`planet-in-house/${p}.yaml ${i + 1}`, t);
      credit(`house:${p}:${i + 1}`, t);
      return [t.summary, t.detail, t.strengths, t.challenges, t.score];
    });
  }
  if (existsSync(`${contentDir}planet-in-nakshatra/${p}.yaml`)) {
    const n = load<FileOf>(`planet-in-nakshatra/${p}.yaml`, 'planet-in-nakshatra.schema.json');
    if (n) {
      if (n.planet !== p) errors.push(`planet-in-nakshatra/${p}.yaml: planet should be ${p}`);
      inNak[p] = {};
      for (const [k, t] of Object.entries(n.readings ?? {})) {
        const num = NAKSHATRA_SLUGS.indexOf(k) + 1;
        style(`planet-in-nakshatra/${p}.yaml ${k}`, t);
        credit(`nakshatra:${p}:${num}`, t);
        inNak[p][num] = { summary: t.summary, detail: para(t.detail), strengths: t.strengths, challenges: t.challenges, ...(t.score !== undefined ? { score: t.score } : {}) };
      }
    }
  }
}
const yogas = load<Record<string, unknown>>('yogas.yaml', 'yogas.schema.json') ?? {};

if (errors.length) {
  console.error(`Content has ${errors.length} problem(s):\n` + errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

const j = (x: unknown) => JSON.stringify(x, null, 1).replace(/\n\s*/g, ' ');
const lines = (o: Record<string, unknown>, fmt: (v: unknown) => string) => Object.entries(o).map(([k, v]) => `  ${JSON.stringify(k)}: ${fmt(v)},`).join('\n');
const out = `// Generated by scripts/build-content.ts from packages/interpretations/content. Do not edit by hand:
// change the YAML and run \`npm run content -w @vedic/interpretations\`.
/* eslint-disable */
import type { PlanetId } from '../../types';
import type { SignEntry } from '../planetInSign';
import type { HouseEntry } from '../planetInHouse';
import type { WrittenNakshatraReading, YogaMeta } from '../contentTypes';

export const PLANET_IN_SIGN_TEXT: Record<PlanetId, SignEntry[]> = {
${Object.entries(inSign).map(([p, rows]) => `  ${p}: [\n${rows.map((r) => `    ${j(r)},`).join('\n')}\n  ],`).join('\n')}
};

export const PLANET_IN_HOUSE_TEXT: Record<PlanetId, HouseEntry[]> = {
${Object.entries(inHouse).map(([p, rows]) => `  ${p}: [\n${rows.map((r) => `    ${j(r)},`).join('\n')}\n  ],`).join('\n')}
};

/** Hand-written planet in nakshatra readings, keyed by nakshatra number (1–27). Anything missing is composed. */
export const PLANET_IN_NAKSHATRA_TEXT: Partial<Record<PlanetId, Record<number, WrittenNakshatraReading>>> = {
${lines(inNak, (v) => `{\n${Object.entries(v as object).map(([n, r]) => `    ${n}: ${j(r)},`).join('\n')}\n  }`)}
};

export const YOGA_META: Record<string, YogaMeta> = {
${lines(yogas, j)}
};

/** Contributors named in the content files, with the reading ids they wrote. */
export const CONTENT_CREDITS: Record<string, string[]> = {
${lines(Object.fromEntries([...credits].sort(([a], [b]) => a.localeCompare(b))), j)}
};
`;

// A separate, tiny module so the credits page does not pull in every reading.
const creditsOut = `// Generated by scripts/build-content.ts from the \`credit:\` fields in packages/interpretations/content. Do not edit by hand.
/** Contributors named in the content files, with how many readings of each kind they wrote. */
export const READING_CREDITS: { name: string; readings: number; kinds: string[] }[] = ${JSON.stringify(
  [...credits].sort(([a], [b]) => a.localeCompare(b)).map(([name, ids]) => ({ name, readings: ids.length, kinds: [...new Set(ids.map((id) => id.split(':')[0]))] })),
  null,
  2,
)};
`;

let stale = false;
for (const [file, text] of [[outFile, out], [creditsFile, creditsOut]] as const) {
  const current = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (check && current !== text) {
    console.error(`${file.slice(root.length)} is out of date. Run \`npm run content -w @vedic/interpretations\` and commit the result.`);
    stale = true;
  } else if (!check) {
    writeFileSync(file, text);
    console.log(`content: wrote ${file.slice(root.length)}`);
  }
}
if (stale) process.exit(1);
if (check) console.log('content: OK');
