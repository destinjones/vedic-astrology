# Changelog

## Unreleased

- Share links are versioned (`v=1`) through a new `ChartRequest` type in `@vedic/engine/request`. Every link made before versioning still opens, and frozen copies of old links are tested so they keep opening. Links now also carry a manual UTC offset (war time, LMT), which they used to drop, and saved charts keep it too.
- A link made by a newer version of the app is refused with a clear message instead of being half read.
- The engine checks the ayanamsa at its boundary (`parseAyanamsa`, `Ayanamsa.Lahiri`, …), so an unknown name is an error and not a silent Lahiri chart.
- A float precision policy for degrees (4 decimals at the edges, `sameDegree()` instead of `===`), enforced by a test that scans the sources.
- Birth times now come with `chart.meta.timeWarnings`: LMT used, DST gaps and repeated hours, pre-1900 places far from their zone's meridian, and a table of periods where local clocks differed from the time zone database (Calcutta and Bombay time, wartime India, pre-partition Pakistan and Bangladesh, UK double summer time, US war time and local DST, far-western China).
- Stable finding IDs in `@vedic/interpretations` (`findingLedger`, `diffFindings`), so a chart's yogas, doshas and scores can be compared between versions.
- The geocoder drops results without real coordinates instead of crashing on them (found by the new fuzz tests).
- Engine tests: property-based tests, golden chart fixtures, fuzzing of the place parser, time zone resolver and share-link decoder, and a coverage floor on `packages/engine`.
- Shadbala (six-fold planet strength) and Bhava Bala (house strength) in the engine as `chart.strength`, with charts and explanations in the explorer.

## 1.0.0

First public release: chart engine, explorer with 16 vargas, 3D sky view, readings with yoga and dosha detection, timing dashboard, landing page. Licensed AGPL-3.0-or-later.
