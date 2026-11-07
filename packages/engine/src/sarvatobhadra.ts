/**
 * Sarvatobhadra chakra: the 9 × 9 board for reading transits against a
 * birth chart (Narapati Jayacharya, Brihat Samhita tradition).
 *
 * The outer ring holds the 28 nakshatras (Abhijit included), seven to a side,
 * running clockwise from Krittika at the top (east). Inside it come the 20
 * Avakahada letters, then the 12 signs, then the tithi groups (Nanda, Bhadra,
 * Jaya, Rikta) with their weekdays around Purna in the centre. Vowels sit in
 * the corners of each ring.
 *
 * A graha in a nakshatra strikes (vedha) every cell along three lines from
 * that star: the straight line across the board (opposite), and the two
 * diagonals, which run forward (clockwise) and backward. Direct motion
 * stresses the forward diagonal, retrograde motion the backward one, and a
 * stationary graha the opposite line; all three are reported. Anything natal
 * that a line passes through (birth star, Moon sign, name letter, the tithi
 * or weekday) is struck by that graha, for good with benefics and for ill
 * with malefics.
 *
 * Vowel placement in the inner-ring corners varies between printed
 * versions; the nakshatra, letter, sign and tithi cells are the standard ones.
 */
import { GRAHAS, NAKSHATRAS, PLANET_NAMES, SIGN_NAMES } from './constants';
import type { GrahaId } from './types';
import { norm360 } from './zodiac';

export type SbcCellKind = 'nakshatra' | 'letter' | 'vowel' | 'sign' | 'tithi';
export type TithiGroup = 'nanda' | 'bhadra' | 'jaya' | 'rikta' | 'purna';

export interface SbcCell {
  row: number;
  col: number;
  kind: SbcCellKind;
  /** Display label (letters in Devanagari with a transliteration in `latin`) */
  label: string;
  latin?: string;
  /** 1–27, or 28 for Abhijit */
  nakshatra?: number;
  sign?: number;
  tithiGroup?: TithiGroup;
  /** Weekdays (0 = Sunday) of a tithi cell */
  weekdays?: number[];
}

export type SbcLine = 'forward' | 'opposite' | 'backward';

export interface SbcVedha {
  planet: GrahaId;
  line: SbcLine;
  /** The line this graha's motion stresses */
  primary: boolean;
  /** Nakshatra struck at the far end of the line (1–28) */
  target: number;
  /** Every cell the line passes through, star cell excluded */
  cells: { row: number; col: number }[];
}

export interface SbcPlanet {
  planet: GrahaId;
  longitude: number;
  /** 1–27, or 28 when in Abhijit */
  nakshatra: number;
  row: number;
  col: number;
  motion: 'direct' | 'retrograde' | 'stationary';
  benefic: boolean;
}

export interface SbcNatalPoint {
  key: 'janma_nakshatra' | 'janma_rashi' | 'name_letter' | 'tithi' | 'weekday' | 'lagna';
  label: string;
  cells: { row: number; col: number }[];
}

export interface SbcHit {
  point: SbcNatalPoint['key'];
  pointLabel: string;
  planet: GrahaId;
  line: SbcLine;
  primary: boolean;
  benefic: boolean;
}

export interface Sarvatobhadra {
  cells: SbcCell[][];
  planets: SbcPlanet[];
  vedhas: SbcVedha[];
  natal: SbcNatalPoint[];
  hits: SbcHit[];
  /** Plain-language summary of the natal points struck */
  summary: { benefic: number; malefic: number; text: string };
}

export interface SbcInput {
  /** Sidereal longitudes and speeds of the transiting grahas */
  planets: Record<GrahaId, { longitude: number; speed: number }>;
  /** Waxing Moon (counted with the benefics) or waning */
  moonWaxing?: boolean;
  natal?: {
    moonNakshatra?: number;
    moonSign?: number;
    lagnaSign?: number;
    /** First syllable of the name, in Latin letters ("ra", "sha", "a") */
    nameLetter?: string;
    /** Birth tithi 1–30 */
    tithi?: number;
    /** Birth weekday, 0 = Sunday */
    weekday?: number;
  };
}

// ------------------------------------------------------------------ board

