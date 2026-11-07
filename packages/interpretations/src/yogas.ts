/**
 * Yoga definitions (original text) and detection rules.
 * All rules are judged by whole-sign houses from the ascendant unless noted.
 */
import {
  DUSTHANA,
  KENDRA,
  TRIKONA,
  UPACHAYA,
  aspectsPlanet,
  dignityOf,
  exchange,
  houseFromPlanet,
  houseOf,
  housesRuledBy,
  isBenefic,
  isStrong,
  isWeak,
  lordOfHouse,
  related,
  sameSign,
  signDistance,
} from './chart-utils';
import { PLANET_PROFILES } from './data/planets';
import { signLord } from './data/signs';
import type { ChartInput, HouseNumber, PlanetId, Reading, Strength, Tone, YogaCategory, YogaDefinition, YogaResult } from './types';
import { PLANETS, SEVEN_PLANETS } from './types';

const reading = (
  id: string,
  title: string,
  summary: string,
  detail: string[],
  strengths: string[],
  challenges: string[],
  tone: Tone,
  score: number,
  keywords: string[] = [],
  remedies?: string[],
): Reading => ({ id, title, summary, detail, strengths, challenges, keywords, tone, score, remedies });

const def = (
  id: string,
  name: string,
  category: YogaCategory,
  rule: string,
  summary: string,
  detail: string[],
  strengths: string[],
  challenges: string[],
  tone: Tone,
  score: number,
  aka?: string[],
): YogaDefinition => ({ id, name, aka, category, rule, reading: reading(`yoga:${id}`, name, summary, detail, strengths, challenges, tone, score, [category]) });

