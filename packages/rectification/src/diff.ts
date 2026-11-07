/**
 * What changes between two candidate birth times.
 *
 * A correction of a few minutes leaves the planets where they are but moves
 * the lagna degree, can change the rising sign and its divisions, shifts every
 * dasha date through the Moon, and so changes which periods were running at
 * each life event. This lists all of that side by side, so a rectifier can see
 * what the choice actually decides.
 */
import {
  GRAHAS,
  NAKSHATRAS,
  NAKSHATRA_SPAN,
  SIGN_NAMES,
  dateToJd,
  jdToDate,
  vargaSign,
  type Engine,
  type GrahaId,
  type VargaId,
} from '@vedic/engine';
import { candidateChart, dashaChain, houseOf, vargaView, type CandidateChart, type ChartSettings, type Place } from './chart';
import { EVENT_DEFS, eventSpan, spanSamples, type LifeEvent } from './events';
import { PLANET_LABEL, WEIGHTS, dashaMatch, transitMatch, type TransitPositions } from './score';
import { shashtiamsaOf } from './shashtiamsa';

export type DiffGroup = 'Rising sign' | 'Divisional lagnas' | 'Houses' | 'Moon and dasha' | 'Life events';

export interface DiffRow {
  group: DiffGroup;
  label: string;
  a: string;
  b: string;
  changed: boolean;
  /** For life events: fit scores 0–100 at each time */
  scoreA?: number;
  scoreB?: number;
}

export interface CandidateDiff {
  a: { jd: number; utc: string };
  b: { jd: number; utc: string };
  minutes: number;
  rows: DiffRow[];
  /** Rows that differ */
  changes: number;
  summary: string;
}

