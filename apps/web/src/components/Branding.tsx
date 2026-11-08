import { useEffect, useRef, useState } from 'react';
import { contactLine, emptyBranding, hasBranding, logoToDataUrl, useBranding, type Branding } from '../lib/branding';

type TextField = 'name' | 'practice' | 'tagline' | 'website' | 'email' | 'phone' | 'address';

const FIELDS: { k: TextField; label: string; placeholder: string; type?: string; inputMode?: 'url'; autoComplete?: string }[] = [
  { k: 'name', label: 'Your name', placeholder: 'e.g. Asha Rao', autoComplete: 'name' },
  { k: 'practice', label: 'Practice', placeholder: 'e.g. Lotus Jyotish (optional)', autoComplete: 'organization' },
  { k: 'tagline', label: 'Tagline', placeholder: 'e.g. Vedic astrologer since 2004 (optional)' },
  { k: 'website', label: 'Website', placeholder: 'e.g. lotusjyotish.com (optional)', inputMode: 'url', autoComplete: 'url' },
  { k: 'email', label: 'Email', placeholder: 'optional', type: 'email', autoComplete: 'email' },
  { k: 'phone', label: 'Phone', placeholder: 'optional', type: 'tel', autoComplete: 'tel' },
  { k: 'address', label: 'Address or city', placeholder: 'optional', autoComplete: 'street-address' },
];

/**
 * The astrologer's branding fields, saved as they are typed. The same setting
 * feeds the PDF report, the consultation export, the yearly PDF and the Life
 * Chart Book, so it is filled in once.
 */
export function BrandingFields({ requireName = false, showEveryPdf = true }: { requireName?: boolean; showEveryPdf?: boolean }) {
  const [b, setB] = useBranding();
  const [logoError, setLogoError] = useState<string | null>(null);
  const set = (k: TextField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setB((x) => ({ ...x, [k]: v }));
  };

  return (
    <div className="branding-fields">
      {FIELDS.map((f) => (
        <label key={f.k}>
          {f.label}
          <input value={b[f.k]} onChange={set(f.k)} placeholder={f.placeholder} type={f.type ?? 'text'} inputMode={f.inputMode} autoComplete={f.autoComplete}
            required={requireName && f.k === 'name'} />
        </label>
      ))}
      <div className="consult-logo">
        {b.logo ? <img src={b.logo} alt="Your logo" /> : <span className="muted">No logo</span>}
        <label className="btn-ghost sm">
          {b.logo ? 'Change logo' : 'Add logo'}
          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try { setLogoError(null); const logo = await logoToDataUrl(f); setB((x) => ({ ...x, logo })); } catch (err) { setLogoError((err as Error).message); }
          }} />
        </label>
        {b.logo && <button type="button" className="btn-ghost sm" onClick={() => setB((x) => ({ ...x, logo: undefined }))}>Remove</button>}
      </div>
      {logoError && <p className="report-error">{logoError}</p>}
      {showEveryPdf && (
        <label className="consult-section">
          <input type="checkbox" checked={b.everyPdf} onChange={(e) => { const v = e.target.checked; setB((x) => ({ ...x, everyPdf: v })); }} />
          <span><b>Brand every PDF</b><small className="muted">Also print this on the everyday PDF report and the yearly PDF, not only on consultation exports and Life Chart Books.</small></span>
        </label>
      )}
    </div>
  );
}

/** A one-line preview of how the branding will read, for the dialogs that use it. */
export function BrandingSummary({ b }: { b: Branding }) {
  if (!hasBranding(b)) return <p className="muted">No branding yet: PDFs print only the client's chart.</p>;
  const sub = [b.practice, b.tagline].map((s) => s.trim()).filter(Boolean).join(' · ');
  const contact = contactLine(b);
  return (
    <div className="branding-summary">
      {b.logo && <img src={b.logo} alt="" />}
      <span><b>{b.name.trim()}</b>{sub && <small>{sub}</small>}{contact && <small className="muted">{contact}</small>}</span>
    </div>
  );
}

/** "Your branding" settings, opened from the report buttons. */
export function BrandingDialog({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [b, setB] = useBranding();
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} className="consult-dialog branding-dialog" onClose={onClose} onCancel={onClose} aria-labelledby="branding-title">
      <form method="dialog" noValidate onSubmit={(e) => { e.preventDefault(); dialog.current?.close(); }}>
        <header>
          <h3 id="branding-title">Your branding</h3>
          <p className="muted">
            Your name, practice, contact details and logo, printed on the cover and at the foot of every page of the PDFs you make for clients.
            It is saved in this browser only and never sent anywhere. Leave your name empty for unbranded PDFs.
          </p>
        </header>
        <fieldset>
          <legend>Your practice</legend>
          <BrandingFields />
        </fieldset>
        <fieldset>
          <legend>Preview</legend>
          <BrandingSummary b={b} />
        </fieldset>
        <footer>
          {hasBranding(b) && (
            <button type="button" className="btn-ghost" onClick={() => { if (confirm('Remove your branding from this browser?')) setB(emptyBranding()); }}>Clear</button>
          )}
          <button type="submit" className="btn-primary">Done</button>
        </footer>
      </form>
    </dialog>
  );
}

export function BrandingButton({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [b] = useBranding();
  return (
    <>
      <button className="btn-ghost" disabled={disabled} onClick={() => setOpen(true)}
        title="Your name, practice, contact details and logo on your PDFs">
        {hasBranding(b) ? 'Branding: on' : 'Your branding'}
      </button>
      {open && <BrandingDialog onClose={() => setOpen(false)} />}
    </>
  );
}
