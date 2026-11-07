import type { GrahaId } from '@vedic/engine';
import type { JaiminiReading } from './types';

/*
 * Original interpretive text for the Jaimini layer. It paraphrases common
 * teaching on the Jaimini Sutras and later commentaries; nothing is quoted.
 */

type Sevenish = Exclude<GrahaId, 'ketu'>;

interface PlanetText { summary: string; detail: string; strengths: string[]; challenges: string[]; keywords: string[] }

/** The Atmakaraka by planet: the soul's main appetite and the lesson it has to learn. */
export const ATMAKARAKA: Record<Sevenish, PlanetText> = {
  sun: {
    summary: 'The Sun as Atmakaraka asks the soul to learn about rank, pride and right use of authority.',
    detail: 'You are drawn to positions where you are seen and trusted to lead. The lesson is to carry that light without needing constant recognition, and to stay humble before your own elders, teachers and the people you serve. When ego sits quietly, leadership comes to you naturally.',
    strengths: ['Natural dignity and presence', 'Clear sense of purpose', 'Ability to take responsibility for others'],
    challenges: ['Pride that resists correction', 'Friction with fathers, bosses or the state', 'Needing to be at the centre'],
    keywords: ['authority', 'self-respect', 'leadership', 'ego'],
  },
  moon: {
    summary: 'The Moon as Atmakaraka asks the soul to learn about care, feeling and steadiness of mind.',
    detail: 'Your life turns on how you nourish and are nourished. People bring you their feelings, and your moods shape everything around you. The lesson is compassion that does not drown in emotion: caring for others while keeping your own mind clear and calm.',
    strengths: ['Deep empathy', 'Gift for nurturing and hosting', 'Popularity and public feeling'],
    challenges: ['Mood swings', 'Attachment to comfort or to mother', 'Taking others’ feelings on as your own'],
    keywords: ['care', 'mind', 'mother', 'emotion'],
  },
  mars: {
    summary: 'Mars as Atmakaraka asks the soul to learn about courage, conflict and the right use of force.',
    detail: 'You are built to act, defend and compete. Life puts you in situations that need nerve. The lesson is to fight only for what is right, to avoid needless harm, and to turn raw drive into discipline and skill.',
    strengths: ['Courage and decisiveness', 'Technical or athletic skill', 'Protectiveness'],
    challenges: ['Anger and haste', 'Quarrels with siblings or colleagues', 'Injuries from rushing'],
    keywords: ['courage', 'action', 'conflict', 'discipline'],
  },
  mercury: {
    summary: 'Mercury as Atmakaraka asks the soul to learn about speech, learning and honest exchange.',
    detail: 'Words, trade and ideas are your field. You learn fast and can talk your way into or out of anything. The lesson is truthful speech: using your cleverness to inform rather than to manipulate, and keeping promises you make.',
    strengths: ['Quick intelligence', 'Gift for writing, teaching or commerce', 'Adaptability'],
    challenges: ['Restlessness', 'Saying more than you mean', 'Scattered effort'],
    keywords: ['speech', 'learning', 'trade', 'wit'],
  },
  jupiter: {
    summary: 'Jupiter as Atmakaraka asks the soul to learn about wisdom, faith and guidance.',
    detail: 'You are meant to understand and then to teach. People look to you for advice, and your own growth comes through teachers and tradition. The lesson is to stay a student while you guide others, and to avoid the trap of thinking you already know.',
    strengths: ['Good judgement', 'Generosity', 'Respect from others'],
    challenges: ['Self-righteousness', 'Over-indulgence', 'Trouble accepting a teacher'],
    keywords: ['wisdom', 'teaching', 'faith', 'children'],
  },
  venus: {
    summary: 'Venus as Atmakaraka asks the soul to learn about love, pleasure and refinement.',
    detail: 'Beauty, relationships and art are your path. You understand what makes life pleasant and can bring grace to any room. The lesson is love without grasping: enjoying the senses while keeping relationships honest and pure in intention.',
    strengths: ['Charm and taste', 'Artistic skill', 'Gift for harmony'],
    challenges: ['Over-attachment to pleasure or partners', 'Indulgence', 'Avoiding hard choices to keep the peace'],
    keywords: ['love', 'beauty', 'art', 'desire'],
  },
  saturn: {
    summary: 'Saturn as Atmakaraka asks the soul to learn about duty, patience and service.',
    detail: 'Your path is slow and earned. Burdens come early and teach endurance, and you understand hardship in a way others may not. The lesson is to serve without bitterness, to accept delay, and to treat every person, however humble, with fairness.',
    strengths: ['Endurance', 'Seriousness and reliability', 'Late but lasting success'],
    challenges: ['Sorrow and loneliness', 'Pessimism', 'Fear of loss'],
    keywords: ['duty', 'patience', 'service', 'detachment'],
  },
  rahu: {
    summary: 'Rahu as Atmakaraka asks the soul to learn about desire, illusion and the unconventional path.',
    detail: 'You are pulled toward the foreign, the new and the forbidden, and life rarely follows the expected script. The lesson is to see through illusion: to chase experience fully and still recognise when a hunger can never be filled.',
    strengths: ['Originality', 'Ease with foreign people and new technology', 'Ambition'],
    challenges: ['Confusion and deception', 'Obsession', 'Restless dissatisfaction'],
    keywords: ['ambition', 'foreign', 'illusion', 'innovation'],
  },
};

