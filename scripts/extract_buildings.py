"""Extract individual building sprites from the 2D Pixel City Pack
spritesheet (OpenGameArt, CC-BY 4.0). Auto-detects sprite bounds via
alpha channel connected components, filters tiny noise."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "_tmp_assets/city_pack.png"
OUT = ROOT / "public/assets/images/buildings"
OUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    img = Image.open(SRC).convert("RGBA")
    arr = np.asarray(img)
    alpha = arr[..., 3]
    mask = alpha > 80
    mask = binary_dilation(mask, iterations=2)
    labeled, n = label(mask)
    print(f"Detected {n} components")

    kept = []
    for i in range(1, n + 1):
        ys, xs = np.where(labeled == i)
        if ys.size < 800:  # skip tiny noise
            continue
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        # un-pad
        x0 = max(0, x0 + 2)
        y0 = max(0, y0 + 2)
        x1 = max(x0 + 1, x1 - 2)
        y1 = max(y0 + 1, y1 - 2)
        kept.append((x0, y0, x1, y1, ys.size))
    kept.sort(key=lambda b: (b[1] // 30, b[0]))
    print(f"Kept {len(kept)}")

    for idx, (x0, y0, x1, y1, area) in enumerate(kept):
        crop = img.crop((x0, y0, x1 + 1, y1 + 1))
        w, h = crop.size
        crop.save(OUT / f"city_{idx:02d}.png")
        print(f"  [{idx:02d}] x={x0} y={y0} {w}x{h} area={area}")


if __name__ == "__main__":
    main()
