/**
 * The Life Chart Book's editable parts: what the astrologer writes and chooses.
 * No PDF dependencies, so the editor can import it eagerly.
 *
 * Notes are keyed by what they sit under:
 *   chapter:<id>   after a chapter (ids in BOOK_CHAPTERS)
 *   graha:<id>     on that planet's pages            house:<n>   after that house
 *   yoga:<id>      after that yoga                   dosha:<id>  after that dosha
 *   year:<yyyy>    in that year of the forecast
 */

export interface BookChapter { id: string; title: string; blurb: string; optional?: boolean }

export const BOOK_CHAPTERS: BookChapter[] = [
  { id: 'foundations', title: 'The language of your chart', blurb: 'What Jyotisha is, the sidereal sky, and the building blocks every later chapter uses' },
  { id: 'glance', title: 'Your chart at a glance', blurb: 'The three pillars, both chart styles, positions, panchanga and the wheel' },
  { id: 'lagna', title: 'Your rising sign', blurb: 'The lagna taught in depth, then yours: its sign, ruler, occupants and rising star' },
  { id: 'moon', title: 'Your Moon and birth star', blurb: 'The mind in Jyotisha and the 27 nakshatras, then your Moon sign, star and pada' },
  { id: 'grahas', title: 'The nine grahas', blurb: 'A plate and a reading for each planet' },
  { id: 'houses', title: 'The twelve houses', blurb: 'Every house, its ruler and the planets in it' },
  { id: 'yogas', title: 'Yogas and doshas', blurb: 'Every combination found, why it applies and its classical source' },
  { id: 'vargas', title: 'Divisional charts', blurb: 'Navamsha, dashamsha and six more lenses', optional: true },
  { id: 'dasha', title: 'Your planetary periods', blurb: 'Vimshottari dashas, the current period and the wall chart of your whole life' },
  { id: 'forecast', title: 'The years ahead', blurb: 'A year-by-year forecast: periods, Jupiter and Saturn, windows and Saturn phases' },
  { id: 'timing', title: 'The seasons ahead', blurb: 'Life weather, Sade Sati, retrogrades and ashtakavarga', optional: true },
  { id: 'remedies', title: 'Remedies and practices', blurb: 'The tradition\'s upayas for your chart: mantra, charity, fasting, yantra, gems, with sources', optional: true },
  { id: 'glossary', title: 'Glossary', blurb: 'Every Sanskrit term explained' },
  { id: 'sources', title: 'Sources and further reading', blurb: 'Every classical text this book cites, and where to read it' },
];

export interface BookDraft {
  /** Printed on the cover and title page. */
  title: string;
  dedication: string;
  /** Opening letter, after the contents. Blank paragraphs separate paragraphs. */
  letter: string;
  /** Closing letter at the end of the book. */
  closing: string;
  /** The astrologer's key takeaways, one per line, for "The heart of your chart". */
  takeaways: string;
  notes: Record<string, string>;
  /** Chapter ids to include. */
  chapters: string[];
  /** Print edition: 3 mm bleed, chapters on right-hand pages, a page count divisible by four, and a separate cover spread. */
  print: boolean;
  /** Ruled pages for the client's own notes (left-hand pages in print, and at the back). */
  notesPages: boolean;
  /** Years in the forecast chapter. */
  years: 5 | 10;
  /** Print edition cover: spine width in millimetres, or 0 to estimate it from the page count. */
  spineMm: number;
}

export const BOOK_TITLE = 'The Life Chart Book';

export const emptyDraft = (): BookDraft => ({
  title: BOOK_TITLE,
  dedication: '',
  letter: '',
  closing: '',
  takeaways: '',
  notes: {},
  chapters: BOOK_CHAPTERS.map((c) => c.id),
  print: false,
  notesPages: true,
  years: 10,
  spineMm: 0,
});

/** A stable key for one birth, so each client's draft is kept separately in the browser. */
export function draftKey(input: { name?: string; date: string; time: string; latitude: number; longitude: number }) {
  const s = `${input.name?.trim() ?? ''}|${input.date}|${input.time}|${input.latitude.toFixed(3)}|${input.longitude.toFixed(3)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `vedic.book.${(h >>> 0).toString(36)}`;
}

/** Merge a stored or imported draft over the defaults, ignoring anything malformed. */
export function normaliseDraft(x: unknown): BookDraft {
  const d = emptyDraft();
  if (!x || typeof x !== 'object') return d;
  const o = x as Record<string, unknown>;
  const str = (k: keyof BookDraft) => (typeof o[k] === 'string' ? (o[k] as string) : (d[k] as string));
  const notes: Record<string, string> = {};
  if (o.notes && typeof o.notes === 'object') for (const [k, v] of Object.entries(o.notes as object)) if (typeof v === 'string' && v.trim()) notes[k] = v;
  const known = new Set(BOOK_CHAPTERS.map((c) => c.id));
  return {
    title: str('title') || BOOK_TITLE,
    dedication: str('dedication'),
    letter: str('letter'),
    closing: str('closing'),
    takeaways: str('takeaways'),
    notes,
    chapters: Array.isArray(o.chapters) ? (o.chapters as unknown[]).filter((c): c is string => typeof c === 'string' && known.has(c)) : d.chapters,
    print: typeof o.print === 'boolean' ? o.print : d.print,
    notesPages: typeof o.notesPages === 'boolean' ? o.notesPages : d.notesPages,
    years: o.years === 5 ? 5 : 10,
    spineMm: typeof o.spineMm === 'number' && o.spineMm >= 0 && o.spineMm < 100 ? o.spineMm : 0,
  };
}

/** Paragraphs from a textarea: blank lines split paragraphs, single newlines join. */
export const paragraphs = (t: string | undefined) =>
  (t ?? '').trim() ? (t ?? '').trim().split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean) : [];

/** Lines of a list textarea. */
export const lines = (t: string | undefined) => (t ?? '').split('\n').map((l) => l.replace(/^\s*[-*•\d.)]+\s*/, '').trim()).filter(Boolean);
