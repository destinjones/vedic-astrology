import type { jsPDF } from 'jspdf';
import cormorant500 from './fonts/cormorant-500.ttf?url';
import cormorant600 from './fonts/cormorant-600.ttf?url';
import cormorantItalic from './fonts/cormorant-500-italic.ttf?url';
import inter400 from './fonts/inter-400.ttf?url';
import inter600 from './fonts/inter-600.ttf?url';
import { F } from './theme';

/**
 * Same faces as the site (Cormorant Garamond and Inter, SIL OFL 1.1), as TTF
 * because jsPDF embeds TrueType only. Converted from the @fontsource latin
 * subsets; see fonts/OFL.txt.
 */
const FILES: [string, string][] = [
  [F.serif, cormorant500],
  [F.serifBold, cormorant600],
  [F.serifItalic, cormorantItalic],
  [F.sans, inter400],
  [F.sansBold, inter600],
];

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

let cache: Promise<[string, string][]> | null = null;

export async function registerFonts(pdf: jsPDF) {
  cache ??= Promise.all(FILES.map(async ([name, url]) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Font ${url}: ${res.status}`);
    return [name, toBase64(await res.arrayBuffer())] as [string, string];
  }));
  for (const [name, b64] of await cache) {
    pdf.addFileToVFS(`${name}.ttf`, b64);
    pdf.addFont(`${name}.ttf`, name, 'normal');
  }
}
