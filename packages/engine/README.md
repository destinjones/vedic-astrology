# @vedic/engine

The sidereal chart engine behind Jyotisha Explorer: the [Swiss Ephemeris](https://www.astro.com/swisseph/) compiled to WebAssembly,
wrapped in a typed, synchronous API. It runs the same in a browser and in Node 20+, needs no network, and is the only place in the
project that computes a planetary position. How accurate those positions are is measured on the [accuracy page](https://destinjones.github.io/vedic-astrology/accuracy/).

```ts
import { createEngine } from '@vedic/engine';

const engine = await createEngine();          // loads the WASM once; later calls share it
const chart = engine.computeChart(
  { date: '1990-08-15', time: '06:30', place: { latitude: 28.6139, longitude: 77.209, timezone: 'Asia/Kolkata' } },
  { ayanamsa: 'lahiri', dashaLevels: 3 },
);
chart.ascendant.signSlug;          // 'leo'
chart.planets.moon.nakshatraName;  // 'Rohini'
chart.dasha.periods[0].lord;       // Vimshottari lord at birth
```

Everything after `createEngine` is synchronous. Longitudes are sidereal degrees in `[0, 360)`; signs, houses and nakshatras are
1-based; planet ids are lower case (`'sun'` … `'saturn'`, `'rahu'`, `'ketu'`, and with `includeOuterPlanets` `'uranus'`, `'neptune'`, `'pluto'`).

## Input

```ts
interface BirthInput {
  date: string;              // local civil date at the place, "YYYY-MM-DD" (years may be negative, astronomical numbering)
  time: string;              // local civil time, "HH:mm" or "HH:mm:ss"
  place: { latitude: number; longitude: number; timezone?: string; altitude?: number };  // east and north positive
  utcOffsetMinutes?: number; // fixed offset that overrides the zone's rules (war time, a town on its own clock)
  calendar?: 'auto' | 'gregorian' | 'julian'; // 'auto' (default): Julian before 1582-10-15
  name?: string;
}
```

Local time becomes UTC through the IANA time zone database (via Luxon), with daylight saving and war time. When the zone's offset at
that date is a city's mean time (before standard time), the birthplace's own local mean time is used instead and `meta.localMeanTime`
is true. With no `timezone`, the zone is looked up offline from the coordinates.

## Options

| Option | Default | |
|---|---|---|
| `ayanamsa` | `'lahiri'` | also `true_chitra`, `raman`, `krishnamurti`, `fagan_bradley`, `yukteshwar`, `true_revati`, `true_pushya`, `true_mula`, … (`AYANAMSA_CODES`) |
| `houseSystem` | `'whole_sign'` | `equal`, `sripati`, `placidus`, `koch`, `porphyry`, `campanus`, `regiomontanus` |
| `nodeType` | `'mean'` | `'true'` for the true node |
| `includeOuterPlanets` | `false` | adds Uranus, Neptune, Pluto |
| `vargas` | all 16 | which divisional charts to build (`VARGA_IDS`) |
| `dashaLevels` | `3` | Vimshottari depth, 1 (maha) to 5 (prana) |
| `dashaYearDays` | `365.2425` | days per dasha year |
| `strength` | `true` | Shadbala and Bhava Bala in `chart.strength` |

## Output: `Chart`

| Field | |
|---|---|
| `meta` | resolved zone, UTC offset, `localMeanTime`, `calendar` and `gregorianDate`, `utc`, `jdUt`, `jdEt`, ayanamsa id, name and value, options, engine version |
| `ascendant`, `midheaven` | sidereal position: longitude, sign, degree, `dms`, nakshatra, pada, nakshatra lord (and the lagna's sign lord) |
| `planets` | per graha: the above plus latitude, distance, speed, tropical longitude, house, `retrograde`, `combust`, distance from the Sun |
| `houses` | twelve houses: sign, cusp, lord, occupants |
| `vargas` | D1 to D60: each planet's sign and house, the varga ascendant, vargottama planets |
| `dasha` | Vimshottari periods to `dashaLevels` deep, with the balance at birth |
| `dashas` | Yogini, Ashtottari (with whether it applies) and Kalachakra |
| `panchanga` | tithi, paksha, vara and its lord, nakshatra, yoga, karana, sunrise and sunset |
| `strength` | Shadbala (six components, in rupas, against the classical minimums) and Bhava Bala |

## Instants, not charts

```ts
engine.positionsAt('2025-03-29T12:00:00Z', { ayanamsa: 'lahiri' }); // every graha at an instant (transits, timelines)
engine.longitudeAt('saturn', jdUt);       // { longitude, speed }, the fast path for root finding
engine.ascendantAt(jdUt, lat, lon);       // sidereal ascendant
engine.ayanamsaAt(jdUt, 'lahiri');        // degrees
engine.sunriseSunset(jdUt, lat, lon);     // next sunrise and sunset after jdUt, JD (UT), null in polar day or night
engine.swe;                               // the raw swisseph-wasm instance for anything not wrapped here
```

## Helpers

| Import | |
|---|---|
| `vimshottari`, `dashaAt`, `dashaLevel` | Vimshottari from a Moon longitude, and the periods running at a date |
| `yogini`, `ashtottari`, `ashtottariApplies`, `kalachakra` | the other dasha systems |
| `vargaSign`, `vargaDegree`, `VARGAS` | any divisional chart from a longitude |
| `computeStrength`, `drishtiValue` | Shadbala and Bhava Bala from positions |
| `computeKpChart`, `kpLords`, `kpCusps`, `KP_SUBS` | Krishnamurti Paddhati: star, sub and sub-sub lords, Placidus cusps, significators, ruling planets |
| `castPrashna`, `PRASHNA_TOPICS` | KP horary: number 1–249 or the moment of the question, with a verdict per topic |
| `findMuhurtas`, `MUHURTA_ACTIVITIES` | electional windows for an activity, scored against panchanga and a natal chart |
| `norm360`, `signOf`, `nakshatraOf`, `zodiacPosition`, `dignityOf`, `formatDms` | zodiac arithmetic |
| `localToUtc`, `timezoneAt`, `dateToJd`, `jdToDate`, `julianToGregorian` | time (also at `@vedic/engine/time`, without the WASM) |
| `geocode` | online place search through Open-Meteo (GeoNames), with former names (Bombay, Madras) mapped to modern ones |
| `placeAlias`, `normalizePlaceName` | the former-name table (also at `@vedic/engine/places`) |

## Ephemeris range

From 1800 to 2399 the engine reads the bundled Swiss Ephemeris files (JPL DE431 to about a milliarcsecond). Outside that range it uses
the Moshier theory built into the Swiss Ephemeris, a few arcseconds at worst for the planets over that span; see the accuracy page for
measured numbers. Old dates carry an extra uncertainty from ΔT, the drift of the Earth's rotation, which the Swiss Ephemeris models.

## Tests

`npm test -w @vedic/engine` compares positions with Astronomy Engine and checks Raman's Shadbala worked example, dasha arithmetic,
time zones, KP and the Julian calendar.

License: AGPL-3.0-or-later, as the Swiss Ephemeris requires.
