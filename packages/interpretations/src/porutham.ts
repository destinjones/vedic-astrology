/**
 * Dashakoota, the South Indian ten porutham match.
 *
 * Tamil and Kerala practice reads a couple through ten poruthams (agreements)
 * instead of the 36-guna Ashtakoota. Most are counted from the bride's
 * nakshatra to the groom's. Each porutham either agrees, half-agrees or does
 * not, and two of them (Rajju and Vedha) are treated as essential: a failed
 * Rajju or Vedha usually rules a match out whatever the rest say.
 *
 * As in matching.ts, `a` sits in the groom's seat and `b` in the bride's.
 * Families and almanacs differ on several cells (Rasi especially); where they
 * do, the reading used is named in the explanation. All text is original.
 */
import { getNakshatra } from './data/nakshatras';
import { PLANET_PROFILES } from './data/planets';
import { getSign } from './data/signs';
import { matchPerson, relation, YONI_ENEMY, YONI_ORDER, YONI_TABLE, type MatchPerson } from './matching';
import type { ChartInput, PlanetId } from './types';

export type PoruthamId =
  | 'dina' | 'gana' | 'mahendra' | 'stree_deergha' | 'yoni'
  | 'rasi' | 'rasi_adhipati' | 'vasya' | 'rajju' | 'vedha';

export type PoruthamResultKind = 'match' | 'partial' | 'no';

export type Rajju = 'Pada' | 'Kati' | 'Nabhi' | 'Kantha' | 'Siro';

export interface PoruthamRow {
  id: PoruthamId;
  name: string;
  /** What it judges */
  area: string;
  result: PoruthamResultKind;
  /** 1 for a match, 0.5 for partial, 0 for no */
  points: number;
  /** Rajju and Vedha: a failure here is usually decisive */
  essential: boolean;
  values: { a: string; b: string };
  explanation: string;
}

export type PoruthamVerdict = 'good' | 'acceptable' | 'weak' | 'not_recommended';

export interface PoruthamResult {
  rows: PoruthamRow[];
  /** Matches counted, with partial ones as half, out of 10 */
  score: number;
  max: 10;
  verdict: PoruthamVerdict;
  verdictLabel: string;
  summary: string;
  /** Count from the bride's star to the groom's, 1–27 */
  starCount: number;
  rajju: { a: Rajju; b: Rajju };
}

const nm = (p: PlanetId) => PLANET_PROFILES[p].name;
const signName = (s: number) => getSign(s).name;
const nak = (n: number) => getNakshatra(n).name;

/** Count from star `from` to star `to`, inclusive: 1 = the same star */
export const starCount = (from: number, to: number) => ((((to - from) % 27) + 27) % 27) + 1;
const signCount = (from: number, to: number) => ((((to - from) % 12) + 12) % 12) + 1;

const RAJJU_CYCLE: Rajju[] = ['Pada', 'Kati', 'Nabhi', 'Kantha', 'Siro', 'Kantha', 'Nabhi', 'Kati', 'Pada'];
/** Rajju (the "cord") of a nakshatra: the stars climb foot to head and back down in nines */
export const rajjuOf = (n: number): Rajju => RAJJU_CYCLE[(n - 1) % 9];
const RAJJU_RISK: Record<Rajju, string> = {
  Siro: 'Siro (head) rajju, which the texts tie to the husband’s long life',
  Kantha: 'Kantha (neck) rajju, which the texts tie to the wife’s well-being',
  Nabhi: 'Nabhi (navel) rajju, which the texts tie to children',
  Kati: 'Kati (waist) rajju, which the texts tie to the household’s means',
  Pada: 'Pada (foot) rajju, which the texts tie to restless wandering and separation',
};

/** Vedha (obstruction) pairs of nakshatras; Mrigashira, Chitra and Dhanishta all obstruct each other */
const VEDHA_PAIRS: [number, number][] = [
  [1, 18], [2, 17], [3, 16], [4, 15], [6, 22], [7, 21], [8, 20], [9, 19], [10, 27], [11, 26], [12, 25], [13, 24],
  [5, 14], [5, 23], [14, 23],
];
export const vedhaBetween = (x: number, y: number) => VEDHA_PAIRS.some(([p, q]) => (p === x && q === y) || (p === y && q === x));

