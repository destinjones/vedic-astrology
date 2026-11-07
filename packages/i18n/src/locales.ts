/**
 * The languages the project ships. To add one:
 *   1. add it here,
 *   2. add `vocab/<code>.ts` (planet, sign and nakshatra names),
 *   3. add UI messages in apps/web/src/i18n/messages/<code>.ts.
 * Anything missing falls back to English, so a language can start small.
 */
export interface LocaleInfo {
  code: LocaleCode;
  /** Name in English, for docs and logs. */
  english: string;
  /** Name in the language itself, shown in the switcher. */
  native: string;
  /** BCP 47 tag for Intl formatting and <html lang>. */
  tag: string;
  /** Script, so the UI can load a matching font. */
  script: 'latin' | 'devanagari' | 'tamil' | 'telugu' | 'bengali' | 'gujarati' | 'kannada';
  dir: 'ltr' | 'rtl';
}

export const LOCALE_CODES = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'es'] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];
export const DEFAULT_LOCALE: LocaleCode = 'en';

export const LOCALES: LocaleInfo[] = [
  { code: 'en', english: 'English', native: 'English', tag: 'en', script: 'latin', dir: 'ltr' },
  { code: 'hi', english: 'Hindi', native: 'हिन्दी', tag: 'hi-IN', script: 'devanagari', dir: 'ltr' },
  { code: 'ta', english: 'Tamil', native: 'தமிழ்', tag: 'ta-IN', script: 'tamil', dir: 'ltr' },
  { code: 'te', english: 'Telugu', native: 'తెలుగు', tag: 'te-IN', script: 'telugu', dir: 'ltr' },
  { code: 'bn', english: 'Bengali', native: 'বাংলা', tag: 'bn-IN', script: 'bengali', dir: 'ltr' },
  { code: 'mr', english: 'Marathi', native: 'मराठी', tag: 'mr-IN', script: 'devanagari', dir: 'ltr' },
  { code: 'gu', english: 'Gujarati', native: 'ગુજરાતી', tag: 'gu-IN', script: 'gujarati', dir: 'ltr' },
  { code: 'kn', english: 'Kannada', native: 'ಕನ್ನಡ', tag: 'kn-IN', script: 'kannada', dir: 'ltr' },
  { code: 'es', english: 'Spanish', native: 'Español', tag: 'es', script: 'latin', dir: 'ltr' },
];

export const LOCALE_BY_CODE = Object.fromEntries(LOCALES.map((l) => [l.code, l])) as Record<LocaleCode, LocaleInfo>;

export const isLocale = (x: unknown): x is LocaleCode => typeof x === 'string' && (LOCALE_CODES as readonly string[]).includes(x);

/** Best supported locale for a list of BCP 47 tags such as navigator.languages. */
export function matchLocale(tags: readonly string[] | undefined | null): LocaleCode {
  for (const t of tags ?? []) {
    const base = t.toLowerCase().split(/[-_]/)[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
