/**
 * Classical sources for every rule the interpretation library applies.
 *
 * Each yoga, dosha and reading family carries one nullable `source` field.
 * `null` means nobody has checked a classical source for it yet. An object with
 * `citations: []` and a `nonClassical` note means the rule is a later or modern
 * convention that we could not find in the texts below.
 *
 * Ground rules for editing this file:
 *  - Cite only what you have read in the edition named in EDITIONS. Verse numbers
 *    differ between editions, so a number from another translation is not a
 *    correction; add a note instead.
 *  - When only the chapter is certain, set `verse: null`. Never estimate a verse.
 *  - Use `disagreement` when the texts disagree with each other, or when our rule
 *    simplifies what a text says, so a practitioner can see the choice we made.
 *
 * Every citation here was checked against these public translations:
 *  - BPHS: the English text that follows R. Santhanam's chapter and verse
 *    numbering (97 chapters, Ranjan Publications, 1984).
 *  - Phaladeepika: V. Subrahmanya Sastri's translation, 2nd ed. 1950, as
 *    published by wisdomlib.org.
 *  - Saravali: R. Santhanam's translation (chapter titles and opening verses).
 *  - Brihat Jataka: chapter-level only.
 */

export type ClassicalText = 'BPHS' | 'Phaladeepika' | 'Saravali' | 'Brihat Jataka';

export interface Citation {
  text: ClassicalText;
  chapter: number;
  /** A verse or range such as '7-10', or null when only the chapter is certain. */
  verse: string | null;
  /** What the cited passage says, in a few words, when it is narrower or wider than our rule. */
  note?: string;
  /** A public copy of the chapter (or the book), filled in from EDITIONS. */
  url?: string;
}

export interface RuleSource {
  citations: Citation[];
  /** Where the texts disagree with each other, or with how this app reads them. */
  disagreement?: string;
  /** Set when the rule is a later convention with no citation we could verify. */
  nonClassical?: string;
}

export interface Edition {
  /** Short form used in a superscript, e.g. "BPHS". */
  abbr: string;
  title: string;
  author: string;
  edition: string;
  /** A free, public copy of that edition, if one exists. */
  url?: string;
  /** Per-chapter links where the copy is split by chapter. */
  chapterUrls?: Partial<Record<number, string>>;
}

const WL_PD = 'https://www.wisdomlib.org/hinduism/book/phaladeepika-by-mantreswara-text-and-translation';

export const EDITIONS: Record<ClassicalText, Edition> = {
  BPHS: {
    abbr: 'BPHS',
    title: 'Brihat Parashara Hora Shastra',
    author: 'attributed to Parashara',
    edition: 'tr. R. Santhanam, Ranjan Publications (1984); chapter and verse numbers follow this edition',
    url: 'https://archive.org/details/BPHSEnglish',
  },
  Phaladeepika: {
    abbr: 'Phaladeepika',
    title: 'Phaladeepika',
    author: 'Mantreswara',
    edition: 'tr. V. Subrahmanya Sastri, 2nd ed. (1950)',
    url: WL_PD,
    chapterUrls: {
      6: `${WL_PD}/d/doc1621578.html`,
      7: `${WL_PD}/d/doc1621579.html`,
      8: `${WL_PD}/d/doc1621580.html`,
      27: `${WL_PD}/d/doc1621599.html`,
    },
  },
  Saravali: {
    abbr: 'Saravali',
    title: 'Saravali',
    author: 'Kalyana Varma',
    edition: 'tr. R. Santhanam, Ranjan Publications',
  },
  'Brihat Jataka': {
    abbr: 'Brihat Jataka',
    title: 'Brihat Jataka',
    author: 'Varahamihira',
    edition: 'chapter numbers as in the common 28-chapter recension',
  },
};


/** "BPHS 37.7–10", "Phaladeepika 6", "Saravali 13.2". */
export function formatCitation(x: Citation): string {
  const v = x.verse ? `.${x.verse.replace('-', '–')}` : '';
  return `${EDITIONS[x.text].abbr} ${x.chapter}${v}`;
}

/** The best public link for a citation: the chapter page where there is one, else the book. */
export function citationUrl(x: Citation): string | undefined {
  const e = EDITIONS[x.text];
  return e.chapterUrls?.[x.chapter] ?? e.url;
}

