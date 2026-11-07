/**
 * Stable finding IDs. The ledger for a fixed set of charts is committed in
 * test/fixtures/findings-*.json; a change to detection or scoring shows up in
 * code review as a diff of that file. Regenerate on purpose with:
 *
 *   UPDATE_GOLDEN=1 npx vitest run test/findings.test.ts
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { createEngine, type BirthInput, type Engine } from '@vedic/engine';
import { FINDING_ID_VERSION, diffFindings, findingLedger, fromEngineChart, interpretChart, loadLocale, type ChartInput, type FindingLedger } from '../src';

const CHARTS: { id: string; input: BirthInput }[] = [
  { id: 'gandhi-1869', input: { date: '1869-10-02', time: '07:11', place: { latitude: 21.6417, longitude: 69.6293 } } },
  { id: 'delhi-1990', input: { date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } } },
  { id: 'santiago-2001', input: { date: '2001-02-28', time: '23:59', place: { latitude: -33.45, longitude: -70.66667, timezone: 'America/Santiago' } } },
];

let engine: Engine;
const charts = new Map<string, ChartInput>();
beforeAll(async () => {
  engine = await createEngine();
  for (const c of CHARTS) charts.set(c.id, fromEngineChart(engine.computeChart(c.input)));
  await loadLocale('hi');
});

const ID = /^(sign|house|nakshatra|retro|conj|aspect|lord|yoga|dosha|planet):[a-z0-9_+:-]+$/;

describe('finding ledger', () => {
  it('IDs are unique, sorted and follow the grammar', () => {
    for (const [, chart] of charts) {
      const { findings, version } = findingLedger(interpretChart(chart));
      expect(version).toBe(FINDING_ID_VERSION);
      const ids = findings.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(ids);
      for (const id of ids) expect(id).toMatch(ID);
    }
  });

  it('does not depend on the reading language', () => {
    for (const [, chart] of charts)
      expect(findingLedger(interpretChart(chart, { locale: 'hi' }))).toEqual(findingLedger(interpretChart(chart)));
  });

  it('diffs two ledgers', () => {
    const a = findingLedger(interpretChart(charts.get('gandhi-1869')!));
    const changedOne = { ...a.findings[0], score: a.findings[0].score + 1 };
    const b: FindingLedger = { version: a.version, findings: [changedOne, ...a.findings.slice(2), { id: 'yoga:test', kind: 'yoga', score: 1 }] };
    const d = diffFindings(a, b);
    expect(d.changed.map((c) => c.id)).toEqual([a.findings[0].id]);
    expect(d.removed.map((f) => f.id)).toEqual([a.findings[1].id]);
    expect(d.added.map((f) => f.id)).toEqual(['yoga:test']);
    expect(diffFindings(a, a)).toEqual({ added: [], removed: [], changed: [] });
  });

  for (const c of CHARTS)
    it(`matches the committed ledger for ${c.id}`, () => {
      const ledger = findingLedger(interpretChart(charts.get(c.id)!));
      const file = new URL(`./fixtures/findings-${c.id}.json`, import.meta.url);
      if (process.env.UPDATE_GOLDEN || !existsSync(file)) {
        // one finding per line, so a review diff reads as a list of changed findings
        writeFileSync(file, `{"version": ${ledger.version}, "findings": [\n${ledger.findings.map((f) => '  ' + JSON.stringify(f)).join(',\n')}\n]}\n`);
        if (!process.env.UPDATE_GOLDEN) throw new Error(`Wrote missing ledger findings-${c.id}.json; commit it and re-run`);
        return;
      }
      const want = JSON.parse(readFileSync(file, 'utf8')) as FindingLedger;
      expect(diffFindings(want, ledger)).toEqual({ added: [], removed: [], changed: [] });
    });
});
