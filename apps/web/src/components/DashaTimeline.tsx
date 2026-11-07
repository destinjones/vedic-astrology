import { useMemo, useState } from 'react';
import type { DashaPeriod, DashaSystemId } from '../types/chart';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { useI18n, type I18n } from '../i18n';

interface Props { dasha: DashaPeriod[]; system?: DashaSystemId }

/** How a period is named and coloured in each system */
function look(d: DashaPeriod, system: DashaSystemId, v: I18n['v']) {
  const p = PLANET_BY_ID[d.lord];
  const name = v.planets[d.lord].name;
  if (system === 'kalachakra' && d.sign) {
    const s = signInfo(d.sign);
    return { abbr: s.short, glyph: s.glyph, title: `${s.name} (${name})`, color: p.color };
  }
  if (system === 'yogini' && d.name) {
    return { abbr: d.name.slice(0, 3), glyph: p.glyph, title: `${d.name} (${name})`, color: p.color };
  }
  return { abbr: v.planets[d.lord].short, glyph: p.glyph, title: name, color: p.color };
}

const NOUN: Record<DashaSystemId, string> = {
  vimshottari: 'mahadasha',
  yogini: 'yogini dasha',
  ashtottari: 'mahadasha',
  kalachakra: 'dasha',
};

export function DashaTimeline({ dasha, system = 'vimshottari' }: Props) {
  const { t, v, date } = useI18n();
  const fmt = (iso: string) => date(iso, { year: 'numeric', month: 'short' });
  // planet-lord systems use the translated "{planet} mahadasha"; the others keep their own names
  const label = (title: string) =>
    NOUN[system] === 'mahadasha' ? t('dasha.mahadasha', { planet: title }) : `${title} ${NOUN[system]}`;
  const now = Date.now();
  const currentIdx = useMemo(() => dasha.findIndex((d) => +new Date(d.start) <= now && now < +new Date(d.end)), [dasha, now]);
  const [open, setOpen] = useState<number>(currentIdx >= 0 ? currentIdx : 0);
  const t0 = +new Date(dasha[0].start);
  const t1 = +new Date(dasha[dasha.length - 1].end);
  const pct = (t: number) => ((t - t0) / (t1 - t0)) * 100;
  const active = dasha[Math.min(open, dasha.length - 1)];
  const a = look(active, system, v);

  return (
    <div className="dasha">
      <div className="dasha-bar">
        {dasha.map((d, i) => {
          const l = look(d, system, v);
          const w = pct(+new Date(d.end)) - pct(+new Date(d.start));
          return (
            <button key={i} className={`dasha-seg${i === open ? ' is-open' : ''}${i === currentIdx ? ' is-now' : ''}`}
              style={{ width: `${w}%`, '--c': l.color } as React.CSSProperties}
              onClick={() => setOpen(i)} title={`${label(l.title)} · ${fmt(d.start)} – ${fmt(d.end)}`}
              aria-label={`${l.abbr}: ${label(l.title)}, ${fmt(d.start)} – ${fmt(d.end)}`}>
              <span>{l.abbr}</span>
            </button>
          );
        })}
        {now > t0 && now < t1 && <div className="dasha-now" style={{ left: `${pct(now)}%` }}><span>{t('dasha.now')}</span></div>}
      </div>
      <div className="dasha-detail">
        <h4>
          <span style={{ color: a.color }}>{a.glyph}</span>{' '}
          {label(a.title)} <span className="muted">{fmt(active.start)} – {fmt(active.end)}</span>
        </h4>
        <div className="antar-grid">
          {active.sub?.map((s, i) => {
            const isNow = +new Date(s.start) <= now && now < +new Date(s.end);
            const l = look(s, system, v);
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
