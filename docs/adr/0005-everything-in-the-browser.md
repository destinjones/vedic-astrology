# 0005. Charts are calculated in the browser, with no server

- Status: accepted
- Date: 2026-11-07

## Context

Birth data is personal: date, time and place of birth identify a person and are used for identity checks. Most astrology sites send it to a server and keep it. Running the ephemeris on a server would also need hosting, uptime and money.

## Decision

Compile the Swiss Ephemeris to WebAssembly and do every calculation in the visitor's browser. The site is static files on GitHub Pages. Saved charts live in the browser's `localStorage`. Only two kinds of request leave the site, and neither carries the date or time of birth: the place search sends the typed place name to Open-Meteo, and the small map preview loads OpenStreetMap tiles around the chosen place. Visitors can skip the place search by entering coordinates by hand.

## Consequences

- We can say, and a visitor can verify in their browser's developer tools, that the date and time of birth never leave their device. The birth place is approximately revealed to the two services above.
- There are no accounts, so no cross-device sync without a future, opt-in, encrypted design.
- The first load includes about 2.7 MB of WASM and ephemeris data, cached after that.
- Anything that would need a server (email reminders, shared practitioner workspaces) is out of scope unless a new ADR changes this.
