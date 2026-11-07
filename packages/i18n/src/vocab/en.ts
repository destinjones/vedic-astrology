import type { Vocab } from './types';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export const en: Vocab = {
  planets: {
    sun: { name: 'Sun', short: 'Su' },
    moon: { name: 'Moon', short: 'Mo' },
    mars: { name: 'Mars', short: 'Ma' },
    mercury: { name: 'Mercury', short: 'Me' },
    jupiter: { name: 'Jupiter', short: 'Ju' },
    venus: { name: 'Venus', short: 'Ve' },
    saturn: { name: 'Saturn', short: 'Sa' },
    rahu: { name: 'Rahu', short: 'Ra' },
    ketu: { name: 'Ketu', short: 'Ke' },
  },
  signs: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'],
  nakshatras: [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ],
  houses: ['Self', 'Wealth', 'Courage', 'Home', 'Creativity', 'Obstacles', 'Partnership', 'Transformation', 'Fortune', 'Career', 'Gains', 'Release'],
  bhavas: ['Tanu', 'Dhana', 'Sahaja', 'Sukha', 'Putra', 'Ripu', 'Kalatra', 'Ayur', 'Dharma', 'Karma', 'Labha', 'Vyaya'],
  vargas: {
    D1: 'Rashi', D2: 'Hora', D3: 'Drekkana', D4: 'Chaturthamsha', D7: 'Saptamsha', D9: 'Navamsha', D10: 'Dashamsha', D12: 'Dvadashamsha',
    D16: 'Shodashamsha', D20: 'Vimshamsha', D24: 'Chaturvimshamsha', D27: 'Bhamsha', D30: 'Trimshamsha', D40: 'Khavedamsha', D45: 'Akshavedamsha', D60: 'Shashtyamsha',
  },
  dignity: {
    exalted: 'Exalted', moolatrikona: 'Moolatrikona', own: 'Own sign', great_friend: 'Great friend', friend: 'Friendly',
    neutral: 'Neutral', enemy: 'Enemy', great_enemy: 'Great enemy', debilitated: 'Debilitated',
  },
  nature: { benefic: 'benefic', malefic: 'malefic', neutral: 'neutral', variable: 'variable' },
  element: { fire: 'Fire', earth: 'Earth', air: 'Air', water: 'Water' },
  modality: { movable: 'Movable', fixed: 'Fixed', dual: 'Dual' },
  gana: { deva: 'Deva', manushya: 'Manushya', rakshasa: 'Rakshasa' },
  houseGroups: { kendra: 'Kendra', trikona: 'Trikona', dusthana: 'Dusthana', upachaya: 'Upachaya', maraka: 'Maraka', panaphara: 'Panaphara', apoklima: 'Apoklima' },
  strength: { strong: 'strong', moderate: 'moderate', weak: 'weak' },
  severity: { high: 'high', moderate: 'moderate', low: 'low', cancelled: 'cancelled' },
  tone: { benefic: 'supportive', mixed: 'mixed', challenging: 'challenging' },
  ordinal,
};
