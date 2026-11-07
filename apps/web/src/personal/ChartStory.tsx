import { useEffect, useMemo, useRef, useState } from 'react';
import { chartStory, controlBirth } from '@vedic/personal';
import type { ChartInterpretation } from '@vedic/interpretations';
import type { Chart } from '../types/chart';
import type { Selection } from '../types/ui';
import { compareHash } from '../compare/sources';

/** Each chapter fades up as it scrolls into view. */
function Reveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (!ref.current || shown) return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setShown(true); }, { rootMargin: '0px 0px -10% 0px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [shown]);
  return <article ref={ref} className={`story-ch ${shown ? 'is-shown' : ''}`}>{children}</article>;
}

/**
 * A blind test: your chart and a control chart (same place, another moment),
 * shuffled and unlabelled, side by side on the compare page.
 */
function BlindTest({ chart }: { chart: Chart }) {
  const [revealed, setRevealed] = useState(false);
  const control = useMemo(() => controlBirth({ ...chart.input, name: '' }), [chart.input]);
  const youFirst = control.time < chart.input.time; // a stable coin flip
  const a = youFirst ? { ...chart.input, name: 'Chart A' } : { ...control, name: 'Chart A' };
  const b = youFirst ? { ...control, name: 'Chart B' } : { ...chart.input, name: 'Chart B' };
  const href = `${import.meta.env.BASE_URL}compare/${compareHash([a, b])}`;
  return (
    <div className="story-blind">
      <h4>Try the blind test</h4>
      <p className="muted">
        Readings can sound true of anyone. Open your chart beside a control chart, cast for the same place at another moment,
        without names. Read both, decide which one is you, then come back and check.
      </p>
      <div className="story-blind-actions">
        <a className="btn-ghost" href={href} target="_blank" rel="noopener">Open charts A and B ↗</a>
        <button className="btn-ghost" onClick={() => setRevealed((r) => !r)} aria-expanded={revealed}>{revealed ? 'Hide the answer' : 'Which one was me?'}</button>
      </div>
      {revealed && <p className="story-answer">You were <b>Chart {youFirst ? 'A' : 'B'}</b>. The control was born {control.date} at {control.time}.</p>}
    </div>
  );
}

export default function ChartStory({ chart, report, onSelect }: { chart: Chart; report: ChartInterpretation; onSelect: (s: Selection) => void }) {
  const chapters = useMemo(() => chartStory(chart.engineContext!.chart, report), [chart, report]);
  const [open, setOpen] = useState(false);
  const show = (focus: string) => {
    onSelect(focus === 'asc' ? { kind: 'asc' } : { kind: 'planet', id: focus as never });
    document.getElementById('chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const visible = open ? chapters : chapters.slice(0, 2);
  return (
    <div className="story">
      {visible.map((c) => (
        <Reveal key={c.id}>
          <small className="story-kicker">{c.kicker}</small>
          <h4>{c.title}</h4>
          {c.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {c.points && <p className="story-points">Its gifts: {c.points.join(', ')}.</p>}
          {c.focus && <button className="link-btn" onClick={() => show(c.focus!)}>Show it in the chart</button>}
        </Reveal>
      ))}
      {!open
        ? <button className="btn-ghost story-more" onClick={() => setOpen(true)}>Keep reading ({chapters.length - 2} more chapters)</button>
        : <BlindTest chart={chart} />}
    </div>
  );
}
