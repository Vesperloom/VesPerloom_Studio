# Licensing boundaries

The [MIT license](LICENSE) applies to the original Vesperloom source, original Strata-1 training generator and checkpoint, documentation and included native reference plates and motion study. It is **not** a blanket license for upstream models, fonts or software dependencies.

| Component | Role | Terms / reference |
| :--- | :--- | :--- |
| React / React DOM | Studio UI | MIT; [React notice](app/public/licenses/react.txt), [React DOM notice](app/public/licenses/react-dom.txt) |
| Lucide React | Interface icons | ISC, with Feather-origin portions; [bundled notice](app/public/licenses/lucide.txt) |
| Manrope / IBM Plex Mono | Self-hosted UI fonts | SIL Open Font License; [Manrope](app/public/licenses/manrope.txt), [IBM Plex Mono](app/public/licenses/ibm-plex-mono.txt) |
| pngjs | Lossless PNG encoding and decoding | MIT; [notice](app/public/licenses/pngjs.txt) |
| Vite, Prettier, Playwright and transitive packages | Development, build, optional browser QA | See each installed package's license and `package-lock.json` |
| PyTorch / torchvision, Diffusers, Transformers and related packages | Optional external tensor runtime | Not bundled. Refer to the licenses in the selected distributions. |
| h264-mp4-encoder | Server-side H.264 MP4 export | [MIT wrapper notice](app/public/licenses/h264-mp4-encoder.txt); upstream includes public-domain minih264 and MPL-1.1 libmp4v2 (see [source and build information](https://github.com/TrevorSundberg/h264-mp4-encoder)); obtain the unmodified package through npm. |
| @jsquash/webp | VP8 encoding for smaller review copies | [Apache-2.0 wrapper](app/public/licenses/jsquash-webp.txt); [libwebp BSD notice](app/public/licenses/libwebp.txt). The single-track WebM writer is original. |
| node-llama-cpp / llama.cpp | Optional CPU GGUF inference | MIT; [node binding](https://github.com/withcatai/node-llama-cpp) and [tensor engine](https://github.com/ggml-org/llama.cpp); the native distribution and its dependencies retain their respective licenses. |
| NumPy | Optional native training | Not bundled. See the NumPy distribution's license. |

## Model snapshots

- [Stable Diffusion v1.5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5): CreativeML Open RAIL-M.
- [SDXL Base](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0): [CreativeML Open RAIL++-M](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/blob/462165984030d82259a11f4367a4eed129e94a7b/LICENSE.md).
- [SDXL Turbo](https://huggingface.co/stabilityai/sdxl-turbo): [upstream license at the pinned revision](https://huggingface.co/stabilityai/sdxl-turbo/blob/71153311d3dbb46851df1931d3ca6e939de83304/LICENSE.md). Do not infer commercial permission from this repository's license.
- [FLUX.1 Schnell](https://huggingface.co/black-forest-labs/FLUX.1-schnell): Apache-2.0 as identified by the upstream model card; access is gated by the publisher.

- [Qwen2.5 0.5B Instruct GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF) and [Qwen2.5 7B Instruct GGUF](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF): Apache-2.0 as identified by those upstream snapshots.
- [Wan 2.1 T2V 1.3B Diffusers](https://huggingface.co/Wan-AI/Wan2.1-T2V-1.3B-Diffusers): Apache-2.0 as identified by upstream.

This release includes **manifests only** for these external models, not their parameters. Users must review applicable upstream terms, including any restrictions on use and redistribution. Product and model names identify compatibility and do not imply affiliation or endorsement.
