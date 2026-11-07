import type { PlanetId, VargaId } from '../types/chart';

export interface SignInfo {
  num: number;
  name: string;
  sanskrit: string;
  glyph: string;
  short: string;
  lord: PlanetId;
  element: 'Fire' | 'Earth' | 'Air' | 'Water';
  modality: 'Movable' | 'Fixed' | 'Dual';
}

export const SIGNS: SignInfo[] = [
  { num: 1, name: 'Aries', sanskrit: 'Mesha', glyph: '♈\uFE0E', short: 'Ar', lord: 'mars', element: 'Fire', modality: 'Movable' },
  { num: 2, name: 'Taurus', sanskrit: 'Vrishabha', glyph: '♉\uFE0E', short: 'Ta', lord: 'venus', element: 'Earth', modality: 'Fixed' },
  { num: 3, name: 'Gemini', sanskrit: 'Mithuna', glyph: '♊\uFE0E', short: 'Ge', lord: 'mercury', element: 'Air', modality: 'Dual' },
  { num: 4, name: 'Cancer', sanskrit: 'Karka', glyph: '♋\uFE0E', short: 'Cn', lord: 'moon', element: 'Water', modality: 'Movable' },
  { num: 5, name: 'Leo', sanskrit: 'Simha', glyph: '♌\uFE0E', short: 'Le', lord: 'sun', element: 'Fire', modality: 'Fixed' },
  { num: 6, name: 'Virgo', sanskrit: 'Kanya', glyph: '♍\uFE0E', short: 'Vi', lord: 'mercury', element: 'Earth', modality: 'Dual' },
  { num: 7, name: 'Libra', sanskrit: 'Tula', glyph: '♎\uFE0E', short: 'Li', lord: 'venus', element: 'Air', modality: 'Movable' },
  { num: 8, name: 'Scorpio', sanskrit: 'Vrishchika', glyph: '♏\uFE0E', short: 'Sc', lord: 'mars', element: 'Water', modality: 'Fixed' },
  { num: 9, name: 'Sagittarius', sanskrit: 'Dhanu', glyph: '♐\uFE0E', short: 'Sg', lord: 'jupiter', element: 'Fire', modality: 'Dual' },
  { num: 10, name: 'Capricorn', sanskrit: 'Makara', glyph: '♑\uFE0E', short: 'Cp', lord: 'saturn', element: 'Earth', modality: 'Movable' },
  { num: 11, name: 'Aquarius', sanskrit: 'Kumbha', glyph: '♒\uFE0E', short: 'Aq', lord: 'saturn', element: 'Air', modality: 'Fixed' },
  { num: 12, name: 'Pisces', sanskrit: 'Meena', glyph: '♓\uFE0E', short: 'Pi', lord: 'jupiter', element: 'Water', modality: 'Dual' },
];

export interface PlanetInfo {
  id: PlanetId;
  name: string;
  sanskrit: string;
  glyph: string;
  abbr: string;
  color: string;
  nature: 'benefic' | 'malefic' | 'neutral';
  karaka: string;
  exalted?: number;
  debilitated?: number;
  own: number[];
  moolatrikona?: number;
  /** special aspects in addition to the 7th (counted inclusively) */
  aspects: number[];
  dashaYears: number;
}

export const PLANETS: PlanetInfo[] = [
  { id: 'sun', name: 'Sun', sanskrit: 'Surya', glyph: '☉', abbr: 'Su', color: '#f5a524', nature: 'malefic', karaka: 'Soul, father, authority, vitality', exalted: 1, debilitated: 7, own: [5], moolatrikona: 5, aspects: [7], dashaYears: 6 },
  { id: 'moon', name: 'Moon', sanskrit: 'Chandra', glyph: '☽', abbr: 'Mo', color: '#cfd8e6', nature: 'benefic', karaka: 'Mind, mother, emotions, nourishment', exalted: 2, debilitated: 8, own: [4], moolatrikona: 2, aspects: [7], dashaYears: 10 },
  { id: 'mars', name: 'Mars', sanskrit: 'Mangala', glyph: '♂', abbr: 'Ma', color: '#ef4b4b', nature: 'malefic', karaka: 'Courage, siblings, land, energy', exalted: 10, debilitated: 4, own: [1, 8], moolatrikona: 1, aspects: [4, 7, 8], dashaYears: 7 },
  { id: 'mercury', name: 'Mercury', sanskrit: 'Budha', glyph: '☿', abbr: 'Me', color: '#3ecf8e', nature: 'neutral', karaka: 'Intellect, speech, trade, learning', exalted: 6, debilitated: 12, own: [3, 6], moolatrikona: 6, aspects: [7], dashaYears: 17 },
  { id: 'jupiter', name: 'Jupiter', sanskrit: 'Guru', glyph: '♃', abbr: 'Ju', color: '#f7d046', nature: 'benefic', karaka: 'Wisdom, children, dharma, fortune', exalted: 4, debilitated: 10, own: [9, 12], moolatrikona: 9, aspects: [5, 7, 9], dashaYears: 16 },
  { id: 'venus', name: 'Venus', sanskrit: 'Shukra', glyph: '♀', abbr: 'Ve', color: '#f28fd0', nature: 'benefic', karaka: 'Love, marriage, art, comforts', exalted: 12, debilitated: 6, own: [2, 7], moolatrikona: 7, aspects: [7], dashaYears: 20 },
  { id: 'saturn', name: 'Saturn', sanskrit: 'Shani', glyph: '♄', abbr: 'Sa', color: '#7f8cff', nature: 'malefic', karaka: 'Discipline, longevity, labor, karma', exalted: 7, debilitated: 1, own: [10, 11], moolatrikona: 11, aspects: [3, 7, 10], dashaYears: 19 },
  { id: 'rahu', name: 'Rahu', sanskrit: 'Rahu', glyph: '☊', abbr: 'Ra', color: '#9aa4b2', nature: 'malefic', karaka: 'Ambition, foreign, obsession, innovation', exalted: 2, debilitated: 8, own: [], aspects: [5, 7, 9], dashaYears: 18 },
  { id: 'ketu', name: 'Ketu', sanskrit: 'Ketu', glyph: '☋', abbr: 'Ke', color: '#c08a5b', nature: 'malefic', karaka: 'Detachment, moksha, past life, intuition', exalted: 8, debilitated: 2, own: [], aspects: [5, 7, 9], dashaYears: 7 },
];

