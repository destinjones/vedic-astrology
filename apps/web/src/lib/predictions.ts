/**
 * "Did it happen?" marks per person, kept in this browser only, keyed by the
 * birth details like the life events.
 */
import { sanitizeMarks, type PredictionMark } from '@vedic/timing';
import type { BirthInput } from '../types/chart';
import { birthKey } from './lifeEvents';

export const PREDICTIONS_KEY = 'vedic.predictions.v1';

function readAll(): Record<string, unknown> {
  try {
    const raw = localStorage.getItem(PREDICTIONS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch {
    return {};
  }
}

export function loadMarks(input: BirthInput): PredictionMark[] {
  return sanitizeMarks(readAll()[birthKey(input)]);
}

export function saveMarks(input: BirthInput, marks: PredictionMark[]): void {
  try {
    const all = readAll();
    const key = birthKey(input);
    if (marks.length) all[key] = marks;
    else delete all[key];
    localStorage.setItem(PREDICTIONS_KEY, JSON.stringify(all));
  } catch { /* storage full or blocked: marks last for this visit */ }
}

/** Short, non-reversible id from the birth key, for calendar UIDs. */
export function birthHash(input: BirthInput): string {
  let h = 2166136261;
  for (const ch of birthKey(input)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0).toString(36);
}