/** "BPHS 37.7–10; Phaladeepika 6.5". Empty when there is nothing to cite. */
export function formatSource(s: RuleSource | null | undefined): string {
  return s ? s.citations.map(formatCitation).join('; ') : '';
}

const c = (text: ClassicalText, chapter: number, verse: string | null = null, note?: string): Citation => {
  const x: Citation = { text, chapter, verse };
  if (note) x.note = note;
  const url = citationUrl(x);
  if (url) x.url = url;
  return x;
};

// ------------------------------------------------------------------ shared notes

const SANKHYA: RuleSource = {
  citations: [
    c('BPHS', 35, '16-17'),
    c('Phaladeepika', 6, '39'),
    c('Saravali', 21),
    c('Brihat Jataka', 12),
  ],
  disagreement:
    'BPHS 35.17 and Phaladeepika 6.39 both say a Sankhya yoga counts only when no other Nabhasa yoga (Asraya, Dala or Akriti) is present. This app does not yet detect those other 25 Nabhasa patterns, so it cannot apply that exclusion and will report a Sankhya yoga that a practitioner might set aside. BPHS 35.50 adds that Nabhasa results are felt through every dasha, not only in the periods of the planets involved.',
};

const MAHAPURUSHA: RuleSource = {
  citations: [c('BPHS', 75, '1-2'), c('Phaladeepika', 6, '1'), c('Saravali', 37)],
  disagreement:
    'BPHS 75.1–2 counts the kendra from the ascendant only. Phaladeepika 6.4 says the same five yogas also arise when the kendra is counted from the Moon. This app follows BPHS and counts from the ascendant.',
};

const LUNAR_2_12: RuleSource = {
  citations: [c('BPHS', 37, '7-10'), c('Phaladeepika', 6, '5'), c('Saravali', 13, '1')],
  disagreement:
    'All three texts exclude the Sun. BPHS 37.7 does not mention Rahu and Ketu; this app leaves the nodes out, as is the common practice. R. Santhanam’s notes to Saravali 13 add that a debilitated or enemy-sign planet weakens the yoga.',
};

const SOLAR_2_12: RuleSource = {
  citations: [c('BPHS', 38, '1-3'), c('Phaladeepika', 6, '8'), c('Saravali', 14, '1')],
  disagreement:
    'Phaladeepika 6.8 splits each of these into a benefic form (Subha-vesi and so on) and a malefic form (Papa-vesi), and BPHS 38.4 says malefics give the contrary effects. This app reports one yoga either way, so read its tone against which planets form it.',
};

const VIPARITA: (verse: string) => RuleSource = (verse) => ({
  citations: [c('Phaladeepika', 6, '57'), c('Phaladeepika', 6, verse, 'effects')],
  disagreement:
    'These names come from Phaladeepika 6.57, which builds twelve yogas from each house lord falling in the 6th, 8th or 12th; Harsha, Sarala and Vimala are the three of those twelve that turn out well. A translator’s note to that chapter says the yogas are not found in Brihat Jataka, Saravali or Jataka Parijata. Phaladeepika 6.57 also lets a malefic joining or aspecting the house form the yoga, which this app does not use.',
});

const PARIVARTANA = (verse: string): RuleSource => ({
  citations: [c('Phaladeepika', 6, '32', 'definition and the 28/8/30 split'), c('Phaladeepika', 6, verse, 'effects')],
  disagreement:
    'Phaladeepika 6.32 counts 66 possible exchanges: 30 involving the 6th, 8th or 12th lord (Dainya), 8 involving the 3rd lord (Khala) and 28 others (Maha). BPHS does not name these three classes; it treats exchanges as one of the relationships that can form a raja yoga.',
});

const KEMADRUMA: RuleSource = {
  citations: [c('BPHS', 37, '11-13'), c('Phaladeepika', 6, '5'), c('Saravali', 13, '2')],
  disagreement:
    'The texts cancel Kemadruma differently. BPHS 37.11–13 forms it only when no planet is with the Moon, in the 2nd or 12th from it, or in a kendra from the ascendant. Phaladeepika 6.5 reports a view that a planet in a kendra from the Moon also cancels it. Saravali 13.2 forms it when the Moon’s kendras are empty or the Moon is unaspected. This app uses the broadest cancellation (any planet in a kendra from the ascendant or the Moon), so it reports Kemadruma less often than BPHS alone would. BPHS 33.94–99 also gives a separate Jaimini-style Kemadruma from the Karakamsa and Arudha lagna, which is not checked here.',
};

