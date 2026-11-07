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
- Nakshatra wheel (0° sidereal Aries at 3 o'clock, counter-clockwise) in Blender artwork or diagram style, planet table, Vimshottari maha/antar dasha timeline.
- 3D sky view (three.js, lazy-loaded when scrolled into view): the Blender wheel and graha models, each graha tethered to its exact sidereal longitude, Lagna beam, click-to-select.
- Blender art from `assets/3d` (graha renders, rashi and nakshatra medallions, hero and cosmos backgrounds) in the landing page and detail panels.

## Browser storage

Everything a person enters stays in `localStorage`; there are no accounts and no server.

| Key | Holds |
| --- | --- |
| `vedic.tabs.v1` | `Workspace` from `src/lib/tabs.ts`: `{ tabs, activeId, archived }`. Each `Tab` carries its `input`, `notes`, `log`, `events` (life events for the event checker), and view settings. Read and write through `loadWorkspace` / `storeWorkspace` and add new per-person fields to `Tab` with a parser branch in `parseTab`. |
| `vedic.profiles.v1` | Saved charts, `Profile[]`. |
| `vedic.lifeEvents.v1` | Legacy, read only: life events keyed by birth details, from before they moved onto `Tab.events`. A tab with no `events` field picks its events up from here once. |
| `vedic.lastInput` | The last birth details entered, to prefill the form. |
| `va.first`, `va.ret` | Only when the visit counter is on (below): the day of this browser's first counted visit and of its last counted return. Never sent. |

Share links look like `app/#n=Asha&d=1985-03-02&t=14:20&p=Pondicherry&lat=11.9416&lon=79.8083&tz=Asia/Kolkata` (`ay=` only when not Lahiri). Opening one opens or switches to its tab, then clears the fragment.

## Learn pages

`src/learn/pages.ts` turns the readings in `@vedic/interpretations` into about 340 static pages under `/learn/`: 27 nakshatras, 12 signs, 9 grahas, 12 houses, every planet in every sign and house, 44 yogas, 9 doshas and a glossary (`src/learn/terms.ts`, shared with the PDF report). The `learn-pages` plugin in `vite.config.ts` writes them into `dist/learn/` with their own `learn/sitemap.xml` (listed in `robots.txt`) and renders them on request in `npm run dev`. They load one stylesheet (`src/learn/learn.css`) and no JavaScript. Edit the reading data and the pages follow.

## Visit counter

`src/lib/analytics.ts` counts one funnel with [GoatCounter](https://www.goatcounter.com/), which sets no cookies and stores no IP addresses: landing page view, app view, `chart-submit`, `first-planet-click` and `return-7d` (a later day within seven days of the first visit). It sends the page path only, never the `#` fragment that holds birth details, and nothing at all under Do Not Track or Global Privacy Control.

It is off unless the build sets `VITE_GOATCOUNTER`. To turn it on: create a site at goatcounter.com (the code is the subdomain, e.g. `jyotisha` for `jyotisha.goatcounter.com`), then add a repository variable `GOATCOUNTER_CODE` with that code under Settings > Secrets and variables > Actions > Variables. The Pages workflow passes it to the build. The site check answers counter requests itself, so CI never counts.

## Layout

| Path | Role |
| --- | --- |
| `src/engine/index.ts` | The only seam to `@vedic/engine`. Loads the Swiss Ephemeris WASM lazily; falls back to `mock.ts` (approximate, shows a banner) if it fails. |
| `src/engine/adapter.ts` | Maps the engine `Chart` to the UI's `src/types/chart.ts`. |
| `src/lib/readings.ts` | Loads `@vedic/interpretations` as its own chunk. `src/lib/insights.ts` is the fallback for the preview calculator. |
| `src/components/TimingSection.tsx` | Runs the `@vedic/timing` dashboard on the same engine and chart. |
| `src/components/` | Charts, wheel, detail panel, table, dasha timeline, form. |
| `src/lib/tabs.ts` | Workspace tabs (one per person or client): open tabs, closed tabs, per-tab notes and client history (`LogEntry`: question, prediction with outcome, note). |
| `src/lib/profiles.ts` | Saved charts and share links (birth details in the URL fragment, never sent to the server). |
| `src/lib/backup.ts` | One-file backup and merge-restore of tabs, history and saved charts. |
| `src/lib/walkthrough.ts` | Steps for present mode's guided walkthrough (`src/components/Presenter.tsx`). |

`vite.config.ts` copies `swisseph.wasm` / `swisseph.data` to `dist/wasm/` because the library resolves them at runtime. It also serves `<repo>/assets/3d` at `/cosmos/` in dev and copies it to `dist/cosmos/` on build; `src/data/art.ts` maps ids to those files via `assets/3d/manifest.json`.
