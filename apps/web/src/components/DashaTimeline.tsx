import { useMemo, useState } from 'react';
import type { DashaPeriod, DashaSystemId } from '../types/chart';
import { PLANET_BY_ID, signInfo } from '../data/constants';

interface Props { dasha: DashaPeriod[]; system?: DashaSystemId }

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

/** How a period is named and coloured in each system */
function look(d: DashaPeriod, system: DashaSystemId) {
  const p = PLANET_BY_ID[d.lord];
  if (system === 'kalachakra' && d.sign) {
    const s = signInfo(d.sign);
    return { abbr: s.short, glyph: s.glyph, title: `${s.name} (${p.name})`, color: p.color };
  }
  if (system === 'yogini' && d.name) {
    return { abbr: d.name.slice(0, 3), glyph: p.glyph, title: `${d.name} (${p.name})`, color: p.color };
  }
  return { abbr: p.abbr, glyph: p.glyph, title: p.name, color: p.color };
}

const NOUN: Record<DashaSystemId, string> = {
  vimshottari: 'mahadasha',
  yogini: 'yogini dasha',
  ashtottari: 'mahadasha',
  kalachakra: 'dasha',
};

export function DashaTimeline({ dasha, system = 'vimshottari' }: Props) {
  const now = Date.now();
  const currentIdx = useMemo(() => dasha.findIndex((d) => +new Date(d.start) <= now && now < +new Date(d.end)), [dasha, now]);
  const [open, setOpen] = useState<number>(currentIdx >= 0 ? currentIdx : 0);
  const t0 = +new Date(dasha[0].start);
  const t1 = +new Date(dasha[dasha.length - 1].end);
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const active = dasha[Math.min(open, dasha.length - 1)];
  const a = look(active, system);

  return (
    <div className="dasha">
      <div className="dasha-bar">
        {dasha.map((d, i) => {
          const l = look(d, system);
          const w = pct(+new Date(d.end)) - pct(+new Date(d.start));
          return (
            <button key={i} className={`dasha-seg${i === open ? ' is-open' : ''}${i === currentIdx ? ' is-now' : ''}`}
              style={{ width: `${w}%`, '--c': l.color } as React.CSSProperties}
              onClick={() => setOpen(i)} title={`${l.title} ${NOUN[system]} · ${fmt(d.start)} – ${fmt(d.end)}`}
              aria-label={`${l.title} ${NOUN[system]}, ${fmt(d.start)} to ${fmt(d.end)}`}>
              <span>{l.abbr}</span>
            </button>
          );
        })}
        {now > t0 && now < t1 && <div className="dasha-now" style={{ left: `${pct(now)}%` }}><span>Now</span></div>}
      </div>
      <div className="dasha-detail">
        <h4>
          <span style={{ color: a.color }}>{a.glyph}</span>{' '}
          {a.title} {NOUN[system]} <span className="muted">{fmt(active.start)} – {fmt(active.end)}</span>
        </h4>
        <div className="antar-grid">
          {active.sub?.map((s, i) => {
            const isNow = +new Date(s.start) <= now && now < +new Date(s.end);
            const l = look(s, system);
            return (
              <div key={i} className={`antar${isNow ? ' is-now' : ''}`} style={{ '--c': l.color } as React.CSSProperties} title={l.title}>
                <b>{a.abbr}–{l.abbr}</b>
                <small>{fmt(s.start)} → {fmt(s.end)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
