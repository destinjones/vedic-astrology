/**
 * Prashna (horary): a chart cast for the moment a question is asked.
 *
 * Two methods:
 *  - time: the chart for the moment and place of the question
 *  - KP number: the querent picks a number 1–249; the ascendant is set to the
 *    start of that KP sub, cusps are cast for the instant that degree rises
 *    at the place on that day, planets stay at the moment of the question.
 *
 * The verdict follows the KP rule (the sub lord of the question's main cusp
 * must signify the houses that fulfil the matter, and not the houses that
 * deny it), checked against the ruling planets of the moment, with classical
 * Prashna signs (Moon, lagna lord, benefics and malefics) as supporting notes.
 */
import { GRAHAS, PLANET_NAMES, SIGN_LORDS } from './constants';
import type { Engine } from './engine';
import { KP_SUBS, kpChartAt, kpCusps, timeForAscendant, type KpChart, type KpOptions } from './kp';
import { dateToJd, timezoneAt } from './time';
import type { GrahaId } from './types';
import { norm360 } from './zodiac';

export type PrashnaTopic =
  | 'marriage'
  | 'relationship'
  | 'career'
  | 'business'
  | 'money'
  | 'health'
  | 'travel'
  | 'foreign'
  | 'property'
  | 'vehicle'
  | 'children'
  | 'education'
  | 'exam'
  | 'litigation'
  | 'lost_item'
  | 'general';

export interface PrashnaTopicDef {
  id: PrashnaTopic;
  label: string;
  /** Example of the question this covers */
  example: string;
  /** The cusp whose sub lord decides */
  cusp: number;
  /** Houses that fulfil the matter */
  favourable: number[];
  /** Houses that deny or spoil it */
  adverse: number[];
  /** What the favourable houses mean here, for the explanation */
  why: string;
}

