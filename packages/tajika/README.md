# @vedic/tajika

Tajika annual charts (Varshaphal) on top of `@vedic/engine`.

- **Solar return to the second.** Newton steps on the engine's own sidereal Sun find the moment it returns to its birth degree, with the birth chart's ayanamsa. The test suite holds the error under 0.0000001°, about a hundredth of a second of time.
- **Muntha**, one sign a year from the birth lagna, with its house, lord and the planets that see it.
- **The five office-bearers** (birth lagna lord, annual lagna lord, Muntha lord, Tri-rashi pati, Dina-ratri pati) and the **year lord**: the strongest of them that sees the annual lagna, by Pancha-vargiya bala (sign 30, exaltation 20, hadda 15, drekkana 10, navamsa 5, divided by 4).
- **Tajika aspects** with deeptamsa orbs, and the yogas Ikkavala, Induvara, Ithasala (exact, current and coming), Ishrafa, Nakta, Yamaya, Kamboola, Radda, Manau and Duhphali-kuttha.
- **Seven life areas** judged by the link between the annual lagna lord and each house lord.
- **Twenty Sahams** with day and night formulas and the +30° rule.
- **Mudda dasha**, the Vimshottari periods compressed into the year, with sub-periods.
- **Readings** and a year score with its reasons.

```ts
import { createEngine } from '@vedic/engine';
import { computeVarshaphal, readVarshaphal } from '@vedic/tajika';

const engine = await createEngine();
const natal = engine.computeChart({ date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209 } });
const year = computeVarshaphal(engine, natal, { year: 2026 }); // or { age: 36 }, and { place } for where you live
const reading = readVarshaphal(year);
```

Where schools differ, the choices are: the Moon does not rule the year (`moonCanRuleYear: true` to allow it), friendships are the natural ones, the annual chart uses whole sign houses, and the Mudda dasha starts with the birth dasha balance. All of it is in `src/varshaphal.ts` and `src/constants.ts`.
