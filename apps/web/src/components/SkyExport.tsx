import { useEffect, useRef, useState } from 'react';
import type { Chart } from '../types/chart';
import { composeSky, posterPdf, SKY_FORMATS, type SkyCapture, type SkyFormat } from '../export/skyPoster';
import { canvasBlob, downloadBlob, slug } from '../export/raster';

/** Poster and wallpaper export of the 3D sky, from the view as it is framed now. */
export function SkyExport({ chart, capture, onClose }: { chart: Chart; capture: SkyCapture; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [format, setFormat] = useState<SkyFormat>('a2-150');
  const [labels, setLabels] = useState(true);
  const [hideName, setHideName] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const F = SKY_FORMATS[format];
  const name = slug(`${(!hideName && chart.input.name) || 'birth'}-sky-${format}`);

  const make = async (kind: 'png' | 'jpg' | 'pdf') => {
    setBusy(F.width * F.height > 12e6 ? 'Rendering a very large image, this can take a minute…' : 'Rendering…');
    setError(null);
    try {
      const canvas = await composeSky(chart, capture, format, { labels, hideName });
      setBusy('Saving…');
      const blob = kind === 'pdf' ? await posterPdf(canvas) : await canvasBlob(canvas, kind === 'png' ? 'image/png' : 'image/jpeg', 0.93);
      downloadBlob(blob, `${name}.${kind}`);
      // a small preview of what was saved
      const small = document.createElement('canvas');
      const k = 360 / Math.max(canvas.width, canvas.height);
      small.width = Math.round(canvas.width * k); small.height = Math.round(canvas.height * k);
      small.getContext('2d')!.drawImage(canvas, 0, 0, small.width, small.height);
      setPreview(URL.createObjectURL(await canvasBlob(small, 'image/jpeg', 0.85)));
    } catch (e) {
      console.error(e);
      setError('This device ran out of memory for that size. Try a smaller one, or the 150 dpi poster.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <dialog ref={dialog} className="consult-dialog sky-export" onClose={onClose} onCancel={onClose} aria-label="Poster and wallpaper">
      <div className="export-wrap">
        <header>
          <h3>Poster and wallpaper</h3>
          <button type="button" className="btn-ghost sm export-close" onClick={() => dialog.current?.close()} aria-label="Close">✕</button>
        </header>
        <div className="export-grid">
          <div className="export-preview sky-export-preview">
            {preview ? <img src={preview} alt="The image you just saved" /> : <p className="muted">Turn and zoom the 3D view first: the export uses the angle you see, re-rendered at full size. A preview appears here after you save.</p>}
          </div>
          <div className="export-opts">
            <label className="export-field">
              <span>Size</span>
              <select value={format} onChange={(e) => setFormat(e.target.value as SkyFormat)} disabled={!!busy}>
                {(Object.keys(SKY_FORMATS) as SkyFormat[]).map((f) => <option key={f} value={f}>{SKY_FORMATS[f].label}</option>)}
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={labels} onChange={(e) => setLabels(e.target.checked)} /> Name each graha in the picture</label>
            {chart.input.name?.trim() && <label className="check"><input type="checkbox" checked={hideName} onChange={(e) => setHideName(e.target.checked)} /> Leave the name off</label>}
            {F.kind === 'poster' ? (
              <div className="pop-row">
                <button className="btn-primary" disabled={!!busy} onClick={() => make('pdf')}>A2 PDF for printing</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => make('jpg')}>JPEG</button>
              </div>
            ) : (
              <div className="pop-row">
                <button className="btn-primary" disabled={!!busy} onClick={() => make('png')}>Download PNG</button>
                <button className="btn-ghost" disabled={!!busy} onClick={() => make('jpg')}>JPEG</button>
              </div>
            )}
            {busy && <p className="muted pop-note" role="status">{busy}</p>}
            {error && <p className="report-error" role="alert">{error}</p>}
            <p className="muted pop-note">
              {F.kind === 'poster'
                ? 'A2 is 420 × 594 mm. The 300 dpi file is what a print shop wants; it is large and slow to make on a phone.'
                : F.kind === 'phone'
                  ? 'The top of the picture is kept dark so the clock stays readable.'
                  : 'Full bleed, with a small caption in the corner.'}
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
