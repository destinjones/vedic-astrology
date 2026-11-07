/**
 * A small readability check for reading text, so readings do not drift into jargon soup.
 * English only. Used by test/readability.test.ts and scripts/coverage-report.ts.
 */

/** Technical Sanskrit and astrological terms a newcomer will not know without a gloss. */
export const JARGON = [
  'kendra', 'kendras', 'trikona', 'trikonas', 'dusthana', 'dusthanas', 'upachaya', 'upachayas', 'maraka', 'marakas',
  'bhava', 'bhavas', 'graha', 'grahas', 'drishti', 'dig bala', 'digbala', 'moolatrikona', 'mooltrikona', 'neecha', 'uccha',
  'karaka', 'karakas', 'yogakaraka', 'lagna', 'rashi', 'rasi', 'navamsa', 'varga', 'vargas', 'dasha', 'dashas', 'antardasha',
  'bhukti', 'nakshatra', 'nakshatras', 'pada', 'padas', 'gana', 'shakti', 'atmakaraka', 'argala', 'kartari', 'parivartana',
  'shadbala', 'ashtakavarga', 'gochara', 'ayanamsa', 'sthana', 'kshetra', 'swakshetra', 'mitra', 'shatru', 'sama',
  'vyaya', 'dhana', 'sukha', 'putra', 'ari', 'yuvati', 'randhra', 'karma', 'labha', 'moksha', 'artha', 'kama', 'dharma',
];
const JARGON_RE = new RegExp(`\\b(${JARGON.map((j) => j.replace(/ /g, '\\s')).join('|')})\\b`, 'gi');

export const words = (s: string) => s.match(/[A-Za-zÀ-ÿ’'-]+/g) ?? [];
export const sentences = (s: string) => s.split(/(?<=[.!?])\s+(?=[A-Z“"(])/).filter((x) => words(x).length > 0);

/** Heuristic English syllable count, good to about ±1 on most words. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const groups = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

export interface Readability {
  words: number;
  sentences: number;
  /** Flesch–Kincaid grade level. 8 is a general newspaper; 12 is a hard school text. */
  grade: number;
  /** Words in the longest sentence. */
  longestSentence: number;
  /** Unglossed technical terms per 100 words. */
  jargonPer100: number;
  jargon: string[];
}

export function readability(text: string): Readability {
  const ws = words(text);
  const ss = sentences(text);
  const syl = ws.reduce((n, w) => n + syllables(w), 0);
  const n = Math.max(1, ws.length);
  const k = Math.max(1, ss.length);
  // A term followed by a gloss in brackets ("dig bala (directional strength)") does not count.
  const unglossed = text.replace(/\b[\w\s]+\s\([^)]*\)/g, (m) => m.replace(JARGON_RE, ''));
  const jargon = unglossed.match(JARGON_RE) ?? [];
  return {
    words: ws.length,
    sentences: ss.length,
    grade: +(0.39 * (n / k) + 11.8 * (syl / n) - 15.59).toFixed(1),
    longestSentence: Math.max(0, ...ss.map((x) => words(x).length)),
    jargonPer100: +((jargon.length / n) * 100).toFixed(1),
    jargon: jargon.map((j) => j.toLowerCase()),
  };
}

/**
 * The limits CI holds every English reading to (summary and detail together). Grade and
 * jargon rate are only judged on texts of at least MIN_WORDS words, because on a two-line
 * text one long word swings them wildly; short texts get a plain count of terms instead.
 * See content/STYLE.md.
 */
export const LIMITS = { grade: 13, longestSentence: 40, jargonPer100: 5, jargonInShortText: 2, minWords: 30 } as const;
/** The limit on the average grade over all readings, which keeps the corpus as a whole plain. */
export const AVERAGE_GRADE_LIMIT = 9.5;

/** Problems with one reading, as short sentences. Empty when it passes. */
export function readabilityProblems(r: Readability): string[] {
  const out: string[] = [];
  if (r.longestSentence > LIMITS.longestSentence) out.push(`a sentence of ${r.longestSentence} words (limit ${LIMITS.longestSentence})`);
  if (r.words >= LIMITS.minWords) {
    if (r.grade > LIMITS.grade) out.push(`grade level ${r.grade} (limit ${LIMITS.grade})`);
    if (r.jargonPer100 > LIMITS.jargonPer100) out.push(`${r.jargonPer100} unglossed terms per 100 words (limit ${LIMITS.jargonPer100}): ${[...new Set(r.jargon)].join(', ')}`);
  } else if (r.jargon.length > LIMITS.jargonInShortText) {
    out.push(`${r.jargon.length} unglossed terms in a short text (limit ${LIMITS.jargonInShortText}): ${[...new Set(r.jargon)].join(', ')}`);
  }
  return out;
}
