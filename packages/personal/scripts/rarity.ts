/**
 * Casts 10,000 random charts with the real engine, runs the yoga and dosha
 * detectors on each, and writes how often every finding appears to
 * src/data/rarity.json. Deterministic: the same seed gives the same table.
 *
 *   npm run rarity -w @vedic/personal            # 10,000 charts
 *   npm run rarity -w @vedic/personal -- 2000    # a quicker sample
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@vedic/engine';
import { fromEngineChart, interpretChart } from '@vedic/interpretations';
import { randomBirth, SAMPLE_METHOD } from '../src/sample';
import { presentIds, rarityScore, type RarityTable } from '../src/rarity';

const N = Number(process.argv[2] ?? 10_000);
const SEED = 20261107;

const engine = await createEngine();
const yogas: Record<string, number> = {};
const doshas: Record<string, number> = {};
const perChart: string[][] = [];
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const input = randomBirth(SEED, i);
  const chart = engine.computeChart(input, { dashaLevels: 1, strength: false });
  const ids = presentIds(interpretChart(fromEngineChart(chart)));
  for (const id of ids.yogas) yogas[id] = (yogas[id] ?? 0) + 1;
  for (const id of ids.doshas) doshas[id] = (doshas[id] ?? 0) + 1;
  perChart.push(ids.yogas);
  if ((i + 1) % 1000 === 0) console.log(`${i + 1} charts, ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
const sorted = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const base = { yogas: sorted(yogas), charts: N };
const scores = perChart.map((ids) => rarityScore(ids, base)).sort((a, b) => a - b);
const q = Array.from({ length: 101 }, (_, k) => +scores[Math.min(N - 1, Math.round((k / 100) * (N - 1)))].toFixed(4));
const table: RarityTable = {
  version: 1,
  generated: new Date().toISOString().slice(0, 10),
  charts: N,
  seed: SEED,
  method: SAMPLE_METHOD,
  yogas: base.yogas,
  doshas: sorted(doshas),
  scoreQuantiles: q,
};
const out = join(dirname(fileURLToPath(import.meta.url)), '../src/data/rarity.json');
writeFileSync(out, JSON.stringify(table, null, 1) + '\n');
console.log(`wrote ${out}: ${Object.keys(yogas).length} yogas, ${Object.keys(doshas).length} doshas`);
engine.close();
