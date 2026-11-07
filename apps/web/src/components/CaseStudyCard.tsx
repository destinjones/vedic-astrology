import type { ChartInterpretation } from '@vedic/interpretations';
import type { CaseStudy } from '../data/caseStudies';
import { CiteMark } from './Citation';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

/** An annotated walk-through of a famous chart: what fired, what the texts say, and how the dashas line up. */
export function CaseStudyCard({ study, report }: { study: CaseStudy; report?: ChartInterpretation }) {
  const sourceOf = (kind: 'yoga' | 'dosha', id: string) =>
    (kind === 'yoga' ? report?.yogas.find((y) => y.id === id) : report?.doshas.find((d) => d.id === id))?.reading.source;
  return (
    <section className="card case-study" id="case-study">
      <div className="card-head">
        <h3>Case study</h3>
        <span className="muted">{study.title}</span>
      </div>
      <p className="lead">{study.lead}</p>
      <h4 className="yd-title">What fires, and what the texts say</h4>
      <div className="case-notes">
        {study.notes.map((n) => (
          <div className="case-note" key={n.title}>
            <b>{n.title}</b><CiteMark source={sourceOf(n.kind, n.id)} />
            <p>{n.note}</p>
          </div>
        ))}
      </div>
      <h4 className="yd-title">Timing against the record</h4>
      <div className="table-scroll">
        <table className="case-events">
          <caption className="sr-only">Public events with the Vimshottari periods running at the time</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Dasha</th><th scope="col">Reading</th></tr></thead>
          <tbody>
            {study.events.map((e) => (
              <tr key={e.date}>
                <td className="nowrap" data-label="Date">{fmtDate(e.date)}</td>
                <td data-label="Event">{e.event}</td>
                <td className="nowrap" data-label="Dasha">{cap(e.md)}–{cap(e.ad)}</td>
                <td data-label="Reading">{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 className="yd-title">Takeaways</h4>
      <ul className="case-takeaways">{study.takeaways.map((t) => <li key={t}>{t}</li>)}</ul>
      <p className="muted small">Dasha dates are Vimshottari as this app computes them (Lahiri ayanamsa). Event dates are public record.</p>
    </section>
  );
}
