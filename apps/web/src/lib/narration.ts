/**
 * Audio narration of a chart's readings, spoken by the browser's own speech
 * engine (Web Speech API). Nothing is sent anywhere; voices come from the
 * operating system, so what is available differs by device.
 */
import type { Step } from './walkthrough';
import type { Knowledge } from './readings';

export interface Chunk { text: string; lang: string }
export interface NarrationPart { step: Step; chunks: Chunk[] }

/** BCP 47 tags the speech engines know, per app language. */
export const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', bn: 'bn-IN', ta: 'ta-IN', te: 'te-IN', mr: 'mr-IN', gu: 'gu-IN', kn: 'kn-IN', es: 'es-ES',
};

/**
 * Speech engines cut long utterances short (Chrome stops after ~15 s), so the
 * text goes out a sentence or two at a time.
 */
export function sentences(text: string, max = 220): string[] {
  const parts = text.replace(/\s+/g, ' ').trim().match(/[^.!?।]+[.!?।]+["')\]]*|[^.!?।]+$/g) ?? [];
  const out: string[] = [];
  let cur = '';
  for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
    if (cur && (cur + ' ' + p).length > max) { out.push(cur); cur = p; } else cur = cur ? `${cur} ${p}` : p;
  }
  if (cur) out.push(cur);
  return out;
}

/** Sanskrit terms read more naturally without their diacritics and symbols. */
const speakable = (s: string) => s.replace(/℞/g, ' retrograde').replace(/[·•]/g, ',').replace(/°/g, ' degrees').replace(/\s+/g, ' ');

/**
 * The script: the walkthrough's steps, and with `full` each planet's sign,
 * house and nakshatra readings and the leading yogas read after its step.
 */
export function buildNarration(steps: Step[], knowledge: Knowledge | null, full: boolean): NarrationPart[] {
  const en = SPEECH_LANG.en;
  const rl = knowledge ? SPEECH_LANG[knowledge.locale] ?? en : en;
  return steps.map((step) => {
    const chunks: Chunk[] = sentences(speakable(`${step.title}. ${step.text}`)).map((text) => ({ text, lang: en }));
    if (full && knowledge) {
      const extra: string[] = [];
      if (step.select?.kind === 'planet') {
        const r = knowledge.report.planets[step.select.id];
        if (r) extra.push(r.sign.summary, r.house.summary, r.nakshatra.summary);
      } else if (step.select?.kind === 'asc' && step.title.toLowerCase().startsWith('lagna')) {
        const top = knowledge.report.highlights.strengths[0];
        if (top) extra.push(top.summary);
      } else if (step.target === '#yogas') {
        for (const y of knowledge.report.yogas.slice(0, 4)) extra.push(`${y.name}. ${y.reading.summary}`);
        for (const d of knowledge.report.doshas.filter((x) => x.present).slice(0, 2)) extra.push(`${d.name}. ${d.reading.summary}`);
      }
      for (const e of extra.filter(Boolean)) chunks.push(...sentences(speakable(e)).map((text) => ({ text, lang: rl })));
    }
    return { step, chunks };
  });
}

/** Voices for a language, best first: an exact match, then the same language anywhere, local voices before network ones. */
export function voicesFor(lang: string, all: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const base = lang.split('-')[0];
  const score = (v: SpeechSynthesisVoice) => (v.lang.replace('_', '-') === lang ? 0 : v.lang.startsWith(base) ? 1 : 9) + (v.localService ? 0 : 0.5);
  return all.filter((v) => v.lang.startsWith(base)).sort((a, b) => score(a) - score(b));
}

export const speechSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
