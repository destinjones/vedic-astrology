/**
 * Divisional charts (vargas), Parashari rules from BPHS ch. 6–7.
 * D5, D6, D8, D11 are not in the classical Shodasavarga list; the conventions
 * used for them are the common ones (as in Jagannatha Hora's defaults) and are
 * noted per division.
 */
import { SIGN_SLUGS } from './constants';
import type { SignNumber, VargaId } from './types';
import { addSigns, norm360, signOf } from './zodiac';

const isOdd = (s: number) => s % 2 === 1;

export interface VargaDef {
  id: VargaId;
  division: number;
  name: string;
  /** Area of life traditionally read from this varga */
  signifies: string;
  /** Sign (1–12) of a sidereal longitude in this varga */
  sign(lon: number): SignNumber;
}

const part = (lon: number, n: number) => Math.min(n - 1, Math.floor(((norm360(lon) % 30) * n) / 30));
const modality = (s: number) => (s - 1) % 3; // 0 movable, 1 fixed, 2 dual
const element = (s: number) => (s - 1) % 4; // 0 fire, 1 earth, 2 air, 3 water

/** Sign + part counted from a start sign chosen by `start(sign)` */
const fromStart =
  (n: number, start: (sign: SignNumber) => number) =>
  (lon: number): SignNumber => {
    const s = signOf(lon);
    return addSigns(start(s), part(lon, n));
  };

/** Continuous (cyclic) mapping: amsa k of the zodiac -> sign k mod 12 */
const cyclic = (n: number) => (lon: number): SignNumber =>
  ((Math.floor((norm360(lon) * n) / 30) % 12) + 1) as SignNumber;

const byModality = (movable: number, fixed: number, dual: number) => (s: SignNumber) =>
  [movable, fixed, dual][modality(s)];