export const YOGA_DEFINITIONS: Record<string, YogaDefinition> = {
  ruchaka: def('ruchaka', 'Ruchaka Yoga', 'mahapurusha', 'Mars in its own sign or exaltation (Aries, Scorpio, Capricorn) in a kendra (1, 4, 7, 10) from the ascendant.',
    'Mars-born greatness: courage, command and physical strength.',
    ['Ruchaka is the Mars member of the five Mahapurusha ("great person") yogas. It gives a strong body, bravery, competitive success and a talent for leadership in demanding fields such as the military, police, sport, surgery, engineering or entrepreneurship.', 'The person tends to protect others and to win by direct effort. The challenge is to keep aggression and impatience in check, especially in partnerships if Mars is in the 7th.'],
    ['courage', 'leadership', 'physical vitality', 'decisiveness'], ['aggression', 'impatience', 'conflict'], 'benefic', 3),
  bhadra: def('bhadra', 'Bhadra Yoga', 'mahapurusha', 'Mercury in its own sign or exaltation (Gemini, Virgo) in a kendra from the ascendant.',
    'Mercury-born greatness: brilliant intellect, eloquence and commercial skill.',
    ['Bhadra makes the mind the main instrument of success. It gives eloquence, analytical brilliance, a youthful appearance and talent in commerce, writing, teaching, law or technology.', 'People with Bhadra are often admired for their wit and learning. The challenge is nervous over-activity and spreading the mind too thin.'],
    ['intelligence', 'eloquence', 'business acumen', 'learning'], ['nervousness', 'over-thinking'], 'benefic', 3),
  hamsa: def('hamsa', 'Hamsa Yoga', 'mahapurusha', 'Jupiter in its own sign or exaltation (Sagittarius, Pisces, Cancer) in a kendra from the ascendant.',
    'Jupiter-born greatness: wisdom, virtue and respect.',
    ['Hamsa, the swan, is the Jupiter Mahapurusha yoga. It gives a righteous, learned and generous nature, respect from society and often a role as teacher, advisor, judge or spiritual guide.', 'Fortune and protection follow this person. The challenge is complacency or a tendency to moralise.'],
    ['wisdom', 'virtue', 'respect', 'good fortune'], ['complacency', 'preachiness'], 'benefic', 3),
  malavya: def('malavya', 'Malavya Yoga', 'mahapurusha', 'Venus in its own sign or exaltation (Taurus, Libra, Pisces) in a kendra from the ascendant.',
    'Venus-born greatness: beauty, comfort, art and happy relationships.',
    ['Malavya gives charm, artistic talent, refined taste, vehicles, comforts and a pleasant married life. It suits the arts, fashion, hospitality, diplomacy and luxury trades.', 'Life tends to be comfortable and socially rich. The challenge is indulgence and attachment to pleasure.'],
    ['charm', 'artistic talent', 'comfort', 'harmonious relationships'], ['indulgence', 'vanity'], 'benefic', 3),
  sasa: def('sasa', 'Sasa Yoga', 'mahapurusha', 'Saturn in its own sign or exaltation (Capricorn, Aquarius, Libra) in a kendra from the ascendant.',
    'Saturn-born greatness: authority over many, built through discipline.',
    ['Sasa gives the ability to organise and lead large groups, endurance, political or administrative skill and success that grows steadily with age.', 'The person often rises from modest beginnings through persistence. The challenge is coldness, severity or an excessive focus on work.'],
    ['discipline', 'organisation', 'authority', 'endurance'], ['coldness', 'severity', 'workaholism'], 'benefic', 3),
  'gaja-kesari': def('gaja-kesari', 'Gaja Kesari Yoga', 'lunar', 'Jupiter in a kendra (1, 4, 7, 10) from the Moon.',
    'The elephant and the lion: lasting reputation, wisdom and resilience.',
    ['Gaja Kesari is one of the most famous yogas. Jupiter supports the Moon, giving a steady, optimistic mind, good reputation, intelligence and the ability to overcome adversity like a lion among elephants.', 'Its strength depends heavily on the dignity of Jupiter and the Moon. When either is debilitated or combust, the yoga gives good intentions but weaker results.'],
    ['reputation', 'wisdom', 'emotional resilience', 'prosperity'], ['over-confidence'], 'benefic', 2),
  'budha-aditya': def('budha-aditya', 'Budha-Aditya Yoga', 'solar', 'The Sun and Mercury in the same sign.',
    'Bright intelligence recognised by others.',
    ['Mercury with the Sun gives a clear, articulate mind and recognition for intellectual work. It is common because Mercury never strays far from the Sun.', 'It is strongest when Mercury is not deeply combust (more than about 10–14° from the Sun) and when the sign is friendly.'],
    ['intelligence', 'communication', 'recognition'], ['ego in opinions'], 'benefic', 1),
  'chandra-mangala': def('chandra-mangala', 'Chandra-Mangala Yoga', 'dhana', 'The Moon and Mars conjunct, or in mutual 7th aspect.',
    'Emotional drive that turns into earning power.',
    ['This yoga gives enterprise and a knack for making money, often through business, property or bold ventures. Emotions are passionate and quick.', 'It can make the temper sharp, especially when the Moon is weak.'],
    ['earning power', 'enterprise', 'courage'], ['emotional volatility', 'temper'], 'benefic', 1),
  'raja': def('raja', 'Raja Yoga', 'raja', 'A lord of a kendra (1, 4, 7, 10) related to a lord of a trikona (1, 5, 9) by conjunction, mutual aspect or sign exchange.',
    'Power and success: the union of effort (kendra) and grace (trikona).',
    ['Raja yogas combine the houses of action with the houses of fortune. They give status, authority and the opportunity to rise, and they tend to activate in the dasha periods of the planets involved.', 'The more the lords are strong and well placed, and the fewer dusthana lordships they carry, the more powerful the result.'],
    ['status', 'success', 'authority', 'opportunity'], ['results depend on dasha timing'], 'benefic', 2),
  yogakaraka: def('yogakaraka', 'Yogakaraka Planet', 'raja', 'A single planet that rules both a kendra (4, 7 or 10) and a trikona (5 or 9) for the ascendant.',
    'One planet carries a Raja yoga all by itself.',
    ['For some ascendants one planet owns both a kendra and a trikona: Mars for Cancer and Leo, Venus for Capricorn and Aquarius, Saturn for Taurus and Libra. That planet becomes the chart’s yogakaraka and its periods are often the most productive in life.', 'Its strength by sign and house determines how much of the promise is delivered.'],
    ['success in its periods', 'reliable support'], ['delivery depends on its dignity'], 'benefic', 2),
  'dharma-karmadhipati': def('dharma-karmadhipati', 'Dharma-Karmadhipati Yoga', 'raja', 'The lords of the 9th and 10th houses related by conjunction, mutual aspect or exchange.',
    'Purpose and career aligned: one of the strongest Raja yogas.',
    ['When the lords of dharma (9th) and karma (10th) combine, work becomes a vehicle for purpose and fortune supports ambition. This gives recognition, ethical leadership and the sense that one’s career is meaningful.', 'It is especially potent in the dashas of the 9th and 10th lords.'],
    ['meaningful career', 'recognition', 'ethical leadership'], [], 'benefic', 3),
  dhana: def('dhana', 'Dhana Yoga', 'dhana', 'Lords of wealth houses (1, 2, 5, 9, 11) related to each other by conjunction, mutual aspect or exchange.',
    'A combination for accumulating wealth.',
    ['Dhana yogas connect the houses of earning (11th), saving (2nd) and fortune (5th, 9th). They show the capacity to build wealth, especially in the periods of the planets involved.', 'Strong, well-placed lords give large and stable wealth; weak or afflicted lords give modest or fluctuating results.'],
    ['wealth accumulation', 'financial luck'], ['dependent on planetary strength'], 'benefic', 2),
  lakshmi: def('lakshmi', 'Lakshmi Yoga', 'dhana', 'The 9th lord in its own sign or exaltation in a kendra or trikona, with a strong ascendant lord.',
    'Blessings of the goddess of fortune: wealth with grace.',
    ['Lakshmi yoga gives prosperity, refinement, generosity and a good name. Wealth comes in a way that feels deserved and is used well.', 'It needs a strong ascendant lord to be fully effective.'],
    ['prosperity', 'grace', 'good name'], [], 'benefic', 3),
  harsha: def('harsha', 'Harsha Yoga', 'viparita', 'The 6th lord placed in the 6th, 8th or 12th house.',
    'Viparita Raja yoga: enemies and illness defeat themselves.',
    ['Harsha means joy. The lord of struggle sits in a house of struggle, and the two negatives cancel. The person tends to defeat enemies, recover from illness and enjoy good health and happiness.', 'Results often come after an initial difficulty.'],
    ['victory over enemies', 'good health', 'resilience'], ['rise through others’ fall'], 'benefic', 2),
  sarala: def('sarala', 'Sarala Yoga', 'viparita', 'The 8th lord placed in the 6th, 8th or 12th house.',
    'Viparita Raja yoga: fearlessness and long life.',
    ['Sarala makes a person resilient, fearless and long-lived. Crises tend to turn in their favour, and they may gain through situations that ruin others.', 'Results usually follow a period of turbulence.'],
    ['fearlessness', 'longevity', 'resilience'], ['turbulent beginnings'], 'benefic', 2),
  vimala: def('vimala', 'Vimala Yoga', 'viparita', 'The 12th lord placed in the 6th, 8th or 12th house.',
    'Viparita Raja yoga: thrift, independence and a pure character.',
    ['Vimala gives frugality, independence and good conduct. Expenses are controlled and losses can turn into gains.', 'It also supports spiritual life.'],
    ['thrift', 'independence', 'good conduct'], [], 'benefic', 2),
  'neecha-bhanga': def('neecha-bhanga', 'Neecha Bhanga Raja Yoga', 'neecha-bhanga', 'A debilitated planet whose debilitation is cancelled: e.g. the lord of its debilitation sign or of its exaltation sign is in a kendra from the ascendant or Moon, or the planet is aspected by the lord of its sign.',
    'Weakness turned into strength: rise after a fall.',
    ['Neecha bhanga cancels the weakness of a debilitated planet. Classical texts say it can produce a Raja yoga: the person struggles early in the area of that planet, then rises to unusual heights there.', 'The more cancellation conditions apply, the stronger the effect.'],
    ['rise after struggle', 'hard-won mastery'], ['early difficulties'], 'benefic', 2),
  'maha-parivartana': def('maha-parivartana', 'Maha Parivartana Yoga', 'parivartana', 'Two planets in each other’s signs, where neither house involved is the 3rd, 6th, 8th or 12th.',
    'A powerful exchange that binds two areas of life together for the good.',
    ['When two lords swap signs, each acts as if in its own sign and the two houses become partners. A Maha exchange between good houses gives wealth, status and lasting support between those areas of life.'],
    ['mutual support between houses', 'strength'], [], 'benefic', 2),
  'khala-parivartana': def('khala-parivartana', 'Khala Parivartana Yoga', 'parivartana', 'A sign exchange involving the 3rd house lord (and not 6, 8, 12).',
    'An exchange that brings fluctuating fortune and self-made effort.',
    ['Khala exchanges tie the 3rd house of effort and risk to another area. Results swing between good and difficult, and much depends on personal initiative.'],
    ['initiative', 'courage'], ['fluctuating fortune'], 'mixed', 0),
  'dainya-parivartana': def('dainya-parivartana', 'Dainya Parivartana Yoga', 'parivartana', 'A sign exchange involving the 6th, 8th or 12th house lord.',
    'An exchange that brings early hardship but can turn into a Viparita-type rise.',
    ['Dainya exchanges link a dusthana with another house, bringing struggle, debt, illness or loss into that area. If both houses are dusthanas, the result can turn into a Viparita Raja yoga.'],
    ['resilience'], ['hardship in the houses involved'], 'challenging', -1),
  sunapha: def('sunapha', 'Sunapha Yoga', 'lunar', 'A planet other than the Sun, Rahu or Ketu in the 2nd house from the Moon.',
    'Self-made wealth and a resourceful mind.',
    ['Sunapha gives self-earned property, intelligence and good reputation. The planet involved colours the result: Mars gives courage, Mercury skill, Jupiter learning, Venus comforts, Saturn persistence.'],
    ['self-earned wealth', 'resourcefulness'], [], 'benefic', 1),
  anapha: def('anapha', 'Anapha Yoga', 'lunar', 'A planet other than the Sun, Rahu or Ketu in the 12th house from the Moon.',
    'A dignified, healthy and well-mannered nature.',
    ['Anapha gives good health, an attractive personality and good conduct, and often a later life of detachment and contentment.'],
    ['good health', 'dignity', 'contentment'], [], 'benefic', 1),
  durudhara: def('durudhara', 'Durudhara Yoga', 'lunar', 'Planets other than the Sun and nodes in both the 2nd and 12th from the Moon.',
    'A mind supported on both sides: wealth, comfort and generosity.',
    ['Durudhara gives wealth, vehicles, servants and generosity. The mind feels supported and secure.'],
    ['wealth', 'comfort', 'generosity'], [], 'benefic', 2),
  kemadruma: def('kemadruma', 'Kemadruma Yoga', 'arishta', 'No planets (other than the Sun and nodes) in the 2nd or 12th from the Moon, and none in a kendra from the Moon or ascendant.',
    'A lonely Moon: periods of emotional isolation or hardship.',
    ['Kemadruma leaves the Moon without support. Classical texts link it to poverty and sorrow, but modern practice sees it more as periods of loneliness, self-reliance and emotional struggle.', 'It is cancelled by planets in kendras from the Moon or ascendant, which is why this detector checks those.'],
    ['self-reliance'], ['emotional isolation', 'financial ups and downs'], 'challenging', -2),
  vesi: def('vesi', 'Vesi Yoga', 'solar', 'A planet other than the Moon, Rahu or Ketu in the 2nd from the Sun.',
    'Balanced outlook and truthful speech.',
    ['Vesi gives a balanced outlook, truthful speech and a steady character. Benefics make it more fortunate.'],
    ['truthfulness', 'balance'], [], 'benefic', 1),
  vasi: def('vasi', 'Vasi Yoga', 'solar', 'A planet other than the Moon, Rahu or Ketu in the 12th from the Sun.',
    'Prosperity, charity and good memory.',
    ['Vasi gives happiness, charity and the ability to remember and plan. Benefics make it more fortunate.'],
    ['charity', 'prosperity'], [], 'benefic', 1),
  ubhayachari: def('ubhayachari', 'Ubhayachari Yoga', 'solar', 'Planets other than the Moon and nodes in both the 2nd and 12th from the Sun.',
    'A king-like status, eloquence and resourcefulness.',
    ['Ubhayachari gives eloquence, a strong body and a position of status. The Sun is supported on both sides.'],
    ['eloquence', 'status'], [], 'benefic', 2),
  adhi: def('adhi', 'Adhi Yoga', 'lunar', 'Benefics (Mercury, Jupiter, Venus) in the 6th, 7th and/or 8th from the Moon.',
    'Leadership, comfort and victory over opponents.',
    ['Adhi yoga gives a polite, trustworthy and successful person, often a leader or minister. All three benefics give the full yoga; two or one give lesser forms.'],
    ['leadership', 'comfort', 'trustworthiness'], [], 'benefic', 2),
  amala: def('amala', 'Amala Yoga', 'other', 'A natural benefic in the 10th from the ascendant or the Moon.',
    'A spotless reputation through good deeds.',
    ['Amala means stainless. A benefic in the 10th gives a good reputation, ethical conduct and lasting fame for work done well.'],
    ['reputation', 'ethics'], [], 'benefic', 2),
  saraswati: def('saraswati', 'Saraswati Yoga', 'other', 'Jupiter, Venus and Mercury all in kendras, trikonas or the 2nd house, with Jupiter in good dignity.',
    'Blessings of the goddess of learning: scholarship and the arts.',
    ['Saraswati yoga gives learning, eloquence, poetic and artistic talent, and respect for knowledge.'],
    ['learning', 'eloquence', 'artistic talent'], [], 'benefic', 3),
  vasumati: def('vasumati', 'Vasumati Yoga', 'dhana', 'All natural benefics in upachaya houses (3, 6, 10, 11) from the ascendant or Moon.',
    'Wealth that keeps growing.',
    ['Vasumati gives steadily increasing wealth. Benefics in growth houses keep improving over time.'],
    ['growing wealth'], [], 'benefic', 2),
  'shubha-kartari': def('shubha-kartari', 'Shubha Kartari Yoga', 'other', 'Benefics in both the 2nd and 12th from the ascendant.',
    'The ascendant is hemmed in by benefics: protection and comfort.',
    ['Shubha kartari surrounds the self with good influences, giving health, wealth and protection.'],
    ['protection', 'well-being'], [], 'benefic', 2),
  'papa-kartari': def('papa-kartari', 'Papa Kartari Yoga', 'arishta', 'Malefics in both the 2nd and 12th from the ascendant.',
    'The ascendant is hemmed in by malefics: pressure and constraint.',
    ['Papa kartari squeezes the ascendant between malefics, bringing pressure, health concerns or a sense of being restricted. Strong ascendant lords reduce the effect.'],
    ['endurance'], ['pressure', 'health concerns'], 'challenging', -2),
  shakata: def('shakata', 'Shakata Yoga', 'arishta', 'The Moon in the 6th, 8th or 12th from Jupiter (cancelled if the Moon is in a kendra from the ascendant).',
    'The cart wheel: fortune that rises and falls.',
    ['Shakata gives cycles of gain and loss, like a turning wheel. It is cancelled when the Moon is in a kendra from the ascendant, which this detector checks.'],
    ['resilience'], ['fluctuating fortune'], 'challenging', -1),
  pravrajya: def('pravrajya', 'Pravrajya Yoga', 'spiritual', 'Four or more planets in a single sign.',
    'A strong pull toward renunciation or a life devoted to a single purpose.',
    ['Classically this combination indicates a renunciate or ascetic. Today it more often shows intense focus, spiritual seeking or a life dominated by one theme. The strongest planet in the group shows the type of path.'],
    ['focus', 'spiritual depth'], ['imbalance', 'withdrawal'], 'mixed', 0),
  'sankhya-gola': def('sankhya-gola', 'Gola Yoga (Nabhasa)', 'nabhasa', 'All seven planets in one sign.', 'Extreme concentration of life force in one area.', ['A rare pattern of total focus, sometimes associated with hardship or extreme specialisation.'], ['focus'], ['imbalance'], 'challenging', -1),
  'sankhya-yuga': def('sankhya-yuga', 'Yuga Yoga (Nabhasa)', 'nabhasa', 'All seven planets in two signs.', 'A life built on a single duality.', ['Two strong centres of activity. Can give heterodox views or extreme situations.'], ['concentration'], ['imbalance'], 'mixed', -1),
  'sankhya-shoola': def('sankhya-shoola', 'Shoola Yoga (Nabhasa)', 'nabhasa', 'All seven planets in three signs.', 'Sharp, intense and combative.', ['Energy concentrated in three areas gives courage and sharpness, and sometimes conflict.'], ['courage'], ['conflict'], 'mixed', 0),
  'sankhya-kedara': def('sankhya-kedara', 'Kedara Yoga (Nabhasa)', 'nabhasa', 'All seven planets in four signs.', 'Productive and useful to others, like a farmer’s field.', ['Kedara gives usefulness, agriculture or land, and a helpful nature.'], ['usefulness', 'productivity'], [], 'benefic', 1),
  'sankhya-pasha': def('sankhya-pasha', 'Pasha Yoga (Nabhasa)', 'nabhasa', 'All seven planets in five signs.', 'Skilled, connected and capable of binding things together.', ['Pasha gives skill in work and many connections, but can bring bonds or obligations.'], ['skill', 'networks'], ['obligations'], 'mixed', 0),
  'sankhya-dama': def('sankhya-dama', 'Dama Yoga (Nabhasa)', 'nabhasa', 'All seven planets in six signs.', 'Generous and helpful to many.', ['Dama gives generosity, fame and helpfulness.'], ['generosity', 'fame'], [], 'benefic', 1),
  'sankhya-veena': def('sankhya-veena', 'Veena Yoga (Nabhasa)', 'nabhasa', 'All seven planets in seven signs.', 'A life with many strings: versatile, artistic and harmonious.', ['Veena gives a love of music and the arts, many interests and a pleasant life.'], ['versatility', 'artistic sense'], [], 'benefic', 1),
  'guru-chandala': def('guru-chandala', 'Guru-Chandala Yoga', 'arishta', 'Jupiter conjunct Rahu (or Ketu in some traditions).',
    'Wisdom challenged by unorthodox ambition.',
    ['This combination questions tradition and authority. It can create innovators and reformers, or it can lead to misplaced trust and ethical confusion. Strength of Jupiter decides which.'],
    ['innovation', 'unconventional wisdom'], ['ethical confusion', 'misplaced trust'], 'challenging', -1),
  angaraka: def('angaraka', 'Angaraka Yoga', 'arishta', 'Mars conjunct Rahu.',
    'Explosive energy that needs a channel.',
    ['Angaraka intensifies Mars, giving drive and fearlessness but also anger, accidents and conflict. Physical activity and clear goals help channel it.'],
    ['drive', 'fearlessness'], ['anger', 'accidents'], 'challenging', -2),
};