/** Tamil vasya: the signs each sign holds sway over */
const VASYA: Record<number, number[]> = {
  1: [5, 8], 2: [4, 7], 3: [6], 4: [8, 9], 5: [7], 6: [12, 3], 7: [6, 10], 8: [4], 9: [12], 10: [1, 11], 11: [1], 12: [10],
};

const row = (
  id: PoruthamId, name: string, area: string, result: PoruthamResultKind,
  values: { a: string; b: string }, explanation: string, essential = false,
): PoruthamRow => ({ id, name, area, result, points: result === 'match' ? 1 : result === 'partial' ? 0.5 : 0, essential, values, explanation });

function dina(A: MatchPerson, B: MatchPerson, n: number): PoruthamRow {
  const r = n % 9;
  const v = { a: A.nakshatraName, b: B.nakshatraName };
  if (n === 1)
    return row('dina', 'Dina', 'day-to-day health and harmony', 'partial', v, 'Both are born in the same star. Some stars are accepted when shared (Rohini, Ardra, Magha, Hasta, Vishakha, Shravana, U.Ashadha, Revati) and others are not, so families read this case differently.');
  const ok = [0, 2, 4, 6, 8].includes(r);
  return row('dina', 'Dina', 'day-to-day health and harmony', ok ? 'match' : 'no', v,
    `Counting from the bride’s star to the groom’s gives ${n}; divided by 9 that leaves ${r}. ${ok ? 'An even remainder (or none) is the agreeing case, read as good health and a smooth daily life together.' : 'An odd remainder does not agree; the tradition reads it as friction in daily life and health worries.'}`);
}

function gana(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const v = { a: A.gana, b: B.gana };
  if (A.gana === B.gana) return row('gana', 'Gana', 'temperament', 'match', v, `Both are ${A.gana} gana, the best case: the same basic nature.`);
  if (A.gana !== 'Rakshasa' && B.gana !== 'Rakshasa') return row('gana', 'Gana', 'temperament', 'match', v, `${A.gana} and ${B.gana} agree; Deva and Manushya natures sit well together.`);
  if (A.gana === 'Rakshasa' && B.gana === 'Manushya')
    return row('gana', 'Gana', 'temperament', 'partial', v, 'A Rakshasa groom with a Manushya bride is accepted by some almanacs and refused by others.');
  return row('gana', 'Gana', 'temperament', 'no', v, `${A.gana} with ${B.gana} does not agree: the fierce Rakshasa nature is held to overwhelm the other.`);
}

function mahendra(A: MatchPerson, B: MatchPerson, n: number): PoruthamRow {
  const ok = [4, 7, 10, 13, 16, 19, 22, 25].includes(n);
  return row('mahendra', 'Mahendra', 'children and prosperity', ok ? 'match' : 'no', { a: A.nakshatraName, b: B.nakshatraName },
    `The groom’s star is ${n} from the bride’s. ${ok ? 'The 4th, 7th, 10th, 13th, 16th, 19th, 22nd and 25th agree, read as growth of family and wealth.' : 'Mahendra agrees only at the 4th, 7th, 10th and so on in steps of three; this count is not one of them.'}`);
}

function streeDeergha(A: MatchPerson, B: MatchPerson, n: number): PoruthamRow {
  const result: PoruthamResultKind = n > 13 ? 'match' : n >= 7 ? 'partial' : 'no';
  return row('stree_deergha', 'Stree Deergha', 'the bride’s welfare and long happiness', result, { a: A.nakshatraName, b: B.nakshatraName },
    `The groom’s star is ${n} from the bride’s. ${result === 'match' ? 'More than 13 stars apart agrees fully.' : result === 'partial' ? 'Between 7 and 13 stars apart is accepted by some almanacs as a half agreement.' : 'Fewer than 7 stars apart does not agree.'}`);
}

