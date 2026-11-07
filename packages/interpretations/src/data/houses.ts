import type { HouseNumber } from '../types';

export type HouseGroup = 'kendra' | 'trikona' | 'dusthana' | 'upachaya' | 'maraka' | 'panaphara' | 'apoklima';

export interface HouseProfile {
  number: HouseNumber;
  name: string;
  sanskrit: string;
  /** Short label for composed text, e.g. "self and body". */
  label: string;
  significations: string[];
  groups: HouseGroup[];
  /** Natural karaka (significator) planets. */
  karakas: string[];
  description: string;
}

export const KENDRAS: HouseNumber[] = [1, 4, 7, 10];
export const TRIKONAS: HouseNumber[] = [1, 5, 9];
export const DUSTHANAS: HouseNumber[] = [6, 8, 12];
export const UPACHAYAS: HouseNumber[] = [3, 6, 10, 11];
export const MARAKAS: HouseNumber[] = [2, 7];

export const HOUSES: HouseProfile[] = [
  {
    number: 1, name: 'First House', sanskrit: 'Tanu Bhava', label: 'self, body and life direction',
    significations: ['physical body', 'personality', 'health and vitality', 'appearance', 'overall life path', 'fame'],
    groups: ['kendra', 'trikona'], karakas: ['sun'],
    description: 'The ascendant is the lens through which the whole chart is lived. It describes the body, temperament and how you meet the world, and its strength props up every other house.',
  },
  {
    number: 2, name: 'Second House', sanskrit: 'Dhana Bhava', label: 'wealth, speech and family',
    significations: ['accumulated wealth', 'speech', 'family of origin', 'food and diet', 'values', 'face and right eye', 'early education'],
    groups: ['maraka', 'panaphara'], karakas: ['jupiter'],
    description: 'The second house holds what you keep: money, family traditions, the way you speak and eat, and the values you were raised with.',
  },
  {
    number: 3, name: 'Third House', sanskrit: 'Sahaja Bhava', label: 'courage, effort and communication',
    significations: ['younger siblings', 'courage and initiative', 'short travel', 'writing and media', 'hands and skills', 'self-effort', 'hobbies'],
    groups: ['upachaya', 'apoklima'], karakas: ['mars'],
    description: 'The third house is willpower in action. It shows how you take initiative, communicate, use your hands and relate to siblings. It grows stronger with age and effort.',
  },
  {
    number: 4, name: 'Fourth House', sanskrit: 'Sukha Bhava', label: 'home, mother and inner peace',
    significations: ['mother', 'home and property', 'vehicles', 'emotional happiness', 'schooling', 'homeland', 'heart'],
    groups: ['kendra'], karakas: ['moon', 'venus'],
    description: 'The fourth house is where you feel safe. It describes the mother, the home, land, vehicles and the private contentment that lets you rest.',
  },
  {
    number: 5, name: 'Fifth House', sanskrit: 'Putra Bhava', label: 'creativity, children and intelligence',
    significations: ['children', 'intelligence', 'creativity', 'romance', 'speculation', 'mantra and devotion', 'past-life merit (purva punya)'],
    groups: ['trikona', 'panaphara'], karakas: ['jupiter'],
    description: 'The fifth house is a house of fortune. It shows the merit you carry from before, your creative and intellectual gifts, children, romance and the joy of play.',
  },
  {
    number: 6, name: 'Sixth House', sanskrit: 'Ripu / Shatru Bhava', label: 'health, work and obstacles',
    significations: ['enemies and competition', 'disease', 'debt', 'daily work and service', 'pets', 'litigation', 'maternal uncles'],
    groups: ['dusthana', 'upachaya', 'apoklima'], karakas: ['mars', 'saturn'],
    description: 'The sixth house is the arena of struggle and improvement: illness, enemies, debt and daily labour. Malefics here often help you win; benefics may soften you too much for the fight.',
  },
  {
    number: 7, name: 'Seventh House', sanskrit: 'Kalatra Bhava', label: 'marriage and partnerships',
    significations: ['spouse', 'marriage', 'business partners', 'contracts', 'public dealings', 'foreign travel', 'sexuality'],
    groups: ['kendra', 'maraka'], karakas: ['venus'],
    description: 'The seventh house is the other person: spouse, partners, clients and open rivals. It shows what you seek in others and how you behave in one-to-one relationships.',
  },
  {
    number: 8, name: 'Eighth House', sanskrit: 'Ayur / Randhra Bhava', label: 'transformation, longevity and hidden matters',
    significations: ['longevity', 'sudden events', 'inheritance', "spouse's wealth", 'occult and research', 'surgery and chronic illness', 'secrets'],
    groups: ['dusthana', 'panaphara'], karakas: ['saturn'],
    description: 'The eighth house is what lies beneath: crisis, transformation, inheritance, joint money and esoteric knowledge. It is difficult but can give extraordinary depth.',
  },
  {
    number: 9, name: 'Ninth House', sanskrit: 'Dharma / Bhagya Bhava', label: 'fortune, father and dharma',
    significations: ['luck and grace', 'father', 'guru and teachers', 'religion and philosophy', 'long journeys', 'higher education', 'ethics'],
    groups: ['trikona', 'apoklima'], karakas: ['jupiter', 'sun'],
    description: 'The ninth house is the most fortunate house. It describes your sense of right, teachers, father, faith and the luck that seems to arrive on its own.',
  },
  {
    number: 10, name: 'Tenth House', sanskrit: 'Karma Bhava', label: 'career, status and public action',
    significations: ['career and profession', 'reputation', 'authority', 'achievements', 'government', 'actions in the world'],
    groups: ['kendra', 'upachaya'], karakas: ['sun', 'mercury', 'jupiter', 'saturn'],
    description: 'The tenth house is the summit. It shows your work, status, reputation and what you are known for. Planets here are visible and active.',
  },
  {
    number: 11, name: 'Eleventh House', sanskrit: 'Labha Bhava', label: 'gains, friends and ambitions',
    significations: ['income and gains', 'friends and networks', 'elder siblings', 'fulfilment of desires', 'social circles', 'awards'],
    groups: ['upachaya', 'panaphara'], karakas: ['jupiter'],
    description: 'The eleventh house is where desires are fulfilled. It shows income, networks, elder siblings and big hopes. Almost any planet here produces some kind of gain.',
  },
  {
    number: 12, name: 'Twelfth House', sanskrit: 'Vyaya Bhava', label: 'loss, retreat and liberation',
    significations: ['expenses and losses', 'foreign lands', 'sleep and bed pleasures', 'hospitals and ashrams', 'isolation', 'spiritual liberation', 'charity'],
    groups: ['dusthana', 'apoklima'], karakas: ['saturn', 'ketu'],
    description: 'The twelfth house is the exit: expenses, foreign residence, sleep, retreat and moksha. It drains the material but can feed the spiritual.',
  },
];

export const getHouse = (n: number): HouseProfile => HOUSES[(((n - 1) % 12) + 12) % 12];
