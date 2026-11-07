# Release engineering

Every pull request runs these checks. Each one exists because something here can go wrong silently.

| Check | Where | Fails when |
|---|---|---|
| Dependency licences | `npm run licenses`, [tools/license-policy.json](../tools/license-policy.json) | a package in `package-lock.json` has no licence, or one that could conflict with AGPL-3.0-or-later (GPL-2.0-only, SSPL, BUSL, non-commercial…) |
| Bundle size | `npm run size`, [tools/size-budget.json](../tools/size-budget.json) | first-load JS, total JS/CSS, the largest chunk, the Swiss Ephemeris files, the 3D art or the whole site grows past its budget |
| Site check + accessibility | `npm run smoke`, [tools/a11y.mjs](../tools/a11y.mjs) | anything in the app breaks, or axe-core finds a new critical or serious WCAG 2.1 AA problem |
| Chart pictures | `npm run test:visual`, [e2e/visual.spec.mjs](../e2e/visual.spec.mjs) | any of 96 chart pictures changes: 16 vargas × North/South × phone/tablet/desktop |
| Browsers | `npm run test:browsers`, [e2e/browsers.spec.mjs](../e2e/browsers.spec.mjs) | the ephemeris (WebAssembly), the 3D sky (WebGL), a share link or a page fails in Chromium, Firefox, WebKit (desktop Safari) or an iPhone viewport |
| Lighthouse | [lighthouserc.json](../lighthouserc.json) | accessibility drops below 0.95 or best practices below 0.95 on any page (performance and SEO only warn) |
| Reproducible build | `npm run verify:build` | a second build, on another machine in another folder, differs from the first by a single byte |

All of them run against the built site, so run `npm run build:pages` first.

## When a check fails

**Bundle size.** The job summary shows a table of every measure. Make the change smaller, or raise the number in `tools/size-budget.json` in the same pull request and say why in its description.

**Licences.** If the new licence is fine for an AGPL program, add its SPDX id to `allowed` in `tools/license-policy.json` (or to `devAllowed` if the package is only a build or test tool). For a one-off, add `"package-name": "reason"` to `exceptions`.

**Accessibility.** The message names the page, the axe rule, the element and a link explaining the fix. `tools/a11y-baseline.json` lists problems that existed when the check was added; fix them and delete their lines. Never add to it by hand.

**Chart pictures.** Download the `chart-picture-diffs` artifact from the failed run and open `playwright-report/index.html`: each failure shows the expected picture, the new one and a diff. If the change is intended, add the label **update screenshots** to the pull request. A workflow takes new pictures on the same Linux image CI uses, commits them to the branch and removes the label. Look at the pictures in that commit, then push again or re-run CI. (Pictures taken on a Mac or Windows go in a different folder and are never compared with CI's.)

**Reproducible build.** Something in the build depends on the machine, the folder or the clock. The message lists the files that differ. Any build date shown in the site must come from `SOURCE_DATE_EPOCH` (CI sets it to the commit time), never from `new Date()` at build time.

## Verifying the deployed site

Every deploy serves a hash of every file at <https://destinjones.github.io/vedic-astrology/SHA256SUMS>. To check that the site matches the code:

```bash
git checkout <commit or tag>
npm ci
npm run build:pages
npm run verify:build                       # writes apps/web/dist/SHA256SUMS
curl -s https://destinjones.github.io/vedic-astrology/SHA256SUMS | diff - apps/web/dist/SHA256SUMS
```

No output from `diff` means the JavaScript you were served is exactly what that commit builds.

## Releases

Push a tag such as `v0.2.0`. The [Release workflow](../.github/workflows/release.yml) builds the site reproducibly and publishes a GitHub release with:

- `vedic-astrology-site-v0.2.0.tar.gz`, the site, packed so the archive itself is reproducible
- `SHA256SUMS`, the per-file hashes
- `sbom.cdx.json`, a CycloneDX software bill of materials for everything that ships
- `CHECKSUMS.txt`, hashes of the three files above

Each file is signed with a Sigstore build provenance attestation (keyless: there is no signing key to keep or leak), and the SBOM is attested against the archive. Anyone can check a file came from this repository's workflow at that commit:

```bash
gh attestation verify vedic-astrology-site-v0.2.0.tar.gz --repo destinjones/vedic-astrology
```

## Preview deploys on Cloudflare Pages

The [Preview workflow](../.github/workflows/preview.yml) builds every pull request and, once Cloudflare is set up, deploys it and posts the link as a PR comment that updates on each push. Until then it builds and skips the deploy, so it never fails a pull request. Pull requests from forks are built but never deployed, because they cannot be given the token.

The build job runs the repository's code and has no secrets. The deploy job holds the Cloudflare token and runs no repository code; it only uploads the built files.

### One-time setup (about ten minutes)

1. **Create a Cloudflare account** at <https://dash.cloudflare.com/sign-up>. The free plan is enough, because GitHub Actions does the building and Cloudflare only hosts the files.
2. **Create the Pages project.** In the dashboard go to **Workers & Pages → Create → Pages** and choose to upload assets directly (not to connect Git). Name the project `vedic-astrology` and upload any small folder, such as one holding a single `index.html`. This only creates the project; CI uploads the real site. If you pick another name, see step 5.
3. **Find your account ID.** It is on the right of **Workers & Pages → Overview**, or in the dashboard URL: `dash.cloudflare.com/<account id>/…`.
4. **Create an API token.** Go to **My Profile → API Tokens → Create Token → Create Custom Token**. Give it one permission, **Account → Cloudflare Pages → Edit**, limited to your account under **Account Resources**. Create it and copy the token (it is shown once).
5. **Add them to GitHub.** In the repository go to **Settings → Secrets and variables → Actions**:
   - **Secrets → New repository secret**: `CLOUDFLARE_API_TOKEN` = the token, and `CLOUDFLARE_ACCOUNT_ID` = the account ID.
   - Only if the project is not called `vedic-astrology`: **Variables → New repository variable**, `CLOUDFLARE_PAGES_PROJECT` = its name.
6. **Re-run the Preview workflow** on any open pull request (or push to it). The comment appears with a link like `https://pr-42.vedic-astrology.pages.dev/vedic-astrology/`.

The site keeps its `/vedic-astrology/` path in previews so they behave exactly like GitHub Pages; the bare preview address redirects there. Previews send `X-Robots-Tag: noindex` so search engines never list them.

GitHub Pages stays the production site. Nothing here deploys `main` to Cloudflare.