// Clockwise ring order of the 28 stars starting from Ashwini; 28 = Abhijit
const RING: number[] = [...Array.from({ length: 21 }, (_, i) => i + 1), 28, 22, 23, 24, 25, 26, 27];
const NAK_POS: Record<number, [number, number]> = {};
// top row (east), Krittika→Ashlesha
[3, 4, 5, 6, 7, 8, 9].forEach((n, i) => (NAK_POS[n] = [0, i + 1]));
// right column (south), Magha→Vishakha
[10, 11, 12, 13, 14, 15, 16].forEach((n, i) => (NAK_POS[n] = [i + 1, 8]));
// bottom row (west) right to left, Anuradha→Shravana with Abhijit
[17, 18, 19, 20, 21, 28, 22].forEach((n, i) => (NAK_POS[n] = [8, 7 - i]));
// left column (north) bottom to top, Dhanishta→Bharani
[23, 24, 25, 26, 27, 1, 2].forEach((n, i) => (NAK_POS[n] = [7 - i, 0]));

const L = (label: string, latin: string) => ({ label, latin });
const LETTERS: Record<string, { label: string; latin: string }> = {
  '1,2': L('अ', 'a'), '1,3': L('व', 'va'), '1,4': L('क', 'ka'), '1,5': L('ह', 'ha'), '1,6': L('ड', 'da'),
  '2,7': L('म', 'ma'), '3,7': L('ट', 'ta'), '4,7': L('प', 'pa'), '5,7': L('र', 'ra'), '6,7': L('त', 'ta'),
  '7,6': L('न', 'na'), '7,5': L('य', 'ya'), '7,4': L('भ', 'bha'), '7,3': L('ज', 'ja'), '7,2': L('ख', 'kha'),
  '6,1': L('ग', 'ga'), '5,1': L('स', 'sa'), '4,1': L('द', 'da'), '3,1': L('च', 'cha'), '2,1': L('ल', 'la'),
};
const VOWELS: Record<string, { label: string; latin: string }> = {
  '0,0': L('अ', 'a'), '0,8': L('आ', 'aa'), '8,8': L('इ', 'i'), '8,0': L('ई', 'ii'),
  '1,1': L('उ', 'u'), '1,7': L('ऊ', 'uu'), '7,7': L('ऋ', 'ri'), '7,1': L('ॠ', 'rii'),
  '2,2': L('ऌ', 'lri'), '2,6': L('ॡ', 'lrii'), '6,6': L('ए', 'e'), '6,2': L('ऐ', 'ai'),
  '3,3': L('ओ', 'o'), '3,5': L('औ', 'au'), '5,5': L('अं', 'am'), '5,3': L('अः', 'ah'),
};
const SIGN_POS: Record<number, [number, number]> = {
  2: [2, 3], 3: [2, 4], 4: [2, 5], 5: [3, 6], 6: [4, 6], 7: [5, 6], 8: [6, 5], 9: [6, 4], 10: [6, 3], 11: [5, 2], 12: [4, 2], 1: [3, 2],
};
const TITHI_CELLS: { pos: [number, number]; group: TithiGroup; label: string; weekdays: number[]; tithis: number[] }[] = [
  { pos: [3, 4], group: 'nanda', label: 'Nanda', weekdays: [0, 2], tithis: [1, 6, 11] },
  { pos: [4, 5], group: 'bhadra', label: 'Bhadra', weekdays: [1, 3], tithis: [2, 7, 12] },
  { pos: [5, 4], group: 'jaya', label: 'Jaya', weekdays: [4], tithis: [3, 8, 13] },
  { pos: [4, 3], group: 'rikta', label: 'Rikta', weekdays: [5], tithis: [4, 9, 14] },
  { pos: [4, 4], group: 'purna', label: 'Purna', weekdays: [6], tithis: [5, 10, 15] },
];

export const nakshatraLabel = (n: number) => (n === 28 ? 'Abhijit' : NAKSHATRAS[n - 1].name);

function buildBoard(): SbcCell[][] {
  const grid: SbcCell[][] = Array.from({ length: 9 }, (_, row) => Array.from({ length: 9 }, (_, col) => ({ row, col, kind: 'vowel' as SbcCellKind, label: '' })));
  for (const [n, [r, c]] of Object.entries(NAK_POS)) grid[r][c] = { row: r, col: c, kind: 'nakshatra', label: nakshatraLabel(Number(n)), nakshatra: Number(n) };
  for (const [k, v] of Object.entries(LETTERS)) { const [r, c] = k.split(',').map(Number); grid[r][c] = { row: r, col: c, kind: 'letter', ...v }; }
  for (const [k, v] of Object.entries(VOWELS)) { const [r, c] = k.split(',').map(Number); grid[r][c] = { row: r, col: c, kind: 'vowel', ...v }; }
  for (const [s, [r, c]] of Object.entries(SIGN_POS)) grid[r][c] = { row: r, col: c, kind: 'sign', label: SIGN_NAMES[Number(s) - 1], sign: Number(s) };
  for (const t of TITHI_CELLS) { const [r, c] = t.pos; grid[r][c] = { row: r, col: c, kind: 'tithi', label: t.label, tithiGroup: t.group, weekdays: t.weekdays }; }
  return grid;
}