function yoni(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const v = { a: A.yoni, b: B.yoni };
  if (A.yoni === B.yoni) return row('yoni', 'Yoni', 'physical and intimate harmony', 'match', v, `Both stars carry the ${A.yoni} yoni.`);
  if (YONI_ENEMY[A.yoni] === B.yoni) return row('yoni', 'Yoni', 'physical and intimate harmony', 'no', v, `${A.yoni} and ${B.yoni} are sworn enemies, so Yoni does not agree.`);
  const pts = YONI_TABLE[YONI_ORDER.indexOf(A.yoni)][YONI_ORDER.indexOf(B.yoni)];
  return row('yoni', 'Yoni', 'physical and intimate harmony', pts >= 2 ? 'match' : 'partial', v,
    pts >= 2 ? `${A.yoni} and ${B.yoni} are friendly or neutral animals, so Yoni agrees.` : `${A.yoni} and ${B.yoni} are unfriendly but not sworn enemies: a half agreement.`);
}

function rasi(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const r = signCount(B.moonSign, A.moonSign);
  const v = { a: A.moonSignName, b: B.moonSignName };
  const base = `The groom’s Moon sign is ${r === 1 ? 'the same as' : `${r}${r === 2 ? 'nd' : r === 3 ? 'rd' : 'th'} from`} the bride’s.`;
  if (r === 1)
    return row('rasi', 'Rasi', 'the bond and family line', A.nakshatra !== B.nakshatra ? 'match' : 'partial', v,
      `${base} One sign with different stars agrees; one sign and one star is accepted only for some stars.`);
  if (r === 7) return row('rasi', 'Rasi', 'the bond and family line', 'match', v, `${base} The 7th, facing each other, is the best Rasi agreement.`);
  if ([6, 8].includes(r)) return row('rasi', 'Rasi', 'the bond and family line', 'no', v, `${base} Sixth and eighth from each other (shashtashtaka) is the hardest position, read as quarrels and health trouble.`);
  if ([2, 12].includes(r)) return row('rasi', 'Rasi', 'the bond and family line', 'no', v, `${base} Second and twelfth from each other (dvirdvadasha) is read as strain on money.`);
  if ([5, 9].includes(r)) return row('rasi', 'Rasi', 'the bond and family line', 'partial', v, `${base} Fifth and ninth (navapanchama) is refused by some almanacs and accepted by others.`);
  return row('rasi', 'Rasi', 'the bond and family line', 'match', v, `${base} This position agrees.`);
}

function rasiAdhipati(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const la = A.moonSignLord, lb = B.moonSignLord;
  const v = { a: `${A.moonSignName} (${nm(la)})`, b: `${B.moonSignName} (${nm(lb)})` };
  if (la === lb) return row('rasi_adhipati', 'Rasi Adhipati', 'understanding between the families', 'match', v, `Both Moon signs are ruled by ${nm(la)}.`);
  const r1 = relation(la, lb), r2 = relation(lb, la);
  if (r1 === 'enemy' || r2 === 'enemy')
    return row('rasi_adhipati', 'Rasi Adhipati', 'understanding between the families', 'no', v, `${nm(la)} and ${nm(lb)} are not friendly (${nm(r1 === 'enemy' ? la : lb)} counts the other an enemy), so the lords do not agree.`);
  if (r1 === 'friend' && r2 === 'friend') return row('rasi_adhipati', 'Rasi Adhipati', 'understanding between the families', 'match', v, `${nm(la)} and ${nm(lb)} are mutual friends.`);
  return row('rasi_adhipati', 'Rasi Adhipati', 'understanding between the families', 'partial', v, `${nm(la)} and ${nm(lb)} are neutral to each other on at least one side: a half agreement.`);
}

