/** Small shared helpers. Kept here so the package has no UI dependencies. */

export const norm360 = (x: number) => ((x % 360) + 360) % 360;
export const DAY_MS = 86_400_000;
export const NAK_SPAN = 360 / 27;

/** 1-based sign of a sidereal longitude. */
export const signOf = (lon: number) => Math.floor(norm360(lon) / 30) + 1;
/** 1-based nakshatra of a sidereal longitude. */
export const nakshatraOf = (lon: number) => Math.min(27, Math.floor(norm360(lon) / NAK_SPAN) + 1);
/** 1-based pada (quarter) of the nakshatra. */
export const padaOf = (lon: number) => Math.min(4, Math.floor((norm360(lon) % NAK_SPAN) / (NAK_SPAN / 4)) + 1);
/** House of `sign` counted from `from` (both 1-based), 1–12. */
export const houseFrom = (from: number, sign: number) => ((sign - from + 12) % 12) + 1;

/** Small fast deterministic PRNG (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash of a string, for seeding. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const SIGN_NAMES = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const NAKSHATRA_NAMES = [
  'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
  'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];
export const PLANET_NAMES: Record<string, string> = {
  sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter',
  venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu', asc: 'Ascendant',
};
export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Degrees and minutes within the sign, e.g. 14°07′. */
export function dm(lon: number): string {
  const d = norm360(lon) % 30;
  let deg = Math.floor(d);
  let min = Math.round((d - deg) * 60);
  if (min === 60) { deg += 1; min = 0; }
  return `${deg}°${String(min).padStart(2, '0')}′`;
}

/** Whole days from a to b, rounded up so "ends in 0 days" only on the day itself. */
export const daysBetween = (a: Date, b: Date) => Math.ceil((b.getTime() - a.getTime()) / DAY_MS);
