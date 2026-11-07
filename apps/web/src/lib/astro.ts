import type { Chart, PlanetId, PlanetPosition, VargaChart, VargaId } from '../types/chart';
import type { DignityKey } from '@vedic/i18n';
import { NAK_SPAN, PLANET_BY_ID, signInfo } from '../data/constants';

/** ((s - 1 + k) mod 12) + 1 */
export const addSigns = (s: number, k: number) => ((((s - 1 + k) % 12) + 12) % 12) + 1;

export const norm360 = (x: number) => ((x % 360) + 360) % 360;

export const signOf = (lon: number) => Math.floor(norm360(lon) / 30) + 1;

export const nakshatraOf = (lon: number) => {
  const l = norm360(lon);
  const n = Math.floor(l / NAK_SPAN);
  const pada = Math.floor((l - n * NAK_SPAN) / (NAK_SPAN / 4)) + 1;
  return { nakshatra: n + 1, pada };
};

/** house counted from ascSign (whole sign) */
export const houseOf = (sign: number, ascSign: number) => addSigns(sign, -(ascSign - 1));

export const formatDeg = (deg: number) => {
  const d = Math.floor(deg);
  const mFloat = (deg - d) * 60;
  const m = Math.floor(mFloat);
  const s = Math.floor((mFloat - m) * 60);
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″`;
};

export type Dignity = 'Exalted' | 'Moolatrikona' | 'Own sign' | 'Debilitated' | 'Friendly' | 'Neutral' | 'Enemy';

const FRIENDS: Record<PlanetId, PlanetId[]> = {
  sun: ['moon', 'mars', 'jupiter'],
  moon: ['sun', 'mercury'],
  mars: ['sun', 'moon', 'jupiter'],
  mercury: ['sun', 'venus'],
  jupiter: ['sun', 'moon', 'mars'],
  venus: ['mercury', 'saturn'],
  saturn: ['mercury', 'venus'],
  rahu: ['venus', 'saturn', 'mercury'],
  ketu: ['mars', 'venus', 'saturn'],
};
const ENEMIES: Record<PlanetId, PlanetId[]> = {
  sun: ['venus', 'saturn'],
  moon: [],
  mars: ['mercury'],
  mercury: ['moon'],
  jupiter: ['mercury', 'venus'],
  venus: ['sun', 'moon'],
  saturn: ['sun', 'moon', 'mars'],
  rahu: ['sun', 'moon', 'mars'],
  ketu: ['sun', 'moon'],
};

export function dignityOf(id: PlanetId, sign: number): Dignity {
  const p = PLANET_BY_ID[id];
  if (p.exalted === sign) return 'Exalted';
  if (p.debilitated === sign) return 'Debilitated';
  if (p.moolatrikona === sign) return 'Moolatrikona';
  if (p.own.includes(sign)) return 'Own sign';
  const lord = signInfo(sign).lord;
  if (lord === id) return 'Own sign';
  if (FRIENDS[id].includes(lord)) return 'Friendly';
  if (ENEMIES[id].includes(lord)) return 'Enemy';
  return 'Neutral';
}

/** Maps the UI's dignity labels to the shared vocabulary keys (for translated names). */
export const DIGNITY_KEY: Record<Dignity, DignityKey> = {
  Exalted: 'exalted', Moolatrikona: 'moolatrikona', 'Own sign': 'own', Debilitated: 'debilitated', Friendly: 'friend', Neutral: 'neutral', Enemy: 'enemy',
};

export const dignityTone = (d: Dignity): 'good' | 'mid' | 'bad' =>
  d === 'Exalted' || d === 'Moolatrikona' || d === 'Own sign' || d === 'Friendly'
    ? 'good'
    : d === 'Debilitated' || d === 'Enemy'
      ? 'bad'
      : 'mid';

/** houses (1–12) aspected by a planet sitting in `house` */
export const aspectedHouses = (id: PlanetId, house: number) =>
  PLANET_BY_ID[id].aspects.map((a) => addSigns(house, a - 1));

/** Which houses each planet rules, given an ascendant sign. */
export const housesRuledBy = (id: PlanetId, ascSign: number) => {
  const out: number[] = [];
  for (let h = 1; h <= 12; h++) if (signInfo(addSigns(ascSign, h - 1)).lord === id) out.push(h);
  return out;
};

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Planets in a given varga, grouped by house */
export function occupantsByHouse(v: VargaChart) {
  const map: Record<number, PlanetId[]> = {};
  for (let h = 1; h <= 12; h++) map[h] = [];
  (Object.keys(v.planets) as PlanetId[]).forEach((id) => map[v.planets[id].house].push(id));
  return map;
}

export function getVarga(chart: Chart, id: VargaId): VargaChart {
  return chart.vargas[id] ?? chart.vargas.D1!;
}

export const planetPos = (chart: Chart, id: PlanetId): PlanetPosition =>
  chart.planets.find((p) => p.id === id)!;
