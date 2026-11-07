import { useMemo, useState } from 'react';
import type { DashaPeriod } from '../types/chart';
import { PLANET_BY_ID } from '../data/constants';

interface Props { dasha: DashaPeriod[] }

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

export function DashaTimeline({ dasha }: Props) {
  const now = Date.now();
  const currentIdx = useMemo(() => dasha.findIndex((d) => +new Date(d.start) <= now && now < +new Date(d.end)), [dasha, now]);
  const [open, setOpen] = useState<number>(currentIdx >= 0 ? currentIdx : 0);
  const t0 = +new Date(dasha[0].start);
  const t1 = +new Date(dasha[dasha.length - 1].end);
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const active = dasha[open];

  return (
    <div className="dasha">
      <div className="dasha-bar">
        {dasha.map((d, i) => {
          const p = PLANET_BY_ID[d.lord];
          const w = pct(+new Date(d.end)) - pct(+new Date(d.start));
          return (
            <button key={i} className={`dasha-seg${i === open ? ' is-open' : ''}${i === currentIdx ? ' is-now' : ''}`}
              style={{ width: `${w}%`, '--c': p.color } as React.CSSProperties}
              onClick={() => setOpen(i)} title={`${p.name} mahadasha · ${fmt(d.start)} – ${fmt(d.end)}`}>
              <span>{p.abbr}</span>
            </button>
          );
        })}
        {now > t0 && now < t1 && <div className="dasha-now" style={{ left: `${pct(now)}%` }}><span>Now</span></div>}
      </div>
      <div className="dasha-detail">
        <h4>
          <span style={{ color: PLANET_BY_ID[active.lord].color }}>{PLANET_BY_ID[active.lord].glyph}</span>{' '}
          {PLANET_BY_ID[active.lord].name} mahadasha <span className="muted">{fmt(active.start)} – {fmt(active.end)}</span>
        </h4>
        <div className="antar-grid">
          {active.sub?.map((s, i) => {
            const isNow = +new Date(s.start) <= now && now < +new Date(s.end);
            const p = PLANET_BY_ID[s.lord];
            return (
              <div key={i} className={`antar${isNow ? ' is-now' : ''}`} style={{ '--c': p.color } as React.CSSProperties}>
                <b>{PLANET_BY_ID[active.lord].abbr}–{p.abbr}</b>
                <small>{fmt(s.start)} → {fmt(s.end)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
