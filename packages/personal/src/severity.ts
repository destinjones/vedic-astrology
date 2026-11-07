/**
 * Severity levels on findings, and a beginner view.
 *
 * Forty-four yogas arriving flat is an information-architecture problem, not
 * a content shortage. Each yoga and dosha gets a level:
 *   1 headline   - shapes the whole chart; read this first
 *   2 notable    - real, but one voice among several
 *   3 background - common or weak; worth knowing, not worth worrying about
 *
 * Beginner mode hides doshas and arishta (affliction) yogas and caps how many
 * findings show at once, headline ones first.
 */
import type { ChartInterpretation, DoshaResult, YogaCategory, YogaResult } from '@vedic/interpretations';
import { rarityOf } from './rarity';

export type FindingLevel = 1 | 2 | 3;
export const LEVEL_LABEL: Record<FindingLevel, string> = { 1: 'Headline', 2: 'Notable', 3: 'Background' };
export const LEVEL_HINT: Record<FindingLevel, string> = {
  1: 'Shapes the whole chart. Read this first.',
  2: 'Real, but one voice among several.',
  3: 'Common or weak here. Worth knowing, not worth worrying about.',
};

export interface Finding {
  kind: 'yoga' | 'dosha';
  /** Stable key: kind, id and the reason it formed (a yoga can form more than once). */
  key: string;
  id: string;
  name: string;
  level: FindingLevel;
  /** Afflictions: doshas and arishta yogas. Hidden in beginner mode. */
  difficult: boolean;
  /** Share of 10,000 random charts with this finding, 0–1, if known. */
  frequency?: number;
  source: YogaResult | DoshaResult;
}

const MAJOR: YogaCategory[] = ['raja', 'dhana', 'mahapurusha', 'parivartana', 'viparita', 'neecha-bhanga'];

export function yogaLevel(y: Pick<YogaResult, 'category' | 'strength'>, frequency?: number): FindingLevel {
  let level: FindingLevel = MAJOR.includes(y.category)
    ? (y.strength === 'strong' ? 1 : y.strength === 'moderate' ? 2 : 3)
    : (y.strength === 'strong' ? 2 : 3);
  // what nearly everyone has is background; what almost nobody has is worth a look
  if (frequency !== undefined && frequency > 0.5 && level < 3) level = (level + 1) as FindingLevel;
  if (frequency !== undefined && frequency < 0.03 && level > 1 && y.strength !== 'weak') level = (level - 1) as FindingLevel;
  return level;
}

export function doshaLevel(d: Pick<DoshaResult, 'severity'>): FindingLevel {
  return d.severity === 'high' ? 1 : d.severity === 'moderate' ? 2 : 3;
}

/** Every present yoga and dosha as a leveled finding, headline first, rarer first within a level. */
export function findingsOf(report: Pick<ChartInterpretation, 'yogas' | 'doshas'>): Finding[] {
  const out: Finding[] = [];
  for (const y of report.yogas) {
    const frequency = rarityOf('yoga', y.id)?.frequency;
    out.push({ kind: 'yoga', key: `yoga:${y.id}:${y.reason}`, id: y.id, name: y.name, level: yogaLevel(y, frequency), difficult: y.category === 'arishta', frequency, source: y });
  }
  for (const d of report.doshas) {
    if (!d.present) continue;
    const frequency = rarityOf('dosha', d.id)?.frequency;
    out.push({ kind: 'dosha', key: `dosha:${d.id}`, id: d.id, name: d.name, level: doshaLevel(d), difficult: true, frequency, source: d });
  }
  return out.sort((a, b) => a.level - b.level || (a.frequency ?? 1) - (b.frequency ?? 1) || a.name.localeCompare(b.name));
}

export interface ViewOptions {
  beginner: boolean;
  /** Most findings shown at once in beginner mode. Default 5. */
  cap?: number;
}

export interface FindingView {
  yogas: Finding[];
  doshas: Finding[];
  /** How many were held back by beginner mode. */
  hidden: { yogas: number; doshas: number };
}

export function viewFindings(findings: Finding[], opts: ViewOptions): FindingView {
  const yogas = findings.filter((f) => f.kind === 'yoga');
  const doshas = findings.filter((f) => f.kind === 'dosha');
  if (!opts.beginner) return { yogas, doshas, hidden: { yogas: 0, doshas: 0 } };
  const cap = opts.cap ?? 5;
  const gentle = yogas.filter((f) => !f.difficult);
  const shown = gentle.slice(0, cap);
  return { yogas: shown, doshas: [], hidden: { yogas: yogas.length - shown.length, doshas: doshas.length } };
}
