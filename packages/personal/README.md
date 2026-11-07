# @vedic/personal

The features that make the chart about *you*: what today means for you, when your Sade Sati ends, how rare your chart is, and keepsakes you can share or come back to. Pure TypeScript on top of `@vedic/engine`, `@vedic/timing` and `@vedic/interpretations`; the explorer's UI for it lives in `apps/web/src/personal`.

| Module | What it does |
|---|---|
| `today.ts` | `todayBrief(engine, chart)`: tithi, the Moon's nakshatra, Tara bala from the birth star, Chandrashtama yes/no (with when it lifts or next begins) and one line for the Moon's house from the birth Moon. Same tara rules as the muhurta finder. |
| `sadeSati.ts` | `sadeSatiCountdown(engine, chart)`: days until the current Sade Sati ends, or until the next begins, with its phases, re-entries and Saturn's bindus. Built on `saturnPhases()` from `@vedic/timing`, so dates match the timing dashboard. |
| `ayanamsaDiff.ts` | `ayanamsaDiff(engine, input)`: the chart under Lahiri, True Chitra, Raman and KP, with arcminute deltas, every sign / nakshatra / pada / navamsa crossing, and how far the first dasha change moves. |
| `severity.ts` | `findingsOf(report)` gives every yoga and dosha a level (headline, notable, background) from its category, strength and rarity; `viewFindings(…, { beginner: true })` hides doshas and arishta yogas and caps the list at five. |
| `rarity.ts` | How often each yoga and dosha appears in 10,000 random charts, and a chart rarity percentile. The table is `src/data/rarity.json`. |
| `story.ts` | `chartStory(chart, report)`: a linear narrative (rising sign, Moon and birth star, Sun, standout yogas, light and shade, the dasha running now) assembled from existing readings. |
| `sample.ts` | `randomBirth(seed, i)` for the rarity sample, and `controlBirth(input)` for the blind test: same place, another moment 3 to 15 years away. |
| `capsule.ts` | Time capsules: seal a prediction with a SHA-256 over the text, chart and dates, open it later (or early, and say so), score it 0 to 4. |
| `poster.ts` | `posterSvg(chart)`: generative art drawn only from the chart's own degrees. Deterministic; birth data is off by default. |
| `ics.ts` | Panchanga at local sunrise for any run of days, as RFC 5545 iCalendar; personal feeds add Tara bala and Chandrashtama. `FEED_CITIES` lists the hosted subscription feeds. |

## Scripts

```bash
npm run rarity -w @vedic/personal                   # re-cast the 10,000-chart sample (about 10 s) and rewrite rarity.json
npm run feeds -w @vedic/personal -- <out-dir>        # write the city panchanga feeds; build:pages runs this into dist/feeds
```

Re-run `rarity` whenever a yoga or dosha detector changes, so the percentages describe the detectors that ship. The sample is seeded, so the same detectors always give the same table.

## Tests

`npm test -w @vedic/personal` checks tara counting, tithi against the engine's panchanga, Chandrashtama over a month, the Sade Sati end of 2025-03-29 for a Capricorn Moon (Saturn entering sidereal Pisces), that every body shifts by the same ayanamsa delta, severity ordering and the beginner cap, the rarity table against a fresh sample, capsule sealing and tampering, poster determinism and privacy, and iCalendar line folding.
