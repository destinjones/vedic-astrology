# Reading content

The readings in this folder are plain YAML. You can write or fix one without touching any TypeScript.

| Folder or file | What it holds | Status |
|---|---|---|
| `planet-in-sign/<planet>.yaml` | 12 readings per graha, one per sign | complete (108) |
| `planet-in-house/<planet>.yaml` | 12 readings per graha, one per house, each with a `score` | complete (108) |
| `planet-in-nakshatra/<planet>.yaml` | hand-written readings for any of the 27 nakshatras | mostly open: see [COVERAGE.md](COVERAGE.md) |
| `yogas.yaml` | where each yoga's rule comes from and what cancels it | every yoga, citations still to verify |
| `schema/` | JSON Schemas for the files above | |
| [`STYLE.md`](STYLE.md) | how to write a reading | read this first |
| [`COVERAGE.md`](COVERAGE.md) | what is written, what is composed, and how far each language has got | generated |

## Edit, check, commit

```bash
# after editing any YAML here
npm run content -w @vedic/interpretations   # validates, then rebuilds src/data/generated/content.ts and COVERAGE.md
npm test -w @vedic/interpretations          # snapshots, yoga lint and readability
```

Commit the YAML, the regenerated `src/data/generated/content.ts` and `COVERAGE.md` together. CI runs `npm run content:check` and fails if they disagree.

If a snapshot test fails, that is expected when you changed text that the sample chart uses. Look at the diff in `test/__snapshots__/`, and if it shows exactly your change, run `npx vitest run -u` in `packages/interpretations` and commit the updated snapshot. Reviewers read that diff to see your change in context.

## Editor help

Each file starts with a `yaml-language-server` line. With the YAML extension in VS Code (or any editor that speaks the YAML language server), you get completion and inline errors from the schema as you type.

## A new nakshatra reading, start to finish

1. Open `planet-in-nakshatra/<planet>.yaml`, or create it with the two header lines from `moon.yaml`.
2. Add an entry under `readings:` keyed by the nakshatra's name in lower case with hyphens (`purva-phalguni`). The schema lists them.
3. Write `summary`, `detail` (one to three paragraphs), `strengths` and `challenges`. `score` is optional; leave it out to keep the composed score.
4. Add yourself under `credit:` if you would like your name on the credits page.
5. Run the two commands above and open a pull request.

The pada line ("In pada 2 …") is added after your text automatically, so do not write about padas unless one matters to the reading.
