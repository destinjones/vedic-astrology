/**
 * A real star catalogue for the 3D sky: Hipparcos stars to magnitude 5 and the
 * IAU constellation figures, from d3-celestial (BSD-3-Clause, see
 * data/D3-CELESTIAL-LICENSE). Stored as J2000 ecliptic coordinates.
 *
 * Sidereal zodiacs are fixed to the stars, so a star's sidereal longitude
 * barely changes: subtracting the ayanamsa at J2000 is enough. Proper motion is
 * left out (a few arcminutes per century at most, for the brightest stars).
 */
import data from './data/stars.json';

export interface Star {
  /** sidereal longitude, degrees */
  longitude: number;
  /** ecliptic latitude, degrees */
  latitude: number;
  magnitude: number;
  /** B−V colour index: below 0 blue-white, around 0.6 like the Sun, above 1.4 red */
  bv: number;
  name?: string;
}

export interface Constellation {
  id: string;
  name: string;
  /** polylines of [sidereal longitude, latitude] */
  lines: [number, number][][];
}

/** Degrees of precession per Julian year (IAU 2006, at J2000) */
const PRECESSION_PER_YEAR = 50.2879 / 3600;

/** The ayanamsa at J2000 from its value at another moment (both in degrees). */
export const ayanamsaAtJ2000 = (ayanamsaValue: number, jdUt: number) =>
  ayanamsaValue - ((jdUt - 2451545) / 365.25) * PRECESSION_PER_YEAR;

const wrap = (x: number) => ((x % 360) + 360) % 360;

export function stars(ayanamsaJ2000: number): Star[] {
  return (data.stars as (number | string)[][]).map(([lon, lat, mag, bv, name]) => ({
    longitude: wrap((lon as number) - ayanamsaJ2000), latitude: lat as number, magnitude: mag as number, bv: bv as number,
    ...(name ? { name: name as string } : {}),
  }));
}

export function constellations(ayanamsaJ2000: number): Constellation[] {
  return (data.constellations as { id: string; name: string; lines: number[][][] }[]).map((c) => ({
    id: c.id, name: c.name, lines: c.lines.map((seg) => seg.map(([lon, lat]) => [wrap(lon - ayanamsaJ2000), lat] as [number, number])),
  }));
}

/** An approximate sRGB colour for a B−V index. */
export function starColour(bv: number): string {
  const t = Math.max(-0.4, Math.min(2, bv));
  const stops: [number, [number, number, number]][] = [
    [-0.4, [155, 176, 255]], [0, [202, 215, 255]], [0.4, [248, 247, 255]], [0.8, [255, 244, 234]], [1.2, [255, 210, 161]], [2, [255, 180, 120]],
  ];
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [a, ca] = stops[i], [b, cb] = stops[i + 1];
  const f = (t - a) / (b - a);
  const c = ca.map((x, k) => Math.round(x + (cb[k] - x) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
