# @vedic/engine

A sidereal (Vedic) chart engine on the [Swiss Ephemeris](https://www.astro.com/swisseph/), compiled to WebAssembly. It runs in the browser and in Node 20+, with no server and no network calls except the optional place search.

It is the engine behind [Jyotisha Explorer](https://destinjones.github.io/vedic-astrology/).

## Install

```bash
npm install @vedic/engine
```

## Use

```ts
import { createEngine } from '@vedic/engine';

const engine = await createEngine();            // loads the WASM once; every call after that is synchronous
const chart = engine.computeChart(
  { date: '1869-10-02', time: '07:11', place: { name: 'Porbandar', latitude: 21.6417, longitude: 69.6293 } },
  { ayanamsa: 'lahiri', houseSystem: 'whole_sign' }, // both are the defaults
);

chart.ascendant;             // sidereal longitude, sign, nakshatra and pada
chart.planets.moon;          // longitude, speed, sign, house, nakshatra, dignity, retrograde, combust
chart.vargas.D9;             // divisional charts, D1 to D60
chart.dasha;                 // Vimshottari, to three levels by default
chart.dashas;                // Yogini, Ashtottari and Kalachakra
chart.panchanga;             // tithi, vara, nakshatra, yoga, karana
chart.strength;              // Shadbala and Bhava Bala
```

The rest of the API (transits with `positionsAt`, `ascendantAt`, `ayanamsaAt`, sunrise and sunset, Yogini, Ashtottari and Kalachakra dashas, KP sub-lords, Prashna and Muhurta helpers) is in the [API reference](https://destinjones.github.io/vedic-astrology/docs/engine/).

## Conventions

- Planets, signs and houses use lower-case ids (`sun`, `aries`) and numbers 1–12; nakshatras 1–27.
- Longitudes are sidereal degrees in [0, 360).
- Times are resolved with the IANA time zone database for the birth place. Before standardised zones (roughly pre-1900 in most places) pass `utcOffsetMinutes` for local mean time.

## Bundlers

`swisseph-wasm` loads `swisseph.wasm` and `swisseph.data` relative to its own module at run time. Vite and webpack need those two files copied next to the bundle; see the `swissEphAssets` plugin in [`apps/web/vite.config.ts`](https://github.com/destinjones/vedic-astrology/blob/main/apps/web/vite.config.ts) for a ten-line example.

## Licence

AGPL-3.0-or-later, because the Swiss Ephemeris is AGPL (or a paid licence from Astrodienst). If you run a changed copy as a network service you must offer its source to its users. See [NOTICE](https://github.com/destinjones/vedic-astrology/blob/main/NOTICE).
