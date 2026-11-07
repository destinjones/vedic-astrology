/**
 * Chart story: a linear narrative assembled from the findings, for people who
 * will not click forty planets. Every chapter is built from readings the
 * interpretations package already wrote; this module only chooses and orders.
 */
import type { Chart, GrahaId } from '@vedic/engine';
import type { ChartInterpretation, Reading } from '@vedic/interpretations';
import { getNakshatra, getSign } from '@vedic/interpretations';
import { findingsOf } from './severity';
import { ordinal, PLANET_NAMES } from './util';

export interface StoryChapter {
  id: string;
  /** Short kicker above the title, e.g. "Chapter 1". */
  kicker: string;
  title: string;
  paragraphs: string[];
  /** The planet or point this chapter is about, so the UI can highlight it. */
  focus?: GrahaId | 'asc';
  /** Bullet list (gifts, edges). */
  points?: string[];
}

const first = (r: Reading | undefined) => r?.summary ?? '';
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const yearOf = (iso: string) => new Date(iso).getUTCFullYear();

/** The mahadasha and antardasha running at `now`, from the engine's Vimshottari tree. */
function runningDasha(chart: Chart, now: Date) {
  const t = now.getTime();
  const maha = chart.dasha.periods.find((p) => new Date(p.start).getTime() <= t && t < new Date(p.end).getTime());
  const antar = maha?.children?.find((p) => new Date(p.start).getTime() <= t && t < new Date(p.end).getTime());
  const nextMaha = chart.dasha.periods.find((p) => new Date(p.start).getTime() > t);
  return { maha, antar, nextMaha };
}

export function chartStory(chart: Chart, report: ChartInterpretation, now: Date = new Date()): StoryChapter[] {
  const lagna = getSign(chart.ascendant.sign);
  const moon = chart.planets.moon;
  const sun = chart.planets.sun;
  const moonSign = getSign(moon.sign);
  const sunSign = getSign(sun.sign);
  const nak = getNakshatra(moon.nakshatra);
  const lagnaLord = lagna.lord as GrahaId;
  const lord = report.planets[lagnaLord];
  const chapters: StoryChapter[] = [];
  let n = 0;
  const kicker = () => `Chapter ${++n}`;

  chapters.push({
    id: 'rising',
    kicker: kicker(),
    title: `You rise as ${lagna.name}`,
    focus: 'asc',
    paragraphs: [
      `At the moment you were born, ${lagna.name} (${lagna.sanskrit}) was rising in the east. It is the lens the rest of the chart is seen through: ${lagna.flavor}.`,
      lagna.description,
      `Its ruler, ${PLANET_NAMES[lagnaLord]}, sits in your ${ordinal(chart.planets[lagnaLord].house)} house. ${first(lord.house)}`,
    ].filter(Boolean),
  });

  chapters.push({
    id: 'mind',
    kicker: kicker(),
    title: `Your mind is a ${moonSign.name} Moon in ${nak.name}`,
    focus: 'moon',
    paragraphs: [
      `In Jyotish the Moon is the mind, and the most personal point in the chart. Yours is in ${moonSign.name}: ${moonSign.flavor}.`,
      first(report.planets.moon.sign),
      `Your birth star is ${nak.name}, ruled by ${PLANET_NAMES[nak.lord]}, with ${nak.deity} as its deity and ${lower(nak.symbol)} as its symbol. ${nak.description}`,
    ].filter(Boolean),
    points: nak.gifts.slice(0, 3),
  });

  chapters.push({
    id: 'purpose',
    kicker: kicker(),
    title: `Your purpose burns in ${sunSign.name}`,
    focus: 'sun',
    paragraphs: [first(report.planets.sun.sign), first(report.planets.sun.house)].filter(Boolean),
  });

  const findings = findingsOf(report);
  const gifts = findings.filter((f) => f.kind === 'yoga' && !f.difficult).slice(0, 3);
  if (gifts.length) {
    chapters.push({
      id: 'gifts',
      kicker: kicker(),
      title: gifts.length === 1 ? 'One combination stands out' : `${gifts.length} combinations stand out`,
      paragraphs: [
        `Out of ${report.yogas.length} yoga${report.yogas.length === 1 ? '' : 's'} found in your chart, these carry the most weight.`,
        ...gifts.map((g) => `${g.name}. ${g.source.reading.summary}`),
      ],
    });
  }

  const strongest = [...report.highlights.strengths].slice(0, 2);
  const edges = [...report.highlights.challenges].slice(0, 2);
  if (strongest.length || edges.length) {
    chapters.push({
      id: 'light-shade',
      kicker: kicker(),
      title: 'Where it flows, and where it asks for work',
      paragraphs: [
        ...strongest.map((r) => `${r.title}. ${r.summary}`),
        ...edges.map((r) => `${r.title}. ${r.summary}`),
      ],
    });
  }

  const { maha, antar, nextMaha } = runningDasha(chart, now);
  if (maha) {
    const m = PLANET_NAMES[maha.lord];
    const a = antar ? PLANET_NAMES[antar.lord] : null;
    const mr = report.planets[maha.lord];
    chapters.push({
      id: 'now',
      kicker: kicker(),
      title: `Right now: the ${m} years`,
      focus: maha.lord,
      paragraphs: [
        `Since ${yearOf(maha.start)} your life has run on ${m}'s dasha, until ${yearOf(maha.end)}.${a ? ` Inside it, ${a} sets the tone until ${new Date(antar!.end).toISOString().slice(0, 7)}.` : ''}`,
        first(mr.house),
        nextMaha ? `After that comes ${PLANET_NAMES[nextMaha.lord]}, from ${yearOf(nextMaha.start)}.` : '',
      ].filter(Boolean),
    });
  }

  // a reading can serve more than one chapter (the Sun may also rule the lagna); tell it once
  const seen = new Set<string>();
  for (const c of chapters) {
    c.paragraphs = c.paragraphs.filter((para) => {
      const key = para.replace(/^.*?\.\s/, '').trim();
      const dup = seen.has(para) || [...seen].some((x) => x.endsWith(key) && key.length > 30);
      seen.add(para);
      return !dup;
    });
  }

  const told = chapters.filter((c) => c.paragraphs.length);
  told.forEach((c, i) => { c.kicker = `Chapter ${i + 1}`; });

  told.push({
    id: 'end',
    kicker: 'Epilogue',
    title: 'The chart is a map, not a verdict',
    paragraphs: [
      'Everything above was put together from the same readings you can open one by one in the explorer. Click any planet to read it in full, or open the timeline to see your good and hard years.',
      'Astrology is a traditional practice, not a science. Read this for reflection, not as a forecast.',
    ],
  });
  return told;
}
