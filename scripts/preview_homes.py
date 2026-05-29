"""Stitch a montage of every (theme, block) crop from homes.png so we can
visually confirm the bounds in `src/config/atlas.ts` match the source art.

Mirror of `preview_atlas.py` — keep the constants here in sync with
`HOME_THEME_RECT` and `HOME_BLOCK_ROWS` in `src/config/atlas.ts`.

Run:
    python3 scripts/preview_homes.py

Output:
    assets/images/sprites/_homes_preview.png
"""

from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/images/sprites/homes.png"
PREVIEW = ROOT / "assets/images/sprites/_homes_preview.png"
TOWER_PREVIEW = ROOT / "assets/images/sprites/_homes_tower_preview.png"

# Per-theme tight column rectangles (must match HOME_THEME_RECT in atlas.ts)
HOME_THEME_RECT: dict[str, dict[str, int]] = {
    "hanoi": {"x": 75, "w": 189},
    "hue": {"x": 299, "w": 197},
    "danang": {"x": 531, "w": 189},
    "saigon": {"x": 760, "w": 198},
}

# Y bands (must match HOME_BLOCK_ROWS in atlas.ts)
HOME_BLOCK_ROWS: dict[str, tuple[int, int]] = {
    "block_mid_1": (57, 66),
    "block_mid_2": (138, 65),
    "block_mid_3": (219, 63),
    "block_mid_4": (298, 65),
    "block_special": (377, 60),
    "block_mid_5": (461, 37),
    "block_mid_6": (515, 61),
    "block_foundation": (590, 68),
}

# Per-theme overrides — Đà Nẵng's storefront sign and apartment are swapped
# vs other themes (see atlas.ts HOME_BLOCK_ROW_OVERRIDES).
HOME_BLOCK_ROW_OVERRIDES: dict[str, dict[str, tuple[int, int]]] = {
    "danang": {
        "block_special": (298, 65),
        "block_mid_4": (377, 60),
    },
}


def resolve_band(theme: str, key: str) -> tuple[int, int]:
    return HOME_BLOCK_ROW_OVERRIDES.get(theme, {}).get(key, HOME_BLOCK_ROWS[key])

# Game-block target proportions for the tower-stack preview
GAME_BLOCK_W = 220
GAME_BLOCK_H = 70


def load_font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except OSError:
        return ImageFont.load_default()


def render_grid_preview(sheet: Image.Image) -> None:
    """Grid view: one row per block type, one column per theme. Sky-blue
    background so any leftover transparent gutters are visible."""
    pad = 24
    label_w = 140
    themes = list(HOME_THEME_RECT.keys())
    max_w = max(r["w"] for r in HOME_THEME_RECT.values())
    max_h = max(h for _, h in HOME_BLOCK_ROWS.values())
    cell_gap = 16
    row_gap = 14

    canvas_w = pad * 2 + label_w + (max_w + cell_gap) * len(themes)
    canvas_h = pad * 2 + 40 + (max_h + row_gap) * len(HOME_BLOCK_ROWS)
    canvas = Image.new("RGB", (canvas_w, canvas_h), (24, 26, 46))
    draw = ImageDraw.Draw(canvas)
    font = load_font(14)
    font_small = load_font(11)

    for ti, theme in enumerate(themes):
        r = HOME_THEME_RECT[theme]
        x = pad + label_w + ti * (max_w + cell_gap)
        draw.text(
            (x + 4, pad + 4),
            f"{theme.upper()}  x={r['x']} w={r['w']}",
            fill=(242, 204, 143),
            font=font,
        )

    y_cursor = pad + 40
    for base_key in HOME_BLOCK_ROWS.keys():
        default_y, default_h = HOME_BLOCK_ROWS[base_key]
        draw.text(
            (pad, y_cursor + max_h // 2 - 14),
            f"{base_key}\ndefault y={default_y}, h={default_h}",
            fill=(220, 220, 220),
            font=font_small,
        )
        for ti, theme in enumerate(themes):
            r = HOME_THEME_RECT[theme]
            y, h = resolve_band(theme, base_key)
            crop = sheet.crop((r["x"], y, r["x"] + r["w"], y + h))
            cell_x = pad + label_w + ti * (max_w + cell_gap)
            bg = Image.new("RGB", (max_w, max_h + 4), (135, 206, 235))
            ox = (max_w - r["w"]) // 2
            bg.paste(crop, (ox, 0), crop)
            canvas.paste(bg, (cell_x, y_cursor))
            draw.rectangle(
                (cell_x - 1, y_cursor - 1, cell_x + max_w, y_cursor + max_h + 4),
                outline=(100, 100, 140),
            )
        y_cursor += max_h + row_gap

    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(PREVIEW)
    print(f"Grid preview  → {PREVIEW}  ({canvas.size[0]}x{canvas.size[1]})")


def render_tower_preview(sheet: Image.Image) -> None:
    """Tower stack: each theme assembled as a vertical stack of blocks at
    game-block proportions, so we can preview how they'll actually render
    in-game when the player picks that theme."""
    themes = list(HOME_THEME_RECT.keys())
    col_gap = 30
    canvas = Image.new(
        "RGB",
        ((GAME_BLOCK_W + col_gap) * len(themes) + col_gap,
         GAME_BLOCK_H * (len(HOME_BLOCK_ROWS) + 1) + 40),
        (135, 206, 235),
    )
    draw = ImageDraw.Draw(canvas)
    font = load_font(14)
    for ti, theme in enumerate(themes):
        r = HOME_THEME_RECT[theme]
        col_x = col_gap + ti * (GAME_BLOCK_W + col_gap)
        draw.text((col_x + 4, 4), theme.upper(), fill=(20, 20, 60), font=font)
        y_bottom = canvas.height - 10
        for base_key in HOME_BLOCK_ROWS.keys():
            y, h = resolve_band(theme, base_key)
            crop = sheet.crop((r["x"], y, r["x"] + r["w"], y + h))
            scaled = crop.resize((GAME_BLOCK_W, GAME_BLOCK_H), Image.BILINEAR)
            canvas.paste(scaled, (col_x, y_bottom - GAME_BLOCK_H), scaled)
            y_bottom -= GAME_BLOCK_H

    TOWER_PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(TOWER_PREVIEW)
    print(f"Tower preview → {TOWER_PREVIEW}  ({canvas.size[0]}x{canvas.size[1]})")


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    render_grid_preview(sheet)
    render_tower_preview(sheet)
    print(f"Themes: {len(HOME_THEME_RECT)}  Blocks per theme: {len(HOME_BLOCK_ROWS)}")
    print(f"Total frames: {len(HOME_THEME_RECT) * len(HOME_BLOCK_ROWS)}")


if __name__ == "__main__":
    main()
