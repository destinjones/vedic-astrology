/**
 * Annotated case studies on charts from the famous charts library.
 *
 * Each study walks through what the rules engine finds in a real chart, what the
 * classical texts say about it, where a practitioner would push back, and how the
 * Vimshottari periods line up with well-documented public events.
 *
 * Every yoga, dosha and dasha named here is checked by
 * packages/interpretations/test/caseStudies.test.ts against the engine's own
 * output, so if a detector or the dasha maths changes, the test says which
 * annotation no longer holds. Event dates are public record. Verse references
 * use the editions listed in packages/interpretations/src/sources.ts.
 */

export interface CaseNote {
  /** A yoga or dosha id the engine must detect in this chart. */
  kind: 'yoga' | 'dosha';
  id: string;
  /** For rules that can fire more than once, the planets that must be involved. */
  planets?: string[];
  title: string;
  note: string;
}

export interface CaseEvent {
  /** Public date, YYYY-MM-DD. */
  date: string;
  event: string;
  /** Mahadasha and antardasha lords running on that date, as this app computes them. */
  md: string;
  ad: string;
  note: string;
}

export interface CaseStudy {
  /** Famous chart id (see famousCharts.ts). */
  id: string;
  title: string;
  /** Two or three sentences: why this chart teaches something. */
  lead: string;
  notes: CaseNote[];
  events: CaseEvent[];
  /** What to take away, and what this chart cannot show. */
  takeaways: string[];
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: 'indira-gandhi',
    title: 'Indira Gandhi: two exchanges and a Saturn mahadasha',
    lead:
      'A Cancer ascendant at 27° holds Saturn, while the Moon, the ascendant lord, sits in Saturn’s Capricorn. The chart is built on sign exchanges. Her first term began in Jupiter’s mahadasha, and the Emergency, her defeat, her return and her death all fall inside Saturn’s.',
    notes: [
      {
        kind: 'yoga', id: 'maha-parivartana', planets: ['moon', 'saturn'],
        title: 'Moon and Saturn exchange signs (1st and 7th)',
        note: 'The ascendant lord and the 7th lord swap signs, which ties the self to the public and to opponents. Phaladeepika 6.32 counts a 1st–7th exchange as Maha parivartana, the auspicious class. For a Cancer ascendant, Saturn rules both the 7th and the 8th. That makes it a maraka, a killer planet (BPHS ch. 44), so a practitioner reads this exchange as power that comes with danger.',
      },
      {
        kind: 'yoga', id: 'maha-parivartana', planets: ['sun', 'mars'],
        title: 'Sun and Mars exchange signs (2nd and 5th)',
        note: 'Mars, the yogakaraka for Cancer because it rules the 5th and 10th, exchanges with the Sun, lord of the 2nd. This is the 2nd–5th wealth link the engine also lists as a Dhana yoga. It puts the career planet in the house of speech and family.',
      },
      {
        kind: 'yoga', id: 'yogakaraka',
        title: 'Mars as yogakaraka',
        note: 'BPHS ch. 34 names Mars as the planet that confers a full yoga for a Cancer ascendant. Here Mars sits in Leo in the 2nd, so its results come through the exchange above rather than through a kendra.',
      },
      {
        kind: 'dosha', id: 'gandanta',
        title: 'Ascendant at the Ashlesha–Magha junction',
        note: 'The ascendant falls in the last pada of Ashlesha, just before the water–fire boundary. BPHS treats Gandanta birth in its remedial chapters (92–94). Sources give different widths for the junction, so read this as a flag to check by degree, not as a verdict.',
      },
    ],
    events: [
      { date: '1966-01-24', event: 'Sworn in as Prime Minister', md: 'jupiter', ad: 'sun', note: 'Jupiter rules the 9th, and the Sun is lord of the 2nd in the Sun–Mars exchange.' },
      { date: '1975-06-25', event: 'Declares the Emergency', md: 'saturn', ad: 'mercury', note: 'Saturn, the 7th and 8th lord, in its own exchange with the ascendant lord. Mercury rules the 12th and 3rd and is combust in the 5th.' },
      { date: '1977-03-21', event: 'Loses the general election', md: 'saturn', ad: 'ketu', note: 'Ketu sits in the 12th house of loss.' },
      { date: '1980-01-14', event: 'Returns as Prime Minister', md: 'saturn', ad: 'venus', note: 'Venus rules the 4th and 11th. A kendra lord with the house of gains brings back what was lost.' },
      { date: '1984-10-31', event: 'Assassinated', md: 'saturn', ad: 'rahu', note: 'A maraka mahadasha with a Rahu antardasha. Rahu sits in the 6th, the house of enemies.' },
    ],
    takeaways: [
      'Five major turns of a career fall inside two mahadashas. The antardasha lords carry the story more clearly than the yogas do.',
      'The Moon–Saturn exchange is listed as a “strong” Maha parivartana, but the same Saturn is a maraka. A yoga’s strength label does not say whether its results are pleasant.',
      'Her Rodden rating is A, a time given by the family. Gandanta at the ascendant is sensitive to a few minutes either way.',
    ],
  },
  {
    id: 'rajiv-gandhi',
    title: 'Rajiv Gandhi: five planets in Leo, and a Pravrajya yoga that did not make an ascetic',
    lead:
      'Five planets share the Leo ascendant, so the engine reports a strong Pravrajya (renunciation) yoga. He became Prime Minister instead. This chart shows why a yoga found by counting has to be weighed against the other yogas the same planets form.',
    notes: [
      {
        kind: 'yoga', id: 'pravrajya',
        title: 'Pravrajya: Sun, Moon, Mercury, Jupiter and Venus in Leo',
        note: 'Phaladeepika 27.2 forms this yoga from four or more planets in one house, with the kind of renunciation set by the strongest of them. Here the best-dignified of them is the Sun, in its moolatrikona and lord of the ascendant: a royal planet. Phaladeepika 27.7 adds that when a raja yoga accompanies the ascetic yoga of 27.6, the person becomes a ruler. Read with that in mind, the cluster says rule more than renunciation.',
      },
      {
        kind: 'yoga', id: 'raja', planets: ['sun', 'venus'],
        title: 'Raja yoga: Sun (1st lord) with Venus (10th lord)',
        note: 'BPHS 39.28 forms a raja yoga whenever a kendra lord and a trikona lord join, and the ascendant counts as both a kendra and a trikona. The engine rates this one strong because the Sun is in its moolatrikona.',
      },
      {
        kind: 'yoga', id: 'gaja-kesari',
        title: 'Gaja Kesari, but weak',
        note: 'The engine’s rule, from Phaladeepika 6.14, only needs Jupiter in a kendra from the Moon. Here they are conjunct. BPHS 36.3–4 also rules out a combust Jupiter, and Jupiter is combust here, so under BPHS this yoga does not form at all. The engine marks it weak.',
      },
      {
        kind: 'dosha', id: 'kaal-sarp',
        title: 'Partial Kaal Sarp',
        note: 'Every planet except Saturn lies on one side of the Rahu–Ketu axis. Kaal Sarp is not in BPHS, Phaladeepika or Saravali, and Saturn breaks the pattern, so the engine rates it low.',
      },
    ],
    events: [
      { date: '1984-10-31', event: 'Sworn in as Prime Minister after his mother’s assassination', md: 'rahu', ad: 'rahu', note: 'Rahu in the 12th: power arriving through loss.' },
      { date: '1989-12-02', event: 'Leaves office after losing the general election', md: 'rahu', ad: 'saturn', note: 'Saturn rules the 6th and 7th, the houses of rivals and opponents.' },
      { date: '1991-05-21', event: 'Assassinated', md: 'rahu', ad: 'mercury', note: 'Mercury rules the 2nd, a maraka house, and the 11th.' },
    ],
    takeaways: [
      'A yoga’s strength label measures how cleanly it forms, not what kind of life it describes. The same five planets form Pravrajya, three raja yogas and two dhana yogas at once.',
      'BPHS and Phaladeepika give different Gaja Kesari rules, and the difference decides whether this chart has one. The source note on the yoga card says which rule the app uses.',
      'Birth certificate, Rodden AA. The library reads the time as Indian Standard Time (UTC+5:30), which gives the Leo ascendant his chart is known for.',
    ],
  },
  {
    id: 'john-f-kennedy',
    title: 'John F. Kennedy: Sarala yoga and the limits of a longevity promise',
    lead:
      'Mars in its own sign in the 8th forms Sarala yoga, which Phaladeepika says gives a long life. He died at 46. That gap makes this a useful chart for showing how a single yoga gets overruled.',
    notes: [
      {
        kind: 'yoga', id: 'sarala',
        title: 'Sarala: Mars, the 8th lord, in the 8th',
        note: 'Phaladeepika 6.65 promises long life, fearlessness and victory over foes. The second and third promises fit his war record and career. The first did not hold. Mercury, the ascendant lord, also sits in the 8th with Mars and is in an enemy’s sign. Classical longevity is judged from many factors (BPHS ch. 43), never from one yoga.',
      },
      {
        kind: 'yoga', id: 'gaja-kesari',
        title: 'Gaja Kesari only under Phaladeepika’s rule',
        note: 'Jupiter is 10th from the Moon, so the engine’s rule, from Phaladeepika 6.14, is met. Jupiter sits in Venus’s Taurus, a sign BPHS 36.3–4 would count as inimical, and under that stricter rule the yoga fails.',
      },
      {
        kind: 'yoga', id: 'raja', planets: ['jupiter', 'venus'],
        title: 'Raja yoga in the 9th: Jupiter (4th lord) with Venus (9th lord)',
        note: 'A kendra lord and a trikona lord together in the trikona of fortune (BPHS 39.28). Venus is in its own sign but combust.',
      },
    ],
    events: [
      { date: '1943-08-02', event: 'PT-109 is sunk; he leads the survivors to safety', md: 'mars', ad: 'moon', note: 'In the Mars mahadasha: the 8th-lord Sarala yoga at work, danger survived.' },
      { date: '1960-11-08', event: 'Elected President', md: 'rahu', ad: 'mars', note: 'Rahu is in the 4th. Mars is the planet of the Sarala yoga.' },
      { date: '1963-11-22', event: 'Assassinated', md: 'jupiter', ad: 'saturn', note: 'Five weeks into Saturn’s antardasha. For a Virgo ascendant, Jupiter rules the 7th, a maraka house, and Saturn rules the 6th.' },
    ],
    takeaways: [
      'Read the strongest promise of a yoga against everything else that bears on the same matter. For longevity that is the 8th house, its lord, the ascendant lord and the maraka periods.',
      'Two of his yogas depend on which text you follow. The disagreement notes on the yoga card show which rule the app uses.',
      'Rodden A: the time is given by the family and not confirmed by a birth record.',
    ],
  },
  {
    id: 'martin-luther-king-jr',
    title: 'Martin Luther King Jr.: four modern doshas, and what the classical texts actually say',
    lead:
      'The engine flags four doshas here: Manglik, partial Kaal Sarp, Pitra and Angarak. None of them is defined as the engine applies it in BPHS, Phaladeepika or Saravali. This chart shows why the citations matter. A reading built on these doshas would rest on modern rules.',
    notes: [
      {
        kind: 'dosha', id: 'manglik',
        title: 'Manglik: Mars in the 2nd',
        note: 'The 2nd house is on the engine’s list, but many traditions leave it out. Under a 1-4-7-8-12 list this chart would not be Manglik from the ascendant at all.',
      },
      {
        kind: 'dosha', id: 'kaal-sarp',
        title: 'Partial Kaal Sarp',
        note: 'Mars, conjunct Rahu, breaks the pattern. The rule is a modern one, and the engine rates it low.',
      },
      {
        kind: 'dosha', id: 'pitra',
        title: 'Pitra: Saturn in the 9th',
        note: 'BPHS ch. 83 does describe a curse from the father, but as a cause of childlessness read through the 5th house. He had four children. The engine’s broader 9th-house rule is a modern generalisation.',
      },
      {
        kind: 'yoga', id: 'budha-aditya',
        title: 'Sun and Mercury in the 10th',
        note: 'A visible career built on speech. The name Budha-Aditya is later usage, but the placement is classical enough: the Sun has its directional strength in the 10th.',
      },
    ],
    events: [
      { date: '1955-12-05', event: 'The Montgomery bus boycott begins', md: 'saturn', ad: 'jupiter', note: 'Seventeen days before the Saturn mahadasha gives way to Mercury’s. Practitioners call the junction between two mahadashas dasha sandhi and treat it as a time of upheaval.' },
      { date: '1963-08-28', event: '“I Have a Dream” speech', md: 'mercury', ad: 'moon', note: 'A Mercury mahadasha, the planet of speech, in the 10th.' },
      { date: '1964-10-14', event: 'Nobel Peace Prize announced', md: 'mercury', ad: 'mars', note: 'Mars rules the ascendant (and the 8th).' },
      { date: '1968-04-04', event: 'Assassinated', md: 'mercury', ad: 'jupiter', note: 'Jupiter rules the 9th and 12th and sits in the ascendant.' },
    ],
    takeaways: [
      'Read a dosha’s source note before treating it as a verdict. Four flags with no classical basis say less about this chart than one well-placed planet.',
      'The boycott falling at a dasha sandhi is a good example of a junction window, which the app does not yet flag.',
      'The library records his time as Rodden A. A noon time is worth treating with care, because round times are sometimes estimates.',
    ],
  },
];

export const caseStudyFor = (famousId: string | undefined | null): CaseStudy | undefined =>
  famousId ? CASE_STUDIES.find((c) => c.id === famousId) : undefined;
