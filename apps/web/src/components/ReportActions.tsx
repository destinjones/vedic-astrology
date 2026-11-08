import { useEffect, useRef, useState } from 'react';
import type { Chart } from '../types/chart';
import { CONSULT_DEFAULT, sectionChoices } from '../report/registry';
import type { Brand } from '../report/types';
import { everyPdfBrand, hasBranding, toBrand, useBranding } from '../lib/branding';
import { BrandingButton, BrandingFields } from './Branding';
import { useI18n } from '../i18n';
import { LifeChartBookButton } from './LifeChartBook';
import { PracticeButton } from '../practice/PracticeButton';
import { PhraseTools } from '../practice/PhraseTools';
import { hasText, useReading, type Reading } from '../practice/store';

const SECTIONS_KEY = 'vedic.consultSections';

const readList = (key: string, fallback: string[]): string[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

/** "Download PDF report", "Consultation export" and the "Life Chart Book", all generated in the browser. */
export function ReportActions({ chart }: { chart: Chart }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ready = !!chart.engineContext;
  const { locale } = useI18n();
  const [branding] = useBranding();

  const run = async (opts: Parameters<typeof import('../report').downloadReport>[1]) => {
    setBusy('Starting…');
    setError(null);
    try {
      const { downloadReport } = await import('../report');
      await downloadReport(chart, { ...opts, locale, onProgress: setBusy });
      return true;
    } catch (e) {
      console.error(e);
      setError('The report could not be made. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="report-actions">
      <button className="btn-ghost" disabled={!ready || !!busy} onClick={() => run({ kind: 'report', brand: everyPdfBrand(branding) })}
        title={ready ? 'A full, illustrated PDF reading of this chart' : 'Available once the Swiss Ephemeris has loaded'}>
        {busy && !open ? busy : 'Download PDF report'}
      </button>
      <button className="btn-ghost" disabled={!ready || !!busy} onClick={() => setOpen(true)}>Consultation export</button>
      <LifeChartBookButton chart={chart} disabled={!!busy} />
      <BrandingButton disabled={!!busy} />
      <PracticeButton chart={chart} disabled={!!busy} />
      {error && !open && <span className="report-error" role="alert">{error}</span>}
      {open && <ConsultDialog chart={chart} busy={busy} error={error} onClose={() => setOpen(false)} onExport={async (o) => { if (await run({ ...o, kind: 'consultation' })) setOpen(false); }} />}
    </div>
  );
}

function ConsultDialog({ chart, busy, error, onClose, onExport }: {
  chart: Chart; busy: string | null; error: string | null; onClose: () => void;
  onExport: (o: { brand: Brand; note: string; sections: string[]; reading?: Reading }) => void;
}) {
  const [branding] = useBranding();
  const brand = toBrand(branding);
  const reading = useReading(chart.input);
  const [withReading, setWithReading] = useState(true);
  const [sections, setSections] = useState<string[]>(() => readList(SECTIONS_KEY, CONSULT_DEFAULT));
  const [note, setNote] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const choices = sectionChoices();

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { save(SECTIONS_KEY, sections); }, [sections]);

  const toggle = (id: string) => setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <dialog ref={dialog} className="consult-dialog" onClose={onClose} onCancel={onClose}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (sections.length && brand) onExport({ brand, note, sections, reading: withReading && hasText(reading) ? reading : undefined }); }}>
        <header>
          <h3>Consultation export</h3>
          <p className="muted">A short PDF for your client, with your name and logo. Your details stay in this browser.</p>
        </header>
        <div className="consult-grid">
          <fieldset>
            <legend>Your practice</legend>
            <p className="muted">Shared with the Life Chart Book and your other PDFs, so you fill it in once.</p>
            <BrandingFields requireName showEveryPdf={false} />
            <label>Note to your client<textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional, printed on its own page after the cover" /></label>
            <PhraseTools chart={chart} topics={['all']} value={note} onChange={setNote} compact />
          </fieldset>
          <fieldset>
            <legend>Sections</legend>
            {hasText(reading) && (
              <label className="consult-section">
                <input type="checkbox" checked={withReading} onChange={(e) => setWithReading(e.target.checked)} />
                <span><b>Your reading: {reading.title}</b><small className="muted">From Readings and phrases, printed after your note ({reading.sections.filter((x) => x.text.trim()).length} sections)</small></span>
              </label>
            )}
            {choices.map((c) => (
              <label key={c.id} className="consult-section">
                <input type="checkbox" checked={sections.includes(c.id)} onChange={() => toggle(c.id)} />
                <span><b>{c.title}</b><small className="muted">{c.blurb}</small></span>
              </label>
            ))}
          </fieldset>
        </div>
        <footer>
          {error && <span className="report-error" role="alert">{error}</span>}
          <button type="button" className="btn-ghost" onClick={() => dialog.current?.close()} disabled={!!busy}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={!!busy || !sections.length || !hasBranding(branding)}>{busy ?? 'Export PDF'}</button>
        </footer>
      </form>
    </dialog>
  );
}