function vasya(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const ab = VASYA[B.moonSign]?.includes(A.moonSign);
  const ba = VASYA[A.moonSign]?.includes(B.moonSign);
  const v = { a: A.moonSignName, b: B.moonSignName };
  if (ab || ba)
    return row('vasya', 'Vasya', 'mutual attraction', 'match', v,
      `${ab ? `${signName(A.moonSign)} is vasya (drawn) to the bride’s ${signName(B.moonSign)}` : `${signName(B.moonSign)} is vasya (drawn) to the groom’s ${signName(A.moonSign)}`}${ab && ba ? ', and the reverse holds too' : ''}.`);
  return row('vasya', 'Vasya', 'mutual attraction', 'no', v, `Neither Moon sign is in the other’s vasya list, so this agreement is missing. It is one of the lighter poruthams.`);
}

function rajju(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const ra = rajjuOf(A.nakshatra), rb = rajjuOf(B.nakshatra);
  const same = ra === rb;
  return row('rajju', 'Rajju', 'the life of the marriage itself', same ? 'no' : 'match', { a: `${ra} (${A.nakshatraName})`, b: `${rb} (${B.nakshatraName})` },
    same
      ? `Both stars fall in ${RAJJU_RISK[ra]}. Rajju dosha is the most feared failure in Porutham, and most families do not proceed with it.`
      : `${A.nakshatraName} is ${ra} rajju and ${B.nakshatraName} is ${rb} rajju. Different rajjus agree.`, true);
}

function vedha(A: MatchPerson, B: MatchPerson): PoruthamRow {
  const hit = vedhaBetween(A.nakshatra, B.nakshatra);
  return row('vedha', 'Vedha', 'freedom from affliction', hit ? 'no' : 'match', { a: A.nakshatraName, b: B.nakshatraName },
    hit ? `${nak(A.nakshatra)} and ${nak(B.nakshatra)} are a vedha (obstructing) pair. Like Rajju, a Vedha failure usually rules the match out.` : 'The two stars are not a vedha (obstructing) pair.', true);
}

/** The ten poruthams for a couple, `a` in the groom's seat and `b` in the bride's */
export function porutham(a: ChartInput, b: ChartInput): PoruthamResult {
  const A = matchPerson(a), B = matchPerson(b);
  const n = starCount(B.nakshatra, A.nakshatra);
  const rows = [dina(A, B, n), gana(A, B), mahendra(A, B, n), streeDeergha(A, B, n), yoni(A, B), rasi(A, B), rasiAdhipati(A, B), vasya(A, B), rajju(A, B), vedha(A, B)];
  const score = rows.reduce((s, r) => s + r.points, 0);
  const failedEssential = rows.filter((r) => r.essential && r.result === 'no');
  let verdict: PoruthamVerdict;
  if (failedEssential.length) verdict = 'not_recommended';
  else if (score >= 7) verdict = 'good';
  else if (score >= 5) verdict = 'acceptable';
  else verdict = 'weak';
  const label: Record<PoruthamVerdict, string> = {
    good: 'Good porutham',
    acceptable: 'Acceptable porutham',
    weak: 'Few poruthams agree',
    not_recommended: `${failedEssential.map((r) => r.name).join(' and ')} dosha`,
  };
  const fmt = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));
  const agree = rows.filter((r) => r.result === 'match').map((r) => r.name);
  const summary = [
    `${fmt(score)} of 10 poruthams agree.`,
    failedEssential.length
      ? `${failedEssential.map((r) => r.name).join(' and ')} ${failedEssential.length > 1 ? 'fail' : 'fails'}, and South Indian practice treats ${failedEssential.length > 1 ? 'these' : 'this'} as decisive, so most families would not proceed on the stars alone.`
      : 'Rajju and Vedha, the two essential poruthams, both agree.',
    verdict === 'good' ? 'Most almanacs accept six or more with Rajju clear.' : verdict === 'acceptable' ? 'Five or six with Rajju clear is usually accepted.' : verdict === 'weak' ? 'Fewer than five agreeing is generally not recommended without a closer look at the full charts.' : '',
    agree.length ? `Agreeing: ${agree.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  return { rows, score, max: 10, verdict, verdictLabel: label[verdict], summary, starCount: n, rajju: { a: rajjuOf(A.nakshatra), b: rajjuOf(B.nakshatra) } };
}
