# @vedic/interpretations

Original interpretation knowledge base for Vedic (sidereal) charts, plus detection rules for yogas and doshas. All text is written for this project.

## What is in it

| Data | Count | File |
|---|---|---|
| Planet profiles (significations, dignities, friendships, aspects, dasha years) | 9 | `src/data/planets.ts` |
| Signs, houses, nakshatras (deity, symbol, shakti, gana, gifts, shadows, 4 padas each) | 12 / 12 / 27 | `src/data/signs.ts`, `houses.ts`, `nakshatras.ts` |
| Planet in sign | 108 | `src/data/planetInSign.ts` |
| Planet in house | 108 | `src/data/planetInHouse.ts` |
| Planet in nakshatra (composed from nakshatra + planet + lord relationship + pada) | 243 × 4 padas | `getPlanetInNakshatra` |
| Lord of house X in house Y | 144 | `src/data/houseLords.ts` |
| Dignity levels, retrograde and combust readings | 9 / 9 / 6 | `src/data/conditions.ts` |
| Conjunctions (every pair) | 35 | `src/data/conditions.ts` |
| Aspects (graha drishti incl. Mars 4/8, Jupiter 5/9, Saturn 3/10) | per planet × house | `getAspect` |
| Yogas with detectors | 44 | `src/yogas.ts` |
| Doshas with detectors and cancellations | 9 | `src/doshas.ts` |

Yogas covered: the five Pancha Mahapurusha (Ruchaka, Bhadra, Hamsa, Malavya, Sasa), Raja (kendra–trikona lords), Yogakaraka, Dharma-Karmadhipati, Dhana, Lakshmi, Viparita (Harsha, Sarala, Vimala), Neecha Bhanga, Parivartana (Maha, Khala, Dainya), Gaja Kesari, Budha-Aditya, Chandra-Mangala, Sunapha, Anapha, Durudhara, Kemadruma, Vesi, Vasi, Ubhayachari, Adhi, Amala, Saraswati, Vasumati, Shubha/Papa Kartari, Shakata, Pravrajya, the seven Sankhya Nabhasa yogas, Guru-Chandala and Angaraka.

Doshas covered: Manglik (from ascendant, Moon and Venus, with 9 cancellation rules), Kaal Sarp (12 named types, Kaal Amrit, partial), Pitra, Grahan, Guru Chandala, Shrapit, Angarak, Kemadruma, Gandanta.

## API

```ts
import { createEngine } from '@vedic/engine';
import { fromEngineChart, interpretChart, getPlanetInSign } from '@vedic/interpretations';

const chart = (await createEngine()).computeChart(birth);
const r = interpretChart(fromEngineChart(chart));
r.planets.moon.nakshatra;   // Reading
r.yogas;                    // YogaResult[] (only those present)
r.doshas;                   // DoshaResult[] (Manglik and Kaal Sarp always included, with present/severity)
r.highlights.strengths;     // top-scoring readings
```

Every `Reading` has `{ id, title, summary, detail[], strengths[], challenges[], keywords[], tone, score, remedies? }`. `tone` is `benefic | mixed | challenging` and `score` runs from −3 to +3, so the UI can colour and sort.

Lookups work without a chart: `getPlanetInSign`, `getPlanetInHouse`, `getPlanetInNakshatra`, `getHouseLordIn`, `getConjunction`, `getAspect`, `getRetrograde`, `getSign`, `getHouse`, `getNakshatra`.

## Conventions

Same IDs as `@vedic/engine`: lowercase planets, signs and houses 1–12, nakshatras 1–27. Yogas and doshas are judged by whole-sign houses from the ascendant regardless of the display house system. Rahu is taken as exalted in Taurus and Ketu in Scorpio (traditions differ). When the engine supplies compound dignity, it is used; otherwise natural dignity is computed.

`npm run export-json -w @vedic/interpretations` writes everything to `dist/json/` for non-TypeScript consumers.
