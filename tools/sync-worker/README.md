# Sync server

An optional, zero-knowledge store for the explorer's encrypted sync. The request shapes, caps and client behaviour are in [SPEC.md](SPEC.md).

```sh
cd tools/sync-worker
npx wrangler kv namespace create BLOBS   # put the id in wrangler.toml
# set routes to sync.<your domain> and ALLOW_ORIGIN to your site's origin
npx wrangler deploy
```

Then build the site with `VITE_SYNC_URL=https://sync.<your domain>` to offer it as a choice, or paste the URL into the app's sync box.

For local testing, `node tools/sync-server.mjs` runs the same code on port 8787 with blobs in `./sync-data`.
