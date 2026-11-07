import type { Element, Modality, PlanetId, SignNumber } from '../types';

export interface SignProfile {
  number: SignNumber;
  id: string;
  name: string;
  sanskrit: string;
  glyph: string;
  element: Element;
  modality: Modality;
  lord: PlanetId;
  gender: 'masculine' | 'feminine';
  /** Short descriptor used in composed text, e.g. "bold, pioneering". */
  flavor: string;
  /** How a planet "acts" through this sign. */
  style: string;
  themes: string[];
  body: string;
  description: string;
}

export const SIGNS: SignProfile[] = [
  {
    number: 1, id: 'aries', name: 'Aries', sanskrit: 'Mesha', glyph: '♈', element: 'fire', modality: 'movable', lord: 'mars', gender: 'masculine',
    flavor: 'bold, quick and pioneering',
    style: 'directly and on impulse, wanting to be first',
    themes: ['initiative', 'courage', 'independence', 'competition'],
    body: 'head and face',
    description: 'Aries is the spark at the start of the zodiac. It acts first and reflects later, valuing honesty, speed and personal freedom. Its gift is courage; its lesson is patience.',
  },
  {
    number: 2, id: 'taurus', name: 'Taurus', sanskrit: 'Vrishabha', glyph: '♉', element: 'earth', modality: 'fixed', lord: 'venus', gender: 'feminine',
    flavor: 'steady, sensual and security-minded',
    style: 'slowly and reliably, wanting something tangible to show for it',
    themes: ['stability', 'resources', 'pleasure', 'loyalty'],
    body: 'face, throat and neck',
    description: 'Taurus builds and keeps. It loves comfort, good food, music and lasting value. Its gift is persistence; its lesson is letting go of what no longer grows.',
  },
  {
    number: 3, id: 'gemini', name: 'Gemini', sanskrit: 'Mithuna', glyph: '♊', element: 'air', modality: 'dual', lord: 'mercury', gender: 'masculine',
    flavor: 'curious, talkative and versatile',
    style: 'through words, ideas and many simultaneous interests',
    themes: ['communication', 'learning', 'siblings', 'skill'],
    body: 'shoulders, arms, hands and lungs',
    description: 'Gemini wants to know a little about everything. It thrives on conversation, writing, trade and short journeys. Its gift is adaptability; its lesson is depth.',
  },
  {
    number: 4, id: 'cancer', name: 'Cancer', sanskrit: 'Karka', glyph: '♋', element: 'water', modality: 'movable', lord: 'moon', gender: 'feminine',
    flavor: 'caring, protective and emotionally tuned-in',
    style: 'through feeling, memory and the instinct to nurture',
    themes: ['home', 'family', 'emotional security', 'roots'],
    body: 'chest, breasts and stomach',
    description: 'Cancer is the hearth of the zodiac. It remembers, protects and feeds. Its gift is empathy; its lesson is not letting old hurts steer the present.',
  },
  {
    number: 5, id: 'leo', name: 'Leo', sanskrit: 'Simha', glyph: '♌', element: 'fire', modality: 'fixed', lord: 'sun', gender: 'masculine',
    flavor: 'proud, warm and dramatic',
    style: 'with presence and heart, wanting to be seen and respected',
    themes: ['leadership', 'creativity', 'dignity', 'self-expression'],
    body: 'heart and upper back',
    description: 'Leo rules from the centre. It is loyal, generous and creative, and it needs recognition. Its gift is radiance; its lesson is humility.',
  },
  {
    number: 6, id: 'virgo', name: 'Virgo', sanskrit: 'Kanya', glyph: '♍', element: 'earth', modality: 'dual', lord: 'mercury', gender: 'feminine',
    flavor: 'precise, analytical and service-minded',
    style: 'carefully and methodically, refining the details',
    themes: ['analysis', 'health', 'service', 'craft'],
    body: 'intestines and digestive system',
    description: 'Virgo sorts, fixes and improves. It is practical, modest and devoted to doing things well. Its gift is discernment; its lesson is self-acceptance.',
  },
  {
    number: 7, id: 'libra', name: 'Libra', sanskrit: 'Tula', glyph: '♎', element: 'air', modality: 'movable', lord: 'venus', gender: 'masculine',
    flavor: 'diplomatic, refined and partnership-oriented',
    style: 'through balance, negotiation and an eye for fairness',
    themes: ['relationships', 'justice', 'beauty', 'trade'],
    body: 'kidneys and lower back',
    description: 'Libra weighs and balances. It values fairness, beauty and good company, and it is a natural trader. Its gift is grace; its lesson is decisiveness.',
  },
  {
    number: 8, id: 'scorpio', name: 'Scorpio', sanskrit: 'Vrishchika', glyph: '♏', element: 'water', modality: 'fixed', lord: 'mars', gender: 'feminine',
    flavor: 'intense, secretive and penetrating',
    style: 'privately and powerfully, digging below the surface',
    themes: ['transformation', 'secrets', 'research', 'shared resources'],
    body: 'reproductive organs and excretory system',
    description: 'Scorpio goes deep. It is loyal, strategic and unafraid of crisis, but it can hold grudges. Its gift is regeneration; its lesson is trust.',
  },
  {
    number: 9, id: 'sagittarius', name: 'Sagittarius', sanskrit: 'Dhanu', glyph: '♐', element: 'fire', modality: 'dual', lord: 'jupiter', gender: 'masculine',
    flavor: 'optimistic, principled and adventurous',
    style: 'through belief, exploration and the search for meaning',
    themes: ['philosophy', 'travel', 'higher learning', 'dharma'],
    body: 'hips and thighs',
    description: 'Sagittarius aims at the horizon. It loves truth, teaching, travel and big ideas. Its gift is faith; its lesson is tact.',
  },
  {
    number: 10, id: 'capricorn', name: 'Capricorn', sanskrit: 'Makara', glyph: '♑', element: 'earth', modality: 'movable', lord: 'saturn', gender: 'feminine',
    flavor: 'ambitious, disciplined and pragmatic',
    style: 'strategically, step by step, with an eye on long-term results',
    themes: ['career', 'structure', 'responsibility', 'status'],
    body: 'knees and joints',
    description: 'Capricorn climbs. It is patient, responsible and focused on what works. Its gift is endurance; its lesson is warmth.',
  },
  {
    number: 11, id: 'aquarius', name: 'Aquarius', sanskrit: 'Kumbha', glyph: '♒', element: 'air', modality: 'fixed', lord: 'saturn', gender: 'masculine',
    flavor: 'independent, humanitarian and unconventional',
    style: 'through systems, groups and ideas about the collective good',
    themes: ['networks', 'innovation', 'service to society', 'detachment'],
    body: 'calves, ankles and circulation',
    description: 'Aquarius thinks in systems. It is idealistic, inventive and loyal to causes. Its gift is vision; its lesson is personal intimacy.',
  },
  {
    number: 12, id: 'pisces', name: 'Pisces', sanskrit: 'Meena', glyph: '♓', element: 'water', modality: 'dual', lord: 'jupiter', gender: 'feminine',
    flavor: 'compassionate, imaginative and spiritual',
    style: 'through intuition, empathy and surrender',
    themes: ['spirituality', 'imagination', 'compassion', 'liberation'],
    body: 'feet and lymphatic system',
    description: 'Pisces dissolves boundaries. It is kind, artistic and drawn to the unseen. Its gift is compassion; its lesson is healthy boundaries.',
  },
];

export const getSign = (n: number): SignProfile => {
  const s = SIGNS[(((n - 1) % 12) + 12) % 12];
  return s;
};

export const signLord = (n: number): PlanetId => getSign(n).lord;
