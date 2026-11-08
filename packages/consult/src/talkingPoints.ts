/**
 * Talking points: short bullets per life area that an astrologer can read
 * from during a call. Each area has three parts:
 *   - promise: what the birth chart says (house lord, occupants, aspects,
 *     karakas, sarvashtakavarga, yogas and doshas on the houses)
 *   - now: whether the running mahadasha and antardasha lords are linked to
 *     the area, with the rule that links them
 *   - next: the best timing window ahead from the question finder
 */
import { type LifeEventKind, EVENT_SIGNIFICATIONS, lordRelevance, ordinal } from '@vedic/timing';
import { LIFE_AREAS, WATCH_KINDS, natalPromise, type AreaId, type Point } from './areas';
import { joinList, monthYear, runningChain, type ConsultContext } from './context';
import { timingWindows, windowLine, type TimingWindow } from './questions';

export interface AreaTalkingPoints {
  id: AreaId;
  label: string;
  kind: LifeEventKind;
  houses: number[];
  caution?: string;
  /** One sentence to open the topic with. */
  headline: string;
  promise: Point[];
  now: Point[];
  windows: TimingWindow[];
  /** True when the windows are periods to watch (health, losses), not periods to hope for. */
  watch: boolean;
  next: Point[];
}

function balance(points: Point[]): 'good' | 'mixed' | 'hard' {
  const g = points.filter((p) => p.tone === 'good').length, h = points.filter((p) => p.tone === 'hard').length;
  return g >= h + 2 ? 'good' : h >= g + 2 ? 'hard' : 'mixed';
}

export function areaTalkingPoints(ctx: ConsultContext, id: AreaId, opts: { years?: number } = {}): AreaTalkingPoints {
  const area = LIFE_AREAS.find((a) => a.id === id)!;
  const sig = EVENT_SIGNIFICATIONS[area.kind];
  const promise = natalPromise(ctx, area.kind);
  const chain = runningChain(ctx).slice(0, 2);
  const now: Point[] = [];
  for (const [i, p] of chain.entries()) {
    const r = lordRelevance(ctx.natal, p.lord, area.kind);
    const level = i === 0 ? 'mahadasha' : 'antardasha';
    if (r.relevance === 'none') now.push({ text: `The ${p.lord} ${level} is not tied to this area, so expect it to stay in the background until ${monthYear(p.end)}.`, tone: 'mixed' });
    else now.push({ text: `The ${p.lord} ${level} ${r.relevance === 'strong' ? 'is strongly linked' : 'is linked'}: ${p.lord} ${joinList(r.links.slice(0, 2))}. Runs until ${monthYear(p.end)}.`, tone: p.tone === 'challenging' || p.tone === 'difficult' ? 'hard' : 'good' });
  }
  const windows = timingWindows(ctx, area.kind, { years: opts.years ?? 6, limit: 3 });
  const watch = WATCH_KINDS.includes(area.kind);
  const next: Point[] = windows.length
    ? windows.map((w) => ({ text: windowLine(w, sig.houses[0]), tone: watch ? 'hard' : w.strength === 'strong' ? 'good' : 'mixed' }))
    : [{ text: `No period in the next ${opts.years ?? 6} years links strongly to the ${ordinal(sig.houses[0])} house; use the question finder with a longer range.`, tone: 'mixed' }];
  const feel = balance(promise);
  const linkedNow = chain.some((p) => lordRelevance(ctx.natal, p.lord, area.kind).relevance !== 'none');
  const headline = `${area.label}: ${feel === 'good' ? 'a well-supported area of the chart' : feel === 'hard' ? 'an area that asks for patience and effort' : 'a mixed picture, with both help and friction'}${linkedNow ? ', and the current period is working on it.' : '.'}`;
  return { id, label: area.label, kind: area.kind, houses: sig.houses, caution: area.caution, headline, promise, now, windows, watch, next };
}

export function talkingPoints(ctx: ConsultContext, areas: AreaId[] = LIFE_AREAS.map((a) => a.id)): AreaTalkingPoints[] {
  return areas.map((id) => areaTalkingPoints(ctx, id));
}

/** Plain text for notes or a clipboard, one area after another. */
export function talkingPointsText(name: string, areas: AreaTalkingPoints[]): string {
  const lines: string[] = [`Talking points for ${name}`, ''];
  for (const a of areas) {
    lines.push(a.label.toUpperCase(), a.headline);
    if (a.caution) lines.push(`(${a.caution})`);
    for (const p of [...a.promise, ...a.now]) lines.push(`- ${p.text}${p.source ? ` [${p.source}]` : ''}`);
    for (const p of a.next) lines.push(`- ${a.watch ? 'Period to watch' : 'Window'}: ${p.text}`);
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
