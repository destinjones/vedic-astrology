/**
 * Builds the star catalogue for the 3D sky's "Real stars" mode from the
 * d3-celestial data files (BSD-3-Clause, Olaf Frohn; stars from Hipparcos,
 * constellation figures after the IAU and Sky & Telescope).
 *
 *   node tools/build-stars.mjs <path to an unpacked d3-celestial package>
 *   (npm pack d3-celestial@0.7.35 && tar xzf d3-celestial-0.7.35.tgz gives ./package)
 *
 * Positions are converted from J2000 right ascension and declination to J2000
 * ecliptic longitude and latitude, so the browser only subtracts an ayanamsa.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) { console.error('usage: node tools/build-stars.mjs <d3-celestial package dir>'); process.exit(1); }
const read = (f) => JSON.parse(readFileSync(join(src, 'data', f), 'utf8'));
const MAG = 5.0;
const EPS = (23.4392911 * Math.PI) / 180;
const r3 = (x) => Math.round(x * 1000) / 1000;

/** J2000 equatorial (degrees) → J2000 ecliptic [lon 0–360, lat] */
function ecliptic(raDeg, decDeg) {
  const ra = (raDeg * Math.PI) / 180, dec = (decDeg * Math.PI) / 180;
  const lon = Math.atan2(Math.sin(ra) * Math.cos(EPS) + Math.tan(dec) * Math.sin(EPS), Math.cos(ra));
  const lat = Math.asin(Math.sin(dec) * Math.cos(EPS) - Math.cos(dec) * Math.sin(EPS) * Math.sin(ra));
  return [r3((((lon * 180) / Math.PI) % 360 + 360) % 360), r3((lat * 180) / Math.PI)];
}

const names = read('starnames.json');
const stars = read('stars.6.json').features
  .filter((f) => f.properties.mag <= MAG)
  .sort((a, b) => a.properties.mag - b.properties.mag)
  .map((f) => {
    const [lon, lat] = ecliptic(...f.geometry.coordinates);
    const n = names[f.id]?.name;
    return [lon, lat, Math.round(f.properties.mag * 100) / 100, Math.round(Number(f.properties.bv || 0) * 100) / 100, ...(n && f.properties.mag < 2.6 ? [n] : [])];
  });

const meta = Object.fromEntries(read('constellations.json').features.map((f) => [f.id, f.properties.name]));
const lines = read('constellations.lines.json').features.map((f) => ({
  id: f.id,
  name: meta[f.id] ?? f.id,
  lines: f.geometry.coordinates.map((seg) => seg.map(([ra, dec]) => ecliptic(ra, dec))),
}));

const out = join(dirname(fileURLToPath(import.meta.url)), '../packages/sky/src/data/stars.json');
writeFileSync(out, JSON.stringify({
  source: 'd3-celestial 0.7.35 (BSD-3-Clause, Olaf Frohn): Hipparcos stars to magnitude 5 and IAU constellation figures',
  epoch: 'J2000 ecliptic, degrees',
  fields: 'lon,lat,mag,bv[,name]',
  stars,
  constellations: lines,
}));
console.log(`${stars.length} stars, ${lines.length} constellations → ${out}`);