// ------------------------------------------------------------------ detection

const result = (
  id: string,
  strength: Strength,
  involved: PlanetId[],
  houses: HouseNumber[],
  reason: string,
  nameOverride?: string,
): YogaResult => {
  const d = YOGA_DEFINITIONS[id];
  return { id, name: nameOverride ?? d.name, category: d.category, present: true, strength, involved, houses, reason, reading: d.reading };
};

const nameOf = (p: PlanetId) => PLANET_PROFILES[p].name;
const ord = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

const strengthFrom = (chart: ChartInput, ps: PlanetId[]): Strength => {
  const strong = ps.filter((p) => isStrong(chart, p)).length;
  const weak = ps.filter((p) => isWeak(chart, p)).length;
  if (weak > 0 && strong === 0) return 'weak';
  if (strong > 0 && weak === 0) return 'strong';
  return 'moderate';
};

const MAHAPURUSHA: [string, PlanetId][] = [
  ['ruchaka', 'mars'],
  ['bhadra', 'mercury'],
  ['hamsa', 'jupiter'],
  ['malavya', 'venus'],
  ['sasa', 'saturn'],
];

function detectMahapurusha(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  for (const [id, p] of MAHAPURUSHA) {
    const pr = PLANET_PROFILES[p];
    const s = chart.planets[p].sign;
    const dignified = pr.ownSigns.includes(s) || pr.exaltation?.sign === s;
    const h = houseOf(chart, p);
    if (dignified && KENDRA.includes(h)) {
      const st: Strength = chart.planets[p].combust ? 'moderate' : 'strong';
      out.push(result(id, st, [p], [h], `${nameOf(p)} is ${pr.exaltation?.sign === s ? 'exalted' : 'in its own sign'} in the ${ord(h)} house, a kendra.`));
    }
  }
  return out;
}

