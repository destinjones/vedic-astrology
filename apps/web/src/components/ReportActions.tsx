import { lazy, Suspense, useState } from 'react';
import type { Chart } from '../types/chart';
import { everyPdfBrand, useBranding } from '../lib/branding';
import { useI18n } from '../i18n';
import { LifeChartBookButton } from './LifeChartBook';
import { PracticeButton } from '../practice/PracticeButton';

// The branding editor and the consultation dialog (with its phrase tools) load only when opened.
const BrandingButton = lazy(() => import('./Branding').then((m) => ({ default: m.BrandingButton })));
const ConsultDialog = lazy(() => import('./ConsultDialog'));

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
      <Suspense fallback={<button className="btn-ghost" disabled>Your branding</button>}><BrandingButton disabled={!!busy} /></Suspense>
      <PracticeButton chart={chart} disabled={!!busy} />
      {error && !open && <span className="report-error" role="alert">{error}</span>}
      {open && <Suspense fallback={null}><ConsultDialog chart={chart} busy={busy} error={error} onClose={() => setOpen(false)} onExport={async (o) => { if (await run({ ...o, kind: 'consultation' })) setOpen(false); }} /></Suspense>}
    </div>
  );
}
