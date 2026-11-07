/**
 * Sentence templates the interpreter and the yoga/dosha detectors compose at run time.
 * Each language supplies its own functions, so word order and grammar can differ freely.
 * Arguments are already translated (planet names, house labels, ordinals).
 */
export interface Phrases {
  // ---- placements
  signTitle: (planet: string, sign: string) => string;
  dignityLine: (label: string, detail: string) => string;
  houseTitle: (planet: string, ord: string) => string;
  houseDetail: (o: { ord: string; sanskrit: string; significations: string; planet: string; essence: string }) => string;
  nakRelOwn: (planet: string) => string;
  nakRelFriend: (lord: string, planet: string) => string;
  nakRelEnemy: (lord: string, planet: string, essence: string, lordEssence: string) => string;
  nakRelNeutral: (lord: string, planet: string) => string;
  nakColours: (nak: string, lens: string, description: string) => string;
  nakRuled: (o: { lord: string; deity: string; symbol: string; shakti: string; relation: string }) => string;
  nakWorks: (o: { planet: string; high: string; gifts: string; shadows: string; low: string }) => string;
  nakPada: (pada: number, text: string) => string;
  nakTitle: (planet: string, nak: string, pada?: number) => string;
  nakSummary: (o: { planet: string; nak: string; essence: string; nature: string; keywords: string }) => string;
  lordTitle: (lordOrd: string, placedOrd: string, planet?: string) => string;
  lordCarried: (o: { aOrd: string; aLabel: string; bOrd: string; bLabel: string; rel: number; relOrd: string }) => string;
  retroTitle: (planet: string) => string;
  conjTitle: (a: string, b: string) => string;
  aspectTitle: (planet: string, ord: string) => string;
  aspectSummary: (o: { planet: string; distOrd: string; flavor: string; label: string }) => string;
  aspectDefault: (o: { planet: string; ord: string; flavor: string; significations: string }) => string;
  /** Join two items ("x and y"). */
  and: (a: string, b: string) => string;
  /** Join planet names in a reason ("Mars, Venus"). */
  names: (names: string[]) => string;
  keywords: { retrograde: string[]; conjunction: string[]; aspect: string[] };

  // ---- yogas
  mahapurusha: (planet: string, exalted: boolean, ord: string) => string;
  gajaKesari: (ord: string) => string;
  budhaAditya: (ord: string, deg: string) => string;
  chandraMangalaConj: string;
  chandraMangalaOpp: string;
  durudhara: (in2: string, in12: string) => string;
  sunapha: (in2: string) => string;
  anapha: (in12: string) => string;
  kemadrumaYoga: string;
  ubhayachari: (s2: string, s12: string) => string;
  vesi: (s2: string) => string;
  vasi: (s12: string) => string;
  adhi: (planets: string) => string;
  shakata: (ord: string) => string;
  yogakaraka: (planet: string, kOrd: string, tOrd: string) => string;
  relation: (rel: 'conjunction' | 'mutual aspect' | 'exchange' | 'the same planet') => string;
  rajaLink: (o: { a: string; aOrd: string; b: string; bOrd: string; rel: string }) => string;
  dharmaKarma: (l9: string, l10: string, rel: string) => string;
  lakshmi: (o: { l9: string; dignity: string; ord: string; l1: string }) => string;
  vasumati: string;
  viparita: (lord: string, ord: string, posOrd: string) => string;
  nbDispositorKendra: (p: string) => string;
  nbExaltLordKendra: (p: string) => string;
  nbExaltedHereKendra: (p: string) => string;
  nbDispositorAspects: (p: string) => string;
  nbExchange: (p: string) => string;
  nbKendra: string;
  nbRetro: string;
  neechaBhanga: (planet: string, reasons: string[]) => string;
  neechaBhangaName: (planet: string) => string;
  parivartana: (o: { a: string; aOrd: string; b: string; bOrd: string }) => string;
  amala: (planets: string, fromAscendant: boolean) => string;
  saraswati: string;
  shubhaKartari: string;
  papaKartari: string;
  pravrajya: (planets: string) => string;
  sankhya: (n: number) => string;
  guruChandala: string;
  angaraka: string;

