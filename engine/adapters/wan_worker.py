"""Local text-to-video inference. Node validates dimensions and owns the MP4 encode."""

import json
import os
import sys
from pathlib import Path


def main():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    import numpy as np
    import torch
    from diffusers import AutoencoderKLWan, WanPipeline

    req = json.load(sys.stdin)
    opts = req["settings"]
    directory = req["directory"]
    device = os.environ.get("VESPER_DEVICE", "auto")
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if device not in ("cuda", "cpu") or (device == "cuda" and not torch.cuda.is_available()):
        raise RuntimeError("A compatible CUDA host is required for this configuration.")
    if device == "cpu" and os.environ.get("VESPER_ALLOW_CPU_EXTERNAL") != "1":
        raise RuntimeError("Wan on CPU is disabled by default. Use Strata Motion on CPU VPSs.")

    def emit(p, phase):
        print(json.dumps({"progress": p, "phase": phase}), flush=True)

    emit(0.01, "Loading local video components")
    kw = {"local_files_only": True, "use_safetensors": True}
    vae = AutoencoderKLWan.from_pretrained(
        directory, subfolder="vae", torch_dtype=torch.float32, **kw
    )
    dtype = (
        torch.float32
        if device == "cpu"
        else (torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16)
    )
    pipe = WanPipeline.from_pretrained(directory, vae=vae, torch_dtype=dtype, **kw)
    if device == "cuda" and os.environ.get("VESPER_OFFLOAD") == "1":
        pipe.enable_model_cpu_offload()
    else:
        pipe = pipe.to(device)
    pipe.vae.enable_tiling()
    pipe.set_progress_bar_config(disable=True)

    def callback(_, i, t, values):
        emit(0.05 + 0.8 * (i + 1) / opts["steps"], "Denoising temporal latent")
        return values

    with torch.inference_mode():
        frames = pipe(
            prompt=opts["prompt"],
            height=opts["height"],
            width=opts["width"],
            num_frames=opts["frames"],
            num_inference_steps=opts["steps"],
            guidance_scale=5.0,
            generator=torch.Generator(device="cpu").manual_seed(opts["seed"]),
            output_type="np",
            callback_on_step_end=callback,
        ).frames[0]
    if tuple(frames.shape) != (opts["frames"], opts["height"], opts["width"], 3):
        raise RuntimeError("Video pipeline returned an unexpected shape.")
    with Path(req["output"]).open("wb") as f:
        for frame in frames:
            f.write(np.clip(np.rint(frame * 255), 0, 255).astype("uint8").tobytes())
    emit(0.92, "Decoded video frames")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"{type(e).__name__}: {e}", file=sys.stderr, flush=True)
        sys.exit(1)
