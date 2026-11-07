/**
 * Ayurdaya: the classical longevity estimates, Pindayu, Amsayu and Nisargayu
 * (BPHS ch. 44; Saravali ch. 40; Brihat Jataka ch. 7).
 *
 * READ THIS FIRST. These are traditional arithmetic, not predictions. The
 * texts themselves add many further reductions and exceptions, disagree on
 * several of them, and say the method chosen depends on which of the lagna,
 * Sun and Moon is strongest. No astrologer of standing reads a lifespan from
 * a number like this, and nobody should make a health decision from it. We
 * show it because practitioners ask how the method works, as a range.
 *
 * What is computed:
 *  - Pindayu: each planet's full years (Sun 19, Moon 25, Mars 15, Mercury 12,
 *    Jupiter 15, Venus 21, Saturn 20), full at deep exaltation and halved at
 *    deep debilitation, in proportion between.
 *  - Nisargayu: the same proportion on the natural years (Moon 1, Mars 2,
 *    Mercury 9, Venus 20, Jupiter 18, Sun 20, Saturn 50).
 *  - Amsayu: each planet and the lagna give the number of navamsas passed
 *    since 0° Aries, counted in years and reduced below 12; tripled when
 *    exalted or retrograde, doubled in own sign or vargottama (the larger
 *    applies once).
 *  - Haranas (reductions) for Pindayu and Nisargayu: Chakrapata (a planet in
 *    the visible half, 12th back to 7th, loses 1, 1/2, 1/3, 1/4, 1/5, 1/6; a
 *    benefic half that), Shatrukshetra (an enemy's sign costs 1/3 unless
 *    retrograde; Mars exempt) and Astangata (combust costs 1/2, except Venus
 *    and Saturn). Only the larger of Shatrukshetra and Astangata applies.
 *    Krurodaya (a malefic rising) is not applied.
 */
import { EXALTATION } from './constants';
import type { Chart, GrahaId } from './types';
import { norm360 } from './zodiac';