function detectLunarSolar(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  // Gaja Kesari
  const jFromMoon = houseFromPlanet(chart, 'moon', 'jupiter');
  if (KENDRA.includes(jFromMoon)) {
    out.push(result('gaja-kesari', strengthFrom(chart, ['jupiter', 'moon']), ['jupiter', 'moon'], [houseOf(chart, 'jupiter'), houseOf(chart, 'moon')], `Jupiter is in the ${ord(jFromMoon)} from the Moon.`));
  }
  // Budha-Aditya
  if (sameSign(chart, 'sun', 'mercury')) {
    const sep = Math.abs(((chart.planets.mercury.longitude - chart.planets.sun.longitude + 540) % 360) - 180);
    const st: Strength = sep < 4 ? 'weak' : chart.planets.mercury.combust ? 'moderate' : 'strong';
    out.push(result('budha-aditya', st, ['sun', 'mercury'], [houseOf(chart, 'sun')], `The Sun and Mercury share the ${ord(houseOf(chart, 'sun'))} house (${sep.toFixed(1)}° apart).`));
  }
  // Chandra-Mangala
  if (sameSign(chart, 'moon', 'mars') || houseFromPlanet(chart, 'moon', 'mars') === 7) {
    out.push(result('chandra-mangala', strengthFrom(chart, ['moon', 'mars']), ['moon', 'mars'], [houseOf(chart, 'moon'), houseOf(chart, 'mars')], sameSign(chart, 'moon', 'mars') ? 'The Moon and Mars are conjunct.' : 'The Moon and Mars face each other across the 7th.'));
  }
  // Moon-based: Sunapha / Anapha / Durudhara / Kemadruma
  const eligibleMoon = SEVEN_PLANETS.filter((p) => p !== 'sun' && p !== 'moon') as PlanetId[];
  const in2 = eligibleMoon.filter((p) => houseFromPlanet(chart, 'moon', p) === 2);
  const in12 = eligibleMoon.filter((p) => houseFromPlanet(chart, 'moon', p) === 12);
  if (in2.length && in12.length) out.push(result('durudhara', strengthFrom(chart, [...in2, ...in12]), [...in2, ...in12, 'moon'], [houseOf(chart, 'moon')], `${in2.map(nameOf).join(', ')} in the 2nd and ${in12.map(nameOf).join(', ')} in the 12th from the Moon.`));
  else if (in2.length) out.push(result('sunapha', strengthFrom(chart, in2), [...in2, 'moon'], [houseOf(chart, 'moon')], `${in2.map(nameOf).join(', ')} in the 2nd from the Moon.`));
  else if (in12.length) out.push(result('anapha', strengthFrom(chart, in12), [...in12, 'moon'], [houseOf(chart, 'moon')], `${in12.map(nameOf).join(', ')} in the 12th from the Moon.`));
  else {
    const kendraFromMoon = eligibleMoon.some((p) => KENDRA.includes(houseFromPlanet(chart, 'moon', p)));
    const kendraFromLagna = eligibleMoon.some((p) => KENDRA.includes(houseOf(chart, p)));
    if (!kendraFromMoon && !kendraFromLagna) {
      out.push(result('kemadruma', 'strong', ['moon'], [houseOf(chart, 'moon')], 'No planets in the 2nd or 12th from the Moon, and no planets in kendras from the Moon or ascendant to cancel it.'));
    }
  }
  // Sun-based: Vesi / Vasi / Ubhayachari
  const eligibleSun = SEVEN_PLANETS.filter((p) => p !== 'sun' && p !== 'moon') as PlanetId[];
  const s2 = eligibleSun.filter((p) => houseFromPlanet(chart, 'sun', p) === 2);
  const s12 = eligibleSun.filter((p) => houseFromPlanet(chart, 'sun', p) === 12);
  if (s2.length && s12.length) out.push(result('ubhayachari', strengthFrom(chart, [...s2, ...s12]), [...s2, ...s12, 'sun'], [houseOf(chart, 'sun')], `${s2.map(nameOf).join(', ')} in the 2nd and ${s12.map(nameOf).join(', ')} in the 12th from the Sun.`));
  else if (s2.length) out.push(result('vesi', strengthFrom(chart, s2), [...s2, 'sun'], [houseOf(chart, 'sun')], `${s2.map(nameOf).join(', ')} in the 2nd from the Sun.`));
  else if (s12.length) out.push(result('vasi', strengthFrom(chart, s12), [...s12, 'sun'], [houseOf(chart, 'sun')], `${s12.map(nameOf).join(', ')} in the 12th from the Sun.`));
  // Adhi
  const adhiPlanets = (['mercury', 'jupiter', 'venus'] as PlanetId[]).filter((p) => [6, 7, 8].includes(houseFromPlanet(chart, 'moon', p)));
  if (adhiPlanets.length >= 2) {
    out.push(result('adhi', adhiPlanets.length === 3 ? 'strong' : 'moderate', adhiPlanets, adhiPlanets.map((p) => houseOf(chart, p)), `${adhiPlanets.map(nameOf).join(', ')} in the 6th–8th from the Moon.`));
  }
  // Shakata
  const mFromJ = houseFromPlanet(chart, 'jupiter', 'moon');
  if ([6, 8, 12].includes(mFromJ) && !KENDRA.includes(houseOf(chart, 'moon'))) {
    out.push(result('shakata', 'moderate', ['moon', 'jupiter'], [houseOf(chart, 'moon')], `The Moon is in the ${ord(mFromJ)} from Jupiter and not in a kendra from the ascendant.`));
  }
  return out;
}

