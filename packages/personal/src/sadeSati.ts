/**
 * Sade Sati countdown: the thing people actually want from Sade Sati is
 * "when does it end". Built on saturnPhases() from @vedic/timing, so the
 * dates match the timing dashboard exactly.
 */
import type { Chart, Engine } from '@vedic/engine';
import { saturnPhases, SATURN_PHASE_TEXT, type SadeSatiSpell, type SaturnPhase } from '@vedic/timing';
import { engineEphemeris, natalFromChart } from '@vedic/timing/engine';
import { DAY_MS, daysBetween } from './util';

export type SadeSatiState = 'in' | 'upcoming';

export interface SadeSatiCountdown {
  state: SadeSatiState;
  /** The spell running now, or the next one. */
  spell: { start: string; end: string; phases: { kind: SaturnPhase['kind']; start: string; end: string; reentry: boolean }[]; severityScore: number; bindus: number[] };
  /** Days until the spell ends (state 'in') or begins (state 'upcoming'). */
  days: number;
  /** Fraction of the spell already behind you, 0–1 (0 when upcoming). */
  progress: number;
  /** The phase you are in now, if any. */
  phase?: { kind: SaturnPhase['kind']; label: string; text: string; ends: string };
  /** The spell before this one, if it ended inside the search window. */
  previousEnd?: string;
  /** One sentence for the headline. */
  headline: string;
}

const PHASE_LABEL: Record<SaturnPhase['kind'], string> = {
  'sade-sati-rising': 'Rising phase',
  'sade-sati-peak': 'Peak phase',
  'sade-sati-setting': 'Setting phase',
  kantaka: 'Kantaka Shani',
  ashtama: 'Ashtama Shani',
};

const fmt = (d: Date) => d.toISOString().slice(0, 10);

function humanSpan(days: number): string {
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} months`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} years and ${m} month${m === 1 ? '' : 's'}` : `${y} years`;
}

/** Where you stand with Sade Sati at `now`. Searches 10 years back and 32 ahead (more than one Saturn cycle). */
export function sadeSatiCountdown(engine: Engine, chart: Chart, now: Date = new Date()): SadeSatiCountdown | null {
  const eph = engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType });
  const natal = natalFromChart(chart);
  const from = new Date(now.getTime() - 10 * 365.25 * DAY_MS);
  const to = new Date(now.getTime() + 32 * 365.25 * DAY_MS);
  const { sadeSati } = saturnPhases(eph, natal, from, to);
  return countdownFrom(sadeSati, now);
}

/** Pure part, exported for tests: pick the spell for `now` from a list. */
export function countdownFrom(spells: SadeSatiSpell[], now: Date): SadeSatiCountdown | null {
  const t = now.getTime();
  // a spell that started at the search boundary may be cut short; spells are ordered
  const current = spells.find((s) => s.start.getTime() <= t && t < s.end.getTime());
  const next = spells.find((s) => s.start.getTime() > t);
  const spell = current ?? next;
  if (!spell) return null;
  const prev = [...spells].reverse().find((s) => s.end.getTime() <= t);
  const shape = {
    start: spell.start.toISOString(),
    end: spell.end.toISOString(),
    phases: spell.phases.map((p) => ({ kind: p.kind, start: p.start.toISOString(), end: p.end.toISOString(), reentry: p.reentry })),
    severityScore: spell.severity.score,
    bindus: spell.bindus,
  };
  if (current) {
    const days = daysBetween(now, current.end);
    const total = current.end.getTime() - current.start.getTime();
    const ph = current.phases.find((p) => p.start.getTime() <= t && t < p.end.getTime());
    return {
      state: 'in',
      spell: shape,
      days,
      progress: Math.min(1, Math.max(0, (t - current.start.getTime()) / total)),
      phase: ph ? { kind: ph.kind, label: PHASE_LABEL[ph.kind] + (ph.reentry ? ' (re-entry)' : ''), text: SATURN_PHASE_TEXT[ph.kind], ends: ph.end.toISOString() } : undefined,
      previousEnd: prev?.end.toISOString(),
      headline: `Your Sade Sati ends on ${fmt(current.end)}, in ${humanSpan(days)}.`,
    };
  }
  const days = daysBetween(now, spell.start);
  return {
    state: 'upcoming',
    spell: shape,
    days,
    progress: 0,
    previousEnd: prev?.end.toISOString(),
    headline: `You are not in Sade Sati. The next one begins on ${fmt(spell.start)}, in ${humanSpan(days)}.`,
  };
}
