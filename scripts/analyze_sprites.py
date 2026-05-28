"""Auto-detect sprite bounding boxes in the design mockup sheet.

Reads the canonical sprite sheet (sprites-2.png), uses its alpha channel
to separate sprites from the transparent background, then merges nearby
boxes via dilation and filters by area / aspect ratio. Outputs:
  - assets/images/sprites/atlas_auto.json  (machine-readable bounds)
  - assets/images/sprites/_debug_boxes.png (visual overlay)
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, label

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/images/sprites/sprites-2.png"
OUT_JSON = ROOT / "assets/images/sprites/atlas_auto.json"
OUT_DEBUG = ROOT / "assets/images/sprites/_debug_boxes.png"

ALPHA_THRESHOLD = 128
MIN_AREA = 1500
DILATION_ITERATIONS = 3
MAX_FRACTION_OF_SHEET = 0.55


def detect_boxes() -> list[dict]:
    img = Image.open(SHEET).convert("RGBA")
    arr = np.asarray(img)
    # Use alpha channel: background is transparent (alpha=0), sprites opaque.
    alpha = arr[..., 3]
    mask = alpha > ALPHA_THRESHOLD
    mask = binary_dilation(mask, iterations=DILATION_ITERATIONS)
    labeled, n = label(mask)
    print(f"Found {n} raw components")

    W, H = arr.shape[1], arr.shape[0]
    boxes: list[dict] = []
    for i in range(1, n + 1):
        ys, xs = np.where(labeled == i)
        if ys.size < MIN_AREA:
            continue
        x0, x1 = int(xs.min()), int(xs.max())
        y0, y1 = int(ys.min()), int(ys.max())
        x0 = max(0, x0 + DILATION_ITERATIONS)
        y0 = max(0, y0 + DILATION_ITERATIONS)
        x1 = max(x0, x1 - DILATION_ITERATIONS)
        y1 = max(y0, y1 - DILATION_ITERATIONS)
        w, h = x1 - x0 + 1, y1 - y0 + 1
        if w > W * MAX_FRACTION_OF_SHEET and h > H * MAX_FRACTION_OF_SHEET:
            continue  # sheet-spanning border/panel
        # Reject divider lines (very thin in one axis)
        if w < 10 or h < 10:
            continue
        # Reject extremely thin strips
        aspect = max(w, h) / max(1, min(w, h))
        if aspect > 25:
            continue
        boxes.append({"x": x0, "y": y0, "w": w, "h": h, "area": int(ys.size)})

    # sort by y then x (reading order)
    boxes.sort(key=lambda b: (b["y"] // 20, b["x"]))
    return boxes


def draw_debug(boxes: list[dict]) -> None:
    img = Image.open(SHEET).convert("RGB")
    draw = ImageDraw.Draw(img)
    for i, b in enumerate(boxes):
        draw.rectangle(
            [(b["x"], b["y"]), (b["x"] + b["w"], b["y"] + b["h"])],
            outline=(255, 0, 0),
            width=3,
        )
        draw.text((b["x"] + 4, b["y"] + 4), str(i), fill=(255, 255, 0))
    img.save(OUT_DEBUG)


def main() -> None:
    boxes = detect_boxes()
    print(f"Kept {len(boxes)} boxes after filtering")
    payload = {
        "image": "public/assets/images/sprites/sprites-2.png",
        "size": Image.open(SHEET).size,
        "frames": boxes,
    }
    OUT_JSON.write_text(json.dumps(payload, indent=2))
    draw_debug(boxes)
    print(f"Wrote {OUT_JSON}")
    print(f"Wrote {OUT_DEBUG}")
    for i, b in enumerate(boxes):
        print(f"  [{i:2d}] x={b['x']:4d} y={b['y']:4d} w={b['w']:4d} h={b['h']:4d}")


if __name__ == "__main__":
    main()
