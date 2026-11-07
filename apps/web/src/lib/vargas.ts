import type { PlanetId, PlanetPosition, VargaChart, VargaId } from '../types/chart';
import { addSigns, houseOf, norm360, signOf } from './astro';

/**
 * Parashari divisional sign for a sidereal longitude.
 * The engine is the source of truth; this exists so the UI can derive
 * vargas from D1 longitudes when the engine omits some.
 */
export function vargaSign(lon: number, d: VargaId): number {
  const L = norm360(lon);
  const s = signOf(L);
  const deg = L - (s - 1) * 30;
  const odd = s % 2 === 1;
  const modality = (s - 1) % 3; // 0 movable, 1 fixed, 2 dual
  const part = (size: number) => Math.min(Math.floor(deg / size), Math.round(30 / size) - 1);
  switch (d) {
    case 'D1': return s;
    case 'D2': return (deg < 15) === odd ? 5 : 4;
    case 'D3': return addSigns(s, 4 * part(10));
    case 'D4': return addSigns(s, 3 * part(7.5));
    case 'D7': return addSigns(odd ? s : addSigns(s, 6), part(30 / 7));
    case 'D9': return (Math.floor(L / (30 / 9)) % 12) + 1;
    case 'D10': return addSigns(odd ? s : addSigns(s, 8), part(3));
    case 'D12': return addSigns(s, part(2.5));
    case 'D16': return addSigns([1, 5, 9][modality], part(30 / 16));
    case 'D20': return addSigns([1, 9, 5][modality], part(1.5));
    case 'D24': return addSigns(odd ? 5 : 4, part(1.25));
    case 'D27': return (Math.floor(L / (30 / 27)) % 12) + 1;
    case 'D30': {
      if (odd) return deg < 5 ? 1 : deg < 10 ? 11 : deg < 18 ? 9 : deg < 25 ? 3 : 7;
      return deg < 5 ? 2 : deg < 12 ? 6 : deg < 20 ? 12 : deg < 25 ? 10 : 8;
    }
    case 'D40': return addSigns(odd ? 1 : 7, part(0.75));
    case 'D45': return addSigns([1, 5, 9][modality], part(30 / 45));
    case 'D60': return addSigns(s, part(0.5));
  }
}

export const ALL_VARGAS: VargaId[] = ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60'];

export function buildVarga(d: VargaId, ascLon: number, planets: PlanetPosition[]): VargaChart {
  const ascSign = vargaSign(ascLon, d);
  const placements = {} as VargaChart['planets'];
  planets.forEach((p) => {
    const sign = vargaSign(p.longitude, d);
    placements[p.id as PlanetId] = { sign, house: houseOf(sign, ascSign) };
  });
  return { id: d, ascSign, planets: placements };
}
