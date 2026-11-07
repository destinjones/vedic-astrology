import type { Dignity } from '@vedic/interpretations';
import type { PlanetId } from '../types/chart';
import { PLANET_BY_ID } from '../data/constants';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTHS.map((m) => m.slice(0, 3));

/** "15 August 1990" from a Date (UTC parts) or a YYYY-MM-DD string. */
export function longDate(d: Date | string) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-').map(Number);
    return `${day} ${MONTHS[m - 1]} ${y}`;
  }
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
}

/** "Aug 2027" */
export const monthYear = (d: Date | string) => { const x = new Date(d); return `${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };
/** "3 Aug 2027" */
export const shortDate = (d: Date | string) => { const x = new Date(d); return `${x.getUTCDate()} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}`; };

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const dms = (deg: number) => {
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return `${d}°${String(m).padStart(2, '0')}′`;
};

export const DIGNITY_LABEL: Record<Dignity, string> = {
  exalted: 'Exalted', moolatrikona: 'Moolatrikona', own: 'Own sign', great_friend: 'Great friend',
  friend: 'Friendly', neutral: 'Neutral', enemy: 'Enemy', great_enemy: 'Great enemy', debilitated: 'Debilitated',
};

export const pname = (id: PlanetId) => PLANET_BY_ID[id].name;
/** Timing package uses 'Sun'…; UI uses 'sun'… */
export const fromTiming = (p: string) => p.toLowerCase() as PlanetId;

export const ageAt = (birth: Date, d: Date) => Math.floor((d.getTime() - birth.getTime()) / (365.2425 * 864e5));

export const toneWord = (score: number) =>
  score >= 45 ? 'Excellent' : score >= 15 ? 'Good' : score > -15 ? 'Mixed' : score > -45 ? 'Challenging' : 'Difficult';

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
