/**
 * Fallback ephemeris built on astronomy-engine (pure JS, VSOP87/ELP-grade).
 * Accuracy: well under 0.01 deg for planets in 1800-2200, which is ample for
 * transit and station timing. The engine's Swiss Ephemeris adapter supersedes it.
 */
import * as A from 'astronomy-engine';
import { type Ephemeris, type Planet, type PlanetPosition, type Positions, PLANETS } from '../types';
import { norm360 } from '../astro';

const BODY: Partial<Record<Planet, A.Body>> = {
  Sun: A.Body.Sun, Moon: A.Body.Moon, Mars: A.Body.Mars, Mercury: A.Body.Mercury,
  Jupiter: A.Body.Jupiter, Venus: A.Body.Venus, Saturn: A.Body.Saturn,
};

const J2000 = Date.UTC(2000, 0, 1, 12);
const centuries = (d: Date) => (d.getTime() - J2000) / (36525 * 86_400_000);

/** Lahiri (Chitrapaksha) ayanamsa, mean, in degrees. */
export function lahiriAyanamsa(d: Date): number {
  const T = centuries(d);
  return 23.85709 + (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

/** Mean lunar node (Rahu), tropical. */
function meanNode(d: Date): number {
  const T = centuries(d);
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}

function tropical(planet: Planet, d: Date): number {
  if (planet === 'Rahu') return meanNode(d);
  if (planet === 'Ketu') return norm360(meanNode(d) + 180);
  if (planet === 'Moon') return A.EclipticGeoMoon(d).lon;
  if (planet === 'Sun') return A.SunPosition(d).elon;
  return A.Ecliptic(A.GeoVector(BODY[planet]!, d, true)).elon;
}

export function siderealLongitude(planet: Planet, d: Date, ayanamsa = lahiriAyanamsa): number {
  return norm360(tropical(planet, d) - ayanamsa(d));
}

export function createAstronomyEphemeris(ayanamsa: (d: Date) => number = lahiriAyanamsa): Ephemeris {
  const position = (planet: Planet, d: Date): PlanetPosition => {
    const h = planet === 'Moon' ? 1 / 24 : 0.5; // days
    const a = siderealLongitude(planet, new Date(d.getTime() - h * 43_200_000), ayanamsa);
    const b = siderealLongitude(planet, new Date(d.getTime() + h * 43_200_000), ayanamsa);
    const diff = ((b - a + 540) % 360) - 180;
    return { longitude: siderealLongitude(planet, d, ayanamsa), speed: diff / h };
  };
  return {
    position,
    positions(d: Date) {
      const out = {} as Positions;
      for (const p of PLANETS) out[p] = position(p, d);
      return out;
    },
  };
}

/** Convenience: build a NatalChart-compatible planets object for a birth instant. */
export function ascendantSidereal(d: Date, latDeg: number, lonDeg: number, ayanamsa = lahiriAyanamsa): number {
  const gst = A.SiderealTime(d); // hours
  const ramc = norm360(gst * 15 + lonDeg);
  const T = centuries(d);
  const eps = (23.439291 - 0.0130042 * T) * (Math.PI / 180);
  const r = ramc * (Math.PI / 180), phi = latDeg * (Math.PI / 180);
  const asc = Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps)));
  return norm360(norm360((asc * 180) / Math.PI) - ayanamsa(d));
}
