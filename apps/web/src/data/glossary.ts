/**
 * The Sanskrit vocabulary the readings use, explained the way an astrologer uses it.
 * One list feeds the hover glossary in the readings and the glossary on the /study page.
 * (The PDF report keeps its own glossary chapter, worded for print.)
 *
 * `match` lists the spellings to find in running English text (case-insensitive, whole words).
 * The term itself is always matched; add plurals and common variant spellings here.
 */
export interface GlossaryEntry {
  id: string;
  /** Headword as shown in English text. */
  term: string;
  /** IAST transliteration. */
  iast: string;
  /** Devanagari. */
  deva: string;
  /** Plain-English gloss of the word itself, when it helps. */
  literal?: string;
  def: string;
  match?: string[];
  /** Shown only in the glossary list, not looked for in text (too common as an English word). */
  listOnly?: boolean;
}

export const GLOSSARY: GlossaryEntry[] = [
  { id: 'antardasha', term: 'Antardasha', iast: 'antardaśā', deva: 'अन्तर्दशा', literal: 'inner period', def: 'A sub-period within a mahadasha. Each mahadasha holds nine, one for each graha, in the Vimshottari order.', match: ['antardashas', 'bhukti', 'bhuktis'] },
  { id: 'arudha', term: 'Arudha', iast: 'ārūḍha', deva: 'आरूढ', literal: 'mounted', def: 'The "image" of a house in the Jaimini system: how its matters appear to the world rather than how they are.', match: ['arudha lagna', 'arudhas', 'arudha pada', 'arudha padas'] },
  { id: 'lagna', term: 'Lagna', iast: 'lagna', deva: 'लग्न', literal: 'attached', def: 'The ascendant: the sign and degree rising on the eastern horizon at birth. It becomes the 1st house and the starting point of the chart.', match: ['ascendant', 'ascendants', 'rising sign'] },
  { id: 'ashtakavarga', term: 'Ashtakavarga', iast: 'aṣṭakavarga', deva: 'अष्टकवर्ग', literal: 'eight-fold division', def: 'A points system that scores every sign from the point of view of each planet and the ascendant. Used to judge transits.', match: ['sarvashtakavarga'] },
  { id: 'atmakaraka', term: 'Atmakaraka', iast: 'ātmakāraka', deva: 'आत्मकारक', literal: 'significator of the self', def: 'In Jaimini astrology, the planet with the highest degree in its sign. It signifies the soul and its central lesson in this life.', match: ['atma karaka'] },
  { id: 'ayanamsa', term: 'Ayanamsa', iast: 'ayanāṃśa', deva: 'अयनांश', def: 'The gap in degrees between the tropical (seasonal) and sidereal (star-based) zodiacs. Lahiri, the Indian government standard, is the default here.', match: ['ayanamsha'] },
  { id: 'drishti', term: 'Drishti', iast: 'dṛṣṭi', deva: 'दृष्टि', literal: 'sight', def: 'A planet\'s "gaze" on another sign. All planets aspect the 7th sign from themselves; Mars, Jupiter, Saturn and the nodes have extra aspects.', match: ['drishtis', 'graha drishti', 'rashi drishti'] },
  { id: 'bhava', term: 'Bhava', iast: 'bhāva', deva: 'भाव', literal: 'state of being', def: 'A house: one of the twelve areas of life.', match: ['bhavas'] },
  { id: 'bindu', term: 'Bindu', iast: 'bindu', deva: 'बिन्दु', literal: 'dot', def: 'A point in the ashtakavarga. A sign\'s total for one planet runs from 0 to 8.', match: ['bindus'] },
  { id: 'chara-karaka', term: 'Chara karaka', iast: 'cara kāraka', deva: 'चर कारक', literal: 'moveable significator', def: 'In Jaimini astrology, the planets ranked by degree in sign, from the atmakaraka (highest) to the darakaraka (lowest, the spouse).', match: ['chara karakas'] },
  { id: 'asta', term: 'Asta', iast: 'asta', deva: 'अस्त', literal: 'set', def: 'Combustion: a planet so close to the Sun that it is lost in its glare. Its independence is reduced.', match: ['combust', 'combustion'] },
  { id: 'dasha', term: 'Dasha', iast: 'daśā', deva: 'दशा', literal: 'condition, state', def: 'A planetary period. The planet ruling the period brings its placement and houses into focus.', match: ['dashas'] },
  { id: 'neecha', term: 'Neecha', iast: 'nīca', deva: 'नीच', literal: 'low', def: 'Debilitation: the sign where a planet is weakest. It can be cancelled (neecha bhanga) by other factors.', match: ['debilitated', 'debilitation', 'neecha bhanga'] },
  { id: 'dignity', term: 'Dignity', iast: 'avasthā', deva: 'अवस्था', def: 'How comfortable a planet is in its sign: exalted, moolatrikona, own, friendly, neutral, enemy or debilitated.', listOnly: true },
  { id: 'dosha', term: 'Dosha', iast: 'doṣa', deva: 'दोष', literal: 'fault', def: 'A combination that asks for care, such as Manglik dosha. Most have classical cancellations.', match: ['doshas'] },
  { id: 'dusthana', term: 'Dusthana', iast: 'duḥsthāna', deva: 'दुःस्थान', literal: 'difficult place', def: 'The 6th, 8th and 12th houses: struggle, transformation and loss, but also healing, research and release.', match: ['dusthanas'] },
  { id: 'uchcha', term: 'Uchcha', iast: 'ucca', deva: 'उच्च', literal: 'high', def: 'Exaltation: the sign where a planet is at its strongest.', match: ['exalted', 'exaltation'] },
  { id: 'gochara', term: 'Gochara', iast: 'gocara', deva: 'गोचर', literal: 'moving through', def: 'Transits: the current movement of the planets, judged mainly from the natal Moon.', match: ['transit', 'transits'] },
  { id: 'graha', term: 'Graha', iast: 'graha', deva: 'ग्रह', literal: 'seizer', def: 'One of the nine celestial influences: Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu and Ketu.', match: ['grahas', 'navagraha', 'navagrahas'] },
  { id: 'hora', term: 'Hora', iast: 'horā', deva: 'होरा', def: 'A planetary hour, and the D2 divisional chart of wealth. The word gives astrology its Sanskrit name, hora shastra.' },
  { id: 'janma-nakshatra', term: 'Janma nakshatra', iast: 'janma nakṣatra', deva: 'जन्म नक्षत्र', literal: 'birth star', def: 'The nakshatra the Moon occupied at birth. It sets the starting dasha and many compatibility checks.', match: ['birth star', 'janma tara'] },
  { id: 'jyotisha', term: 'Jyotisha', iast: 'jyotiṣa', deva: 'ज्योतिष', literal: 'science of light', def: 'Vedic astrology, one of the six limbs (vedangas) of the Vedas.', match: ['jyotish'] },
  { id: 'karaka', term: 'Karaka', iast: 'kāraka', deva: 'कारक', literal: 'doer, significator', def: 'The natural significator of a matter: the Sun for the father, Venus for the spouse, Jupiter for children.', match: ['karakas', 'significator', 'significators'] },
  { id: 'karakamsa', term: 'Karakamsa', iast: 'kārakāṃśa', deva: 'कारकांश', def: 'The navamsha sign of the atmakaraka, read as a lagna in Jaimini astrology for the soul\'s path, work and devotion.', match: ['karakamsha'] },
  { id: 'kendra', term: 'Kendra', iast: 'kendra', deva: 'केन्द्र', literal: 'centre', def: 'The angular houses, 1, 4, 7 and 10: the pillars of the chart.', match: ['kendras', 'angular houses'] },
  { id: 'ketu', term: 'Ketu', iast: 'ketu', deva: 'केतु', def: 'The south node of the Moon. Signifies detachment, past mastery, intuition and liberation.' },
  { id: 'lord', term: 'Lord', iast: 'adhipati', deva: 'अधिपति', def: 'The planet that rules a sign, and so rules the house that sign occupies in your chart.', listOnly: true },
  { id: 'mahadasha', term: 'Mahadasha', iast: 'mahādaśā', deva: 'महादशा', literal: 'great period', def: 'A major period of the Vimshottari dasha, from 6 to 20 years long.', match: ['mahadashas', 'maha dasha'] },
  { id: 'mahapurusha', term: 'Mahapurusha', iast: 'mahāpuruṣa', deva: 'महापुरुष', literal: 'great person', def: 'The five yogas formed when Mars, Mercury, Jupiter, Venus or Saturn is in its own or exaltation sign in a kendra.', match: ['pancha mahapurusha'] },
  { id: 'manglik', term: 'Manglik', iast: 'māṅgalika', deva: 'मांगलिक', def: 'Mars in the 1st, 2nd, 4th, 7th, 8th or 12th house, held to strain marriage. Many cancellations apply, and two Manglik charts are traditionally matched.', match: ['mangal dosha', 'kuja dosha', 'manglik dosha'] },
  { id: 'maraka', term: 'Maraka', iast: 'māraka', deva: 'मारक', literal: 'killer', def: 'The 2nd and 7th houses and their lords, which classical texts watch for health crises in their periods.', match: ['marakas'] },
  { id: 'moolatrikona', term: 'Moolatrikona', iast: 'mūlatrikoṇa', deva: 'मूलत्रिकोण', literal: 'root trine', def: 'A sign (or part of one) where a planet is nearly as strong as in exaltation, like an office where it works best.', match: ['mooltrikona', 'mulatrikona'] },
  { id: 'muhurta', term: 'Muhurta', iast: 'muhūrta', deva: 'मुहूर्त', literal: 'moment (48 minutes)', def: 'Electional astrology: choosing an auspicious moment to begin something.', match: ['muhurtas', 'muhurat'] },
  { id: 'nakshatra', term: 'Nakshatra', iast: 'nakṣatra', deva: 'नक्षत्र', literal: 'that which does not decay', def: 'One of 27 lunar mansions of 13°20′ each, the older star-based division of the zodiac.', match: ['nakshatras', 'lunar mansion', 'lunar mansions'] },
  { id: 'navamsha', term: 'Navamsha', iast: 'navāṃśa', deva: 'नवांश', literal: 'ninth part', def: 'The D9 chart. Each sign is split into nine; it shows marriage, dharma and the inner strength of each planet.', match: ['navamsa', 'navamshas', 'navamsas', 'D9'] },
  { id: 'pada', term: 'Pada', iast: 'pāda', deva: 'पाद', literal: 'foot, quarter', def: 'A quarter of a nakshatra, 3°20′. Each pada corresponds to one navamsha sign.', match: ['padas'] },
  { id: 'panchanga', term: 'Panchanga', iast: 'pañcāṅga', deva: 'पञ्चाङ्ग', literal: 'five limbs', def: 'The Indian almanac\'s five limbs of a day: vara, tithi, nakshatra, yoga and karana.', match: ['panchang'] },
  { id: 'parivartana', term: 'Parivartana', iast: 'parivartana', deva: 'परिवर्तन', literal: 'exchange', def: 'Two planets in each other\'s signs. Each acts as if at home, and their two houses become partners.', match: ['sign exchange', 'mutual reception'] },
  { id: 'prashna', term: 'Prashna', iast: 'praśna', deva: 'प्रश्न', literal: 'question', def: 'Horary astrology: a chart cast for the moment a question is asked.', match: ['horary'] },
  { id: 'rahu', term: 'Rahu', iast: 'rāhu', deva: 'राहु', def: 'The north node of the Moon. Signifies ambition, appetite, the foreign and the unconventional.' },
  { id: 'raja-yoga', term: 'Raja yoga', iast: 'rāja yoga', deva: 'राज योग', literal: 'royal union', def: 'A link between the lord of a kendra and the lord of a trikona: effort joined to grace, giving status and success in their periods.', match: ['raja yogas'] },
  { id: 'rashi', term: 'Rashi', iast: 'rāśi', deva: 'राशि', literal: 'heap, group', def: 'A sign of the zodiac. The rashi chart is the main birth chart (D1).', match: ['rashis', 'rasi'] },
  { id: 'vakri', term: 'Vakri', iast: 'vakrī', deva: 'वक्री', literal: 'crooked', def: 'Retrograde: a planet that appears to move backwards from Earth. Strong but inward-turned.', match: ['retrograde', 'retrogrades', 'retrogression'] },
  { id: 'sade-sati', term: 'Sade Sati', iast: 'sāḍhe sātī', deva: 'साढ़े साती', literal: 'seven and a half', def: 'Saturn\'s 7½-year transit over the 12th, 1st and 2nd signs from the natal Moon.' },
  { id: 'shadbala', term: 'Shadbala', iast: 'ṣaḍbala', deva: 'षड्बल', literal: 'six-fold strength', def: 'The six-fold strength of a planet, a numerical measure of how able it is to give results.' },
  { id: 'sidereal', term: 'Sidereal', iast: 'nirayana', deva: 'निरयण', literal: 'without precession', def: 'A zodiac fixed to the stars, used in Vedic astrology. It differs from the seasonal (tropical) zodiac by the ayanamsa.', match: ['sidereal zodiac'] },
  { id: 'tithi', term: 'Tithi', iast: 'tithi', deva: 'तिथि', literal: 'lunar day', def: 'Each 12° step of the Moon away from the Sun. There are 30 in a lunar month.', match: ['tithis'] },
  { id: 'trikona', term: 'Trikona', iast: 'trikoṇa', deva: 'त्रिकोण', literal: 'triangle', def: 'The trinal houses 1, 5 and 9: houses of fortune, merit and dharma.', match: ['trikonas', 'trine', 'trines'] },
  { id: 'upachaya', term: 'Upachaya', iast: 'upacaya', deva: 'उपचय', literal: 'increase', def: 'The houses 3, 6, 10 and 11, which improve with time and effort.', match: ['upachayas'] },
  { id: 'upapada', term: 'Upapada', iast: 'upapada', deva: 'उपपद', def: 'The arudha of the 12th house in Jaimini astrology. It shows the marriage and the spouse as the world meets them.', match: ['upapada lagna'] },
  { id: 'varga', term: 'Varga', iast: 'varga', deva: 'वर्ग', literal: 'division', def: 'A divisional chart, made by dividing each sign into equal parts. D9 and D10 are the best known.', match: ['vargas', 'divisional chart', 'divisional charts'] },
  { id: 'vargottama', term: 'Vargottama', iast: 'vargottama', deva: 'वर्गोत्तम', literal: 'best of the division', def: 'A planet in the same sign in the birth chart and the navamsha. A mark of strength.' },
  { id: 'varshaphal', term: 'Varshaphal', iast: 'varṣaphala', deva: 'वर्षफल', literal: 'fruit of the year', def: 'The Tajika annual chart, cast for the moment the Sun returns to its birth degree.' },
  { id: 'vedha', term: 'Vedha', iast: 'vedha', deva: 'वेध', literal: 'piercing', def: 'An obstruction in transit: a favourable transit is blocked when another planet sits in its vedha point.' },
  { id: 'vimshottari', term: 'Vimshottari', iast: 'viṃśottarī', deva: 'विंशोत्तरी', literal: 'one hundred and twenty', def: 'The 120-year dasha system based on the Moon\'s nakshatra. The most widely used timing method.' },
  { id: 'viparita', term: 'Viparita raja yoga', iast: 'viparīta rāja yoga', deva: 'विपरीत राज योग', literal: 'reversed royal union', def: 'A lord of the 6th, 8th or 12th placed in another of those houses: two difficulties cancel and turn into a rise.', match: ['viparita'] },
  { id: 'yoga', term: 'Yoga', iast: 'yoga', deva: 'योग', literal: 'union', def: 'A meaningful combination of planets. Also one of the five limbs of the panchanga.', match: ['yogas'] },
  { id: 'yogakaraka', term: 'Yogakaraka', iast: 'yogakāraka', deva: 'योगकारक', def: 'A planet that rules both a kendra and a trikona for your ascendant, and so brings particular success.' },
];