/** Standard KP house groups by question (Krishnamurti, KP Readers I–VI) */
export const PRASHNA_TOPICS: PrashnaTopicDef[] = [
  { id: 'marriage', label: 'Marriage', example: 'Will I marry this person? Will my marriage happen soon?', cusp: 7, favourable: [2, 7, 11], adverse: [1, 6, 10], why: '2 is family growing, 7 the spouse, 11 the wish fulfilled; 1, 6 and 10 are the 12th from 2, 7 and 11' },
  { id: 'relationship', label: 'Love and relationship', example: 'Will this relationship work out?', cusp: 5, favourable: [5, 7, 11], adverse: [1, 6, 10, 12], why: '5 is romance, 7 partnership, 11 the wish; 6 and 12 bring separation' },
  { id: 'career', label: 'Job or promotion', example: 'Will I get this job? Will I be promoted?', cusp: 10, favourable: [2, 6, 10, 11], adverse: [1, 5, 9, 12], why: '6 is service, 10 the position, 2 and 11 income; 5, 9 and 12 are the 12th from 6, 10 and 1' },
  { id: 'business', label: 'Business or deal', example: 'Will this business or deal succeed?', cusp: 7, favourable: [2, 7, 10, 11], adverse: [5, 8, 12], why: '7 is trade and partners, 10 the enterprise, 2 and 11 profit; 5, 8 and 12 are loss' },
  { id: 'money', label: 'Money or a loan', example: 'Will I receive the money owed? Will the loan come through?', cusp: 11, favourable: [2, 6, 11], adverse: [5, 8, 12], why: '2 is wealth, 6 loans received, 11 gain; 5, 8 and 12 are the 12th from 6, 9 and 1' },
  { id: 'health', label: 'Recovery from illness', example: 'Will I recover? Will this treatment work?', cusp: 1, favourable: [1, 5, 11], adverse: [6, 8, 12], why: '1 is the body, 5 and 11 relief (12th from 6 and 12); 6, 8 and 12 are disease, crisis and hospital' },
  { id: 'travel', label: 'A journey', example: 'Will this trip happen? Will it go well?', cusp: 3, favourable: [3, 9, 12], adverse: [2, 4, 11], why: '3 is short travel, 9 long travel, 12 leaving home; 4 keeps you home' },
  { id: 'foreign', label: 'Going abroad or a visa', example: 'Will I get the visa? Will I settle abroad?', cusp: 12, favourable: [3, 9, 12], adverse: [2, 4, 11], why: '9 and 12 are foreign lands and leaving the birthplace; 4 is the home country' },
  { id: 'property', label: 'Buying property', example: 'Will I buy this house or land?', cusp: 4, favourable: [4, 11, 12], adverse: [3, 5, 10], why: '4 is land and home, 11 the gain, 12 the outlay; 3 is the 12th from 4' },
  { id: 'vehicle', label: 'Buying a vehicle', example: 'Will I get the car I want?', cusp: 4, favourable: [4, 11], adverse: [3, 8, 12], why: '4 is conveyances, 11 the wish; 3 is the 12th from 4' },
  { id: 'children', label: 'Children', example: 'Will we have a child?', cusp: 5, favourable: [2, 5, 11], adverse: [1, 4, 10], why: '5 is children, 2 the family growing, 11 the wish; 1, 4 and 10 are the 12th from 2, 5 and 11' },
  { id: 'education', label: 'Admission or study', example: 'Will I get admission? Will I finish this course?', cusp: 4, favourable: [4, 9, 11], adverse: [3, 8, 12], why: '4 is schooling, 9 higher study, 11 success; 3, 8 and 12 interrupt it' },
  { id: 'exam', label: 'Passing an exam', example: 'Will I pass this exam or test?', cusp: 6, favourable: [4, 6, 9, 11], adverse: [5, 8, 12], why: '6 is beating competitors, 4 and 9 learning, 11 success' },
  { id: 'litigation', label: 'Dispute or court case', example: 'Will I win this case or dispute?', cusp: 6, favourable: [1, 6, 11], adverse: [5, 8, 12], why: '6 is victory over opponents, 11 success, 1 yourself; 12 is loss and 8 obstacles' },
  { id: 'lost_item', label: 'A lost item', example: 'Will I find what I lost?', cusp: 11, favourable: [2, 6, 11], adverse: [5, 8, 12], why: '2 is possessions, 6 and 11 recovery; 8 and 12 mean it stays lost' },
  { id: 'general', label: 'Any wish', example: 'Will what I am hoping for happen?', cusp: 11, favourable: [2, 6, 11], adverse: [5, 8, 12], why: '11 is the fulfilment of desires, helped by 2 and 6' },
];

export interface PrashnaInput {
  /** Question moment (Date, ISO string or JD UT). Default: now */
  when?: Date | string | number;
  latitude: number;
  longitude: number;
  timezone?: string;
  topic: PrashnaTopic;
  /** The question in the querent's words (kept for the record) */
  question?: string;
  /** KP horary number 1–249. Omit for a chart of the moment */
  kpNumber?: number;
}

