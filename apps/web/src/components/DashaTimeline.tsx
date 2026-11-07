import { useMemo, useState } from 'react';
import { DASHA_ORDER, DASHA_YEARS, DASHA_TOTAL_YEARS } from '@vedic/engine';
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

const LEVELS = ['Mahadasha', 'Antardasha', 'Pratyantardasha', 'Sookshma', 'Prana'];

/**
 * Vimshottari sub-periods of a period, built when the chart's tree stops
 * above them: nine parts starting from the period's own lord, each lasting
 * parent × lord years / 120 (BPHS 46). Cached on the period.
 */
function vimSubs(p: DashaPeriod): DashaPeriod[] {
  if (p.sub?.length) return p.sub;
  const a = Date.parse(p.start), b = Date.parse(p.end);
  const i0 = DASHA_ORDER.indexOf(p.lord);
  let t = a;
  p.sub = DASHA_ORDER.map((_, k) => {
    const lord = DASHA_ORDER[(i0 + k) % 9];
    const e = k === 8 ? b : t + ((b - a) * DASHA_YEARS[lord]) / DASHA_TOTAL_YEARS;
    const d: DashaPeriod = { lord, start: new Date(t).toISOString(), end: new Date(e).toISOString() };
    t = e;
    return d;
  });
  return p.sub;
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
  // the sub-periods opened below the mahadasha: antar, pratyantar, sookshma
  const [trail, setTrail] = useState<DashaPeriod[]>([]);
  const deep = system === 'vimshottari';
  const subsOf = (p: DashaPeriod) => (deep ? vimSubs(p) : p.sub ?? []);
  const fine = (iso: string, level: number) =>
    level >= 4 ? date(iso, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : level === 3 ? date(iso, { day: 'numeric', month: 'short', year: 'numeric' }) : fmt(iso);
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
              onClick={() => { setOpen(i); setTrail([]); }} title={`${label(l.title)} · ${fmt(d.start)} – ${fmt(d.end)}`}
              aria-label={`${label(l.title)}, ${fmt(d.start)} – ${fmt(d.end)}`}>
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
        {[active, ...trail].map((parent, depth) => {
          const level = depth + 2;
          const subs = level <= 5 ? subsOf(parent) : [];
          if (!subs.length) return null;
          const chosen = trail[depth];
          const pathAbbr = [active, ...trail.slice(0, depth)].map((p) => look(p, system, v).abbr).join('–');
          return (
            <div key={`${level}-${parent.start}`} className="dasha-level">
              {depth > 0 && <h5 className="dasha-level-head">{LEVELS[level - 1]}s of {pathAbbr} <span className="muted">{fine(parent.start, level)} – {fine(parent.end, level)}</span></h5>}
              <div className="antar-grid">
                {subs.map((s, i) => {
                  const isNow = +new Date(s.start) <= now && now < +new Date(s.end);
                  const l = look(s, system, v);
                  const canOpen = level < 5 && (deep || !!s.sub?.length);
                  const inner = (
                    <>
                      <b>{pathAbbr}–{l.abbr}</b>
                      <small>{fine(s.start, level)} → {fine(s.end, level)}</small>
                    </>
                  );
                  return canOpen ? (
                    <button key={i} type="button" className={`antar${isNow ? ' is-now' : ''}${chosen === s ? ' is-open' : ''}`} style={{ '--c': l.color } as React.CSSProperties}
                      title={`${l.title}: open its ${LEVELS[level].toLowerCase()}s`} aria-expanded={chosen === s}
                      onClick={() => setTrail(chosen === s ? trail.slice(0, depth) : [...trail.slice(0, depth), s])}>
                      {inner}
                    </button>
                  ) : (
                    <div key={i} className={`antar${isNow ? ' is-now' : ''}`} style={{ '--c': l.color } as React.CSSProperties} title={l.title}>{inner}</div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {deep && !trail.length && <p className="muted dasha-hint">Open an antardasha to go down through pratyantar and sookshma to prana, periods of hours.</p>}
      </div>
    </div>
  );
}