export const PLANET_BY_ID = Object.fromEntries(PLANETS.map((p) => [p.id, p])) as Record<PlanetId, PlanetInfo>;

export interface NakshatraInfo {
  num: number;
  name: string;
  lord: PlanetId;
  deity: string;
  symbol: string;
  gana: 'Deva' | 'Manushya' | 'Rakshasa';
  theme: string;
}

const NAK_LORDS: PlanetId[] = ['ketu', 'venus', 'sun', 'moon', 'mars', 'rahu', 'jupiter', 'saturn', 'mercury'];

const NAK_RAW: [string, string, string, NakshatraInfo['gana'], string][] = [
  ['Ashwini', 'Ashwini Kumaras', 'Horse head', 'Deva', 'Swift healing, new beginnings, initiative'],
  ['Bharani', 'Yama', 'Yoni', 'Manushya', 'Restraint, transformation, carrying burdens'],
  ['Krittika', 'Agni', 'Razor / flame', 'Rakshasa', 'Purifying fire, sharp discernment'],
  ['Rohini', 'Brahma', 'Chariot', 'Manushya', 'Growth, beauty, fertility, attraction'],
  ['Mrigashira', 'Soma', "Deer's head", 'Deva', 'Searching, curiosity, gentle pursuit'],
  ['Ardra', 'Rudra', 'Teardrop', 'Manushya', 'Storms that clear, intensity, renewal'],
  ['Punarvasu', 'Aditi', 'Quiver of arrows', 'Deva', 'Return of light, optimism, restoration'],
  ['Pushya', 'Brihaspati', "Cow's udder", 'Deva', 'Nourishment, protection, devotion'],
  ['Ashlesha', 'Nagas', 'Coiled serpent', 'Rakshasa', 'Kundalini, cunning, entanglement'],
  ['Magha', 'Pitris', 'Royal throne', 'Rakshasa', 'Ancestry, power, tradition'],
  ['Purva Phalguni', 'Bhaga', 'Front legs of bed', 'Manushya', 'Pleasure, rest, creativity'],
  ['Uttara Phalguni', 'Aryaman', 'Back legs of bed', 'Manushya', 'Contracts, patronage, loyalty'],
  ['Hasta', 'Savitar', 'Hand', 'Deva', 'Skill, craft, manifesting with hands'],
  ['Chitra', 'Tvashtar', 'Bright jewel', 'Rakshasa', 'Design, brilliance, architecture'],
  ['Swati', 'Vayu', 'Young sprout in wind', 'Deva', 'Independence, flexibility, trade'],
  ['Vishakha', 'Indra & Agni', 'Triumphal arch', 'Rakshasa', 'Determined goals, ambition'],
  ['Anuradha', 'Mitra', 'Lotus', 'Deva', 'Friendship, devotion, cooperation'],
  ['Jyeshtha', 'Indra', 'Earring / umbrella', 'Rakshasa', 'Seniority, protection, power'],
  ['Mula', 'Nirriti', 'Tied roots', 'Rakshasa', 'Getting to the root, dissolution'],
  ['Purva Ashadha', 'Apas', 'Fan / winnowing basket', 'Manushya', 'Invincibility, purification'],
  ['Uttara Ashadha', 'Vishvadevas', "Elephant's tusk", 'Manushya', 'Final victory, righteousness'],
  ['Shravana', 'Vishnu', 'Ear', 'Deva', 'Listening, learning, connection'],
  ['Dhanishta', 'Vasus', 'Drum', 'Rakshasa', 'Rhythm, wealth, fame'],
  ['Shatabhisha', 'Varuna', 'Empty circle', 'Rakshasa', 'Healing, secrecy, the hundred physicians'],
  ['Purva Bhadrapada', 'Aja Ekapada', 'Front of funeral cot', 'Manushya', 'Fiery idealism, penance'],
  ['Uttara Bhadrapada', 'Ahir Budhnya', 'Back of funeral cot', 'Manushya', 'Depth, wisdom, stability'],
  ['Revati', 'Pushan', 'Fish / drum', 'Deva', 'Safe journeys, completion, nurturing'],
];

