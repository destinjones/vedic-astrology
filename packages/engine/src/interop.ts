/**
 * Reading longitudes written by other astrology programs, so a chart can be
 * checked against them. Accepts the common ways a position is printed:
 *
 *   123.4567          decimal degrees from 0° Aries
 *   123°27'12"        degrees, minutes, seconds from 0° Aries
 *   3°Le27'12"        Astro.com style, sign in the middle
 *   3 Le 27' 12.3"    Jagannatha Hora style
 *   Leo 3°27'12"      sign first
 *   3:27:12 Simha     colons, Sanskrit sign names
 *   ♌ 3°27'           zodiac glyphs
 *
 * Retrograde marks (R, Rx, ℞) are ignored. Anything ambiguous returns null
 * rather than a guess.
 */

const SIGN_WORDS: [number, string[]][] = [
  [1, ['ar', 'ari', 'aries', 'mesha', 'mesh', '♈']],
  [2, ['ta', 'tau', 'taurus', 'vrishabha', 'vrishabh', 'vrisha', 'vrsabha', 'rishabha', '♉']],
  [3, ['ge', 'gem', 'gemini', 'mithuna', 'mithun', '♊']],
  [4, ['cn', 'can', 'cnc', 'cancer', 'karka', 'karkata', 'kark', 'karkataka', '♋']],
  [5, ['le', 'leo', 'simha', 'singh', 'simh', '♌']],
  [6, ['vi', 'vir', 'virgo', 'kanya', '♍']],
  [7, ['li', 'lib', 'libra', 'tula', 'thula', '♎']],
  [8, ['sc', 'sco', 'scorpio', 'vrischika', 'vrishchika', 'vrishchik', 'vrschika', 'scorpion', '♏']],
  [9, ['sg', 'sag', 'sagittarius', 'dhanu', 'dhanus', 'dhanur', '♐']],
  [10, ['cp', 'cap', 'capricorn', 'makara', 'makar', '♑']],
  [11, ['aq', 'aqu', 'aquarius', 'kumbha', 'kumbh', '♒']],
  [12, ['pi', 'pis', 'pisces', 'meena', 'mina', 'meen', '♓']],
];
const SIGN_BY_WORD = new Map<string, number>(SIGN_WORDS.flatMap(([n, ws]) => ws.map((w) => [w, n] as [string, number])));
const IGNORED = new Set(['r', 'rx', '℞', 'retro', 'retrograde', 'd', 'direct', 'deg', 'degrees']);

/** Sidereal or tropical longitude in [0, 360), or null when the text is not a position. */
export function parseLongitude(text: string): number | null {
  const s = text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[′’‘`]/g, "'")
    .replace(/[″“”]|''/g, '"')
    .replace(/º|˚/g, '°')
    .trim();
  if (!s) return null;

  let sign: number | null = null;
  // words and glyphs: each must be a sign name or something we can ignore
  const words = s.match(/[a-z]+|[♈-♓℞]/gu) ?? [];
  for (const w of words) {
    const n = SIGN_BY_WORD.get(w);
    if (n !== undefined) {
      if (sign !== null && sign !== n) return null;
      sign = n;
    } else if (!IGNORED.has(w)) {
      return null;
    }
  }
  // a minus sign means a negative number, which no position program prints
  if (/-\s*\d/.test(s)) return null;
  const nums = (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((x) => Number(x.replace(',', '.')));
  if (nums.length === 0 || nums.length > 3) return null;
  const [d, m = 0, sec = 0] = nums;
  if (nums.length > 1 && !Number.isInteger(d)) return null;
  if (m >= 60 || sec >= 60) return null;
  const within = d + m / 60 + sec / 3600;
  if (sign !== null) {
    if (within >= 30) return null;
    return (sign - 1) * 30 + within;
  }
  if (within >= 360) return null;
  return within;
}

export type InteropBody =
  | 'asc' | 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn' | 'rahu' | 'ketu'
  | 'uranus' | 'neptune' | 'pluto';

const BODY_WORDS: [InteropBody, string[]][] = [
  ['asc', ['ascendant', 'asc', 'lagna', 'ac', 'as', 'la', 'lg', 'rising']],
  ['sun', ['sun', 'surya', 'su', 'sy', 'ravi', '☉']],
  ['moon', ['moon', 'chandra', 'mo', 'ch', 'chandr', '☽', '☾']],
  ['mars', ['mars', 'mangal', 'mangala', 'kuja', 'ma', '♂']],
  ['mercury', ['mercury', 'budha', 'budh', 'me', 'bu', '☿']],
  ['jupiter', ['jupiter', 'guru', 'brihaspati', 'ju', 'gu', '♃']],
  ['venus', ['venus', 'shukra', 'sukra', 've', 'sk', '♀']],
  ['saturn', ['saturn', 'shani', 'sani', 'sa', '♄']],
  ['rahu', ['rahu', 'ra', 'north node', 'true node', 'mean node', 'node', 'nn', '☊']],
  ['ketu', ['ketu', 'ke', 'south node', 'sn', '☋']],
  ['uranus', ['uranus', 'ur', '♅']],
  ['neptune', ['neptune', 'ne', '♆']],
  ['pluto', ['pluto', 'pl', '♇']],
];

export interface PastedPosition {
  body: InteropBody;
  longitude: number;
  /** "true" or "mean" when the line named the node type */
  node?: 'true' | 'mean';
  /** the part of the line that was read as the position */
  text: string;
  line: string;
}

/**
 * Read a block pasted from another program, one body per line, such as
 * "Sun  29°Cn12'03\"" or "Moon (R) 12 Sc 34' 56\"". Lines that don't start
 * with a body name, or whose position can't be read, are skipped.
 */
export function parsePositionTable(text: string): PastedPosition[] {
  const out: PastedPosition[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.normalize('NFKC').toLowerCase();
    let found: { body: InteropBody; word: string } | null = null;
    for (const [body, ws] of BODY_WORDS) {
      for (const w of ws) {
        const re = new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z])`, 'u');
        if (re.test(lower) && (!found || w.length > found.word.length)) found = { body, word: w };
      }
    }
    if (!found) continue;
    const rest = lower.slice(found.word.length).replace(/^[\s:=\-–|()\t.]+/, '');
    // drop columns after the position (speed, nakshatra...) by trying the longest readable prefix
    const parts = rest.split(/\s{2,}|\t|\|/).map((p) => p.trim()).filter(Boolean);
    let lon: number | null = null;
    let text = '';
    const tryPrefix = (pieces: string[]) => {
      for (let k = pieces.length; k >= 1 && lon === null; k--) {
        text = pieces.slice(0, k).join(' ');
        lon = parseLongitude(text);
      }
    };
    tryPrefix(parts);
    if (lon === null) tryPrefix(rest.split(/\s+/));
    if (lon === null) continue;
    const node = /\btrue\b/.test(lower) ? 'true' : /\bmean\b/.test(lower) ? 'mean' : undefined;
    out.push({ body: found.body, longitude: lon, text, line, ...(node ? { node } : {}) });
  }
  return out;
}

/** Signed difference theirs − ours in arc minutes, taking the short way round the circle. */
export function deltaArcminutes(ours: number, theirs: number): number {
  let d = (((theirs - ours) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d * 60;
}
