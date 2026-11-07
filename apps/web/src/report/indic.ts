import type { jsPDF } from 'jspdf';
import { F, type FontName } from './theme';

/**
 * Indian scripts in the PDF.
 *
 * jsPDF embeds TrueType fonts but does no shaping: it maps each character to
 * one glyph, so conjuncts, half forms and pre-base vowel signs come out wrong.
 * We shape each Indic run with HarfBuzz instead, then hand jsPDF a string
 * whose characters stand for the glyphs HarfBuzz chose. Glyphs that already
 * have a character in the font's cmap use it (so copied text stays readable);
 * the others get a private-use code point that we add to jsPDF's copy of the
 * cmap (copied text then shows one letter for such a glyph). Mark glyphs get a zero advance, as HarfBuzz gives them, and sit where
 * the font draws them by default.
 *
 * Latin text keeps the report's own faces. Each Indic run switches to the
 * matching Noto face (serif or sans, regular or semibold).
 */

export type IndicScript = 'devanagari' | 'bengali' | 'gujarati' | 'tamil' | 'telugu' | 'kannada';

const BLOCKS: [IndicScript, number, number][] = [
  ['devanagari', 0x0900, 0x097f],
  ['bengali', 0x0980, 0x09ff],
  ['gujarati', 0x0a80, 0x0aff],
  ['tamil', 0x0b80, 0x0bff],
  ['telugu', 0x0c00, 0x0c7f],
  ['kannada', 0x0c80, 0x0cff],
  ['devanagari', 0xa8e0, 0xa8ff],
  ['devanagari', 0x1cd0, 0x1cff],
];
/** Join the run they follow: ZWNJ, ZWJ, dandas (shared by several scripts), dotted circle. */
const JOINERS = new Set([0x200c, 0x200d, 0x0964, 0x0965, 0x25cc]);
const SPACE = new Set([0x20, 0xa0]);

export const LOCALE_SCRIPT: Partial<Record<string, IndicScript>> = {
  hi: 'devanagari', mr: 'devanagari', bn: 'bengali', gu: 'gujarati', ta: 'tamil', te: 'telugu', kn: 'kannada',
};

export function scriptOf(cp: number): IndicScript | null {
  if (cp < 0x0900) return null;
  for (const [s, a, b] of BLOCKS) if (cp >= a && cp <= b) return s;
  return null;
}

export function hasIndic(t: string) {
  for (let i = 0; i < t.length; i++) if (scriptOf(t.charCodeAt(i))) return true;
  return false;
}

export function scriptsIn(...texts: (string | undefined)[]): Set<IndicScript> {
  const out = new Set<IndicScript>();
  for (const t of texts) {
    if (!t || !hasIndic(t)) continue;
    for (let i = 0; i < t.length; i++) { const s = scriptOf(t.charCodeAt(i)); if (s) out.add(s); }
  }
  return out;
}

export interface Run { text: string; script: IndicScript | null }

/** Split text into Latin and Indic runs. Spaces between two words of the same script stay in that script's run. */
export function runs(text: string): Run[] {
  const out: Run[] = [];
  let cur: Run | null = null;
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    let s = scriptOf(cp);
    if (!s && cur?.script && JOINERS.has(cp)) s = cur.script;
    if (!s && cur?.script && SPACE.has(cp)) {
      let j = i + 1;
      while (j < text.length && SPACE.has(text.charCodeAt(j))) j++;
      if (j < text.length && scriptOf(text.charCodeAt(j)) === cur.script) s = cur.script;
    }
    if (cur && cur.script === s) cur.text += text[i];
    else out.push(cur = { text: text[i], script: s });
  }
  return out;
}

// ------------------------------------------------------------------ faces

type Kind = 'serif' | 'sans';
const FACE: Record<FontName, [Kind, number]> = {
  [F.serif]: ['serif', 500],
  [F.serifBold]: ['serif', 600],
  [F.serifItalic]: ['serif', 500],
  [F.sans]: ['sans', 400],
  [F.sansBold]: ['sans', 600],
};

/**
 * Noto's Indic letters run larger than Cormorant's small Latin x-height, and a
 * little larger than Inter's, so they are set slightly smaller to sit evenly
 * on a line of mixed text.
 */
export const INDIC_SCALE: Record<Kind, number> = { serif: 0.86, sans: 0.9 };

export const indicFace = (latin: FontName, s: IndicScript) => {
  const [kind, weight] = FACE[latin] ?? FACE[F.sans];
  return { name: `Noto-${kind}-${s}-${weight}`, kind, file: `noto-${kind}-${s}-${weight}.ttf` };
};

