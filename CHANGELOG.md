# Changelog

## Unreleased

- Export and sharing: a standalone SVG chart renderer behind PNG/SVG download of any chart and varga; chart notes pinned to houses and planets, kept with the tab and drawn into exports; share cards (1200×630, 1080×1080, 1080×1920) for WhatsApp and Telegram with the system share sheet where the browser has one; an `/embed/` widget and iframe snippet; `/c/<id>/` link-preview pages with pre-rendered og:images for the famous charts; A2 poster (PDF or JPEG, 150 or 300 dpi), lock-screen and 4K wallpaper renders of the 3D sky; a graha sticker pack (PNG and WebP) from the Blender art; and audio narration of the walkthrough and readings with the browser's own voices.
- Bhava chalit chart beside the rashi chart (Sripati and equal-house methods). Switching to it moves planets into their bhava and the house readings follow; lordship and yogas stay sign-based.
- Panchanga on the chart page for the birth moment and any date, with when each tithi, nakshatra, yoga and karana ends (`panchangaAt` in the engine).
- Planet condition: Baladi, Jagradadi and Deeptadi avasthas; gandanta, abhukta mula, graha yuddha, mrityu bhaga, pushkara navamsa and pushkara bhaga flags with their sources; ayurdaya (Pindayu, Amsayu, Nisargayu) behind a caveat.
- Dasha sandhi and chidra for every mahadasha change, and Saturn–Jupiter double transit windows for each house (`doubleTransitWindows` in timing).
- Jaimini argala and virodha argala on every house.
- Share links are versioned (`v=1`) through a new `ChartRequest` type in `@vedic/engine/request`. Every link made before versioning still opens, and frozen copies of old links are tested so they keep opening. Links now also carry a manual UTC offset (war time, LMT), which they used to drop, and saved charts keep it too.
- A link made by a newer version of the app is refused with a clear message instead of being half read.
- The engine checks the ayanamsa at its boundary (`parseAyanamsa`, `Ayanamsa.Lahiri`, …), so an unknown name is an error and not a silent Lahiri chart.
- A float precision policy for degrees (4 decimals at the edges, `sameDegree()` instead of `===`), enforced by a test that scans the sources.
- Birth times now come with `chart.meta.timeWarnings`: LMT used, DST gaps and repeated hours, pre-1900 places far from their zone's meridian, and a table of periods where local clocks differed from the time zone database (Calcutta and Bombay time, wartime India, pre-partition Pakistan and Bangladesh, UK double summer time, US war time and local DST, far-western China).
- Stable finding IDs in `@vedic/interpretations` (`findingLedger`, `diffFindings`), so a chart's yogas, doshas and scores can be compared between versions.
- The geocoder drops results without real coordinates instead of crashing on them (found by the new fuzz tests).
- Engine tests: property-based tests, golden chart fixtures, fuzzing of the place parser, time zone resolver and share-link decoder, and a coverage floor on `packages/engine`.
- Shadbala (six-fold planet strength) and Bhava Bala (house strength) in the engine as `chart.strength`, with charts and explanations in the explorer.
- Display settings on every page: reduce motion, high contrast, text size up to 150%, Atkinson Hyperlegible or OpenDyslexic, and Sanskrit terms in IAST or Devanagari.
- The North and South charts work from the keyboard and read out to screen readers, and can be shown as a table of placements and houses.
- Hover glossary on the Sanskrit terms in every English reading.
- A /learn page: a seven-step primer on the reader's own chart, a searchable glossary, a spot-the-yoga quiz, and a visual yoga rule builder that exports TypeScript.

## 1.0.0

First public release: chart engine, explorer with 16 vargas, 3D sky view, readings with yoga and dosha detection, timing dashboard, landing page. Licensed AGPL-3.0-or-later.
