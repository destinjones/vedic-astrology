/**
 * An SVG drawn through <img> (for PNG export) cannot load the page's web fonts,
 * and a downloaded SVG opened elsewhere would not have them either. So exports
 * carry the Latin subsets of the two brand fonts inside the file (about 70 KB).
 */
import serif600 from '@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff2?url';
import sans400 from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import sans600 from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';

let css: Promise<string> | null = null;

async function dataUrl(url: string): Promise<string> {
  const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:font/woff2;base64,${btoa(bin)}`;
}

function fontCss(): Promise<string> {
  css ??= Promise.all([dataUrl(serif600), dataUrl(sans400), dataUrl(sans600)]).then(([s6, i4, i6]) =>
    `@font-face{font-family:'Cormorant Garamond';font-weight:600;src:url(${s6}) format('woff2')}`
    + `@font-face{font-family:Inter;font-weight:400;src:url(${i4}) format('woff2')}`
    + `@font-face{font-family:Inter;font-weight:600;src:url(${i6}) format('woff2')}`,
  ).catch((e) => { css = null; throw e; });
  return css;
}

/** The SVG with the fonts embedded; unchanged if they cannot be loaded. */
export async function withFonts(svg: string): Promise<string> {
  try {
    const style = await fontCss();
    return svg.replace(/(<svg[^>]*>)/, `$1<defs><style>${style}</style></defs>`);
  } catch {
    return svg;
  }
}
