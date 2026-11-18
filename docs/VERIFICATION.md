# Verification record · 0.3.0

## Motion & language release checks

**Observed on 18 November 2026, Linux x86-64, CPU-only.** A working interface is not a hardware benchmark. These checks deliberately distinguish pretrained inference from small fixtures and catalog validation.

| Path | Observed result |
| :--- | :--- |
| Regression and integration | 46 Node tests passed on both Node 20 and 22. Includes genuine renders and private media, range/HEAD responses, named key add/rotate/revoke, isolation, queue caps, failed/uninstalled models, cancellation, chat message bounds, provider stream parsing and recipe validation. |
| Local pretrained chat | The 491,400,032-byte Qwen2.5-0.5B-Instruct Q4_K_M GGUF was downloaded and hash-verified. The Linux CPU runtime generated text, streamed multiple deltas, used three-turn history (returned “Copper Meridian” when asked the remembered project name), reported busy during an active reply, stopped on disconnect, and served a subsequent request. No external API key used. |
| Studio workflow | Chromium authenticated to a named workspace, used a **real local Qwen reply** as an image prompt, rendered a plate, carried its seed and parent to Video studio, rendered a new clip, played, paused, sought and downloaded it. The smaller VP8 review path was used in Chromium without H.264 playback support. The default browser test uses an explicitly labeled loopback SSE fixture to run without model downloads. Desktop and 390 px mobile flows checked. |
| Native video | Meridian Crossing: 36 distinct decoded H.264 frames, 512×288, 12 fps, 3.00 s. The smaller VP8 WebM also decoded to 36 distinct frames. Same-host native replay reproduced the **exact MP4 file** (`26c221e8186cb1be72f12bba8ee2eaab035be9dbb426d8a179cb0b6a4f19a534`); source RGBA sequence is hashed separately. HD alpine sample: 48 distinct decoded H.264 frames, 1280×720, 24 fps, 2.00 s; its replay also matched byte for byte. Both are silent, generated media, not mock UI placeholders. |
| Video diffusion adapter | Real offline `WanPipeline`, tiny **random** UMT5, temporal transformer and Wan VAE, two denoising steps on CPU. Five distinct 32×32 RGB frames; passed through the shipping external frame encoder to MP4 and WebM. `ffprobe` decoded five frames from each. This is a control-path/format test, **not** a production Wan quality or speed test. |
| Model inventory | 96 upstream component identities matched the seven pinned third-party profiles: 74 image, 3 GGUF, 19 Wan. Only the small GGUF pretrained snapshot was run in this environment. The included native weights and offline Seed Lab remain available without any external pull. |
| Not asserted | No full Wan/7B/SD/SDXL/FLUX pretrained inference, GPU benchmark, Docker daemon run, hosted provider evaluation, real publication, stars or audience measurements. |

### Repeat the new checks

```bash
npm ci && npm test
npx playwright install --with-deps chromium
npm run test:browser
npm run loom -- replay-video app/public/reels/meridian/recipe.json --out checked.mp4

# Optional Linux x86-64: install real CPU chat weights/runtime in your chosen home.
export VESPER_HOME="$HOME/vesperloom-check"
npm run chat:setup && npm run test:chat
VESPER_CHAT_TEST_HOME="$VESPER_HOME" node tests/multimodal.browser.mjs

# Optional: with the matching Python tensor environment already installed.
HF_HUB_OFFLINE=1 OMP_NUM_THREADS=1 python tests/video_adapter_smoke.py --encode
```

The CPU-only QA mode never substitutes fixture output in the real app. Screenshots in `docs/media/` are recorded from the running release; the release ZIP never includes the GGUF cache or runtime `node_modules`.

## Community release checks · 0.2.0

