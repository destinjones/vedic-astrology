/**
 * Display settings: motion, contrast, text size, reading font, how Sanskrit terms are written,
 * and whether the chart is drawn or shown as a table. Saved in this browser only.
 *
 * The settings are applied to <html> as data attributes (and one CSS variable), so every page
 * and every stylesheet can react to them without importing anything:
 *   data-motion="reduce"      animations, the starfield drift and the 3D spin stop
 *   data-contrast="high"      solid surfaces, brighter text, visible outlines
 *   data-font="dyslexic"|"hyperlegible"
 *   data-terms="iast"|"devanagari"
 *   --text-scale              multiplies every font size
 *   data-text="large"         set when text is scaled up or widened, so fixed-width layouts can wrap
 */
import { useSyncExternalStore } from 'react';

export type MotionPref = 'system' | 'reduce' | 'full';
export type ContrastPref = 'system' | 'high' | 'normal';
export type FontPref = 'default' | 'hyperlegible' | 'dyslexic';
/** 'local' keeps the UI language's own words (English names in English, Hindi in Hindi). */
export type TermsPref = 'local' | 'iast' | 'devanagari';

export interface DisplayPrefs {
  motion: MotionPref;
  contrast: ContrastPref;
  /** 1 = the design size. */
  textScale: number;
  font: FontPref;
  terms: TermsPref;
  /** Show the chart as a table of placements instead of the drawing. */
  chartTable: boolean;
}

export const TEXT_SCALES = [1, 1.125, 1.25, 1.5] as const;

export const DEFAULT_DISPLAY: DisplayPrefs = { motion: 'system', contrast: 'system', textScale: 1, font: 'default', terms: 'local', chartTable: false };

const KEY = 'vedic.display.v1';
const listeners = new Set<() => void>();

const pick = <T extends string>(x: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(x as T) ? (x as T) : fallback);

export function parseDisplay(raw: unknown): DisplayPrefs {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const scale = Number(o.textScale);
  return {
    motion: pick(o.motion, ['system', 'reduce', 'full'], 'system'),
    contrast: pick(o.contrast, ['system', 'high', 'normal'], 'system'),
    textScale: (TEXT_SCALES as readonly number[]).includes(scale) ? scale : 1,
    font: pick(o.font, ['default', 'hyperlegible', 'dyslexic'], 'default'),
    terms: pick(o.terms, ['local', 'iast', 'devanagari'], 'local'),
    chartTable: o.chartTable === true,
  };
}

function read(): DisplayPrefs {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return parseDisplay(JSON.parse(s));
  } catch { /* storage blocked or bad JSON */ }
  return DEFAULT_DISPLAY;
}

let current: DisplayPrefs = typeof window === 'undefined' ? DEFAULT_DISPLAY : read();

export const getDisplay = (): DisplayPrefs => current;

export function setDisplay(patch: Partial<DisplayPrefs>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* ignore */ }
  applyDisplay(current);
  listeners.forEach((l) => l());
}

const mq = (q: string) => (typeof matchMedia === 'function' ? matchMedia(q) : null);

/** True when motion should stop: the setting says so, or it follows a system that asks for less motion. */
export function reducedMotion(p: DisplayPrefs = current): boolean {
  if (p.motion === 'reduce') return true;
  if (p.motion === 'full') return false;
  return !!mq('(prefers-reduced-motion: reduce)')?.matches;
}

export function highContrast(p: DisplayPrefs = current): boolean {
  if (p.contrast === 'high') return true;
  if (p.contrast === 'normal') return false;
  return !!mq('(prefers-contrast: more)')?.matches || !!mq('(forced-colors: active)')?.matches;
}

/** Scroll behaviour that respects reduced motion. */
export const scrollBehavior = (): ScrollBehavior => (reducedMotion() ? 'auto' : 'smooth');

const FONT_LOADERS: Partial<Record<FontPref, () => Promise<unknown>>> = {
  hyperlegible: () => Promise.all([import('@fontsource/atkinson-hyperlegible/400.css'), import('@fontsource/atkinson-hyperlegible/700.css')]),
  dyslexic: () => Promise.all([import('@fontsource/opendyslexic/400.css'), import('@fontsource/opendyslexic/700.css')]),
};
const fontsLoaded = new Set<FontPref>();

export function applyDisplay(p: DisplayPrefs = current) {
  if (typeof document === 'undefined') return;
  const d = document.documentElement.dataset;
  d.motion = reducedMotion(p) ? 'reduce' : 'full';
  d.contrast = highContrast(p) ? 'high' : 'normal';
  d.font = p.font;
  d.terms = p.terms;
  d.text = p.textScale > 1 || p.font === 'dyslexic' ? 'large' : 'normal';
  document.documentElement.style.setProperty('--text-scale', String(p.textScale));
  const load = FONT_LOADERS[p.font];
  if (load && !fontsLoaded.has(p.font)) {
    fontsLoaded.add(p.font);
    load().catch(() => fontsLoaded.delete(p.font));
  }
}

/** Re-apply when the system setting changes while the page is open. */
let watching = false;
export function watchSystem() {
  if (watching || typeof window === 'undefined') return;
  watching = true;
  for (const q of ['(prefers-reduced-motion: reduce)', '(prefers-contrast: more)', '(forced-colors: active)']) {
    mq(q)?.addEventListener?.('change', () => { applyDisplay(); listeners.forEach((l) => l()); });
  }
  // another tab changed the settings
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    current = read();
    applyDisplay();
    listeners.forEach((l) => l());
  });
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useDisplay(): DisplayPrefs {
  return useSyncExternalStore(subscribe, getDisplay, () => DEFAULT_DISPLAY);
}

/** Re-renders when the effective motion setting changes (including the system one). */
export function useReducedMotion(): boolean {
  useDisplay();
  return useSyncExternalStore(subscribe, () => reducedMotion(), () => false);
}

/**
 * Smooth scrolling is asked for in many places (scrollIntoView, scrollTo). CSS cannot overrule a
 * script's `behavior: 'smooth'`, so with reduced motion on, those calls jump instead of gliding.
 */
function calmScrolling() {
  const unsmooth = <T,>(o: T): T =>
    (reducedMotion() && o && typeof o === 'object' && (o as ScrollOptions).behavior === 'smooth' ? { ...o, behavior: 'auto' } : o);
  const into = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) { into.call(this, unsmooth(arg)); };
  for (const target of [window, Element.prototype] as const) {
    const orig = target.scrollTo as (...a: unknown[]) => void;
    (target as { scrollTo: unknown }).scrollTo = function (this: unknown, ...a: unknown[]) { orig.apply(this, a.length === 1 ? [unsmooth(a[0])] : a); };
  }
}

// Apply as soon as any page imports this, before React renders, so nothing flashes.
if (typeof window !== 'undefined') { applyDisplay(); watchSystem(); calmScrolling(); }