export const VARGAS: Record<VargaId, VargaDef> = {
  D1: { id: 'D1', division: 1, name: 'Rasi', signifies: 'Body, overall life', sign: (l) => signOf(l) },
  D2: {
    id: 'D2',
    division: 2,
    name: 'Hora',
    signifies: 'Wealth',
    // Odd signs: Sun's hora (Leo) then Moon's (Cancer); even signs reverse.
    sign: (l) => {
      const s = signOf(l);
      const first = part(l, 2) === 0;
      return (isOdd(s) === first ? 5 : 4) as SignNumber;
    },
  },
  D3: {
    id: 'D3',
    division: 3,
    name: 'Drekkana',
    signifies: 'Siblings, courage',
    sign: (l) => addSigns(signOf(l), part(l, 3) * 4),
  },
  D4: {
    id: 'D4',
    division: 4,
    name: 'Chaturthamsa',
    signifies: 'Property, fortune, home',
    sign: (l) => addSigns(signOf(l), part(l, 4) * 3),
  },
  D5: {
    id: 'D5',
    division: 5,
    name: 'Panchamsa',
    signifies: 'Fame, power, authority',
    // Odd: Aries, Aquarius, Sagittarius, Gemini, Libra; even: Taurus, Virgo, Pisces, Capricorn, Scorpio
    sign: (l) =>
      (isOdd(signOf(l)) ? [1, 11, 9, 3, 7] : [2, 6, 12, 10, 8])[part(l, 5)] as SignNumber,
  },
  D6: {
    id: 'D6',
    division: 6,
    name: 'Shashthamsa',
    signifies: 'Health, disease',
    sign: fromStart(6, (s) => (isOdd(s) ? 1 : 7)),
  },
  D7: {
    id: 'D7',
    division: 7,
    name: 'Saptamsa',
    signifies: 'Children, progeny',
    sign: fromStart(7, (s) => (isOdd(s) ? s : addSigns(s, 6))),
  },
  D8: {
    id: 'D8',
    division: 8,
    name: 'Ashtamsa',
    signifies: 'Sudden events, longevity',
    sign: fromStart(8, byModality(1, 9, 5)),
  },
  D9: {
    id: 'D9',
    division: 9,
    name: 'Navamsa',
    signifies: 'Spouse, dharma, inner strength',
    // Movable from itself, fixed from 9th, dual from 5th (equivalent to cyclic)
    sign: cyclic(9),
  },
  D10: {
    id: 'D10',
    division: 10,
    name: 'Dasamsa',
    signifies: 'Career, status',
    sign: fromStart(10, (s) => (isOdd(s) ? s : addSigns(s, 8))),
  },
  D11: {
    id: 'D11',
    division: 11,
    name: 'Rudramsa',
    signifies: 'Gains, destruction / endings',
    // Not defined in BPHS; zodiacal (cyclic) counting is used.
    sign: cyclic(11),
  },
  D12: {
    id: 'D12',
    division: 12,
    name: 'Dwadasamsa',
    signifies: 'Parents, ancestry',
    sign: fromStart(12, (s) => s),
  },
  D16: {
    id: 'D16',
    division: 16,
    name: 'Shodasamsa',
    signifies: 'Vehicles, comforts, happiness',
    sign: fromStart(16, byModality(1, 5, 9)),
  },
  D20: {
    id: 'D20',
    division: 20,
    name: 'Vimsamsa',
    signifies: 'Spiritual practice, worship',
    sign: fromStart(20, byModality(1, 9, 5)),
  },
  D24: {
    id: 'D24',
    division: 24,
    name: 'Chaturvimsamsa',
    signifies: 'Education, learning',
    sign: fromStart(24, (s) => (isOdd(s) ? 5 : 4)),
  },
  D27: {
    id: 'D27',
    division: 27,
    name: 'Saptavimsamsa (Bhamsa)',
    signifies: 'Strengths and weaknesses',
    // Fire from Aries, earth from Cancer, air from Libra, water from Capricorn (= cyclic)
    sign: (l) => fromStart(27, (s) => [1, 4, 7, 10][element(s)])(l),
  },
  D30: {
    id: 'D30',
    division: 30,
    name: 'Trimsamsa',
    signifies: 'Misfortunes, evils, health',
    sign: (l) => {
      const s = signOf(l);
      const d = norm360(l) % 30;
      if (isOdd(s)) {
        // Mars 5, Saturn 5, Jupiter 8, Mercury 7, Venus 5
        if (d < 5) return 1;
        if (d < 10) return 11;
        if (d < 18) return 9;
        if (d < 25) return 3;
        return 7;
      }
      // Venus 5, Mercury 7, Jupiter 8, Saturn 5, Mars 5
      if (d < 5) return 2;
      if (d < 12) return 6;
      if (d < 20) return 12;
      if (d < 25) return 10;
      return 8;
    },
  },
  D40: {
    id: 'D40',
    division: 40,
    name: 'Khavedamsa',
    signifies: 'Auspicious / inauspicious effects (maternal)',
    sign: fromStart(40, (s) => (isOdd(s) ? 1 : 7)),
  },
  D45: {
    id: 'D45',
    division: 45,
    name: 'Akshavedamsa',
    signifies: 'General well-being, character (paternal)',
    sign: fromStart(45, byModality(1, 5, 9)),
  },
  D60: {
    id: 'D60',
    division: 60,
    name: 'Shashtiamsa',
    signifies: 'Past karma, everything (finest)',
    sign: fromStart(60, (s) => s),
  },
};

export const VARGA_IDS = Object.keys(VARGAS) as VargaId[];

/** Sign of a longitude in a given varga */
export function vargaSign(lon: number, varga: VargaId | number): SignNumber {
  const id = (typeof varga === 'number' ? `D${varga}` : varga) as VargaId;
  const def = VARGAS[id];
  if (!def) throw new Error(`Unsupported varga ${varga}`);
  return def.sign(lon);
}

/**
 * Position inside the varga sign: the fractional position within the amsa,
 * scaled to 0–30. (D1 returns the plain degree in sign.)
 */
export function vargaDegree(lon: number, division: number): number {
  const d = norm360(lon) % 30;
  const span = 30 / division;
  return ((d % span) / span) * 30;
}

export const vargaSignSlug = (lon: number, varga: VargaId) => SIGN_SLUGS[vargaSign(lon, varga) - 1];
