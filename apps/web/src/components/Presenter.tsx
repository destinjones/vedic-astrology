import { useEffect, useState } from 'react';
import type { Step } from '../lib/walkthrough';

interface Props {
  steps: Step[];
  onStep: (s: Step) => void;
  onExit: () => void;
}

const AUTO_MS = 14000;

/** Bottom bar for presenting: step through the chart, or let it play for a recording. */
export function Presenter({ steps, onStep, onExit }: Props) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(false);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  useEffect(() => { if (step) onStep(step); }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); setI((n) => Math.min(n + 1, steps.length - 1)); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); setI((n) => Math.max(n - 1, 0)); }
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [steps.length, onExit]);

  const playing = auto && !last;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((n) => n + 1), AUTO_MS);
    return () => clearTimeout(t);
  }, [playing, i]);

  const progress = ((i + 1) / steps.length) * 100;
  if (!step) return null;

  return (
    <div className="presenter" role="region" aria-label="Chart walkthrough">
      <div className="presenter-progress" style={{ width: `${progress}%` }} />
      <div className="presenter-body">
        <div className="presenter-text" aria-live="polite">
          <small className="muted">Step {i + 1} of {steps.length}</small>
          <h3>{step.title}</h3>
          <p>{step.text}</p>
        </div>
        <div className="presenter-controls">
          <button className="btn-ghost" onClick={() => setI((n) => Math.max(n - 1, 0))} disabled={i === 0} aria-label="Previous step">←</button>
          <button className="btn-primary" onClick={() => (last ? onExit() : setI((n) => n + 1))}>{last ? 'Finish' : 'Next →'}</button>
          <button className={`btn-ghost ${playing ? 'is-saved' : ''}`} onClick={() => setAuto((a) => !a)} title="Advance every 14 seconds, for a recorded walkthrough">
            {playing ? '❚❚ Pause' : '▶ Auto-play'}
          </button>
          <button className="btn-ghost" onClick={onExit}>Exit</button>
        </div>
      </div>
    </div>
  );
}
