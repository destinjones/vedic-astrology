import { describe, expect, it } from 'vitest';
import { BOOK_CHAPTERS, draftKey, emptyDraft, lines, normaliseDraft, paragraphs } from '../src/report/book/draft';

describe('Life Chart Book drafts', () => {
  it('fills in defaults and drops anything malformed', () => {
    const d = normaliseDraft({ title: '', letter: 'Hello', notes: { 'graha:sun': 'Bright', 'house:2': '   ', bad: 3 }, chapters: ['lagna', 'nope', 7], years: 7, spineMm: -2, print: 'yes' });
    expect(d.title).toBe('The Life Chart Book');
    expect(d.letter).toBe('Hello');
    expect(d.notes).toEqual({ 'graha:sun': 'Bright' });
    expect(d.chapters).toEqual(['lagna']);
    expect(d.years).toBe(10);
    expect(d.spineMm).toBe(0);
    expect(d.print).toBe(false);
    expect(normaliseDraft(null)).toEqual(emptyDraft());
    expect(emptyDraft().chapters).toEqual(BOOK_CHAPTERS.map((c) => c.id));
  });

  it('starts unsigned, and keeps "Prepared by" apart from the practice name', () => {
    expect(emptyDraft().author).toBe('');
    expect(emptyDraft().authorTitle).toBe('');
    const d = normaliseDraft({ author: '  Asha Rao ', authorTitle: 'Jyotishi', name: 'ignored' });
    expect(d.author).toBe('Asha Rao');
    expect(d.authorTitle).toBe('Jyotishi');
    expect(normaliseDraft({ author: 5 }).author).toBe('');
  });

  it('keeps one draft per birth', () => {
    const a = { name: 'Sam', date: '1990-08-15', time: '06:30', latitude: 28.61, longitude: 77.21 };
    expect(draftKey(a)).toBe(draftKey({ ...a }));
    expect(draftKey(a)).not.toBe(draftKey({ ...a, time: '06:31' }));
    expect(draftKey(a)).toMatch(/^vedic\.book\.[0-9a-z]+$/);
  });

  it('reads paragraphs and list lines the way the editor describes', () => {
    expect(paragraphs('One\nline.\n\n  Two  ')).toEqual(['One line.', 'Two']);
    expect(paragraphs('   ')).toEqual([]);
    expect(lines('- first\n2. second\n\n• third')).toEqual(['first', 'second', 'third']);
  });
});
