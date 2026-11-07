/**
 * Life events used for rectification, and what each one means in a chart:
 * the houses (counted from the lagna) that must be "switched on", the natural
 * significators (karakas), and the divisional chart that confirms it.
 *
 * Primary houses are the event itself (7th for marriage). Secondary houses
 * support it (2nd = family grows, 11th = desire fulfilled). Death of a
 * parent uses the classical "house of the parent, the 8th from it (longevity)
 * and the 2nd/7th from it (marakas)" rule, so the 9th (father) brings in the
 * 4th, 10th and 3rd.
 */
import type { GrahaId, HouseNumber, VargaId } from '@vedic/engine';

export type LifeEventKind =
  | 'marriage'
  | 'relationship'
  | 'divorce'
  | 'childBirth'
  | 'siblingBirth'
  | 'education'
  | 'careerStart'
  | 'promotion'
  | 'jobLoss'
  | 'business'
  | 'windfall'
  | 'financialLoss'
  | 'property'
  | 'relocation'
  | 'fatherDeath'
  | 'motherDeath'
  | 'accident'
  | 'illness'
  | 'spiritual';

export type EventGroup = 'Love and partnership' | 'Family' | 'Study and work' | 'Money and home' | 'Loss and health' | 'Inner life';

export interface EventDef {
  kind: LifeEventKind;
  group: EventGroup;
  label: string;
  /** Prompt shown in the questionnaire */
  question: string;
  primary: HouseNumber[];
  secondary: HouseNumber[];
  karakas: GrahaId[];
  /** Divisional chart that has to agree */
  varga: VargaId;
  /** Why these houses, in plain words (shown in explanations and the PDF/guide) */
  rationale: string;
}

