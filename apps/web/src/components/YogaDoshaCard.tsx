import type { ChartInterpretation } from '@vedic/interpretations';
import { ReadingBlock } from './ReadingBlock';

/** Every yoga and dosha the detectors found in this chart, with the reason it qualifies. */
export function YogaDoshaCard({ report }: { report: ChartInterpretation }) {
  const doshas = report.doshas.filter((d) => d.present);
  return (
    <section className="card" id="yogas">
      <div className="card-head">
        <h3>Yogas and doshas in this chart</h3>
        <span className="muted">{report.yogas.length} yogas · {doshas.length} doshas found</span>
      </div>
      <h4 className="yd-title">Yogas</h4>
      {report.yogas.length === 0 && <p className="muted">None of the 44 yogas checked form in this chart.</p>}
      <div className="yd-grid">
        {report.yogas.map((y) => (
          <div key={y.id + y.reason}>
            <ReadingBlock reading={{ ...y.reading, title: `${y.name} (${y.strength})` }} />
            <p className="yd-reason">{y.reason}</p>
          </div>
        ))}
      </div>
      <h4 className="yd-title">Doshas</h4>
      {doshas.length === 0 && <p className="muted">None of the 9 doshas checked form in this chart.</p>}
      <div className="yd-grid">
        {doshas.map((d) => (
          <div key={d.id}>
            <ReadingBlock reading={{ ...d.reading, title: `${d.name} (${d.severity})` }} />
            <p className="yd-reason">{d.reason}</p>
            {d.cancellations.length > 0 && <p className="yd-reason">Softened by: {d.cancellations.join('; ')}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