function detectRaja(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  const seen = new Set<string>();
  // Yogakaraka
  for (const p of SEVEN_PLANETS) {
    const ruled = housesRuledBy(chart, p);
    const k = ruled.filter((h) => [4, 7, 10].includes(h));
    const t = ruled.filter((h) => [5, 9].includes(h));
    if (k.length && t.length) {
      out.push(result('yogakaraka', isWeak(chart, p) ? 'weak' : isStrong(chart, p) ? 'strong' : 'moderate', [p], [...k, ...t], `${nameOf(p)} rules the ${ord(k[0])} (kendra) and ${ord(t[0])} (trikona) for this ascendant.`));
    }
  }
  // Kendra–trikona lords
  for (const kh of KENDRA) {
    for (const th of TRIKONA) {
      if (kh === th) continue;
      const a = lordOfHouse(chart, kh);
      const b = lordOfHouse(chart, th);
      if (a === b) continue;
      const rel = related(chart, a, b);
      if (!rel) continue;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const dusthanaTaint = [...housesRuledBy(chart, a), ...housesRuledBy(chart, b)].some((h) => DUSTHANA.includes(h));
      let st = strengthFrom(chart, [a, b]);
      if (dusthanaTaint && st === 'strong') st = 'moderate';
      out.push(result('raja', st, [a, b], [kh as HouseNumber, th as HouseNumber], `${nameOf(a)} (lord of ${ord(kh)}) and ${nameOf(b)} (lord of ${ord(th)}) are linked by ${rel}.`));
    }
  }
  // Dharma-Karmadhipati
  const l9 = lordOfHouse(chart, 9);
  const l10 = lordOfHouse(chart, 10);
  const rel = l9 === l10 ? 'the same planet' : related(chart, l9, l10);
  if (rel) out.push(result('dharma-karmadhipati', strengthFrom(chart, [l9, l10]), l9 === l10 ? [l9] : [l9, l10], [9, 10], `The 9th lord ${nameOf(l9)} and 10th lord ${nameOf(l10)} are linked by ${rel}.`));
  return out;
}