// ------------------------------------------------------------------ yogas

export const YOGA_SOURCES: Record<string, RuleSource | null> = {
  ruchaka: MAHAPURUSHA,
  bhadra: MAHAPURUSHA,
  hamsa: MAHAPURUSHA,
  malavya: MAHAPURUSHA,
  sasa: MAHAPURUSHA,
  'gaja-kesari': {
    citations: [c('BPHS', 36, '3-4'), c('Phaladeepika', 6, '14', 'named Kesari'), c('Phaladeepika', 6, '16', 'effects')],
    disagreement:
      'Phaladeepika 6.14 needs only the Moon in a kendra from Jupiter, which is the rule used here. BPHS 36.3–4 is stricter: Jupiter in a kendra from the ascendant or the Moon, joined or aspected by a benefic, and not debilitated, combust or in an enemy’s sign. Under BPHS many charts this app flags would not qualify.',
  },
  'budha-aditya': {
    citations: [],
    nonClassical:
      'We have not yet found Budha-Aditya named as a yoga in BPHS, Phaladeepika or Saravali. Saravali ch. 15 describes the Sun–Mercury conjunction among its two-planet conjunctions, but not under this name. Treat the name as later usage.',
  },
  'chandra-mangala': {
    citations: [],
    nonClassical:
      'We have not yet found Chandra-Mangala named as a yoga in BPHS, Phaladeepika or Saravali. Saravali ch. 15 covers the Moon–Mars conjunction among two-planet conjunctions.',
  },
  raja: {
    citations: [c('BPHS', 39, '28'), c('BPHS', 34, '15', 'no raja yoga when the lord also owns a dusthana'), c('Phaladeepika', 6, '37', 'named Sankha'), c('Saravali', 35)],
    disagreement:
      'BPHS 39.28 forms a raja yoga whenever a kendra lord and a trikona lord are related. BPHS 34.15 qualifies this: a kendra or trikona lord that also owns an evil house (6, 8, 12) does not give a raja yoga through that relationship alone; this app only lowers such a yoga from strong to moderate instead of dropping it. Phaladeepika 6.37 calls the kendra–trikona conjunction Sankha yoga, needs it to fall in a good house, and keeps the name Raja yoga for the 9th and 10th lords together.',
  },
  yogakaraka: {
    citations: [c('BPHS', 34), c('BPHS', 34, '17', 'Rahu and Ketu can also become yogakaraka')],
    disagreement:
      'BPHS 34 lists the yogakaraka planet ascendant by ascendant (for example Mars for Cancer and Leo). BPHS 34.17 adds that Rahu or Ketu in a kendra and joined or aspected by a kendra or trikona lord becomes yogakaraka; this app checks only the seven visible planets.',
  },
  'dharma-karmadhipati': {
    citations: [c('Phaladeepika', 6, '37'), c('Phaladeepika', 6, '38', 'effects'), c('Phaladeepika', 7, null, 'the 9th and 10th lords exchanging signs')],
    disagreement:
      'Phaladeepika 6.37 asks for the 9th and 10th lords conjoined in a good house; ch. 7 adds the exchange. This app also accepts a mutual aspect, and does not check which house the pair falls in.',
  },
  dhana: {
    citations: [c('BPHS', 41)],
    disagreement:
      'BPHS 41 gives specific wealth combinations (for example Venus in its own sign in the 5th with Mars in the 11th, 41.2) rather than one general rule. The rule used here, wealth-house lords related to each other, is a common modern summary of that chapter, and it is looser than any single verse.',
  },
  lakshmi: {
    citations: [c('BPHS', 36, '27-28'), c('Phaladeepika', 6, '21'), c('Phaladeepika', 6, '24', 'effects')],
    disagreement:
      'BPHS 36.27–28: the 9th lord in a kendra in its moolatrikona, own or exaltation sign, with a strong ascendant lord. Phaladeepika 6.21: the 9th lord and Venus both in own or exaltation signs in a kendra or trikona, with no condition on the ascendant lord. This app blends the two: it takes Phaladeepika’s kendra-or-trikona, asks for a strong 9th lord and a well-placed ascendant lord after BPHS, and does not require Venus.',
  },
  harsha: VIPARITA('63'),
  sarala: VIPARITA('65'),
  vimala: VIPARITA('69'),
  'neecha-bhanga': {
    citations: [c('Phaladeepika', 7, '26-30')],
    disagreement:
      'Phaladeepika 7.26–30 gives several cancellations: the lord of the debilitation sign or of the exaltation sign in a kendra from the ascendant or Moon (7.26, 7.29), those two lords in mutual kendras (7.27), and the debilitated planet aspected by its sign lord (7.28). A note to 7.26 records a second reading in which the “exaltation lord” means the planet that is exalted in that sign. This app also counts the planet exalted in the debilitation sign (that second reading), the debilitated planet itself in a kendra, an exchange with its sign lord and retrogression; those last three come from later practice, not from these verses.',
  },
  'maha-parivartana': PARIVARTANA('34'),
  'khala-parivartana': PARIVARTANA('33'),
  'dainya-parivartana': PARIVARTANA('33'),
  sunapha: LUNAR_2_12,
  anapha: LUNAR_2_12,
  durudhara: LUNAR_2_12,
  kemadruma: KEMADRUMA,
  vesi: SOLAR_2_12,
  vasi: SOLAR_2_12,
  ubhayachari: SOLAR_2_12,
  adhi: {
    citations: [c('BPHS', 37, '5'), c('Phaladeepika', 6, '42'), c('Phaladeepika', 6, '43', 'effects')],
    disagreement:
      'BPHS 37.5 counts the 6th, 7th and 8th from the Moon only. Phaladeepika 6.42 allows the same pattern from the ascendant. This app counts from the Moon, as BPHS does.',
  },
  amala: {
    citations: [c('BPHS', 36, '5-6'), c('Phaladeepika', 6, '19'), c('Phaladeepika', 6, '12', 'effects')],
    disagreement:
      'BPHS 36.5–6 asks for a benefic exclusively in the 10th, meaning no malefic shares it. Phaladeepika 6.19 asks only for benefics there. This app does not check for a malefic in the same house.',
  },
  saraswati: {
    citations: [c('Phaladeepika', 6, '26'), c('Phaladeepika', 6, '27', 'effects')],
  },
  vasumati: {
    citations: [c('Phaladeepika', 6, '19', 'named Vasumat'), c('Phaladeepika', 6, '20', 'effects'), c('BPHS', 37, '6', 'benefics in upachayas from the Moon')],
    disagreement:
      'Phaladeepika 6.19 counts the upachayas from the ascendant or the Moon. BPHS 37.6 counts from the Moon and grades the result: all three benefics give great wealth, two give a middling amount, one gives little.',
  },
  'shubha-kartari': {
    citations: [c('BPHS', 36, '1-2'), c('Phaladeepika', 6, '8'), c('Phaladeepika', 6, '11', 'effects')],
    disagreement:
      'BPHS 36.1–2 also forms Subha yoga from a single benefic in the ascendant, which this app does not report under this name.',
  },
  'papa-kartari': {
    citations: [c('BPHS', 36, '1-2'), c('Phaladeepika', 6, '8'), c('Phaladeepika', 6, '11', 'effects')],
    disagreement:
      'BPHS 36.1–2 also forms Asubha yoga from a single malefic in the ascendant, which this app does not report under this name.',
  },
  shakata: {
    citations: [c('Phaladeepika', 6, '14'), c('Phaladeepika', 6, '17', 'effects')],
    disagreement:
      'The rule here, with its cancellation when the Moon is in a kendra from the ascendant, is Phaladeepika 6.14. BPHS uses the same name, Shakata, for a different pattern: one of the Nabhasa (Akriti) yogas of ch. 35, formed by all planets in the 1st and 7th houses.',
  },
  pravrajya: {
    citations: [c('Phaladeepika', 27, '2'), c('BPHS', 79), c('Saravali', 20)],
    disagreement:
      'Phaladeepika 27.2 says the strongest of the four or more planets decides the kind of renunciation, and reports a second opinion that the 10th lord among them decides it.',
  },
  'sankhya-gola': SANKHYA,
  'sankhya-yuga': SANKHYA,
  'sankhya-shoola': SANKHYA,
  'sankhya-kedara': SANKHYA,
  'sankhya-pasha': SANKHYA,
  'sankhya-dama': SANKHYA,
  'sankhya-veena': SANKHYA,
  'guru-chandala': {
    citations: [],
    nonClassical:
      'We have not found Guru-Chandala as a defined yoga in BPHS, Phaladeepika or Saravali. It is widely used in modern practice, and authors disagree on whether Ketu forms it as well as Rahu.',
  },
  angaraka: {
    citations: [],
    nonClassical: 'We have not found Angaraka yoga (Mars with Rahu) as a defined rule in BPHS, Phaladeepika or Saravali. It is a modern name.',
  },
};

