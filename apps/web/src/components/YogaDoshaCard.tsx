import type { ChartInterpretation } from '@vedic/interpretations';
import { ReadingBlock } from './ReadingBlock';
import { useI18n } from '../i18n';

/** Every yoga and dosha the detectors found in this chart, with the reason it qualifies. */
export function YogaDoshaCard({ report }: { report: ChartInterpretation }) {
  const { t, tp, v } = useI18n();
  const doshas = report.doshas.filter((d) => d.present);
  return (
    <section className="card" id="yogas">
      <div className="card-head">
        <h3>{t('yd.title')}</h3>
        <span className="muted">{t('yd.count', { yogas: tp('yd.yogaCount', report.yogas.length), doshas: tp('yd.doshaCount', doshas.length) })}</span>
      </div>
      <h4 className="yd-title">{t('yd.yogas')}</h4>
      {report.yogas.length === 0 && <p className="muted">{t('yd.noYogas')}</p>}
      <div className="yd-grid">
        {report.yogas.map((y) => (
          <div key={y.id + y.reason}>
            <ReadingBlock reading={{ ...y.reading, title: `${y.name} (${v.strength[y.strength]})` }} />
            <p className="yd-reason">{y.reason}</p>
          </div>
        ))}
      </div>
      <h4 className="yd-title">{t('yd.doshas')}</h4>
      {doshas.length === 0 && <p className="muted">{t('yd.noDoshas')}</p>}
      <div className="yd-grid">
        {doshas.map((d) => (
          <div key={d.id}>
            <ReadingBlock reading={{ ...d.reading, title: `${d.name} (${v.severity[d.severity]})` }} />
            <p className="yd-reason">{d.reason}</p>
            {d.cancellations.length > 0 && <p className="yd-reason">{t('yd.softened', { list: d.cancellations.join('; ') })}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
