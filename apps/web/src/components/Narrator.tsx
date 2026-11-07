import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Step } from '../lib/walkthrough';
import type { Knowledge } from '../lib/readings';
import { buildNarration, SPEECH_LANG, voicesFor } from '../lib/narration';
import { useI18n } from '../i18n';

const PREF_KEY = 'vedic.narration';
interface Prefs { rate: number; voice: string; full: boolean }
const readPrefs = (): Prefs => { try { return { rate: 1, voice: '', full: true, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }; } catch { return { rate: 1, voice: '', full: true }; } };

/** A player bar that reads the chart aloud, moving the page to each part as it goes. */
export function Narrator({ steps, knowledge, onStep, onClose }: {
  steps: Step[]; knowledge: Knowledge | null; onStep: (s: Step) => void; onClose: () => void;
}) {
  const synth = window.speechSynthesis;
  const { locale } = useI18n();
  const [prefs, setPrefs] = useState<Prefs>(readPrefs);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => synth.getVoices());
  const [part, setPart] = useState(0);
  const [state, setState] = useState<'idle' | 'playing' | 'paused' | 'done'>('idle');
  const run = useRef(0);
  const script = useMemo(() => buildNarration(steps, knowledge, prefs.full), [steps, knowledge, prefs.full]);

  useEffect(() => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* blocked */ } }, [prefs]);
  useEffect(() => {
    const load = () => setVoices(synth.getVoices());
    synth.addEventListener?.('voiceschanged', load);
    return () => synth.removeEventListener?.('voiceschanged', load);
  }, [synth]);
  // stop talking when the bar closes or the page goes away
  useEffect(() => () => { run.current++; synth.cancel(); }, [synth]);

  const english = useMemo(() => voicesFor(SPEECH_LANG.en, voices), [voices]);
  const pickVoice = useCallback((lang: string) => {
    if (lang.startsWith('en')) return english.find((v) => v.voiceURI === prefs.voice) ?? english[0];
    return voicesFor(lang, voices)[0];
  }, [english, voices, prefs.voice]);

  const playFrom = useCallback((p: number, c = 0) => {
    const id = ++run.current;
    synth.cancel();
    if (p >= script.length) { setState('done'); return; }
    setPart(p);
    setState('playing');
    if (c === 0) onStep(script[p].step);
    const speak = (pi: number, ci: number) => {
      if (id !== run.current) return;
      const cur = script[pi];
      if (!cur) { setState('done'); return; }
      if (ci >= cur.chunks.length) {
        // a short beat between parts while the page moves
        setTimeout(() => {
          if (id !== run.current) return;
          if (pi + 1 >= script.length) { setState('done'); return; }
          setPart(pi + 1);
          onStep(script[pi + 1].step);
          speak(pi + 1, 0);
        }, 650);
        return;
      }
      const ch = cur.chunks[ci];
      const u = new SpeechSynthesisUtterance(ch.text);
      const voice = pickVoice(ch.lang);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? ch.lang;
      u.rate = prefs.rate;
      u.onend = () => speak(pi, ci + 1);
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') speak(pi, ci + 1); };
      synth.speak(u);
    };
    speak(p, c);
  }, [script, synth, onStep, pickVoice, prefs.rate]);

  const toggle = () => {
    if (state === 'playing') { synth.pause(); setState('paused'); }
    else if (state === 'paused') { synth.resume(); setState('playing'); }
    else playFrom(state === 'done' ? 0 : part);
  };

  // a new speed or voice takes effect from the start of the current part
  const restartWith = (patch: Partial<Prefs>) => { setPrefs((p) => ({ ...p, ...patch })); if (state === 'playing') setTimeout(() => playFrom(part), 0); };

  const noLocalVoice = locale !== 'en' && knowledge?.locale === locale && !voicesFor(SPEECH_LANG[locale] ?? locale, voices).length;

  return (
    <div className="narrator" role="region" aria-label="Narration">
      <button className="btn-primary narrator-play" onClick={toggle} aria-label={state === 'playing' ? 'Pause' : 'Play'}>{state === 'playing' ? '❚❚' : '▶'}</button>
      <button className="btn-ghost sm" onClick={() => playFrom(Math.max(0, part - 1))} disabled={part === 0} aria-label="Previous part">⏮</button>
      <button className="btn-ghost sm" onClick={() => playFrom(part + 1)} disabled={part >= script.length - 1} aria-label="Next part">⏭</button>
      <div className="narrator-now">
        <small className="muted">{state === 'done' ? 'Finished' : `Part ${part + 1} of ${script.length}`}</small>
        <b>{script[part]?.step.title}</b>
      </div>
      <label className="narrator-opt">
        <span className="muted">Speed</span>
        <select value={prefs.rate} onChange={(e) => restartWith({ rate: Number(e.target.value) })}>
          {[0.8, 0.9, 1, 1.15, 1.3, 1.5].map((r) => <option key={r} value={r}>{r}×</option>)}
        </select>
      </label>
      {english.length > 1 && (
        <label className="narrator-opt">
          <span className="muted">Voice</span>
          <select value={prefs.voice || english[0]?.voiceURI} onChange={(e) => restartWith({ voice: e.target.value })}>
            {english.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name.replace(/^Microsoft |^Google /, '')}</option>)}
          </select>
        </label>
      )}
      <label className="check narrator-opt" title="Also read each planet's sign, house and nakshatra readings, and the leading yogas">
        <input type="checkbox" checked={prefs.full} onChange={(e) => restartWith({ full: e.target.checked })} /> Full readings
      </label>
      {noLocalVoice && <small className="muted narrator-note">This device has no voice for the readings' language, so they are read in its default voice.</small>}
      <button className="btn-ghost sm" onClick={() => { run.current++; synth.cancel(); onClose(); }} aria-label="Stop narration">✕</button>
    </div>
  );
}