// ------------------------------------------------------------------ doshas

export const DOSHA_SOURCES: Record<string, RuleSource | null> = {
  manglik: {
    citations: [],
    nonClassical:
      'We could not verify a Kuja (Manglik) dosha rule in BPHS, Phaladeepika or Saravali; it appears to come from later matching practice.',
    disagreement:
      'House lists differ by tradition: many use the 1st, 4th, 7th, 8th and 12th, and others add the 2nd, as this app does. Counting from the Moon and Venus as well as the ascendant, and the long lists of exceptions, also vary from author to author.',
  },
  'kaal-sarp': {
    citations: [],
    nonClassical:
      'Kaal Sarp dosha is not described in BPHS, Phaladeepika or Saravali. It is generally regarded as a modern addition.',
    disagreement:
      'Do not confuse it with Sarpa yoga, a classical Nabhasa (Akriti) yoga in BPHS ch. 35 that is formed by malefics in three kendras and has nothing to do with the Rahu–Ketu axis.',
  },
  pitra: {
    citations: [c('BPHS', 83, null, 'curses from a previous birth, including the father’s')],
    disagreement:
      'BPHS 83 describes curses from a previous birth, the father’s among them, as causes of childlessness, read mainly through the 5th house and its lord. The rule here (the Sun or the 9th house afflicted by Rahu, Ketu or Saturn) is a modern generalisation of that idea and is not the BPHS rule.',
  },
  grahan: {
    citations: [],
    nonClassical:
      'We have not found Grahan dosha (a luminary with a node in the birth chart) as a rule in BPHS, Phaladeepika or Saravali. BPHS 91 deals with birth during an actual eclipse, which is a different and much rarer condition.',
  },
  'guru-chandala': YOGA_SOURCES['guru-chandala'],
  shrapit: {
    citations: [],
    nonClassical: 'Shrapit dosha (Saturn with Rahu) is a modern rule; we have not found it in BPHS, Phaladeepika or Saravali.',
  },
  angarak: YOGA_SOURCES.angaraka,
  kemadruma: KEMADRUMA,
  gandanta: {
    citations: [c('BPHS', 92), c('BPHS', 93, null, 'Abhukta Mula'), c('BPHS', 94, null, 'Jyeshtha Gandanta')],
    disagreement:
      'BPHS treats Gandanta birth in its remedial chapters (92–94). Sources give different widths for the junction; this app uses a full pada either side of the boundary, which is on the generous end, so a borderline result is worth checking by degree.',
  },
};

