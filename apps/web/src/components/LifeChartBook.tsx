import { lazy, Suspense, useState } from 'react';
import type { Chart } from '../types/chart';

// The editor (and the readings it lists) loads only when someone opens it.
const BookDialog = lazy(() => import('./LifeChartBookDialog'));

/** The "Life Chart Book" button and its editor: a long, printable book for a client, made in the browser. */
export function LifeChartBookButton({ chart, disabled }: { chart: Chart; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn-ghost" disabled={disabled || !chart.engineContext} onClick={() => setOpen(true)}
        title="A long, printable book of this chart for a client, with your own notes and letters">
        Life Chart Book
      </button>
      {open && <Suspense fallback={null}><BookDialog chart={chart} onClose={() => setOpen(false)} /></Suspense>}
    </>
  );
}
