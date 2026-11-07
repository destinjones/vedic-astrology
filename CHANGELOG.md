# Changelog

## Unreleased

- Bhava chalit chart beside the rashi chart (Sripati and equal-house methods). Switching to it moves planets into their bhava and the house readings follow; lordship and yogas stay sign-based.
- Panchanga on the chart page for the birth moment and any date, with when each tithi, nakshatra, yoga and karana ends (`panchangaAt` in the engine).
- Planet condition: Baladi, Jagradadi and Deeptadi avasthas; gandanta, abhukta mula, graha yuddha, mrityu bhaga, pushkara navamsa and pushkara bhaga flags with their sources; ayurdaya (Pindayu, Amsayu, Nisargayu) behind a caveat.
- Dasha sandhi and chidra for every mahadasha change, and Saturn–Jupiter double transit windows for each house (`doubleTransitWindows` in timing).
- Jaimini argala and virodha argala on every house.
- Shadbala (six-fold planet strength) and Bhava Bala (house strength) in the engine as `chart.strength`, with charts and explanations in the explorer.

## 1.0.0

First public release: chart engine, explorer with 16 vargas, 3D sky view, readings with yoga and dosha detection, timing dashboard, landing page. Licensed AGPL-3.0-or-later.