  // ---- doshas
  manglikRef: { ascendant: string; moon: string; venus: string };
  manglikNone: string;
  manglikIn: (refs: string) => string;
  mcOwnSign: string;
  mcJupiter: string;
  mcMoon: string;
  mc2nd: string;
  mc4th: string;
  mc7th: string;
  mc8th: string;
  mc12th: string;
  mcLeoAquarius: string;
  kaalSarpKind: { forward: string; reverse: string };
  kaalSarpNames: string[];
  kaalSarp: (o: { kind: string; type: string; ord: string }) => string;
  kaalSarpName: (type: string) => string;
  kaalSarpPartial: (planet: string) => string;
  kaalSarpBreaks: (planet: string) => string;
  kaalSarpPartialName: string;
  kaalSarpNone: string;
  pitraSunWith: (planet: string) => string;
  pitraIn9th: (planet: string) => string;
  pitra: (reasons: string[]) => string;
  sunStrong: string;
  grahanWith: (light: string, node: string) => string;
  grahan: (items: string[]) => string;
  jupiterRahu: string;
  jupiterStrong: string;
  saturnRahu: string;
  marsRahu: string;
  kemaKendraMoon: string;
  kemaKendraLagna: string;
  kemadrumaDosha: string;
  gandantaMoon: string;
  gandantaAsc: string;
  gandanta: (subjects: string[]) => string;
}

