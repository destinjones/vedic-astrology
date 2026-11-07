import { addSigns, houseFrom, signOf, vargaSign, type Chart, type GrahaId, type SignNumber } from '@vedic/engine';
import {
  NAME,
  arudhaPadas,
  charaDasha,
  charaDashaAt,
  charaKarakas,
  grahasAspecting,
  grahasIn,
  inputFromChart,
  jaiminiLord,
  karakamsa,
  rashiAspects,
  signName,
  type JaiminiInput,
} from './core';
import { AL_HOUSE, AMATYAKARAKA, ATMAKARAKA, DARAKARAKA, MALEFICS, SIGN_DESIRE, houseTheme, toneFromGrahas } from './readings';
import type { ArudhaPada, CharaDasha, CharaDashaPeriod, CharaKaraka, JaiminiOptions, JaiminiReading, KarakaScheme } from './types';

export interface JaiminiChart {
  scheme: KarakaScheme;
  ascendantSign: SignNumber;
  karakas: CharaKaraka[];
  /** Navamsa sign of the Atmakaraka */
  karakamsa: SignNumber;
  /** House of the Karakamsa sign counted from the birth lagna */
  karakamsaHouse: number;
  arudhas: ArudhaPada[];
  arudhaLagna: ArudhaPada;
  upapada: ArudhaPada;
  /** Sign -> the signs it aspects by rashi drishti */
  rashiDrishti: Record<SignNumber, SignNumber[]>;
  /** Graha -> the signs it aspects by rashi drishti */
  grahaDrishti: Record<GrahaId, SignNumber[]>;
  charaDasha: CharaDasha;
  readings: {
    atmakaraka: JaiminiReading;
    amatyakaraka: JaiminiReading;
    darakaraka: JaiminiReading;
    karakamsa: JaiminiReading;
    arudhaLagna: JaiminiReading;
    upapada: JaiminiReading;
  };
  /** The input the calculations used, kept for follow-up queries */
  input: JaiminiInput;
}

