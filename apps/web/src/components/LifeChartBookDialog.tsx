import { useEffect, useMemo, useRef, useState } from 'react';
import { fromEngineChart, interpretChart } from '@vedic/interpretations';
import type { Chart, PlanetId } from '../types/chart';
import { toBrand, useBranding } from '../lib/branding';
import { BrandingFields } from './Branding';
import { BOOK_CHAPTERS, draftKey, emptyDraft, normaliseDraft, type BookDraft } from '../report/book/draft';
import { PLANET_BY_ID, signInfo } from '../data/constants';
import { useI18n } from '../i18n';

const IDS: PlanetId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const ORD = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

type Tab = 'practice' | 'letters' | 'chapters' | 'placements' | 'years' | 'yogas' | 'print';
const TABS: [Tab, string][] = [
  ['practice', 'Practice'], ['letters', 'Letters'], ['chapters', 'Chapters'], ['placements', 'Planets and houses'],
  ['yogas', 'Yogas'], ['years', 'Years'], ['print', 'Format'],
];

const readJSON = (key: string): unknown => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } };
const writeJSON = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

export default function BookDialog({ chart, onClose }: { chart: Chart; onClose: () => void }) {
  const key = draftKey(chart.input);
  const [draft, setDraft] = useState<BookDraft>(() => normaliseDraft(readJSON(key) ?? emptyDraft()));
  const [branding] = useBranding();
  const [tab, setTab] = useState<Tab>('practice');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const { locale } = useI18n();
  const ec = chart.engineContext?.chart;
  const found = useMemo(() => (ec ? interpretChart(fromEngineChart(ec)) : null), [ec]);

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { writeJSON(key, draft); }, [key, draft]);

  const set = <K extends keyof BookDraft>(k: K, v: BookDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const note = (k: string) => draft.notes[k] ?? '';
  const setNote = (k: string, v: string) => setDraft((d) => {
    const notes = { ...d.notes };
    if (v.trim()) notes[k] = v; else delete notes[k];
    return { ...d, notes };
  });
  const toggle = (id: string) => set('chapters', draft.chapters.includes(id) ? draft.chapters.filter((x) => x !== id) : [...draft.chapters, id]);
  const noteCount = Object.keys(draft.notes).length;
  const who = chart.input.name?.trim() || 'this chart';
  const [y0] = useState(() => new Date().getUTCFullYear());

  const exportBook = async () => {
    setBusy('Starting…');
    setError(null);
    setDone(null);
    try {
      const { downloadBook } = await import('../report/book');
      const r = await downloadBook(chart, { draft, brand: toBrand(branding), locale, onProgress: setBusy });
      setDone(r.cover ? `Done: ${r.pages} interior pages and a cover with a ${r.spineMm} mm spine, in one zip.` : `Done: ${r.pages} pages.`);
    } catch (e) {
      console.error(e);
      setError('The book could not be made. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const saveFile = () => {
    const blob = new Blob([JSON.stringify({ kind: 'life-chart-book-draft', version: 1, birth: chart.input, draft }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${who.replace(/[^\p{L}\p{N}]+/gu, '-')}-life-chart-book-draft.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const openFile = async (f: File) => {
    try {
      const j = JSON.parse(await f.text());
      setDraft(normaliseDraft(j?.draft ?? j));
      setError(null);
    } catch {
      setError('That file is not a Life Chart Book draft.');
    }
  };

  const area = (label: string, k: string, hint: string, rows = 3) => (
    <label key={k}>{label}<textarea rows={rows} value={note(k)} onChange={(e) => setNote(k, e.target.value)} placeholder={hint} /></label>
  );

  return (
    <dialog ref={dialog} className="consult-dialog book-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="book-title">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (draft.chapters.length) exportBook(); }}>
        <header>
          <h3 id="book-title">Life Chart Book</h3>
          <p className="muted">
            A long, printable book for {who}: every chapter teaches the idea first, then reads it in this chart, with sources.
            Add your own letters and notes anywhere. Your drafts stay in this browser{noteCount ? ` (${noteCount} note${noteCount === 1 ? '' : 's'} so far)` : ''}.
          </p>
        </header>
        <div className="book-tabs" role="tablist" aria-label="Book sections">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        <div className="book-panel" role="tabpanel">
          {tab === 'practice' && (
            <fieldset>
              <legend>Your practice</legend>
              <p className="muted">Printed on the cover, the title page, beside each of your notes and at the foot of every page. Leave your name empty for an unbranded book. This is the same branding as your other PDFs.</p>
              <BrandingFields showEveryPdf={false} />
              <label>Book title<input value={draft.title} onChange={(e) => set('title', e.target.value)} /></label>
            </fieldset>
          )}

          {tab === 'letters' && (
            <fieldset>
              <legend>Letters and dedication</legend>
              <label>Dedication<textarea rows={2} value={draft.dedication} onChange={(e) => set('dedication', e.target.value)} placeholder="optional, a line or two on its own page, e.g. For Priya, on her thirtieth year" /></label>
              <label>Opening letter<textarea rows={7} value={draft.letter} onChange={(e) => set('letter', e.target.value)} placeholder="Leave empty for a standard welcome. Blank lines start new paragraphs." /></label>
              <label>The heart of the chart: your key points, one per line<textarea rows={5} value={draft.takeaways} onChange={(e) => set('takeaways', e.target.value)} placeholder="Leave empty to list the chart's strongest gifts and lessons instead." /></label>
              <label>Closing letter<textarea rows={5} value={draft.closing} onChange={(e) => set('closing', e.target.value)} placeholder="optional, printed at the end of the book" /></label>
            </fieldset>
          )}

          {tab === 'chapters' && (
            <fieldset>
              <legend>Chapters and chapter notes</legend>
              <p className="muted">Untick a chapter to leave it out. A note is printed at the end of its chapter, in your voice.</p>
              {area('Note on “The heart of your chart”', 'chapter:heart', 'optional')}
              {BOOK_CHAPTERS.map((c) => (
                <div key={c.id} className="book-chapter">
                  <label className="consult-section">
                    <input type="checkbox" checked={draft.chapters.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span><b>{c.title}</b><small className="muted">{c.blurb}</small></span>
                  </label>
                  {draft.chapters.includes(c.id) && area('', `chapter:${c.id}`, `Your note for “${c.title}” (optional)`, 2)}
                </div>
              ))}
            </fieldset>
          )}

          {tab === 'placements' && (
            <fieldset>
              <legend>Notes on planets and houses</legend>
              <p className="muted">Each note goes on that planet’s pages or after that house, under the reading the book writes.</p>
              <div className="book-two">
                <div>
                  {IDS.map((id) => {
                    const p = chart.planets.find((x) => x.id === id)!;
                    return area(`${PLANET_BY_ID[id].name} in ${signInfo(p.sign).name}, ${ORD(p.house)} house`, `graha:${id}`, 'optional');
                  })}
                </div>
                <div>
                  {Array.from({ length: 12 }, (_, i) => {
                    const sign = ((chart.ascendant.sign - 1 + i) % 12) + 1;
                    return area(`${ORD(i + 1)} house (${signInfo(sign).name})`, `house:${i + 1}`, 'optional', 2);
                  })}
                </div>
              </div>
            </fieldset>
          )}

          {tab === 'yogas' && (
            <fieldset>
              <legend>Notes on yogas, doshas and remedies</legend>
              {!found && <p className="muted">Available once the Swiss Ephemeris has loaded.</p>}
              {found?.yogas.map((y, i) => <div key={`${y.id}-${i}`}>{area(`${y.name} (${y.strength})`, `yoga:${y.id}`, 'optional', 2)}</div>)}
              {found?.doshas.filter((d) => d.present).map((d) => <div key={d.id}>{area(`${d.name} (${d.severity})`, `dosha:${d.id}`, 'optional', 2)}</div>)}
              <p className="muted">Remedy notes go under each planet in the remedies chapter.</p>
              {IDS.map((id) => area(`Remedies for ${PLANET_BY_ID[id].name}`, `remedy:${id}`, 'optional, printed only if this planet is one the chapter covers', 2))}
            </fieldset>
          )}

          {tab === 'years' && (
            <fieldset>
              <legend>The years ahead</legend>
              <label className="consult-section">
                <span><b>Forecast length</b></span>
                <select value={draft.years} onChange={(e) => set('years', Number(e.target.value) === 5 ? 5 : 10)}>
                  <option value={10}>Ten years</option>
                  <option value={5}>Five years</option>
                </select>
              </label>
              {Array.from({ length: draft.years }, (_, i) => y0 + i).map((y) => area(String(y), `year:${y}`, `What you want ${who} to know about ${y} (optional)`, 2))}
            </fieldset>
          )}

          {tab === 'print' && (
            <fieldset>
              <legend>Format</legend>
              <label className="consult-section">
                <input type="radio" name="book-format" checked={!draft.print} onChange={() => set('print', false)} />
                <span><b>Screen edition</b><small className="muted">One PDF with front and back covers, to email or read on a tablet.</small></span>
              </label>
              <label className="consult-section">
                <input type="radio" name="book-format" checked={draft.print} onChange={() => set('print', true)} />
                <span><b>Print edition</b><small className="muted">A zip for a print-on-demand service such as Lulu: an A4 interior with 3 mm bleed, chapters on right-hand pages and a page count divisible by four, plus a separate cover sheet with the spine.</small></span>
              </label>
              {draft.print && (
                <label>Spine width in mm (0 to estimate it from the page count)
                  <input type="number" min={0} max={99} step={0.1} value={draft.spineMm} onChange={(e) => set('spineMm', Math.max(0, Math.min(99, Number(e.target.value) || 0)))} />
                </label>
              )}
              <label className="consult-section">
                <input type="checkbox" checked={draft.notesPages} onChange={(e) => set('notesPages', e.target.checked)} />
                <span><b>Ruled notes pages</b><small className="muted">For the client to write in. In print they fill the left-hand pages before each chapter.</small></span>
              </label>
            </fieldset>
          )}
        </div>

        <footer>
          {error && <span className="report-error" role="alert">{error}</span>}
          {done && !busy && <span className="muted" role="status">{done}</span>}
          <span className="book-files">
            <button type="button" className="btn-ghost sm" onClick={saveFile}>Save draft file</button>
            <button type="button" className="btn-ghost sm" onClick={() => file.current?.click()}>Open draft file</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); e.target.value = ''; }} />
          </span>
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()} disabled={!!busy}>Close</button>
          <button type="submit" className="btn-primary" disabled={!!busy || !draft.chapters.length}>{busy ?? (draft.print ? 'Export print files' : 'Export book PDF')}</button>
        </footer>
      </form>
    </dialog>
  );
}
