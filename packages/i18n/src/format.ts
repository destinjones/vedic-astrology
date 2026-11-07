import type { LocaleCode } from './locales';
import { LOCALE_BY_CODE } from './locales';

export type Params = Record<string, string | number>;

/** Replace {name} placeholders. Unknown placeholders are left as they are. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/**
 * Plural forms are written as an object keyed by Intl.PluralRules categories,
 * e.g. { one: '{count} yoga', other: '{count} yogas' }. `other` is required.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(locale: LocaleCode, count: number, forms: PluralForms, params?: Params): string {
  const cat = new Intl.PluralRules(LOCALE_BY_CODE[locale]?.tag ?? 'en').select(count);
  return interpolate(forms[cat] ?? forms.other, { count, ...params });
}

/** Join a list the way the language does ("a, b and c"). */
export function list(locale: LocaleCode, items: string[], type: 'conjunction' | 'disjunction' = 'conjunction'): string {
  if (items.length < 2) return items.join('');
  try {
    return new Intl.ListFormat(LOCALE_BY_CODE[locale]?.tag ?? 'en', { style: 'long', type }).format(items);
  } catch {
    return items.join(', ');
  }
}

/** Dates in the reader's language, with Latin digits so charts and tables stay readable. */
export function formatDate(locale: LocaleCode, d: Date | string | number, opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' }): string {
  const date = d instanceof Date ? d : new Date(d);
  try {
    return new Intl.DateTimeFormat(`${LOCALE_BY_CODE[locale]?.tag ?? 'en'}-u-nu-latn`, opts).format(date);
  } catch {
    return date.toLocaleDateString(undefined, opts);
  }
}
