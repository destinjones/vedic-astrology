import { useEffect, useState } from 'react';
import './clientIntake.css';
import { TIME_CONFIDENCE_LABEL } from '../lib/birthQuality';
import { loadRequestDefaults, parseReply, requestLink, storeRequestDefaults, type IntakeReply, type IntakeRequest } from '../lib/intake';

const fmtDay = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

/** What a client sent back, with a button to add them. */
export function IntakeReplyCard({ reply, onAdd, onDismiss }: { reply: IntakeReply; onAdd: (r: IntakeReply) => void; onDismiss?: () => void }) {
  const { input } = reply;
  return (
    <div className="client-intake-reply">
      <p className="client-intake-who">
        <b>{input.name || 'A client'}</b>
        {reply.sentOn && <small className="muted"> filled this in on {fmtDay(reply.sentOn)}</small>}
      </p>
      <dl className="client-intake-facts">
        <dt>Born</dt><dd>{fmtDay(input.date)} at {input.time.slice(0, 5)}{input.timeConfidence ? ` (${TIME_CONFIDENCE_LABEL[input.timeConfidence].toLowerCase()})` : ''}</dd>
        <dt>Place</dt><dd>{input.place} <small className="muted">{input.latitude.toFixed(3)}, {input.longitude.toFixed(3)} · {input.timezone}</small></dd>
        {reply.contact && <><dt>Contact</dt><dd>{reply.contact}</dd></>}
      </dl>
      {reply.questions.length > 0 && (
        <>
          <p className="client-intake-sub">Their questions</p>
          <ol className="client-intake-questions">{reply.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        </>
      )}
      <div className="client-intake-actions">
        <button type="button" className="btn-primary" onClick={() => onAdd(reply)}>Save and open {input.name || 'the chart'}</button>
        {onDismiss && <button type="button" className="btn-ghost" onClick={onDismiss}>Not now</button>}
      </div>
      <p className="muted small">The chart goes into Saved charts, and the questions and contact into the client’s notes and history.</p>
    </div>
  );
}

/** A reply link the app was opened with, shown above everything else. */
export function IncomingIntake({ reply, onAdd, onDismiss }: { reply: IntakeReply | 'invalid'; onAdd: (r: IntakeReply) => void; onDismiss: () => void }) {
  return (
    <section className="card client-intake-incoming" aria-labelledby="incoming-intake-title">
      <div className="card-head">
        <h3 id="incoming-intake-title">A client sent you their birth details</h3>
        {reply === 'invalid' && <button type="button" className="btn-ghost sm" onClick={onDismiss}>Close</button>}
      </div>
      {reply === 'invalid' ? (
        <p>This reply link is incomplete, so it may have been cut off when it was copied. Ask the client to send it again, or paste the whole message under Client intake link.</p>
      ) : (
        <IntakeReplyCard reply={reply} onAdd={onAdd} onDismiss={onDismiss} />
      )}
    </section>
  );
}

/**
 * Under Saved charts: make a link for a client to fill in their own details,
 * and paste the reply they send back.
 */
export function ClientIntakeTools({ onAdd }: { onAdd: (r: IntakeReply) => void }) {
  const [req, setReq] = useState<IntakeRequest>(loadRequestDefaults);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  useEffect(() => { storeRequestDefaults(req); }, [req]);
  const link = requestLink(req);
  const set = (k: keyof IntakeRequest, v: string) => { setReq((r) => ({ ...r, [k]: v })); setCopied(false); };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); }
  };
  const reply = pasted.trim() ? parseReply(pasted) : null;

  return (
    <details className="client-intake" id="client-intake">
      <summary>
        <b>Client intake link</b>
        <small className="muted"> let a client fill in their own birth details and questions</small>
      </summary>
      <div className="client-intake-body">
        <div className="client-intake-step">
          <p className="client-intake-sub">1. Send the client this link</p>
          <div className="client-intake-grid">
            <label className="field">
              <span>Your name</span>
              <input value={req.from} maxLength={80} onChange={(e) => set('from', e.target.value)} placeholder="e.g. Pandit Sharma" />
            </label>
            <label className="field">
              <span>Your email <small className="muted">optional</small></span>
              <input type="email" value={req.email} maxLength={200} onChange={(e) => set('email', e.target.value)} placeholder="So the client can email the reply" />
            </label>
            <label className="field span-2">
              <span>Note to the client <small className="muted">optional</small></span>
              <input value={req.message} maxLength={600} onChange={(e) => set('message', e.target.value)} placeholder="Looking forward to our session on Friday" />
            </label>
          </div>
          <div className="client-intake-linkrow">
            <input className="mono" readOnly value={link} aria-label="Intake link for the client" onFocus={(e) => e.target.select()} />
            <button type="button" className="btn-ghost sm" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
          </div>
          <p className="muted small">
            The client fills in the form and gets a reply link to send back to you. Nothing is uploaded: the details travel only inside the
            messages you two send each other.
          </p>
        </div>
        <div className="client-intake-step">
          <p className="client-intake-sub">2. Add the reply</p>
          <p className="muted small">Open the link the client sent you, or paste their whole message here.</p>
          <textarea value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} aria-label="The client's reply" placeholder="Paste the client's message or reply link" />
          {pasted.trim() && !reply && <p className="form-error" role="alert">No complete reply link found in that text. It may have been cut off; ask the client to send it again.</p>}
          {reply && <IntakeReplyCard reply={reply} onAdd={(r) => { onAdd(r); setPasted(''); }} />}
        </div>
      </div>
    </details>
  );
}
