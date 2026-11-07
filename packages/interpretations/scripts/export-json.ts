/** Writes the knowledge base as JSON files to dist/json for non-TypeScript consumers. */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as kb from '../src';

const out = new URL('../dist/json/', import.meta.url);
mkdirSync(out, { recursive: true });
const dump = (name: string, data: unknown) => writeFileSync(new URL(`${name}.json`, out), JSON.stringify(data, null, 2));
dump('planets', kb.PLANET_PROFILES);
dump('signs', kb.SIGNS);
dump('houses', kb.HOUSES);
dump('nakshatras', kb.NAKSHATRAS);
dump('planet-in-sign', kb.PLANET_IN_SIGN);
dump('planet-in-house', kb.PLANET_IN_HOUSE);
dump('house-lords', kb.HOUSE_LORD_IN);
dump('conjunctions', kb.CONJUNCTIONS);
dump('yogas', kb.YOGA_DEFINITIONS);
dump('doshas', kb.DOSHA_DEFINITIONS);
console.log('wrote', out.pathname);
