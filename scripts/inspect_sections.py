"""Crop the bottom-half sections of sprites-2.png at 1x size so we can
visually pin down each small sprite (particles, SFX icons, decor, FX).
"""

from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/images/sprites/sprites-2.png"
OUT = ROOT / "assets/images/sprites/_crops"
OUT.mkdir(exist_ok=True)

# (name, left, top, right, bottom) — coarse section bounds based on layout.
SECTIONS = [
    ("V2_S1_particles", 720, 470, 1040, 830),
    ("V2_S2_sfx_icons", 0, 880, 470, 1010),
    ("V2_S3_decor", 430, 880, 970, 1010),
    ("V2_S4_extra_effects", 970, 880, 1535, 1010),
]


def main() -> None:
    sheet = Image.open(SHEET).convert("RGB")
    for name, l, t, r, b in SECTIONS:
        crop = sheet.crop((l, t, r, b))
        # Draw a 50px grid overlay to read pixel offsets at a glance
        marked = crop.copy()
        d = ImageDraw.Draw(marked)
        for gx in range(0, r - l, 25):
            d.line([(gx, 0), (gx, b - t)], fill=(255, 0, 0, 80), width=1)
            if gx % 100 == 0:
                d.text((gx + 2, 2), str(l + gx), fill=(255, 80, 80))
        for gy in range(0, b - t, 25):
            d.line([(0, gy), (r - l, gy)], fill=(0, 200, 255, 80), width=1)
            if gy % 100 == 0:
                d.text((2, gy + 2), str(t + gy), fill=(80, 200, 255))
        marked.save(OUT / f"{name}_grid.png")
        crop.save(OUT / f"{name}.png")
        print(f"{name}: {crop.size} → x={l}..{r} y={t}..{b}")


if __name__ == "__main__":
    main()
