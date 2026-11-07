/**
 * Builds the offline place gazetteer the birth form searches before (or instead
 * of) any online lookup, so a place can be found with nothing leaving the browser.
 *
 * Source: GeoNames cities1000 as packaged by the all-the-cities npm package
 * (CC BY 4.0, https://www.geonames.org/). Kept: every place of 15,000 people or
 * more worldwide, and every place of 1,000 or more in South Asia, where most
 * charts on this site are cast. Time zones are looked up once here, offline.
 *
 *   node tools/build-gazetteer.mjs   →  apps/web/src/data/gazetteer.json
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cities = require('all-the-cities');
const tzlookup = require('tz-lookup');

const SOUTH_ASIA = new Set(['IN', 'NP', 'LK', 'BD', 'PK', 'BT', 'MV']);
const keep = cities.filter((c) => c.population >= 15000 || (SOUTH_ASIA.has(c.country) && c.population >= 1000));
keep.sort((a, b) => b.population - a.population);

const zones = [];
const zoneIndex = new Map();
const rows = [];
for (const c of keep) {
  const [lon, lat] = c.loc.coordinates;
  let tz;
  try { tz = tzlookup(lat, lon); } catch { continue; }
  if (!zoneIndex.has(tz)) { zoneIndex.set(tz, zones.length); zones.push(tz); }
  // numeric admin codes mean nothing to a reader; letter codes (US states, Canadian provinces) do
  const admin = /^[A-Z]{2,3}$/.test(c.adminCode) ? c.adminCode : '';
  const clean = (s) => String(s).replace(/[|\n]/g, ' ').trim();
  rows.push([clean(c.name), c.country, admin, +lat.toFixed(4), +lon.toFixed(4), c.population, zoneIndex.get(tz), clean(c.altName ?? '')].join('|'));
}

const out = join(dirname(fileURLToPath(import.meta.url)), '../apps/web/src/data/gazetteer.json');
writeFileSync(out, JSON.stringify({
  source: 'GeoNames cities1000 via all-the-cities 3.1.0, CC BY 4.0, https://www.geonames.org/',
  fields: 'name|country|admin|lat|lon|population|zone|altName',
  zones,
  rows: rows.join('\n'),
}));
console.log(`${rows.length} places, ${zones.length} zones → ${out}`);
