"""One isolated, local-only inference process. Node owns the job lifecycle."""

import json
import os
import sys
from pathlib import Path


def emit(progress, phase):
    print(json.dumps({"progress": progress, "phase": phase}), flush=True)


def main():
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    import torch
    from diffusers import (
        FluxPipeline,
        StableDiffusionPipeline,
        StableDiffusionXLPipeline,
    )

    req = json.load(sys.stdin)
    opts, model = req["options"], req["profile"]
    device = os.environ.get("VESPER_DEVICE", "auto")
    if device == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    if device not in ("cpu", "cuda"):
        raise ValueError("VESPER_DEVICE must be auto, cpu or cuda.")
    if device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA requested but unavailable.")
    if device == "cpu" and os.environ.get("VESPER_ALLOW_CPU_EXTERNAL") != "1":
        raise RuntimeError(
            "External models require a GPU by default. Use Strata-1 or explicitly enable CPU inference."
        )
    dtype = (
        torch.float32
        if device == "cpu"
        else (
            torch.bfloat16
            if model["architecture"] == "flux" and torch.cuda.is_bf16_supported()
            else torch.float16
        )
    )
    classes = {
        "sd15": StableDiffusionPipeline,
        "sdxl": StableDiffusionXLPipeline,
        "flux": FluxPipeline,
    }
    kw = {"torch_dtype": dtype, "local_files_only": True, "use_safetensors": True}
    if model.get("variant"):
        kw["variant"] = model["variant"]
    emit(0.02, "Loading verified components")
    pipe = classes[model["architecture"]].from_pretrained(req["directory"], **kw)
    if device == "cuda" and os.environ.get("VESPER_OFFLOAD") == "1":
        pipe.enable_model_cpu_offload()
    else:
        pipe = pipe.to(device)
    if hasattr(pipe, "enable_vae_tiling"):
        pipe.enable_vae_tiling()
    pipe.set_progress_bar_config(disable=True)

    def progress(_, i, t, values):
        emit(0.10 + 0.84 * (i + 1) / opts["steps"], "Denoising")
        return values

    with torch.inference_mode():
        result = pipe(
            prompt=opts["prompt"],
            width=opts["width"],
            height=opts["height"],
            num_inference_steps=opts["steps"],
            guidance_scale=model["guidance"],
            generator=torch.Generator(device="cpu").manual_seed(opts["seed"]),
            callback_on_step_end=progress,
        )
    if any(getattr(result, "nsfw_content_detected", None) or []):
        raise RuntimeError("Image withheld by the model safety checker.")
    result.images[0].convert("RGB").save(Path(req["output"]), format="PNG")
    emit(0.98, "Writing image")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"{type(exc).__name__}: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
