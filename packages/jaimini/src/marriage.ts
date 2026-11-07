/**
 * The marriage half of Jaimini: Upapada (UL), the 2nd from it, the
 * Darakaraka and the 7th from Karakamsa, for one chart and for a couple.
 *
 * Upapada, the arudha of the 12th house, is the image of the marriage
 * itself. The 2nd from Upapada shows what sustains the marriage: benefics
 * there or aspecting it by rashi drishti keep it going, malefics with no
 * benefic help strain or end it (Jaimini Sutras 1.4; BPHS, Upapada
 * adhyaya). The 7th from Karakamsa, read in the navamsa, shows the spouse the
 * soul seeks.
 *
 * Between two charts, the traditional cross-check is whether one person's
 * lagna or Moon sign falls on the other's Upapada, its 7th, the Darakaraka's
 * sign or the 7th from Karakamsa, and how the two Upapadas sit from each
 * other. These are links the tradition looks for, not a score; the text says
 * what each one means.
 */
import { addSigns, houseFrom, signOf, vargaSign, type GrahaId, type SignNumber } from '@vedic/engine';
import { arudhaOf, charaKarakas, grahasAspecting, grahasIn, karakamsa, NAME, signName, type JaiminiInput } from './core';
import { BENEFICS, MALEFICS } from './readings';
import type { KarakaScheme } from './types';

export type MarriageTone = 'supportive' | 'mixed' | 'strained';

export interface JaiminiMarriage {
  lagnaSign: SignNumber;
  moonSign: SignNumber;
  upapada: { sign: SignNumber; lord: GrahaId; lordSign: SignNumber; house: number; occupants: GrahaId[] };
  /** The 2nd from Upapada: what sustains the marriage */
  secondFromUl: { sign: SignNumber; occupants: GrahaId[]; aspecting: GrahaId[]; benefics: GrahaId[]; malefics: GrahaId[]; tone: MarriageTone; text: string };
  seventhFromUl: { sign: SignNumber; occupants: GrahaId[] };
  darakaraka: { planet: GrahaId; sign: SignNumber; navamsaSign: SignNumber };
  karakamsa: { atmakaraka: GrahaId; sign: SignNumber; seventh: SignNumber; /** Grahas in the 7th from Karakamsa in the navamsa */ seventhOccupantsD9: GrahaId[]; text: string };
}

export interface JaiminiLink {
  /** Whose point is touched: 'a' means a point in a's chart is matched by b's lagna or Moon */
  in: 'a' | 'b';
  point: 'UL' | '7th from UL' | 'DK sign' | '7th from Karakamsa';
  by: 'lagna' | 'Moon';
  sign: SignNumber;
  text: string;
}

export interface JaiminiMatch {
  a: JaiminiMarriage;
  b: JaiminiMarriage;
  links: JaiminiLink[];
  /** How the two Upapadas sit from each other */
  ulRelation: { distance: string; tone: MarriageTone; text: string };
  tone: MarriageTone;
  summary: string;
}

const pl = (g: GrahaId) => NAME.planet[g];
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Marriage factors of one chart */
export function jaiminiMarriage(input: JaiminiInput, scheme: KarakaScheme = 8): JaiminiMarriage {
  const asc = input.ascendantSign;
  const ul = arudhaOf(input, addSigns(asc, 11));
  const second = addSigns(ul.sign, 1);
  const seventh = addSigns(ul.sign, 6);
  const occ2 = grahasIn(input, second);
  const asp2 = grahasAspecting(input, second).filter((g) => !occ2.includes(g));
  const all2 = [...occ2, ...asp2];
  // Rahu and Ketu are malefic here; the Moon counts as a benefic as in the readings
  const ben = all2.filter((g) => BENEFICS.includes(g));
  const mal = all2.filter((g) => MALEFICS.includes(g));
  const occMal = occ2.filter((g) => MALEFICS.includes(g));
  let tone: MarriageTone;
  let text: string;
  const where = `the 2nd from Upapada (${signName(second)})`;
  if (!all2.length) {
    tone = 'mixed';
    text = `Nothing occupies or aspects ${where}, so the marriage is sustained by its lord and the overall chart rather than by a strong graha.`;
  } else if (occMal.length && !ben.length) {
    tone = 'strained';
    text = `${list(occMal.map(pl))} in ${where} with no benefic helping is the classical sign of a marriage that is hard to sustain. The texts single out this placement as the one to read carefully.`;
  } else if (ben.length >= mal.length) {
    tone = 'supportive';
    text = `${list(ben.map(pl))} ${ben.length > 1 ? 'support' : 'supports'} ${where}${mal.length ? `, outweighing ${list(mal.map(pl))}` : ''}. The texts read benefic support here as a marriage that lasts.`;
  } else {
    tone = 'mixed';
    text = `${list(mal.map(pl))} ${mal.length > 1 ? 'press on' : 'presses on'} ${where}, with ${list(ben.map(pl))} helping. The marriage holds, with periods that test it.`;
  }

  const ks = charaKarakas(input, scheme);
  const ak = ks[0].planet;
  const dk = ks[ks.length - 1];
  const kk = karakamsa(input, ak);
  const k7 = addSigns(kk, 6);
  const GR: GrahaId[] = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn', 'rahu', 'ketu'];
  const occK7 = GR.filter((g) => vargaSign(input.planets[g], 9) === k7);
  const kb = occK7.filter((g) => BENEFICS.includes(g)), km = occK7.filter((g) => MALEFICS.includes(g));
  const ktext = !occK7.length
    ? `The 7th from Karakamsa (${signName(k7)}) is empty in the navamsa; its sign and lord describe the partner sought.`
    : `${list(occK7.map(pl))} ${occK7.length > 1 ? 'sit' : 'sits'} in the 7th from Karakamsa (${signName(k7)}) in the navamsa. ${kb.length > km.length ? 'Benefics here describe a kind, well-suited partner.' : km.length > kb.length ? 'Malefics here describe a partner of strong will, or a bond that asks for effort.' : 'A mix of influences describes a partner who brings both ease and challenge.'}`;

  return {
    lagnaSign: asc,
    moonSign: signOf(input.planets.moon),
    upapada: { sign: ul.sign, lord: ul.lord, lordSign: ul.lordSign, house: houseFrom(asc, ul.sign), occupants: grahasIn(input, ul.sign) },
    secondFromUl: { sign: second, occupants: occ2, aspecting: asp2, benefics: ben, malefics: mal, tone, text },
    seventhFromUl: { sign: seventh, occupants: grahasIn(input, seventh) },
    darakaraka: { planet: dk.planet, sign: dk.sign, navamsaSign: vargaSign(input.planets[dk.planet], 9) },
    karakamsa: { atmakaraka: ak, sign: kk, seventh: k7, seventhOccupantsD9: occK7, text: ktext },
  };
}

