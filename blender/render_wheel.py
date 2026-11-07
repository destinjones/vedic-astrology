"""Render the rashi/nakshatra wheel: an exact top-down plate and a 3/4 hero shot."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from common import (add_area_light, add_camera, add_sun_light, args, black_world, ensure_dir, reset_scene, set_output,
                    setup_cycles)  # noqa: E402
from wheel import build_wheel  # noqa: E402


def lights(scene):
    add_sun_light(scene, (35, 12, 40), energy=3.2, color=(1.0, 0.95, 0.86), angle_deg=18)
    add_area_light(scene, (-14, 10, 12), (0, 0, 0), energy=260, size=14, color=(0.72, 0.8, 1.0))
    add_area_light(scene, (14, -12, 9), (0, 0, 0), energy=320, size=10, color=(1.0, 0.8, 0.58))


def add_env(scene):
    """Soft gradient world so the gold has something to reflect."""
    world = black_world(scene, strength=0.5, color=(0.2, 0.23, 0.42))
    return world


def main():
    argv = args()
    size = int(argv[0]) if argv else 2048
    samples = int(argv[1]) if len(argv) > 1 else 192
    which = argv[2] if len(argv) > 2 else "top,hero"
    out = ensure_dir("wheel")

    scene = reset_scene()
    setup_cycles(scene, size, size, samples=samples, transparent=True)
    add_env(scene)
    build_wheel(scene)
    lights(scene)

    if "top" in which:
        add_camera(scene, (0, 0, 40), (0, 0, 0), ortho_scale=20.4)
        # Keep +Y up in frame so 0 deg Aries lands exactly at 3 o'clock.
        scene.camera.rotation_euler = (0, 0, 0)
        path = os.path.join(out, "wheel-top.webp")
        set_output(scene, path, fmt="WEBP", quality=92, alpha=True)
        bpy.ops.render.render(write_still=True)
        print("RENDERED", path, flush=True)

    if "hero" in which:
        scene.render.resolution_x = int(size * 1.25)
        scene.render.resolution_y = int(size * 0.75)
        add_camera(scene, (5, -25, 15), (0, 0, -0.5), lens=46)
        scene.camera.data.dof.use_dof = True
        scene.camera.data.dof.focus_distance = 29.5
        scene.camera.data.dof.aperture_fstop = 5.6
        path = os.path.join(out, "wheel-hero.webp")
        set_output(scene, path, fmt="WEBP", quality=90, alpha=True)
        bpy.ops.render.render(write_still=True)
        print("RENDERED", path, flush=True)


main()
