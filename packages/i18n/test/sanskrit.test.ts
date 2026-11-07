import { describe, expect, it } from 'vitest';
import { SANSKRIT, VOCAB, withSanskritTerms } from '../src';

describe('Sanskrit terms', () => {
  it('replaces only the technical vocabulary', () => {
    const v = withSanskritTerms(VOCAB.en, 'iast');
    expect(v.planets.sun.name).toBe('Sūrya');
    expect(v.signs[0]).toBe('Meṣa');
    expect(v.vargas.D9).toBe('Navāṃśa');
    // ordinary words stay in the reader's language
    expect(v.houses[0]).toBe(VOCAB.en.houses[0]);
    expect(v.ordinal(3)).toBe('3rd');
    expect(withSanskritTerms(VOCAB.hi, 'devanagari').planets.moon.name).toBe('चन्द्र');
    expect(withSanskritTerms(VOCAB.en, 'local')).toBe(VOCAB.en);
  });

  it('has the same shape in both scripts', () => {
    for (const s of Object.values(SANSKRIT)) {
      expect(s.signs).toHaveLength(12);
      expect(s.nakshatras).toHaveLength(27);
      expect(s.bhavas).toHaveLength(12);
      expect(Object.keys(s.vargas)).toEqual(Object.keys(VOCAB.en.vargas));
      expect(Object.keys(s.dignity).sort()).toEqual(Object.keys(VOCAB.en.dignity).sort());
    }
    // IAST stays in Latin letters, Devanagari in Devanagari
    expect(SANSKRIT.iast.nakshatras.join('')).not.toMatch(/[ऀ-ॿ]/);
    expect(SANSKRIT.devanagari.nakshatras.join('').replace(/\s/g, '')).toMatch(/^[ऀ-ॿ]+$/);
  });
});