function detectDhana(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  const houses = [1, 2, 5, 9, 11];
  const seen = new Set<string>();
  for (let i = 0; i < houses.length; i++) {
    for (let j = i + 1; j < houses.length; j++) {
      const a = lordOfHouse(chart, houses[i]);
      const b = lordOfHouse(chart, houses[j]);
      if (a === b) continue;
      // Require at least one of 2 or 11 for a wealth combination proper.
      if (![houses[i], houses[j]].some((h) => h === 2 || h === 11)) continue;
      const rel = related(chart, a, b);
      if (!rel) continue;
      const key = [a, b].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(result('dhana', strengthFrom(chart, [a, b]), [a, b], [houses[i] as HouseNumber, houses[j] as HouseNumber], `${nameOf(a)} (lord of ${ord(houses[i])}) and ${nameOf(b)} (lord of ${ord(houses[j])}) are linked by ${rel}.`));
    }
  }
  // Lakshmi
  const l9 = lordOfHouse(chart, 9);
  const l1 = lordOfHouse(chart, 1);
  const h9 = houseOf(chart, l9);
  if (isStrong(chart, l9) && (KENDRA.includes(h9) || TRIKONA.includes(h9)) && !isWeak(chart, l1) && (isStrong(chart, l1) || KENDRA.includes(houseOf(chart, l1)) || TRIKONA.includes(houseOf(chart, l1)))) {
    out.push(result('lakshmi', isStrong(chart, l1) ? 'strong' : 'moderate', [l9, l1], [9, h9], `The 9th lord ${nameOf(l9)} is ${dignityOf(chart, l9)} in the ${ord(h9)}, and the ascendant lord ${nameOf(l1)} is well placed.`));
  }
  // Vasumati
  const benefics = (['mercury', 'jupiter', 'venus'] as PlanetId[]);
  if (benefics.every((p) => UPACHAYA.includes(houseOf(chart, p))) || benefics.every((p) => UPACHAYA.includes(houseFromPlanet(chart, 'moon', p)))) {
    out.push(result('vasumati', strengthFrom(chart, benefics), benefics, benefics.map((p) => houseOf(chart, p)), 'Mercury, Jupiter and Venus all occupy upachaya houses (3, 6, 10, 11).'));
  }
  return out;
}

