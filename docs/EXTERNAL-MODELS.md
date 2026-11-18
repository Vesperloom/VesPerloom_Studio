# Running external models

Vesperloom owns the registry, installer, file verification, scheduler, isolation, cancellation, CLI and artifact format. **PyTorch, Diffusers and Transformers** provide external tensor kernels and pipeline implementations. This is not an Ollama wrapper, an Ollama API clone or a universal checkpoint converter. The bundled Strata-1 runtime uses none of those libraries.

## 1 · Choose a profile

| ID | Upstream & terms | Pinned revision¹ | Download² | Steps | Suggested GPU planning band³ |
| :--- | :--- | :--- | ---: | ---: | :--- |
| `sd15` | [Stable Diffusion 1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5) · CreativeML Open RAIL-M | `451f4fe16113` | 2.74 GB | 24 | 4–6 GB VRAM |
| `sdxl` | [SDXL Base](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) · Open RAIL++ | `462165984030` | 6.94 GB | 25 | 8–12 GB |
| `sdxl-turbo` | [SDXL Turbo](https://huggingface.co/stabilityai/sdxl-turbo) · [upstream license](https://huggingface.co/stabilityai/sdxl-turbo/blob/71153311d3dbb46851df1931d3ca6e939de83304/LICENSE.md) | `71153311d3db` | 6.94 GB | 2 (max 4) | 8–12 GB |
| `flux-schnell` | [FLUX.1 Schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell) · Apache-2.0, gated access | `741f7c3ce8b3` | 33.73 GB | 4 (max 4) | 24+ GB with sufficient host RAM/offload |

¹ The complete 40-character revisions and all component identities are in [`registry/profiles`](../registry/profiles). ² Decimal GB, selected pipeline files only, not a whole clone. ³ Starting points, **not measured minimums or guarantees**. Resolution, dtype, CUDA version and offload determine real usage. FLUX without offload may need substantially more than 24 GB. Leave extra disk space for dependencies and incomplete downloads. Review each upstream license and access terms before pulling or redistributing anything.

## 2 · Prepare a GPU host

Use a dedicated virtual environment with a compatible NVIDIA driver. Python 3.11 is a convenient target. Install **matching** Torch and torchvision wheels for your host using the [PyTorch installer](https://pytorch.org/get-started/locally/). Example for a CUDA 12.8-compatible Linux host:

```bash
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install torch==2.8.0 torchvision==0.23.0 --index-url https://download.pytorch.org/whl/cu128
python -m pip install -r engine/adapters/requirements.txt
export VESPER_PYTHON="$PWD/.venv/bin/python"
export VESPER_DEVICE=cuda
npm run loom -- doctor
```

Set `VESPER_OFFLOAD=1` if you want model CPU offload on CUDA. This exchanges host RAM and speed for lower device memory pressure. Only use `VESPER_DEVICE=cpu VESPER_ALLOW_CPU_EXTERNAL=1` for deliberate CPU experiments: full models can exceed a small VPS's RAM or the 20-minute deadline. Use **Strata-1** on ordinary CPU VPSs. The supplied Docker image does not include the Python/CUDA tensor runtime; install the Python environment on the host for this path.

## 3 · Pull, verify, run

```bash
npm run loom -- inspect sd15
npm run loom -- pull sd15
npm run loom -- verify sd15
npm run loom -- run sd15 --prompt "A glass greenhouse beside a quiet lake" --aspect 1:1 --seed 19 --out plate.png
```

If upstream requires authentication, first accept its terms using your own account. Supply `HF_TOKEN` via your environment or secrets manager. Never put it in a manifest, prompt, URL or commit. The installer downloads only the allowlisted files from the pinned revision. `HF_TOKEN` is not passed to the inference child. **No download is triggered by a browser prompt.**

The staging directory and final installation share a filesystem. Each completed file is verified before reuse on a retry; the current partial file restarts. Large files use SHA-256; regular Git blobs use Git's content-addressed blob ID. When a gated repository hides raw LFS digests, the installer reconstructs the canonical LFS pointer from the **downloaded bytes' SHA-256 and size** and verifies the published Git pointer blob ID. Installation commits with a directory rename only after the entire inventory passes. `list` performs a fast receipt/size check; `verify` does the full re-hash.

After installing, refresh the studio's model list by reloading the page. The backend needs the same `VESPER_HOME` and `VESPER_PYTHON` as the CLI. The worker uses local files only and an explicit pipeline class for the registered architecture. It loads one checkpoint per job and releases the process afterward; there is no persistent GPU weight cache in this release.

## Air-gapped import and maintenance

```bash
npm run loom -- import sd15 /data/approved-sd15-snapshot
npm run loom -- verify sd15
# Stop inference before removing an installation.
npm run loom -- remove sd15
```

The import folder must match the **exact registered revision and selected variant**. Extra files are ignored; unknown architectures, arbitrary Python pipelines, pickle, `.ckpt`, GGUF and single-file checkpoints are not supported **by the image adapter**. The independent chat adapter supports the registered Qwen GGUF layouts. See [video and chat engines](MULTIMODAL.md). A stale `.lock` directory after an interrupted installer can be removed **only after confirming no installation is running**. Verified `.staging` files may be kept for retry. Deleting staging discards download progress.

## What has been tested?

All 74 external component identities were checked against upstream metadata. The real adapter is exercised offline on tiny, randomly initialized SD 1.x, SDXL and FLUX fixtures; these check loading, denoising, callbacks and PNG output, **not model quality**. Production-size weights and GPU/hardware performance have not been tested in the release environment. See [verification](VERIFICATION.md).