export const EN_PHRASES: Phrases = {
  signTitle: (planet, sign) => `${planet} in ${sign}`,
  dignityLine: (label, detail) => `${label}: ${detail}`,
  houseTitle: (planet, ord) => `${planet} in the ${ord} house`,
  houseDetail: ({ ord, sanskrit, significations, planet, essence }) => `The ${ord} house (${sanskrit}) governs ${significations}. ${planet} brings ${essence} to these matters.`,
  nakRelOwn: (planet) => `${planet} rules this nakshatra, so it acts with full authority and the nakshatra’s themes are pronounced.`,
  nakRelFriend: (lord, planet) => `The nakshatra lord ${lord} is a friend of ${planet}, so the two cooperate and results flow easily.`,
  nakRelEnemy: (lord, planet, essence, lordEssence) => `The nakshatra lord ${lord} is unfriendly to ${planet}, so expect some inner tension between ${essence} and ${lordEssence}.`,
  nakRelNeutral: (lord, planet) => `The nakshatra lord ${lord} is neutral to ${planet}; results depend on ${lord}’s own placement in the chart.`,
  nakColours: (nak, lens, description) => `${nak} colours ${lens}. ${description}`,
  nakRuled: ({ lord, deity, symbol, shakti, relation }) => `Ruled by ${lord} and presided over by ${deity}, its symbol is ${symbol} and it grants ${shakti}. ${relation}`,
  nakWorks: ({ planet, high, gifts, shadows, low }) => `When ${planet} works well here you see ${high}, expressed through ${gifts}. When it struggles, watch for ${shadows}, along with ${low}.`,
  nakPada: (pada, text) => `Pada ${pada}: ${text}`,
  nakTitle: (planet, nak, pada) => `${planet} in ${nak}${pada ? ` (pada ${pada})` : ''}`,
  nakSummary: ({ planet, nak, essence, nature, keywords }) => `${planet} in ${nak} expresses ${essence} in a ${nature} way, focused on ${keywords}.`,
  lordTitle: (a, b, planet) => `Lord of the ${a} in the ${b}${planet ? ` (${planet})` : ''}`,
  lordCarried: ({ aOrd, aLabel, bOrd, bLabel, rel, relOrd }) =>
    `The matters of the ${aOrd} house (${aLabel}) are carried into the ${bOrd} house (${bLabel}). Counted from its own house, the lord sits ${rel === 1 ? 'at home' : `in the ${relOrd} position`}, so ${aLabel} is experienced through ${bLabel}.`,
  retroTitle: (planet) => `${planet} retrograde`,
  conjTitle: (a, b) => `${a} conjunct ${b}`,
  aspectTitle: (planet, ord) => `${planet} aspects the ${ord} house`,
  aspectSummary: ({ planet, distOrd, flavor, label }) => `${planet}’s ${distOrd} aspect ${flavor} ${label}.`,
  aspectDefault: ({ planet, ord, flavor, significations }) => `Every planet aspects the 7th from itself. ${planet} looks across at the ${ord} house and ${flavor} its affairs: ${significations}.`,
  and: (a, b) => `${a} and ${b}`,
  names: (n) => n.join(', '),
  keywords: { retrograde: ['retrograde', 'vakri'], conjunction: ['conjunction', 'yuti'], aspect: ['drishti', 'aspect'] },

  mahapurusha: (planet, exalted, ord) => `${planet} is ${exalted ? 'exalted' : 'in its own sign'} in the ${ord} house, a kendra.`,
  gajaKesari: (ord) => `Jupiter is in the ${ord} from the Moon.`,
  budhaAditya: (ord, deg) => `The Sun and Mercury share the ${ord} house (${deg}° apart).`,
  chandraMangalaConj: 'The Moon and Mars are conjunct.',
  chandraMangalaOpp: 'The Moon and Mars face each other across the 7th.',
  durudhara: (a, b) => `${a} in the 2nd and ${b} in the 12th from the Moon.`,
  sunapha: (a) => `${a} in the 2nd from the Moon.`,
  anapha: (a) => `${a} in the 12th from the Moon.`,
  kemadrumaYoga: 'No planets in the 2nd or 12th from the Moon, and no planets in kendras from the Moon or ascendant to cancel it.',
  ubhayachari: (a, b) => `${a} in the 2nd and ${b} in the 12th from the Sun.`,
  vesi: (a) => `${a} in the 2nd from the Sun.`,
  vasi: (a) => `${a} in the 12th from the Sun.`,
  adhi: (a) => `${a} in the 6th–8th from the Moon.`,
  shakata: (ord) => `The Moon is in the ${ord} from Jupiter and not in a kendra from the ascendant.`,
  yogakaraka: (p, k, t) => `${p} rules the ${k} (kendra) and ${t} (trikona) for this ascendant.`,
  relation: (rel) => rel,
  rajaLink: ({ a, aOrd, b, bOrd, rel }) => `${a} (lord of ${aOrd}) and ${b} (lord of ${bOrd}) are linked by ${rel}.`,
  dharmaKarma: (l9, l10, rel) => `The 9th lord ${l9} and 10th lord ${l10} are linked by ${rel}.`,
  lakshmi: ({ l9, dignity, ord, l1 }) => `The 9th lord ${l9} is ${dignity} in the ${ord}, and the ascendant lord ${l1} is well placed.`,
  vasumati: 'Mercury, Jupiter and Venus all occupy upachaya houses (3, 6, 10, 11).',
  viparita: (l, ord, pos) => `${l}, lord of the ${ord}, sits in the ${pos}.`,
  nbDispositorKendra: (p) => `its dispositor ${p} is in a kendra from the ascendant or Moon`,
  nbExaltLordKendra: (p) => `the lord of its exaltation sign, ${p}, is in a kendra from the ascendant or Moon`,
  nbExaltedHereKendra: (p) => `${p}, which is exalted in this sign, is in a kendra`,
  nbDispositorAspects: (p) => `its dispositor ${p} aspects or joins it`,
  nbExchange: (p) => `it exchanges signs with ${p}`,
  nbKendra: 'it sits in a kendra from the ascendant',
  nbRetro: 'it is retrograde (a view held by some astrologers)',
  neechaBhanga: (p, reasons) => `${p} is debilitated, but ${reasons.join('; ')}.`,
  neechaBhangaName: (p) => `Neecha Bhanga of ${p}`,
  parivartana: ({ a, aOrd, b, bOrd }) => `${a} (in the ${aOrd}) and ${b} (in the ${bOrd}) occupy each other’s signs, linking the ${aOrd} and ${bOrd} houses.`,
  amala: (ps, asc) => `${ps} in the 10th from the ${asc ? 'ascendant' : 'Moon'}.`,
  saraswati: 'Jupiter, Venus and Mercury all occupy kendras, trikonas or the 2nd, with Jupiter in reasonable dignity.',
  shubhaKartari: 'Only benefics occupy the houses on either side of the ascendant.',
  papaKartari: 'Only malefics occupy the houses on either side of the ascendant.',
  pravrajya: (ps) => `${ps} share one sign.`,
  sankhya: (n) => `The seven planets occupy ${n} sign${n === 1 ? '' : 's'}.`,
  guruChandala: 'Jupiter shares a sign with Rahu.',
  angaraka: 'Mars shares a sign with Rahu.',

  manglikRef: { ascendant: 'ascendant', moon: 'Moon', venus: 'Venus' },
  manglikNone: 'Mars is not in a Manglik house from the ascendant, Moon or Venus.',
  manglikIn: (refs) => `Mars is in a Manglik house from the ${refs}.`,
  mcOwnSign: 'Mars is in its own sign or exaltation (Aries, Scorpio or Capricorn)',
  mcJupiter: 'Jupiter joins or aspects Mars',
  mcMoon: 'Mars is with the Moon (Chandra-Mangala)',
  mc2nd: 'Mars in the 2nd in Gemini or Virgo',
  mc4th: 'Mars in the 4th in Aries or Scorpio',
  mc7th: 'Mars in the 7th in Cancer or Capricorn',
  mc8th: 'Mars in the 8th in Sagittarius or Pisces',
  mc12th: 'Mars in the 12th in Taurus or Libra',
  mcLeoAquarius: 'Mars in Leo or Aquarius',
  kaalSarpKind: { forward: 'Kaal Sarp', reverse: 'Kaal Amrit (reverse Kaal Sarp)' },
  kaalSarpNames: ['Anant', 'Kulik', 'Vasuki', 'Shankhpal', 'Padma', 'Mahapadma', 'Takshak', 'Karkotak', 'Shankhachood', 'Ghatak', 'Vishdhar', 'Sheshnag'],
  kaalSarp: ({ kind, type, ord }) => `All seven planets lie on one side of the Rahu–Ketu axis (${kind}). Type: ${type} (Rahu in the ${ord}).`,
  kaalSarpName: (type) => `${type} Kaal Sarp Dosha`,
  kaalSarpPartial: (p) => `Partial Kaal Sarp: all planets but ${p} are hemmed between the nodes.`,
  kaalSarpBreaks: (p) => `${p} breaks the pattern`,
  kaalSarpPartialName: 'Partial Kaal Sarp Dosha',
  kaalSarpNone: 'Planets are distributed on both sides of the nodal axis.',
  pitraSunWith: (p) => `the Sun is with ${p}`,
  pitraIn9th: (p) => `${p} is in the 9th house`,
  pitra: (r) => `Pitra indicators: ${r.join('; ')}.`,
  sunStrong: 'The Sun is strong by sign',
  grahanWith: (l, n) => `${l} with ${n}`,
  grahan: (items) => `${items.join('; ')}.`,
  jupiterRahu: 'Jupiter shares a sign with Rahu.',
  jupiterStrong: 'Jupiter is strong by sign',
  saturnRahu: 'Saturn shares a sign with Rahu.',
  marsRahu: 'Mars shares a sign with Rahu.',
  kemaKendraMoon: 'a planet is in a kendra from the Moon',
  kemaKendraLagna: 'a planet is in a kendra from the ascendant',
  kemadrumaDosha: 'No planets flank the Moon in the 2nd or 12th.',
  gandantaMoon: 'the Moon',
  gandantaAsc: 'the ascendant',
  gandanta: (s) => `${s.join(' and ')} ${s.length > 1 ? 'fall' : 'falls'} in a water–fire junction.`,
};
