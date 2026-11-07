import { useEffect, useState } from 'react';
import type { Chart, PlanetId, VargaChart } from '../types/chart';
import type { ChartStyle, Selection } from '../types/ui';
import { annotationHouse, MAX_ANNOTATIONS, newAnnotationId, type Annotation, type AnnotationTarget } from '../lib/annotations';
import { houseAnchor, pinOffset } from '../export/chartSvg';
import { useI18n } from '../i18n';

const PLANETS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

const targetKey = (t: AnnotationTarget) => (t.kind === 'house' ? `h${t.num}` : `p:${t.id}`);
const parseKey = (k: string): AnnotationTarget => (k.startsWith('h') ? { kind: 'house', num: Number(k.slice(1)) } : { kind: 'planet', id: k.slice(2) as PlanetId });

/** Numbered pins drawn over the live chart, in the same viewBox as NorthChart and SouthChart. */
export function AnnotationPins({ chart, varga, style, notes, onPick }: {
  chart: Chart; varga: VargaChart; style: ChartStyle; notes: Annotation[]; onPick: (a: Annotation) => void;
}) {
  if (!notes.length) return null;
  const byHouse = new Map<number, { a: Annotation; n: number }[]>();
  notes.forEach((a, i) => {
    const h = annotationHouse(a, chart, varga);
    if (h) byHouse.set(h, [...(byHouse.get(h) ?? []), { a, n: i + 1 }]);
  });
  return (
    <svg viewBox="-6 -6 412 412" className="chart-svg annot-pins" aria-hidden>
      {[...byHouse].flatMap(([h, list]) => {
        const { pin, step } = houseAnchor(style, h, varga.ascSign);
        const off = pinOffset(style, list.length);
        return list.map(({ a, n }, k) => {
          const x = pin[0] + step[0] * off(k);
          const y = pin[1] + step[1] * off(k);
          return (
            <g key={a.id} className="annot-pin" onClick={() => onPick(a)}>
              <title>{a.title ? `${a.title}: ${a.text}` : a.text}</title>
              <circle cx={x} cy={y} r={8} />
              <text x={x} y={y + 3.6} textAnchor="middle">{n}</text>
            </g>
          );
        });
      })}
    </svg>
  );
}

/** The list of notes under the chart, and the form to add or change one. */
export function AnnotationPanel({ notes, selection, onChange, onClose, focusId }: {
  notes: Annotation[];
  selection: Selection | null;
  onChange: (notes: Annotation[]) => void;
  onClose: () => void;
  /** a note picked on the chart, opened for editing */
  focusId?: string | null;
}) {
  const { v, t } = useI18n();
  const fromSelection = (): AnnotationTarget =>
    selection?.kind === 'house' ? { kind: 'house', num: selection.num } : selection?.kind === 'planet' ? { kind: 'planet', id: selection.id } : { kind: 'house', num: 1 };
  const [editing, setEditing] = useState<string | null>(null);
  const [target, setTarget] = useState<AnnotationTarget>(fromSelection);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  // clicking a house or planet on the chart points the next note at it
  useEffect(() => { if (!editing) setTarget(fromSelection()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [selection]);
  useEffect(() => {
    const a = notes.find((x) => x.id === focusId);
    if (a) edit(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const describe = (tg: AnnotationTarget) => (tg.kind === 'house' ? `House ${tg.num}` : v.planets[tg.id].name);
  const edit = (a: Annotation) => { setEditing(a.id); setTarget(a.target); setTitle(a.title ?? ''); setText(a.text); };
  const reset = () => { setEditing(null); setTitle(''); setText(''); setTarget(fromSelection()); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const at = new Date().toISOString();
    const next: Annotation = { id: editing ?? newAnnotationId(), target, title: title.trim() || undefined, text: text.trim(), at };
    onChange(editing ? notes.map((a) => (a.id === editing ? next : a)) : [...notes, next].slice(0, MAX_ANNOTATIONS));
    reset();
  };

  return (
    <div className="annot-panel">
      <div className="annot-head">
        <b>Chart notes</b>
        <span className="muted">Pick a house or planet on the chart, then write. Notes stay in this browser and go into exports when you choose.</span>
        <button type="button" className="btn-ghost sm" onClick={onClose}>Done</button>
      </div>
      {notes.length > 0 && (
        <ol className="annot-list">
          {notes.map((a, i) => (
            <li key={a.id} className={editing === a.id ? 'is-editing' : ''}>
              <span className="annot-num">{i + 1}</span>
              <span className="annot-body">
                <small className="muted">{describe(a.target)}</small>
                <span>{a.title && <b>{a.title}: </b>}{a.text}</span>
              </span>
              <span className="annot-tools">
                <button type="button" className="btn-ghost sm" onClick={() => edit(a)} aria-label={`Edit note ${i + 1}`}>Edit</button>
                <button type="button" className="btn-ghost sm" onClick={() => { onChange(notes.filter((x) => x.id !== a.id)); if (editing === a.id) reset(); }} aria-label={`Delete note ${i + 1}`}>✕</button>
              </span>
            </li>
          ))}
        </ol>
      )}
      <form className="annot-form" onSubmit={submit}>
        <label>
          <span>Pinned to</span>
          <select value={targetKey(target)} onChange={(e) => setTarget(parseKey(e.target.value))}>
            <optgroup label="Houses">
              {Array.from({ length: 12 }, (_, i) => <option key={i} value={`h${i + 1}`}>House {i + 1}{i === 0 ? ` (${t('chart.asc')})` : ''}</option>)}
            </optgroup>
            <optgroup label="Planets">
              {PLANETS.map((id) => <option key={id} value={`p:${id}`}>{v.planets[id].name}</option>)}
            </optgroup>
          </select>
        </label>
        <label>
          <span>Heading (optional)</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Career" />
        </label>
        <label className="annot-text">
          <span>Note</span>
          <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="What you see here" />
        </label>
        <div className="annot-actions">
          {editing && <button type="button" className="btn-ghost sm" onClick={reset}>Cancel</button>}
          <button className="btn-primary" disabled={!text.trim() || (!editing && notes.length >= MAX_ANNOTATIONS)}>{editing ? 'Save note' : 'Add note'}</button>
        </div>
      </form>
    </div>
  );
}
