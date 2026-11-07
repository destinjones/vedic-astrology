/**
 * Argala (intervention) on a sign, Jaimini Upadesa Sutras 1.1.5–9 and BPHS
 * ch. 31. Planets in the 2nd, 4th and 11th from a sign intervene in it (the
 * 5th gives a secondary argala); planets in the 12th, 10th and 3rd (and the
 * 9th) obstruct those, as virodha argala. An argala holds when its planets
 * outnumber the obstructers. Malefics in the 3rd also give argala of their own
 * (vipareeta argala). Ketu is counted in reverse, so Ketu in the 12th acts on
 * the 2nd-house argala and so on.
 */
import type { GrahaId, SignNumber } from '@vedic/engine';
import type { JaiminiInput } from './core';

const GRAHAS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const MALEFICS: GrahaId[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];
const signOfLon = (lon: number) => (Math.floor((((lon % 360) + 360) % 360) / 30) + 1) as SignNumber;

/** Argala house and the house that obstructs it */
export const ARGALA_PAIRS: { from: number; virodha: number; kind: 'primary' | 'secondary' }[] = [
  { from: 2, virodha: 12, kind: 'primary' },
  { from: 4, virodha: 10, kind: 'primary' },
  { from: 11, virodha: 3, kind: 'primary' },
  { from: 5, virodha: 9, kind: 'secondary' },
];

export interface ArgalaEntry {
  /** House (from the sign judged) that gives argala */
  from: number;
  virodha: number;
  kind: 'primary' | 'secondary' | 'vipareeta';
  givers: GrahaId[];
  obstructers: GrahaId[];
  /** holds: givers outnumber obstructers; obstructed: they do not */
  status: 'holds' | 'obstructed';
}

export interface ArgalaOnSign {
  sign: SignNumber;
  entries: ArgalaEntry[];
  /** Planets whose argala on this sign holds */
  effective: GrahaId[];
}

export function argalaOn(input: JaiminiInput, sign: number): ArgalaOnSign {
  const houseOf = (g: GrahaId) => {
    const h = ((signOfLon(input.planets[g]) - sign + 12) % 12) + 1;
    return g === 'ketu' ? ((14 - h - 1) % 12) + 1 : h; // reverse count for Ketu: 2 <-> 12, 4 <-> 10 …
  };
  const at = (h: number) => GRAHAS.filter((g) => houseOf(g) === h);
  const entries: ArgalaEntry[] = [];
  for (const p of ARGALA_PAIRS) {
    const givers = at(p.from);
    if (!givers.length) continue;
    const obstructers = at(p.virodha);
    entries.push({ ...p, givers, obstructers, status: givers.length > obstructers.length ? 'holds' : 'obstructed' });
  }
  const third = at(3).filter((g) => MALEFICS.includes(g));
  if (third.length) {
    const obstructers = at(11);
    entries.push({ from: 3, virodha: 11, kind: 'vipareeta', givers: third, obstructers, status: third.length > obstructers.length ? 'holds' : 'obstructed' });
  }
  const effective = [...new Set(entries.filter((e) => e.status === 'holds').flatMap((e) => e.givers))];
  return { sign: sign as SignNumber, entries, effective };
}
