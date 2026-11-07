import { useMemo, useState } from 'react';
import type { ChartInterpretation } from '@vedic/interpretations';
import { findingsOf, LEVEL_HINT, LEVEL_LABEL, viewFindings, type Finding } from '@vedic/personal/severity';
import { rarityOf } from '@vedic/personal/rarity';
import { ReadingBlock } from './ReadingBlock';
import { useI18n } from '../i18n';
import './yogaLevels.css';
import { Glossed } from './Gloss';

const BEGINNER_KEY = 'vedic.beginner';
const loadBeginner = () => { try { return localStorage.getItem(BEGINNER_KEY) === '1'; } catch { return false; } };

function Level({ f }: { f: Finding }) {
  const r = rarityOf(f.kind, f.id);
  return (
    <p className="yd-meta">
      <span className={`yd-level l${f.level}`} title={LEVEL_HINT[f.level]}>{LEVEL_LABEL[f.level]}</span>
      {r && <span className="yd-rarity" title={`Counted in ${r.of.toLocaleString()} random charts`}>{r.band}, {r.label}</span>}
    </p>
  );
}

/**
 * Every yoga and dosha the detectors found in this chart, with the reason it
 * qualifies, a severity level, and how common it is. Beginner view hides the
 * doshas and shows only the few findings that matter most.
 */
export function YogaDoshaCard({ report }: { report: ChartInterpretation }) {
  const { t, tp, v } = useI18n();
  const [beginner, setBeginner] = useState(loadBeginner);
  const findings = useMemo(() => findingsOf(report), [report]);
  const view = viewFindings(findings, { beginner });
  const presentDoshas = findings.filter((f) => f.kind === 'dosha').length;
  const toggle = (on: boolean) => {
    setBeginner(on);
    try { localStorage.setItem(BEGINNER_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  };
  return (
    <section className="card" id="yogas">
      <div className="card-head">
        <h3>{t('yd.title')}</h3>
        <span className="muted">{t('yd.count', { yogas: tp('yd.yogaCount', report.yogas.length), doshas: tp('yd.doshaCount', presentDoshas) })}</span>
      </div>
      <div className="yd-controls">
        <label className="yd-beginner">
          <input type="checkbox" checked={beginner} onChange={(e) => toggle(e.target.checked)} />
          Beginner view: the five that matter most, no doshas
        </label>
        <span className="muted yd-legend">Headline first, then notable, then background.</span>
      </div>
      <h4 className="yd-title">{t('yd.yogas')}</h4>
      {report.yogas.length === 0 && <p className="muted">{t('yd.noYogas')}</p>}
      <div className="yd-grid">
        {view.yogas.map((f) => {
          const y = report.yogas.find((x) => `yoga:${x.id}:${x.reason}` === f.key)!;
          return (
            <div key={f.key}>
              <Level f={f} />
              <ReadingBlock reading={{ ...y.reading, title: `${y.name} (${v.strength[y.strength]})` }} />
              <p className="yd-reason"><Glossed text={y.reason} /></p>
            </div>
          );
        })}
      </div>
      {view.hidden.yogas > 0 && <p className="muted yd-hidden">{view.hidden.yogas} more yoga{view.hidden.yogas === 1 ? '' : 's'} hidden in beginner view. <button className="link-btn" onClick={() => toggle(false)}>Show everything</button></p>}
      {!beginner && (
        <>
          <h4 className="yd-title">{t('yd.doshas')}</h4>
          {view.doshas.length === 0 && <p className="muted">{t('yd.noDoshas')}</p>}
          <div className="yd-grid">
            {view.doshas.map((f) => {
              const d = report.doshas.find((x) => x.id === f.id)!;
              return (
                <div key={f.key}>
                  <Level f={f} />
                  <ReadingBlock reading={{ ...d.reading, title: `${d.name} (${v.severity[d.severity]})` }} />
                  <p className="yd-reason"><Glossed text={d.reason} /></p>
                  {d.cancellations.length > 0 && <p className="yd-reason">{t('yd.softened', { list: d.cancellations.join('; ') })}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {beginner && view.hidden.doshas > 0 && <p className="muted yd-hidden">Doshas are hidden in beginner view. They read worse than they are; turn beginner view off when you want the full picture.</p>}
    </section>
  );
}
