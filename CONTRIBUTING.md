# Contributing

Bug reports and corrections are the most useful thing you can send, above all a chart whose positions differ from another trusted ephemeris, or a yoga rule that disagrees with a classical source. Please include the birth data used, the ayanamsa and what you expected. Use a sample chart, not someone's private details.

Before opening a pull request:

```bash
npm ci
npm run typecheck
npm test
npm run build:pages
npm run smoke          # includes the axe-core accessibility check
npm run size           # bundle-size budget
npm run licenses       # dependency licences
npm run test:visual    # chart pictures (Linux; see below)
```

CI also runs Firefox and WebKit, Lighthouse, and a second build that must match the first byte for byte. [docs/release-engineering.md](docs/release-engineering.md) explains each check and what to do when one fails, including how to accept new chart pictures after an intended change.

Two rules for text and claims:

- Interpretation text must be original writing. Do not paste from books or other sites.
- Do not present readings as predictions or as medical, legal or financial advice, and do not present the decorative starfield as the real sky.

By contributing you agree that your work is licensed under AGPL-3.0-or-later.
