# The ephemeris

Every planet position on the site comes from the Swiss Ephemeris, compiled to WebAssembly. This page says exactly which build, how to check it, and how to rebuild it if the upstream package ever disappears.

## What we use

| | |
|---|---|
| npm package | [`swisseph-wasm`](https://github.com/prolaxu/swisseph-wasm) 0.1.0 (GPL-3.0-or-later), a dependency of `@vedic/engine` |
| Swiss Ephemeris C source | 2.10.03, vendored by that package in `deps/swisseph/` |
| Data files bundled into `swisseph.data` | `sepl_18.se1` (planets), `semo_18.se1` (Moon), `seas_18.se1` (main asteroids): about 1800–2400 CE at full precision |
| Outside that range | the engine falls back to the built-in Moshier analytic ephemeris, and `chart.meta.ephemeris` says `'moshier'` |
| Recorded hashes | [`tools/ephemeris.lock.json`](../tools/ephemeris.lock.json) |

We do not compile the WASM ourselves. The package ships it prebuilt, and Vite copies `swisseph.wasm` and `swisseph.data` to `/wasm/` in the site build (see `swissEphAssets` in `apps/web/vite.config.ts`).

## Check it

```bash
npm run verify:ephemeris
```

This hashes the three build files in `node_modules/swisseph-wasm/wasm/`, asks the WASM for its Swiss Ephemeris version, and compares both with `tools/ephemeris.lock.json`. CI runs it on every pull request, so a silent change to the ephemeris (a new package version, a compromised mirror, a lockfile edit) fails the build.

To upgrade on purpose: bump the dependency, run `node tools/verify-ephemeris.mjs --update`, run the whole test suite (the engine tests check real stations, ingresses and Sade Sati dates against published values), and explain the change in the pull request.

## Rebuild it from source

If the npm package ever goes away, the WASM can be rebuilt from the package's repository. You need the [Emscripten SDK](https://emscripten.org/docs/getting_started/downloads.html) (3.x is known to work) and Node 20+.

```bash
git clone https://github.com/prolaxu/swisseph-wasm.git
cd swisseph-wasm
git checkout v0.1.0            # the version in tools/ephemeris.lock.json
./init-dependency.sh           # checks the vendored C source, the data files and emcc
./compile.sh                   # writes wasm/swisseph.{js,wasm,data}
npm test
```

Then point the engine at your build (for example with `"swisseph-wasm": "file:../swisseph-wasm"` in `packages/engine/package.json`), run `npm install`, `npm test` and `npm run verify:ephemeris`.

An Emscripten rebuild is not guaranteed to be byte-identical to the published one, so expect the hashes to differ. What must not differ is the output: the engine tests, the reading snapshots in `packages/interpretations/test/__snapshots__/` and the golden values in `packages/engine/test/` must all pass unchanged. If they do, record the new hashes with `--update` and note the rebuild in the pull request.

If the repository is gone too, the Swiss Ephemeris C source and data files are published by Astrodienst at <https://www.astro.com/ftp/swisseph/>, and `compile.sh` in any fork of `swisseph-wasm` shows the `emcc` flags and the exported function list.
