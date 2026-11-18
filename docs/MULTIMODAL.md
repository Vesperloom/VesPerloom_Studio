# Image, motion and language · operator guide

Vesperloom is a local-first React/Node studio, not a single model trained to do everything. Choose an engine based on the subject, the available hardware and which server may see the prompt.

## Choose a lane

| Lane | What it actually does | Initial plan (not a measured minimum) |
| :--- | :--- | :--- |
| `strata-1` / `strata-motion` | Original learned 20-D landscape prior; still renderer and time-dependent camera projection share weights, seed, terrain and palette. The video is not merely a pan of a PNG, and it is not general video diffusion. | Bundled. CPU, no Python, API key, ffmpeg binary or third-party weight download. Start with 2 vCPUs / 2 GB RAM for native-only use. |
| `qwen-small` | Real Qwen2.5-0.5B-Instruct Q4_K_M, token streaming and up to 4,096 local context tokens. A small drafting assistant; verify its answers. | glibc Linux x86-64, Node 22 recommended. 491,400,032 bytes of model data plus the opt-in runtime. Start with about 4 GB RAM if chat and visual rendering will overlap. |
| `qwen-7b` | Larger Qwen2.5-7B-Instruct Q4_K_M, automatic two-shard GGUF loading through the first shard. | Another 4,683,073,632 bytes on disk. Plan for 8–12 GB host RAM and benchmark on your CPU. Not run at full size in the release environment. |
| SD 1.5 / SDXL / Turbo / FLUX | Separately installed pretrained image diffusion/flow models for general subjects. | See the [per-model setup and licenses](EXTERNAL-MODELS.md). |
| `wan-t2v` | Wan 2.1 T2V 1.3B: UMT5 → temporal transformer denoising → video VAE → RGB frame sequence → encoded clip. No source-image conditioning. | 28,928,887,859 bytes of registered components, additional install/staging space and RAM. Plan/test on a CUDA host, e.g. 16–24 GB VRAM and 32+ GB system RAM as a starting point with offload; this is **not** a measured minimum or a speed guarantee. |
| `connected` | Administrator-selected `/chat/completions` endpoint supporting OpenAI-compatible streamed text. No built-in vendor or key. | Runs inference wherever that endpoint runs. No GGUF runtime required; network, provider policy, cost and rate limits apply. |

### Fast path: a Linux CPU VPS with all three desks

From the extracted repository on a compatible Linux x86-64 machine with Node 22/npm 10+:

```bash
npm ci && npm run chat:setup && npm start
```

For native images and video only, `npm ci && npm start` suffices. The chat setup script installs the locked, CPU-only `node-llama-cpp` runtime into `runtimes/chat-linux-x64/`, with install scripts and optional GPU packages disabled. It checks the backend, then installs the verified small GGUF in `VESPER_HOME/models`. Rendering does not download anything. To use a stronger local language model after setup:

```bash
npm run loom -- pull qwen-7b
npm run loom -- verify qwen-7b
```

Headless local chat needs no running HTTP service:

```bash
npm run loom -- chat qwen-small --prompt 'Describe an alpine lake in one sentence.' --max-tokens 96
npm run loom -- chat qwen-small         # interactive terminal: /clear or /exit
```

Use **Refresh engines** or reload the studio, then select the model in **Studio chat**. To run without the small-model download on a large server, install only the CPU runtime with `npm ci --prefix runtimes/chat-linux-x64 --omit=optional --ignore-scripts` and run `node runtimes/chat-linux-x64/check.mjs`, then pull the registered 7B model. macOS, Windows, ARM and musl hosts can use the native visual engines and a compatible chat service instead of this specific binary adapter.

### Stronger or remote chat

Set `VESPER_CHAT_BASE_URL` (base path including `/v1` if required), `VESPER_CHAT_MODEL` (the exact model ID advertised by your endpoint), and optionally `VESPER_CHAT_API_KEY` in the **server** environment. Restart the server. Internally the suffix `/chat/completions` is appended. HTTPS is required except for loopback HTTP. Never place the key in Vite variables, in the URL or in the browser. The upstream must support `stream:true`, `max_tokens`, plain text content deltas and SSE finish events; this is not an arbitrary provider SDK.

**Privacy:** local GGUF prompts are processed in a per-turn, CPU-only child process, then its model context is disposed. The server does not persist chat transcripts. The UI holds the thread in tab memory; a reload clears it. Export before reloading if needed. The connected provider gets the submitted conversation; the UI shows its host before sending. Selecting **To image** or **To video** only copies editable text, up to 600 characters. Once rendered, that prompt is stored with the media. TLS/proxy/provider logs are outside the application's control.

### General text-to-video on GPU

