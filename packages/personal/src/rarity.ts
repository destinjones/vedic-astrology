/**
 * How rare is each finding? Frequencies come from 10,000 random charts cast
 * with the real engine and run through the same detectors
 * (`npm run rarity -w @vedic/personal` regenerates the table).
 */
import type { ChartInterpretation } from '@vedic/interpretations';
import table from './data/rarity.json';

export interface RarityTable {
  version: 1;
  generated: string;
  charts: number;
  seed: number;
  method: string;
  yogas: Record<string, number>;
  doshas: Record<string, number>;
  /** 101 quantiles (0th..100th percentile) of the chart rarity score over the sample. */
  scoreQuantiles: number[];
}

export const RARITY = table as RarityTable;

export type RarityBand = 'very rare' | 'rare' | 'uncommon' | 'common' | 'very common';

export interface Rarity {
  count: number;
  of: number;
  /** 0–1 */
  frequency: number;
  band: RarityBand;
  /** e.g. "in 3.1% of charts" */
  label: string;
}

export function bandOf(f: number): RarityBand {
  return f < 0.01 ? 'very rare' : f < 0.05 ? 'rare' : f < 0.2 ? 'uncommon' : f < 0.5 ? 'common' : 'very common';
}

const pct = (f: number) => (f < 0.001 ? '<0.1%' : f < 0.1 ? `${(f * 100).toFixed(1)}%` : `${Math.round(f * 100)}%`);

export function rarityOf(kind: 'yoga' | 'dosha', id: string, t: RarityTable = RARITY): Rarity | null {
  const count = (kind === 'yoga' ? t.yogas : t.doshas)[id];
  if (count === undefined) return null;
  const frequency = count / t.charts;
  return { count, of: t.charts, frequency, band: bandOf(frequency), label: `in ${pct(frequency)} of charts` };
}

/** Unique ids present in a report, the way the sample counted them. */
export function presentIds(report: Pick<ChartInterpretation, 'yogas' | 'doshas'>): { yogas: string[]; doshas: string[] } {
  return {
    yogas: [...new Set(report.yogas.map((y) => y.id))],
    doshas: [...new Set(report.doshas.filter((d) => d.present).map((d) => d.id))],
  };
}

/**
 * Rarity score: the sum of -log10(frequency) over the yogas present, so one
 * 1-in-100 yoga counts as much as two 1-in-10 ones. Doshas are left out: a
 * chart is not "special" for being afflicted.
 */
export function rarityScore(yogaIds: string[], t: Pick<RarityTable, 'yogas' | 'charts'> = RARITY): number {
  let s = 0;
  for (const id of yogaIds) s += -Math.log10(((t.yogas[id] ?? 0) + 1) / (t.charts + 1));
  return s;
}

/** Percentile (0–100) of a score against the sample: "rarer than N% of charts". */
export function scorePercentile(score: number, quantiles: number[] = RARITY.scoreQuantiles): number {
  if (!quantiles.length) return 50;
  let lo = 0;
  while (lo < quantiles.length && quantiles[lo] < score) lo++;
  if (lo === 0) return 0;
  if (lo >= quantiles.length) return 100;
  // interpolate between neighbouring quantiles
  const a = quantiles[lo - 1];
  const b = quantiles[lo];
  const frac = b === a ? 0.5 : (score - a) / (b - a);
  return Math.round(((lo - 1 + frac) / (quantiles.length - 1)) * 100);
}

export interface ChartRarity {
  score: number;
  percentile: number;
  /** Rarest yogas present, rarest first (up to three). */
  rarest: { id: string; name: string; rarity: Rarity }[];
  headline: string;
}

export function chartRarity(report: Pick<ChartInterpretation, 'yogas' | 'doshas'>): ChartRarity {
  const ids = presentIds(report).yogas;
  const score = rarityScore(ids);
  const percentile = scorePercentile(score);
  const rarest = ids
    .map((id) => ({ id, name: report.yogas.find((y) => y.id === id)!.name, rarity: rarityOf('yoga', id) }))
    .filter((x): x is { id: string; name: string; rarity: Rarity } => !!x.rarity)
    .sort((a, b) => a.rarity.frequency - b.rarity.frequency)
    .slice(0, 3);
  const headline = percentile >= 50
    ? `Your combination of yogas is rarer than ${percentile}% of 10,000 random charts.`
    : `Your yogas are on the common side: ${100 - percentile}% of random charts have a rarer mix. Common is not weak; most strong charts are built from common yogas.`;
  return { score, percentile, rarest, headline };
}
