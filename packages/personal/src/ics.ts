/**
 * Panchanga as a calendar: one all-day event per local day with the tithi,
 * nakshatra, yoga and vara at sunrise (the Vedic day starts at sunrise).
 * With a natal Moon the feed becomes personal and adds Tara bala and
 * Chandrashtama to each day.
 *
 * Output is RFC 5545 iCalendar, so it opens in Google Calendar, Apple
 * Calendar and Outlook, either as a one-off file or as a subscription URL.
 */
import type { AyanamsaId, Engine } from '@vedic/engine';
import { dateToJd, jdToDate, YOGA_NAMES } from '@vedic/engine';
import { DateTime } from 'luxon';
import { tarabala, tithiOf } from './today';
import { houseFrom, nakshatraOf, NAKSHATRA_NAMES, norm360, signOf } from './util';

export interface PanchangaPlace {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export interface PanchangaDay {
  /** Local date, YYYY-MM-DD */
  date: string;
  /** Sunrise, ISO UTC (or local 06:00 in polar day or night) */
  sunrise: string;
  sunriseLocal: string;
  tithi: ReturnType<typeof tithiOf>;
  nakshatra: number;
  nakshatraName: string;
  yogaName: string;
  varaName: string;
  /** Ekadashi, Purnima, Amavasya, Pradosha (13th), Sankashti (Krishna 4th) */
  observance?: string;
  personal?: { tara: ReturnType<typeof tarabala>; chandrashtama: boolean };
}

export interface PanchangaOptions {
  place: PanchangaPlace;
  /** First local day (any time on it). */
  from: Date;
  days: number;
  ayanamsa?: AyanamsaId;
  /** Birth Moon longitude, for a personal feed. */
  natalMoon?: number;
}

const VARA = ['Ravivara (Sunday)', 'Somavara (Monday)', 'Mangalavara (Tuesday)', 'Budhavara (Wednesday)', 'Guruvara (Thursday)', 'Shukravara (Friday)', 'Shanivara (Saturday)'];

function observanceOf(tithi: number): string | undefined {
  if (tithi === 11 || tithi === 26) return 'Ekadashi';
  if (tithi === 15) return 'Purnima';
  if (tithi === 30) return 'Amavasya';
  if (tithi === 13 || tithi === 28) return 'Pradosha';
  if (tithi === 19) return 'Sankashti Chaturthi';
  return undefined;
}

export function panchangaDays(engine: Engine, o: PanchangaOptions): PanchangaDay[] {
  const { place } = o;
  const out: PanchangaDay[] = [];
  let day = DateTime.fromJSDate(o.from, { zone: place.timezone }).startOf('day');
  if (!day.isValid) throw new Error(`Unknown time zone ${place.timezone}`);
  const opts = { ayanamsa: o.ayanamsa ?? 'lahiri' };
  const natalMoonSign = o.natalMoon !== undefined ? signOf(o.natalMoon) : 0;
  const natalNak = o.natalMoon !== undefined ? nakshatraOf(o.natalMoon) : 0;
  for (let i = 0; i < o.days; i++, day = day.plus({ days: 1 })) {
    const midnight = day.toJSDate();
    const { sunrise } = engine.sunriseSunset(dateToJd(midnight), place.latitude, place.longitude);
    let rise = sunrise !== null ? jdToDate(sunrise) : day.set({ hour: 6 }).toJSDate();
    // the next sunrise after midnight can fall on the next day near the poles
    if (rise.getTime() - midnight.getTime() > 86_400_000) rise = day.set({ hour: 6 }).toJSDate();
    const snap = engine.positionsAt(rise, opts);
    const sun = snap.planets.sun.longitude;
    const moon = snap.planets.moon.longitude;
    const tithi = tithiOf(sun, moon);
    const nak = nakshatraOf(moon);
    const yoga = Math.floor(norm360(sun + moon) / (360 / 27)) + 1;
    const local = DateTime.fromJSDate(rise, { zone: place.timezone });
    const d: PanchangaDay = {
      date: day.toISODate()!,
      sunrise: rise.toISOString(),
      sunriseLocal: local.toFormat('HH:mm'),
      tithi,
      nakshatra: nak,
      nakshatraName: NAKSHATRA_NAMES[nak - 1],
      yogaName: YOGA_NAMES[yoga - 1],
      varaName: VARA[local.weekday % 7],
      observance: observanceOf(tithi.number),
    };
    if (o.natalMoon !== undefined) d.personal = { tara: tarabala(natalNak, nak), chandrashtama: houseFrom(natalMoonSign, signOf(moon)) === 8 };
    out.push(d);
  }
  return out;
}

/* ---------- iCalendar ---------- */

const escText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines at 75 octets as RFC 5545 asks, without splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (iso: string) => iso.replace(/-/g, '');

export function summaryOf(d: PanchangaDay): string {
  const paksha = d.tithi.paksha === 'shukla' ? 'Shukla' : 'Krishna';
  const tithi = d.tithi.number === 15 || d.tithi.number === 30 ? d.tithi.name : `${paksha} ${d.tithi.name}`;
  const lead = d.personal?.chandrashtama ? '⚠ Chandrashtama · ' : d.observance ? `✦ ${d.observance} · ` : '';
  const tara = d.personal ? ` · ${d.personal.tara.name} tara` : '';
  return `${lead}${tithi} · ${d.nakshatraName}${tara}`;
}

export function descriptionOf(d: PanchangaDay, place: PanchangaPlace): string {
  const lines = [
    `Tithi: ${d.tithi.paksha === 'shukla' ? 'Shukla' : 'Krishna'} paksha ${d.tithi.name}`,
    `Nakshatra: ${d.nakshatraName}`,
    `Yoga: ${d.yogaName}`,
    `Vara: ${d.varaName}`,
    `Sunrise: ${d.sunriseLocal} (${place.name})`,
    'All values at local sunrise, sidereal (Lahiri unless chosen otherwise).',
  ];
  if (d.personal) {
    lines.push('', `Tara bala: ${d.personal.tara.text}`);
    if (d.personal.chandrashtama) lines.push('Chandrashtama: the Moon transits the 8th sign from your birth Moon. Avoid starting anything important.');
  }
  return lines.join('\n');
}

export interface IcsOptions {
  /** Calendar name shown in the calendar app. */
  name: string;
  place: PanchangaPlace;
  /** Used in UIDs so two feeds never clash. */
  uidSuffix?: string;
  /** Generation time (fixed in tests). */
  now?: Date;
  /** Subscription URL, if the feed is hosted. */
  url?: string;
}

export function panchangaIcs(days: PanchangaDay[], o: IcsOptions): string {
  const now = stamp(o.now ?? new Date());
  const suffix = o.uidSuffix ?? `${o.place.latitude.toFixed(2)}_${o.place.longitude.toFixed(2)}`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Jyotisha Explorer//Panchanga//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escText(o.name)}`,
    `X-WR-TIMEZONE:${o.place.timezone}`,
    'X-PUBLISHED-TTL:PT24H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT24H',
  ];
  if (o.url) lines.push(`URL:${o.url}`);
  for (const d of days) {
    const next = DateTime.fromISO(d.date).plus({ days: 1 }).toISODate()!;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.date}-${suffix}@jyotisha-explorer`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dateOnly(d.date)}`,
      `DTEND;VALUE=DATE:${dateOnly(next)}`,
      `SUMMARY:${escText(summaryOf(d))}`,
      `DESCRIPTION:${escText(descriptionOf(d, o.place))}`,
      'TRANSP:TRANSPARENT',
      `CATEGORIES:${d.observance ? escText(d.observance) : 'Panchanga'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** Cities with a hosted subscription feed, rebuilt on every deploy. */
export const FEED_CITIES: (PanchangaPlace & { slug: string })[] = [
  { slug: 'new-delhi', name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' },
  { slug: 'mumbai', name: 'Mumbai', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata' },
  { slug: 'chennai', name: 'Chennai', latitude: 13.0827, longitude: 80.2707, timezone: 'Asia/Kolkata' },
  { slug: 'kolkata', name: 'Kolkata', latitude: 22.5726, longitude: 88.3639, timezone: 'Asia/Kolkata' },
  { slug: 'bengaluru', name: 'Bengaluru', latitude: 12.9716, longitude: 77.5946, timezone: 'Asia/Kolkata' },
  { slug: 'kathmandu', name: 'Kathmandu', latitude: 27.7172, longitude: 85.324, timezone: 'Asia/Kathmandu' },
  { slug: 'dubai', name: 'Dubai', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai' },
  { slug: 'singapore', name: 'Singapore', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
  { slug: 'london', name: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London' },
  { slug: 'new-york', name: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
  { slug: 'san-francisco', name: 'San Francisco', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
  { slug: 'toronto', name: 'Toronto', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto' },
  { slug: 'sydney', name: 'Sydney', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
];
