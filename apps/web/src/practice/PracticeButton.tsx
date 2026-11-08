import { lazy, Suspense, useMemo, useState } from 'react';
import type { Chart } from '../types/chart';
import { chartPlacements } from './placements';
import { hasText, phrasesFor, usePhrases, useReading } from './store';
import './practice.css';

// The editor (and the yoga list it offers) loads only when someone opens it.
const PracticeDialog = lazy(() => import('./PracticeDialog'));

/** "Readings and phrases": the astrologer's templates and saved write-ups, with a count of phrases that match this chart. */
export function PracticeButton({ chart, disabled }: { chart: Chart; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const phrases = usePhrases();
  const reading = useReading(chart.input);
  const hits = useMemo(() => phrasesFor(phrases, chartPlacements(chart).map((p) => p.key)).length, [phrases, chart]);
  const title = [
    'Your reading templates and saved phrases',
    hits ? `${hits} of your saved phrases match this chart` : '',
    hasText(reading) ? 'This chart has a reading in progress' : '',
  ].filter(Boolean).join('. ');
  return (
    <>
      <button className="btn-ghost" disabled={disabled} onClick={() => setOpen(true)} title={title}>
        Readings and phrases{hits > 0 && <span className="practice-count" aria-label={`${hits} matching phrases`}>{hits}</span>}
      </button>
      {open && <Suspense fallback={null}><PracticeDialog chart={chart} onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
