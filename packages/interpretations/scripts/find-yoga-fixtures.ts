/**
 * Searches random synthetic charts for one that forms each yoga, and prints the
 * first hit per yoga as a compact fixture. Used once to seed
 * test/fixtures/yoga-charts.json; rerun it to find a chart for a new yoga:
 *
 *   npx tsx scripts/find-yoga-fixtures.ts [yoga-id ...]
 */
import { YOGA_DEFINITIONS, detectYogas, type ChartInput, type PlanetId } from '../src';
import { chartFromFixture, type YogaFixture } from '../test/fixtures/chart';

let seed = 20261107;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const SEVEN: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

function randomFixture(): YogaFixture {
  const k = 1 + Math.floor(rnd() * 8); // number of occupied signs for the seven
  const start = 1 + Math.floor(rnd() * 12);
  const contiguous = rnd() < 0.5;
  const pool = Array.from({ length: k }, (_, i) => (contiguous ? ((start - 1 + i) % 12) + 1 : 1 + Math.floor(rnd() * 12)));
  const signs: Partial<Record<PlanetId, number>> = {};
  const degrees: Partial<Record<PlanetId, number>> = {};
  for (const p of SEVEN) {
    signs[p] = pick(pool);
    degrees[p] = Math.round(rnd() * 2900) / 100;
  }
  // keep Mercury and Venus near the Sun most of the time, as in a real sky
  if (rnd() < 0.7) signs.mercury = ((signs.sun! - 1 + pick([0, 0, 1, 11])) % 12) + 1;
  if (rnd() < 0.7) signs.venus = ((signs.sun! - 1 + pick([0, 1, 11, 2, 10])) % 12) + 1;
  signs.rahu = 1 + Math.floor(rnd() * 12);
  degrees.rahu = Math.round(rnd() * 2900) / 100;
  return { asc: 1 + Math.floor(rnd() * 12), signs: signs as YogaFixture['signs'], degrees };
}

const wanted = new Set(process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(YOGA_DEFINITIONS));
const found: Record<string, YogaFixture> = {};
for (let i = 0; i < 2_000_000 && Object.keys(found).length < wanted.size; i++) {
  const f = randomFixture();
  const chart: ChartInput = chartFromFixture(f);
  for (const y of detectYogas(chart)) if (wanted.has(y.id) && !found[y.id]) found[y.id] = f;
}
console.log(JSON.stringify(found, null, 2));
const missing = [...wanted].filter((id) => !found[id]);
if (missing.length) console.error('not found:', missing.join(', '));
