"""Render a gold-and-enamel medallion per rashi and nakshatra for UI cards and detail panels."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from common import (NAKSHATRAS, RASHIS, SERIF, SYMBOL, add_area_light, add_camera, add_sun_light, args, black_world,
                    enamel_material, ensure_dir, gold_material, reset_scene, set_output, setup_cycles, slug,
                    text_gold_material, text_mesh)  # noqa: E402
from wheel import annulus_sector  # noqa: E402


def blank(size, samples):
    scene = reset_scene()
    setup_cycles(scene, size, size, samples=samples, transparent=True)
    black_world(scene, strength=0.55, color=(0.2, 0.23, 0.42))
    add_camera(scene, (0, 0, 20), (0, 0, 0), ortho_scale=7.1)
    scene.camera.rotation_euler = (0, 0, 0)
    add_sun_light(scene, (35, 12, 40), energy=3.2, color=(1.0, 0.95, 0.86), angle_deg=18)
    add_area_light(scene, (-7, 6, 8), (0, 0, 0), energy=90, size=8, color=(0.72, 0.8, 1.0))
    add_area_light(scene, (7, -6, 6), (0, 0, 0), energy=110, size=6, color=(1.0, 0.8, 0.58))
    return scene


def medallion(scene, plate_color, ticks):
    gold = gold_material("Gold")
    soft = gold_material("GoldSoft", color="#c4913a", roughness=0.42)
    plate = enamel_material("Plate", plate_color)
    night = enamel_material("Night", "#090c22", roughness=0.4)
    annulus_sector(scene, "back", 0.0001, 3.5, 0, 360, -0.3, -0.05, night, seg_per_deg=1.5)
    annulus_sector(scene, "rim", 3.1, 3.5, 0, 360, -0.05, 0.28, gold, seg_per_deg=1.5, bevel=0.05)
    annulus_sector(scene, "inner", 2.84, 2.94, 0, 360, -0.05, 0.16, soft, seg_per_deg=1.5, bevel=0.02)
    annulus_sector(scene, "plate", 0.0001, 2.84, 0, 360, -0.05, 0.06, plate, seg_per_deg=1.5)
    annulus_sector(scene, "track", 2.94, 3.1, 0, 360, -0.05, 0.02, night, seg_per_deg=1.5)
    for i in range(ticks):
        a = i * 360.0 / ticks
        half = math.degrees(0.022 / 3.0)
        annulus_sector(scene, f"tick{i}", 2.94, 3.1, a - half, a + half, -0.05, 0.14, soft)
    return gold


def fit_size(text, width, base, per_char=0.56):
    return min(base, width / (per_char * max(1, len(text))))


def render(scene, path):
    set_output(scene, path, fmt="WEBP", quality=90, alpha=True)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path, flush=True)


def rashi(i, data, out, size, samples):
    key, name, western, glyph = data
    scene = blank(size, samples)
    medallion(scene, "#10204d" if i % 2 == 0 else "#172a60", 30)
    label = text_gold_material()
    text_mesh(scene, glyph, SYMBOL, 2.5, location=(0, 0.42, 0.06), extrude=0.05, material=label)
    text_mesh(scene, name, SERIF, fit_size(name, 3.7, 0.62), location=(0, -1.25, 0.06), extrude=0.018, material=label)
    text_mesh(scene, western, SERIF, 0.3, location=(0, -1.95, 0.06), extrude=0.01, material=label)
    render(scene, os.path.join(out, f"{key}.webp"))


def nakshatra(i, name, out, size, samples):
    scene = blank(size, samples)
    medallion(scene, "#1f1138" if i % 2 == 0 else "#2a1747", 27)
    label = text_gold_material()
    text_mesh(scene, str(i + 1), SERIF, 1.9, location=(0, 0.72, 0.06), extrude=0.05, material=label)
    parts = name.split(" ")
    if len(parts) == 1:
        text_mesh(scene, name, SERIF, fit_size(name, 4.2, 0.66), location=(0, -1.1, 0.06), extrude=0.018, material=label)
    else:
        text_mesh(scene, parts[0], SERIF, 0.46, location=(0, -0.72, 0.06), extrude=0.016, material=label)
        text_mesh(scene, parts[1], SERIF, fit_size(parts[1], 4.1, 0.6), location=(0, -1.45, 0.06), extrude=0.018, material=label)
    render(scene, os.path.join(out, f"{slug(name)}.webp"))


def main():
    argv = args()
    size = int(argv[0]) if argv else 512
    samples = int(argv[1]) if len(argv) > 1 else 96
    r_out = ensure_dir("rashis")
    n_out = ensure_dir("nakshatras")
    for i, data in enumerate(RASHIS):
        rashi(i, data, r_out, size, samples)
    for i, name in enumerate(NAKSHATRAS):
        nakshatra(i, name, n_out, size, samples)


main()
