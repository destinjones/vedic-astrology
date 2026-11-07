/**
 * Every English reading in the knowledge base as { id, text }, for the readability
 * check and the coverage report.
 */
import { CONJUNCTIONS } from '../data/conditions';
import { HOUSE_LORD_IN } from '../data/houseLords';
import { PLANET_IN_HOUSE } from '../data/planetInHouse';
import { PLANET_IN_SIGN } from '../data/planetInSign';
import { DOSHA_DEFINITIONS } from '../doshas';
import { getPlanetInNakshatra } from '../interpret';
import { PLANETS } from '../types';
import { YOGA_DEFINITIONS } from '../yogas';

export interface CorpusText { id: string; text: string }

export function englishCorpus(): CorpusText[] {
  const out: CorpusText[] = [];
  const add = (id: string, summary: string, detail: string | string[]) => out.push({ id, text: [summary, ...[detail].flat()].join(' ') });
  for (const p of PLANETS) {
    PLANET_IN_SIGN[p].forEach((e, i) => add(`sign:${p}:${i + 1}`, e[0], e[1]));
    PLANET_IN_HOUSE[p].forEach((e, i) => add(`house:${p}:${i + 1}`, e[0], e[1]));
    for (let n = 1; n <= 27; n++) {
      const r = getPlanetInNakshatra(p, n);
      add(`nakshatra:${p}:${n}`, r.summary, r.detail);
    }
  }
  HOUSE_LORD_IN.forEach((row, a) => row.forEach((e, b) => add(`lord:${a + 1}:${b + 1}`, e[0], e[1])));
  for (const [k, e] of Object.entries(CONJUNCTIONS)) add(`conjunction:${k}`, e[0], e[1]);
  for (const y of Object.values(YOGA_DEFINITIONS)) add(`yoga:${y.id}`, y.reading.summary, y.reading.detail);
  for (const d of Object.values(DOSHA_DEFINITIONS)) add(`dosha:${d.id}`, d.reading.summary, d.reading.detail);
  return out;
}
