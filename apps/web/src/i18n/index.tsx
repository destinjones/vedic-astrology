import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE, formatDate, getVocab, interpolate, isLocale, list, LOCALE_BY_CODE, matchLocale, plural,
  type LocaleCode, type Params, type PluralForms, type Vocab,
} from '@vedic/i18n';
import en, { type Messages, type Translation } from './messages/en';
import { loadFont } from './fonts';

export type { LocaleCode };

// ---------------------------------------------------------------- keys
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends unknown[]
      ? never
      : T[K] extends { other: string }
        ? never
        : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type PluralLeaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | unknown[]
    ? never
    : T[K] extends { other: string }
      ? `${P}${K}`
      : PluralLeaves<T[K], `${P}${K}.`>;
}[keyof T & string];
/** Every plain string in messages/en.ts, as 'section.key'. */
export type MessageKey = Leaves<Messages>;
export type PluralKey = PluralLeaves<Messages>;

// ---------------------------------------------------------------- loading
// Each language is its own chunk, loaded when picked. Adding a file to ./messages is enough.
const loaders = import.meta.glob<{ default: Translation }>(['./messages/*.ts', '!./messages/en.ts']);
const cache: Partial<Record<LocaleCode, Translation>> = { en };

async function loadMessages(locale: LocaleCode): Promise<Translation> {
  if (cache[locale]) return cache[locale]!;
  const load = loaders[`./messages/${locale}.ts`];
  const m = load ? (await load()).default : {};
  cache[locale] = m;
  return m;
}

const get = (obj: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

const STORE_KEY = 'vedic.lang';

/** ?lang=hi in the URL wins, then the saved choice, then the browser's languages. */
export function initialLocale(): LocaleCode {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (isLocale(q)) return q;
  } catch { /* ignore */ }
  try {
    const s = localStorage.getItem(STORE_KEY);
    if (isLocale(s)) return s;
  } catch { /* ignore */ }
  return typeof navigator === 'undefined' ? DEFAULT_LOCALE : matchLocale(navigator.languages);
}

function applyDocument(locale: LocaleCode) {
  const info = LOCALE_BY_CODE[locale];
  document.documentElement.lang = info.tag;
  document.documentElement.dir = info.dir;
  document.documentElement.dataset.script = info.script;
}

// ---------------------------------------------------------------- context
export interface I18n {
  locale: LocaleCode;
  setLocale: (l: LocaleCode) => void;
  /** Translate a key from messages/en.ts. Falls back to English, then to the key itself. */
  t: (key: MessageKey, params?: Params) => string;
  /** Pick the plural form for `count` ({count} is available in the text). */
  tp: (key: PluralKey, count: number, params?: Params) => string;
  /** Read a list or table from messages (e.g. 'data.houseThemes'), falling back per item to English. */
  tl: <T = string>(key: string) => T;
  /** Like t, but placeholders can be React nodes (links, bold text). */
  rich: (key: MessageKey, nodes: Record<string, ReactNode>, params?: Params) => ReactNode;
  /** Planet, sign, nakshatra and other astrological names in this language. */
  v: Vocab;
  list: (items: string[]) => string;
  date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) => string;
  /** False when the locale has no translated readings yet. */
  hasLocale: (l: LocaleCode) => boolean;
}

const Ctx = createContext<I18n | null>(null);

function makeI18n(locale: LocaleCode, msgs: Translation, setLocale: (l: LocaleCode) => void): I18n {
  const raw = (key: string) => get(msgs, key) ?? get(en, key);
  return {
    locale,
    setLocale,
    t: (key, params) => {
      const s = raw(key);
      return typeof s === 'string' ? interpolate(s, params) : key;
    },
    tp: (key, count, params) => {
      const local = get(msgs, key) as PluralForms | undefined;
      const forms = local?.other ? local : (get(en, key) as PluralForms);
      return plural(locale, count, forms, params);
    },
    tl: <T,>(key: string) => {
      const local = get(msgs, key);
      const base = get(en, key);
      if (Array.isArray(base)) return base.map((b, i) => (Array.isArray(local) && local[i] != null ? local[i] : b)) as T;
      if (base && typeof base === 'object') return { ...(base as object), ...((local as object) ?? {}) } as T;
      return (local ?? base) as T;
    },
    rich: (key, nodes, params) => {
      const s = raw(key);
      const text = typeof s === 'string' ? interpolate(s, params) : key;
      return text.split(/(\{\w+\})/g).map((part, i) => {
        const m = /^\{(\w+)\}$/.exec(part);
        return <Fragment key={i}>{m && m[1] in nodes ? nodes[m[1]] : part}</Fragment>;
      });
    },
    v: getVocab(locale),
    list: (items) => list(locale, items),
    date: (d, opts) => formatDate(locale, d, opts),
    hasLocale: (l) => l === 'en' || `./messages/${l}.ts` in loaders,
  };
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(initialLocale);
  const [msgs, setMsgs] = useState<{ locale: LocaleCode; m: Translation }>(() => ({ locale: 'en', m: en }));

  useEffect(() => {
    let live = true;
    applyDocument(locale);
    loadFont(LOCALE_BY_CODE[locale].script);
    loadMessages(locale).then((m) => { if (live) setMsgs({ locale, m }); }).catch((e) => console.error('Translation failed to load', e));
    return () => { live = false; };
  }, [locale]);

  const setLocale = useCallback((l: LocaleCode) => {
    setLocaleState(l);
    try { localStorage.setItem(STORE_KEY, l); } catch { /* ignore */ }
    try {
      const url = new URL(location.href);
      if (url.searchParams.has('lang')) { url.searchParams.set('lang', l); history.replaceState(history.state, '', url); }
    } catch { /* ignore */ }
  }, []);

  // Until the chosen language arrives, keep showing the previous one rather than flashing keys.
  const value = useMemo(() => makeI18n(msgs.locale, msgs.m, setLocale), [msgs, setLocale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const c = useContext(Ctx);
  if (!c) throw new Error('useI18n needs <I18nProvider>');
  return c;
}