export const NAKSHATRAS: NakshatraInfo[] = NAK_RAW.map(([name, deity, symbol, gana, theme], i) => ({
  num: i + 1,
  name,
  deity,
  symbol,
  gana,
  theme,
  lord: NAK_LORDS[i % 9],
}));

export const NAK_SPAN = 360 / 27;

export interface HouseInfo {
  num: number;
  name: string;
  bhava: string;
  themes: string;
  kind: string[];
}

export const HOUSES: HouseInfo[] = [
  { num: 1, name: 'Self', bhava: 'Tanu', themes: 'Body, personality, health, overall direction of life', kind: ['Kendra', 'Trikona'] },
  { num: 2, name: 'Wealth', bhava: 'Dhana', themes: 'Savings, family, speech, food, early education', kind: ['Maraka'] },
  { num: 3, name: 'Courage', bhava: 'Sahaja', themes: 'Siblings, effort, communication, short journeys', kind: ['Upachaya'] },
  { num: 4, name: 'Home', bhava: 'Sukha', themes: 'Mother, property, vehicles, inner peace', kind: ['Kendra'] },
  { num: 5, name: 'Creativity', bhava: 'Putra', themes: 'Children, intelligence, romance, past merit', kind: ['Trikona'] },
  { num: 6, name: 'Obstacles', bhava: 'Ripu', themes: 'Enemies, debts, disease, service, competition', kind: ['Dusthana', 'Upachaya'] },
  { num: 7, name: 'Partnership', bhava: 'Kalatra', themes: 'Marriage, business partners, public dealings', kind: ['Kendra', 'Maraka'] },
  { num: 8, name: 'Transformation', bhava: 'Ayur', themes: 'Longevity, secrets, inheritance, sudden events', kind: ['Dusthana'] },
  { num: 9, name: 'Fortune', bhava: 'Dharma', themes: 'Father, teachers, higher learning, luck, faith', kind: ['Trikona'] },
  { num: 10, name: 'Career', bhava: 'Karma', themes: 'Profession, status, public reputation, action', kind: ['Kendra', 'Upachaya'] },
  { num: 11, name: 'Gains', bhava: 'Labha', themes: 'Income, friends, networks, fulfilment of desires', kind: ['Upachaya'] },
  { num: 12, name: 'Release', bhava: 'Vyaya', themes: 'Losses, foreign lands, spirituality, sleep, moksha', kind: ['Dusthana'] },
];

export interface VargaInfo {
  id: VargaId;
  name: string;
  area: string;
}

export const VARGAS: VargaInfo[] = [
  { id: 'D1', name: 'Rashi', area: 'The whole life, body and overall destiny' },
  { id: 'D2', name: 'Hora', area: 'Wealth and resources' },
  { id: 'D3', name: 'Drekkana', area: 'Siblings, courage and initiative' },
  { id: 'D4', name: 'Chaturthamsha', area: 'Property, home and fortune' },
  { id: 'D7', name: 'Saptamsha', area: 'Children and progeny' },
  { id: 'D9', name: 'Navamsha', area: 'Marriage, dharma and inner strength of planets' },
  { id: 'D10', name: 'Dashamsha', area: 'Career and achievements' },
  { id: 'D12', name: 'Dvadashamsha', area: 'Parents and lineage' },
  { id: 'D16', name: 'Shodashamsha', area: 'Vehicles, comforts and happiness' },
  { id: 'D20', name: 'Vimshamsha', area: 'Spiritual practice and devotion' },
  { id: 'D24', name: 'Chaturvimshamsha', area: 'Education and learning' },
  { id: 'D27', name: 'Bhamsha', area: 'Strengths and weaknesses' },
  { id: 'D30', name: 'Trimshamsha', area: 'Misfortunes, health and character' },
  { id: 'D40', name: 'Khavedamsha', area: 'Maternal legacy and auspicious effects' },
  { id: 'D45', name: 'Akshavedamsha', area: 'Paternal legacy and general character' },
  { id: 'D60', name: 'Shashtyamsha', area: 'Past-life karma, the finest detail' },
];

export const signInfo = (n: number) => SIGNS[(((n - 1) % 12) + 12) % 12];
