/**
 * Question finder: a client's question in their own words ("when will I
 * marry?") goes to a topic by keyword, and the topic goes to houses, karakas
 * and timing windows with the same rules the event checker uses.
 *
 * Matching is plain keyword scoring, so it is predictable and works offline.
 * When nothing matches, the caller shows the topic list instead of guessing.
 *
 * Timing windows: each Vimshottari antardasha ahead is tested with
 * `lordRelevance` (ownership, occupation, aspect, karaka, nakshatra lord) for
 * both its lords, then overlapped with Jupiter–Saturn double transits over the
 * topic's main house (K. N. Rao's rule). Dasha and double transit together
 * make a strong window; the dasha alone makes a supporting one.
 */
import {
  type DashaPeriod,
  type LifeEventKind,
  type Planet,
  type RelevanceCheck,
  EVENT_SIGNIFICATIONS,
  DAY_MS,
  doubleTransitWindows,
  lordRelevance,
  ordinal,
} from '@vedic/timing';
import { WATCH_KINDS, houseFacts, natalPromise, placementPhrase, type HouseFacts, type Point } from './areas';
import { isoDay, joinList, monthYear, subPeriods, type ConsultContext } from './context';

export interface QuestionTopic {
  id: string;
  label: string;
  kind: LifeEventKind;
  /** Words and phrases that point to this topic, lower case. Longer phrases score more. */
  keywords: string[];
  /** A typical question, shown as a suggestion. */
  example: string;
}

/**
 * Topics the finder answers. Questions about death, a parent's death or
 * accidents are left out on purpose: the app does not time those.
 */
export const QUESTION_TOPICS: QuestionTopic[] = [
  { id: 'marriage', label: 'Marriage', kind: 'marriage', example: 'When will I get married?', keywords: ['marry', 'married', 'marriage', 'wedding', 'wed', 'spouse', 'husband', 'wife', 'shaadi', 'vivah', 'settle down', 'life partner', 'engaged', 'engagement', 'proposal'] },
  { id: 'love', label: 'Love and relationships', kind: 'relationship', example: 'Will I find love this year?', keywords: ['love', 'relationship', 'boyfriend', 'girlfriend', 'partner', 'romance', 'dating', 'soulmate', 'crush', 'someone special'] },
  { id: 'separation', label: 'Separation or divorce', kind: 'separation', example: 'Is my marriage heading for a separation?', keywords: ['divorce', 'separation', 'separate', 'break up', 'breakup', 'split', 'leave my husband', 'leave my wife'] },
  { id: 'children', label: 'Children', kind: 'childbirth', example: 'When will we have a child?', keywords: ['child', 'children', 'baby', 'pregnant', 'pregnancy', 'conceive', 'son', 'daughter', 'kids', 'santan', 'fertility', 'ivf'] },
  { id: 'career', label: 'Job and career', kind: 'job', example: 'When will I get a new job?', keywords: ['job', 'career', 'work', 'employment', 'hired', 'interview', 'offer', 'naukri', 'profession', 'switch jobs', 'change jobs', 'government job'] },
  { id: 'promotion', label: 'Promotion and recognition', kind: 'promotion', example: 'Will I be promoted soon?', keywords: ['promotion', 'promoted', 'raise', 'recognition', 'fame', 'status', 'boss', 'award', 'position'] },
  { id: 'business', label: 'Business', kind: 'business', example: 'Is this a good time to start a business?', keywords: ['business', 'startup', 'start up', 'company', 'own venture', 'venture', 'shop', 'trade', 'clients', 'self employed', 'partnership deal'] },
  { id: 'money', label: 'Money and wealth', kind: 'wealth', example: 'When will my finances improve?', keywords: ['money', 'wealth', 'rich', 'finance', 'finances', 'financial', 'income', 'salary', 'savings', 'investment', 'invest', 'profit', 'lottery', 'dhan'] },
  { id: 'debt', label: 'Debt and losses', kind: 'financial-loss', example: 'When will I clear my debts?', keywords: ['debt', 'debts', 'loan', 'loss', 'losses', 'bankrupt', 'owe', 'emi'] },
  { id: 'property', label: 'Property and vehicles', kind: 'property', example: 'When can I buy a house?', keywords: ['house', 'home', 'property', 'flat', 'apartment', 'land', 'plot', 'car', 'vehicle', 'real estate', 'buy a house'] },
  { id: 'relocation', label: 'Moving home', kind: 'relocation', example: 'Will I move to another city?', keywords: ['move', 'moving', 'relocate', 'relocation', 'shift', 'new city', 'transfer'] },
  { id: 'abroad', label: 'Going abroad', kind: 'foreign-travel', example: 'Will I settle abroad?', keywords: ['abroad', 'foreign', 'overseas', 'visa', 'immigration', 'immigrate', 'green card', 'emigrate', 'settle abroad', 'usa', 'canada', 'uk', 'australia'] },
  { id: 'education', label: 'Education and exams', kind: 'education', example: 'Will I pass my exams?', keywords: ['study', 'studies', 'education', 'exam', 'exams', 'degree', 'college', 'university', 'admission', 'school', 'masters', 'phd', 'course'] },
  { id: 'health', label: 'Health', kind: 'illness', example: 'How will my health be this year?', keywords: ['health', 'ill', 'illness', 'sick', 'disease', 'surgery', 'hospital', 'recovery', 'recover', 'healthy', 'medical'] },
  { id: 'legal', label: 'Legal matters', kind: 'legal', example: 'Will I win my court case?', keywords: ['court', 'case', 'legal', 'lawsuit', 'litigation', 'lawyer', 'dispute', 'police', 'judge'] },
  { id: 'spiritual', label: 'Spiritual path', kind: 'spiritual', example: 'When will I find spiritual direction?', keywords: ['spiritual', 'spirituality', 'meditation', 'guru', 'moksha', 'faith', 'pilgrimage', 'dharma', 'purpose'] },
];

