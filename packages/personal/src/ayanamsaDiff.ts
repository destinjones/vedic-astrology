/**
 * Ayanamsa diff: the same birth moment under four ayanamsas, side by side.
 * Every sidereal longitude shifts by the same amount (the difference in
 * ayanamsa), so what matters is which placements cross a sign, nakshatra or
 * pada line, and how far the Vimshottari dasha dates move.
 */
import type { AyanamsaId, BirthInput, Chart, Engine, GrahaId } from '@vedic/engine';
import { nakshatraOf, padaOf, signOf, norm360 } from './util';

export const AYANAMSA_ORDER: AyanamsaId[] = ['lahiri', 'true_chitra', 'raman', 'krishnamurti'];
export const AYANAMSA_LABEL: Record<string, string> = {
  lahiri: 'Lahiri', true_chitra: 'True Chitra', raman: 'Raman', krishnamurti: 'Krishnamurti (KP)',
};

const BODIES: (GrahaId | 'asc')[] = ['asc', 'sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

export interface AyanamsaCell {
  longitude: number;
  sign: number;
  nakshatra: number;
  pada: number;
  navamsa: number;
  /** Signed difference from the base ayanamsa, arcminutes. */
  deltaArcmin: number;
  changes: { sign: boolean; nakshatra: boolean; pada: boolean; navamsa: boolean };
}

export interface AyanamsaRow {
  body: GrahaId | 'asc';
  cells: Record<string, AyanamsaCell>;
  /** Some ayanamsa puts this body in a different sign, nakshatra or pada than the base. */
  differs: boolean;
}

export interface AyanamsaDiff {
  base: AyanamsaId;
  ayanamsas: AyanamsaId[];
  values: Record<string, { degrees: number; deltaArcmin: number }>;
  rows: AyanamsaRow[];
  /** First mahadasha change after birth under each ayanamsa, and its shift in days from the base. */
  dasha: Record<string, { lord: GrahaId; firstChange: string; shiftDays: number }>;
  /** Plain-language summary, e.g. "Under Raman your Moon moves into Rohini". */
  notes: string[];
}

const navamsaOf = (lon: number) => (Math.floor(norm360(lon) / (30 / 9)) % 12) + 1;

const signedArcmin = (a: number, b: number) => {
  let d = norm360(a - b);
  if (d > 180) d -= 360;
  return d * 60;
};

/** Cast the chart once per ayanamsa (light options: no strength, D9 only) and compare. */
export function ayanamsaDiff(engine: Engine, input: BirthInput, base: AyanamsaId = 'lahiri', ayanamsas: AyanamsaId[] = AYANAMSA_ORDER, nodeType: 'mean' | 'true' = 'mean'): AyanamsaDiff {
  const list = ayanamsas.includes(base) ? ayanamsas : [base, ...ayanamsas];
  const charts: Record<string, Chart> = {};
  for (const a of list) charts[a] = engine.computeChart(input, { ayanamsa: a, nodeType, dashaLevels: 1, strength: false, vargas: ['D9'] });
  return diffCharts(charts, base, list);
}

/** Pure part: compare already-cast charts keyed by ayanamsa. */
export function diffCharts(charts: Record<string, Chart>, base: AyanamsaId, list: AyanamsaId[]): AyanamsaDiff {
  const lonOf = (c: Chart, b: GrahaId | 'asc') => (b === 'asc' ? c.ascendant.longitude : c.planets[b].longitude);
  const rows: AyanamsaRow[] = BODIES.map((body) => {
    const baseLon = lonOf(charts[base], body);
    const b = { sign: signOf(baseLon), nakshatra: nakshatraOf(baseLon), pada: padaOf(baseLon), navamsa: navamsaOf(baseLon) };
    const cells: Record<string, AyanamsaCell> = {};
    let differs = false;
    for (const a of list) {
      const lon = lonOf(charts[a], body);
      const cell = { sign: signOf(lon), nakshatra: nakshatraOf(lon), pada: padaOf(lon), navamsa: navamsaOf(lon) };
      const changes = { sign: cell.sign !== b.sign, nakshatra: cell.nakshatra !== b.nakshatra, pada: cell.pada !== b.pada || cell.nakshatra !== b.nakshatra, navamsa: cell.navamsa !== b.navamsa };
      if (changes.sign || changes.nakshatra || changes.pada) differs = true;
      cells[a] = { longitude: lon, ...cell, deltaArcmin: signedArcmin(lon, baseLon), changes };
    }
    return { body, cells, differs };
  });
  const values: AyanamsaDiff['values'] = {};
  for (const a of list) values[a] = { degrees: charts[a].meta.ayanamsaValue, deltaArcmin: (charts[a].meta.ayanamsaValue - charts[base].meta.ayanamsaValue) * 60 };

  const firstChange = (c: Chart) => c.dasha.periods.find((p) => new Date(p.start).getTime() > new Date(c.meta.utc).getTime()) ?? c.dasha.periods[0];
  const baseChange = new Date(firstChange(charts[base]).start).getTime();
  const dasha: AyanamsaDiff['dasha'] = {};
  for (const a of list) {
    const fc = firstChange(charts[a]);
    dasha[a] = { lord: charts[a].dasha.startLord, firstChange: fc.start, shiftDays: Math.round((new Date(fc.start).getTime() - baseChange) / 86_400_000) };
  }

  const NAMES: Record<string, string> = { asc: 'ascendant', sun: 'Sun', moon: 'Moon', mars: 'Mars', mercury: 'Mercury', jupiter: 'Jupiter', venus: 'Venus', saturn: 'Saturn', rahu: 'Rahu', ketu: 'Ketu' };
  const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  const notes: string[] = [];
  for (const r of rows) {
    for (const a of list) {
      if (a === base) continue;
      const c = r.cells[a];
      if (c.changes.sign) notes.push(`Under ${AYANAMSA_LABEL[a]} your ${NAMES[r.body]} moves to ${SIGNS[c.sign - 1]}.`);
      else if (c.changes.nakshatra) notes.push(`Under ${AYANAMSA_LABEL[a]} your ${NAMES[r.body]} moves into another nakshatra.`);
    }
  }
  for (const a of list) {
    if (a !== base && dasha[a].lord !== dasha[base].lord) notes.push(`Under ${AYANAMSA_LABEL[a]} your life starts in a different mahadasha (${NAMES[dasha[a].lord]}).`);
  }
  if (!notes.length) notes.push('Every placement keeps its sign and nakshatra under all four ayanamsas. Your chart is robust to this choice.');
  return { base, ayanamsas: list, values, rows, dasha, notes };
}
