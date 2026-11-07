/**
 * Stable finding IDs: a flat, sorted ledger of everything a chart's
 * interpretation found, each with an ID that does not depend on locale, order
 * or wording, and the score or severity attached to it.
 *
 * Two ledgers (two app versions, or before and after a content edit) can be
 * diffed with `diffFindings`, so "why did my chart's score change?" has an
 * auditable answer: which findings appeared, disappeared or moved.
 *
 * ID grammar (FINDING_ID_VERSION 1), all lower case, ':' separated:
 *   sign:<planet>:<sign-slug>          planet in sign
 *   house:<planet>:<1-12>              planet in house
 *   nakshatra:<planet>:<slug>[:<pada>] planet in nakshatra
 *   retro:<planet>                     retrograde
 *   conj:<planet>+<planet>             conjunction (sorted pair)
 *   aspect:<planet>:<distance>:<house> graha drishti
 *   lord:<house>:<house>               lord of house A placed in house B
 *   yoga:<id>[:<planets sorted, '+'>]  yoga, with the planets that form it (a raja yoga
 *                                      can occur for several pairs in one chart)
 *   dosha:<id>                         dosha (present or cancelled)
 *   planet:<planet>                    the combined per-planet score
 *
 * Changing this grammar is a breaking change: bump FINDING_ID_VERSION and say
 * so in the changelog, because saved ledgers will no longer line up.
 */
import type { ChartInterpretation } from './interpret';
import type { Reading } from './types';

export const FINDING_ID_VERSION = 1 as const;

export type FindingKind =
  | 'sign'
  | 'house'
  | 'nakshatra'
  | 'retro'
  | 'conj'
  | 'aspect'
  | 'lord'
  | 'yoga'
  | 'dosha'
  | 'planet';

export interface Finding {
  id: string;
  kind: FindingKind;
  /** -3 … +3 for readings; for yogas and doshas, the reading's score */
  score: number;
  /** Yoga strength, or dosha severity ('cancelled' when present but cancelled) */
  grade?: string;
}

export interface FindingLedger {
  version: typeof FINDING_ID_VERSION;
  findings: Finding[];
}

export interface FindingDiff {
  added: Finding[];
  removed: Finding[];
  changed: { id: string; from: Finding; to: Finding }[];
}

const round = (x: number) => Math.round(x * 1000) / 1000 || 0;

const kindOf = (id: string): FindingKind => id.split(':')[0] as FindingKind;

/** Builds the ledger. Same chart, any locale: same IDs and scores. */
export function findingLedger(interp: ChartInterpretation): FindingLedger {
  const out = new Map<string, Finding>();
  const add = (f: Finding) => {
    const prev = out.get(f.id);
    if (prev && (prev.score !== f.score || prev.grade !== f.grade))
      throw new Error(`Finding ${f.id} produced twice with different results`);
    out.set(f.id, f);
  };
  const reading = (r: Reading) => add({ id: r.id, kind: kindOf(r.id), score: round(r.score) });

  for (const r of interp.placements) reading(r);
  for (const r of interp.houseLords) reading(r);
  for (const p of Object.values(interp.planets)) {
    for (const r of p.aspects) reading(r);
    for (const r of p.lordships) reading(r);
    add({ id: `planet:${p.planet}`, kind: 'planet', score: round(p.score) });
  }

  // A yoga id can be detected for more than one set of planets; the planets make it unique.
  // They are always included, so the id does not change when a second instance appears.
  for (const y of interp.yogas) {
    const planets = [...new Set(y.involved)].sort().join('+');
    add({ id: planets ? `yoga:${y.id}:${planets}` : `yoga:${y.id}`, kind: 'yoga', score: round(y.reading.score), grade: y.strength });
  }
  for (const d of interp.doshas)
    if (d.present || d.severity === 'cancelled')
      add({ id: `dosha:${d.id}`, kind: 'dosha', score: round(d.reading.score), grade: d.severity });

  const findings = [...out.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { version: FINDING_ID_VERSION, findings };
}

/** What changed between two ledgers of the same chart. */
export function diffFindings(before: FindingLedger, after: FindingLedger): FindingDiff {
  if (before.version !== after.version)
    throw new Error(`Finding ledgers use different ID versions (${before.version} vs ${after.version})`);
  const a = new Map(before.findings.map((f) => [f.id, f]));
  const b = new Map(after.findings.map((f) => [f.id, f]));
  const added = after.findings.filter((f) => !a.has(f.id));
  const removed = before.findings.filter((f) => !b.has(f.id));
  const changed = after.findings
    .filter((f) => a.has(f.id) && (a.get(f.id)!.score !== f.score || a.get(f.id)!.grade !== f.grade))
    .map((f) => ({ id: f.id, from: a.get(f.id)!, to: f }));
  return { added, removed, changed };
}
