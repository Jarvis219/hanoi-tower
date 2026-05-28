"""Generate PWA icons from the sprite sheet.

We pick the SPECIAL block (HANOI View LED storefront) as the most visually
striking icon source. Outputs:
  - public/icons/icon-192.png    (standard PWA icon, 192x192)
  - public/icons/icon-512.png    (large icon, 512x512)
  - public/icons/icon-maskable.png  (512x512 with safe-zone padding)
  - public/favicon.svg            (simple SVG fallback)
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/images/sprites/sprites-2.png"
OUT = ROOT / "public/icons"
OUT.mkdir(parents=True, exist_ok=True)

# Coords from atlas.ts (block_special)
SRC_X, SRC_Y, SRC_W, SRC_H = 1117, 77, 290, 159

# Brand background gradient
BG_TOP = (15, 52, 96)
BG_BOTTOM = (26, 26, 46)


def render_background(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size))
    pix = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        r = int(BG_TOP[0] * (1 - t) + BG_BOTTOM[0] * t)
        g = int(BG_TOP[1] * (1 - t) + BG_BOTTOM[1] * t)
        b = int(BG_TOP[2] * (1 - t) + BG_BOTTOM[2] * t)
        for x in range(size):
            pix[x, y] = (r, g, b)
    return img


def build_icon(out_path: Path, size: int, safe_inset: int = 0) -> None:
    """Compose the sprite-on-background icon at the requested size.
    `safe_inset` reserves padding for maskable icons (W3C: 80% safe zone)."""
    bg = render_background(size).convert("RGBA")
    sheet = Image.open(SHEET).convert("RGBA")
    sprite = sheet.crop((SRC_X, SRC_Y, SRC_X + SRC_W, SRC_Y + SRC_H))

    # Fit sprite into the safe area while preserving aspect.
    avail = size - safe_inset * 2
    scale = min(avail / SRC_W, (avail * 0.8) / SRC_H)
    nw = max(1, int(SRC_W * scale))
    nh = max(1, int(SRC_H * scale))
    sprite = sprite.resize((nw, nh), Image.NEAREST)

    # Drop shadow (subtle)
    shadow = Image.new("RGBA", (nw + 24, nh + 24), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle([6, 6, nw + 18, nh + 18], radius=18, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(8))
    sx = (size - shadow.size[0]) // 2
    sy = int((size - shadow.size[1]) * 0.45)
    bg.alpha_composite(shadow, (sx, sy))

    px = (size - nw) // 2
    py = int((size - nh) * 0.4)
    bg.alpha_composite(sprite, (px, py))

    # Title strip at bottom
    draw = ImageDraw.Draw(bg)
    strip_h = max(20, size // 8)
    draw.rectangle([0, size - strip_h, size, size], fill=(242, 204, 143, 200))
    bg.save(out_path, "PNG", optimize=True)
    print(f"Wrote {out_path} ({size}x{size})")


def build_favicon_svg() -> None:
    svg = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f3460"/>
      <stop offset="1" stop-color="#1a1a2e"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="10" fill="url(#g)"/>
  <g fill="#f2cc8f">
    <rect x="16" y="44" width="32" height="12" rx="2"/>
    <rect x="20" y="32" width="24" height="10" rx="1.5"/>
    <rect x="24" y="22" width="16" height="8" rx="1.5"/>
    <rect x="28" y="14" width="8" height="6" rx="1"/>
  </g>
</svg>"""
    (ROOT / "public/favicon.svg").write_text(svg)
    print("Wrote public/favicon.svg")


def main() -> None:
    build_icon(OUT / "icon-192.png", 192, safe_inset=8)
    build_icon(OUT / "icon-512.png", 512, safe_inset=16)
    build_icon(OUT / "icon-maskable.png", 512, safe_inset=72)
    build_favicon_svg()


if __name__ == "__main__":
    main()