/** Words that set the scene rather than name the topic ("my husband and I want a baby"): they count for less. */
const CONTEXT_WORDS = new Set(['husband', 'wife', 'spouse', 'partner', 'boss', 'clients', 'work', 'home', 'position', 'status', 'offer', 'case', 'purpose', 'faith']);

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ').trim();

export interface TopicMatch { topic: QuestionTopic; score: number; matched: string[] }

/** Topics the question points to, best first. Empty when no keyword matches. */
export function matchQuestion(question: string): TopicMatch[] {
  const q = ` ${words(question)} `;
  const out: TopicMatch[] = [];
  for (const topic of QUESTION_TOPICS) {
    const matched = topic.keywords.filter((k) => q.includes(` ${k} `) || (k.length > 4 && q.includes(` ${k}`)));
    if (!matched.length) continue;
    // a phrase of several words is more specific than one word
    const score = matched.reduce((a, k) => a + (CONTEXT_WORDS.has(k) ? 0.5 : 1) + (k.split(' ').length - 1) * 0.75, 0);
    out.push({ topic, score, matched });
  }
  return out.sort((a, b) => b.score - a.score || QUESTION_TOPICS.indexOf(a.topic) - QUESTION_TOPICS.indexOf(b.topic));
}

export type WindowStrength = 'strong' | 'supporting';

export interface TimingWindow {
  start: Date;
  end: Date;
  strength: WindowStrength;
  /** Mahadasha and antardasha lords. */
  path: [Planet, Planet];
  /** True when a Jupiter–Saturn double transit over the main house overlaps the period. */
  doubleTransit: boolean;
  /** Why, most important first. */
  reasons: string[];
  /** Combined relevance points, for ranking. */
  points: number;
}

export interface FinderOptions {
  /** Years ahead to search. Default 10. */
  years?: number;
  /** Most windows returned. Default 5. */
  limit?: number;
}

/**
 * Periods ahead that the tradition connects with `kind`: antardashas whose
 * lords are linked to the topic, narrowed to the months when Jupiter and
 * Saturn both influence the main house or its lord.
 */
