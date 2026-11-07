# @vedic/web — Jyotisha Explorer

Interactive Vedic chart explorer built on `@vedic/engine`.

```bash
npm install          # from the repo root (workspaces)
npm run dev -w @vedic/web
npm run build -w @vedic/web
```

## What's in it

- Birth details form with place search (engine `geocode`, plus an offline city list), lat/long, IANA time zone and ayanamsa.
- North and South Indian charts as SVG, for all 16 Parashari vargas (D1–D60).
- Click a planet, house, the ascendant or a nakshatra to open its detail panel: dignity, retrograde, combust, vargottama, lords, aspects, a reading, and the planet across every varga. Hovering a planet highlights the houses it aspects.
- Nakshatra wheel (0° sidereal Aries at 3 o'clock, counter-clockwise), planet table, Vimshottari maha/antar dasha timeline.

## Layout

| Path | Role |
| --- | --- |
| `src/engine/index.ts` | The only seam to `@vedic/engine`. Loads the Swiss Ephemeris WASM lazily; falls back to `mock.ts` (approximate, shows a banner) if it fails. |
| `src/engine/adapter.ts` | Maps the engine `Chart` to the UI's `src/types/chart.ts`. |
| `src/lib/insights.ts` | Local readings until `packages/interpretations` lands (same `Reading` shape). |
| `src/components/` | Charts, wheel, detail panel, table, dasha timeline, form. |

`vite.config.ts` copies `swisseph.wasm` / `swisseph.data` to `dist/wasm/` because the library resolves them at runtime.
