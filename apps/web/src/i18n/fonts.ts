import type { LocaleInfo } from '@vedic/i18n';

/**
 * Indian scripts get a Noto font, loaded only when that language is picked.
 * The fonts are split by unicode-range, so the browser fetches just the glyphs it needs.
 */
const FONTS: Partial<Record<LocaleInfo['script'], () => Promise<unknown>>> = {
  devanagari: () => Promise.all([import('@fontsource/noto-sans-devanagari/400.css'), import('@fontsource/noto-sans-devanagari/600.css')]),
  tamil: () => Promise.all([import('@fontsource/noto-sans-tamil/400.css'), import('@fontsource/noto-sans-tamil/600.css')]),
  telugu: () => Promise.all([import('@fontsource/noto-sans-telugu/400.css'), import('@fontsource/noto-sans-telugu/600.css')]),
  bengali: () => Promise.all([import('@fontsource/noto-sans-bengali/400.css'), import('@fontsource/noto-sans-bengali/600.css')]),
  gujarati: () => Promise.all([import('@fontsource/noto-sans-gujarati/400.css'), import('@fontsource/noto-sans-gujarati/600.css')]),
  kannada: () => Promise.all([import('@fontsource/noto-sans-kannada/400.css'), import('@fontsource/noto-sans-kannada/600.css')]),
};

const loaded = new Set<string>();
export function loadFont(script: LocaleInfo['script']) {
  const f = FONTS[script];
  if (!f || loaded.has(script)) return;
  loaded.add(script);
  f().catch(() => loaded.delete(script));
}
