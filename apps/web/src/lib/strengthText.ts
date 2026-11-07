import type { ShadbalaPlanet } from '@vedic/engine';

/** Plain-language notes for the Shadbala and Bhava Bala card. */

export const SHADBALA_INTRO =
  'Shadbala means "six strengths". Parashara scores every planet on six separate grounds and adds them up in virupas, where 60 virupas make one rupa. A planet whose total reaches its classical minimum can deliver what it promises in the chart. One that falls short still acts, but its results come with more effort or less consistency. Rahu and Ketu have no body, so the texts leave them out.';

export const COMPONENTS: { key: 'sthana' | 'dig' | 'kala' | 'cheshta' | 'naisargika' | 'drik'; name: string; english: string; text: string }[] = [
  {
    key: 'sthana',
    name: 'Sthana Bala',
    english: 'Position',
    text: 'Strength from where the planet sits. It adds five parts: closeness to the exaltation point, its dignity in seven divisional charts, odd or even sign and navamsa, whether it is angular, and which third of the sign it is in.',
  },
  {
    key: 'dig',
    name: 'Dig Bala',
    english: 'Direction',
    text: 'Each planet has a direction where it shines. Jupiter and Mercury are strongest on the ascendant, the Sun and Mars at the top of the chart, Saturn on the descendant, and the Moon and Venus at the bottom. The score falls the further the planet is from that point.',
  },
  {
    key: 'kala',
    name: 'Kala Bala',
    english: 'Time',
    text: 'Strength from the moment of birth: day or night, the Moon\'s phase, which third of the day or night, the lords of the year, month, weekday and hour, the planet\'s declination, and any planetary war.',
  },
  {
    key: 'cheshta',
    name: 'Cheshta Bala',
    english: 'Motion',
    text: 'Strength from movement. A planet moving backwards, close to Earth and bright, scores highest. For the Sun and Moon this is already counted inside their doubled declination and phase scores, so it is shown but not added again.',
  },
  {
    key: 'naisargika',
    name: 'Naisargika Bala',
    english: 'Natural',
    text: 'A fixed score by brightness, the same in every chart: the Sun first, then the Moon, Venus, Jupiter, Mercury, Mars and Saturn.',
  },
  {
    key: 'drik',
    name: 'Drik Bala',
    english: 'Aspects',
    text: 'A quarter of the aspects the planet receives, with gentle planets (Jupiter, Venus, a waxing Moon, a well-placed Mercury) adding and harsh ones (Sun, Mars, Saturn, a waning Moon) taking away. It can go negative.',
  },
];

export const STHANA_PARTS: { key: 'uchcha' | 'saptavargaja' | 'ojayugma' | 'kendradi' | 'drekkana'; name: string; max: number; text: string }[] = [
  { key: 'uchcha', name: 'Uchcha', max: 60, text: 'Distance from the debilitation point, full at the exact exaltation degree' },
  { key: 'saptavargaja', name: 'Saptavargaja', max: 315, text: 'Dignity in the D1, D2, D3, D7, D9, D12 and D30 charts' },
  { key: 'ojayugma', name: 'Ojayugma', max: 30, text: 'Odd or even sign and navamsa (Moon and Venus like even signs)' },
  { key: 'kendradi', name: 'Kendradi', max: 60, text: 'Angular houses 60, succedent 30, cadent 15' },
  { key: 'drekkana', name: 'Drekkana', max: 15, text: 'Male planets in the first ten degrees, neutral in the middle, female in the last' },
];

export const KALA_PARTS: { key: 'natonnata' | 'paksha' | 'tribhaga' | 'abda' | 'masa' | 'vara' | 'hora' | 'ayana' | 'yuddha'; name: string; text: string }[] = [
  { key: 'natonnata', name: 'Natonnata', text: 'Day planets peak at noon, night planets at midnight, Mercury always full' },
  { key: 'paksha', name: 'Paksha', text: 'Moon\'s phase: gentle planets like a full Moon, harsh ones a new Moon. Doubled for the Moon' },
  { key: 'tribhaga', name: 'Tribhaga', text: 'Ruler of the third of the day or night you were born in. Jupiter always gets it' },
  { key: 'abda', name: 'Abda', text: 'Lord of the year' },
  { key: 'masa', name: 'Masa', text: 'Lord of the month' },
  { key: 'vara', name: 'Vara', text: 'Lord of the weekday' },
  { key: 'hora', name: 'Hora', text: 'Lord of the planetary hour' },
  { key: 'ayana', name: 'Ayana', text: 'Declination north or south of the equator. Doubled for the Sun' },
  { key: 'yuddha', name: 'Yuddha', text: 'Gain or loss from a planetary war (two planets within one degree)' },
];

export const RELATION_LABEL: Record<string, string> = {
  moolatrikona: 'Moolatrikona',
  own: 'Own sign',
  great_friend: 'Great friend',
  friend: 'Friend',
  neutral: 'Neutral',
  enemy: 'Enemy',
  great_enemy: 'Great enemy',
};

export const BHAVA_INTRO =
  'Bhava Bala scores the twelve houses. A strong house gives its matters (wealth for the 2nd, career for the 10th and so on) more room to flourish. It adds three parts: the full Shadbala of the house lord, a direction score from the kind of sign on the house (human, water, insect or four-footed), and the aspects falling on the middle of the house, where Jupiter and Mercury count in full and Mercury is always treated as gentle.';

export const SIGN_TYPE_LABEL: Record<string, string> = {
  nara: 'Human sign, strongest in the 1st',
  jalachara: 'Water sign, strongest in the 4th',
  keeta: 'Insect sign, strongest in the 7th',
  chatushpada: 'Four-footed sign, strongest in the 10th',
};

export const PLANET_STRENGTH_MEANING: Record<ShadbalaPlanet, string> = {
  sun: 'confidence, health and standing with authority',
  moon: 'emotional steadiness and care from others',
  mars: 'drive, courage and the ability to act',
  mercury: 'clear thinking, speech and skill with detail',
  jupiter: 'wisdom, good counsel and protection',
  venus: 'relationships, comfort and taste',
  saturn: 'endurance, discipline and lasting results',
};
