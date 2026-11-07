# @vedic/remedies

Traditional remedies for each graha, chosen by how afflicted it is in a chart, plus the Ishta devata from the Karakamsa. Every remedy carries its source.

```ts
import { remedies, SOURCES } from '@vedic/remedies';

const r = remedies(chart);          // chart from @vedic/engine
r.afflicted;                        // grahas scoring 2 or more, worst first
r.afflicted[0].factors;             // why: debilitation, combustion, malefic aspects …
r.afflicted[0].gem;                 // { advice: 'consider' | 'caution' | 'avoid', reason }
r.afflicted[0].set.mantra;          // bija, Vedic verse, full japa count and the Vimshottari-years alternative
r.ishtaDevata;                      // deity from the 12th from the Karakamsa in the navamsa
r.disclaimers;                      // shown with every use
```

## Rules used

- **Affliction score.** Debilitated 3, bitter enemy's sign 2, enemy's sign 1, combust 2, 6th/8th/12th house 1, malefics in the same sign 1 each (max 2), Saturn or Mars aspect 1 each, papakartari 1, lost graha yuddha 2, Shadbala under the minimum 1; for the Sun and Moon a node in the sign 2, and a Moon within 72° of the Sun 1. Exaltation, moolatrikona or own sign −2; Jupiter's conjunction or aspect −1. Whole-sign houses.
- **Gems follow lordship (BPHS).** Lords of the 1st, 5th and 9th may take their gem. Lords of the 3rd, 6th, 8th or 11th (the Sun and Moon excepted for the 8th) are pacified with mantra and charity, never strengthened. The nodes and the remaining lords get "only with advice".
- **Ishta devata.** The 12th sign from the Karakamsa in the navamsa. The strongest occupant names the deity; if it is empty, its lord does (stronger lord for Scorpio and Aquarius). Deities follow BPHS Karakamsa Phala, with the Vishnu avatar of each graha from BPHS alongside.
- **Yantras.** 3 × 3 magic squares adding to 15 (Sun) up to 39 (Ketu).

## Sources

`SOURCES` lists every work cited, with a chapter or section and a note. Chapters are named, not numbered, because BPHS editions number them differently; Vedic mantras carry their verse. Where a remedy is custom rather than text (the gem pairings, japa counts, fasting days), the source says so.
