"""Crop the proposed semantic atlas frames and stitch them onto a preview
montage so we can visually confirm each name → bounds mapping is correct.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / "public/assets/images/sprites/sprites-2.png"
ATLAS = ROOT / "src/config/atlas.json"
PREVIEW = ROOT / "assets/images/sprites/_atlas_preview.png"

# (x, y, w, h)
ATLAS_FRAMES: dict[str, tuple[int, int, int, int]] = {
    # ── Blocks ────────────────────────────────────────────────────────
    "block_foundation": (25, 92, 367, 148),
    "block_mid_1": (423, 78, 198, 128),
    "block_mid_2": (639, 78, 222, 127),
    "block_mid_3": (879, 78, 192, 128),
    "block_mid_4": (422, 237, 193, 125),
    "block_mid_5": (636, 237, 215, 125),
    "block_mid_6": (864, 237, 226, 125),   # COFFEE 1888
    "block_special": (1117, 77, 290, 159), # HANOI View
    "block_roof": (47, 294, 340, 144),

    # ── Parallax background layers (1 = farthest sky) ─────────────────
    # Auto-detect merged layers 2+3 because they touch. Split manually
    # at the midpoint of the wide box (x=196..518 → cut ~357).
    "bg_layer_1": (24, 551, 161, 275),
    "bg_layer_2": (196, 551, 161, 275),
    "bg_layer_3": (357, 551, 161, 275),
    "bg_layer_4": (530, 551, 174, 275),

    # ── UI: HUD panels (right column, y=623) ──────────────────────────
    "ui_score_panel": (1058, 623, 126, 73),
    "ui_combo_panel": (1214, 623, 110, 73),
    "ui_height_panel": (1381, 623, 90, 70),

    # ── UI: buttons (right column, y=739..840) ────────────────────────
    "ui_btn_play": (1058, 742, 129, 40),
    "ui_btn_replay": (1200, 739, 155, 48),
    "ui_btn_settings": (1058, 791, 129, 40),
    "ui_btn_menu": (1201, 794, 157, 46),
    "ui_btn_quit": (1058, 838, 129, 40),
    "ui_btn_pause": (1404, 778, 54, 50),

    # Sound icons moved to bottom-right in new sheet (around y=944)
    "ui_btn_sound_on": (1274, 944, 61, 40),
    "ui_btn_sound_off": (1358, 943, 57, 40),

    # ── Particles ─────────────────────────────────────────────────────
    "fx_perfect_sparkle": (740, 540, 215, 90),
    "fx_slice_debris": (740, 660, 220, 80),
    "fx_thud_dust": (755, 770, 200, 70),

    # ── SFX mini-icons (bottom-left row) ─────────────────────────────
    "sfx_icon_drop": (38, 903, 47, 52),
    "sfx_icon_thud": (120, 915, 50, 42),
    "sfx_icon_slice": (189, 911, 59, 47),
    "sfx_icon_perfect": (277, 902, 57, 59),
    "sfx_icon_combo": (357, 905, 46, 51),

    # ── Decor / props (bottom-middle row) ────────────────────────────
    "decor_potted_plant": (449, 900, 61, 90),
    "decor_gas_blue": (515, 905, 50, 75),
    "decor_gas_red": (570, 905, 50, 75),
    "decor_washing_machine": (625, 905, 60, 65),
    "decor_appliance": (700, 905, 60, 65),
    "decor_red_lantern": (778, 905, 50, 80),
    "decor_green_box": (830, 925, 55, 60),
    "decor_street_lamp": (880, 895, 70, 95),

    # ── Extra effects (bottom-right) ─────────────────────────────────
    "fx_camera_shake_lines": (985, 905, 75, 60),
    "fx_speed_lines": (1080, 910, 100, 50),
    "fx_glow": (1190, 905, 80, 60),
    "fx_star_burst": (1290, 905, 90, 65),
    "fx_confetti": (1390, 905, 130, 80),
}


def main() -> None:
    sheet = Image.open(SHEET).convert("RGBA")
    crops = []
    for name, (x, y, w, h) in ATLAS_FRAMES.items():
        crop = sheet.crop((x, y, x + w, y + h))
        crops.append((name, crop))

    cols = 4
    rows = (len(crops) + cols - 1) // cols
    cell_w = max(c.size[0] for _, c in crops) + 20
    cell_h = max(c.size[1] for _, c in crops) + 50
    montage = Image.new("RGBA", (cols * cell_w, rows * cell_h), (30, 30, 40, 255))
    draw = ImageDraw.Draw(montage)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    except OSError:
        font = ImageFont.load_default()

    for i, (name, crop) in enumerate(crops):
        cx = (i % cols) * cell_w + 10
        cy = (i // cols) * cell_h + 30
        draw.text((cx, cy - 18), name, fill=(255, 220, 120, 255), font=font)
        montage.paste(crop, (cx, cy), crop)
    montage.save(PREVIEW)
    print(f"Preview written → {PREVIEW}")

    payload = {
        "image": "public/assets/images/sprites/sprites-2.png",
        "frames": {k: {"x": v[0], "y": v[1], "w": v[2], "h": v[3]} for k, v in ATLAS_FRAMES.items()},
    }
    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    ATLAS.write_text(json.dumps(payload, indent=2))
    print(f"Atlas JSON  → {ATLAS}")
    print(f"Frames count: {len(ATLAS_FRAMES)}")


if __name__ == "__main__":
    main()
