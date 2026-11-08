# @vedic/consult

Consultation prep for astrologers, built only from the existing engine and rule sets. No AI or language-model service is used: every line comes from a rule you can read in the code, with its classical source where the rule has one.

```ts
import { consultContext, clientSnapshot, talkingPoints, answerQuestion } from '@vedic/consult';

const ctx = consultContext(engine, chart, report);        // one shared "now", dasha tree and ashtakavarga
const snapshot = clientSnapshot(ctx, 'Priya');             // one page before the session
const points = talkingPoints(ctx);                         // career, marriage, money, health, children, home
const answer = answerQuestion(ctx, 'When will I marry?');  // houses, karakas, natal promise, timing windows
```

## Client snapshot

- **Strengths** (up to 5): headline and notable yogas from the severity levels in `@vedic/personal`, then the highest-scoring placement readings.
- **Challenges** (up to 3): doshas by severity, arishta yogas, then the lowest-scoring placements.
- **Dasha**: maha, antar and pratyantar from the engine's Vimshottari tree, scored by `@vedic/timing`, with the houses they bring forward and the strongest scoring rules.
- **Transits**: Saturn, Jupiter, Rahu and Ketu by house from the lagna and Moon, gochara with vedha, bindus, contacts with natal points, and the next sign change.
- **Flags**: Sade Sati (running or within two years), Kantaka and Ashtama Shani, every present dosha, a mahadasha change within a year or a sub-period change within 90 days, slow planets on the natal Moon, Sun or lagna, and Chandrashtama or Naidhana tara today.

## Talking points

Each area points at a life-event kind from `EVENT_SIGNIFICATIONS` (the same houses and karakas the event checker and rectification use) and gives:

- **Promise**: the main house's lord (dignity and placement), occupants, Jupiter, Saturn and Mars aspects, karakas, the house's sarvashtakavarga, and area-specific yogas and doshas.
- **Now**: whether the running mahadasha and antardasha lords are linked to the area, by `lordRelevance`.
- **Next**: the best timing windows ahead. Health, separation, losses and disputes show periods to watch instead.

## Question finder

`matchQuestion` scores the question's words against a fixed keyword list per topic. Words that only set the scene ("my husband and I want a baby") count for half. When nothing matches, the UI asks the astrologer to pick a topic. The finder does not time death, a parent's death or accidents.

`timingWindows` walks every antardasha in range. The antardasha lord must be linked to the topic, and the mahadasha lord too unless the antardasha link is strong. Periods that overlap a Jupiter–Saturn double transit on the main house or its lord (K. N. Rao's rule) are cut to that overlap and marked **strong**; the rest are **supporting**. The best five come back in date order.