/** The Amatyakaraka by planet: the kind of work and counsel that suits the soul. */
export const AMATYAKARAKA: Record<Sevenish, string> = {
  sun: 'Work tied to government, administration, medicine or leadership suits you. You do best given authority.',
  moon: 'Work that serves the public, cares for people or deals in food, travel or liquids suits you.',
  mars: 'Work in engineering, defence, sport, surgery, land or anything that needs nerve suits you.',
  mercury: 'Work with words, numbers, trade, writing, media or analysis suits you.',
  jupiter: 'Work as a teacher, adviser, lawyer, banker or priest suits you. People trust your counsel.',
  venus: 'Work in arts, design, fashion, hospitality, luxury or relationships suits you.',
  saturn: 'Work in large organisations, labour, law, mining, agriculture or long careful projects suits you.',
  rahu: 'Work with foreigners, technology, research, politics or anything new and unusual suits you.',
};

/** The Darakaraka by planet: the nature of the spouse or main partner. */
export const DARAKARAKA: Record<Sevenish, string> = {
  sun: 'The partner tends to be proud, principled and prominent, and may hold authority.',
  moon: 'The partner tends to be caring, sensitive and family-minded, with changeable moods.',
  mars: 'The partner tends to be energetic, direct and competitive. Sparks fly both ways.',
  mercury: 'The partner tends to be youthful, witty and talkative, often met through study or work.',
  jupiter: 'The partner tends to be wise, generous and well-regarded, sometimes older or a guide.',
  venus: 'The partner tends to be attractive, artistic and affectionate. Romance matters greatly.',
  saturn: 'The partner tends to be serious, dependable and mature, often older. Commitment grows slowly.',
  rahu: 'The partner may come from a different background or culture, and the bond is unconventional.',
};

/** What a sign wants, used for the Karakamsa and for the dasha signs. */
export const SIGN_DESIRE = [
  'to begin things and win by its own effort',
  'stability, comfort and lasting value',
  'knowledge, conversation and variety',
  'belonging, home and emotional safety',
  'recognition, creativity and command',
  'skill, service and getting things right',
  'balance, partnership and fair dealing',
  'depth, secrets and transformation',
  'meaning, faith and higher learning',
  'achievement, structure and long-term status',
  'ideals, networks and the common good',
  'surrender, imagination and liberation',
];

/** Arudha Lagna by house from the lagna: how the public image relates to the person. */
export const AL_HOUSE = [
  'Your image and your real self are close. People see you much as you are, and your reputation rests on your own character.',
  'Your image is tied to wealth, family and speech. People judge you by what you have and how you talk.',
  'Your image is one of effort and nerve. You are known for initiative, media, writing or bold moves.',
  'Your image centres on home, property, vehicles and comfort. People see you as settled or well-provided.',
  'Your image is creative and intelligent. You are known for ideas, advice, children or a following.',
  'Your image is that of a fighter or a server. You may be seen through work, competition or problems you solve.',
  'Your image is bound up with partners and trade. People see you through your spouse, clients or deals.',
  'Your image carries mystery. You may be seen as private, intense or connected with hidden matters, and reputation can swing.',
  'Your image is principled and fortunate. You are seen as learned, religious or lucky.',
  'Your image is professional. You are known for your work, status and what you achieve in the world.',
  'Your image is prosperous and well-connected. Gains, friends and networks shape how people see you.',
  'Your image is quiet or distant. You may be little seen at home and better known abroad, in retreat or behind the scenes.',
];

const HOUSE_THEME = [
  'self, health and direction',
  'money, family and speech',
  'effort, siblings and courage',
  'home, mother, property and peace of mind',
  'children, learning, creativity and advice',
  'work, rivals, illness and debts',
  'partners, marriage and trade',
  'sudden change, research and shared resources',
  'fortune, teachers, faith and long travel',
  'career, status and public duty',
  'gains, friends and fulfilled wishes',
  'expenses, foreign lands, rest and letting go',
];
export const houseTheme = (h: number) => HOUSE_THEME[h - 1];

export const BENEFICS: GrahaId[] = ['jupiter', 'venus', 'mercury', 'moon'];
export const MALEFICS: GrahaId[] = ['sun', 'mars', 'saturn', 'rahu', 'ketu'];

export function toneFromGrahas(grahas: GrahaId[]): { tone: JaiminiReading['tone']; score: number } {
  const b = grahas.filter((g) => BENEFICS.includes(g)).length;
  const m = grahas.filter((g) => MALEFICS.includes(g)).length;
  const score = Math.max(-3, Math.min(3, b - m));
  return { tone: score > 0 ? 'benefic' : score < 0 ? 'challenging' : 'mixed', score };
}
