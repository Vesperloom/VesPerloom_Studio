"""Exercise the actual Wan worker with tiny, random local components; no Hub or GPU."""

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import sentencepiece as spm
import torch
from diffusers import (
    AutoencoderKLWan,
    FlowMatchEulerDiscreteScheduler,
    WanPipeline,
    WanTransformer3DModel,
)
from transformers import T5TokenizerFast, UMT5Config, UMT5EncoderModel


def smoke():
    torch.manual_seed(19)
    with tempfile.TemporaryDirectory() as temp:
        p = Path(temp)
        text = p / "text.txt"
        text.write_text("quiet moon over sea\ngreen hills under ice\n")
        spm.SentencePieceTrainer.train(
            input=str(text),
            model_prefix=str(p / "sp"),
            vocab_size=40,
            hard_vocab_limit=False,
            unk_id=2,
            pad_id=0,
            eos_id=1,
            bos_id=-1,
            minloglevel=2,
        )
        tok = T5TokenizerFast(vocab_file=str(p / "sp.model"), extra_ids=0)
        enc = UMT5EncoderModel(
            UMT5Config(
                vocab_size=len(tok),
                d_model=16,
                d_ff=32,
                num_layers=1,
                num_heads=2,
                d_kv=8,
                pad_token_id=0,
                eos_token_id=1,
            )
        )
        vae = AutoencoderKLWan(
            base_dim=8,
            z_dim=4,
            dim_mult=[1, 1, 1, 1],
            num_res_blocks=1,
            temperal_downsample=[False, True, True],
            latents_mean=[0] * 4,
            latents_std=[1] * 4,
        )
        tr = WanTransformer3DModel(
            num_attention_heads=2,
            attention_head_dim=16,
            in_channels=4,
            out_channels=4,
            text_dim=16,
            freq_dim=16,
            ffn_dim=32,
            num_layers=1,
            rope_max_seq_len=128,
        )
        pipe = WanPipeline(
            tokenizer=tok,
            text_encoder=enc,
            vae=vae,
            scheduler=FlowMatchEulerDiscreteScheduler(num_train_timesteps=20),
            transformer=tr,
        )
        pipe.save_pretrained(p / "model", safe_serialization=True)
        del pipe
        out = p / "frames.rgb"
        req = {
            "directory": str(p / "model"),
            "output": str(out),
            "settings": {
                "prompt": "quiet sea",
                "height": 32,
                "width": 32,
                "frames": 5,
                "steps": 2,
                "seed": 0,
            },
        }
        env = {
            **os.environ,
            "HF_HUB_OFFLINE": "1",
            "VESPER_DEVICE": "cpu",
            "VESPER_ALLOW_CPU_EXTERNAL": "1",
            "OMP_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
        }
        worker = Path(__file__).resolve().parents[1] / "engine/adapters/wan_worker.py"
        proc = subprocess.run(
            [sys.executable, str(worker)],
            input=json.dumps(req),
            capture_output=True,
            text=True,
            env=env,
            timeout=150,
            check=False,
        )
        if proc.returncode:
            raise RuntimeError(proc.stderr)
        data = out.read_bytes()
        assert len(data) == 5 * 32 * 32 * 3
        assert len({data[i : i + 3072] for i in range(0, len(data), 3072)}) == 5
        if "--encode" in sys.argv:
            check = Path(__file__).with_name("encode-video-fixture.mjs")
            subprocess.run(["node", str(check), str(p)], check=True, timeout=90)
            if shutil.which("ffprobe"):
                for name, codec in [("clip.mp4", "h264"), ("review.webm", "vp8")]:
                    probe = subprocess.check_output(
                        [
                            "ffprobe",
                            "-v",
                            "error",
                            "-count_frames",
                            "-show_entries",
                            "stream=codec_name,width,height,nb_read_frames",
                            "-of",
                            "json",
                            str(p / name),
                        ],
                        text=True,
                    )
                    stream = json.loads(probe)["streams"][0]
                    assert (
                        stream["codec_name"],
                        stream["width"],
                        stream["height"],
                        int(stream["nb_read_frames"]),
                    ) == (codec, 32, 32, 5)
        print("PASS: real WanPipeline fixture decoded five distinct 32×32 RGB video frames.")


if __name__ == "__main__":
    smoke()
