# Releasing

## The website

Every push to `main` deploys the site (`.github/workflows/pages.yml`) after the tests and the browser site check pass. There is nothing else to do.

## Versions and changelogs

We use [Changesets](../.changeset/README.md). Pull requests add a changeset; the Release workflow keeps a "Version packages" pull request open on `main`. Merging it bumps the versions and writes each package's `CHANGELOG.md`. Tag the merge commit `vX.Y.Z` (the `@vedic/web` version) if you want a GitHub release.

## Publishing `@vedic/engine` to npm

The engine is set up to publish but has not been published. The workspace copy stays `private` so nothing can be published by accident; a publishable copy is built into `packages/engine/dist-pkg/`.

One-time setup, by the maintainer:

1. Create an npm account at <https://www.npmjs.com/signup> and turn on two-factor authentication.
2. Create the `vedic` organisation at <https://www.npmjs.com/org/create> (free for public packages). If the scope is taken, pick another and change `name` in `packages/engine/package.json` and the imports that use it.
3. `npm login` on your machine.

Each release:

```bash
git checkout main && git pull
npm ci
npm test
npm run pack -w @vedic/engine          # builds dist-pkg/, dry-runs npm pack, imports it and casts a test chart
npm publish packages/engine/dist-pkg   # asks for your 2FA code
```

Later, publishing can move into the Release workflow with an npm automation token stored as a repository secret and `npm publish --provenance`; that is a separate decision.
