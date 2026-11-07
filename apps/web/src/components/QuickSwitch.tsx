import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { isTyping, matchStep, scoreCommand, shortcutLabel, type Command } from '../lib/commands';

interface Props {
  commands: Command[];
}

const SEQUENCE_MS = 1200;

function Keys({ shortcut }: { shortcut: string }) {
  return (
    <span className="keys">
      {shortcutLabel(shortcut).map((k, i) => (k === 'then' ? <span key={i} className="keys-then">then</span> : <kbd key={i}>{k}</kbd>))}
    </span>
  );
}

/**
 * Keyboard layer for a reading: the Ctrl/Cmd+K quick switcher, every command's
 * single-key shortcut, and the "?" overlay that lists them.
 */
export function QuickSwitch({ commands }: Props) {
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  // first key of a two-key shortcut ("g" of "g p"), and when it was pressed
  const pending = useRef<{ key: string; at: number } | null>(null);
  // the handler reads the newest list without re-binding on every render
  const live = useRef({ commands, palette, help });
  useLayoutEffect(() => { live.current = { commands, palette, help }; });

  const openPalette = () => {
    restoreFocus.current = document.activeElement as HTMLElement | null;
    setHelp(false);
    setQuery('');
    setCursor(0);
    setPalette(true);
  };
  const close = () => {
    setPalette(false);
    setHelp(false);
    requestAnimationFrame(() => restoreFocus.current?.focus?.({ preventScroll: true }));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { commands, palette, help } = live.current;
      if (e.defaultPrevented || e.isComposing) return;

      if (matchStep('Mod+k', e)) {
        e.preventDefault();
        if (palette) close(); else openPalette();
        return;
      }
      if (palette) return; // the palette's own input handles keys while it is open
      if (help && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      if (isTyping(e) || e.repeat) return;
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        restoreFocus.current = document.activeElement as HTMLElement | null;
        setHelp((h) => !h);
        return;
      }
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

      const now = Date.now();
      const first = pending.current && now - pending.current.at < SEQUENCE_MS ? pending.current.key : null;
      pending.current = null;
      if (first) {
        const seq = commands.find((c) => c.shortcut?.startsWith(`${first} `) && matchStep(c.shortcut.slice(first.length + 1), e));
        if (seq) { e.preventDefault(); setHelp(false); seq.run(); }
        return;
      }
      const single = commands.find((c) => c.shortcut && !c.shortcut.includes(' ') && matchStep(c.shortcut, e));
      if (single) { e.preventDefault(); setHelp(false); single.run(); return; }
      const starts = commands.some((c) => c.shortcut?.includes(' ') && matchStep(c.shortcut.split(' ')[0], e));
      if (starts) { e.preventDefault(); pending.current = { key: e.key.toLowerCase(), at: now }; }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    if (!palette) return [];
    return commands
      .map((c, i) => ({ c, i, s: scoreCommand(c, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((r) => r.c);
  }, [commands, query, palette]);

  useEffect(() => { if (palette) inputRef.current?.focus(); }, [palette]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const runAt = (i: number) => {
    const c = results[i];
    if (!c) return;
    setPalette(false);
    // focus goes back to the page before the command moves it (scrolls, opens the form).
    // Run it now rather than on the next frame: a busy page (the 3D sky) can hold frames back.
    restoreFocus.current?.focus?.({ preventScroll: true });
    c.run();
  };

  const onPaletteKey = (e: React.KeyboardEvent) => {
    const n = results.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => (n ? (c + 1) % n : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => (n ? (c - 1 + n) % n : 0)); }
    else if (e.key === 'PageDown') { e.preventDefault(); setCursor((c) => Math.min(n - 1, c + 8)); }
    else if (e.key === 'PageUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 8)); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(drawOrder[cursor]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  };

  // Group results under headings, keeping the score order within each group.
  const grouped = useMemo(() => {
    const out: { group: string; items: { c: Command; index: number }[] }[] = [];
    results.forEach((c, index) => {
      let g = out.find((x) => x.group === c.group);
      if (!g) out.push((g = { group: c.group, items: [] }));
      g.items.push({ c, index });
    });
    return out;
  }, [results]);
  // the cursor walks the list in the order it is drawn
  const drawOrder = grouped.flatMap((g) => g.items.map((x) => x.index));
  const highlighted = drawOrder[cursor];

  const helpGroups = useMemo(() => {
    const out: { group: string; items: Command[] }[] = [];
    for (const c of commands) {
      if (!c.shortcut) continue;
      let g = out.find((x) => x.group === c.group);
      if (!g) out.push((g = { group: c.group, items: [] }));
      // one row for a run of numbered shortcuts would be tidier, but listing each is clearer
      g.items.push(c);
    }
    return out;
  }, [commands]);

  return (
    <>
      <button type="button" className="btn-ghost quick-open" onClick={openPalette} aria-label="Quick switch (Ctrl or Cmd K)" title="Jump to any chart, view or person">
        <span>Quick switch</span> <Keys shortcut="Mod+K" />
      </button>

      {palette && (
        <div className="qs-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="qs-panel" role="dialog" aria-modal="true" aria-label="Quick switch">
            <input
              ref={inputRef}
              className="qs-input"
              placeholder="Jump to a chart, view, planet or house…"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
              onKeyDown={onPaletteKey}
              role="combobox"
              aria-expanded="true"
              aria-controls="qs-list"
              aria-activedescendant={highlighted !== undefined ? `qs-item-${highlighted}` : undefined}
              autoComplete="off"
              spellCheck={false}
            />
            <ul className="qs-list" id="qs-list" role="listbox" ref={listRef}>
              {grouped.map((g) => (
                <li key={g.group} role="presentation">
                  <div className="qs-group">{g.group}</div>
                  <ul role="presentation">
                    {g.items.map(({ c, index }) => {
                      const pos = drawOrder.indexOf(index);
                      return (
                        <li
                          key={c.id}
                          id={`qs-item-${index}`}
                          data-index={pos}
                          role="option"
                          aria-selected={pos === cursor}
                          className={`qs-item ${pos === cursor ? 'is-cursor' : ''}`}
                          onMouseMove={() => { if (pos !== cursor) setCursor(pos); }}
                          onClick={() => runAt(index)}
                        >
                          <span className="qs-title">{c.title}{c.active && <span className="qs-current">current</span>}</span>
                          {c.hint && <span className="qs-hint">{c.hint}</span>}
                          {c.shortcut && <Keys shortcut={c.shortcut} />}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
              {!results.length && <li className="qs-empty">Nothing matches “{query}”.</li>}
            </ul>
            <div className="qs-foot muted">
              <span><kbd>↑</kbd><kbd>↓</kbd> move</span>
              <span><kbd>Enter</kbd> open</span>
              <span><kbd>Esc</kbd> close</span>
              <span><kbd>?</kbd> all shortcuts</span>
            </div>
          </div>
        </div>
      )}

      {help && (
        <div className="qs-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="qs-panel help-panel" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
            <div className="help-head">
              <h3>Keyboard shortcuts</h3>
              <button type="button" className="btn-ghost sm" onClick={close}>Close</button>
            </div>
            <div className="help-grid">
              <section>
                <h4>Anywhere</h4>
                <dl>
                  <div><dt><Keys shortcut="Mod+K" /></dt><dd>Quick switch: type to jump to anything</dd></div>
                  <div><dt><Keys shortcut="?" /></dt><dd>Show or hide this list</dd></div>
                  <div><dt><Keys shortcut="Escape" /></dt><dd>Close a panel, or clear the highlighted placement</dd></div>
                </dl>
              </section>
              {helpGroups.map((g) => (
                <section key={g.group}>
                  <h4>{g.group}</h4>
                  <dl>
                    {g.items.map((c) => (
                      <div key={c.id}><dt><Keys shortcut={c.shortcut!} /></dt><dd>{c.title}</dd></div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
            <p className="muted help-note">Shortcuts pause while you type in a box. Everything here, and more, is in the quick switcher.</p>
          </div>
        </div>
      )}
    </>
  );
}
