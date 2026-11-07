import { useState } from 'react';
import { newTabId, type EntryKind, type LogEntry, type Outcome, type Tab } from '../lib/tabs';

interface Props {
  tab: Tab;
  onNotes: (notes: string) => void;
  onLog: (log: LogEntry[]) => void;
}

const KIND_LABEL: Record<EntryKind, string> = { question: 'Question', prediction: 'Prediction', note: 'Note' };
const OUTCOME_LABEL: Record<Outcome, string> = { open: 'Not yet known', 'came-true': 'Came true', partly: 'Partly', 'did-not': 'Did not happen' };
const PLACEHOLDER: Record<EntryKind, string> = {
  question: 'What did they ask? e.g. Will I change jobs this year?',
  prediction: 'What did you predict? e.g. A move abroad during Jupiter antardasha',
  note: 'Anything to remember from this session',
};

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDay = (d: string) => fmt(`${d}T12:00:00`);

type Filter = 'all' | EntryKind;

/** Free notes plus a dated log of questions asked and predictions made, for looking back later. */
export function ClientHistory({ tab, onNotes, onLog }: Props) {
  const [kind, setKind] = useState<EntryKind>('question');
  const [text, setText] = useState('');
  const [about, setAbout] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const entry: LogEntry = {
      id: newTabId(),
      kind,
      text: text.trim().slice(0, 5000),
      at: new Date().toISOString(),
      ...(kind === 'prediction' ? { outcome: 'open' as const, ...(about ? { about } : {}) } : {}),
    };
    onLog([entry, ...tab.log]);
    setText('');
    setAbout('');
  };
  const update = (id: string, patch: Partial<LogEntry>) => onLog(tab.log.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id: string) => onLog(tab.log.filter((x) => x.id !== id));

  const preds = tab.log.filter((x) => x.kind === 'prediction');
  const judged = preds.filter((x) => x.outcome && x.outcome !== 'open');
  const hits = judged.filter((x) => x.outcome === 'came-true').length + judged.filter((x) => x.outcome === 'partly').length * 0.5;
  const shown = filter === 'all' ? tab.log : tab.log.filter((x) => x.kind === filter);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <section className="card notes-card" id="client-history">
      <div className="card-head">
        <h3>Client notes and history</h3>
        <span className="muted">kept in this browser, never in share links, hidden while presenting</span>
      </div>

      <div className="history-grid">
        <div>
          <label className="field">
            <span>Notes</span>
            <textarea
              className="notes-input"
              value={tab.notes}
              onChange={(e) => onNotes(e.target.value.slice(0, 20000))}
              placeholder={`About ${tab.label}: background, concerns, remedies suggested, when to follow up…`}
              rows={8}
            />
          </label>
        </div>

        <div>
          <form className="log-form" onSubmit={add}>
            <div className="seg" role="radiogroup" aria-label="Entry type">
              {(Object.keys(KIND_LABEL) as EntryKind[]).map((k) => (
                <button type="button" key={k} role="radio" aria-checked={kind === k} className={kind === k ? 'is-active' : ''} onClick={() => setKind(k)}>{KIND_LABEL[k]}</button>
              ))}
            </div>
            <textarea className="notes-input log-text" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={PLACEHOLDER[kind]} aria-label={`${KIND_LABEL[kind]} text`} />
            <div className="log-form-row">
              {kind === 'prediction' && (
                <label className="log-about">
                  <span className="muted">About when</span>
                  <input type="date" value={about} onChange={(e) => setAbout(e.target.value)} />
                </label>
              )}
              <button className="btn-primary" disabled={!text.trim()}>Add {KIND_LABEL[kind].toLowerCase()}</button>
            </div>
          </form>

          {preds.length > 0 && (
            <p className="log-score">
              <b>{preds.length}</b> prediction{preds.length === 1 ? '' : 's'}
              {judged.length > 0 ? <> · <b>{Math.round((hits / judged.length) * 100)}%</b> right of the {judged.length} checked</> : ' · none checked yet'}
            </p>
          )}

          {tab.log.length > 0 && (
            <div className="log-filter">
              {(['all', 'question', 'prediction', 'note'] as Filter[]).map((f) => (
                <button key={f} type="button" className={`chip ${filter === f ? 'is-active' : ''}`} onClick={() => setFilter(f)}>
                  {f === 'all' ? `All (${tab.log.length})` : `${KIND_LABEL[f]}s (${tab.log.filter((x) => x.kind === f).length})`}
                </button>
              ))}
            </div>
          )}

          <ol className="log-list">
            {shown.map((x) => {
              const due = x.kind === 'prediction' && x.outcome === 'open' && x.about && x.about <= today;
              return (
                <li key={x.id} className={`log-item kind-${x.kind} ${x.outcome ? `out-${x.outcome}` : ''}`}>
                  <div className="log-meta">
                    <span className="log-kind">{KIND_LABEL[x.kind]}</span>
                    <span className="muted">{fmt(x.at)}</span>
                    {x.about && <span className="muted">· about {fmtDay(x.about)}</span>}
                    {due && <span className="log-due">time to check</span>}
                    <button type="button" className="tab-x" onClick={() => remove(x.id)} aria-label="Delete entry" title="Delete">✕</button>
                  </div>
                  <p>{x.text}</p>
                  {x.kind === 'prediction' && (
                    <div className="log-outcome" role="radiogroup" aria-label="Did it come true?">
                      {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                        <button key={o} type="button" role="radio" aria-checked={x.outcome === o} className={`chip ${x.outcome === o ? 'is-active' : ''} o-${o}`} onClick={() => update(x.id, { outcome: o })}>
                          {OUTCOME_LABEL[o]}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {tab.log.length === 0 && <p className="muted log-empty">Log the questions {tab.label} asks and the predictions you make. Later, mark each prediction as it plays out to see how the readings held up.</p>}
        </div>
      </div>
    </section>
  );
}
