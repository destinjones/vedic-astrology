import { describe, expect, it } from 'vitest';
import {
  DOSHA_DEFINITIONS, DOSHA_SOURCES, EDITIONS, READING_SOURCES, YOGA_DEFINITIONS, YOGA_SOURCES,
  citationUrl, formatCitation, formatSource, getHouseLordIn, getPlanetInHouse, localizedYoga, localizer,
} from '../src';
import type { RuleSource } from '../src';

const all = (): [string, RuleSource | null][] => [
  ...Object.entries(YOGA_SOURCES).map(([k, v]) => [`yoga:${k}`, v] as [string, RuleSource | null]),
  ...Object.entries(DOSHA_SOURCES).map(([k, v]) => [`dosha:${k}`, v] as [string, RuleSource | null]),
  ...Object.entries(READING_SOURCES).map(([k, v]) => [`reading:${k}`, v] as [string, RuleSource | null]),
];

describe('classical sources', () => {
  it('has an explicit entry, citation or null, for every yoga and dosha', () => {
    expect(Object.keys(YOGA_SOURCES).sort()).toEqual(Object.keys(YOGA_DEFINITIONS).sort());
    expect(Object.keys(DOSHA_SOURCES).sort()).toEqual(Object.keys(DOSHA_DEFINITIONS).sort());
  });

  it('carries the source onto the definition and its reading', () => {
    expect(YOGA_DEFINITIONS.kemadruma.source).toBe(YOGA_SOURCES.kemadruma);
    expect(YOGA_DEFINITIONS.kemadruma.reading.source).toBe(YOGA_SOURCES.kemadruma);
    expect(DOSHA_DEFINITIONS['kaal-sarp'].reading.source).toBe(DOSHA_SOURCES['kaal-sarp']);
    expect(getHouseLordIn(1, 10).source).toBe(READING_SOURCES.houseLord);
    expect(getPlanetInHouse('sun', 10).source).toBe(READING_SOURCES.planetInHouse);
  });

  it('keeps the source when a yoga is translated', () => {
    expect(localizedYoga('ruchaka', localizer('hi')).source).toBe(YOGA_SOURCES.ruchaka);
  });

  it('writes every citation in a well-formed way', () => {
    for (const [id, s] of all()) {
      if (!s) continue;
      expect(s.citations.length > 0 || !!s.nonClassical || !!s.disagreement, id).toBe(true);
      for (const x of s.citations) {
        expect(EDITIONS[x.text], id).toBeDefined();
        expect(Number.isInteger(x.chapter) && x.chapter > 0, id).toBe(true);
        if (x.verse !== null) expect(x.verse, id).toMatch(/^\d+(-\d+)?$/);
      }
    }
  });

  it('formats citations for a superscript', () => {
    expect(formatCitation({ text: 'BPHS', chapter: 37, verse: '7-10' })).toBe('BPHS 37.7–10');
    expect(formatCitation({ text: 'Phaladeepika', chapter: 8, verse: null })).toBe('Phaladeepika 8');
    expect(formatSource(YOGA_SOURCES.adhi)).toBe('BPHS 37.5; Phaladeepika 6.42; Phaladeepika 6.43');
    expect(formatSource(null)).toBe('');
    expect(citationUrl({ text: 'Phaladeepika', chapter: 6, verse: '5' })).toMatch(/doc1621578/);
  });

  it('marks the doshas that classical texts do not describe', () => {
    for (const id of ['kaal-sarp', 'shrapit', 'grahan']) {
      expect(DOSHA_SOURCES[id]?.citations).toEqual([]);
      expect(DOSHA_SOURCES[id]?.nonClassical).toBeTruthy();
    }
  });
});