const POINT_MEANING: Record<JaiminiLink['point'], string> = {
  UL: 'the Upapada, the image of the marriage itself',
  '7th from UL': 'the 7th from Upapada, the partner as the marriage shows them',
  'DK sign': 'the Darakaraka’s sign, the planet of the spouse',
  '7th from Karakamsa': 'the 7th from Karakamsa, the partner the soul seeks',
};

function linksInto(x: JaiminiMarriage, y: JaiminiMarriage, side: 'a' | 'b', names: { x: string; y: string }): JaiminiLink[] {
  const points: [JaiminiLink['point'], SignNumber][] = [
    ['UL', x.upapada.sign],
    ['7th from UL', x.seventhFromUl.sign],
    ['DK sign', x.darakaraka.sign],
    ['7th from Karakamsa', x.karakamsa.seventh],
  ];
  const out: JaiminiLink[] = [];
  for (const [point, sign] of points) {
    for (const [by, s] of [['lagna', y.lagnaSign], ['Moon', y.moonSign]] as const) {
      if (s === sign)
        out.push({ in: side, point, by, sign, text: `${names.y}’s ${by === 'lagna' ? 'rising sign' : 'Moon sign'}, ${signName(sign)}, falls on ${names.x}’s ${POINT_MEANING[point]}.` });
    }
  }
  return out;
}

/** Jaimini cross-check for a couple. `names` label the two people in the text */
export function jaiminiMatch(a: JaiminiInput, b: JaiminiInput, names: { a: string; b: string } = { a: 'Partner 1', b: 'Partner 2' }, scheme: KarakaScheme = 8): JaiminiMatch {
  const A = jaiminiMarriage(a, scheme), B = jaiminiMarriage(b, scheme);
  const links = [...linksInto(A, B, 'a', { x: names.a, y: names.b }), ...linksInto(B, A, 'b', { x: names.b, y: names.a })];

  const d1 = houseFrom(A.upapada.sign, B.upapada.sign), d2 = houseFrom(B.upapada.sign, A.upapada.sign);
  const pair = [d1, d2].sort((x, y) => x - y).join('/');
  let uTone: MarriageTone;
  let uText: string;
  if (['1/1', '1/7', '4/10', '5/9'].includes(pair)) {
    uTone = 'supportive';
    uText = pair === '1/1'
      ? `Both Upapadas fall in ${signName(A.upapada.sign)}: the two charts picture the same marriage.`
      : `The Upapadas are ${pair.replace('/', ' and ')} from each other (${signName(A.upapada.sign)} and ${signName(B.upapada.sign)}), a trine or angle, which the tradition reads as two people seeing the marriage the same way.`;
  } else if (['6/8', '2/12'].includes(pair)) {
    uTone = 'strained';
    uText = `The Upapadas are ${pair.replace('/', ' and ')} from each other (${signName(A.upapada.sign)} and ${signName(B.upapada.sign)}). Like Bhakoot's ${pair}, this is read as the two expecting different things of the marriage.`;
  } else {
    uTone = 'mixed';
    uText = `The Upapadas are ${pair.replace('/', ' and ')} from each other (${signName(A.upapada.sign)} and ${signName(B.upapada.sign)}), a neutral position.`;
  }

  const strained = [A, B].filter((m) => m.secondFromUl.tone === 'strained').length;
  const supportive = [A, B].filter((m) => m.secondFromUl.tone === 'supportive').length;
  let points = links.length + (uTone === 'supportive' ? 1 : uTone === 'strained' ? -1 : 0) + supportive - 2 * strained;
  if (links.some((l) => l.point === 'UL' || l.point === '7th from UL')) points += 1;
  const tone: MarriageTone = points >= 2 && !strained ? 'supportive' : points < 0 || strained === 2 ? 'strained' : 'mixed';

  const parts: string[] = [];
  parts.push(links.length ? `${links.length} Jaimini link${links.length > 1 ? 's' : ''} between the charts.` : 'Neither person’s lagna or Moon falls on the other’s marriage points.');
  parts.push(uText);
  for (const [m, n] of [[A, names.a], [B, names.b]] as const) {
    if (m.secondFromUl.tone === 'strained') parts.push(`In ${n}’s chart the 2nd from Upapada is afflicted, which the texts read as the marriage needing protection.`);
  }
  parts.push(tone === 'supportive' ? 'On the Jaimini reading the marriage is well supported.' : tone === 'strained' ? 'On the Jaimini reading the marriage needs care.' : 'On the Jaimini reading the picture is mixed.');
  return { a: A, b: B, links, ulRelation: { distance: pair, tone: uTone, text: uText }, tone, summary: parts.join(' ') };
}