function detectViparita(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  const map: [number, string][] = [[6, 'harsha'], [8, 'sarala'], [12, 'vimala']];
  for (const [h, id] of map) {
    const l = lordOfHouse(chart, h);
    const pos = houseOf(chart, l);
    if (DUSTHANA.includes(pos)) {
      // Weakened if the lord is conjunct a lord of a good house that is not itself dusthana-ruled.
      out.push(result(id, isWeak(chart, l) ? 'moderate' : 'strong', [l], [h as HouseNumber, pos], `${nameOf(l)}, lord of the ${ord(h)}, sits in the ${ord(pos)}.`));
    }
  }
  return out;
}

function detectNeechaBhanga(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  for (const p of SEVEN_PLANETS) {
    const pr = PLANET_PROFILES[p];
    if (pr.debilitation?.sign !== chart.planets[p].sign) continue;
    const reasons: string[] = [];
    const debLord = signLord(chart.planets[p].sign);
    const exSign = pr.exaltation!.sign;
    const exLord = signLord(exSign);
    // Which planet gets exalted in the debilitation sign?
    const exaltedHere = SEVEN_PLANETS.find((q) => PLANET_PROFILES[q].exaltation?.sign === chart.planets[p].sign);
    const kendraFromLagnaOrMoon = (q: PlanetId) => KENDRA.includes(houseOf(chart, q)) || KENDRA.includes(houseFromPlanet(chart, 'moon', q));
    if (debLord !== p && kendraFromLagnaOrMoon(debLord)) reasons.push(`its dispositor ${nameOf(debLord)} is in a kendra from the ascendant or Moon`);
    if (exLord !== p && kendraFromLagnaOrMoon(exLord)) reasons.push(`the lord of its exaltation sign, ${nameOf(exLord)}, is in a kendra from the ascendant or Moon`);
    if (exaltedHere && exaltedHere !== p && kendraFromLagnaOrMoon(exaltedHere)) reasons.push(`${nameOf(exaltedHere)}, which is exalted in this sign, is in a kendra`);
    if (debLord !== p && (aspectsPlanet(chart, debLord, p) || sameSign(chart, debLord, p))) reasons.push(`its dispositor ${nameOf(debLord)} aspects or joins it`);
    if (debLord !== p && exchange(chart, p, debLord)) reasons.push(`it exchanges signs with ${nameOf(debLord)}`);
    if (KENDRA.includes(houseOf(chart, p))) reasons.push('it sits in a kendra from the ascendant');
    if (chart.planets[p].retrograde) reasons.push('it is retrograde (a view held by some astrologers)');
    if (reasons.length) {
      out.push(result('neecha-bhanga', reasons.length >= 3 ? 'strong' : reasons.length === 2 ? 'moderate' : 'weak', [p], [houseOf(chart, p)], `${nameOf(p)} is debilitated, but ${reasons.join('; ')}.`, `Neecha Bhanga of ${nameOf(p)}`));
    }
  }
  return out;
}