const VARGAS: [VargaId, string][] = [
  ['D9', 'Navamsa (D9): marriage, dharma'],
  ['D10', 'Dasamsa (D10): career'],
  ['D7', 'Saptamsa (D7): children'],
  ['D12', 'Dwadasamsa (D12): parents'],
  ['D60', 'Shashtiamsa (D60): fine detail'],
];
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const deg = (lon: number) => { const d = lon % 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`; };
const signName = (s: number) => SIGN_NAMES[s - 1];

function moonOf(c: CandidateChart) {
  const idx = Math.min(26, Math.floor(c.lon.moon / NAKSHATRA_SPAN));
  const pada = Math.min(3, Math.floor(((c.lon.moon % NAKSHATRA_SPAN) / NAKSHATRA_SPAN) * 4)) + 1;
  return { nak: NAKSHATRAS[idx].name, pada, lord: PLANET_LABEL[NAKSHATRAS[idx].lord] };
}

/** Start of the next mahadasha after birth, as a date: the clearest single sign of how far the dasha dates moved. */
function firstChange(c: CandidateChart): Date {
  return jdToDate(c.jd + c.balanceYears * 365.2425);
}

/**
 * Compare two birth times (JD UT) at one place, optionally against life events.
 */
export function diffCandidates(
  engine: Engine,
  jdA: number,
  jdB: number,
  place: Place,
  opts: { ayanamsa?: ChartSettings['ayanamsa']; nodeType?: ChartSettings['nodeType']; events?: LifeEvent[] } = {},
): CandidateDiff {
  const settings: ChartSettings = { ayanamsa: opts.ayanamsa ?? 'lahiri', nodeType: opts.nodeType ?? 'mean' };
  const A = candidateChart(engine, jdA, place, settings);
  const B = candidateChart(engine, jdB, place, settings);
  const rows: DiffRow[] = [];
  const row = (group: DiffGroup, label: string, a: string, b: string, extra: Partial<DiffRow> = {}) =>
    rows.push({ group, label, a, b, changed: a !== b, ...extra });

  row('Rising sign', 'Lagna', signName(A.ascSign), signName(B.ascSign));
  rows.push({ group: 'Rising sign', label: 'Lagna degree', a: `${signName(A.ascSign)} ${deg(A.asc)}`, b: `${signName(B.ascSign)} ${deg(B.asc)}`, changed: Math.abs(A.asc - B.asc) >= 0.05 });
  for (const [v, label] of VARGAS) {
    if (v === 'D60') {
      const sa = shashtiamsaOf(A.asc), sb = shashtiamsaOf(B.asc);
      row('Divisional lagnas', label, `${signName(vargaSign(A.asc, v))}, ${sa.name} (${sa.nature})`, `${signName(vargaSign(B.asc, v))}, ${sb.name} (${sb.nature})`);
    } else {
      row('Divisional lagnas', label, signName(vargaSign(A.asc, v)), signName(vargaSign(B.asc, v)));
    }
  }

  // houses: whole-sign D1 placements change only with the lagna, D9 houses change with the navamsa lagna
  const d9A = vargaView(A, 'D9'), d9B = vargaView(B, 'D9');
  for (const g of GRAHAS) {
    const ha = houseOf(A, g), hb = houseOf(B, g);
    const na = ((d9A.sign[g] - d9A.lagna + 12) % 12) + 1, nb = ((d9B.sign[g] - d9B.lagna + 12) % 12) + 1;
    row('Houses', `${PLANET_LABEL[g as GrahaId]}`, `${ord(ha)} house · D9 ${ord(na)}`, `${ord(hb)} house · D9 ${ord(nb)}`);
  }

  const ma = moonOf(A), mb = moonOf(B);
  row('Moon and dasha', 'Moon nakshatra', `${ma.nak} pada ${ma.pada}`, `${mb.nak} pada ${mb.pada}`);
  row('Moon and dasha', 'Dasha at birth', `${ma.lord}, ${A.balanceYears.toFixed(2)} y left`, `${mb.lord}, ${B.balanceYears.toFixed(2)} y left`);
  const fa = firstChange(A), fb = firstChange(B);
  rows.push({
    group: 'Moon and dasha', label: 'Next mahadasha begins',
    a: fa.toISOString().slice(0, 10), b: fb.toISOString().slice(0, 10),
    changed: Math.abs(fa.getTime() - fb.getTime()) > 86_400_000,
  });
  const shiftDays = Math.round((fb.getTime() - fa.getTime()) / 86_400_000);

  // life events: the periods running and how well each time explains them
  for (const ev of opts.events ?? []) {
    if (ev.kind === 'other' || !EVENT_DEFS[ev.kind]) continue;
    const def = EVENT_DEFS[ev.kind];
    const span = eventSpan(ev);
    const levels = WEIGHTS.levels[span.precision].length;
    const samples = spanSamples(span).map((d) => {
      const jd = dateToJd(d);
      const p = engine.positionsAt(jd, settings).planets;
      const t: TransitPositions = { jupiter: p.jupiter.longitude, saturn: p.saturn.longitude, rahu: p.rahu.longitude, ketu: p.ketu.longitude, mars: p.mars.longitude };
      return { jd, t };
    });
    const best = (c: CandidateChart) => {
      let out = { v: -1, chain: [] as GrahaId[] };
      for (const s of samples) {
        const chain = dashaChain(c, s.jd, levels);
        const v = WEIGHTS.dasha * dashaMatch(c, chain, def, span.precision).value + WEIGHTS.transit * transitMatch(c, s.t, def).value;
        if (v > out.v) out = { v, chain };
      }
      return out;
    };
    const ea = best(A), eb = best(B);
    const chain = (x: GrahaId[]) => x.map((g) => PLANET_LABEL[g]).join('–');
    const date = span.precision === 'year' ? ev.date.slice(0, 4) : span.precision === 'month' ? ev.date.slice(0, 7) : ev.date;
    rows.push({
      group: 'Life events',
      label: `${def.label} (${date})`,
      a: chain(ea.chain), b: chain(eb.chain),
      changed: chain(ea.chain) !== chain(eb.chain) || Math.abs(ea.v - eb.v) >= 0.02,
      scoreA: Math.round(ea.v * 1000) / 10,
      scoreB: Math.round(eb.v * 1000) / 10,
    });
  }

  const minutes = Math.round((jdB - jdA) * 1440);
  const changes = rows.filter((r) => r.changed).length;
  const big = rows.filter((r) => r.changed && (r.label === 'Lagna' || r.label.startsWith('Navamsa'))).map((r) => r.label.split(' (')[0].toLowerCase());
  const evRows = rows.filter((r) => r.group === 'Life events');
  const better = evRows.filter((r) => (r.scoreB ?? 0) > (r.scoreA ?? 0) + 2).length;
  const worse = evRows.filter((r) => (r.scoreA ?? 0) > (r.scoreB ?? 0) + 2).length;
  const parts = [
    `${Math.abs(minutes)} minute${Math.abs(minutes) === 1 ? '' : 's'} ${minutes >= 0 ? 'later' : 'earlier'}`,
    big.length ? `changes the ${big.join(' and the ')}` : 'keeps the lagna and navamsa',
    `moves every dasha date by about ${Math.abs(shiftDays)} day${Math.abs(shiftDays) === 1 ? '' : 's'}`,
  ];
  const evText = evRows.length ? ` It explains ${better} event${better === 1 ? '' : 's'} better and ${worse} worse.` : '';
  return {
    a: { jd: jdA, utc: jdToDate(jdA).toISOString() },
    b: { jd: jdB, utc: jdToDate(jdB).toISOString() },
    minutes,
    rows,
    changes,
    summary: `${parts[0]} ${parts[1]} and ${parts[2]}.${evText}`,
  };
}
