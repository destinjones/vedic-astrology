import { useState } from 'react';
import type { Chart, DashaSystemId } from '../types/chart';
import { DashaTimeline } from './DashaTimeline';

const SYSTEMS: { id: DashaSystemId; label: string; title: string }[] = [
  { id: 'vimshottari', label: 'Vimshottari', title: 'Vimshottari dasha' },
  { id: 'yogini', label: 'Yogini', title: 'Yogini dasha' },
  { id: 'ashtottari', label: 'Ashtottari', title: 'Ashtottari dasha' },
  { id: 'kalachakra', label: 'Kalachakra', title: 'Kalachakra dasha' },
];

const VIMSHOTTARI_NOTE = 'The main timing system: nine planets over 120 years, starting from the lord of your Moon’s nakshatra.';

/** Dasha timeline card with a switcher between the dasha systems the chart carries. */
export function DashaCard({ chart }: { chart: Chart }) {
  const [system, setSystem] = useState<DashaSystemId>('vimshottari');
  const available = SYSTEMS.filter((s) => s.id === 'vimshottari' || chart.dashaSystems?.[s.id]);
  const other = system === 'vimshottari' ? undefined : chart.dashaSystems?.[system];
  const periods = other?.periods ?? chart.dasha;
  if (!periods?.length) return null;
  const shown = other ? system : 'vimshottari';
  const title = SYSTEMS.find((s) => s.id === shown)!.title;

  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        {available.length > 1 ? (
          <div className="seg dasha-switch" role="radiogroup" aria-label="Dasha system">
            {available.map((s) => (
              <button key={s.id} role="radio" aria-checked={shown === s.id} className={shown === s.id ? 'is-active' : ''} onClick={() => setSystem(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <span className="muted">click a period to see its sub-periods</span>
        )}
      </div>
      <p className="muted dasha-note">{other?.note ?? VIMSHOTTARI_NOTE} Click a period to see its sub-periods.</p>
      <DashaTimeline key={shown} dasha={periods} system={shown} />
    </section>
  );
}
