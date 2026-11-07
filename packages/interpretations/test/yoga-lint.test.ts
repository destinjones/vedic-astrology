/**
 * The yoga lint. Every yoga the detector can report must have:
 *   1. a citation in content/yogas.yaml,
 *   2. a cancellation note in content/yogas.yaml, and
 *   3. a positive test chart in test/fixtures/yoga-charts.json that forms it.
 * Adding a yoga to src/yogas.ts without all three fails CI. To find a chart for
 * a new yoga, run: npx tsx scripts/find-yoga-fixtures.ts <yoga-id>
 */
import { describe, expect, it } from 'vitest';
import { YOGA_DEFINITIONS, YOGA_META, detectYogas } from '../src';
import { chartFromFixture, type YogaFixture } from './fixtures/chart';
import FIXTURES from './fixtures/yoga-charts.json';

const fixtures = FIXTURES as Record<string, YogaFixture>;
const ids = Object.keys(YOGA_DEFINITIONS);

describe('yoga lint', () => {
  it('has audit notes only for yogas that exist', () => {
    expect(Object.keys(YOGA_META).filter((id) => !YOGA_DEFINITIONS[id])).toEqual([]);
    expect(Object.keys(fixtures).filter((id) => !YOGA_DEFINITIONS[id])).toEqual([]);
  });

  describe.each(ids)('%s', (id) => {
    it('cites a source', () => {
      const m = YOGA_META[id];
      expect(m, `add ${id} to content/yogas.yaml`).toBeDefined();
      expect(m.citation.source.trim().length).toBeGreaterThan(2);
      if (m.citation.verified) expect(m.citation.edition, `${id}: say which edition you checked`).toBeTruthy();
    });
    it('has a cancellation note', () => {
      expect(YOGA_META[id]?.cancellation?.trim().length ?? 0, `add a cancellation note for ${id} in content/yogas.yaml`).toBeGreaterThanOrEqual(20);
    });
    it('is found in its positive test chart', () => {
      const f = fixtures[id];
      expect(f, `add a chart that forms ${id} to test/fixtures/yoga-charts.json`).toBeDefined();
      const found = detectYogas(chartFromFixture(f)).find((y) => y.id === id);
      expect(found, `${id} is no longer found in its test chart`).toBeDefined();
    });
  });
});
