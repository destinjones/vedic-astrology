import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type BirthInput, type Chart, type Engine } from '@vedic/engine';
import { fromEngineChart, interpretChart } from '@vedic/interpretations';
import {
  LIFE_AREAS,
  QUESTION_TOPICS,
  answerQuestion,
  clientSnapshot,
  consultContext,
  matchQuestion,
  talkingPoints,
  talkingPointsText,
  timingWindows,
  type ConsultContext,
} from '../src';

let engine: Engine;
let chart: Chart;
let ctx: ConsultContext;
const DELHI = { name: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' };
const SAMPLE: BirthInput = { date: '1990-08-15', time: '06:30', place: DELHI, name: 'Sample' };
const NOW = new Date('2026-11-08T12:00:00Z');

beforeAll(async () => {
  engine = await createEngine();
  chart = engine.computeChart(SAMPLE, { dashaLevels: 3 });
  ctx = consultContext(engine, chart, interpretChart(fromEngineChart(chart)), NOW);
});

describe('question matching', () => {
  it.each([
    ['When will I get married?', 'marriage'],
    ['will my husband and I ever have a baby', 'children'],
    ['Should I switch jobs next year?', 'career'],
    ['when can I buy a house', 'property'],
    ['Will I get a visa to settle abroad?', 'abroad'],
    ['How do I clear my loan debts', 'debt'],
    ['Will I win the court case?', 'legal'],
  ])('%s → %s', (q, id) => {
    expect(matchQuestion(q)[0]?.topic.id).toBe(id);
  });

  it('returns nothing for a question it cannot place', () => {
    expect(matchQuestion('what colour should I paint the fence')).toEqual([]);
  });

  it('every topic has an example its own keywords match', () => {
    for (const t of QUESTION_TOPICS) expect(matchQuestion(t.example).map((m) => m.topic.id)).toContain(t.id);
  });

  it('does not offer to time death or accidents', () => {
    const kinds = QUESTION_TOPICS.map((t) => t.kind);
    for (const k of ['accident', 'loss-of-father', 'loss-of-mother', 'bereavement']) expect(kinds).not.toContain(k);
  });
});

describe('client snapshot', () => {
  it('fills every part from the chart', () => {
    const s = clientSnapshot(ctx, 'Sample');
    expect(s.bigThree.lagna).toMatch(/^[A-Z]/);
    expect(s.strengths.length).toBeGreaterThan(0);
    expect(s.strengths.length).toBeLessThanOrEqual(5);
    expect(s.challenges.length).toBeLessThanOrEqual(3);
    expect(s.dasha.maha).toBeDefined();
    expect(s.dasha.antar).toBeDefined();
    expect(Date.parse(s.dasha.antar!.start)).toBeLessThanOrEqual(NOW.getTime());
    expect(Date.parse(s.dasha.antar!.end)).toBeGreaterThan(NOW.getTime());
    expect(s.dasha.theme).toContain(s.dasha.maha!.lord);
    expect(s.transits.map((t) => t.planet)).toEqual(['Saturn', 'Jupiter', 'Rahu', 'Ketu']);
    for (const t of s.transits) expect(t.houseFromLagna).toBeGreaterThanOrEqual(1);
  });

  it('lists flags most serious first', () => {
    const s = clientSnapshot(ctx);
    const order = { high: 0, watch: 1, info: 2 };
    const levels = s.flags.map((f) => order[f.level]);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
  });

  it('flags every present dosha', () => {
    const s = clientSnapshot(ctx);
    for (const d of ctx.report.doshas.filter((x) => x.present && x.severity !== 'cancelled')) expect(s.flags.map((f) => f.id)).toContain(d.id);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(clientSnapshot(ctx))).toBe(JSON.stringify(clientSnapshot(ctx)));
  });
});

describe('talking points', () => {
  it('covers every life area with promise, now and next', () => {
    const tp = talkingPoints(ctx);
    expect(tp.map((a) => a.id)).toEqual(LIFE_AREAS.map((a) => a.id));
    for (const a of tp) {
      expect(a.promise.length).toBeGreaterThanOrEqual(3);
      expect(a.now.length).toBe(2);
      expect(a.next.length).toBeGreaterThan(0);
      expect(a.headline.startsWith(a.label)).toBe(true);
    }
    expect(tp.find((a) => a.id === 'health')!.caution).toMatch(/doctor/);
  });

  it('names the house lord for career', () => {
    const career = talkingPoints(ctx, ['career'])[0];
    expect(career.promise[0].text).toMatch(/^Your 10th \(.+\) lord: (Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn) is /);
  });

  it('renders as plain text', () => {
    const txt = talkingPointsText('Sample', talkingPoints(ctx, ['marriage', 'money']));
    expect(txt).toContain('MARRIAGE AND PARTNERSHIP');
    expect(txt).toContain('MONEY');
  });
});

describe('question finder', () => {
  it('answers a marriage question with the 7th house and Venus', () => {
    const a = answerQuestion(ctx, 'When will I marry?')!;
    expect(a.topic.id).toBe('marriage');
    expect(a.houses[0].house).toBe(7);
    expect(a.karakas.map((k) => k.planet)).toContain('Venus');
    expect(a.promise.length).toBeGreaterThan(2);
    expect(a.now).toMatch(/period/);
  });

  it('gives windows ahead, in date order, inside running periods', () => {
    const ws = timingWindows(ctx, 'marriage', { years: 10 });
    expect(ws.length).toBeGreaterThan(0);
    expect(ws.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < ws.length; i++) expect(ws[i].start.getTime()).toBeGreaterThanOrEqual(ws[i - 1].start.getTime());
    for (const w of ws) {
      expect(w.start.getTime()).toBeGreaterThanOrEqual(NOW.getTime());
      expect(w.end.getTime()).toBeGreaterThan(w.start.getTime());
      expect(w.reasons.length).toBeGreaterThan(0);
      if (w.strength === 'strong') expect(w.doubleTransit).toBe(true);
    }
  });

  it('lets the astrologer pick the topic when the words do not match', () => {
    expect(answerQuestion(ctx, 'tell me about next year')).toBeNull();
    expect(answerQuestion(ctx, 'tell me about next year', { topicId: 'career' })!.houses[0].house).toBe(10);
  });
});