export const EVENT_DEFS: Record<LifeEventKind, EventDef> = {
  marriage: {
    kind: 'marriage', group: 'Love and partnership', label: 'Marriage',
    question: 'When did you marry?',
    primary: [7], secondary: [2, 11, 5], karakas: ['venus', 'jupiter'], varga: 'D9',
    rationale: 'The 7th is the spouse, the 2nd the family that grows, the 11th the wish fulfilled. Venus and Jupiter signify the partner, and the navamsa (D9) is the chart of marriage.',
  },
  relationship: {
    kind: 'relationship', group: 'Love and partnership', label: 'Serious relationship or engagement',
    question: 'When did a serious relationship or engagement begin?',
    primary: [5, 7], secondary: [11], karakas: ['venus'], varga: 'D9',
    rationale: 'The 5th is romance and the 7th commitment; Venus is love itself, confirmed in the navamsa.',
  },
  divorce: {
    kind: 'divorce', group: 'Love and partnership', label: 'Separation or divorce',
    question: 'When did a marriage or long relationship end?',
    primary: [6, 7, 12], secondary: [8, 2], karakas: ['venus', 'saturn', 'rahu'], varga: 'D9',
    rationale: 'The 6th is the 12th (loss) from the 7th, the 12th is separation and the 8th breaks; Saturn and Rahu bring the split, read again in the navamsa.',
  },
  childBirth: {
    kind: 'childBirth', group: 'Family', label: 'Birth of a child',
    question: 'When was a child of yours born?',
    primary: [5], secondary: [9, 11, 2], karakas: ['jupiter'], varga: 'D7',
    rationale: 'The 5th is children (the 9th is the 5th from the 5th, so the second child), Jupiter is the putra karaka, and the saptamsa (D7) is the chart of progeny.',
  },
  siblingBirth: {
    kind: 'siblingBirth', group: 'Family', label: 'Birth of a younger sibling',
    question: 'When was a younger brother or sister born?',
    primary: [3], secondary: [11], karakas: ['mars'], varga: 'D3',
    rationale: 'The 3rd is younger siblings (the 11th elder ones), Mars is the bhratri karaka, and the drekkana (D3) shows siblings.',
  },
  education: {
    kind: 'education', group: 'Study and work', label: 'Graduation or degree',
    question: 'When did you finish a degree or major course?',
    primary: [4, 9], secondary: [5, 2, 11], karakas: ['mercury', 'jupiter'], varga: 'D24',
    rationale: 'The 4th is schooling, the 5th intelligence, the 9th higher learning; Mercury and Jupiter rule study, read in the chaturvimsamsa (D24).',
  },
  careerStart: {
    kind: 'careerStart', group: 'Study and work', label: 'First job or new career',
    question: 'When did you start your first job, or a new career?',
    primary: [10], secondary: [6, 2, 11], karakas: ['saturn', 'sun', 'mercury'], varga: 'D10',
    rationale: 'The 10th is work, the 6th service, the 2nd and 11th income; Saturn, the Sun and Mercury signify work, read in the dasamsa (D10).',
  },
  promotion: {
    kind: 'promotion', group: 'Study and work', label: 'Promotion or big career rise',
    question: 'When did you get a major promotion or recognition?',
    primary: [10, 11], secondary: [2, 9], karakas: ['sun', 'jupiter'], varga: 'D10',
    rationale: 'The 10th is status and the 11th gains; the Sun is authority, read in the dasamsa (D10).',
  },
  jobLoss: {
    kind: 'jobLoss', group: 'Study and work', label: 'Job loss or career setback',
    question: 'When did you lose a job or suffer a career setback?',
    primary: [12, 8], secondary: [5, 9, 6], karakas: ['saturn', 'rahu'], varga: 'D10',
    rationale: 'The 9th is the 12th (loss) from the 10th, the 5th the 8th from it; the 12th and 8th are loss and upheaval themselves.',
  },
  business: {
    kind: 'business', group: 'Study and work', label: 'Started a business',
    question: 'When did you start your own business?',
    primary: [7, 10], secondary: [11, 3], karakas: ['mercury'], varga: 'D10',
    rationale: 'The 7th is trade and partners, the 10th the enterprise, the 3rd initiative; Mercury is commerce.',
  },
  windfall: {
    kind: 'windfall', group: 'Money and home', label: 'Big financial gain',
    question: 'When did you have a major financial gain?',
    primary: [11, 2], secondary: [5, 9], karakas: ['jupiter', 'venus'], varga: 'D2',
    rationale: 'The 2nd is wealth held and the 11th income; Jupiter and Venus bring plenty, read in the hora (D2).',
  },
  financialLoss: {
    kind: 'financialLoss', group: 'Money and home', label: 'Major financial loss',
    question: 'When did you have a major financial loss?',
    primary: [12, 8], secondary: [6], karakas: ['saturn', 'rahu'], varga: 'D2',
    rationale: 'The 12th is expense and the 8th sudden loss; the 6th is debt.',
  },
  property: {
    kind: 'property', group: 'Money and home', label: 'Bought a home or land',
    question: 'When did you buy a home or land?',
    primary: [4], secondary: [11, 2, 12], karakas: ['mars', 'venus'], varga: 'D4',
    rationale: 'The 4th is home and land, the 11th the gain of it, the 12th the money spent; Mars rules land and Venus comforts, read in the chaturthamsa (D4).',
  },
  relocation: {
    kind: 'relocation', group: 'Money and home', label: 'Moved far away or abroad',
    question: 'When did you move far from home, or abroad?',
    primary: [12, 3], secondary: [9, 4, 7], karakas: ['rahu', 'moon'], varga: 'D4',
    rationale: 'The 12th is foreign lands, the 3rd is the 12th from the 4th (leaving home), the 9th long journeys; Rahu signifies foreign places.',
  },
  fatherDeath: {
    kind: 'fatherDeath', group: 'Loss and health', label: "Father's passing",
    question: 'When did your father pass away?',
    primary: [9, 4], secondary: [10, 3, 8], karakas: ['sun', 'saturn'], varga: 'D12',
    rationale: "The 9th is the father; the 4th is the 8th from it (his longevity), the 10th and 3rd are his marakas (2nd and 7th from the 9th). The Sun signifies the father, read in the dwadasamsa (D12).",
  },
  motherDeath: {
    kind: 'motherDeath', group: 'Loss and health', label: "Mother's passing",
    question: 'When did your mother pass away?',
    primary: [4, 11], secondary: [5, 10, 8], karakas: ['moon', 'saturn'], varga: 'D12',
    rationale: "The 4th is the mother; the 11th is the 8th from it, the 5th and 10th her marakas. The Moon signifies the mother, read in the dwadasamsa (D12).",
  },
  accident: {
    kind: 'accident', group: 'Loss and health', label: 'Accident or surgery',
    question: 'When did you have a serious accident or surgery?',
    primary: [8, 6], secondary: [1, 12], karakas: ['mars', 'saturn', 'rahu', 'ketu'], varga: 'D30',
    rationale: 'The 8th is sudden events and the 6th injury, the lagna the body; Mars cuts and Rahu shocks, read in the trimsamsa (D30), the chart of misfortune.',
  },
  illness: {
    kind: 'illness', group: 'Loss and health', label: 'Serious illness',
    question: 'When did a serious illness begin?',
    primary: [6, 8], secondary: [1, 12], karakas: ['saturn', 'rahu', 'mars'], varga: 'D30',
    rationale: 'The 6th is disease and the 8th chronic trouble, the lagna the body; read in the trimsamsa (D30).',
  },
  spiritual: {
    kind: 'spiritual', group: 'Inner life', label: 'Spiritual turning point',
    question: 'When did you take initiation, or have a spiritual turning point?',
    primary: [9, 12], secondary: [5, 8], karakas: ['ketu', 'jupiter'], varga: 'D20',
    rationale: 'The 9th is dharma and the guru, the 12th liberation; Ketu and Jupiter signify spirit, read in the vimsamsa (D20).',
  },
};

