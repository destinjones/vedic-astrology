import { PLANET_NAMES, SIGN_NAMES, type GrahaId } from '@vedic/engine';
import type { TajikaPlanet } from './constants';
import type { MuddaPeriod, Saham, Varshaphal } from './types';

/**
 * Original plain-language readings for the Tajika annual chart. They restate
 * what the classical rules (mainly Tajika Neelakanthi) say, for reflection.
 */

export type Tone = 'good' | 'mixed' | 'hard';

export interface ReadingText {
  title: string;
  tone: Tone;
  text: string[];
}

export interface VarshaphalReading {
  headline: string;
  tone: Tone;
  overview: string[];
  lagna: ReadingText;
  yearLord: ReadingText;
  muntha: ReadingText;
  /** Mudda dasha period running now, if the year contains today */
  currentMudda?: { period: MuddaPeriod; text: string };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const nm = (p: GrahaId) => PLANET_NAMES[p];

/** What the Muntha (the progressed point of focus) brings from each house of the annual chart */
export const MUNTHA_HOUSE: Record<number, string> = {
  1: 'The year centres on you. Health, confidence and personal plans are in the foreground, and the effort you put in is noticed. Start what you have been putting off.',
  2: 'Money, food and family take the focus. Savings can grow and speech carries weight, so speak with care. A good year to build reserves.',
  3: 'Courage and initiative rise. Short trips, writing, siblings and neighbours bring opportunities, and bold moves are rewarded.',
  4: 'Home and inner peace need attention. Moves, repairs or worries about a parent are common themes. Guard your rest and avoid overreaching at work.',
  5: 'Intelligence, children and creative work flourish. Study, romance and speculation are favoured, provided you keep sound judgement.',
  6: 'Health, debts and opponents come forward. Work is heavy and rivals are active, so keep routines tight, settle dues and do not provoke disputes.',
  7: 'Partnerships, marriage and dealings with the public are tested. Travel is possible, and so is friction with a spouse or business partner. Patience and fair contracts help.',
  8: 'The tradition treats this as the hardest place for the Muntha: unexpected setbacks, fatigue and anxiety. Look after your health, drive carefully and avoid risky ventures.',
  9: 'Fortune, faith and teachers support you. Long journeys, higher study and help from elders bring real progress. One of the best placements.',
  10: 'Career and status rise. Recognition, promotion or a new role are likely, and authorities look on you favourably. One of the best placements.',
  11: 'Gains and wishes are fulfilled. Income grows, friends and networks help, and long-held hopes can come through. One of the best placements.',
  12: 'Expenses, distant places and retreat. Money flows out faster, sleep can suffer, and foreign links or spiritual work are favoured over worldly ambition.',
};

/** The year lord sets the tone of the whole year */
export const YEAR_LORD_TEXT: Record<TajikaPlanet, { strong: string; weak: string }> = {
  sun: {
    strong: 'A year of authority and visibility. Government, seniors and father figures support you, health and vitality are good, and leadership roles come your way.',
    weak: 'Pride and clashes with authority are the risk. Energy dips, eyes and heart deserve care, and recognition comes late.',
  },
  moon: {
    strong: 'A year of comfort and public favour. Travel, family happiness and good relations with women and the public, with steady emotions.',
    weak: 'Moods swing and the mind is restless. Watch fluids, sleep and family worries, and avoid decisions made in a passing feeling.',
  },
  mars: {
    strong: 'A year of energy and victory. Property, competition, technical work and courage pay off, and opponents give way.',
    weak: 'Quarrels, accidents, cuts and fevers are the classic warnings. Keep your temper, take care with fire and machinery, and avoid litigation.',
  },
  mercury: {
    strong: 'A year of learning, trade and communication. Writing, commerce, calculation and clever negotiation bring gain, and friends are helpful.',
    weak: 'Nervous strain, mistakes in documents and misunderstandings. Read contracts twice and do not spread yourself too thin.',
  },
  jupiter: {
    strong: 'The best year lord in the tradition: wisdom, wealth, children, teachers and good name all grow. Religious and charitable work is fruitful.',
    weak: 'Good intentions without the means to carry them out. Watch the liver and weight, and avoid over-promising or bad advice from false teachers.',
  },
  venus: {
    strong: 'A year of pleasure, art and partnership. Marriage, vehicles, comforts and creative income flourish, and social life is warm.',
    weak: 'Indulgence and relationship strain. Spending on luxuries, quarrels with a partner and kidney or reproductive health deserve care.',
  },
  saturn: {
    strong: 'A year of slow, durable gains through discipline. Land, labour, long projects and responsibility bring lasting rewards.',
    weak: 'Delays, losses and fatigue. Bones, joints and chronic complaints need care. Persist patiently and do not cut corners.',
  },
};

/** What each Mudda dasha period tends to bring within the year */
export const MUDDA_TEXT: Record<GrahaId, string> = {
  sun: 'Attention from authorities and seniors; take the lead, but mind ego and health.',
  moon: 'Family, home and public matters; emotions run closer to the surface.',
  mars: 'Energy, property, competition; act decisively and keep tempers cool.',
  rahu: 'Ambition, unusual openings and foreign links; also confusion, so check facts.',
  jupiter: 'Growth, guidance, children and good counsel; the most supportive stretch.',
  saturn: 'Hard work, duties and delays that pay off later; rest and be patient.',
  mercury: 'Study, trade, travel and paperwork; communicate clearly.',
  ketu: 'Detachment, sudden turns and inner work; avoid rash decisions.',
  venus: 'Comforts, relationships, art and social life; enjoy without overspending.',
};

export const SAHAM_VERDICT_TEXT: Record<Saham['verdict'], string> = {
  supported: 'Its lord is strong and sees it, so this theme is well supported this year.',
  mixed: 'Support is partial, so the theme moves with effort.',
  strained: 'Its lord is weak or does not see it, so this theme needs care this year.',
};

const GRADE_WORD = { full: 'full', medium: 'medium', little: 'little', none: 'almost no' } as const;

export function readVarshaphal(v: Varshaphal, now = new Date()): VarshaphalReading {
  const tone: Tone = v.score >= 20 ? 'good' : v.score <= -20 ? 'hard' : 'mixed';
  const headline =
    v.score >= 45 ? 'A strong, rising year'
    : v.score >= 20 ? 'A supportive year'
    : v.score > -20 ? 'A mixed year that rewards effort'
    : v.score > -45 ? 'A demanding year'
    : 'A year for patience and care';

  const yl = v.yearLord;
  const strong = yl.strength >= 10;
  const others = [...new Set(v.officeBearers.filter((b) => b.strength >= 10 && b.planet !== yl.planet).map((b) => nm(b.planet)))];
  const ylText = [
    `${nm(yl.planet)} is lord of the year. ${yl.reason}`,
    strong ? YEAR_LORD_TEXT[yl.planet].strong : YEAR_LORD_TEXT[yl.planet].weak,
    `It has ${GRADE_WORD[yl.grade]} strength (${yl.strength.toFixed(1)} of 20) and stands in the ${ordinal(yl.house)} house of the annual chart${yl.retrograde ? ', retrograde' : ''}${yl.combust ? ', combust' : ''}.`
      + ([6, 8, 12].includes(yl.house) ? ' The tradition reads a year lord in the 6th, 8th or 12th as one whose promise reaches you only partly.' : ''),
  ];
  if (yl.combust) ylText.push('Being combust, close to the Sun, it delivers less than its score suggests: results come, but with tiredness or behind someone else\'s name.');
  if (!strong) ylText.push(others.length
    ? `A weak year lord gives the results of its weaker side, so lean on the stronger office-bearers: ${listJoin(others)}.`
    : 'A weak year lord gives the results of its weaker side, and no other office-bearer is strong this year, so keep plans modest.');

  const m = v.muntha;
  const mTone: Tone = m.quality === 'difficult' ? 'hard' : m.quality === 'excellent' ? 'good' : 'mixed';
  const mText = [
    `The Muntha moves one sign each birthday from your birth lagna. This year it is in ${SIGN_NAMES[m.sign - 1]}, the ${ordinal(m.house)} house of the annual chart.`,
    MUNTHA_HOUSE[m.house],
    `Its lord ${nm(m.lord)} is in the ${ordinal(m.lordHouse)} house with ${m.lordStrength.toFixed(1)} of 20 strength${m.lordStrength >= 10 ? ', which steadies the Muntha' : ', which leaves the Muntha with less backing'}.`,
  ];
  if (m.aspectedByBenefics.length) mText.push(`${m.aspectedByBenefics.map(nm).join(', ')} ${m.aspectedByBenefics.length === 1 ? 'sees' : 'see'} the Muntha, softening its effects.`);
  if (m.aspectedByMalefics.length) mText.push(`${m.aspectedByMalefics.map(nm).join(', ')} ${m.aspectedByMalefics.length === 1 ? 'sees' : 'see'} the Muntha, adding pressure to its themes.`);

  const lagnaText = [
    `The year begins with ${SIGN_NAMES[v.lagna.sign - 1]} rising, the ${ordinal(v.lagna.fromNatalLagna)} sign from your birth lagna. Its lord ${nm(v.lagna.lord)} speaks for you this year.`,
  ];
  if (v.lagna.fromNatalLagna === 8) lagnaText.push('An annual lagna that is the 8th sign from the birth lagna is a classical warning for health and setbacks, so take the year steadily.');
  if (v.lagna.fromNatalLagna === 1) lagnaText.push('The same sign rises as at birth, which the tradition takes as a year that strengthens your natural path.');
  if ([9, 10, 11].includes(v.lagna.fromNatalLagna)) lagnaText.push(`Rising from the ${ordinal(v.lagna.fromNatalLagna)} sign of your birth chart, the year leans toward ${v.lagna.fromNatalLagna === 9 ? 'fortune and guidance' : v.lagna.fromNatalLagna === 10 ? 'work and status' : 'gains and fulfilled wishes'}.`);

  const overview: string[] = [];
  const good = v.areas.filter((a) => a.verdict === 'promising').map((a) => a.name.toLowerCase());
  const slow = v.areas.filter((a) => a.verdict === 'slow').map((a) => a.name.toLowerCase());
  overview.push(`${nm(yl.planet)} rules the year and the Muntha sits in the ${ordinal(m.house)} house, ${m.quality === 'excellent' ? 'one of its best places' : m.quality === 'good' ? 'a helpful place' : 'one of its harder places'}.`);
  if (v.yogas.some((y) => y.id === 'ikkavala')) overview.push('Ikkavala yoga forms, so the planets as a whole lift the year.');
  if (v.yogas.some((y) => y.id === 'induvara')) overview.push('Induvara yoga forms, so the planets as a whole ask for patience.');
  if (good.length) overview.push(`The clearest promises this year are for ${listJoin(good)}.`);
  if (slow.length) overview.push(`Quieter this year: ${listJoin(slow)}.`);

  const t = now.getTime();
  const cur = v.mudda.find((p) => +new Date(p.start) <= t && t < +new Date(p.end));
  const sub = cur?.children?.find((p) => +new Date(p.start) <= t && t < +new Date(p.end));
  const currentMudda = cur
    ? { period: cur, text: `${nm(cur.lord)} period${sub ? `, ${nm(sub.lord)} sub-period` : ''}: ${MUDDA_TEXT[cur.lord]}` }
    : undefined;

  return {
    headline,
    tone,
    overview,
    lagna: { title: `Annual lagna in ${SIGN_NAMES[v.lagna.sign - 1]}`, tone: v.lagna.fromNatalLagna === 8 ? 'hard' : 'mixed', text: lagnaText },
    yearLord: { title: `${nm(yl.planet)} rules the year`, tone: strong && !yl.combust && ![6, 8, 12].includes(yl.house) ? 'good' : yl.strength < 5 ? 'hard' : 'mixed', text: ylText },
    muntha: { title: `Muntha in the ${ordinal(m.house)} house`, tone: mTone, text: mText },
    currentMudda,
  };
}

function listJoin(xs: string[]) {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
