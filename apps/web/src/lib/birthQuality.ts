/**
 * How far a chart's birth time can be trusted, and what to warn about when it
 * cannot. The Rodden scale is the one Astro-Databank uses; the time confidence
 * is the person's own sense of how exact the clock time is.
 */
import type { BirthInput, RoddenRating, TimeConfidence } from '../types/chart';

export const RODDEN_RATINGS: readonly RoddenRating[] = ['AA', 'A', 'B', 'C', 'DD', 'X', 'XX'];
export const TIME_CONFIDENCES: readonly TimeConfidence[] = ['exact', 'rounded', 'approximate', 'unknown'];

export const RODDEN_LABEL: Record<RoddenRating, string> = {
  AA: 'AA · birth certificate or official record',
  A: 'A · from the person, family or an official announcement',
  B: 'B · from a biography or autobiography',
  C: 'C · caution: vague source or a rectified time',
  DD: 'DD · dirty data: two or more conflicting times',
  X: 'X · date known, no time',
  XX: 'XX · date not confirmed',
};

export const TIME_CONFIDENCE_LABEL: Record<TimeConfidence, string> = {
  exact: 'Exact, to the minute',
  rounded: 'Rounded, to the nearest quarter or hour',
  approximate: 'Approximate, e.g. "early morning"',
  unknown: 'Unknown',
};

export type QualityLevel = 'good' | 'caution' | 'unrated' | 'poor';

export interface BirthQuality {
  level: QualityLevel;
  /** One-line headline for the warning */
  title: string;
  /** What in the chart to hold lightly */
  detail: string;
}

const TIME_SENSITIVE =
  'The lagna, house placements, the D9 and finer divisional charts, and dasha dates all move with the birth time.';

/** null when nothing needs saying (a rated AA or A time given as exact). */
export function birthQuality(input: BirthInput): BirthQuality | null {
  const r = input.rodden;
  const c = input.timeConfidence;
  if (r === 'XX' || r === 'X' || c === 'unknown')
    return {
      level: 'poor',
      title: r === 'XX' ? 'The birth date itself is not confirmed' : 'There is no known birth time',
      detail: `Only the signs and nakshatras of slow planets can be trusted. ${TIME_SENSITIVE} The Moon moves about 13° a day, so even its nakshatra may be wrong.`,
    };
  if (r === 'DD')
    return { level: 'poor', title: 'Conflicting birth times on record', detail: `${TIME_SENSITIVE} Try the birth time finder with a few life events before relying on them.` };
  if (r === 'C' || c === 'approximate')
    return { level: 'caution', title: 'The birth time is uncertain', detail: `${TIME_SENSITIVE} The ascendant moves about one degree every four minutes, so read house-based findings as provisional.` };
  if (c === 'rounded')
    return { level: 'caution', title: 'The birth time looks rounded', detail: 'A time rounded to the hour can be up to 30 minutes off, which moves the D9 navamsa lagna and shifts dasha dates by weeks. The D1 is usually safe.' };
  if (!r)
    return { level: 'unrated', title: 'This birth time is unrated', detail: `Add its Rodden rating under Edit birth details. ${TIME_SENSITIVE}` };
  if (r === 'B') return { level: 'caution', title: 'Birth time from a biography', detail: 'Usually right to the quarter hour. The D1 is safe; treat the D60 and other fine charts with care.' };
  return null;
}

/** True when the time is reliable enough for divisional charts finer than the D9. */
export const fineChartsReliable = (input: BirthInput) => {
  const q = birthQuality(input);
  return !q || (q.level === 'caution' && input.rodden === 'B');
};
