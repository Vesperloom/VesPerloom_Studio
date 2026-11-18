# HTTP API · v0.3

Base URL: `http://127.0.0.1:4173`. Responses are JSON except for media routes, the streaming chat response and static files. Send `Content-Type: application/json` for job submission. When a shared token or named workspace keyring is configured, supply `Authorization: Bearer <your-token>` on every `/api/*` route except health, including image downloads. Tokens are never accepted in query strings.

## Submit and poll

```bash
curl -sS http://127.0.0.1:4173/api/jobs \
  -H 'Content-Type: application/json' \
  -d '{"model":"strata-1","prompt":"A glacial moon over cobalt peaks","seed":77,"aspect":"3:2","steps":24,"drift":0}'
```

A successful submission returns **202** with a job object, including a server-generated UUID in `id`. Pass that ID to `GET /api/jobs/:id`. Poll at a modest interval (the studio uses 400 ms). On `done`, use `result.image` for the PNG and `result.capsuleUrl` for the replay record. URLs are **relative** to the same server. CLI-rendered files do not appear in this gallery.

| Route | Result |
| :--- | :--- |
| `GET /api/health` | `{status, version, authRequired}`. Liveness only, not a GPU readiness probe. |
| `GET /api/models` | Catalog with IDs, pinned revision, installation status, estimated VRAM band and component count. |
| `GET /api/studies` | Four bundled render records with source settings and public static asset URLs. |
| `GET /api/gallery` | Up to 64 committed user render records, newest first. |
| `POST /api/jobs` | Normalize and enqueue. Never pulls a missing model. |
| `GET /api/jobs/:id` | Job state, phase, progress in `[0,1]`, settings, and result or error when terminal. |
| `DELETE /api/jobs/:id` | Cancel a queued or running job. A committed image cannot be cancelled. |
| `GET /api/renders/:id/image.png` | Full-resolution PNG. |
| `GET /api/renders/:id/thumb.png` | Gallery thumbnail, at most 384 px wide. |
| `GET /api/renders/:id/capsule.json` | Portable replay capsule conforming to [the schema](../registry/schemas/capsule.schema.json). |

## Settings

| Key | Type and bounds | Default |
| :--- | :--- | :--- |
| `prompt` | Nonblank string, at most 600 UTF-16 code units after trimming | Required |
| `model` | Installed registry ID | `strata-1` |
| `seed` | Integer `0` through `4294967295` | Random uint32 |
| `aspect` | `3:2`, `1:1`, `16:9`, `4:5` | `3:2` |
| `steps` | Integer `1` through the model's `maxSteps` | Model profile default |
| `drift` | Integer `0`–`100`; must be `0` for external models | `0` |
| `parent` | Known study ID or committed render UUID; lineage only | `null` |

Dimensions are derived on the server. Client-supplied width, height, filesystem paths, URLs and shell commands are **not** worker controls. The native prompt router is English and keyword-based. External pipelines use their own text encoders.

States: `queued → running → done | failed`; cancellation of a queued item is immediate, while active work can pass through `cancelling → cancelled`. A deadline expiry is `failed`, not `cancelled`. The `result` field is present only after gallery commit. A service restart discards job state, not completed renders.

## Error handling

Errors use `{"error":"human-readable message"}`. Job-worker errors appear in the job's `error` field after the initial 202.

| Status | Meaning |
| ---: | :--- |
| 400 | Invalid JSON, geometry, seed, prompt, steps or parent |
| 401 / 403 | Missing/invalid token, or disallowed cross-site browser write |
| 404 | Unknown job, resource or route |
| 409 | Model not installed or job already terminal |
| 413 / 415 | JSON body over 8 KiB (64 KiB for chat) or incorrect media type |
| 429 | Queue at capacity; wait before retrying |
| 503 | Server is shutting down |

This release has no browser endpoint for model installation, arbitrary path import or shell execution. See [`bin/loom.mjs`](../bin/loom.mjs) for trusted administrator commands.

## Capabilities, workspaces and chat

`GET /api/capabilities` returns `workspace`, `isolated`, `chat[]` and `video[]`. A chat item reports `id`, display name, `local`, readiness and setup information; a connected endpoint advertises the configured model and host, **never** its secret. Readiness is a lightweight install/configuration check, not a model quality or GPU memory test. Named workspace keys use the same authorization header. Access to another workspace's job/media ID returns 404.

```bash
curl -N http://127.0.0.1:4173/api/chat -H 'Content-Type: application/json' \
  -d '{"model":"qwen-small","maxTokens":96,"messages":[{"role":"user","content":"Describe a moonlit alpine lake in one sentence."}]}'
```

`POST /api/chat` streams newline-delimited JSON (`application/x-ndjson`): `start`, optional local `ready`, repeated `delta` with `text`, then `end` with `reason`, or `error` with `message`. Example delta: `{"type":"delta","text":"moonlight"}`. Handle errors **inside** an already open 200 response. Closing the request/response connection cancels generation. Unknown or unready engines return 409; a busy stream returns 429. Body fields: `model` = `qwen-small`, `qwen-7b` or configured `connected`; `messages` = alternating `user`/`assistant` ending with `user`, up to 17 turns, ≤4,000 characters each and ≤14,000 total; `maxTokens` = integer 8–384 (default 192). The server supplies its own system message. Local history can be trimmed in oldest pairs to fit the token context. No server-side chat history is saved.

## Video jobs

```bash
curl -sS http://127.0.0.1:4173/api/video/jobs -H 'Content-Type: application/json' \
  -d '{"model":"strata-motion","prompt":"Copper dunes at dusk","seed":41928,"duration":3,"camera":"glide","strength":85,"frame":"wide","fps":12}'
```

Same 202/ID, poll and cancel routes as image jobs. Models: `strata-motion` (bundled) and `wan-t2v` (operator-installed). `frame` = `wide|square|tall`, nominal `duration` = 2, 3 or 4; `seed`, `prompt` and optional `parent` use the image validation rules. Native `camera` = `glide|dolly|arc`, `strength` = 0–100, `size` = `preview|hd`, `fps` = 12/24, `steps` = 1–48, `drift` = 0–100. Wan uses `camera:model`, `strength:0`, `size:model`, `fps:16`, `steps` = 1–50, `drift:0`. Set only the fields you mean to override; the server derives dimensions and frame count. See [resolution and duration](MULTIMODAL.md).

`GET /api/motion-study` returns the bundled public example record. `GET /api/clips` lists the current workspace's 16 most recent committed clips. Each contains relative `url`, `poster`, `strip`, `review` and `recipeUrl` fields. The `clip.mp4` master and `review.webm` fallback support GET, HEAD and single byte ranges (206 or 416). Recipes conform to the [motion record schema](../registry/schemas/motion.schema.json). Public sharing is never automatic; generated media and recipes use workspace authorization when enabled.
