/** Filled in at build time by vite.config.ts (see buildInfo there). */
declare const __BUILD_INFO__: {
  swissEphemeris: string;
  wrapper: string;
  engine: string;
  commit: string;
  builtAt: string;
};

export const BUILD = typeof __BUILD_INFO__ === 'undefined'
  ? { swissEphemeris: 'unknown', wrapper: 'unknown', engine: 'unknown', commit: '', builtAt: '' }
  : __BUILD_INFO__;

export const REPO = 'https://github.com/destinjones/vedic-astrology';

/** "Swiss Ephemeris 2.10.03 · engine 0.1.0 · built 7 Nov 2026 · abc1234" */
export function buildLine(): { text: string; commitUrl: string | null } {
  const built = BUILD.builtAt
    ? new Date(BUILD.builtAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : 'unknown date';
  return {
    text: `Swiss Ephemeris ${BUILD.swissEphemeris} (swisseph-wasm ${BUILD.wrapper}) · engine ${BUILD.engine} · built ${built}`,
    commitUrl: BUILD.commit ? `${REPO}/commit/${BUILD.commit}` : null,
  };
}
