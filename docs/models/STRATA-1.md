# Strata-1 · model card

**What is learned?** A conditional diffusion prior over low-dimensional landscape descriptions. **What is not learned?** The English keyword router and the renderer. They are explicit, inspectable algorithms. Strata-1 is not a general-purpose image foundation model, a fine-tune of Stable Diffusion, or a network that predicts RGB pixels directly.

## Architecture

1. The router counts exact lowercase English scene and color words. The four terrain families are `dunes`, `alpine`, `tidal` and `orbital`. Unrecognized text falls back to dunes; unrelated descriptions can therefore yield the same image.
2. A seeded PRNG generates a 20-dimensional noise vector. A second independent vector supports **seed drift**: `z = cos(θ) z₀ + sin(θ) z₁`, with `θ = π × drift / 200`. Drift 0 is the root. The material-noise field retains the original seed.
3. A NumPy-trained ε-predictor receives 20 noisy features, four condition bits, eight sinusoidal time coordinates and two noise-schedule coefficients. The dense layers are **34 → 96 → 96 → 20**, with SiLU activations after the first two layers.
4. A deterministic DDIM sampler estimates a clean scene code. The first time is 0.965 to avoid dividing by a near-zero signal coefficient. Clean estimates are bounded; the final 20 features pass through `tanh` before rendering.
5. An analytic spherical-body shader, depth-projected height fields, atmospheric scattering approximations and seeded material textures turn the scene code into a landscape. Family, seed, palette, step count and drift all have distinct roles.

| Checkpoint | Value |
| :--- | :--- |
| Parameters | 14,612 including biases |
| Format | 3 little-endian float32 shards, 58,448 bytes total |
| Identity | Per-shard SHA-256 plus metadata fingerprint |
| Runtime | Node.js worker thread; no Python, GPU or online request |
| Default schedule | 24 steps; supported range 1–48 |
| Native frames | 960×640, 768×768, 1024×576, 640×800 |
| License | MIT for original code, weights and reference plates |

Each `weights/*.f32` holds a row-major weight matrix followed by its bias vector. Shapes and checksums are recorded in [`checkpoint.json`](../../engine/strata/weights/checkpoint.json). The loader verifies them before it uses them.

## Training and evaluation

The [corpus generator](../../engine/strata/training/corpus.py) samples four original synthetic scene-code families with two compositional modes, correlated factors and residual noise. It does not scrape images, imitate a named artist or require a caption corpus. Training uses a cosine noise schedule, ε-MSE, Adam and cosine learning-rate decay. No third-party checkpoint initialized these weights.

- Training seed: **72891**; **4,200** minibatches × **128** independently sampled examples = **537,600** scene-code examples.
- Held-out generator seed: **5017**; **4,096** samples.
- Held-out ε-MSE: **0.249997**. A predictor returning zero on the same noise targets scores **1.004990**.
- This measures noise prediction on the synthetic code distribution. It is **not** a perceptual image score, prompt-alignment benchmark or comparison with SDXL/FLUX.

Reproduce without overwriting the bundled checkpoint:

```bash
python -m venv .venv
. .venv/bin/activate
python -m pip install -r engine/strata/training/requirements.txt
OPENBLAS_NUM_THREADS=1 python engine/strata/training/train.py --out /tmp/strata-retrained
```

The release used NumPy 2.3.5. BLAS, CPU and NumPy changes can alter training bytes even with the same seed. If replacing a checkpoint, regenerate the shipped plates with `npm run studies`, version the runtime, and publish the new provenance. `npm run bench` times the **current renderer**, not training.

## Prompt vocabulary

| Family | Examples | Suggested palette words |
| :--- | :--- | :--- |
| Dunes | desert, dunes, sand, mesa | copper, amber, terracotta |
| Alpine | mountains, peaks, glacier, alpine | mint, teal, glacial, cobalt |
| Tidal | sea, waves, tide, lake | violet, lilac, lavender |
| Orbital | orbital, crater, basalt | ochre, gold, mustard |

Families and palettes can be crossed: try **“cobalt desert dunes”**. `ringed` adds a ring, `stars` increases the star field, and `immense` grows the celestial body. The exact vocabulary and tie-breaking order are in [`conditioning.mjs`](../../engine/strata/conditioning.mjs).

## Intended use and limits

Local landscape studies, deterministic fixtures, teaching, seed exploration and CPU-only previews. The native model does not understand arbitrary objects, faces, typography or photorealistic scene descriptions. More denoising steps do not necessarily mean higher image quality. For broad text-to-image use, choose an external engine deliberately.