export const EVENT_KINDS = Object.keys(EVENT_DEFS) as LifeEventKind[];

export interface LifeEvent {
  kind: LifeEventKind;
  /** "YYYY", "YYYY-MM" or "YYYY-MM-DD" (local date is fine: a day of slack is irrelevant here) */
  date: string;
  /** Optional note shown back in explanations */
  note?: string;
  /** Relative importance, default 1 (an exact, life-changing date can be 1.5) */
  weight?: number;
}

export type DatePrecision = 'day' | 'month' | 'year';

export interface EventSpan {
  start: Date;
  end: Date;
  precision: DatePrecision;
}

/** Parse the event date into the span it could fall in. */
export function eventSpan(date: string): EventSpan {
  const s = date.trim();
  let m = /^(\d{4})$/.exec(s);
  if (m) {
    const y = Number(m[1]);
    return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y + 1, 0, 1)), precision: 'year' };
  }
  m = /^(\d{4})-(\d{1,2})$/.exec(s);
  if (m) {
    const [y, mo] = [Number(m[1]), Number(m[2]) - 1];
    if (mo < 0 || mo > 11) throw new Error(`Invalid month in "${date}"`);
    return { start: new Date(Date.UTC(y, mo, 1)), end: new Date(Date.UTC(y, mo + 1, 1)), precision: 'month' };
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
    const start = new Date(Date.UTC(y, mo, d));
    if (start.getUTCMonth() !== mo) throw new Error(`Invalid date "${date}"`);
    return { start, end: new Date(Date.UTC(y, mo, d + 1)), precision: 'day' };
  }
  throw new Error(`Invalid event date "${date}", expected YYYY, YYYY-MM or YYYY-MM-DD`);
}

/** Instants sampled inside the span: 1 for a day, 4 for a month, 12 for a year. */
export function spanSamples(span: EventSpan): Date[] {
  const n = span.precision === 'day' ? 1 : span.precision === 'month' ? 4 : 12;
  const a = span.start.getTime();
  const len = span.end.getTime() - a;
  return Array.from({ length: n }, (_, i) => new Date(a + ((i + 0.5) / n) * len));
}