type Seven = 'sun' | 'moon' | 'mars' | 'mercury' | 'jupiter' | 'venus' | 'saturn';
const SEVEN: Seven[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn'];

export const PINDAYU_YEARS: Record<Seven, number> = { sun: 19, moon: 25, mars: 15, mercury: 12, jupiter: 15, venus: 21, saturn: 20 };
export const NISARGAYU_YEARS: Record<Seven, number> = { sun: 20, moon: 1, mars: 2, mercury: 9, jupiter: 18, venus: 20, saturn: 50 };

const BENEFICS: Seven[] = ['moon', 'mercury', 'jupiter', 'venus'];

export interface AyurdayaEntry {
  point: Seven | 'asc';
  /** Years before reductions */
  gross: number;
  /** Fraction removed by the haranas (0–1) */
  reduction: number;
  /** Years after reductions / increases */
  net: number;
  notes: string[];
}

export interface AyurdayaMethod {
  method: 'pindayu' | 'amsayu' | 'nisargayu';
  years: number;
  entries: AyurdayaEntry[];
}

export interface Ayurdaya {
  methods: AyurdayaMethod[];
  /** Smallest and largest of the three totals */
  range: [number, number];
  caveat: string;
}

export const AYURDAYA_CAVEAT =
  'Traditional arithmetic only. The texts add many further reductions, disagree on several, and choose the method by the strongest of lagna, Sun and Moon. This is not a prediction of lifespan and must never guide a health decision.';

/** 1 at deep exaltation, 1/2 at deep debilitation, linear in arc between. */
function exaltationShare(g: Seven, lon: number): number {
  const ex = EXALTATION[g]!;
  const point = (ex.sign - 1) * 30 + ex.degree;
  const d = Math.abs(norm360(lon - point + 180) - 180); // 0..180
  return (360 - d) / 360;
}

function haranas(chart: Pick<Chart, 'planets' | 'ascendant'>, g: Seven): { frac: number; notes: string[] } {
  const p = chart.planets[g];
  const notes: string[] = [];
  const house = ((p.sign - chart.ascendant.sign + 12) % 12) + 1;
  const chakra: Record<number, number> = { 12: 1, 11: 1 / 2, 10: 1 / 3, 9: 1 / 4, 8: 1 / 5, 7: 1 / 6 };
  let cp = chakra[house] ?? 0;
  if (cp && BENEFICS.includes(g)) cp /= 2;
  if (cp) notes.push(`Chakrapata: ${house}th house, −${Math.round(cp * 100)}%`);
  const enemy = (p.dignity === 'enemy' || p.dignity === 'great_enemy') && !p.retrograde && g !== 'mars' ? 1 / 3 : 0;
  const combust = p.combust && g !== 'venus' && g !== 'saturn' ? 1 / 2 : 0;
  const other = Math.max(enemy, combust);
  if (other) notes.push(combust >= enemy ? 'Astangata: combust, −50%' : 'Shatrukshetra: enemy sign, −33%');
  // Reductions apply in turn to what remains
  const frac = 1 - (1 - cp) * (1 - other);
  return { frac, notes };
}

export function computeAyurdaya(chart: Pick<Chart, 'planets' | 'ascendant' | 'vargas'>): Ayurdaya {
  const proportional = (method: 'pindayu' | 'nisargayu', table: Record<Seven, number>): AyurdayaMethod => {
    const entries = SEVEN.map((g): AyurdayaEntry => {
      const gross = table[g] * exaltationShare(g, chart.planets[g].longitude);
      const h = haranas(chart, g);
      return { point: g, gross, reduction: h.frac, net: gross * (1 - h.frac), notes: h.notes };
    });
    return { method, entries, years: entries.reduce((a, e) => a + e.net, 0) };
  };
  const navYears = (lon: number) => (norm360(lon) / (30 / 9)) % 12;
  const d9 = chart.vargas.D9;
  const amsa: AyurdayaEntry[] = SEVEN.map((g) => {
    const p = chart.planets[g];
    const gross = navYears(p.longitude);
    const notes: string[] = [];
    let mult = 1;
    if (p.dignity === 'exalted' || (p.retrograde && g !== 'sun' && g !== 'moon')) { mult = 3; notes.push(p.dignity === 'exalted' ? 'Exalted: ×3' : 'Retrograde: ×3'); }
    else if (p.dignity === 'own' || p.dignity === 'moolatrikona' || (d9?.vargottama.includes(g as GrahaId) ?? false)) { mult = 2; notes.push(p.dignity === 'own' || p.dignity === 'moolatrikona' ? 'Own sign: ×2' : 'Vargottama: ×2'); }
    const h = haranas(chart, g);
    // For Amsayu we apply Astangata and Shatrukshetra only; Chakrapata is used for Pindayu and Nisargayu
    const keep = h.notes.filter((n) => !n.startsWith('Chakrapata'));
    const red = keep.length ? (keep[0].startsWith('Astangata') ? 0.5 : 1 / 3) : 0;
    return { point: g, gross, reduction: red, net: gross * mult * (1 - red), notes: [...notes, ...keep] };
  });
  const lagnaYears = navYears(chart.ascendant.longitude);
  amsa.push({ point: 'asc', gross: lagnaYears, reduction: 0, net: lagnaYears, notes: [] });
  const methods: AyurdayaMethod[] = [
    proportional('pindayu', PINDAYU_YEARS),
    { method: 'amsayu', entries: amsa, years: amsa.reduce((a, e) => a + e.net, 0) },
    proportional('nisargayu', NISARGAYU_YEARS),
  ];
  const ys = methods.map((m) => m.years);
  return { methods, range: [Math.min(...ys), Math.max(...ys)], caveat: AYURDAYA_CAVEAT };
}
