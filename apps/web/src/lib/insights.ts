import type { Chart, PlanetId } from '../types/chart';
import { HOUSES, NAKSHATRAS, PLANET_BY_ID, signInfo } from '../data/constants';
import { aspectedHouses, DIGNITY_KEY, dignityOf, housesRuledBy } from './astro';
import type { I18n } from '../i18n';

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

export function planetReading(chart: Chart, id: PlanetId, i18n: I18n): Reading {
  const { t, tp, v, tl, list } = i18n;
  const ord = v.ordinal;
  const karakas = tl<Record<PlanetId, string>>('data.karaka');
  const themes = tl<string[]>('data.houseThemes');
  const p = chart.planets.find((x) => x.id === id)!;
  const info = PLANET_BY_ID[id];
  const sign = signInfo(p.sign);
  const house = HOUSES[p.house - 1];
  const nak = NAKSHATRAS[p.nakshatra - 1];
  const dig = dignityOf(id, p.sign);
  const rules = housesRuledBy(id, chart.ascendant.sign);
  const aspects = aspectedHouses(id, p.house);
  const planet = v.planets[id].name;
  const signName = v.signs[p.sign - 1];
  const karaka = karakas[id];

  let score: number = DIGNITY_SCORE[dig];
  if ([6, 8, 12].includes(p.house)) score -= 1;
  if ([1, 4, 5, 7, 9, 10].includes(p.house)) score += 1;
  if (p.combust) score -= 1;
  score = Math.max(-3, Math.min(3, score));
  const tone: Reading['tone'] = score >= 1 ? 'benefic' : score <= -1 ? 'challenging' : 'mixed';

  const strengths: string[] = [];
  const challenges: string[] = [];
  const o = ord(p.house);
  if (['Exalted', 'Moolatrikona', 'Own sign'].includes(dig)) strengths.push(t('quick.strongDignity', { dignity: v.dignity[DIGNITY_KEY[dig]], sign: signName, planet }));
  if (dig === 'Friendly') strengths.push(t('quick.friendly', { planet }));
  if (dig === 'Debilitated') challenges.push(t('quick.debilitated', { sign: signName, planet }));
  if (dig === 'Enemy') challenges.push(t('quick.enemy', { planet }));
  if (house.kind.includes('Kendra')) strengths.push(t('quick.kendra', { ord: o }));
  if (house.kind.includes('Trikona')) strengths.push(t('quick.trikona', { ord: o, planet }));
  if (house.kind.includes('Dusthana')) challenges.push(t('quick.dusthana', { ord: o }));
  if (house.kind.includes('Upachaya') && info.nature === 'malefic') strengths.push(t('quick.upachaya', { ord: o }));
  if (p.retrograde && id !== 'rahu' && id !== 'ketu') challenges.push(t('quick.retro', { planet }));
  if (p.combust) challenges.push(t('quick.combust', { planet }));

  const ruleText = rules.length
    ? tp('quick.rules', rules.length, { houses: list(rules.map(ord)), ord: o })
    : t('quick.shadow', { lord: v.planets[sign.lord].name });
  const element = v.element[sign.element.toLowerCase() as keyof typeof v.element];
  const modality = v.modality[sign.modality.toLowerCase() as keyof typeof v.modality];

  return {
    id: `planet-${id}`,
    title: t('quick.title', { planet, sign: signName, ord: o }),
    summary: t('quick.summary', { planet, karaka: karaka.toLowerCase(), sign: signName, ord: o, house: v.houses[p.house - 1].toLowerCase(), nakshatra: v.nakshatras[nak.num - 1] }),
    detail: [
      t('quick.signStyle', { planet, sign: signName, element: element.toLowerCase(), modality: modality.toLowerCase(), rules: ruleText }),
      t('quick.houseFocus', { ord: o, themes: themes[p.house - 1].toLowerCase(), planet, karaka: karaka.split(/[,،、]/)[0].toLowerCase() }),
      t('quick.nakshatra', { nakshatra: v.nakshatras[nak.num - 1], pada: p.pada, lord: v.planets[nak.lord].name, deity: tl<string[]>('data.nakDeity')[nak.num - 1], theme: tl<string[]>('data.nakTheme')[nak.num - 1].toLowerCase() }),
      tp('quick.aspects', aspects.length, { houses: list(aspects.map(ord)) }),
    ],
    strengths,
    challenges,
    keywords: karaka.split(/,\s*/),
    tone,
    score,
  };
}
