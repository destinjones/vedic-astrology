/**
 * Core types for the timing layer. These are intentionally minimal so the
 * package can sit on top of the chart engine through a thin adapter
 * (see `adapters/`), while still running standalone in tests.
 */

export const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'] as const;
export type Planet = (typeof PLANETS)[number];

/** The seven planets that have an ashtakavarga and real retrograde motion (Sun/Moon excepted for retro). */
export const SEVEN = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'] as const;
export type SevenPlanet = (typeof SEVEN)[number];

export const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
] as const;
export type SignName = (typeof SIGNS)[number];

/** Sign index 0 = Aries ... 11 = Pisces. */
export type SignIndex = number;

export interface PlanetPosition {
  /** Sidereal ecliptic longitude in degrees, 0 <= lon < 360. */
  longitude: number;
  /** Longitudinal speed in degrees per day (negative = retrograde). */
  speed: number;
}

export type Positions = Record<Planet, PlanetPosition>;

/** What the timing layer needs from a natal chart. */
export interface NatalChart {
  /** Birth instant (UTC). */
  birth: Date;
  /** Sidereal ascendant longitude in degrees. */
  ascendant: number;
  /** Sidereal natal positions of the nine grahas. */
  planets: Positions;
}

/**
 * Supplies sidereal positions for any instant. The engine's Swiss Ephemeris
 * implementation plugs in here; `astronomyEphemeris` is the built-in fallback.
 */
export interface Ephemeris {
  positions(date: Date): Positions;
  /** Optional faster single-planet lookup. */
  position?(planet: Planet, date: Date): PlanetPosition;
}

export type Tone = 'excellent' | 'good' | 'mixed' | 'challenging' | 'difficult';

export interface Reason {
  /** Signed contribution to the score. */
  weight: number;
  text: string;
}

export interface Scored {
  /** -100 (very difficult) .. +100 (very favourable). */
  score: number;
  tone: Tone;
  reasons: Reason[];
}
