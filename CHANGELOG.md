# Changelog

From now on each package keeps its own changelog, written by [Changesets](.changeset/README.md) when a release is cut:

- the website: [`apps/web/CHANGELOG.md`](apps/web/CHANGELOG.md)
- the engine: [`packages/engine/CHANGELOG.md`](packages/engine/CHANGELOG.md)
- the readings: [`packages/interpretations/CHANGELOG.md`](packages/interpretations/CHANGELOG.md)

The entries below predate that.

## Unreleased

- Personal features (`@vedic/personal`): a "today for you" brief (tithi, Tara bala, Chandrashtama), a Sade Sati countdown, a live birth-time slider, the chart under four ayanamsas side by side, a chart story, severity levels and a beginner view for yogas and doshas, rarity from 10,000 random charts, a blind test against a control chart, time capsules, a generative chart poster and panchanga calendar feeds.
- Timing: Vimshottari down to sookshma and prana (levels 4–5), built on demand, in the dasha card and the dashboard's dasha map.
- Timing: "Did it happen?" record. Mark past favourable and challenging windows as happened or not and see hit rates per rule (dasha lords, dignity, placement, lordship, period pairs, transits), with a Wilson interval so thin samples read as unsure.
- Timing: export upcoming windows as an `.ics` calendar, print a year's timeline as a PDF, and opt-in local notifications on the first day of a favourable window (service worker, nothing leaves the browser).
- Rectification: exact-day events are also scored against the sookshma; saved life events can be pulled in from the event checker; a fit matrix shows every event against every candidate, and a diff view shows what changes between two candidate times.
- Prashna: KP timing of the answer from the dasha of the question (first dasha–bhukti–antara whose lords fulfil the matter, narrowed to the sookshma).
- Tools: event chart casting, read on its own or against a saved birth chart (natal houses, exact contacts, natal dashas to sookshma), with a button to save it as a life event.
- Matching: the South Indian ten poruthams (Dashakoota) beside Ashtakoota, the Jaimini marriage reading (Upapada, the 2nd from it, Darakaraka and the 7th from Karakamsa, with cross-links between the two charts), a three-tradition summary, and wedding dates found from both partners' birth Moons.
- Muhurta: nakshatra mukha (Urdhva, Adho, Tiryak), Dhanishta panchaka and the panchaka rahita check, Bhadra's dwelling, disha shoola for journeys, Guru and Shukra asta, Kharmas, and Tara and Chandra bala for several people at once. A caveat now sits on every muhurta result.
- Panchanga calendar: a month view with tithi and nakshatra at sunrise, and for each day sunrise, sunset, Rahu kalam, Yamaganda, Gulika kalam, Abhijit, the 24 horas, Bhadra, Panchaka and every limb change (`panchangaDay`, `panchangaMonth`).
- Sarvatobhadra chakra: the 9 × 9 transit board with vedha lines and strikes on natal points (`sarvatobhadra`).
- Remedies (`@vedic/remedies`): for each afflicted graha, a scored list of why, then mantra with japa count, gemstone only where the planet's lordship makes it safe, yantra, charity and fasting day, each with its source; plus the Ishta devata from the 12th from the Karakamsa. Shown in a new Remedies card with disclaimers.
- Annotated case studies on four famous charts (Indira Gandhi, Rajiv Gandhi, John F. Kennedy, Martin Luther King Jr.): what the rules engine finds, what the classical texts say about it, where a practitioner would push back, and the dashas running at well-documented public events. A test checks every annotation against the engine.
- Classical citations on every yoga, dosha and reading family: a nullable `source` field with text, chapter and verse (BPHS, Phaladeepika, Saravali), shown as a superscript link, plus notes where the texts disagree with each other or with how the app reads them. Rules with no verified classical source say so instead of guessing.
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
