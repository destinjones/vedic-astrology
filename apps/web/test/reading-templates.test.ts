import { describe, expect, it } from 'vitest';
import type { Chart, PlanetId } from '../src/types/chart';
import { bookTopic, chartPlacements, isPlacementKey, labelFor, topicKeys } from '../src/practice/placements';
import {
  mergeLibrary, normalisePhrase, normaliseReading, normaliseTemplate, phrasesFor, phrasesForTopics, readingFromTemplate,
  readingKey, STARTER_TEMPLATES, withPhrase, type Phrase,
} from '../src/practice/store';

const input = { name: 'Asha', date: '1990-08-15', time: '06:30', place: 'New Delhi', latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata', ayanamsa: 'lahiri' as const };
// Leo rising; Moon in Taurus, Rohini, 10th; Sun and Venus in Cancer, the 12th; Saturn (lord of the 7th) in Sagittarius, the 5th
const at = (id: PlanetId, sign: number, nakshatra: number) => ({ id, sign, nakshatra, house: ((sign - 5 + 12) % 12) + 1, longitude: 0, degreeInSign: 10, pada: 1, retrograde: false, combust: false, speed: 1 });
const chart = {
  input,
  ascendant: { sign: 5, nakshatra: 10, longitude: 125, degreeInSign: 5, pada: 2 },
  planets: [at('sun', 4, 8), at('moon', 2, 4), at('mars', 1, 1), at('mercury', 5, 10), at('jupiter', 4, 8), at('venus', 4, 9), at('saturn', 9, 19), at('rahu', 10, 22), at('ketu', 4, 9)],
  vargas: {},
} as unknown as Chart;
const phrase = (id: string, keys: string[], text = `Text ${id}`, updatedAt = '2026-01-01T00:00:00.000Z'): Phrase => ({ id, title: id, text, keys, updatedAt });

describe('placement keys', () => {
  it('lists the chart in its own words', () => {
    const labels = chartPlacements(chart).map((p) => p.label);
    expect(labels).toContain('Moon in Rohini');
    expect(labels).toContain('Moon in Taurus');
    expect(labels).toContain('Moon in the 10th house');
    expect(labels).toContain('Leo rising');
    expect(labels).toContain('7th house in Aquarius');
    expect(labels).toContain('Lord of the 7th in the 5th'); // Saturn in Sagittarius
  });
  it('maps a book note or a reading topic to the placements under it', () => {
    expect(topicKeys(chart, 'graha:moon')).toEqual(['p:moon:sign:2', 'p:moon:nak:4', 'p:moon:house:10']);
    expect(topicKeys(chart, 'house:12')).toEqual(expect.arrayContaining(['house:12:sign:4', 'p:venus:house:12', 'p:sun:house:12']));
    expect(topicKeys(chart, 'yogas', { yogas: [{ id: 'gaja-kesari', name: 'Gaja Kesari Yoga' }], doshas: [] })).toEqual(['yoga:gaja-kesari']);
    expect(bookTopic('chapter:moon')).toBe('graha:moon');
    expect(bookTopic('year:2027')).toBeNull();
  });
  it('knows which keys are real', () => {
    expect(isPlacementKey('p:moon:nak:4')).toBe(true);
    expect(isPlacementKey('p:moon:nak:28')).toBe(false);
    expect(isPlacementKey('p:pluto:sign:1')).toBe(false);
    expect(labelFor('lord:10:house:1')).toBe('Lord of the 10th in the 1st');
    expect(labelFor('p:jupiter:house:11')).toBe('Jupiter in the 11th house');
  });
});

describe('saved phrases', () => {
  const lib = [phrase('rohini', ['p:moon:nak:4']), phrase('both', ['p:moon:nak:4', 'p:moon:sign:2']), phrase('mars', ['p:mars:sign:10'])];
  it('suggests the phrases for a placement, best match first', () => {
    expect(phrasesFor(lib, topicKeys(chart, 'graha:moon')).map((p) => p.id)).toEqual(['both', 'rohini']);
    expect(phrasesForTopics(lib, chart, ['graha:mars'])).toEqual([]);
  });
  it('adds a phrase once, as its own paragraph', () => {
    expect(withPhrase('', 'A')).toBe('A');
    expect(withPhrase('Mine.', 'A')).toBe('Mine.\n\nA');
    expect(withPhrase('Mine.\n\nA', 'A')).toBe('Mine.\n\nA');
  });
  it('drops malformed phrases and unknown keys', () => {
    expect(normalisePhrase({ text: '  ' })).toBeNull();
    expect(normalisePhrase({ id: 'x', text: 'Hi', keys: ['p:moon:nak:4', 'nonsense', 4] })?.keys).toEqual(['p:moon:nak:4']);
  });
});

describe('reading templates', () => {
  it('starts a reading with the matching phrases in each section', () => {
    const t = { ...STARTER_TEMPLATES[0], sections: [{ id: 'm', heading: 'Mind', guide: '', topics: ['graha:moon'] }, { id: 'n', heading: 'Now', guide: '', topics: [] }] };
    const r = readingFromTemplate(t, { chart, phrases: [phrase('rohini', ['p:moon:nak:4'], 'Tender gardener.')], fill: true });
    expect(r.sections.map((s) => s.text)).toEqual(['Tender gardener.', '']);
    expect(readingFromTemplate(t).sections[0].text).toBe('');
  });
  it('rejects templates and readings with nothing in them', () => {
    expect(normaliseTemplate({ name: 'Empty', sections: [] })).toBeNull();
    expect(normaliseTemplate({ name: 'Ok', sections: [{ heading: 'One' }, { heading: '' }] })?.sections).toHaveLength(1);
    expect(normaliseReading({ sections: [{ heading: 'A', text: 'x' }] })?.title).toBe('Your reading');
  });
  it('keeps one reading per birth', () => {
    expect(readingKey(input)).toMatch(/^vedic\.reading\./);
    expect(readingKey({ ...input, time: '06:31' })).not.toBe(readingKey(input));
  });
});

describe('library export and import', () => {
  const here = { phrases: [phrase('a', ['p:moon:nak:4'], 'Old')], templates: [STARTER_TEMPLATES[1]] };
  it('adds new items, keeps the newer edit and changes nothing on a second run', () => {
    const file = JSON.stringify({
      kind: 'jyotisha-practice-library', version: 1,
      phrases: [phrase('a', ['p:moon:nak:4'], 'New', '2026-06-01T00:00:00.000Z'), phrase('b', ['p:sun:sign:5'])],
      templates: [STARTER_TEMPLATES[2]],
    });
    const r = mergeLibrary(here, file);
    expect(r.added).toBe(2);
    expect(r.updated).toBe(1);
    expect(r.phrases.find((p) => p.id === 'a')?.text).toBe('New');
    expect(r.templates.map((t) => t.id)).toEqual(['starter-career', 'starter-marriage']);
    const again = mergeLibrary(r, file);
    expect(again.added + again.updated).toBe(0);
  });
  it('accepts a bare list and refuses other files', () => {
    expect(mergeLibrary(here, JSON.stringify([phrase('c', ['p:sun:sign:5'])])).added).toBe(1);
    expect(() => mergeLibrary(here, JSON.stringify({ workspace: {} }))).toThrow();
    expect(() => mergeLibrary(here, 'not json')).toThrow();
  });
});
