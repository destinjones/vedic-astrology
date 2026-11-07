# @vedic/sky

The sky around a chart.

- **Eclipses.** `findEclipses(engine, from, to)` lists every solar and lunar eclipse with its kind, time, sidereal degree, nakshatra and
  node. `solarPath(e)` traces the centre of the Moon's shadow across the Earth; `localView(e, lat, lon)` says whether a place sees it, how
  much, and when; `eclipseHits(e, chartPoints(chart))` lists the chart's ascendant, Midheaven, lights, nodes and lagna lord it falls on.
  Times and kinds from [astronomy-engine](https://github.com/cosinekitty/astronomy); the 2024 eclipses are checked against NASA in the tests.
- **Sankranti ingress charts.** `sankrantis(engine, year)` gives the twelve moments the Sun enters a sidereal sign, from Mesha Sankranti,
  found with the Swiss Ephemeris; `localDateTime(utc, zone)` turns one into the local date and time to cast its chart.
- **Stars.** `stars(ayanamsaJ2000)` and `constellations(…)` (also at `@vedic/sky/stars`) give the Hipparcos stars to magnitude 5 and the
  constellation figures in sidereal coordinates, from [d3-celestial](https://github.com/ofrohn/d3-celestial) (BSD-3-Clause,
  `src/data/D3-CELESTIAL-LICENSE`). Rebuild with `node tools/build-stars.mjs <d3-celestial package>`.
- **World outline** for the eclipse map at `@vedic/sky/land`: Natural Earth 1:110m land (public domain), rebuilt with `tools/build-land.mjs`.
