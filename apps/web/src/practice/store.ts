/**
 * The astrologer's own practice library, kept in this browser:
 *   - saved phrases: their write-ups for placements ("Moon in Rohini"), suggested whenever the placement comes up again
 *   - reading templates: their standard reading structures (career, marriage…), reused for every client
 *   - readings: one per chart, made from a template, printed in the consultation PDF
 * Export and import move the library between browsers as one JSON file.
 */
import { useSyncExternalStore } from 'react';
import type { Chart } from '../types/chart';
import { draftKey } from '../report/book/draft';
import { isPlacementKey, topicKeys, type Found } from './placements';

export interface Phrase {
  id: string;
  /** A short name, e.g. "Moon in Rohini, the tender gardener". */
  title: string;
  text: string;
  /** Placement keys it is filed under. */
  keys: string[];
  updatedAt: string;
}

export interface TemplateSection {
  id: string;
  heading: string;
  /** The astrologer's own prompt for this part ("Talk about the 10th lord first…"). Not printed. */
  guide: string;
  /** What the section is about, so phrases for those placements are suggested. */
  topics: string[];
}

export interface ReadingTemplate {
  id: string;
  name: string;
  about: string;
  sections: TemplateSection[];
  updatedAt: string;
}

export interface ReadingSection { id: string; heading: string; guide: string; topics: string[]; text: string }

export interface Reading {
  templateId: string;
  title: string;
  /** Printed under the title, e.g. "Prepared for our session on 12 March". */
  intro: string;
  sections: ReadingSection[];
  updatedAt: string;
}

export const PHRASES_KEY = 'vedic.phrases';
export const TEMPLATES_KEY = 'vedic.templates';
export const readingKey = (input: Chart['input']) => draftKey(input).replace('vedic.book.', 'vedic.reading.');

const now = () => new Date().toISOString();
export const newId = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// ------------------------------------------------------------------ starter templates

const sec = (id: string, heading: string, guide: string, topics: string[]): TemplateSection => ({ id, heading, guide, topics });

/** Starting points. The astrologer edits them freely; "Add the starter templates" brings back any that were deleted. */
export const STARTER_TEMPLATES: ReadingTemplate[] = [
  {
    id: 'starter-first', name: 'First reading', about: 'A whole-chart reading for a new client.', updatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      sec('lagna', 'Who you are', 'The rising sign, its lord and anything in the 1st house.', ['asc']),
      sec('moon', 'Your mind and heart', 'Moon sign, birth star and pada.', ['graha:moon']),
      sec('gifts', 'Your gifts', 'The strongest yogas and best-placed planets.', ['yogas']),
      sec('lessons', 'Your lessons', 'Doshas and the planets that ask for patience.', ['doshas', 'graha:saturn']),
      sec('now', 'The season you are in', 'The current dasha and sub-period, and what it asks.', []),
      sec('advice', 'What to do next', 'Two or three practical steps and any remedies.', []),
    ],
  },
  {
    id: 'starter-career', name: 'Career reading', about: 'Work, vocation, money and timing.', updatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      sec('overview', 'Your working nature', 'The rising sign and its lord: how they approach work.', ['asc']),
      sec('tenth', 'The 10th house: vocation', 'The 10th house, its lord, planets in it. Note the Sun and Saturn.', ['house:10', 'graha:sun', 'graha:saturn']),
      sec('skills', 'Skills and talents', 'The 3rd and 6th houses and Mercury.', ['house:3', 'house:6', 'graha:mercury']),
      sec('money', 'Income and gains', 'The 2nd and 11th houses and their lords, and Jupiter.', ['house:2', 'house:11', 'graha:jupiter']),
      sec('timing', 'Timing', 'The current dasha, Jupiter and Saturn transits over the 10th.', []),
      sec('advice', 'Advice', 'Concrete next steps.', []),
    ],
  },
  {
    id: 'starter-marriage', name: 'Marriage reading', about: 'Partnership, the spouse and timing of marriage.', updatedAt: '2026-01-01T00:00:00.000Z',
    sections: [
      sec('seventh', 'The 7th house: partnership', 'The 7th house, its lord and planets in or aspecting it.', ['house:7']),
      sec('venus', 'Venus and love', 'Venus by sign, star and house. Jupiter too for a woman\'s chart, by tradition.', ['graha:venus', 'graha:jupiter']),
      sec('navamsha', 'The navamsha', 'The D9: its rising sign, the 7th there and Venus.', []),
      sec('doshas', 'Doshas to understand', 'Manglik and any other dosha, with what cancels or softens it.', ['doshas', 'graha:mars']),
      sec('family', 'Home and family', 'The 2nd, 4th and 5th houses.', ['house:2', 'house:4', 'house:5']),
      sec('timing', 'Timing', 'Dashas of the 7th lord, Venus and Rahu; Jupiter over the 7th.', []),
    ],
  },
];