- 35 unit/integration tests: 29 original regression checks and six new checks for portable recipes, privacy, UTC week boundaries, link setup and the four localized README entries.
- The downloadable Seed Lab HTML ran under Chromium with networking disabled. Each of the four reference plates matched the original Node renderer’s decoded RGBA SHA-256. The same code also produced an image in the worker-disabled fallback. This is an observed result, not a guarantee for every browser/math library.
- Browser checks exercised studio → native remix, the Telegram link on desktop and mobile, weekly seed and drift controls, import, and export of an actual 1200×630 PNG postcard. A separate, locally built Pages fixture checked the configured repository CTA, public remix URL, social preview and user-initiated Telegram composer. No real social post, GitHub deployment or star was made by these tests.
- To repeat the offline browser checks: install Chromium for Playwright, then `npm run test:browser`. Use `VESPER_CAPTURE_LAUNCH=1 node tests/seed-lab.browser.mjs` after building to refresh the postcard and lab screenshot. `npm run lab:build` regenerates the one-file HTML after source edits.

## Original renderer and runner verification · 0.1.0

This page separates observed behavior from deployment guidance. The release checks were performed on **18 November 2026** in a Linux x86-64 CPU environment. External production checkpoints are not bundled or described as GPU-certified.

| Check | What was exercised |
| :--- | :--- |
| Native training | 4,200 NumPy training steps on original synthetic scene codes. A second run with NumPy 2.3.5 and one BLAS thread reproduced all three shards and the metadata byte for byte on this host. |
| Native/API/CLI suite | **29 tests passed on both Node 20 and Node 22**. Actual PNG generation; deterministic same-host replay; drift and condition changes; input and capsule validation; bounded FIFO, timeouts and cancellation; HTTP auth; restart recovery and retention; staged model import and failure recovery. |
| Production frontend | Vite production build with self-hosted fonts. Chromium exercised a token-protected session, branch generation, private media, PNG dimensions, capsule export/import, registry details, gallery search and mobile navigation. |
| Upstream metadata | `npm run registry:check` matched all 74 allowlisted component IDs and sizes to the four pinned repository trees. A live, small-file download also exercised verification of two SD 1.5 configuration files. No production weight snapshot was pulled as part of these checks. |
| Tensor adapters | Torch **2.8.0+cpu**, torchvision **0.23.0+cpu**, Diffusers **0.35.2** and Transformers **4.56.2**. Each of the three architecture paths loaded a tiny local safetensors pipeline, ran two real denoising steps and wrote a 32×32 PNG. The SD 1.x fixture included a safety checker. All fixture weights were randomly initialized solely for these tests. |
| Not validated here | Full SD/SDXL/FLUX checkpoint inference, CUDA performance, cross-hardware bit equivalence, real VRAM minimums, Docker daemon execution and systemd installation on a target VPS. CI definitions are supplied; no hosted CI badge is asserted. |

## Native benchmark

`npm run bench` performs one warm-up, then seven single-threaded native renders at **960×640**, **24 DDIM steps**, using adjacent seeds. It includes denoising, shading and PNG compression. It excludes worker startup, HTTP, thumbnails, hashing, disk writes and model installation.

| Environment | Observed result |
| :--- | :--- |
| CPU / Node | 2 visible logical CPUs, Intel Xeon 2.60 GHz, Linux x64, Node 20.20.2 |
| Seven render times in ms | 596, 550, 584, 575, 505, 533, 561 |
| Median / slowest | **561 ms / 596 ms** |
| Node process peak resident memory | **108 MiB** for this benchmark; not the whole deployed server |

These are observations from one virtual host, not a throughput SLA. Shared host load and other scenes change the results. The native model card reports held-out **scene-code noise prediction**, not a benchmark for photographic quality.

## Repeat the checks

```bash
npm ci
npm run format:check
npm test
npm run build
npm run loom -- verify strata-1
npm run loom -- replay app/public/studies/study-01.json --out replay.png
npm run bench
```

Optional checks:

```bash
# Metadata only; requires network access to the upstream Hub.
npm run registry:check

# Browser binary and OS libraries are optional development prerequisites.
npx playwright install --with-deps chromium
npm run test:browser

# With the optional local tensor environment installed:
OMP_NUM_THREADS=1 python tests/adapter_smoke.py
```

The browser suite uses a temporary data directory and ephemeral loopback port. It does not modify an existing studio. Source for all of these checks is included in `tests/` and `tools/`.
