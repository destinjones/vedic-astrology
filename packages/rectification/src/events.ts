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

/**
 * Kind names and the LifeEvent shape match the shared event model of the life
 * event checker (@vedic/timing lifeEvents.ts), so the same saved events feed
 * both tools. 'other' has no fixed meaning and is not scored here.
 */
export type LifeEventKind =
  | 'marriage' | 'relationship' | 'separation' | 'childbirth' | 'sibling-birth'
  | 'job' | 'promotion' | 'job-loss' | 'business'
  | 'education' | 'relocation' | 'foreign-travel' | 'property'
  | 'wealth' | 'financial-loss' | 'illness' | 'accident'
  | 'loss-of-father' | 'loss-of-mother' | 'bereavement'
  | 'spiritual' | 'legal' | 'other';

export type EventGroup = 'Relationships' | 'Career and money' | 'Home and movement' | 'Health and loss' | 'Other';

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
    kind: 'marriage', group: 'Relationships', label: 'Marriage',
    question: 'When did you marry?',
    primary: [7], secondary: [2, 11, 5], karakas: ['venus', 'jupiter'], varga: 'D9',
    rationale: 'The 7th is the spouse, the 2nd the family that grows, the 11th the wish fulfilled. Venus and Jupiter signify the partner, and the navamsa (D9) is the chart of marriage.',
  },
  relationship: {
    kind: 'relationship', group: 'Relationships', label: 'Serious relationship or engagement',
    question: 'When did a serious relationship or engagement begin?',
    primary: [5, 7], secondary: [11], karakas: ['venus'], varga: 'D9',
    rationale: 'The 5th is romance and the 7th commitment; Venus is love itself, confirmed in the navamsa.',
  },
  separation: {
    kind: 'separation', group: 'Relationships', label: 'Separation or divorce',
    question: 'When did a marriage or long relationship end?',
    primary: [6, 7, 12], secondary: [8, 2], karakas: ['venus', 'saturn', 'rahu'], varga: 'D9',
    rationale: 'The 6th is the 12th (loss) from the 7th, the 12th is separation and the 8th breaks; Saturn and Rahu bring the split, read again in the navamsa.',
  },
  childbirth: {
    kind: 'childbirth', group: 'Relationships', label: 'Birth of a child',
    question: 'When was a child of yours born?',
    primary: [5], secondary: [9, 11, 2], karakas: ['jupiter'], varga: 'D7',
    rationale: 'The 5th is children (the 9th is the 5th from the 5th, so the second child), Jupiter is the putra karaka, and the saptamsa (D7) is the chart of progeny.',
  },
  'sibling-birth': {
    kind: 'sibling-birth', group: 'Relationships', label: 'Birth of a younger sibling',
    question: 'When was a younger brother or sister born?',
    primary: [3], secondary: [11], karakas: ['mars'], varga: 'D3',
    rationale: 'The 3rd is younger siblings (the 11th elder ones), Mars is the bhratri karaka, and the drekkana (D3) shows siblings.',
  },
  education: {
    kind: 'education', group: 'Career and money', label: 'Graduation or degree',
    question: 'When did you finish a degree or major course?',
    primary: [4, 9], secondary: [5, 2, 11], karakas: ['mercury', 'jupiter'], varga: 'D24',
    rationale: 'The 4th is schooling, the 5th intelligence, the 9th higher learning; Mercury and Jupiter rule study, read in the chaturvimsamsa (D24).',
  },
  job: {
    kind: 'job', group: 'Career and money', label: 'First job or new career',
    question: 'When did you start your first job, or a new career?',
    primary: [10], secondary: [6, 2, 11], karakas: ['saturn', 'sun', 'mercury'], varga: 'D10',
    rationale: 'The 10th is work, the 6th service, the 2nd and 11th income; Saturn, the Sun and Mercury signify work, read in the dasamsa (D10).',
  },
  promotion: {
    kind: 'promotion', group: 'Career and money', label: 'Promotion or big career rise',
    question: 'When did you get a major promotion or recognition?',
    primary: [10, 11], secondary: [2, 9], karakas: ['sun', 'jupiter'], varga: 'D10',
    rationale: 'The 10th is status and the 11th gains; the Sun is authority, read in the dasamsa (D10).',
  },
  'job-loss': {
    kind: 'job-loss', group: 'Career and money', label: 'Job loss or career setback',
    question: 'When did you lose a job or suffer a career setback?',
    primary: [12, 8], secondary: [5, 9, 6], karakas: ['saturn', 'rahu'], varga: 'D10',
    rationale: 'The 9th is the 12th (loss) from the 10th, the 5th the 8th from it; the 12th and 8th are loss and upheaval themselves.',
  },
  business: {
    kind: 'business', group: 'Career and money', label: 'Started a business',
    question: 'When did you start your own business?',
    primary: [7, 10], secondary: [11, 3], karakas: ['mercury'], varga: 'D10',
    rationale: 'The 7th is trade and partners, the 10th the enterprise, the 3rd initiative; Mercury is commerce.',
  },
  wealth: {
    kind: 'wealth', group: 'Career and money', label: 'Big financial gain',
    question: 'When did you have a major financial gain?',
    primary: [11, 2], secondary: [5, 9], karakas: ['jupiter', 'venus'], varga: 'D2',
    rationale: 'The 2nd is wealth held and the 11th income; Jupiter and Venus bring plenty, read in the hora (D2).',
  },
  'financial-loss': {
    kind: 'financial-loss', group: 'Career and money', label: 'Major financial loss',
    question: 'When did you have a major financial loss?',
    primary: [12, 8], secondary: [6], karakas: ['saturn', 'rahu'], varga: 'D2',
    rationale: 'The 12th is expense and the 8th sudden loss; the 6th is debt.',
  },
  property: {
    kind: 'property', group: 'Home and movement', label: 'Bought a home or land',
    question: 'When did you buy a home or land?',
    primary: [4], secondary: [11, 2, 12], karakas: ['mars', 'venus'], varga: 'D4',
    rationale: 'The 4th is home and land, the 11th the gain of it, the 12th the money spent; Mars rules land and Venus comforts, read in the chaturthamsa (D4).',
  },
  'foreign-travel': {
    kind: 'foreign-travel', group: 'Home and movement', label: 'Moved or travelled abroad',
    question: 'When did you move or travel abroad?',
    primary: [12, 3], secondary: [9, 4, 7], karakas: ['rahu', 'moon'], varga: 'D4',
    rationale: 'The 12th is foreign lands, the 3rd is the 12th from the 4th (leaving home), the 9th long journeys; Rahu signifies foreign places.',
  },
  'loss-of-father': {
    kind: 'loss-of-father', group: 'Health and loss', label: "Father's passing",
    question: 'When did your father pass away?',
    primary: [9, 4], secondary: [10, 3, 8], karakas: ['sun', 'saturn'], varga: 'D12',
    rationale: "The 9th is the father; the 4th is the 8th from it (his longevity), the 10th and 3rd are his marakas (2nd and 7th from the 9th). The Sun signifies the father, read in the dwadasamsa (D12).",
  },
  'loss-of-mother': {
    kind: 'loss-of-mother', group: 'Health and loss', label: "Mother's passing",
    question: 'When did your mother pass away?',
    primary: [4, 11], secondary: [5, 10, 8], karakas: ['moon', 'saturn'], varga: 'D12',
    rationale: "The 4th is the mother; the 11th is the 8th from it, the 5th and 10th her marakas. The Moon signifies the mother, read in the dwadasamsa (D12).",
  },
  accident: {
    kind: 'accident', group: 'Health and loss', label: 'Accident or surgery',
    question: 'When did you have a serious accident or surgery?',
    primary: [8, 6], secondary: [1, 12], karakas: ['mars', 'saturn', 'rahu', 'ketu'], varga: 'D30',
    rationale: 'The 8th is sudden events and the 6th injury, the lagna the body; Mars cuts and Rahu shocks, read in the trimsamsa (D30), the chart of misfortune.',
  },
  illness: {
    kind: 'illness', group: 'Health and loss', label: 'Serious illness',
    question: 'When did a serious illness begin?',
    primary: [6, 8], secondary: [1, 12], karakas: ['saturn', 'rahu', 'mars'], varga: 'D30',
    rationale: 'The 6th is disease and the 8th chronic trouble, the lagna the body; read in the trimsamsa (D30).',
  },
  spiritual: {
    kind: 'spiritual', group: 'Other', label: 'Spiritual turning point',
    question: 'When did you take initiation, or have a spiritual turning point?',
    primary: [9, 12], secondary: [5, 8], karakas: ['ketu', 'jupiter'], varga: 'D20',
    rationale: 'The 9th is dharma and the guru, the 12th liberation; Ketu and Jupiter signify spirit, read in the vimsamsa (D20).',
  },
  relocation: {
    kind: 'relocation', group: 'Home and movement', label: 'Moved home',
    question: 'When did you move to a new home or city?',
    primary: [4, 3], secondary: [12], karakas: ['moon'], varga: 'D4',
    rationale: 'The 4th is home; the 3rd (12th from the 4th) and the 12th move you from it. The Moon is the karaka of home, read in the chaturthamsa (D4).',
  },
  bereavement: {
    kind: 'bereavement', group: 'Health and loss', label: 'Other bereavement',
    question: 'When did you lose someone close?',
    primary: [8, 2, 7], secondary: [12], karakas: ['saturn'], varga: 'D1',
    rationale: 'The 8th is endings, the 2nd and 7th are the maraka houses and the 12th loss; Saturn signifies grief.',
  },
  legal: {
    kind: 'legal', group: 'Other', label: 'Legal case or dispute',
    question: 'When did a legal case or serious dispute begin?',
    primary: [6, 7], secondary: [12], karakas: ['saturn', 'mars'], varga: 'D6',
    rationale: 'The 6th is litigation and enemies, the 7th open opponents, the 12th confinement; read in the shashthamsa (D6).',
  },
  other: {
    kind: 'other', group: 'Other', label: 'Other event',
    question: 'Another event with no fixed meaning (not used for scoring)',
    primary: [], secondary: [], karakas: [], varga: 'D1',
    rationale: 'No fixed signification, so it cannot vote for or against a birth time.',
  },
};