export const SBC_BOARD: SbcCell[][] = buildBoard();

/** Nakshatra 1–27, or 28 for Abhijit (276°40′ to 280°53′20″: the last quarter of U.Ashadha and the first 15th of Shravana) */
export function sbcNakshatra(longitude: number): number {
  const l = norm360(longitude);
  if (l >= 276 + 40 / 60 && l < 280 + 53 / 60 + 20 / 3600) return 28;
  return Math.min(27, Math.floor(l / (360 / 27)) + 1);
}

/** The three lines from a star cell */
export function sbcLines(n: number): { line: SbcLine; target: number; cells: { row: number; col: number }[] }[] {
  const [r, c] = NAK_POS[n];
  // inward direction perpendicular to the edge
  const [dr, dc] = r === 0 ? [1, 0] : r === 8 ? [-1, 0] : c === 0 ? [0, 1] : [0, -1];
  const walk = (sr: number, sc: number) => {
    const cells: { row: number; col: number }[] = [];
    let y = r + sr, x = c + sc;
    while (y >= 0 && y < 9 && x >= 0 && x < 9) {
      cells.push({ row: y, col: x });
      const cell = SBC_BOARD[y][x];
      if (cell.kind === 'nakshatra') break;
      y += sr; x += sc;
    }
    return cells;
  };
  const opp = walk(dr, dc);
  // the two diagonals: inward plus either side
  const side: [number, number][] = dr !== 0 ? [[dr, -1], [dr, 1]] : [[-1, dc], [1, dc]];
  const diags = side.map(([a, b]) => walk(a, b));
  const endStar = (cells: { row: number; col: number }[]) => {
    const last = cells[cells.length - 1];
    return last ? SBC_BOARD[last.row][last.col].nakshatra ?? 0 : 0;
  };
  const ringIdx = (x: number) => RING.indexOf(x);
  const ahead = (t: number) => (((ringIdx(t) - ringIdx(n)) % 28) + 28) % 28;
  const [d1, d2] = diags;
  const fwdFirst = ahead(endStar(d1)) < ahead(endStar(d2));
  return [
    { line: 'forward', target: endStar(fwdFirst ? d1 : d2), cells: fwdFirst ? d1 : d2 },
    { line: 'opposite', target: endStar(opp), cells: opp },
    { line: 'backward', target: endStar(fwdFirst ? d2 : d1), cells: fwdFirst ? d2 : d1 },
  ];
}

const MEAN: Partial<Record<GrahaId, number>> = { mars: 0.524, mercury: 1.383, jupiter: 0.083, venus: 1.2, saturn: 0.034 };
const BENEFIC: GrahaId[] = ['jupiter', 'venus', 'mercury'];

function findCells(pred: (c: SbcCell) => boolean) {
  const out: { row: number; col: number }[] = [];
  for (const row of SBC_BOARD) for (const c of row) if (pred(c)) out.push({ row: c.row, col: c.col });
  return out;
}

/** Cells of a name's first sound: the longest letter or vowel that the name starts with ("ta" and "da" each have two cells) */
function letterCells(name: string) {
  const s = name.trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return [];
  const all = [
    ...Object.entries(LETTERS).map(([k, v]) => ({ k, latin: v.latin, consonant: true })),
    ...Object.entries(VOWELS).map(([k, v]) => ({ k, latin: v.latin, consonant: false })),
  ];
  for (let len = Math.min(4, s.length); len >= 1; len--) {
    const pre = s.slice(0, len);
    const m = all.filter((x) => x.latin === pre || (x.consonant && x.latin.slice(0, -1) === pre));
    if (m.length) return m.map((x) => { const [row, col] = x.k.split(',').map(Number); return { row, col }; });
  }
  return [];
}

