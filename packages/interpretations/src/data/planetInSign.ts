/**
 * Planet in sign: original interpretations for all 9 grahas × 12 signs (108 entries).
 * Each entry: [summary, detail, strengths, challenges].
 * Tone and score are derived from dignity at lookup time (see interpret.ts).
 *
 * The text lives in content/planet-in-sign/*.yaml. Edit it there; see content/STYLE.md.
 */
import { PLANET_IN_SIGN_TEXT } from './generated/content';

export type SignEntry = [summary: string, detail: string, strengths: string[], challenges: string[]];

export const PLANET_IN_SIGN = PLANET_IN_SIGN_TEXT;
