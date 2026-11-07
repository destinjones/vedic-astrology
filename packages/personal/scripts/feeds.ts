/**
 * Writes one panchanga subscription feed per city in FEED_CITIES:
 *   <out>/panchanga-<slug>.ics   about 13 months from today
 *   <out>/index.json             the list, for the app's picker
 *
 *   npm run feeds -w @vedic/personal -- apps/web/dist/feeds
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createEngine } from '@vedic/engine';
import { FEED_CITIES, panchangaDays, panchangaIcs } from '../src/ics';

const out = resolve(process.cwd(), process.argv[2] ?? 'feeds');
mkdirSync(out, { recursive: true });
const engine = await createEngine();
// the commit time when SOURCE_DATE_EPOCH is set, so two builds of one commit write identical feeds
const now = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
const from = new Date(now.getTime() - 31 * 86_400_000);
for (const city of FEED_CITIES) {
  const days = panchangaDays(engine, { place: city, from, days: 400 });
  writeFileSync(join(out, `panchanga-${city.slug}.ics`), panchangaIcs(days, { name: `Panchanga · ${city.name}`, place: city, uidSuffix: city.slug, now }));
}
writeFileSync(join(out, 'index.json'), JSON.stringify({ generated: now.toISOString(), cities: FEED_CITIES.map(({ slug, name, timezone }) => ({ slug, name, timezone, file: `panchanga-${slug}.ics` })) }, null, 1));
console.log(`wrote ${FEED_CITIES.length} feeds to ${out}`);
engine.close();
