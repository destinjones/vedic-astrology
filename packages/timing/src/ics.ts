/**
 * iCalendar (RFC 5545) export, so favourable windows and dasha periods can be
 * dropped into Google Calendar, Apple Calendar or Outlook.
 *
 * Everything is written as all-day events (the windows are weeks long and
 * their edges are soft), with stable UIDs so importing the file again updates
 * the same events instead of duplicating them.
 */
import type { Window } from './timeline';

export interface IcsEvent {
  uid: string;
  /** First day (UTC date is used) */
  start: Date;
  /** Day after the last day, or any instant on the last day (rounded up) */
  end: Date;
  summary: string;
  description?: string;
  categories?: string[];
  /** Remind at this local hour on the first day (0–23) */
  alarmHour?: number;
  url?: string;
}

export interface IcsOptions {
  /** Calendar name shown by the calendar app */
  name: string;
  /** Timestamp written as DTSTAMP; default now */
  now?: Date;
  /** Product id; default the project's */
  prodId?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const stamp = (d: Date) => `${ymd(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const DAY = 86_400_000;

/** Escape a TEXT value (RFC 5545 3.3.11). */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line to 75 octets, continuation lines start with a space (RFC 5545 3.1). */
export function icsFold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length ? 74 : 75; // continuation lines carry the leading space
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = '';
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

/** Build a VCALENDAR document. Lines end with CRLF as the RFC requires. */
export function buildIcs(events: IcsEvent[], opts: IcsOptions): string {
  const now = opts.now ?? new Date();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${opts.prodId ?? '-//vedic-astrology//Jyotisha Explorer//EN'}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(opts.name)}`,
  ];
  for (const e of events) {
    const startDay = new Date(Date.UTC(e.start.getUTCFullYear(), e.start.getUTCMonth(), e.start.getUTCDate()));
    // DTEND is exclusive: round any instant after midnight up to the next day
    let endDay = new Date(Date.UTC(e.end.getUTCFullYear(), e.end.getUTCMonth(), e.end.getUTCDate()));
    if (endDay.getTime() < e.end.getTime()) endDay = new Date(endDay.getTime() + DAY);
    if (endDay.getTime() <= startDay.getTime()) endDay = new Date(startDay.getTime() + DAY);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${icsEscape(e.uid)}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(startDay)}`,
      `DTEND;VALUE=DATE:${ymd(endDay)}`,
      `SUMMARY:${icsEscape(e.summary)}`,
      'TRANSP:TRANSPARENT',
    );
    if (e.description) lines.push(`DESCRIPTION:${icsEscape(e.description)}`);
    if (e.categories?.length) lines.push(`CATEGORIES:${e.categories.map(icsEscape).join(',')}`);
    if (e.url) lines.push(`URL:${e.url}`);
    if (e.alarmHour !== undefined) {
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(e.summary)}`, `TRIGGER:PT${Math.max(0, Math.min(23, Math.round(e.alarmHour)))}H`, 'END:VALARM');
    }
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}

/** Stable id for a window: tone, first day and the dasha chain at its peak. */
export function windowId(w: Pick<Window, 'tone' | 'start' | 'dashaPath'>): string {
  return `${w.tone === 'favourable' ? 'fav' : 'chl'}-${w.start.toISOString().slice(0, 10)}-${w.dashaPath.join('.')}`;
}

export interface WindowIcsOptions extends IcsOptions {
  /** Which windows; default favourable only */
  tones?: Window['tone'][];
  /** Only windows that end after this instant; default now */
  after?: Date;
  /** Remind at this local hour on the first day; default 9, null for none */
  alarmHour?: number | null;
  /** Person the chart belongs to, for the event text */
  person?: string;
  /** Seed for UIDs so two people's windows never collide (e.g. a birth key hash) */
  uidSeed?: string;
}

/** Calendar of timeline windows. */
export function windowsToIcs(windows: Window[], opts: WindowIcsOptions): string {
  const tones = opts.tones ?? ['favourable'];
  const after = opts.after ?? opts.now ?? new Date();
  const who = opts.person ? ` for ${opts.person}` : '';
  const events: IcsEvent[] = windows
    .filter((w) => tones.includes(w.tone) && w.end > after)
    .map((w) => ({
      uid: `${windowId(w)}${opts.uidSeed ? `-${opts.uidSeed}` : ''}@vedic-astrology`,
      start: w.start,
      end: w.end,
      summary: `${w.tone === 'favourable' ? '▲ Favourable window' : '▼ Go carefully'}${who} (${w.dashaPath.join('–')})`,
      description: [
        `${w.tone === 'favourable' ? 'A stretch that stands out as supportive' : 'A stretch that stands out as testing'}: average ${w.average > 0 ? '+' : ''}${w.average}, peak ${w.peak > 0 ? '+' : ''}${w.peak} on a scale of ±100.`,
        `Drivers: ${w.drivers.join('; ')}.`,
        'From the Vimshottari dasha running and the planets in transit. A traditional reading for reflection, not advice.',
      ].join('\n'),
      categories: ['Astrology', w.tone === 'favourable' ? 'Favourable' : 'Challenging'],
      alarmHour: opts.alarmHour === null ? undefined : opts.alarmHour ?? 9,
    }));
  return buildIcs(events, opts);
}