export interface PrashnaFactor {
  label: string;
  detail: string;
  effect: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export type PrashnaVerdict = 'yes' | 'likely_yes' | 'mixed' | 'likely_no' | 'no';

export interface PrashnaResult {
  method: 'time' | 'kp_number';
  kpNumber?: number;
  topic: PrashnaTopicDef;
  question?: string;
  chart: KpChart;
  /** JD UT for which the cusps were cast (differs from the moment in the number method) */
  cuspJdUt: number;
  subLord: GrahaId;
  subLordHouses: number[];
  /** Favourable / adverse houses the sub lord signifies, with level weight */
  hits: { house: number; kind: 'favourable' | 'adverse'; weight: number }[];
  verdict: PrashnaVerdict;
  /** −100 … +100 */
  score: number;
  summary: string;
  factors: PrashnaFactor[];
  /**
   * Planets that signify the favourable houses and are also ruling planets:
   * in KP these are the dasha / transit lords through which the matter fructifies.
   */
  fruitful: GrahaId[];
  timingNote: string;
}

const BENEFICS: GrahaId[] = ['jupiter', 'venus', 'mercury', 'moon'];
const MALEFICS: GrahaId[] = ['saturn', 'mars', 'rahu', 'ketu', 'sun'];
const KENDRA = [1, 4, 7, 10];
const TRIKONA = [1, 5, 9];
const DUSTHANA = [6, 8, 12];
const name = (g: GrahaId) => PLANET_NAMES[g];
const houseFromSign = (fromSign: number, sign: number) => ((((sign - fromSign) % 12) + 12) % 12) + 1;
const list = (hs: number[]) => (hs.length ? hs.join(', ') : 'none');

/** Weighted houses signified by a planet: level A 4, B 3, C 2, D 1, node agency 2 */
function weightedHouses(chart: KpChart, g: GrahaId) {
  const s = chart.significations[g];
  const w = new Map<number, number>();
  const add = (hs: number[], v: number) => hs.forEach((h) => w.set(h, Math.max(w.get(h) ?? 0, v)));
  add(s.levelD, 1);
  add(s.levelC, 2);
  add(s.agent, 2);
  add(s.levelB, 3);
  add(s.levelA, 4);
  return w;
}

export function castPrashna(engine: Engine, input: PrashnaInput, opts: KpOptions = {}): PrashnaResult {
  const topic = PRASHNA_TOPICS.find((t) => t.id === input.topic);
  if (!topic) throw new Error(`Unknown prashna topic "${input.topic}"`);
  const when = input.when ?? new Date();
  const jd = typeof when === 'number' ? when : dateToJd(typeof when === 'string' ? new Date(when) : when);
  if (!Number.isFinite(jd)) throw new Error('Invalid question time');
  const tz = input.timezone ?? timezoneAt(input.latitude, input.longitude);
  const ayanamsa = opts.ayanamsa ?? 'krishnamurti';
  const place = { latitude: input.latitude, longitude: input.longitude, timezone: tz };

  let cuspJd = jd;
  let method: PrashnaResult['method'] = 'time';
  let chart: KpChart;
  if (input.kpNumber !== undefined) {
    const n = Math.round(input.kpNumber);
    if (!(n >= 1 && n <= 249)) throw new Error('KP number must be between 1 and 249');
    method = 'kp_number';
    // a hair inside the sub, so floating point never lands on the previous one
    const target = norm360(KP_SUBS[n - 1].start + 1e-6);
    const t = timeForAscendant(engine, target, jd, input.latitude, input.longitude, ayanamsa);
    if (t !== null) cuspJd = t;
    const { cusps } = kpCusps(engine, cuspJd, input.latitude, input.longitude, ayanamsa);
    // the number fixes the ascendant exactly; Placidus cusps follow from that rising time
    cusps[0] = target;
    chart = kpChartAt(engine, jd, place, { ...opts, cusps });
  } else {
    chart = kpChartAt(engine, jd, place, opts);
  }

  const cusp = chart.cusps[topic.cusp - 1];
  const subLord = cusp.lords.sub;
  const w = weightedHouses(chart, subLord);
  const hits: PrashnaResult['hits'] = [];
  for (const [h, weight] of w) {
    if (topic.favourable.includes(h)) hits.push({ house: h, kind: 'favourable', weight });
    if (topic.adverse.includes(h)) hits.push({ house: h, kind: 'adverse', weight });
  }
  hits.sort((a, b) => b.weight - a.weight || a.house - b.house);

  const factors: PrashnaFactor[] = [];
  const fav = hits.filter((h) => h.kind === 'favourable');
  const adv = hits.filter((h) => h.kind === 'adverse');
  const favW = fav.reduce((s, h) => s + h.weight, 0);
  const advW = adv.reduce((s, h) => s + h.weight, 0);
  const subStar = chart.planets[subLord].lords.star;

  factors.push({
    label: `Cusp ${topic.cusp} sub lord is ${name(subLord)}`,
    detail: `${name(subLord)} signifies houses ${list(chart.significations[subLord].houses)} (through its star lord ${name(subStar)}). For this question the houses that fulfil it are ${topic.favourable.join(', ')} and the ones that deny it are ${topic.adverse.join(', ')}. It touches ${fav.length ? 'fulfilling ' + fav.map((h) => h.house).join(', ') : 'no fulfilling house'}${adv.length ? ' and denying ' + adv.map((h) => h.house).join(', ') : ''}.`,
    effect: favW > advW ? 'positive' : favW < advW ? 'negative' : 'neutral',
    weight: 50,
  });

  // the sub lord's own star lord carries the result, so check it separately
  const starW = weightedHouses(chart, subStar);
  const starFav = topic.favourable.filter((h) => starW.has(h));
  const starAdv = topic.adverse.filter((h) => starW.has(h));
  factors.push({
    label: `Its star lord ${name(subStar)}`,
    detail: `${name(subStar)} signifies ${list(chart.significations[subStar].houses)}: ${starFav.length ? 'fulfilling ' + starFav.join(', ') : 'no fulfilling house'}${starAdv.length ? ', denying ' + starAdv.join(', ') : ''}.`,
    effect: starFav.length > starAdv.length ? 'positive' : starFav.length < starAdv.length ? 'negative' : 'neutral',
    weight: 15,
  });

  if (chart.planets[subLord].retrograde || chart.planets[subStar].retrograde) {
    const who = chart.planets[subLord].retrograde ? subLord : subStar;
    factors.push({
      label: `${name(who)} is retrograde`,
      detail: 'A retrograde sub lord or star lord brings delays, second attempts or a reversal before the matter settles.',
      effect: 'negative',
      weight: 10,
    });
  }

  const rp = chart.ruling.planets;
  const inRp = rp.includes(subLord);
  factors.push({
    label: inRp ? `${name(subLord)} is a ruling planet` : 'Sub lord is not among the ruling planets',
    detail: inRp
      ? `The ruling planets of the moment (${rp.map(name).join(', ')}) include the deciding sub lord. KP takes this as the question being sincere and the chart being fit to judge.`
      : `The ruling planets of the moment are ${rp.map(name).join(', ')}. When the deciding sub lord is not among them, KP advises holding the answer more loosely.`,
    effect: inRp ? 'positive' : 'neutral',
    weight: 10,
  });

  // Classical Prashna signs on whole signs from the ascendant
  const ascSign = chart.cusps[0].sign;
  const hs = (g: GrahaId) => houseFromSign(ascSign, chart.planets[g].sign);
  const moonH = hs('moon');
  const sun = chart.planets.sun.longitude;
  const moon = chart.planets.moon.longitude;
  const waxing = norm360(moon - sun) < 180;
  factors.push({
    label: waxing ? 'Waxing Moon' : 'Waning Moon',
    detail: waxing ? 'A growing Moon supports the matter growing.' : 'A waning Moon favours endings, letting go and recovering what was lost more than new gains.',
    effect: waxing ? 'positive' : input.topic === 'lost_item' || input.topic === 'health' ? 'neutral' : 'negative',
    weight: 5,
  });
  factors.push({
    label: `Moon in the ${ordinal(moonH)} house`,
    detail: DUSTHANA.includes(moonH)
      ? 'The Moon, the mind of the question, sits in a house of difficulty.'
      : KENDRA.includes(moonH) || TRIKONA.includes(moonH)
        ? 'The Moon sits in an angle or trine, a strong place for the question.'
        : 'The Moon sits in a neutral house.',
    effect: DUSTHANA.includes(moonH) ? 'negative' : KENDRA.includes(moonH) || TRIKONA.includes(moonH) ? 'positive' : 'neutral',
    weight: 5,
  });
  const lagnaLord = SIGN_LORDS[ascSign - 1];
  const llH = hs(lagnaLord);
  factors.push({
    label: `Lagna lord ${name(lagnaLord)} in the ${ordinal(llH)} house`,
    detail: DUSTHANA.includes(llH)
      ? 'The querent’s significator is in a house of struggle, so effort meets resistance.'
      : KENDRA.includes(llH) || TRIKONA.includes(llH)
        ? 'The querent’s significator is well placed, so they have the means to get it done.'
        : 'The querent’s significator is in a neutral house.',
    effect: DUSTHANA.includes(llH) ? 'negative' : KENDRA.includes(llH) || TRIKONA.includes(llH) ? 'positive' : 'neutral',
    weight: 5,
  });
  const inLagna = GRAHAS.filter((g) => hs(g) === 1);
  const benLagna = inLagna.filter((g) => BENEFICS.includes(g));
  const malLagna = inLagna.filter((g) => MALEFICS.includes(g));
  if (benLagna.length || malLagna.length) {
    factors.push({
      label: 'Planets rising',
      detail: [
        benLagna.length ? `${benLagna.map(name).join(' and ')} in the ascendant help.` : '',
        malLagna.length ? `${malLagna.map(name).join(' and ')} in the ascendant bring worry or obstacles.` : '',
      ].filter(Boolean).join(' '),
      effect: benLagna.length > malLagna.length ? 'positive' : benLagna.length < malLagna.length ? 'negative' : 'neutral',
      weight: 5,
    });
  }
  const modality = (['movable', 'fixed', 'dual'] as const)[(ascSign - 1) % 3];
  factors.push({
    label: `${cap(modality)} sign rising`,
    detail:
      modality === 'movable'
        ? 'Movable signs show change and quick results: things move.'
        : modality === 'fixed'
          ? 'Fixed signs show things staying as they are: good for keeping, slow for change.'
          : 'Dual signs show a mixed or two-stage result, or a delay before it settles.',
    effect: 'neutral',
    weight: 0,
  });

  // Score
  let score = 0;
  const total = favW + advW;
  if (total > 0) score += ((favW - advW) / total) * 55;
  else score -= 15; // the sub lord touches none of the relevant houses
  score += starFav.length > starAdv.length ? 10 : starFav.length < starAdv.length ? -10 : 0;
  for (const f of factors.slice(2)) score += f.effect === 'positive' ? f.weight : f.effect === 'negative' ? -f.weight : 0;
  score = Math.max(-100, Math.min(100, Math.round(score)));

  const mainHouse = topic.cusp;
  const hasMain = w.has(mainHouse) && !topic.adverse.includes(mainHouse);
  let verdict: PrashnaVerdict;
  if (score >= 45 && hasMain) verdict = 'yes';
  else if (score >= 20) verdict = 'likely_yes';
  else if (score > -20) verdict = 'mixed';
  else if (score > -45) verdict = 'likely_no';
  else verdict = 'no';

  const fruitful = GRAHAS.filter((g) => {
    const wh = weightedHouses(chart, g);
    return topic.favourable.some((h) => wh.has(h)) && !topic.adverse.some((h) => (wh.get(h) ?? 0) >= 3);
  }).filter((g) => rp.includes(g));

  const verdictText: Record<PrashnaVerdict, string> = {
    yes: 'The chart promises it.',
    likely_yes: 'The chart leans towards yes.',
    mixed: 'The chart is mixed: it can happen, but not cleanly or not yet.',
    likely_no: 'The chart leans towards no.',
    no: 'The chart denies it for now.',
  };
  const summary = `${verdictText[verdict]} The ${ordinal(mainHouse)} cusp's sub lord ${name(subLord)} ${fav.length ? `connects to the fulfilling houses ${fav.map((h) => h.house).join(', ')}` : 'does not connect to the fulfilling houses'}${adv.length ? ` and to the denying houses ${adv.map((h) => h.house).join(', ')}` : ''}.`;
  const timingNote = fruitful.length
    ? `Look for it when ${fruitful.map(name).join(', ')} are active: their dasha or bhukti periods, or the Moon or Sun moving through their signs and stars. Ruling planets that are fast (Moon, then Sun) point to days and weeks; slow ones to months.`
    : 'None of the ruling planets of the moment signify the fulfilling houses cleanly, so the chart gives no clear timing.';

  return {
    method,
    kpNumber: method === 'kp_number' ? Math.round(input.kpNumber!) : undefined,
    topic,
    question: input.question,
    chart,
    cuspJdUt: cuspJd,
    subLord,
    subLordHouses: chart.significations[subLord].houses,
    hits,
    verdict,
    score,
    summary,
    factors,
    fruitful,
    timingNote,
  };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
