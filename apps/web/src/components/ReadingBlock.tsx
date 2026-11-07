import type { Reading } from '../lib/readings';

/** One expandable reading from the interpretation library. */
export function ReadingBlock({ reading, open }: { reading: Reading; open?: boolean }) {
  return (
    <details className={`reading-block tone-${reading.tone}`} open={open}>
      <summary><span className="tone-dot" aria-hidden />{reading.title}</summary>
      <div className="reading-body">
        <p className="lead">{reading.summary}</p>
        {reading.detail.map((t) => <p key={t}>{t}</p>)}
        {reading.strengths.length > 0 && <><h4 className="good">Strengths</h4><ul>{reading.strengths.map((s) => <li key={s}>{s}</li>)}</ul></>}
        {reading.challenges.length > 0 && <><h4 className="bad">Challenges</h4><ul>{reading.challenges.map((s) => <li key={s}>{s}</li>)}</ul></>}
        {reading.remedies && reading.remedies.length > 0 && <p className="remedies"><b>Traditional remedies:</b> {reading.remedies.join(' ')}</p>}
      </div>
    </details>
  );
}
