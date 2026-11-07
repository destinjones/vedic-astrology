/** Colour + formatting helpers for the timing UI. */
import type { Planet, Tone } from '../src/types';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => {
  const A = hex(a), B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};

export const isDark = () => typeof window !== 'undefined' && (document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' && window.matchMedia?.('(prefers-color-scheme: dark)').matches));

/** Diverging blue (favourable) <-> grey <-> red (challenging). score -100..100. */
export function scoreColor(score: number, dark = isDark()): string {
  const good = dark ? '#3987e5' : '#2a78d6';
  const bad = dark ? '#e66767' : '#e34948';
  const mid = dark ? '#383835' : '#e4e3df';
  const t = Math.min(1, Math.abs(score) / 60);
  return score >= 0 ? mix(mid, good, t) : mix(mid, bad, t);
}

/** Sequential blue for counts (ashtakavarga). */
const SEQ = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95'];
export function seqColor(t: number): string {
  return SEQ[Math.max(0, Math.min(SEQ.length - 1, Math.round(t * (SEQ.length - 1))))];
}
export const seqInk = (t: number) => (t > 0.55 ? '#ffffff' : '#0b0b0b');

/** Fixed categorical slot per retrograding planet (entity, never rank). */
export const PLANET_COLOR: Partial<Record<Planet, string>> = {
  Mercury: 'var(--series-3)', Venus: 'var(--series-5)', Mars: 'var(--series-2)', Jupiter: 'var(--series-4)', Saturn: 'var(--series-1)',
};

export const TONE_LABEL: Record<Tone, { label: string; icon: string }> = {
  excellent: { label: 'Excellent', icon: '▲▲' },
  good: { label: 'Favourable', icon: '▲' },
  mixed: { label: 'Mixed', icon: '●' },
  challenging: { label: 'Challenging', icon: '▼' },
  difficult: { label: 'Difficult', icon: '▼▼' },
};

export const GLYPH: Record<Planet, string> = {
  Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿', Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = (d: Date | null | undefined) => (d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : '—');
export const fmtMonth = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
export const fmtRange = (a: Date | null, b: Date | null) => `${fmtDate(a)} – ${fmtDate(b)}`;
export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
