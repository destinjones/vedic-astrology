# Sync protocol, v1

The explorer's optional sync server stores encrypted envelopes and nothing else. File sync (a `.jyosync` file moved by hand or through a cloud folder) is the default and needs no server at all.

## What the server can see

Ciphertext, a random sync ID, and timestamps (when each blob was written, and when requests arrive). It never receives the passphrase, the key, names, birth data or notes. It does see the requester's IP address and browser headers, as any web server does; the Worker does not log them.

## Identifiers

- **Sync ID**: 32 lowercase hex digits, 128 bits from `crypto.getRandomValues` on the first device. It is a capability: whoever has it can read, overwrite or delete the blobs under it, but cannot decrypt them. It is not derived from the passphrase, so the server cannot test passphrase guesses against it. The app shows it in groups of four (`0123-4567-…`) and accepts it with or without dashes.
- **Slot**: `[a-z0-9_-]{1,32}`. The app uses `main`. One sync ID holds at most 50 slots.

## Envelope (the request body)

```json
{
  "format": "jyotisha-sync",
  "v": 2,
  "kdf": { "name": "argon2id", "salt": "<base64, 16 bytes>", "m": 65536, "t": 3, "p": 1 },
  "iv": "<base64, 12 bytes>",
  "data": "<base64 AES-256-GCM ciphertext and tag>",
  "at": "<ISO time it was sealed>"
}
```

The key is `Argon2id(passphrase NFKC, salt, m KiB, t passes, p lanes) → 32 bytes`, derived on the device. AES-GCM's additional data is `jyotisha-sync/v2:<salt base64>`. The plaintext is the app's backup JSON. The server checks only that the body is JSON with exactly these top-level keys and `format` set to `jyotisha-sync`; anything else is refused with 400, so a misconfigured client cannot store readable data.

## Requests

All paths are under the server's base URL, e.g. `https://sync.example.com`.

| Request | Headers | Answers |
|---|---|---|
| `GET /v1/<id>/<slot>` | optional `If-None-Match: <etag>` | `200` body + `ETag` + `Last-Modified`; `304` unchanged; `404` nothing stored |
| `HEAD /v1/<id>/<slot>` | | as GET, without the body |
| `PUT /v1/<id>/<slot>` | `If-None-Match: *` to create, or `If-Match: <etag>` to replace | `201` created or `200` replaced, with the new `ETag` and `{ "etag", "updated" }`; `412` the precondition failed (someone wrote first; read, merge, retry); `428` no precondition sent; `400` not an envelope; `413` over 2 MB; `409` the ID already has 50 slots |
| `DELETE /v1/<id>/<slot>` | | `204` |
| `DELETE /v1/<id>` | | `204`, every slot under the ID is gone |
| `GET /v1/<id>` | | `200 { "slots": [{ "slot", "etag", "updated" }] }` |
| `OPTIONS *` | | `204` with CORS headers |

Any request can also answer `429` (rate limit, with `Retry-After`) or `503` (the server's kill switch is on). ETags are strong: the first 128 bits of the body's SHA-256, quoted.

## Limits

- 2 MB per blob
- 50 blobs per sync ID
- each blob expires 180 days after its last write; every sync renews it
- 60 requests a minute per sync ID
- deleting is immediate and on request; there are no backups on the server

## Client behaviour

1. `GET` the slot. If it exists, decrypt it with the passphrase and merge it into the local data (merging keeps everything from both sides).
2. Seal the local data and `PUT` it with `If-Match` set to the ETag from step 1, or `If-None-Match: *` if there was nothing.
3. On `412`, go back to step 1 (at most twice more).
4. On any other 4xx or 5xx, a timeout (10 s) or no network, stop talking to the server, save the encrypted envelope as a file instead, and tell the person once, until the next sync that succeeds.

Cloudflare KV is eventually consistent across locations, so `If-Match` is checked against the copy the serving location sees. Two devices writing within about a minute from different places can still overwrite each other; because every write is a merge of what the writer had, the next sync from the other device puts its data back.

## Running a server

- **Cloudflare Worker with KV** (what the public site uses): see `wrangler.toml` in this folder. Create the KV namespace, set the custom domain (`sync.<your domain>`, not workers.dev) and `ALLOW_ORIGIN`, then `npx wrangler deploy`. Set `SYNC_DISABLED = "1"` to switch it off; clients fall back to files.
- **Plain Node** for local testing or a small box behind an HTTPS proxy: `node tools/sync-server.mjs` runs the same Worker code with blobs in a folder.

In the app, tick "Sync through a server you trust (optional)" and paste the server's base URL. To list a server as a one-click choice in a build of the site, set `VITE_SYNC_URL=https://sync.your-domain.example` (and optionally `VITE_SYNC_LABEL`) when building.
