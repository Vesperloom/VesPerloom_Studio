"""Optional real tensor tests for all three external architecture adapters.
Random tiny models are built in a temporary directory. No real checkpoint,
private token, GPU or network access is needed once dependencies are installed.
These are execution tests, not quality or VRAM benchmarks.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import sentencepiece as spm
import torch
from diffusers import (
    AutoencoderKL,
    EulerDiscreteScheduler,
    FlowMatchEulerDiscreteScheduler,
    FluxPipeline,
    FluxTransformer2DModel,
    StableDiffusionPipeline,
    StableDiffusionXLPipeline,
    UNet2DConditionModel,
)
from diffusers.pipelines.stable_diffusion.safety_checker import StableDiffusionSafetyChecker
from PIL import Image
from transformers import (
    CLIPConfig,
    CLIPImageProcessor,
    CLIPTextConfig,
    CLIPTextModel,
    CLIPTextModelWithProjection,
    CLIPTokenizer,
    CLIPVisionConfig,
    T5Config,
    T5EncoderModel,
    T5TokenizerFast,
)


def fixture(arch, base):
    tok = base / "tokens"
    tok.mkdir()
    (tok / "vocab.json").write_text(json.dumps({"<|startoftext|>": 0, "<|endoftext|>": 1}))
    (tok / "merges.txt").write_text("#version: 0.2\n")
    tokenizer = CLIPTokenizer(str(tok / "vocab.json"), str(tok / "merges.txt"), model_max_length=16)
    config = CLIPTextConfig(
        vocab_size=2,
        hidden_size=8,
        intermediate_size=16,
        num_hidden_layers=2,
        num_attention_heads=2,
        max_position_embeddings=16,
        projection_dim=8,
        bos_token_id=0,
        eos_token_id=1,
        pad_token_id=1,
    )
    vae = AutoencoderKL(
        in_channels=3,
        out_channels=3,
        block_out_channels=(8, 16),
        down_block_types=("DownEncoderBlock2D",) * 2,
        up_block_types=("UpDecoderBlock2D",) * 2,
        layers_per_block=1,
        latent_channels=4,
        norm_num_groups=4,
        sample_size=32,
        shift_factor=0.0,
    )
    common = {"vae": vae, "tokenizer": tokenizer, "text_encoder": CLIPTextModel(config)}
    if arch == "flux":
        text = base / "text.txt"
        text.write_text("silver light over a quiet sea\nrolling hills and distant ice\n")
        spm.SentencePieceTrainer.train(
            input=str(text),
            model_prefix=str(tok / "sp"),
            vocab_size=48,
            hard_vocab_limit=False,
            unk_id=2,
            pad_id=0,
            eos_id=1,
            bos_id=-1,
            minloglevel=2,
        )
        tok2 = T5TokenizerFast(vocab_file=str(tok / "sp.model"), extra_ids=0)
        t5 = T5EncoderModel(
            T5Config(
                vocab_size=len(tok2),
                d_model=16,
                d_ff=32,
                num_layers=1,
                num_heads=2,
                d_kv=8,
                pad_token_id=0,
                eos_token_id=1,
            )
        )
        tr = FluxTransformer2DModel(
            patch_size=1,
            in_channels=16,
            num_layers=1,
            num_single_layers=1,
            attention_head_dim=16,
            num_attention_heads=2,
            joint_attention_dim=16,
            pooled_projection_dim=8,
            axes_dims_rope=(4, 6, 6),
        )
        return FluxPipeline(
            **common,
            transformer=tr,
            scheduler=FlowMatchEulerDiscreteScheduler(num_train_timesteps=20),
            text_encoder_2=t5,
            tokenizer_2=tok2,
        )
    extra = (
        {
            "addition_embed_type": "text_time",
            "addition_time_embed_dim": 4,
            "projection_class_embeddings_input_dim": 32,
        }
        if arch == "sdxl"
        else {}
    )
    unet = UNet2DConditionModel(
        sample_size=16,
        in_channels=4,
        out_channels=4,
        layers_per_block=1,
        block_out_channels=(8, 16),
        down_block_types=("DownBlock2D", "CrossAttnDownBlock2D"),
        up_block_types=("CrossAttnUpBlock2D", "UpBlock2D"),
        cross_attention_dim=16 if arch == "sdxl" else 8,
        attention_head_dim=(2, 4),
        norm_num_groups=4,
        **extra,
    )
    common.update(
        unet=unet, scheduler=EulerDiscreteScheduler(num_train_timesteps=20, steps_offset=1)
    )
    if arch == "sdxl":
        return StableDiffusionXLPipeline(
            **common,
            text_encoder_2=CLIPTextModelWithProjection(config),
            tokenizer_2=tokenizer,
            add_watermarker=False,
        )
    vision = CLIPVisionConfig(
        hidden_size=8,
        intermediate_size=16,
        num_hidden_layers=1,
        num_attention_heads=2,
        image_size=32,
        patch_size=8,
    )
    checker = StableDiffusionSafetyChecker(
        CLIPConfig(vision_config=vision.to_dict(), text_config=config.to_dict(), projection_dim=8)
    )
    return StableDiffusionPipeline(
        **common,
        safety_checker=checker,
        feature_extractor=CLIPImageProcessor(
            size={"shortest_edge": 32}, crop_size={"height": 32, "width": 32}
        ),
    )


def smoke(arch):
    torch.manual_seed(42)
    with tempfile.TemporaryDirectory() as temp:
        base = Path(temp)
        folder = base / "model"
        pipe = fixture(arch, base)
        variant = None if arch == "flux" else "fp16"
        pipe.save_pretrained(folder, safe_serialization=True, variant=variant)
        del pipe
        out = base / "fixture.png"
        req = {
            "options": {"prompt": "ice", "width": 32, "height": 32, "steps": 2, "seed": 123},
            "profile": {"architecture": arch, "variant": variant, "guidance": 0},
            "directory": str(folder),
            "output": str(out),
        }
        worker = Path(__file__).resolve().parents[1] / "engine/adapters/diffusers_worker.py"
        env = {
            **os.environ,
            "HF_HUB_OFFLINE": "1",
            "TRANSFORMERS_OFFLINE": "1",
            "VESPER_DEVICE": "cpu",
            "VESPER_ALLOW_CPU_EXTERNAL": "1",
            "OMP_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
        }
        run = subprocess.run(
            [sys.executable, str(worker)],
            input=json.dumps(req),
            text=True,
            capture_output=True,
            env=env,
            timeout=120,
            check=False,
        )
        if run.returncode:
            raise RuntimeError(run.stderr)
        assert Image.open(out).size == (32, 32)
        assert "Denoising" in run.stdout
        print(
            f"PASS: actual {arch} worker returned a 32 × 32 PNG from a random local fixture.",
            flush=True,
        )


if __name__ == "__main__":
    for family in ("sd15", "sdxl", "flux"):
        smoke(family)
