# @vedic/timing

The "when" layer on top of `@vedic/engine`: which periods of life are supportive or challenging, and why.

- **Vimshottari favourability**: every maha / antar / pratyantar (down to prana) gets a score from −100 to +100 with the reasons behind it: the lord's dignity, house placement, functional nature for the lagna (trikona/kendra/dusthana lordship, yogakaraka), combustion, retrogression, position from the Moon, and the relationship between the period lords (6/8 and 2/12 friction, trines, natural friendship). Each period also lists the life areas (houses) it activates.
- **Gochara (transits)**: house from the natal Moon, vedha (obstruction) with the classical exemptions, Bhinnashtakavarga bindus, kakshya, and conjunctions/oppositions to natal points. Transit scores are measured against the chart's own long-run baseline, so "challenging" means worse than usual for you.
- **Sade Sati and Saturn phases**: rising, peak and setting phases with retrograde re-entries, plus Kantaka (4th) and Ashtama (8th) Shani, with severity from Saturn's bindus and lagna.
- **Retrogrades**: stations, pre-shadow and post-shadow for Mercury to Saturn, the natal houses each loop covers, natal points it stations on or opposite, and whether the planet was retrograde at birth.
- **Ashtakavarga**: all seven BAV tables (Parashara), SAV (always 337), prastara contributors per sign.
- **Life weather**: a combined dasha + transit series and automatically detected favourable and challenging windows with their drivers.
- **Transit search**: "When does Saturn next hit my Moon?", "next Jupiter return", "Jupiter into my 10th house", "next Mercury retrograde". `parseTransitQuestion` understands a fixed set of question patterns (English and Sanskrit planet and sign names, year limits such as "after 2030"), with no AI involved. `searchTransits` finds every exact pass (retrograde loops are grouped, up to three passes), the window within 1°, sign ingresses and stations, decades ahead. Vedic aspects are degree-exact: the 7th for every graha, plus Mars 4th/8th, Jupiter and the nodes 5th/9th, Saturn 3rd/10th.
- **UI**: `TimingDashboard` (React, plain SVG): life weather chart with dasha / Sade Sati / retrograde lanes and hover inspection, a transit search box (type a question or use the dropdowns; results are listed and marked on the timeline), drill-down dasha map, transit table for any date, ashtakavarga heatmap, and a detail panel explaining every score.

## Use

```ts
import { createEngine } from '@vedic/engine';
import { timelineForChart, engineEphemeris, natalFromChart } from '@vedic/timing/engine';

const engine = await createEngine();
const chart = engine.computeChart({ date: '1990-01-01', time: '12:00', place: { latitude: 40.71, longitude: -74.01 } });
const timeline = timelineForChart(engine, chart, { from: new Date('2026-01-01'), to: new Date('2031-01-01') });
// timeline.dashas, .current, .series, .windows, .retrogrades, .saturn, .ashtakavarga, .now
```

```tsx
import { TimingDashboard } from '@vedic/timing/ui';
import '@vedic/timing/ui/timing.css';

<TimingDashboard chart={natalFromChart(chart)} ephemeris={engineEphemeris(engine, { ayanamsa: chart.meta.ayanamsa, nodeType: chart.meta.nodeType })} name="Destin" />
```

The pure functions (`computeVimshottari`, `scoreDashaTree`, `transitSnapshot`, `findStations`, `findIngresses`, `findRetrogrades`, `saturnPhases`, `computeAshtakavarga`, `buildTimeline`) take any `Ephemeris`, so they also run on the bundled `createAstronomyEphemeris()` fallback (astronomy-engine + Lahiri) without WASM.

## Demo

```sh
npm run demo -w @vedic/timing        # dev server
npm run demo:build -w @vedic/timing  # static build in packages/timing/demo/dist
```

`demo/vite.config.ts` includes a small plugin that ships `swisseph.wasm` and `swisseph.data` next to the bundle; any app that bundles the engine needs the same.

## Tests

`npm test -w @vedic/timing` checks published events (Mercury stations of April 2024, sidereal Saturn into Pisces 29 Mar 2025, Jupiter into Gemini 14 May 2025, Sade Sati for an Aquarius Moon 2020–2028), BAV/SAV totals, dignities, dasha continuity, and engine/fallback agreement.

Every rule and weight, with its classical source, is documented in [docs/SCORING.md](docs/SCORING.md). `test/scoring.test.ts` checks textbook cases so tuning can't drift away from the texts.