// ------------------------------------------------------------------ cleaning stored and imported data

const str = (v: unknown, max = 20000) => (typeof v === 'string' ? v.slice(0, max) : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const stamp = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : now());

export function normalisePhrase(x: unknown): Phrase | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const text = str(o.text);
  if (!text.trim()) return null;
  return {
    id: str(o.id, 80) || newId('ph'),
    title: str(o.title, 200),
    text,
    keys: [...new Set(strs(o.keys).filter(isPlacementKey))],
    updatedAt: stamp(o.updatedAt),
  };
}

const normaliseSection = (x: unknown, i: number): TemplateSection | null => {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const heading = str(o.heading, 200);
  if (!heading.trim()) return null;
  return { id: str(o.id, 80) || `s${i + 1}`, heading, guide: str(o.guide, 2000), topics: strs(o.topics) };
};

export function normaliseTemplate(x: unknown): ReadingTemplate | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const name = str(o.name, 200);
  const sections = (Array.isArray(o.sections) ? o.sections : []).map(normaliseSection).filter((s): s is TemplateSection => !!s);
  if (!name.trim() || !sections.length) return null;
  return { id: str(o.id, 80) || newId('tpl'), name, about: str(o.about, 1000), sections, updatedAt: stamp(o.updatedAt) };
}

export function normaliseReading(x: unknown): Reading | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const sections = (Array.isArray(o.sections) ? o.sections : []).map((s, i) => {
    const t = normaliseSection(s, i);
    return t ? { ...t, text: str((s as Record<string, unknown>).text) } : null;
  }).filter((s): s is ReadingSection => !!s);
  if (!sections.length) return null;
  return { templateId: str(o.templateId, 80), title: str(o.title, 200) || 'Your reading', intro: str(o.intro, 4000), sections, updatedAt: stamp(o.updatedAt) };
}

const list = <T,>(x: unknown, f: (v: unknown) => T | null) => (Array.isArray(x) ? x.map(f).filter((v): v is T => !!v) : []);

// ------------------------------------------------------------------ browser storage, shared between every dialog that uses it

const listeners = new Set<() => void>();
const cache = new Map<string, unknown>();

function readRaw(key: string): unknown {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function load<T>(key: string, parse: (x: unknown) => T): T {
  if (!cache.has(key)) cache.set(key, parse(readRaw(key)));
  return cache.get(key) as T;
}
function store(key: string, value: unknown) {
  cache.set(key, value);
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage full or blocked: kept for this visit */ }
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  const other = (e: StorageEvent) => { if (e.key && cache.has(e.key)) { cache.delete(e.key); l(); } };
  window.addEventListener('storage', other);
  return () => { listeners.delete(l); window.removeEventListener('storage', other); };
};

/** null in storage means the starters have never been set up; an empty list means the astrologer deleted them all. */
const parseTemplates = (x: unknown) => (Array.isArray(x) ? list(x, normaliseTemplate) : STARTER_TEMPLATES);
const parsePhrases = (x: unknown) => list(x, normalisePhrase);

export const getPhrases = () => load(PHRASES_KEY, parsePhrases);
export const getTemplates = () => load(TEMPLATES_KEY, parseTemplates);
export const setPhrases = (p: Phrase[]) => store(PHRASES_KEY, p);
export const setTemplates = (t: ReadingTemplate[]) => store(TEMPLATES_KEY, t);
export const getReading = (input: Chart['input']) => load(readingKey(input), normaliseReading);
export const setReading = (input: Chart['input'], r: Reading | null) => store(readingKey(input), r);

export const usePhrases = () => useSyncExternalStore(subscribe, getPhrases, getPhrases);
export const useTemplates = () => useSyncExternalStore(subscribe, getTemplates, getTemplates);
export function useReading(input: Chart['input']) {
  const get = () => getReading(input);
  return useSyncExternalStore(subscribe, get, get);
}

export function savePhrase(p: Phrase) {
  const all = getPhrases();
  const next = { ...p, updatedAt: now() };
  setPhrases(all.some((x) => x.id === p.id) ? all.map((x) => (x.id === p.id ? next : x)) : [next, ...all]);
}
export const deletePhrase = (id: string) => setPhrases(getPhrases().filter((p) => p.id !== id));

export function saveTemplate(t: ReadingTemplate) {
  const all = getTemplates();
  const next = { ...t, updatedAt: now() };
  setTemplates(all.some((x) => x.id === t.id) ? all.map((x) => (x.id === t.id ? next : x)) : [...all, next]);
}
export const deleteTemplate = (id: string) => setTemplates(getTemplates().filter((t) => t.id !== id));
/** Add back any starter template that is not in the library. */
export const restoreStarters = () => setTemplates([...getTemplates(), ...STARTER_TEMPLATES.filter((s) => !getTemplates().some((t) => t.id === s.id))]);

