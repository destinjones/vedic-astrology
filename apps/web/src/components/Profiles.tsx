import { useEffect, useRef, useState } from 'react';
import type { BirthInput } from '../types/chart';
import { sameBirth, shareUrl, type Profile } from '../lib/profiles';
import type { Tab } from '../lib/tabs';
import { DataTools } from './DataTools';

const fmtDate = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/* ---------- list of saved charts, shown above the birth form ---------- */

interface ListProps {
  profiles: Profile[];
  current?: BirthInput | null;
  busy: boolean;
  onOpen: (p: Profile) => void;
  onEdit: (p: Profile) => void;
  onDelete: (p: Profile) => void;
  /** Closed tabs, which keep their notes and history */
  closed: Tab[];
  onReopen: (t: Tab) => void;
  onForget: (t: Tab) => void;
  onBackup: () => void;
  /** Restores a backup file's text and returns what happened, in words. */
  onRestore: (text: string) => string;
  /** Full backup text, for encrypted sync */
  backupText: () => string;
  /** Merges another device's synced data, joining tabs both sides have */
  onSyncMerge: (text: string) => string;
  onImport: (items: { label: string; input: BirthInput }[]) => number;
  onBatch: () => void;
}

export function SavedCharts({ profiles, current, busy, onOpen, onEdit, onDelete, closed, onReopen, onForget, onBackup, onRestore, backupText, onSyncMerge, onImport, onBatch }: ListProps) {
  const [note, setNote] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => setNote(onRestore(await file.text()));

  return (
    <div className="saved-charts" id="saved-charts">
      <div className="saved-head">
        <h3>Saved charts</h3>
        <div className="saved-tools">
          {profiles.length > 1 && <button type="button" className="btn-ghost sm" onClick={onBatch} title="All saved charts in one table">Batch view</button>}
          <button type="button" className="btn-ghost sm" onClick={onBackup} title="Download one file with every tab, note, history entry and saved chart">Back up everything</button>
          <button type="button" className="btn-ghost sm" onClick={() => fileRef.current?.click()}>Restore</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </div>
      </div>
      {profiles.length === 0 ? (
        <p className="muted saved-empty">Charts you save for yourself, family and friends appear here. They are kept in this browser only.</p>
      ) : (
        <ul className="saved-list">
          {profiles.map((p) => {
            const isCurrent = !!current && sameBirth(current, p.input);
            return (
              <li key={p.id} className={isCurrent ? 'is-current' : ''}>
                <button type="button" className="saved-open" disabled={busy} onClick={() => onOpen(p)} title={`Open ${p.label}'s chart`}>
                  <b>{p.label}</b>
                  <small className="muted">{fmtDate(p.input.date)} · {p.input.time.slice(0, 5)} · {p.input.place}</small>
                </button>
                {confirmId === p.id ? (
                  <span className="saved-confirm">
                    <button type="button" className="btn-ghost sm danger" onClick={() => { onDelete(p); setConfirmId(null); }}>Delete</button>
                    <button type="button" className="btn-ghost sm" onClick={() => setConfirmId(null)}>Keep</button>
                  </span>
                ) : (
                  <span className="saved-row-tools">
                    <button type="button" className="btn-ghost sm" onClick={() => onEdit(p)} aria-label={`Edit ${p.label}'s details`}>Edit</button>
                    <button type="button" className="btn-ghost sm" onClick={() => setConfirmId(p.id)} aria-label={`Delete ${p.label}`}>✕</button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {closed.length > 0 && (
        <details className="closed-tabs">
          <summary>Closed tabs ({closed.length}) <small className="muted">kept with their notes and history</small></summary>
          <ul className="saved-list">
            {closed.map((t) => (
              <li key={t.id}>
                <button type="button" className="saved-open" disabled={busy} onClick={() => onReopen(t)} title={`Reopen ${t.label}`}>
                  <b>{t.label}</b>
                  <small className="muted">
                    {t.input ? `${fmtDate(t.input.date)} · ${t.input.place}` : 'No chart'}
                    {t.log.length ? ` · ${t.log.length} history entr${t.log.length === 1 ? 'y' : 'ies'}` : ''}
                    {t.notes.trim() ? ' · notes' : ''}
                  </small>
                </button>
                {confirmId === t.id ? (
                  <span className="saved-confirm">
                    <button type="button" className="btn-ghost sm danger" onClick={() => { onForget(t); setConfirmId(null); }}>Delete</button>
                    <button type="button" className="btn-ghost sm" onClick={() => setConfirmId(null)}>Keep</button>
                  </span>
                ) : (
                  <span className="saved-row-tools">
                    <button type="button" className="btn-ghost sm" onClick={() => setConfirmId(t.id)} aria-label={`Delete ${t.label} for good`}>✕</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {note && <p className="muted saved-note" role="status">{note}</p>}
      <DataTools profiles={profiles} onImport={onImport} backupText={backupText} onMerge={onSyncMerge} />
    </div>
  );
}

/* ---------- save and share buttons for the open chart ---------- */

interface ActionProps {
  input: BirthInput;
  profiles: Profile[];
  onSave: (label: string) => boolean;
  onShowSaved: () => void;
}

type Pop = null | 'save' | 'share';

export function ChartActions({ input, profiles, onSave, onShowSaved }: ActionProps) {
  const [pop, setPop] = useState<Pop>(null);
  const saved = profiles.find((p) => sameBirth(p.input, input));
  const [label, setLabel] = useState('');
  const [withName, setWithName] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pop) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setPop(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pop]);

  const open = (which: Pop) => {
    setStatus(null);
    if (which === 'save') setLabel(saved?.label ?? input.name ?? '');
    setPop((p) => (p === which ? null : which));
  };

  const link = shareUrl(input, withName);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('Link copied.');
    } catch {
      linkRef.current?.select();
      setStatus('Press Ctrl+C (or ⌘C) to copy.');
    }
  };
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <div className="chart-actions" ref={boxRef}>
      <button className="btn-ghost" onClick={onShowSaved}>
        Saved charts{profiles.length ? ` (${profiles.length})` : ''}
      </button>
      <button className={`btn-ghost ${saved ? 'is-saved' : ''}`} onClick={() => open('save')} aria-expanded={pop === 'save'}>
        {saved ? '★ Saved' : '☆ Save'}
      </button>
      <button className="btn-ghost" onClick={() => open('share')} aria-expanded={pop === 'share'}>Share link</button>

      {pop === 'save' && (
        <form
          className="pop"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return setStatus('Give this chart a name.');
            setStatus(onSave(label) ? 'Saved in this browser.' : 'This browser would not save it (private mode or storage full).');
          }}
        >
          <label className="field">
            <span>{saved ? 'Saved as' : 'Save this chart as'}</span>
            <input autoFocus value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mum, Ravi, Me" maxLength={80} />
          </label>
          <button className="btn-primary">{saved ? 'Update' : 'Save chart'}</button>
          <p className="muted pop-note">{status ?? 'Kept in this browser only. Nothing is uploaded.'}</p>
        </form>
      )}

      {pop === 'share' && (
        <div className="pop">
          <label className="field">
            <span>Link to this chart</span>
            <input ref={linkRef} readOnly value={link} onFocus={(e) => e.target.select()} />
          </label>
          {input.name?.trim() && (
            <label className="check">
              <input type="checkbox" checked={withName} onChange={(e) => setWithName(e.target.checked)} /> Include the name “{input.name.trim()}”
            </label>
          )}
          <div className="pop-row">
            <button type="button" className="btn-primary" onClick={copy}>Copy link</button>
            {canNativeShare && (
              <button type="button" className="btn-ghost" onClick={() => navigator.share({ title: 'Vedic birth chart', url: link }).catch(() => {})}>Share…</button>
            )}
          </div>
          <p className="muted pop-note">{status ?? 'Anyone with the link sees this birth date, time and place. The details sit after the # so they never reach the server.'}</p>
        </div>
      )}
    </div>
  );
}
