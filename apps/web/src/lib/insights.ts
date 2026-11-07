import type { Chart, PlanetId } from '../types/chart';
import { HOUSES, NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { aspectedHouses, dignityOf, housesRuledBy, ordinal } from './astro';

/**
 * Local fallback readings. Shaped like the interpretations package's
 * Reading so the panels can switch to it without changes.
 */
export interface Reading {
  id: string;
  title: string;
  summary: string;
  detail: string[];
  strengths: string[];
  challenges: string[];
  keywords: string[];
  tone: 'benefic' | 'mixed' | 'challenging';
  score: number;
}

const DIGNITY_SCORE = { Exalted: 3, Moolatrikona: 2, 'Own sign': 2, Friendly: 1, Neutral: 0, Enemy: -1, Debilitated: -2 } as const;

export function planetReading(chart: Chart, id: PlanetId): Reading {
  const p = chart.planets.find((x) => x.id === id)!;
  const info = PLANET_BY_ID[id];
  const sign = signInfo(p.sign);
  const house = HOUSES[p.house - 1];
  const nak = NAKSHATRAS[p.nakshatra - 1];
  const dig = dignityOf(id, p.sign);
  const rules = housesRuledBy(id, chart.ascendant.sign);
  const aspects = aspectedHouses(id, p.house);

  let score: number = DIGNITY_SCORE[dig];
  if ([6, 8, 12].includes(p.house)) score -= 1;
  if ([1, 4, 5, 7, 9, 10].includes(p.house)) score += 1;
  if (p.combust) score -= 1;
  score = Math.max(-3, Math.min(3, score));
  const tone: Reading['tone'] = score >= 1 ? 'benefic' : score <= -1 ? 'challenging' : 'mixed';

  const strengths: string[] = [];
  const challenges: string[] = [];
  if (['Exalted', 'Moolatrikona', 'Own sign'].includes(dig)) strengths.push(`${dig} in ${sign.name}: ${info.name} expresses its significations with confidence.`);
  if (dig === 'Friendly') strengths.push(`In a friend's sign, ${info.name} is comfortable and cooperative.`);
  if (dig === 'Debilitated') challenges.push(`Debilitated in ${sign.name}: ${info.name}'s themes need conscious effort. Check the D9 and sign lord for cancellation (neecha bhanga).`);
  if (dig === 'Enemy') challenges.push(`In an enemy's sign, ${info.name} works under some friction.`);
  if (house.kind.includes('Kendra')) strengths.push(`Angular (kendra) placement in the ${ordinal(p.house)} house gives visible, active results.`);
  if (house.kind.includes('Trikona')) strengths.push(`Trine (trikona) placement in the ${ordinal(p.house)} house links ${info.name} to fortune and merit.`);
  if (house.kind.includes('Dusthana')) challenges.push(`The ${ordinal(p.house)} house is a dusthana; results come through struggle, research or release.`);
  if (house.kind.includes('Upachaya') && info.nature === 'malefic') strengths.push(`Malefics improve with time in upachaya houses like the ${ordinal(p.house)}.`);
  if (p.retrograde && id !== 'rahu' && id !== 'ketu') challenges.push(`Retrograde: ${info.name}'s energy turns inward, revisits the past and often matures later in life.`);
  if (p.combust) challenges.push(`Combust (too close to the Sun): ${info.name}'s independent voice is overshadowed by ego or authority.`);

  const ruleText = rules.length
    ? `As lord of the ${rules.map(ordinal).join(' and ')} house${rules.length > 1 ? 's' : ''}, it carries those matters into the ${ordinal(p.house)}.`
    : `As a shadow planet it takes on the qualities of its sign lord, ${PLANET_BY_ID[sign.lord].name}.`;

  return {
    id: `planet-${id}`,
    title: `${info.name} in ${sign.name}, ${ordinal(p.house)} house`,
    summary: `${info.name} (${info.karaka.toLowerCase()}) sits in ${sign.name} in the ${ordinal(p.house)} house of ${house.name.toLowerCase()}, in ${nak.name} nakshatra.`,
    detail: [
      `${info.name} in ${sign.name} (${sign.element.toLowerCase()}, ${sign.modality.toLowerCase()}) colours its significations with ${sign.name}'s style. ${ruleText}`,
      `The ${ordinal(p.house)} house governs ${house.themes.toLowerCase()}. ${info.name} here makes these areas a focus of ${info.karaka.split(',')[0].toLowerCase()}.`,
      `${nak.name} (pada ${p.pada}), ruled by ${PLANET_BY_ID[nak.lord].name} with deity ${nak.deity}, adds the theme of ${nak.theme.toLowerCase()}.`,
      `It aspects the ${aspects.map(ordinal).join(', ')} house${aspects.length > 1 ? 's' : ''}.`,
    ],
    strengths,
    challenges,
    keywords: info.karaka.split(', '),
    tone,
    score,
  };
}