// ------------------------------------------------------------------ matching

/** Saved phrases filed under any of these keys, best match (most keys in common) first. */
export function phrasesFor(phrases: Phrase[], keys: string[]): Phrase[] {
  const want = new Set(keys);
  return phrases
    .map((p) => ({ p, n: p.keys.filter((k) => want.has(k)).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.p.updatedAt.localeCompare(a.p.updatedAt))
    .map((x) => x.p);
}

export const phrasesForTopics = (phrases: Phrase[], chart: Chart, topics: string[], found?: Found | null) =>
  phrasesFor(phrases, topics.flatMap((t) => topicKeys(chart, t, found)));

/** Add a phrase to a text: on its own paragraph, and not twice. */
export function withPhrase(text: string, phrase: string): string {
  const t = phrase.trim();
  if (!t || text.includes(t)) return text;
  return text.trim() ? `${text.trimEnd()}\n\n${t}` : t;
}

/** A new reading for a chart, from a template. With `fill`, each section starts with the saved phrases that match it. */
export function readingFromTemplate(t: ReadingTemplate, o: { chart?: Chart; phrases?: Phrase[]; found?: Found | null; fill?: boolean } = {}): Reading {
  return {
    templateId: t.id,
    title: t.name,
    intro: '',
    updatedAt: now(),
    sections: t.sections.map((s) => ({
      ...s,
      text: o.fill && o.chart && o.phrases ? phrasesForTopics(o.phrases, o.chart, s.topics, o.found).reduce((acc, p) => withPhrase(acc, p.text), '') : '',
    })),
  };
}

/** Save the reading's shape back as a template (new headings, guides and topics), keeping the template's id. */
export const templateFromReading = (r: Reading, base?: ReadingTemplate): ReadingTemplate => ({
  id: base?.id ?? newId('tpl'),
  name: base?.name ?? r.title,
  about: base?.about ?? '',
  sections: r.sections.map(({ id, heading, guide, topics }) => ({ id, heading, guide, topics })),
  updatedAt: now(),
});

/** Whether a reading has anything to print. */
export const hasText = (r: Reading | null | undefined): r is Reading => !!r && r.sections.some((s) => s.text.trim());

// ------------------------------------------------------------------ export and import

export const LIBRARY_KIND = 'jyotisha-practice-library';

export function exportLibrary(o: { phrases?: boolean; templates?: boolean } = {}): string {
  return JSON.stringify({
    kind: LIBRARY_KIND,
    version: 1,
    exportedAt: now(),
    ...(o.templates !== false ? { templates: getTemplates() } : {}),
    ...(o.phrases !== false ? { phrases: getPhrases() } : {}),
  }, null, 2);
}

export interface ImportResult { phrases: Phrase[]; templates: ReadingTemplate[]; added: number; updated: number }

/** Merge two lists by id: new items are added and the newer edit of the same item wins. */
function mergeById<T extends { id: string; updatedAt: string }>(here: T[], there: T[], prepend = false) {
  const byId = new Map(here.map((x) => [x.id, x]));
  let added = 0, updated = 0;
  const fresh: T[] = [];
  for (const t of there) {
    const h = byId.get(t.id);
    if (!h) { fresh.push(t); byId.set(t.id, t); added++; }
    else if (t.updatedAt > h.updatedAt) { byId.set(t.id, t); updated++; }
  }
  const kept = here.map((x) => byId.get(x.id)!);
  return { list: prepend ? [...fresh, ...kept] : [...kept, ...fresh], added, updated };
}

/**
 * Fold a library file into what is here. Also accepts a bare list of phrases
 * or templates. Running the same import twice changes nothing. Throws on anything else.
 */
export function mergeLibrary(here: { phrases: Phrase[]; templates: ReadingTemplate[] }, text: string): ImportResult {
  const data = JSON.parse(text) as unknown;
  let phrases: unknown, templates: unknown;
  if (Array.isArray(data)) {
    const first = data[0] as Record<string, unknown> | undefined;
    if (first && Array.isArray(first.sections)) templates = data; else phrases = data;
  } else if (data && typeof data === 'object') {
    ({ phrases, templates } = data as { phrases?: unknown; templates?: unknown });
  }
  if (phrases === undefined && templates === undefined) throw new Error('not a practice library');
  const p = mergeById(here.phrases, list(phrases, normalisePhrase), true);
  const t = mergeById(here.templates, list(templates, normaliseTemplate));
  return { phrases: p.list, templates: t.list, added: p.added + t.added, updated: p.updated + t.updated };
}

export function importLibrary(text: string) {
  const r = mergeLibrary({ phrases: getPhrases(), templates: getTemplates() }, text);
  setPhrases(r.phrases);
  setTemplates(r.templates);
  return r;
}
