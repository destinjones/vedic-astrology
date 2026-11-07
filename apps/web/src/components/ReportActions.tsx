import { useEffect, useRef, useState } from 'react';
import type { Chart } from '../types/chart';
import { CONSULT_DEFAULT, sectionChoices } from '../report/registry';
import type { Brand } from '../report/types';

const BRAND_KEY = 'vedic.consultBrand';
const SECTIONS_KEY = 'vedic.consultSections';

const read = <T,>(key: string, fallback: T): T => {
  try { const s = localStorage.getItem(key); return s ? { ...fallback, ...JSON.parse(s) } : fallback; } catch { return fallback; }
};
const readList = (key: string, fallback: string[]): string[] => {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; } catch { return fallback; }
};
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ } };

/** Shrink an uploaded logo to at most 480px and keep it as PNG, so it fits in browser storage. */
function logoToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 480 / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.naturalWidth * k));
      cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL('image/png'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image')); };
    img.src = url;
  });
}

/** "Download PDF report" and "Consultation export", both generated in the browser. */
export function ReportActions({ chart }: { chart: Chart }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ready = !!chart.engineContext;

  const run = async (opts: Parameters<typeof import('../report').downloadReport>[1]) => {
    setBusy('Starting…');
    setError(null);
    try {
      const { downloadReport } = await import('../report');
      await downloadReport(chart, { ...opts, onProgress: setBusy });
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
      <button className="btn-ghost" disabled={!ready || !!busy} onClick={() => run({ kind: 'report' })}
        title={ready ? 'A full, illustrated PDF reading of this chart' : 'Available once the Swiss Ephemeris has loaded'}>
        {busy && !open ? busy : 'Download PDF report'}
      </button>
      <button className="btn-ghost" disabled={!ready || !!busy} onClick={() => setOpen(true)}>Consultation export</button>
      {error && !open && <span className="report-error" role="alert">{error}</span>}
      {open && <ConsultDialog busy={busy} error={error} onClose={() => setOpen(false)} onExport={async (o) => { if (await run({ ...o, kind: 'consultation' })) setOpen(false); }} />}
    </div>
  );
}

function ConsultDialog({ busy, error, onClose, onExport }: {
  busy: string | null; error: string | null; onClose: () => void;
  onExport: (o: { brand: Brand; note: string; sections: string[] }) => void;
}) {
  const [brand, setBrand] = useState<Brand>(() => read<Brand>(BRAND_KEY, { name: '', tagline: '', contact: '' }));
  const [sections, setSections] = useState<string[]>(() => readList(SECTIONS_KEY, CONSULT_DEFAULT));
  const [note, setNote] = useState('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const choices = sectionChoices();

  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { save(BRAND_KEY, brand); }, [brand]);
  useEffect(() => { save(SECTIONS_KEY, sections); }, [sections]);

  const toggle = (id: string) => setSections((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement>) => setBrand((b) => ({ ...b, [k]: e.target.value }));

  return (
    <dialog ref={dialog} className="consult-dialog" onClose={onClose} onCancel={onClose}>
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); if (sections.length) onExport({ brand, note, sections }); }}>
        <header>
          <h3>Consultation export</h3>
          <p className="muted">A short PDF for your client, with your name and logo. Your details stay in this browser.</p>
        </header>
        <div className="consult-grid">
          <fieldset>
            <legend>Your practice</legend>
            <label>Name<input value={brand.name} onChange={set('name')} placeholder="e.g. Asha Rao, Jyotishi" required /></label>
            <label>Tagline<input value={brand.tagline ?? ''} onChange={set('tagline')} placeholder="optional" /></label>
            <label>Contact<input value={brand.contact ?? ''} onChange={set('contact')} placeholder="website, email or phone (optional)" /></label>
            <div className="consult-logo">
              {brand.logo ? <img src={brand.logo} alt="Your logo" /> : <span className="muted">No logo</span>}
              <label className="btn-ghost sm">
                {brand.logo ? 'Change logo' : 'Add logo'}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try { setLogoError(null); const logo = await logoToDataUrl(f); setBrand((b) => ({ ...b, logo })); } catch (err) { setLogoError((err as Error).message); }
                }} />
              </label>
              {brand.logo && <button type="button" className="btn-ghost sm" onClick={() => setBrand((b) => ({ ...b, logo: undefined }))}>Remove</button>}
            </div>
            {logoError && <p className="report-error">{logoError}</p>}
            <label>Note to your client<textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="optional, printed on its own page after the cover" /></label>
          </fieldset>
          <fieldset>
            <legend>Sections</legend>
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
          <button type="submit" className="btn-primary" disabled={!!busy || !sections.length || !brand.name.trim()}>{busy ?? 'Export PDF'}</button>
        </footer>
      </form>
    </dialog>
  );
}
