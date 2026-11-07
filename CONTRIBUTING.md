# Contributing

Bug reports and corrections are the most useful thing you can send, above all a chart whose positions differ from another trusted ephemeris, or a yoga rule that disagrees with a classical source. Please include the birth data used, the ayanamsa and what you expected. Use a sample chart, not someone's private details.

Before opening a pull request:

```bash
npm ci
npm run typecheck
npm test
npm run build:pages
npm run smoke
```

Golden files. `packages/engine/test/fixtures/golden/` holds a digest of six reference charts, and `packages/interpretations/test/fixtures/findings-*.json` the findings for three. If your change is meant to move a planet, a dasha date or a score, regenerate them with `UPDATE_GOLDEN=1 npm test -w <package>` and explain the diff in the pull request. If it is not meant to, a failing golden test is a bug.

Share links. `packages/engine/test/fixtures/share-links.json` holds links people already have. Never edit or delete an entry. To change the link format, bump `CHART_REQUEST_VERSION` in `packages/engine/src/request.ts`, add a migration from the previous version, and add an example of the old format to the fixtures.

Degrees. Never compare two angles with `===`; use `sameDegree()` from `@vedic/engine`. Round to `DEGREE_DECIMALS` (4) only when a value leaves the engine. A test scans the sources for this.

The engine has a coverage floor (`packages/engine/vitest.config.ts`). `npm test` fails below it.

Two rules for text and claims:

- Interpretation text must be original writing. Do not paste from books or other sites.
- Do not present readings as predictions or as medical, legal or financial advice, and do not present the decorative starfield as the real sky.

By contributing you agree that your work is licensed under AGPL-3.0-or-later.
