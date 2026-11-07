# Security and threat model

Jyotisha Explorer is a static site. There is no server of ours, no database and no account. Birth details are computed on and stored in the visitor's own browser. This document says what that protects, what it does not, and how to report a problem.

The visitor-facing version is the [privacy page](https://destinjones.github.io/vedic-astrology/privacy/). If the two ever disagree, that is a bug: please report it.

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/destinjones/vedic-astrology/security/advisories/new), not a public issue. Examples that count:

- birth data, or anything typed into the site, leaving the browser in a way the privacy page does not list
- a request to a host that is not in the table below
- script injection through a share link, a pasted link, a profile backup file or a place name
- a release whose deployed JavaScript does not match its tagged source

You should get a reply within a week. There is no bug bounty.

## What we are protecting

| Asset | Where it lives |
| --- | --- |
| Birth date, time and place, names | `localStorage` in the visitor's browser; in the `#` fragment of share links |
| Saved profiles, chart tabs, consultation notes, life events, rectification events | `localStorage` (`vedic.*` keys), and backup files the visitor downloads |
| Generated PDF reports | The visitor's device only, written by the browser |
| The integrity of the calculations | The published source and the deployed build |

The sensitive part is the combination of a name with a birth date, time and place. That combination is a common identity-verification answer and can locate a person. Consultation notes may hold anything a practitioner writes about a client.

## Every network request the site can make

| Destination | Trigger | Data sent | Data never sent |
| --- | --- | --- | --- |
| `destinjones.github.io` (GitHub Pages) | Page loads, lazy assets (ephemeris `.wasm`/`.data`, artwork, 3D models, PDF fonts) | IP address, user agent, requested path | Anything typed; the `#` fragment |
| `geocoding-api.open-meteo.com` | Three or more characters typed in a place box | The typed place name (first comma part), its modern name for a former name, a language code, IP, user agent, `Referer` origin | Name, date, time |
| `tile.openstreetmap.org` | A place is chosen in the birth form (about 15 tiles, more on zoom) | Tile coordinates, which reveal the area viewed to roughly 40 km at the default zoom; IP, user agent, `Referer` origin | Place name, name, date, time |

Present in the code but never enabled by the website: the Nominatim fallback in `packages/engine/src/geocode.ts` (off by default; the public Nominatim policy forbids client-side autocomplete).

Opt-in only: encrypted sync sends AES-GCM ciphertext to a URL the visitor enters, and a build with `VITE_GOATCOUNTER` set sends page paths (never the fragment) and three event names to GoatCounter, suppressed under Do Not Track and Global Privacy Control. The in-page network log flags any host it does not recognise.

All scripts, styles and fonts are bundled and served from the site's own origin. There is no third-party JavaScript at run time.

## What leaks, and when

**To the host (GitHub).** GitHub sees the IP address and user agent of every visit and which pages were loaded, as any web host does. It does not see birth data, because the app sends none and share links keep it in the fragment, which browsers do not transmit.

**To the place search (Open-Meteo).** It learns that someone at this IP looked up a given town name. It does not learn the date or time. Visitors who type coordinates by hand send nothing.

**To the map (OpenStreetMap).** Tile requests reveal roughly which area was viewed. Combined with the IP address, that is "someone at this IP looked at a map near this town". It does not include the town name or any birth detail.

**Through share links.** A share link *is* the birth data, in readable form. Anyone holding the link can read it: the recipient, a chat or email service that stores messages, browser history and sync, and any extension with access to page URLs. Link-preview bots fetch the URL without the fragment, so they get nothing. Treat a share link like the birth details themselves.

**Through backups and PDFs.** Profile backup files and PDF reports are plain files on the visitor's device. Whoever gets the file gets its contents.

**On a shared or compromised device.** Anything in `localStorage` can be read by another person using the same browser profile, by malware on the device, and by any browser extension granted access to the site. The privacy page has a button that deletes every `vedic.*` and `va.*` key.

**Through the browser itself.** Browser vendors may sync history (including share link URLs) to their cloud. That is outside the site's control.

## What it cannot reach

The site cannot read other sites' data, files on the device (except one the visitor picks, such as a backup to restore), the camera, the microphone or the visitor's location. It never asks for geolocation. It sets no cookies. Nothing a visitor enters is stored anywhere but their own browser, so there is no central copy to breach, subpoena or sell.

## Threats we consider, and the mitigation

| Threat | Mitigation |
| --- | --- |
| Script injection through a crafted share link, pasted link or place name | Inputs are parsed into typed values and rendered by React, which escapes text. No `innerHTML` with user data, no `eval`. |
| A malicious backup file | Restores are parsed as JSON and each tab and profile is checked and rebuilt from known fields before use; anything else is ignored. |
| A compromised dependency shipping exfiltration code | Lockfile pinned; the in-page network log and the privacy page's host list make an unexpected request visible to any visitor; reports through the channel above. |
| A tampered deployment | The site is built by GitHub Actions from the public repository. The footer prints the commit and build date, so a deployed page can be matched to its source. |
| Wrong results presented as right | Calculations are tested against independent ephemeris data and real sky events; the check page lets anyone compare positions with another program to the arc minute. This is an integrity concern, not a confidentiality one, and reports are welcome as normal issues. |

## Out of scope

- Denial of service against GitHub Pages, Open-Meteo or OpenStreetMap
- Attacks that require an already compromised device or a malicious browser extension
- Self-hosted copies of the code run by other people, which may change any of the above (the AGPL requires them to publish their changes)
- Whether astrology is true. Accurate positions are astronomy; the readings are a traditional practice, offered for reflection.
