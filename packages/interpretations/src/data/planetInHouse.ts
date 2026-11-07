/**
 * Planet in house: original interpretations for all 9 grahas × 12 houses (108 entries).
 * Each entry: [summary, detail, strengths, challenges, baseScore].
 * baseScore (-3..+3) reflects the general classical weighting of the placement
 * before dignity, aspects and yogas are taken into account.
 *
 * The text lives in content/planet-in-house/*.yaml. Edit it there; see content/STYLE.md.
 */
import { PLANET_IN_HOUSE_TEXT } from './generated/content';

export type HouseEntry = [summary: string, detail: string, strengths: string[], challenges: string[], baseScore: number];

export const PLANET_IN_HOUSE = PLANET_IN_HOUSE_TEXT;
