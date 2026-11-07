# Changesets

Each pull request that changes what a user sees, or what a package does, adds a changeset: a small Markdown file that says which packages changed, how much, and what to put in the changelog.

```bash
npx changeset
```

Pick the packages, pick patch, minor or major, and write one or two sentences for a reader of the changelog, not for a reviewer. Commit the file it creates with your change.

When pull requests with changesets land on `main`, the Release workflow opens (or updates) a "Version packages" pull request that bumps versions and writes each package's `CHANGELOG.md`. Merging that pull request is the release. Nothing is published to npm automatically; see [docs/releasing.md](../docs/releasing.md).

Content-only fixes (a typo in a reading) can skip the changeset.