export const GLOSSARY_BY_ID: Record<string, GlossaryEntry> = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every spelling, longest first so "raja yoga" wins over "yoga". */
const SPELLINGS: [string, string][] = GLOSSARY.filter((g) => !g.listOnly)
  .flatMap((g) => [g.term, ...(g.match ?? [])].map((m) => [m.toLowerCase(), g.id] as [string, string]))
  .sort((a, b) => b[0].length - a[0].length);
const ID_BY_SPELLING = new Map(SPELLINGS);
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(${SPELLINGS.map(([s]) => escape(s).replace(/ /g, '\\s+')).join('|')})(?![\\p{L}\\p{N}])`, 'giu');

export type GlossPiece = string | { id: string; text: string };

/**
 * Splits text into plain runs and glossary terms. Each term is marked once per call (its first
 * appearance), so a paragraph is not a wall of underlines. Pass a shared `seen` set to mark each
 * term only once across several paragraphs.
 */
export function findTerms(text: string, seen: Set<string> = new Set()): GlossPiece[] {
  const out: GlossPiece[] = [];
  let last = 0;
  for (const m of text.matchAll(PATTERN)) {
    const id = ID_BY_SPELLING.get(m[0].toLowerCase().replace(/\s+/g, ' '));
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (m.index! > last) out.push(text.slice(last, m.index));
    out.push({ id, text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