const listText = (n: string[]) => (n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`);
const list = (gs: GrahaId[]) => listText(gs.map((g) => NAME.planet[g]));
/** Verb agreeing with a list of grahas: v(gs, 'sit', 'sits') */
const v = (gs: unknown[], plural: string, single: string) => (gs.length > 1 ? plural : single);
const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;

const SIGNS = Array.from({ length: 12 }, (_, i) => (i + 1) as SignNumber);
const GRAHAS: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];

/** Full Jaimini layer for an engine chart (or a bare JaiminiInput). */
export function jaimini(source: Chart | JaiminiInput, opts: JaiminiOptions = {}): JaiminiChart {
  const input = 'meta' in source ? inputFromChart(source) : source;
  const scheme = opts.karakaScheme ?? 8;
  const karakas = charaKarakas(input, scheme);
  const ak = karakas[0];
  const kms = karakamsa(input, ak.planet);
  const arudhas = arudhaPadas(input);
  const al = arudhas[0];
  const ul = arudhas[11];
  const rashiDrishti = Object.fromEntries(SIGNS.map((s) => [s, rashiAspects(s)])) as Record<SignNumber, SignNumber[]>;
  const grahaDrishti = Object.fromEntries(GRAHAS.map((g) => [g, rashiAspects(signOf(input.planets[g]))])) as Record<GrahaId, SignNumber[]>;
  const dasha = charaDasha(input, opts);
  const byId = (id: string) => karakas.find((k) => k.id === id)!;

  return {
    scheme,
    ascendantSign: input.ascendantSign,
    karakas,
    karakamsa: kms,
    karakamsaHouse: houseFrom(input.ascendantSign, kms),
    arudhas,
    arudhaLagna: al,
    upapada: ul,
    rashiDrishti,
    grahaDrishti,
    charaDasha: dasha,
    readings: {
      atmakaraka: atmakarakaReading(ak, karakas[1]),
      amatyakaraka: roleReading(byId('AmK'), AMATYAKARAKA, 'Career and counsel'),
      darakaraka: roleReading(byId('DK'), DARAKARAKA, 'Spouse and partners'),
      karakamsa: karakamsaReading(input, ak, kms),
      arudhaLagna: alReading(input, al),
      upapada: ulReading(input, ul),
    },
    input,
  };
}

function atmakarakaReading(ak: CharaKaraka, next: CharaKaraka): JaiminiReading {
  const t = ATMAKARAKA[ak.planet as keyof typeof ATMAKARAKA];
  const detail = [t.detail, `It sits in ${signName(ak.sign)}, your ${ord(ak.house)} house, so the lesson plays out through ${houseTheme(ak.house)}.`];
  if (ak.margin < 1) detail.push(`${NAME.planet[next.planet]} is less than a degree behind (${ak.margin.toFixed(2)}°), so an error of a few minutes in the birth time could swap these two. Read both if the time is uncertain.`);
  return {
    id: `jaimini.ak.${ak.planet}`,
    title: `Atmakaraka: ${NAME.planet[ak.planet]}`,
    summary: t.summary,
    detail,
    strengths: t.strengths,
    challenges: t.challenges,
    keywords: t.keywords,
    tone: 'mixed',
    score: 0,
  };
}

function roleReading(k: CharaKaraka, table: Record<string, string>, label: string): JaiminiReading {
  return {
    id: `jaimini.${k.id.toLowerCase()}.${k.planet}`,
    title: `${k.name}: ${NAME.planet[k.planet]}`,
    summary: table[k.planet],
    detail: [`${label} are read from ${NAME.planet[k.planet]}, the planet at ${k.degree.toFixed(2)}° in its sign. It sits in ${signName(k.sign)}, your ${ord(k.house)} house, which ties the theme to ${houseTheme(k.house)}.`],
    strengths: [],
    challenges: [],
    keywords: [k.name.toLowerCase(), NAME.planet[k.planet].toLowerCase()],
    tone: 'mixed',
    score: 0,
  };
}

function karakamsaReading(input: JaiminiInput, ak: CharaKaraka, kms: SignNumber): JaiminiReading {
  const inD9 = GRAHAS.filter((g) => vargaSign(input.planets[g], 9) === kms && g !== ak.planet);
  const twelfth = addSigns(kms, 11);
  const in12 = GRAHAS.filter((g) => vargaSign(input.planets[g], 9) === twelfth);
  const detail = [
    `The Karakamsa is the navamsa sign of your Atmakaraka, ${NAME.planet[ak.planet]}. It shows what the soul most wants from this life. Here that is ${signName(kms)}, a sign that seeks ${SIGN_DESIRE[kms - 1]}.`,
    `${signName(kms)} is your ${ord(houseFrom(input.ascendantSign, kms))} house in the birth chart, so these wishes find an outlet through ${houseTheme(houseFrom(input.ascendantSign, kms))}.`,
  ];
  if (inD9.length) detail.push(`${list(inD9)} ${v(inD9, 'join', 'joins')} the Atmakaraka in this navamsa sign and colour its aims.`);
  detail.push(in12.length
    ? `The 12th from the Karakamsa, read for spiritual leaning and the form of the divine you are drawn to, holds ${list(in12)}.`
    : `The 12th from the Karakamsa, read for spiritual leaning, is empty in the navamsa, so its lord ${NAME.planet[jaiminiLord(input, twelfth).lord]} speaks for it.`);
  const { tone, score } = toneFromGrahas(inD9);
  return {
    id: `jaimini.karakamsa.${kms}`,
    title: `Karakamsa in ${signName(kms)}`,
    summary: `Your soul’s deepest aim leans toward ${SIGN_DESIRE[kms - 1]}.`,
    detail,
    strengths: [],
    challenges: [],
    keywords: ['karakamsa', 'swamsha', signName(kms).toLowerCase()],
    tone,
    score,
  };
}

function alReading(input: JaiminiInput, al: ArudhaPada): JaiminiReading {
  const inAl = grahasIn(input, al.sign);
  const gains = grahasIn(input, addSigns(al.sign, 10));
  const losses = grahasIn(input, addSigns(al.sign, 11));
  const detail = [
    `The Arudha Lagna is the reflection of your lagna in the world: the image people form of you, which can differ from who you are inside. Yours falls in ${signName(al.sign)}, your ${ord(al.house)} house.`,
    AL_HOUSE[al.house - 1],
  ];
  if (inAl.length) detail.push(`${list(inAl)} ${v(inAl, 'sit', 'sits')} on the Arudha Lagna and ${v(inAl, 'become', 'becomes')} part of how you are seen.`);
  if (gains.length) detail.push(`${list(gains)} in the 11th from it ${v(gains, 'bring', 'brings')} income and support to your public standing.`);
  else detail.push('The 11th from it is empty, so gains to your image come mainly through its lord and through effort.');
  if (losses.length) detail.push(`${list(losses)} in the 12th from it ${v(losses, 'show', 'shows')} where your image spends or leaks resources.`);
  const strengths = gains.length ? ['Planets in the 11th from the Arudha Lagna support earnings and reputation'] : [];
  const challenges = losses.some((g) => MALEFICS.includes(g)) ? ['Malefics in the 12th from the Arudha Lagna can drain money or reputation'] : [];
  const { tone, score } = toneFromGrahas([...inAl, ...gains]);
  return {
    id: `jaimini.al.${al.sign}`,
    title: `Arudha Lagna in ${signName(al.sign)} (house ${al.house})`,
    summary: AL_HOUSE[al.house - 1].split('. ')[0] + '.',
    detail,
    strengths,
    challenges,
    keywords: ['arudha lagna', 'image', 'reputation'],
    tone,
    score,
  };
}

function ulReading(input: JaiminiInput, ul: ArudhaPada): JaiminiReading {
  const inUl = grahasIn(input, ul.sign);
  const second = addSigns(ul.sign, 1);
  const in2 = grahasIn(input, second);
  const lord = jaiminiLord(input, ul.sign).lord;
  const detail = [
    `The Upapada is the arudha of the 12th house and shows marriage as it actually unfolds: the spouse, the family you marry into and how the bond is seen. Yours is in ${signName(ul.sign)}, your ${ord(ul.house)} house, a sign that seeks ${SIGN_DESIRE[ul.sign - 1]}.`,
    `Its lord ${NAME.planet[lord]} sits in ${signName(signOf(input.planets[lord]))}, which adds its own flavour to the partner.`,
  ];
  if (inUl.length) detail.push(`${list(inUl)} on the Upapada ${v(inUl, 'describe', 'describes')} the spouse or the circumstances of marriage.`);
  if (in2.length) {
    const mal = in2.filter((g) => MALEFICS.includes(g));
    detail.push(mal.length
      ? `${list(in2)} in the 2nd from the Upapada ${v(in2, 'test', 'tests')} how long the marriage is sustained. Malefics there call for patience and care to keep the bond.`
      : `${list(in2)} in the 2nd from the Upapada ${v(in2, 'help', 'helps')} sustain the marriage over time.`);
  } else {
    detail.push('The 2nd from the Upapada, which shows how the marriage is sustained, is empty, so its lord carries that story.');
  }
  const { tone, score } = toneFromGrahas([...inUl, ...in2]);
  return {
    id: `jaimini.ul.${ul.sign}`,
    title: `Upapada in ${signName(ul.sign)} (house ${ul.house})`,
    summary: `Marriage is coloured by ${signName(ul.sign)}: a wish for ${SIGN_DESIRE[ul.sign - 1]}.`,
    detail,
    strengths: in2.filter((g) => !MALEFICS.includes(g)).length ? ['Benefics in the 2nd from the Upapada support a lasting marriage'] : [],
    challenges: in2.filter((g) => MALEFICS.includes(g)).length ? ['Malefics in the 2nd from the Upapada can strain the marriage'] : [],
    keywords: ['upapada', 'marriage', 'spouse'],
    tone,
    score,
  };
}

/** Reading for a chara dasha sign (mahadasha or antardasha). */
export function charaDashaReading(j: JaiminiChart, period: CharaDashaPeriod | SignNumber): JaiminiReading {
  const sign = typeof period === 'number' ? period : period.sign;
  const input = j.input;
  const house = houseFrom(j.ascendantSign, sign);
  const occupants = grahasIn(input, sign);
  const aspecting = grahasAspecting(input, sign).filter((g) => !occupants.includes(g));
  const karakasIn = j.karakas.filter((k) => k.sign === sign);
  const karakasAsp = j.karakas.filter((k) => aspecting.includes(k.planet));
  const padas = j.arudhas.filter((a) => a.sign === sign);
  const yrs = j.charaDasha.yearsBySign.find((y) => y.sign === sign)!;

  const detail = [
    `${signName(sign)} is your ${ord(house)} house, so this period brings ${houseTheme(house)} to the front. The sign itself seeks ${SIGN_DESIRE[sign - 1]}.`,
  ];
  if (occupants.length) detail.push(`${list(occupants)} ${occupants.length > 1 ? 'occupy' : 'occupies'} the sign and shape what the period delivers.`);
  if (karakasIn.length) detail.push(`It holds your ${listText(karakasIn.map((k) => `${k.name} (${k.signifies})`))}, so ${karakasIn.length > 1 ? 'those matters are' : 'that matter is'} active.`);
  if (karakasAsp.length) detail.push(`By sign aspect it is seen by your ${karakasAsp.map((k) => `${k.name}, ${NAME.planet[k.planet]}`).join('; ')}.`);
  if (padas.length) {
    const what = padas.some((p) => p.id === 'AL') ? 'your public image comes' : padas.length > 1 ? 'those areas come' : 'that area comes';
    detail.push(`The ${listText(padas.map((p) => `${p.name} (${p.id})`))} ${padas.length > 1 ? 'fall' : 'falls'} here, so ${what} into view.`);
  }
  const adj = yrs.adjustment ? ` (${yrs.adjustment > 0 ? 'one added for an exalted lord' : 'one taken away for a debilitated lord'})` : '';
  detail.push(yrs.count === 1
    ? `Its lord ${NAME.planet[yrs.lord]} sits in the sign itself, which gives the full 12 years in the first cycle.`
    : `Its lord ${NAME.planet[yrs.lord]} is ${yrs.count} signs away counting ${yrs.direction}, which gives ${yrs.years} years in the first cycle${adj}.`);
  const { tone, score } = toneFromGrahas([...occupants, ...aspecting.filter((g) => g !== 'rahu' && g !== 'ketu')]);
  const ak = j.karakas[0];
  const strengths: string[] = [];
  const challenges: string[] = [];
  if (karakasIn.some((k) => k.id === 'AK') || karakasAsp.some((k) => k.id === 'AK')) strengths.push('The Atmakaraka is involved, so this period matters for the soul’s purpose');
  if (karakasIn.some((k) => k.id === 'AmK') || karakasAsp.some((k) => k.id === 'AmK')) strengths.push('The Amatyakaraka is involved, which favours career steps');
  if (karakasIn.some((k) => k.id === 'DK') || karakasAsp.some((k) => k.id === 'DK')) strengths.push('The Darakaraka is involved, which can bring partnership or marriage');
  if (karakasIn.some((k) => k.id === 'GK')) challenges.push('The Gnatikaraka sits here, so rivals, health or debts need watching');
  if ([6, 8, 12].includes(house)) challenges.push(`The ${ord(house)} house is a hard house, so expect effort before reward`);
  return {
    id: `jaimini.chara.${sign}`,
    title: `${signName(sign)} dasha · house ${house}`,
    summary: `A period about ${houseTheme(house)}${ak.sign === sign ? ', with your Atmakaraka in the sign' : ''}.`,
    detail,
    strengths,
    challenges,
    keywords: ['chara dasha', signName(sign).toLowerCase()],
    tone,
    score,
  };
}

export { charaDashaAt };