1. Install the [separate PyTorch/Diffusers environment](EXTERNAL-MODELS.md) with a PyTorch build matching your NVIDIA driver. The pinned requirements include Wan's text-normalization dependencies. Use the same environment and model home in CLI and server.
2. Read the [Wan model card](https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B-Diffusers). Allow **more than 29 GB** free just for the selected snapshot and room for transient files, Python/Torch and exports.
3. Pull and verify before serving. Example after activating the target `.venv`:

```bash
export VESPER_PYTHON="$PWD/.venv/bin/python"
export VESPER_DEVICE=cuda VESPER_OFFLOAD=1
npm run loom -- pull wan-t2v
npm run loom -- verify wan-t2v
npm run loom -- doctor
npm run loom -- video wan-t2v --prompt 'A sailboat passing a lighthouse at dusk, fabric rippling in the wind' --duration 2 --steps 30 --seed 17 --out test-shot.mp4
```

Then run the server with the same variables, and select **Wan 2.1** in Video studio. Wan uses 832×480, 512² or 480×832, at 16 fps. The selected 2/3/4-second action spans generate 33/49/65 frames (`4k+1`); playback is one frame longer than the requested span. One process loads, denoises and decodes locally for each job. CPU tensor inference is blocked by default. Test memory, latency and the 20-minute visual job deadline on your actual GPU. A verified snapshot is not a GPU health check. This release exercised a real **tiny random Wan pipeline** on CPU but **did not run the full pretrained Wan model**.

## Direct, review, replay

1. **Studio chat:** draft an English scene description. Try “Write one short image prompt for cobalt dunes beneath two moons.” Choose **To image** to edit it.
2. **Image studio:** generate with Strata-1. Choose **To video** below the output to carry the *rendered* plate's prompt, seed, drift and denoising steps into a new shot. A nonnative plate transfers text and seed only. No engine is presented as image-conditioned video.
3. **Video studio:** choose a camera path and travel intensity, frame, duration, and optional HD/24 fps. **Render clip** commits a silent MP4, poster, frame strip, smaller VP8/WebM review copy and JSON motion recipe. Play/pause, scrub or select any of five sampled frames. If H.264 is unsupported the player switches to the review copy; the downloaded master stays MP4. The reference reel is clearly marked and is never substituted for failed user jobs.

```bash
npm run loom -- video strata-motion --prompt 'Copper dunes beneath a ringed planet' --camera arc --duration 3 --seed 41928 --out shot.mp4
npm run loom -- replay-video shot.mp4.recipe.json --out checked.mp4
```

Download the actual [HD alpine shot](media/glacial-transit-hd.mp4) and its [replay recipe](media/glacial-transit-hd.motion.json) to inspect the output.

For native clips choose `--frame wide|square|tall`, `--size preview|hd`, `--fps 12|24`, `--strength 0..100`. HD is 1280×720 / 720² / 720×1280. Preview is 512×288 / 384² / 288×512. The CLI writes the MP4, poster and JSON recipe; the studio additionally exposes the filmstrip and playback proxy. Replays compare the SHA-256 of **raw RGBA frames before lossy encoding**. A separate hash identifies the actual encoded MP4. Kernel/library differences can change external model results.

## Invite-only private workspaces

The default is a shared, loopback studio. `VESPER_TOKEN` protects that one shared workspace; handing the same token to multiple people does **not** separate them. For separate galleries, clips and job visibility:

```bash
# Set VESPER_HOME before these commands to match your service account's persistent volume.
npm run workspace -- add mira
npm run workspace -- add sol
npm run workspace -- list
# After a key change, restart the studio. Give each person only their own token.
```

Shows one high-entropy bearer token **once**; store it privately. The server loads only SHA-256 digests from the owner-readable `accounts.json` at startup. The named registry takes precedence over the legacy shared token; an empty named registry remains locked. Rotate with `npm run workspace -- rotate mira` or revoke with `npm run workspace -- revoke mira`, then restart. Rotation retains the same gallery. Revocation isn't erasure; while the service is stopped, the administrator can archive/remove the corresponding `workspaces/<id>/` directory. The key tool refuses to re-add an ID with an existing archive. **Do not reassign an ID to a different person without handling its old data.** The old shared gallery remains on disk, never silently migrated to a named user. Static bundled reference media and the standalone Seed Lab remain public.

Up to 64 named workspaces per instance. Each keeps up to 64 images and 16 clips. One global visual job runs at once with at most eight waiting; two active/pending visual jobs per named workspace. One chat reply at a time across the instance, a 180 s chat watchdog, no persistent conversation database. Disconnect stops a chat worker; closing the visual desk does not cancel a submitted render. Model weights are shared read-only during inference. This is **not** a distributed GPU scheduler, identity provider, content moderation service or open-signup SaaS. Use TLS, reverse-proxy authentication/rate limits as appropriate, OS permissions, a disk quota and operator monitoring; see [deployment](DEPLOYMENT.md) and [security](../SECURITY.md).
