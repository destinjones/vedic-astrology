/**
 * Keeps English readings plain. Every reading must stay under the limits in
 * src/qa/readability.ts, and the average grade over all readings must stay
 * under AVERAGE_GRADE_LIMIT. See content/STYLE.md for how to fix a failure.
 */
import { describe, expect, it } from 'vitest';
import { englishCorpus } from '../src/qa/corpus';
import { AVERAGE_GRADE_LIMIT, readability, readabilityProblems, syllables } from '../src/qa/readability';

describe('readability', () => {
  const corpus = englishCorpus().map((c) => ({ ...c, r: readability(c.text) }));

  it('counts syllables sensibly', () => {
    expect(['sun', 'planet', 'wonderful', 'exaltation', 'courage'].map(syllables)).toEqual([1, 2, 3, 4, 2]);
  });

  it('ignores a term that is glossed in brackets', () => {
    expect(readability('The Moon has dig bala (directional strength) in the 4th.').jargon).toEqual([]);
    expect(readability('The Moon has dig bala in the 4th, a kendra.').jargon).toEqual(['dig bala', 'kendra']);
  });

  it('every English reading is within the limits', () => {
    const failures = corpus.map((c) => ({ id: c.id, problems: readabilityProblems(c.r) })).filter((f) => f.problems.length);
    expect(failures.map((f) => `${f.id}: ${f.problems.join('; ')}`)).toEqual([]);
  });

  it(`the average grade stays at or under ${AVERAGE_GRADE_LIMIT}`, () => {
    const avg = corpus.reduce((s, c) => s + c.r.grade, 0) / corpus.length;
    expect(avg).toBeLessThanOrEqual(AVERAGE_GRADE_LIMIT);
  });
});
