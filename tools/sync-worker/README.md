# Sync server

An optional, zero-knowledge store for the explorer's encrypted sync. The request shapes, caps and client behaviour are in [SPEC.md](SPEC.md).

```sh
cd tools/sync-worker
npx wrangler kv namespace create SYNC    # put the id in wrangler.toml (it is not a secret)
npx wrangler deploy                      # workers.dev, for testing
```

For production, once the `jyotisha.app` zone is on Cloudflare: uncomment the `sync.jyotisha.app/v1/*` route in `wrangler.toml`, set `workers_dev = false`, deploy, and build the site with `VITE_SYNC_URL=https://sync.jyotisha.app/v1`. Don't publish a build pointing at workers.dev.

For local testing, `node tools/sync-server.mjs` runs the same code on port 8787 with blobs in `./sync-data`.
