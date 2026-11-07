# @vedic/rectification

Birth time rectification for people who don't know their exact birth time.

- **Change points**: every moment inside the window where the lagna, the navamsa (D9) lagna, the D60 (shashtiamsa) lagna or the Moon's nakshatra pada changes, found to the second.
- **Life events**: 19 kinds (marriage, children, career, parents' passing, moves, accidents and more), each with the houses, karakas and divisional chart that describe it, dated to the day, month or year.
- **Scoring**: every minute or two across the window is cast as a light chart. For each event it checks whether the Vimshottari maha / antar / pratyantar lords running on that date signify the event in that chart (lordship, occupation, aspect, karaka, the event's varga, nodes through their dispositor), plus the Jupiter–Saturn double transit and slow planets crossing the lagna degree or the event's house point.
- **Ranking**: candidates are grouped by lagna + navamsa, ranked, and explained event by event. An optional remembered time ("around 6:30, give or take 30 minutes") nudges nearby times.

```ts
import { createEngine } from '@vedic/engine';
import { rectify } from '@vedic/rectification';

const engine = await createEngine();
const r = rectify(engine, {
  date: '1990-08-15', from: '04:30', to: '08:30',
  place: { latitude: 28.61, longitude: 77.21, timezone: 'Asia/Kolkata' },
  events: [{ kind: 'marriage', date: '2016-02' }, { kind: 'childBirth', date: '2018-11-03' }, { kind: 'careerStart', date: '2012' }],
  likely: { time: '06:30', plusMinusMinutes: 30 },
});
r.candidates[0]; // { localTime, score, lagna, navamsa, d60, moon, events: [why each event fits], ... }
r.changePoints;  // lagna / navamsa / shashtiamsa / nakshatra changes with local times
```

A whole day runs in about a third of a second. Weights are in `src/score.ts` and are a reasoned synthesis of Parashari practice, not a single canonical formula.

## Tests

`npm test -w @vedic/rectification` checks the dasha chain against the engine's Vimshottari, change points against the ascendant on either side, date parsing, the shashtiamsa order, and that planted birth times are recovered from their own life events within minutes.