export const EVENT_KINDS = Object.keys(EVENT_DEFS) as LifeEventKind[];
/** Kinds that carry a signification and so can rank birth times */
export const SCORED_KINDS = EVENT_KINDS.filter((k) => EVENT_DEFS[k].primary.length > 0);

export interface LifeEvent {
  /** Optional stable id (the shared event model always sets one) */
  id?: string;
  kind: LifeEventKind;
  /**
   * "YYYY-MM-DD" (with `precision` for month- or year-level dates, as the
   * shared model stores them), or a bare "YYYY" / "YYYY-MM".
   */
  date: string;
  precision?: DatePrecision;
  title?: string;
  note?: string;
  /** Relative importance, default 1 */
  weight?: number;
}

export type DatePrecision = 'day' | 'month' | 'year';

export interface EventSpan {
  start: Date;
  end: Date;
  precision: DatePrecision;
}

/** The span an event could fall in. Accepts a LifeEvent or a bare date string. */
export function eventSpan(ev: string | Pick<LifeEvent, 'date' | 'precision'>): EventSpan {
  const date = typeof ev === 'string' ? ev : ev.date;
  let s = date.trim();
  const precision = typeof ev === 'string' ? undefined : ev.precision;
  if (precision === 'year') s = s.slice(0, 4);
  else if (precision === 'month') s = s.slice(0, 7);
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
