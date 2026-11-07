/**
 * Random birth moments for the rarity sample and the control chart.
 * Uniform in time from 1930 to 2015, uniform over the inhabited band of
 * latitudes (55°S to 65°N, area-weighted), any longitude. Times are given in
 * UTC so the sample does not depend on time zone rules.
 */
import type { BirthInput } from '@vedic/engine';
import { hashString, mulberry32 } from './util';

export const SAMPLE_METHOD = 'Birth instants uniform 1930-01-01 to 2015-12-31 UTC; places uniform by area between 55°S and 65°N; Lahiri, mean nodes, whole-sign houses; one count per yoga or dosha id per chart.';

const FROM = Date.UTC(1930, 0, 1);
const TO = Date.UTC(2016, 0, 1);
const rad = Math.PI / 180;

export function randomBirth(seed: number, index: number): BirthInput {
  const r = mulberry32((seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0);
  const when = new Date(FROM + Math.floor(r() * (TO - FROM) / 60_000) * 60_000);
  const s1 = Math.sin(-55 * rad);
  const s2 = Math.sin(65 * rad);
  const latitude = +(Math.asin(s1 + r() * (s2 - s1)) / rad).toFixed(4);
  const longitude = +(r() * 360 - 180).toFixed(4);
  const iso = when.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
    place: { name: `${latitude}, ${longitude}`, latitude, longitude, timezone: 'UTC' },
    utcOffsetMinutes: 0,
  };
}

/**
 * A control chart for a blind test: same place, a different moment 3 to 15
 * years away at a random time of day. Seeded by the birth itself, so the same
 * person always gets the same control.
 */
export function controlBirth<T extends { date: string; time: string }>(input: T, salt = ''): T {
  const r = mulberry32(hashString(`${input.date}|${input.time}|${salt}`));
  const birth = Date.UTC(+input.date.slice(0, 4), +input.date.slice(5, 7) - 1, +input.date.slice(8, 10));
  const years = 3 + r() * 12;
  const sign = r() < 0.5 ? -1 : 1;
  let d = new Date(birth + sign * years * 365.25 * 86_400_000);
  // keep it inside the range the ephemeris files cover well
  if (d.getUTCFullYear() < 1801 || d.getUTCFullYear() > 2398) d = new Date(birth - sign * years * 365.25 * 86_400_000);
  const minutes = Math.floor(r() * 1440);
  const time = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return { ...input, date: d.toISOString().slice(0, 10), time };
}
