import { useMemo, useState } from 'react';
import type { BirthInput } from '../types/chart';
import { BirthForm } from '../components/BirthForm';
import { ART } from '../data/art';
import { TrustFooter } from '../trust/TrustFooter';
import { MAX_QUESTIONS, parseRequest, replyLink, replyMessage, splitQuestions, type IntakeReply } from '../lib/intake';

const BLANK: BirthInput = { name: '', date: '', time: '', place: '', latitude: NaN, longitude: NaN, timezone: '', ayanamsa: 'lahiri' };

/**
 * The page a client opens from their astrologer's intake link. They fill in their
 * birth details and questions, and get back a link to send to the astrologer.
 * Nothing leaves this browser except what the client sends themselves.
 */
export default function IntakeApp() {
  const req = useMemo(() => parseRequest(location.hash), []);
  const [questions, setQuestions] = useState('');
  const [contact, setContact] = useState('');
  const [reply, setReply] = useState<IntakeReply | null>(null);
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);
  const astrologer = req.from || 'your astrologer';

  const submit = (input: BirthInput) => {
    setReply({ input, questions: splitQuestions(questions), contact: contact.trim(), to: req.from, sentOn: new Date().toISOString().slice(0, 10) });
    setCopied(null);
    requestAnimationFrame(() => document.getElementById('intake-done')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const link = reply ? replyLink(reply) : '';
  const message = reply ? replyMessage(reply, link) : '';
  const subject = `Birth details${reply?.input.name ? ` for ${reply.input.name}` : ''}`;
  const copy = async (what: 'link' | 'message') => {
    try { await navigator.clipboard.writeText(what === 'link' ? link : message); setCopied(what); } catch { setCopied(null); }
  };
  const share = async () => {
    try { await navigator.share({ title: subject, text: message }); } catch { /* cancelled */ }
  };
  const count = splitQuestions(questions).length;

  return (
    <div className="app intake-app">
      <div className="backdrop backdrop-cosmos" aria-hidden style={{ '--bg-desktop': `url("${ART.cosmosDesktop}")`, '--bg-mobile': `url("${ART.cosmosMobile}")` } as React.CSSProperties} />
      <div className="starfield" aria-hidden />
      <header className="topbar">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">✦</span>
          <div>
            <p className="brand-title">Jyotisha Explorer</p>
            <p>Birth details for your reading</p>
          </div>
        </a>
      </header>

      <main className="intake-page">
        <section className="intake-hero">
          <p className="eyebrow">Before your reading</p>
          <h1>{req.from ? `${req.from} asked for your birth details` : 'Send your birth details to your astrologer'}</h1>
          {req.message && <blockquote className="intake-note">{req.message}</blockquote>}
          <p className="muted">
            Fill this in and you will get a link to send back to {astrologer}. Nothing is uploaded or stored anywhere:
            your answers are only inside the link, and only the person you send it to can read them.
          </p>
        </section>

        <section className="card intake-card">
          <div className="card-head"><h3>1. Your questions</h3><span className="muted">optional</span></div>
          <label className="field">
            <span>What would you like to ask? <small className="muted">one question per line, up to {MAX_QUESTIONS}</small></span>
            <textarea rows={4} value={questions} onChange={(e) => setQuestions(e.target.value)} placeholder={'When is a good time to change jobs?\nWhat does this year hold for my marriage?'} />
          </label>
          {count > 0 && <p className="muted small">{count} question{count === 1 ? '' : 's'}</p>}
          <label className="field">
            <span>How can {req.from || 'they'} reach you? <small className="muted">optional: phone, email or WhatsApp</small></span>
            <input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} autoComplete="tel" />
          </label>
        </section>

        <section className="card intake-card">
          <div className="card-head"><h3>2. Your birth details</h3></div>
          <p className="muted small intake-tip">
            The time on a birth certificate or hospital record is best. If you only know it roughly, give your best guess and say so under “How exact is the time?”.
          </p>
          <BirthForm initial={BLANK} busy={false} simple onSubmit={submit} submitLabel="Make my reply link" />
        </section>

        {reply && (
          <section className="card intake-card intake-done" id="intake-done" aria-live="polite">
            <div className="card-head"><h3>3. Send this to {astrologer}</h3></div>
            <p>
              Your details for <b>{reply.input.name || 'you'}</b>, born {reply.input.date} at {reply.input.time.slice(0, 5)} in {reply.input.place}
              {reply.questions.length ? `, with ${reply.questions.length} question${reply.questions.length === 1 ? '' : 's'}` : ''}, are in this link:
            </p>
            <textarea className="intake-link mono" readOnly rows={3} value={link} onFocus={(e) => e.target.select()} aria-label="Your reply link" />
            <div className="intake-send">
              {req.email && (
                <a className="btn-primary" href={`mailto:${encodeURIComponent(req.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>
                  Email it to {req.from || req.email}
                </a>
              )}
              <a className={req.email ? 'btn-ghost' : 'btn-primary'} href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">Send on WhatsApp</a>
              {typeof navigator.share === 'function' && <button type="button" className="btn-ghost" onClick={share}>Share…</button>}
              {!req.email && (
                <a className="btn-ghost" href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>Email</a>
              )}
              <button type="button" className="btn-ghost" onClick={() => copy('message')}>{copied === 'message' ? 'Copied' : 'Copy message'}</button>
              <button type="button" className="btn-ghost" onClick={() => copy('link')}>{copied === 'link' ? 'Copied' : 'Copy link only'}</button>
            </div>
            <p className="muted small">
              Spotted a mistake? Change the form above and press “Make my reply link” again, then send the new link.
            </p>
          </section>
        )}
      </main>

      <footer className="foot muted">
        <TrustFooter />
      </footer>
    </div>
  );
}
