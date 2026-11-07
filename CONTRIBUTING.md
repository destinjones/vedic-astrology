# Contributing

Thank you. There is room here for writers, astrologers, translators and programmers, and you do not need to know TypeScript to make a real difference.

## Where to start

- **Write a reading.** 242 of the 243 planet-in-nakshatra readings are still composed by the program. Writing one is plain YAML: see [`packages/interpretations/content/README.md`](packages/interpretations/content/README.md) and the [style guide](packages/interpretations/content/STYLE.md). [COVERAGE.md](packages/interpretations/content/COVERAGE.md) shows what is open.
- **Check a source.** Every yoga cites a classical text, but none is verified yet. If you own a printed translation, you can verify one in a few minutes.
- **Report a wrong position or rule.** Above all a chart that differs from another trusted program, or a yoga rule that disagrees with a classical source. Include the birth data, the ayanamsa and what you expected. Use a sample or public chart, not someone's private details.
- **Translate.** Seven of the nine languages have no readings yet.
- **Ask a question** in [Discussions](https://github.com/destinjones/vedic-astrology/discussions), not in Issues.

Issues labelled [good first issue](https://github.com/destinjones/vedic-astrology/labels/good%20first%20issue) are chosen to be finishable in an evening. Comment to claim one.

## Before opening a pull request

```bash
npm ci
npm run typecheck
npm run content:check      # only if you touched packages/interpretations/content
npm test
npm run build:pages
npm run smoke
```

- If you changed reading text, the snapshot test may fail. Check that the diff in `packages/interpretations/test/__snapshots__/` is exactly your change, then run `npx vitest run -u` in `packages/interpretations` and commit it.
- If your change is something a user or a package consumer would notice, add a changeset: `npx changeset` (see [.changeset/README.md](.changeset/README.md)). A typo fix does not need one.
- If your change reverses a decision in [docs/adr/](docs/adr/), write a new ADR in the same pull request.
- Add yourself to [`apps/web/src/credits/people.json`](apps/web/src/credits/people.json) to be named on the [credits page](https://destinjones.github.io/vedic-astrology/credits/). Reading authors can use the `credit:` field instead.

Pull requests are merged with **Squash and merge**, so do not worry about tidying your commits. Write the pull request title as one sentence a changelog reader would understand.

## Rules for text and claims

- Interpretation text must be original writing. Do not paste or closely paraphrase books, sites or other programs.
- Do not present readings as predictions or as medical, legal or financial advice, and do not present the decorative starfield as the real sky.
- Cite a source for any astrological rule you add or change.

By contributing you agree that your work is licensed under AGPL-3.0-or-later.