function detectParivartana(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  for (let i = 0; i < SEVEN_PLANETS.length; i++) {
    for (let j = i + 1; j < SEVEN_PLANETS.length; j++) {
      const a = SEVEN_PLANETS[i];
      const b = SEVEN_PLANETS[j];
      if (!exchange(chart, a, b)) continue;
      const ha = houseOf(chart, a);
      const hb = houseOf(chart, b);
      const hs = [ha, hb];
      const id = hs.some((h) => DUSTHANA.includes(h)) ? 'dainya-parivartana' : hs.includes(3) ? 'khala-parivartana' : 'maha-parivartana';
      out.push(result(id, id === 'maha-parivartana' ? 'strong' : 'moderate', [a, b], [ha, hb], `${nameOf(a)} (in the ${ord(ha)}) and ${nameOf(b)} (in the ${ord(hb)}) occupy each other’s signs, linking the ${ord(ha)} and ${ord(hb)} houses.`));
    }
  }
  return out;
}

function detectOther(chart: ChartInput): YogaResult[] {
  const out: YogaResult[] = [];
  // Amala
  const amalaL = (['jupiter', 'venus', 'mercury', 'moon'] as PlanetId[]).filter((p) => houseOf(chart, p) === 10 && isBenefic(chart, p));
  const amalaM = (['jupiter', 'venus', 'mercury'] as PlanetId[]).filter((p) => houseFromPlanet(chart, 'moon', p) === 10 && isBenefic(chart, p));
  if (amalaL.length || amalaM.length) {
    const ps = [...new Set([...amalaL, ...amalaM])];
    out.push(result('amala', amalaL.length ? 'strong' : 'moderate', ps, [10], `${ps.map(nameOf).join(', ')} in the 10th from the ${amalaL.length ? 'ascendant' : 'Moon'}.`));
  }
  // Saraswati
  const sGood = [1, 2, 4, 5, 7, 9, 10];
  const sPl: PlanetId[] = ['jupiter', 'venus', 'mercury'];
  if (sPl.every((p) => sGood.includes(houseOf(chart, p))) && !['debilitated', 'enemy', 'great_enemy'].includes(dignityOf(chart, 'jupiter'))) {
    out.push(result('saraswati', strengthFrom(chart, sPl), sPl, sPl.map((p) => houseOf(chart, p)), 'Jupiter, Venus and Mercury all occupy kendras, trikonas or the 2nd, with Jupiter in reasonable dignity.'));
  }
  // Kartari on lagna
  const in2 = PLANETS.filter((p) => houseOf(chart, p) === 2);
  const in12 = PLANETS.filter((p) => houseOf(chart, p) === 12);
  if (in2.length && in12.length) {
    if (in2.every((p) => isBenefic(chart, p)) && in12.every((p) => isBenefic(chart, p))) out.push(result('shubha-kartari', 'moderate', [...in2, ...in12], [2, 12], 'Only benefics occupy the houses on either side of the ascendant.'));
    else if (in2.every((p) => !isBenefic(chart, p)) && in12.every((p) => !isBenefic(chart, p))) out.push(result('papa-kartari', isStrong(chart, lordOfHouse(chart, 1)) ? 'weak' : 'moderate', [...in2, ...in12], [2, 12], 'Only malefics occupy the houses on either side of the ascendant.'));
  }
  // Pravrajya
  const bySign = new Map<number, PlanetId[]>();
  for (const p of SEVEN_PLANETS) bySign.set(chart.planets[p].sign, [...(bySign.get(chart.planets[p].sign) ?? []), p]);
  for (const [, ps] of bySign) if (ps.length >= 4) out.push(result('pravrajya', ps.length >= 5 ? 'strong' : 'moderate', ps, [houseOf(chart, ps[0])], `${ps.map(nameOf).join(', ')} share one sign.`));
  // Sankhya nabhasa
  const ids = ['', 'sankhya-gola', 'sankhya-yuga', 'sankhya-shoola', 'sankhya-kedara', 'sankhya-pasha', 'sankhya-dama', 'sankhya-veena'];
  const n = bySign.size;
  out.push(result(ids[n], 'moderate', [...SEVEN_PLANETS], [...bySign.keys()].map((s) => signDistance(chart.ascendantSign, s) as HouseNumber), `The seven planets occupy ${n} sign${n === 1 ? '' : 's'}.`));
  // Malefic node conjunctions
  if (sameSign(chart, 'jupiter', 'rahu')) out.push(result('guru-chandala', isStrong(chart, 'jupiter') ? 'weak' : 'moderate', ['jupiter', 'rahu'], [houseOf(chart, 'jupiter')], 'Jupiter shares a sign with Rahu.'));
  if (sameSign(chart, 'mars', 'rahu')) out.push(result('angaraka', 'moderate', ['mars', 'rahu'], [houseOf(chart, 'mars')], 'Mars shares a sign with Rahu.'));
  return out;
}

/** Detect all supported yogas present in the chart. */
export function detectYogas(chart: ChartInput): YogaResult[] {
  return [
    ...detectMahapurusha(chart),
    ...detectRaja(chart),
    ...detectDhana(chart),
    ...detectLunarSolar(chart),
    ...detectViparita(chart),
    ...detectNeechaBhanga(chart),
    ...detectParivartana(chart),
    ...detectOther(chart),
  ];
}