export function timingWindows(ctx: ConsultContext, kind: LifeEventKind, opts: FinderOptions = {}): TimingWindow[] {
  const sig = EVENT_SIGNIFICATIONS[kind];
  if (!sig.houses.length) return [];
  const from = ctx.now;
  const to = new Date(from.getTime() + (opts.years ?? 10) * 365.25 * DAY_MS);
  const main = sig.houses[0];
  const dt = doubleTransitWindows(ctx.natal, ctx.eph, from, to, { houses: [main], rule: 'house-or-lord', stepDays: 7 });
  const rel = new Map<Planet, RelevanceCheck>();
  const relOf = (p: Planet) => rel.get(p) ?? rel.set(p, lordRelevance(ctx.natal, p, kind)).get(p)!;

  const antars: { maha: DashaPeriod; antar: DashaPeriod }[] = [];
  for (const maha of ctx.dashas) {
    if (maha.end <= from || maha.start >= to) continue;
    for (const antar of subPeriods(ctx, maha)) if (antar.end > from && antar.start < to) antars.push({ maha, antar });
  }

  const out: TimingWindow[] = [];
  for (const { maha, antar } of antars) {
    const rm = relOf(maha.lord), ra = relOf(antar.lord);
    // the antardasha lord delivers the event; the mahadasha lord sets the stage
    if (ra.relevance === 'none') continue;
    if (rm.relevance === 'none' && ra.relevance !== 'strong') continue;
    const points = ra.points + rm.points * 0.6;
    const start = antar.start < from ? from : antar.start;
    const end = antar.end > to ? to : antar.end;
    const reasons: string[] = [];
    if (antar.lord === maha.lord) reasons.push(`${maha.lord} runs both levels and ${ra.links[0]}`);
    else {
      if (rm.relevance !== 'none') reasons.push(`Mahadasha lord ${maha.lord} ${rm.links[0]}`);
      reasons.push(`Antardasha lord ${antar.lord} ${joinList(ra.links.slice(0, 2))}`);
    }
    const overlaps = dt.filter((w) => w.start < end && w.end > start);
    if (overlaps.length) {
      for (const w of overlaps) {
        const s = w.start > start ? w.start : start, e = w.end < end ? w.end : end;
        if (e.getTime() - s.getTime() < 20 * DAY_MS) continue;
        out.push({
          start: s, end: e, path: [maha.lord, antar.lord], doubleTransit: true, points: points + 2,
          strength: rm.relevance !== 'none' ? 'strong' : 'supporting',
          reasons: [...reasons, `Jupiter and Saturn both touch your ${ordinal(main)} house or its lord (double transit): Jupiter ${w.jupiter[0] ?? ''}, Saturn ${w.saturn[0] ?? ''}`.replace(/ ,/g, ',').trim()],
        });
      }
    } else {
      out.push({ start, end, path: [maha.lord, antar.lord], doubleTransit: false, points, strength: 'supporting', reasons: [...reasons, `No Jupiter–Saturn double transit over the ${ordinal(main)} in this period, so look for the trigger in shorter transits`] });
    }
  }
  const rank = (w: TimingWindow) => (w.strength === 'strong' ? 100 : 0) + (w.doubleTransit ? 10 : 0) + w.points;
  const best = [...out].sort((a, b) => rank(b) - rank(a)).slice(0, opts.limit ?? 5);
  return best.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface QuestionAnswer {
  question: string;
  topic: QuestionTopic;
  /** Other topics the question also matched. */
  alsoMatched: QuestionTopic[];
  /** The matched words, so the astrologer can see why. */
  matched: string[];
  /** Classical reasoning for the houses and karakas. */
  rule: string;
  houses: HouseFacts[];
  karakas: { planet: Planet; text: string }[];
  /** The natal promise: what the chart says about the topic before timing. */
  promise: Point[];
  windows: TimingWindow[];
  /** True when the windows are periods to watch (health, separation, losses, disputes). */
  watch: boolean;
  /** The running period's link to the topic, in a sentence. */
  now: string;
}

/** Answer a question for a topic id, or for the best keyword match. Null when nothing matches. */
export function answerQuestion(ctx: ConsultContext, question: string, opts: FinderOptions & { topicId?: string } = {}): QuestionAnswer | null {
  const matches = matchQuestion(question);
  const topic = opts.topicId ? QUESTION_TOPICS.find((t) => t.id === opts.topicId) : matches[0]?.topic;
  if (!topic) return null;
  const sig = EVENT_SIGNIFICATIONS[topic.kind];
  const running = ctx.dashas.find((d) => d.start <= ctx.now && ctx.now < d.end);
  const antar = running ? subPeriods(ctx, running).find((d) => d.start <= ctx.now && ctx.now < d.end) : undefined;
  let now = 'No running period found.';
  if (running) {
    const rm = lordRelevance(ctx.natal, running.lord, topic.kind);
    const ra = antar ? lordRelevance(ctx.natal, antar.lord, topic.kind) : null;
    const name = `${running.lord}${antar ? `–${antar.lord}` : ''}`;
    const linked = [rm, ra].filter((r) => r && r.relevance !== 'none').length;
    now = linked === 2
      ? `The running ${name} period is linked to this question at both levels: ${running.lord} ${rm.links[0]}, and ${antar!.lord} ${ra!.links[0]}. It is live now, until ${monthYear(antar!.end)}.`
      : linked === 1
        ? `The running ${name} period is partly linked: ${rm.relevance !== 'none' ? `${running.lord} ${rm.links[0]}` : `${antar!.lord} ${ra!.links[0]}`}.`
        : `The running ${name} period does not point to this topic, so the windows below matter more than now.`;
  }
  return {
    question,
    topic,
    alsoMatched: matches.filter((m) => m.topic !== topic).map((m) => m.topic).slice(0, 3),
    matched: matches.find((m) => m.topic === topic)?.matched ?? [],
    rule: sig.rule,
    houses: sig.houses.slice(0, 3).map((h) => houseFacts(ctx, h)),
    karakas: sig.karakas.map((p) => ({ planet: p, text: placementPhrase(ctx, p) })),
    promise: natalPromise(ctx, topic.kind),
    windows: timingWindows(ctx, topic.kind, opts),
    watch: WATCH_KINDS.includes(topic.kind),
    now,
  };
}

/** One line for a window, e.g. "Mar 2027 – Nov 2027 (strong): Venus–Jupiter, double transit on the 7th". */
export function windowLine(w: TimingWindow, house?: number): string {
  return `${monthYear(w.start)} – ${monthYear(w.end)} (${w.strength}): ${w.path[0]}–${w.path[1]}${w.doubleTransit ? `, with the double transit${house ? ` on the ${ordinal(house)}` : ''}` : ''}`;
}

export const windowIso = (w: TimingWindow) => `${isoDay(w.start)}/${isoDay(w.end)}`;