export function sarvatobhadra(input: SbcInput): Sarvatobhadra {
  const planets: SbcPlanet[] = GRAHAS.map((g) => {
    const p = input.planets[g];
    const n = sbcNakshatra(p.longitude);
    const [row, col] = NAK_POS[n];
    let motion: SbcPlanet['motion'] = 'direct';
    if (g === 'rahu' || g === 'ketu') motion = 'retrograde';
    else if (g !== 'sun' && g !== 'moon') {
      if (MEAN[g] && Math.abs(p.speed) < MEAN[g]! * 0.1) motion = 'stationary';
      else if (p.speed < 0) motion = 'retrograde';
    }
    const benefic = BENEFIC.includes(g) || (g === 'moon' && input.moonWaxing !== false);
    return { planet: g, longitude: p.longitude, nakshatra: n, row, col, motion, benefic };
  });

  const vedhas: SbcVedha[] = [];
  for (const p of planets) {
    const primary: SbcLine = p.motion === 'direct' ? 'forward' : p.motion === 'retrograde' ? 'backward' : 'opposite';
    for (const l of sbcLines(p.nakshatra)) vedhas.push({ planet: p.planet, line: l.line, primary: l.line === primary, target: l.target, cells: l.cells });
  }

  const natal: SbcNatalPoint[] = [];
  const n = input.natal;
  if (n?.moonNakshatra) natal.push({ key: 'janma_nakshatra', label: `Birth star ${nakshatraLabel(n.moonNakshatra)}`, cells: findCells((c) => c.nakshatra === n.moonNakshatra) });
  if (n?.moonSign) natal.push({ key: 'janma_rashi', label: `Moon sign ${SIGN_NAMES[n.moonSign - 1]}`, cells: findCells((c) => c.sign === n.moonSign) });
  if (n?.lagnaSign) natal.push({ key: 'lagna', label: `Lagna ${SIGN_NAMES[n.lagnaSign - 1]}`, cells: findCells((c) => c.sign === n.lagnaSign) });
  if (n?.nameLetter) {
    const cells = letterCells(n.nameLetter);
    if (cells.length) natal.push({ key: 'name_letter', label: `Name letter "${n.nameLetter}"`, cells });
  }
  if (n?.tithi) {
    const t15 = ((n.tithi - 1) % 15) + 1;
    const g = TITHI_CELLS.find((x) => x.tithis.includes(t15))!;
    natal.push({ key: 'tithi', label: `Birth tithi (${g.label})`, cells: [{ row: g.pos[0], col: g.pos[1] }] });
  }
  if (n?.weekday !== undefined) {
    const g = TITHI_CELLS.find((x) => x.weekdays.includes(n.weekday!))!;
    natal.push({ key: 'weekday', label: `Birth weekday (${g.label} cell)`, cells: [{ row: g.pos[0], col: g.pos[1] }] });
  }

  const hits: SbcHit[] = [];
  const same = (a: { row: number; col: number }, b: { row: number; col: number }) => a.row === b.row && a.col === b.col;
  for (const pt of natal) {
    for (const p of planets) {
      // a graha sitting on the point counts as a front strike
      if (pt.cells.some((c) => c.row === p.row && c.col === p.col)) {
        hits.push({ point: pt.key, pointLabel: pt.label, planet: p.planet, line: 'opposite', primary: true, benefic: p.benefic });
        continue;
      }
      for (const v of vedhas.filter((x) => x.planet === p.planet)) {
        if (pt.cells.some((c) => v.cells.some((vc) => same(c, vc))))
          hits.push({ point: pt.key, pointLabel: pt.label, planet: p.planet, line: v.line, primary: v.primary, benefic: p.benefic });
      }
    }
  }

  const ben = hits.filter((h) => h.benefic).length;
  const mal = hits.length - ben;
  const struck = (key: SbcNatalPoint['key']) => {
    const hs = hits.filter((h) => h.point === key);
    if (!hs.length) return null;
    const names = [...new Set(hs.map((h) => PLANET_NAMES[h.planet]))];
    return `${hs[0].pointLabel} is struck by ${names.join(', ')}`;
  };
  const lines = natal.map((p) => struck(p.key)).filter(Boolean) as string[];
  const text = !natal.length
    ? 'Add birth details to see which natal points the transits strike.'
    : !hits.length
      ? 'No transiting graha strikes a natal point today.'
      : `${lines.join('. ')}. ${mal > ben ? 'Malefic strikes outnumber benefic ones, a time for caution.' : ben > mal ? 'Benefic strikes outnumber malefic ones, a supportive time.' : 'Benefic and malefic strikes are even.'}`;
  return { cells: SBC_BOARD, planets, vedhas, natal, hits, summary: { benefic: ben, malefic: mal, text } };
}
