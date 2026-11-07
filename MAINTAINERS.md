# Maintainers

| Name | GitHub | Looks after |
|---|---|---|
| Destin Jones | [@destinjones](https://github.com/destinjones) | everything, for now |

We want at least two. If you have landed a few pull requests and would like to help review, say so in an issue.

## What a maintainer does

- Reviews pull requests within a week, and says so when it will take longer.
- Merges with **Squash and merge** only, so `main` reads as one line per change. Edit the squash title into a sentence a changelog reader would understand.
- Keeps `main` green. A red `main` blocks every contributor, so revert first and fix after.
- Approves the "Version packages" pull request when it is time to release (see [docs/releasing.md](docs/releasing.md)).
- Checks reading changes against [the style guide](packages/interpretations/content/STYLE.md), and astrology rule changes against a source.

## If the maintainer disappears

The project should survive any one person. Everything needed is in the repository:

- **Build and deploy.** `npm ci && npm test && npm run build:pages && npm run smoke` reproduces CI. Pages deploys from `.github/workflows/pages.yml`; a fork can deploy its own copy by enabling Pages with source "GitHub Actions".
- **The ephemeris.** We use a prebuilt WASM. [docs/ephemeris.md](docs/ephemeris.md) records the exact build, how to verify it, and how to rebuild it from source with Emscripten.
- **Why things are the way they are.** [docs/adr/](docs/adr/) records the decisions a newcomer would otherwise reverse by accident.
- **Accounts.** The npm organisation, the GitHub Sponsors or Open Collective profile and the Pages site belong to the maintainer. A second maintainer should be added as an owner of each.

## How the code was written

Much of the code and some of the reading text was written with AI assistance (Claude, by Anthropic), with the maintainer reviewing and directing every change. That is why the test suite, the reading snapshots and the yoga lint matter so much: they check the output, whoever wrote it. Reviewers should hold every pull request to the same standard regardless of how it was produced.

## Someone else has to run CI

The point of this file is that a stranger can rebuild the project. Until someone other than the maintainer has cloned the repository on a clean machine and run the full check, we do not know that. If you do, open an issue titled "Clean build report" with your OS, Node version and the output, and we will add you to the credits.
