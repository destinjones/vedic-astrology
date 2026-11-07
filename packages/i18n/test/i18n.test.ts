import { describe, expect, it } from 'vitest';
import { LOCALES, LOCALE_CODES, VOCAB, interpolate, matchLocale, plural } from '../src';

describe('locales', () => {
  it('has vocabulary for every language', () => {
    for (const code of LOCALE_CODES) {
      const v = VOCAB[code];
      expect(v.signs).toHaveLength(12);
      expect(v.nakshatras).toHaveLength(27);
      expect(v.houses).toHaveLength(12);
      for (let n = 1; n <= 12; n++) expect(v.ordinal(n)).toMatch(/\S/);
    }
    expect(LOCALES.map((l) => l.code)).toEqual([...LOCALE_CODES]);
  });

  it('matches browser languages', () => {
    expect(matchLocale(['hi-IN', 'en'])).toBe('hi');
    expect(matchLocale(['fr-FR', 'ta'])).toBe('ta');
    expect(matchLocale(['fr-FR'])).toBe('en');
  });

  it('formats placeholders and plurals', () => {
    expect(interpolate('{a} and {b}', { a: 1, b: 'x' })).toBe('1 and x');
    expect(interpolate('{missing}', {})).toBe('{missing}');
    expect(plural('en', 1, { one: '{count} yoga', other: '{count} yogas' })).toBe('1 yoga');
    expect(plural('en', 3, { one: '{count} yoga', other: '{count} yogas' })).toBe('3 yogas');
    expect(VOCAB.en.ordinal(2)).toBe('2nd');
    expect(VOCAB.hi.ordinal(7)).toBe('सप्तम');
  });
});
