/** The guided walkthrough used by present mode. */
import type { Chart, DashaPeriod, PlanetId, VargaId } from '../types/chart';
import type { Selection } from '../types/ui';
import { HOUSES, NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import type { Knowledge } from './readings';

export interface Step {
  title: string;
  text: string;
  /** CSS selector of the card to bring on screen */
  target: string;
  select?: Selection;
  varga?: VargaId;
}

const ORDER: PlanetId[] = ['sun', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
const fmtMonth = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

const running = (list: DashaPeriod[] | undefined, at: number) =>
  list?.find((p) => Date.parse(p.start) <= at && at < Date.parse(p.end));

/** The walkthrough an astrologer steps through with a client, built from this chart. */
export function buildSteps(chart: Chart, knowledge: Knowledge | null, hasTiming: boolean): Step[] {
  const who = chart.input.name?.trim();
  const asc = signInfo(chart.ascendant.sign);
  const ascNak = NAKSHATRAS[chart.ascendant.nakshatra - 1];
  const lagnaLord = chart.planets.find((p) => p.id === asc.lord);
  const steps: Step[] = [
    {
      title: who ? `${who}'s birth chart` : 'The birth chart',
      text: `Born ${chart.input.date} at ${chart.input.time.slice(0, 5)} in ${chart.input.place}. We will walk through the rising sign, the Moon, each planet, then the yogas, the dashas and the timing ahead.`,
      target: '.summary-strip',
      select: { kind: 'asc' },
    },
    {
      title: `Lagna: ${asc.name} rising`,
      text: `${asc.name} (${asc.sanskrit}) was rising at ${chart.ascendant.degreeInSign.toFixed(1)}°, in ${ascNak.name} nakshatra pada ${chart.ascendant.pada}. The lagna sets the body, temperament and the order of every house. Its lord ${PLANET_BY_ID[asc.lord].name}${lagnaLord ? ` sits in the ${ordinal(lagnaLord.house)} house` : ''}.`,
      target: '.explorer-grid',
      select: { kind: 'asc' },
    },
  ];

  const planetStep = (id: PlanetId): Step | null => {
    const p = chart.planets.find((x) => x.id === id);
    if (!p) return null;
    const info = PLANET_BY_ID[id];
    const sign = signInfo(p.sign);
    const nak = NAKSHATRAS[p.nakshatra - 1];
    const house = HOUSES[p.house - 1];
    const flags = [p.retrograde && id !== 'rahu' && id !== 'ketu' ? 'retrograde' : '', p.combust ? 'combust (close to the Sun)' : ''].filter(Boolean);
    const dignity = info.exalted === p.sign ? ' It is exalted here.' : info.debilitated === p.sign ? ' It is debilitated here.' : info.own.includes(p.sign) ? ' It is in its own sign.' : '';
    return {
      title: id === 'moon' ? `Moon in ${sign.name}: the mind` : `${info.name} (${info.sanskrit}) in ${sign.name}`,
      text: `${info.name} sits in ${sign.name} in the ${ordinal(p.house)} house${house ? ` (${house.themes})` : ''}, in ${nak.name} nakshatra pada ${p.pada}${flags.length ? `, ${flags.join(' and ')}` : ''}.${dignity} It signifies ${info.karaka.charAt(0).toLowerCase()}${info.karaka.slice(1)}.`,
      target: '.explorer-grid',
      select: { kind: 'planet', id },
    };
  };

  const moon = planetStep('moon');
  if (moon) {
    const m = chart.planets.find((x) => x.id === 'moon')!;
    const nak = NAKSHATRAS[m.nakshatra - 1];
    steps.push(moon, {
      title: `Janma nakshatra: ${nak.name}`,
      text: `The Moon's nakshatra is ${nak.name}, ruled by ${PLANET_BY_ID[nak.lord].name}, with ${nak.deity} as its deity and ${nak.symbol.toLowerCase()} as its symbol. Its theme is ${nak.theme.toLowerCase()}. It also starts the dasha sequence.`,
      target: '.wheel-card',
      select: { kind: 'nakshatra', num: m.nakshatra },
    });
  }
  for (const id of ORDER) { const s = planetStep(id); if (s) steps.push(s); }

  steps.push({
    title: 'Navamsha (D9)',
    text: 'The ninth division shows the inner strength of each planet, dharma and partnership. A planet strong in both the rashi and the navamsha delivers more fully.',
    target: '.chart-card',
    select: { kind: 'asc' },
    varga: 'D9',
  });

  if (knowledge) {
    const y = knowledge.report.yogas;
    const d = knowledge.report.doshas.filter((x) => x.present);
    steps.push({
      title: 'Yogas and doshas',
      text: `${y.length} yoga${y.length === 1 ? '' : 's'} form in this chart${y.length ? `, including ${y.slice(0, 3).map((x) => x.name).join(', ')}` : ''}. ${d.length ? `Doshas to note: ${d.map((x) => x.name).join(', ')}.` : 'None of the doshas checked are present.'}`,
      target: '#yogas',
    });
  }

  steps.push({ title: 'The sky at birth', text: 'The same placements in three dimensions, set by sidereal longitude around the Earth.', target: '.sky-card' });

  if (chart.dasha?.length) {
    const now = Date.now();
    const maha = running(chart.dasha, now);
    const antar = running(maha?.sub, now);
    steps.push({
      title: 'Vimshottari dasha',
      text: maha
        ? `Now running ${PLANET_BY_ID[maha.lord].name} mahadasha (${fmtMonth(maha.start)} to ${fmtMonth(maha.end)})${antar ? `, with the ${PLANET_BY_ID[antar.lord].name} sub-period until ${fmtMonth(antar.end)}` : ''}. Each period brings forward what its planet promises in the chart.`
        : 'The planetary periods across the life, each bringing forward what its planet promises in the chart.',
      target: '#dasha',
    });
  }
  if (hasTiming) {
    steps.push({ title: 'Good times and hard times', text: 'Transits, dashas and retrogrades scored together, so you can see the supportive and testing stretches ahead and why.', target: '#timing' });
  }
  return steps;
}
