# Contributing

Use Node.js 20.19+ and npm 10+. Run `npm ci`, then `npm run dev` for a Vite frontend with a same-origin proxy to the local API. `npm test` exercises the real native model and service without a GPU, Python or a model download.

Before proposing a change:

```bash
npm run format
npm run format:check
npm test
npm run build
```

For external adapters, build a small deterministic test fixture rather than attaching weights. `python tests/adapter_smoke.py` exercises real tensor pipelines with random local weights. Use the optional dependency setup in [the runner guide](docs/EXTERNAL-MODELS.md).

## Add a model profile

1. Check upstream terms, model provenance and the exact Diffusers component layout. Prefer safetensors. No pickled checkpoints, custom remote code or user-supplied executable model files.
2. Pin a full revision and exact component inventory. Record sizes and SHA-256, Git blob IDs or canonical LFS pointer blob IDs as appropriate. Do not commit downloaded weights or login tokens.
3. Add a profile following [`profile.schema.json`](registry/schemas/profile.schema.json), register its ID and document its license, download size, conditioning, guidance and supported step range. New architectures need explicit adapters; a JSON name alone cannot add compatibility.
4. Exercise install/verify/failure paths, run the worker on an appropriate host, document measured vs. estimated behavior, and update the localized READMEs.

## Change native pixels deliberately

Keep PRNG streams independent and retain seed zero. A change to denoising, color, geometry or sampling can break a prior capsule. Version the engine, update the loader and capsule consumers, regenerate the four studies with `npm run studies`, and explain the compatibility boundary in the changelog. Do not replace a failed render with a stock image.

Use English for source, comments, CLI messages and UI labels. Maintain all four README editions when changing installation or supported models.
