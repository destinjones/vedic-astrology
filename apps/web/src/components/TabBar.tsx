import { useState } from 'react';
import { MAX_TABS, type Tab } from '../lib/tabs';

interface Props {
  tabs: Tab[];
  activeId: string;
  busy: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
  onRename: (id: string, label: string) => void;
}

/** One tab per person. Double-click (or long-press) a name to rename it. */
export function TabBar({ tabs, activeId, busy, onSelect, onNew, onClose, onRename }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const startRename = (t: Tab) => { setRenaming(t.id); setDraft(t.label); };
  const finish = () => {
    if (renaming && draft.trim()) onRename(renaming, draft.trim().slice(0, 60));
    setRenaming(null);
  };

  return (
    <nav className="tab-bar" aria-label="Open charts">
      <div className="tab-strip">
        {tabs.map((t) => {
          const active = t.id === activeId;
          return (
            <div key={t.id} className={`tab ${active ? 'is-active' : ''}`} role="presentation">
              {renaming === t.id ? (
                <input
                  className="tab-rename"
                  autoFocus
                  value={draft}
                  maxLength={60}
                  aria-label="Tab name"
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={finish}
                  onKeyDown={(e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') setRenaming(null); }}
                />
              ) : (
                <button
                  aria-current={active ? 'true' : undefined}
                  className="tab-name"
                  disabled={busy && !active}
                  onClick={() => (active ? undefined : onSelect(t.id))}
                  onDoubleClick={() => startRename(t)}
                  title={active ? 'Double-click to rename' : t.input ? `${t.input.date} · ${t.input.place}` : 'Empty tab'}
                >
                  {t.label}
                  {t.notes.trim() && <span className="tab-dot" aria-label="has notes" />}
                </button>
              )}
              {active && renaming !== t.id && (
                <button className="tab-x" onClick={() => startRename(t)} aria-label={`Rename ${t.label}`} title="Rename">✎</button>
              )}
              <button className="tab-x" onClick={() => onClose(t.id)} aria-label={`Close ${t.label}`} title="Close tab">✕</button>
            </div>
          );
        })}
      </div>
      <button className="tab-new" onClick={onNew} disabled={tabs.length >= MAX_TABS} title="New chart in a new tab">＋ New</button>
    </nav>
  );
}
