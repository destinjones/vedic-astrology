/**
 * Birth details that only last for this visit.
 *
 * The chart last opened in the explorer (so the other pages, such as matching,
 * KP, the study tools and the position check, can start from it) and the pairs
 * on the matching and compare pages live in sessionStorage, not localStorage:
 * they last while this browser tab is open and are gone once it closes. An
 * astrologer sees one client after another, often on a shared computer, so the
 * next person to open the app must never find the previous person's birth
 * details already filled in. Charts the astrologer chooses to keep go in saved
 * charts (lib/profiles.ts), which stay in this browser only.
 */
export const LAST_CHART_KEY = 'vedic.lastInput';

const migrated = new Set<string>();
/** Older versions kept these in localStorage, where they outlived the visit. */
function dropLegacy(key: string): void {
  if (migrated.has(key)) return;
  migrated.add(key);
  try { localStorage.removeItem(key); } catch { /* storage blocked */ }
}

/** The raw parsed value kept for this visit under `key`, or null. Callers check its shape. */
export function readVisit(key: string): unknown {
  dropLegacy(key);
  try {
    const s = sessionStorage.getItem(key);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function writeVisit(key: string, value: unknown): void {
  dropLegacy(key);
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

/** Clears what older versions left in localStorage. The explorer calls it on start. */
export function forgetLegacyVisitData(): void {
  for (const k of [LAST_CHART_KEY, 'vedic.match', 'vedic.compare.v1', 'vedic.rectify.v2']) dropLegacy(k);
}

export const readLastChart = (): unknown => readVisit(LAST_CHART_KEY);
export const writeLastChart = (input: unknown): void => writeVisit(LAST_CHART_KEY, input);