const URLS = import.meta.glob('./fonts/indic/*.ttf', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

// ------------------------------------------------------------------ shaping

type HB = typeof import('harfbuzzjs');

interface Shaped {
  hb: InstanceType<HB['Font']>;
  /** jsPDF's parsed font: we add private-use entries to its cmap and zero mark widths. */
  codeMap: Record<number, number>;
  /** glyph → a character that maps to it. */
  reverse: Map<number, number>;
  nextPua: number;
  cache: Map<string, string>;
  /** Glyphs HarfBuzz gives no advance (marks). */
  zero: Set<number>;
  /** Private-use glyph → the character it reads as in copied text. */
  firstChar: Map<number, number>;
}

interface JsPdfTtf {
  cmap: { unicode: { codeMap: Record<number, number> } };
  widthOfGlyph: (g: number) => number;
  toUnicode: Record<number, number>;
}

export class IndicFonts {
  private faces = new Map<string, Shaped>();
  private hb: HB | null = null;
  readonly scripts = new Set<IndicScript>();

  /** Fetch, embed and prepare the Noto faces for each script. */
  private pdf: jsPDF | null = null;
  /** Fetched font files, embedded on first use: jsPDF writes every registered font, and an unused one comes out broken. */
  private files = new Map<string, { buf: ArrayBuffer; b64: string }>();

  /** Fetch the Noto faces for each script and load HarfBuzz. Faces are embedded only once text uses them. */
  async register(pdf: jsPDF, scripts: Iterable<IndicScript>, toBase64: (b: ArrayBuffer) => string) {
    this.pdf = pdf;
    const want = [...scripts].filter((s) => !this.scripts.has(s));
    if (!want.length) return;
    this.hb ??= await import('harfbuzzjs');
    const faces = new Map<string, string>();
    for (const s of want) for (const latin of Object.values(F)) { const f = indicFace(latin, s); faces.set(f.name, f.file); }
    await Promise.all([...faces].map(async ([name, file]) => {
      const url = URLS[`./fonts/indic/${file}`];
      if (!url) throw new Error(`Missing font ${file}`);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Font ${url}: ${res.status}`);
      const buf = await res.arrayBuffer();
      this.files.set(name, { buf, b64: toBase64(buf) });
    }));
    want.forEach((s) => this.scripts.add(s));
  }

  private face(name: string): Shaped | undefined {
    const done = this.faces.get(name);
    if (done) return done;
    const file = this.files.get(name);
    const { pdf, hb } = this;
    if (!file || !pdf || !hb) return undefined;
    pdf.addFileToVFS(`${name}.ttf`, file.b64);
    pdf.addFont(`${name}.ttf`, name, 'normal');
    const meta = (pdf.getFont as unknown as (n: string, s: string) => { metadata: JsPdfTtf })(name, 'normal').metadata;
    const codeMap = meta.cmap.unicode.codeMap;
    const reverse = new Map<number, number>();
    for (const [cp, gid] of Object.entries(codeMap)) if (!reverse.has(gid)) reverse.set(gid, +cp);
    const zero = new Set<number>();
    const firstChar = new Map<number, number>();
    const shaped: Shaped = { hb: new hb.Font(new hb.Face(new hb.Blob(file.buf))), codeMap, reverse, nextPua: 0xe000, cache: new Map(), zero, firstChar };
    // marks: HarfBuzz gives them no advance, so the PDF should not either
    const width = meta.widthOfGlyph.bind(meta);
    meta.widthOfGlyph = (g: number) => (zero.has(g) ? 0 : width(g));
    // copied text: a private-use glyph reads as one letter of its cluster
    meta.toUnicode = new Proxy(meta.toUnicode, {
      set(t, k, v) {
        const g = Number(k);
        t[g] = v >= 0xe000 && v <= 0xf8ff ? firstChar.get(g) ?? v : v;
        return true;
      },
    });
    // a face measured but never drawn would get an empty ToUnicode map, which viewers reject
    meta.toUnicode[codeMap[0x20]] = 0x20;
    this.faces.set(name, shaped);
    return shaped;
  }

  /** The string to give jsPDF for `text` (one run of one script) in the face `name`. */
  shape(name: string, text: string): string {
    const f = this.face(name);
    if (!f || !this.hb) return '';
    const hit = f.cache.get(text);
    if (hit !== undefined) return hit;
    const buf = new this.hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    this.hb.shape(f.hb, buf);
    const infos = buf.getGlyphInfos();
    const pos = buf.getGlyphPositions();
    // cluster start → end, for naming private-use glyphs in copied text
    const starts = [...new Set(infos.map((g) => g.cluster))].sort((a, b) => a - b);
    const end = (c: number) => starts[starts.indexOf(c) + 1] ?? text.length;
    let out = '';
    infos.forEach((g, i) => {
      const gid = g.codepoint;
      if (gid === 0) return; // not in the font: drop rather than print a box
      if (pos[i].xAdvance === 0) f.zero.add(gid);
      let cp = f.reverse.get(gid);
      if (cp === undefined || cp > 0xffff) {
        cp = f.nextPua++;
        f.codeMap[cp] = gid;
        f.reverse.set(gid, cp);
        // the first letter of the cluster that no plain glyph in it already stands for
        const own = new Set(infos.filter((h) => h.cluster === g.cluster).map((h) => f.reverse.get(h.codepoint)));
        const chars = [...text.slice(g.cluster, end(g.cluster))].map((ch) => ch.charCodeAt(0));
        f.firstChar.set(gid, chars.find((ch) => !own.has(ch)) ?? chars[0]);
      }
      out += String.fromCharCode(cp);
    });
    f.cache.set(text, out);
    return out;
  }

  has(s: IndicScript | null): s is IndicScript { return !!s && this.scripts.has(s); }
}
