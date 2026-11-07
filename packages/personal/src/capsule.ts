/**
 * Time capsule: seal a chart and a prediction, reopen it later, score it.
 *
 * The seal is a SHA-256 over the prediction, the chart key and both dates, so
 * an edited capsule no longer verifies. It proves nothing to anyone else (the
 * capsule lives in your own browser), but it keeps you honest with yourself.
 */

export const CAPSULE_SCORES = ['Missed', 'Mostly off', 'Partly right', 'Mostly right', 'Spot on'] as const;
export type CapsuleScore = 0 | 1 | 2 | 3 | 4;

export interface Capsule {
  v: 1;
  id: string;
  /** Identifies the chart the capsule belongs to (date, time, place). */
  chartKey: string;
  /** Who it is for, shown on the sealed capsule. */
  label: string;
  prediction: string;
  /** What was running when it was sealed, e.g. "Jupiter–Saturn dasha". */
  context?: string;
  sealedAt: string;
  opensAt: string;
  /** hex SHA-256 seal */
  seal: string;
  openedEarly?: boolean;
  openedAt?: string;
  score?: CapsuleScore;
  note?: string;
  scoredAt?: string;
}

export type CapsuleState = 'sealed' | 'ready' | 'open' | 'scored';

async function sha256(text: string): Promise<string> {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const sealText = (c: Pick<Capsule, 'chartKey' | 'prediction' | 'sealedAt' | 'opensAt'>) =>
  JSON.stringify([c.chartKey, c.prediction, c.sealedAt, c.opensAt]);

export interface SealInput {
  chartKey: string;
  label: string;
  prediction: string;
  context?: string;
  /** Default: one year from now. */
  opensAt?: Date;
  now?: Date;
}

export async function sealCapsule(i: SealInput): Promise<Capsule> {
  const now = i.now ?? new Date();
  const prediction = i.prediction.trim().slice(0, 2000);
  if (!prediction) throw new Error('A capsule needs a prediction.');
  const opens = i.opensAt ?? new Date(now.getTime() + 365 * 86_400_000);
  if (opens.getTime() <= now.getTime()) throw new Error('The opening date must be in the future.');
  const base = { chartKey: i.chartKey, prediction, sealedAt: now.toISOString(), opensAt: opens.toISOString() };
  const seal = await sha256(sealText(base));
  return { v: 1, id: seal.slice(0, 12), label: i.label.slice(0, 80), context: i.context?.slice(0, 200), ...base, seal };
}

export const verifyCapsule = async (c: Capsule) => (await sha256(sealText(c))) === c.seal;

export function capsuleState(c: Capsule, now: Date = new Date()): CapsuleState {
  if (c.score !== undefined) return 'scored';
  if (c.openedAt) return 'open';
  return now.getTime() >= new Date(c.opensAt).getTime() ? 'ready' : 'sealed';
}

export function openCapsule(c: Capsule, now: Date = new Date()): Capsule {
  if (c.openedAt) return c;
  return { ...c, openedAt: now.toISOString(), openedEarly: now.getTime() < new Date(c.opensAt).getTime() };
}

export function scoreCapsule(c: Capsule, score: CapsuleScore, note = '', now: Date = new Date()): Capsule {
  const opened = openCapsule(c, now);
  return { ...opened, score, note: note.slice(0, 1000), scoredAt: now.toISOString() };
}

/** How the predictions have held up: mean score as a percentage (0 = all missed, 100 = all spot on). */
export function capsuleRecord(list: Capsule[]): { scored: number; percent: number | null; onTime: number } {
  const s = list.filter((c) => c.score !== undefined);
  if (!s.length) return { scored: 0, percent: null, onTime: 0 };
  const mean = s.reduce((a, c) => a + (c.score as number), 0) / s.length;
  return { scored: s.length, percent: Math.round((mean / 4) * 100), onTime: s.filter((c) => !c.openedEarly).length };
}

/** Parse a stored list, dropping anything malformed. */
export function parseCapsules(raw: unknown): Capsule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((c): c is Capsule =>
    !!c && typeof c === 'object' && (c as Capsule).v === 1 &&
    typeof (c as Capsule).id === 'string' && typeof (c as Capsule).prediction === 'string' &&
    typeof (c as Capsule).seal === 'string' && typeof (c as Capsule).opensAt === 'string' &&
    typeof (c as Capsule).sealedAt === 'string' && typeof (c as Capsule).chartKey === 'string' &&
    ((c as Capsule).score === undefined || [0, 1, 2, 3, 4].includes((c as Capsule).score as number)),
  );
}

/** "in 11 months", "in 3 days", "today" */
export function untilText(opensAt: string, now: Date = new Date()): string {
  const days = Math.ceil((new Date(opensAt).getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days < 45) return `in ${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `in ${months} months` : `in ${Math.round(months / 12)} years`;
}
