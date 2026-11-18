"""Build the optional launch GIF from real CLI renders. Requires Pillow and npm ci."""

import json
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]


def teaser():
    study = json.loads((ROOT / "registry/studies.json").read_text())[0]
    palette = []
    settings = study["settings"]
    with tempfile.TemporaryDirectory() as tmp:
        for drift in (0, 12, 25, 38, 50, 62, 75, 88, 100):
            png = Path(tmp) / f"{drift}.png"
            subprocess.run(
                [
                    "node",
                    "bin/loom.mjs",
                    "run",
                    "strata-1",
                    "--prompt",
                    settings["prompt"],
                    "--seed",
                    str(settings["seed"]),
                    "--drift",
                    str(drift),
                    "--out",
                    str(png),
                ],
                cwd=ROOT,
                check=True,
                stdout=subprocess.DEVNULL,
            )
            frame = Image.new("RGB", (640, 400), "#161b1a")
            with Image.open(png) as src:
                frame.paste(
                    ImageOps.fit(src.convert("RGB"), (640, 345), centering=(0.5, 0.3)), (0, 0)
                )
            draw = ImageDraw.Draw(frame)
            # Pillow's default typeface keeps the optional tool portable.
            draw.text(
                (14, 355),
                "VESPERLOOM   /   SEED LAB",
                font=ImageFont.load_default(size=16),
                fill="#e1e8d8",
            )
            draw.text(
                (14, 378),
                f"SEED {settings['seed']}   /   t.me/vesperloom7",
                font=ImageFont.load_default(size=11),
                fill="#b4bfae",
            )
            draw.text(
                (485, 355),
                f"SEED DRIFT   {drift:03d}%",
                font=ImageFont.load_default(size=13),
                fill="#c5f58f",
            )
            draw.rectangle((485, 383, 623, 385), fill="#526448")
            draw.rectangle((485, 383, 485 + round(drift * 1.38), 385), fill="#c5f58f")
            palette.append(frame)
    master = palette[0].quantize(colors=168)
    imgs = [master] + [
        f.quantize(palette=master, dither=Image.Dither.FLOYDSTEINBERG) for f in palette[1:]
    ]
    loop = imgs + imgs[-2:0:-1]
    loop[0].save(
        ROOT / "docs/media/seed-drift.gif",
        save_all=True,
        append_images=loop[1:],
        duration=[650 if i in (0, len(imgs) - 1) else 170 for i in range(len(loop))],
        loop=0,
        optimize=True,
        disposal=1,
    )


if __name__ == "__main__":
    teaser()