// ------------------------------------------------------------------ reading families

export const READING_SOURCES = {
  /** Planet in a house from the ascendant. */
  planetInHouse: { citations: [c('Phaladeepika', 8), c('Saravali', 30)] } as RuleSource,
  /** Lord of one house placed in another (bhavesha phala). */
  houseLord: { citations: [c('BPHS', 24)] } as RuleSource,
  /** Two planets in one sign. */
  conjunction: { citations: [c('Saravali', 15)] } as RuleSource,
  /** Graha drishti, including the special aspects of Mars, Jupiter and Saturn. */
  aspect: { citations: [c('BPHS', 26)] } as RuleSource,
  /** Exaltation, debilitation and moolatrikona. */
  dignity: { citations: [c('BPHS', 3, '49-54')] } as RuleSource,
  /** Retrogression. */
  retrograde: {
    citations: [],
    disagreement:
      'Mantreswara (Phaladeepika) treats a retrograde planet as strong as an exalted one, while Saravali reads retrograde benefics and malefics differently. The text here is a general modern reading; no verse is cited yet.',
  } as RuleSource,
  /** Planet in a sign: not yet sourced. */
  planetInSign: null as RuleSource | null,
  /** Planet in a nakshatra: not yet sourced. */
  nakshatra: null as RuleSource | null,
};
