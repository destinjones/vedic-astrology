/**
 * Client intake links. The site has no server, so the round trip is two links:
 *
 * 1. The astrologer makes a request link, <base>intake/#a=Name&e=email&m=message,
 *    and sends it to the client however they like.
 * 2. The client fills in the intake page, which builds a reply link,
 *    <base>app/#intake&v=1&n=...&d=...&q=first+question&q=second+question,
 *    and sends it back by email, WhatsApp or copy and paste.
 * 3. The astrologer opens the reply link (or pastes it) and the app saves the
 *    chart, opens it in a tab and puts the questions in the client's history.
 *
 * Both links carry everything after the #, which browsers never send to a
 * server, so the birth details only ever travel inside the message itself.
 * The birth part is the same versioned format as a share link
 * (@vedic/engine/request), so the app reads it with the same checks.
 */
import type { BirthInput } from '../types/chart';
import { parseShareHash, shareHash } from './profiles';

export interface IntakeRequest {
  /** The astrologer's name, shown to the client. */
  from: string;
  /** Where the reply goes: an email address, used for the client's Email button. */
  email: string;
  /** A short note to the client. */
  message: string;
}

export interface IntakeReply {
  input: BirthInput;
  /** The client's questions, one per entry. */
  questions: string[];
  /** How to reach the client, as they wrote it. */
  contact: string;
  /** The astrologer the client was answering, if the request link named one. */
  to: string;
  /** The day the client filled the form in (YYYY-MM-DD). */
  sentOn: string;
}

export const MAX_QUESTIONS = 12;
export const MAX_QUESTION_LENGTH = 1000;
const MAX_CONTACT = 200;
const MAX_MESSAGE = 600;

const clip = (s: string | null | undefined, n: number) => (s ?? '').trim().slice(0, n);
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const base = () => location.origin + import.meta.env.BASE_URL;

/* ---------- request link: astrologer to client ---------- */

export function requestLink(r: IntakeRequest, root = base()): string {
  const q = new URLSearchParams();
  if (r.from.trim()) q.set('a', clip(r.from, 80));
  if (isEmail(r.email.trim())) q.set('e', r.email.trim());
  if (r.message.trim()) q.set('m', clip(r.message, MAX_MESSAGE));
  const s = q.toString();
  return `${root}intake/${s ? '#' + s : ''}`;
}

export function parseRequest(hash: string): IntakeRequest {
  const q = new URLSearchParams(hash.replace(/^#/, ''));
  const email = clip(q.get('e'), 200);
  return { from: clip(q.get('a'), 80), email: isEmail(email) ? email : '', message: clip(q.get('m'), MAX_MESSAGE) };
}

/* ---------- reply link: client to astrologer ---------- */

/** Splits the client's text box into questions: one per line, blank lines dropped. */
export function splitQuestions(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_QUESTIONS)
    .map((l) => l.slice(0, MAX_QUESTION_LENGTH));
}

export function replyHash(r: Omit<IntakeReply, 'sentOn'> & { sentOn?: string }): string {
  const q = new URLSearchParams(shareHash(r.input).slice(1));
  for (const x of r.questions.slice(0, MAX_QUESTIONS)) q.append('q', x.slice(0, MAX_QUESTION_LENGTH));
  if (r.contact.trim()) q.set('c', clip(r.contact, MAX_CONTACT));
  if (r.to.trim()) q.set('a', clip(r.to, 80));
  q.set('at', r.sentOn ?? new Date().toISOString().slice(0, 10));
  return '#intake&' + q.toString();
}

export const replyLink = (r: Omit<IntakeReply, 'sentOn'> & { sentOn?: string }, root = base()) => `${root}app/${replyHash(r)}`;

/** True for a hash that is meant to be a reply, valid or not. */
export const isReplyHash = (hash: string) => /^#?intake(&|$)/.test(hash);

/**
 * Reads a reply from a full link, a bare #fragment, or text the astrologer pasted
 * (an email body with the link somewhere in it). Returns null when there is no
 * usable reply in it.
 */
export function parseReply(text: string): IntakeReply | null {
  const t = text.trim();
  const at = t.search(/#?intake&/);
  if (at < 0) return null;
  // the link ends at the first space or line break (mail apps sometimes wrap it in <...>)
  const frag = t.slice(at).split(/[\s<>"]/)[0].replace(/^#/, '');
  const q = new URLSearchParams(frag.replace(/^intake&?/, ''));
  const input = parseShareHash('#' + q.toString());
  if (!input) return null;
  const sentOn = clip(q.get('at'), 10);
  return {
    input,
    questions: q.getAll('q').map((x) => x.trim().slice(0, MAX_QUESTION_LENGTH)).filter(Boolean).slice(0, MAX_QUESTIONS),
    contact: clip(q.get('c'), MAX_CONTACT),
    to: clip(q.get('a'), 80),
    sentOn: /^\d{4}-\d{2}-\d{2}$/.test(sentOn) ? sentOn : '',
  };
}

/** The text the client sends back, ready for an email or a chat message. */
export function replyMessage(r: IntakeReply, link: string): string {
  const name = r.input.name?.trim() || 'your client';
  const lines = [
    r.to ? `Hello ${r.to},` : 'Hello,',
    '',
    `Here are the birth details for ${name}. Open this link in Jyotisha Explorer to add them:`,
    link,
  ];
  if (r.questions.length) lines.push('', 'Questions:', ...r.questions.map((x) => `- ${x}`));
  return lines.join('\n');
}

/* ---------- the astrologer's own details, remembered for the next link ---------- */

const KEY = 'vedic.intake.v1';

export function loadRequestDefaults(): IntakeRequest {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<IntakeRequest> | null;
    if (v && typeof v === 'object') return { from: clip(v.from, 80), email: clip(v.email, 200), message: clip(v.message, MAX_MESSAGE) };
  } catch { /* storage unavailable */ }
  return { from: '', email: '', message: '' };
}

export function storeRequestDefaults(r: IntakeRequest) {
  try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* ignore */ }
}
