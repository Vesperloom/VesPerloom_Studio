"""Train Strata-1 with NumPy only. Run from any working directory.
OPENBLAS_NUM_THREADS=1 python engine/strata/training/train.py
"""

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from corpus import FAMILIES, FEATURES, sample

ROOT = Path(__file__).resolve().parents[1]


def batch(rng, n):
    code, cond = sample(rng, n)
    t = rng.uniform(0.005, 0.995, (n, 1)).astype("f")
    a = np.cos((t + 0.008) / 1.008 * np.pi / 2).astype("f")
    s = np.sqrt(np.maximum(0, 1 - a * a))
    noise = rng.standard_normal(code.shape).astype("f")
    phase = t * (2 * np.pi * np.array([1, 2, 4, 8], dtype="f"))
    x = np.concatenate([a * code + s * noise, cond, np.sin(phase), np.cos(phase), a, s], 1)
    return x, noise


def act(x):
    sig = 1 / (1 + np.exp(-np.clip(x, -35, 35)))
    return x * sig, sig * (1 + x * (1 - sig))


def forward(p, x):
    h1, d1 = act(x @ p[0] + p[1])
    h2, d2 = act(h1 @ p[2] + p[3])
    y = h2 @ p[4] + p[5]
    return y, (x, h1, h2, d1, d2)


def train(steps, out):
    rng = np.random.default_rng(72891)
    dims = [34, 96, 96, 20]
    p = []
    for a, b in zip(dims, dims[1:]):
        p.extend([(rng.normal(size=(a, b)) * np.sqrt(1.5 / a)).astype("f"), np.zeros(b, "f")])
    m = [np.zeros_like(w) for w in p]
    v = [np.zeros_like(w) for w in p]
    for i in range(1, steps + 1):
        x, noise = batch(rng, 128)
        y, cache = forward(p, x)
        x, h1, h2, d1, d2 = cache
        dy = 2 * (y - noise) / y.size
        db = (dy @ p[4].T) * d2
        da = (db @ p[2].T) * d1
        grads = [x.T @ da, da.sum(0), h1.T @ db, db.sum(0), h2.T @ dy, dy.sum(0)]
        lr = 0.0016 * (0.12 + 0.88 * (1 + np.cos(np.pi * i / steps)) / 2)
        for k, g in enumerate(grads):
            m[k] = 0.9 * m[k] + 0.1 * g
            v[k] = 0.999 * v[k] + 0.001 * g * g
            p[k] -= lr * (m[k] / (1 - 0.9**i)) / (np.sqrt(v[k] / (1 - 0.999**i)) + 1e-8)
    x, noise = batch(np.random.default_rng(5017), 4096)
    y, _ = forward(p, x)
    out.mkdir(parents=True, exist_ok=True)
    layers = []
    for k, name in enumerate(["condition", "hidden", "epsilon"]):
        w, b = p[2 * k : 2 * k + 2]
        data = np.concatenate([w.ravel(), b]).astype("<f4").tobytes()
        filename = name + ".f32"
        (out / filename).write_bytes(data)
        layers.append(
            dict(
                file=filename,
                shape=list(w.shape),
                sha256=hashlib.sha256(data).hexdigest(),
            )
        )
    card = dict(
        format="strata-mlp-v1",
        version="1.0.0",
        features=FEATURES,
        families=FAMILIES,
        activation="silu",
        layers=layers,
        parameters=int(sum(w.size for w in p)),
        training=dict(
            seed=72891,
            steps=steps,
            batch=128,
            validation_seed=5017,
            validation_examples=4096,
            epsilon_mse=round(float(((y - noise) ** 2).mean()), 6),
            zero_predictor_mse=round(float((noise**2).mean()), 6),
        ),
    )
    (out / "checkpoint.json").write_text(json.dumps(card, indent=2) + "\n")
    print(json.dumps(card["training"]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--steps", type=int, default=4200)
    ap.add_argument("--out", type=Path, default=ROOT / "weights")
    args = ap.parse_args()
    if args.steps < 1:
        ap.error("steps must be positive")
    train(args.steps, args.out)
