"""Background art: starfield/nebula plates, the sky-view panorama and the navagraha hero scene."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from common import (add_area_light, add_camera, add_sun_light, args, ensure_dir, hex_rgb, math_node, mix_color, noise,
                    ramp, reset_scene, set_output, setup_cycles, tex_coord)  # noqa: E402
from grahas import build_graha  # noqa: E402
from wheel import build_wheel  # noqa: E402


def star_layer(nt, coord, scale, threshold, power):
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.voronoi_dimensions = "3D"
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = scale
    nt.links.new(coord, vor.inputs["Vector"])
    core = ramp(nt, vor.outputs["Distance"], [(0.0, "#ffffff"), (threshold, "#000000")])
    rnd = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(vor.outputs["Color"], rnd.inputs[0])
    bright = math_node(nt, "POWER", rnd.outputs[0], power)
    tint = mix_color(nt, rnd.outputs[1], hex_rgb("#ffd9a8"), hex_rgb("#bcd3ff"))
    return mix_color(nt, math_node(nt, "MULTIPLY", core, bright), (0, 0, 0), tint)


def nebula_world(scene, strength=1.0, stars=1.0, seed=0.0):
    world = bpy.data.worlds.new("Cosmos")
    scene.world = world
    nt = world.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    coord = tex_coord(nt, "Generated")
    offset = nt.nodes.new("ShaderNodeVectorMath")
    offset.operation = "ADD"
    offset.inputs[1].default_value = (seed, seed * 0.7, seed * 1.3)
    nt.links.new(coord, offset.inputs[0])
    vec = offset.outputs["Vector"]

    clouds = noise(nt, vec, scale=1.7, detail=13.0, roughness=0.58, distortion=0.75)
    wisps = noise(nt, vec, scale=4.5, detail=12.0, roughness=0.6, distortion=1.6)
    density = math_node(nt, "ADD", math_node(nt, "MULTIPLY", clouds, 0.72), math_node(nt, "MULTIPLY", wisps, 0.28))
    col = ramp(nt, density, [
        (0.36, "#020208"), (0.46, "#0a0a26"), (0.54, "#1c1450"), (0.6, "#44206e"),
        (0.66, "#8a2f6c"), (0.72, "#c95a52"), (0.79, "#f0b070"),
    ])
    z = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord, z.inputs[0])
    band = math_node(nt, "POWER", math_node(nt, "SUBTRACT", 1.0, math_node(nt, "ABSOLUTE", z.outputs["Z"])), 2.2)
    base = mix_color(nt, math_node(nt, "ADD", math_node(nt, "MULTIPLY", band, 0.75), 0.25), (0.002, 0.002, 0.006), col)

    fine = star_layer(nt, vec, 200.0, 0.05, 4.0)
    mid = star_layer(nt, vec, 70.0, 0.04, 7.0)
    big = star_layer(nt, vec, 22.0, 0.028, 12.0)
    glow = mix_color(nt, 1.0, fine, mid, blend="ADD")
    glow = mix_color(nt, 1.0, glow, big, blend="ADD")
    scaled = nt.nodes.new("ShaderNodeVectorMath")
    scaled.operation = "SCALE"
    scaled.inputs["Scale"].default_value = 28.0 * stars
    nt.links.new(glow, scaled.inputs[0])
    final = mix_color(nt, 1.0, base, scaled.outputs["Vector"], blend="ADD")
    nt.links.new(final, bg.inputs["Color"])
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs["Surface"])
    return world


def plate(name, width, height, samples, location, target, lens, strength, stars, seed, out_dir, quality=86):
    scene = reset_scene()
    setup_cycles(scene, width, height, samples=samples, transparent=False)
    scene.cycles.use_denoising = False
    nebula_world(scene, strength=strength, stars=stars, seed=seed)
    add_camera(scene, location, target, lens=lens)
    path = os.path.join(out_dir, f"{name}.webp")
    set_output(scene, path, fmt="WEBP", quality=quality, alpha=False)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path, flush=True)


def skybox(out_dir, width, samples):
    scene = reset_scene()
    setup_cycles(scene, width, width // 2, samples=samples, transparent=False)
    scene.cycles.use_denoising = False
    nebula_world(scene, strength=1.0, stars=1.0, seed=3.3)
    cam = add_camera(scene, (0, 0, 0), (0, 1, 0), lens=30)
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    cam.rotation_euler = (math.radians(90), 0, 0)
    path = os.path.join(out_dir, "sky-equirect.webp")
    set_output(scene, path, fmt="WEBP", quality=88, alpha=False)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path, flush=True)


def hero(out_dir, width, height, samples, name="navagraha-hero", lens=48):
    scene = reset_scene()
    setup_cycles(scene, width, height, samples=samples, transparent=False)
    nebula_world(scene, strength=0.9, stars=0.8, seed=7.1)
    build_wheel(scene)

    # Eight grahas circle the wheel; Rahu and Ketu sit exactly opposite each other, as the lunar nodes do.
    layout = {
        "guru": (250, 8.6, 1.25, 2.7),
        "mangala": (300, 8.0, 0.68, 2.2),
        "rahu": (345, 8.4, 0.8, 2.3),
        "shani": (35, 8.0, 0.9, 2.9),
        "budha": (85, 8.4, 0.55, 2.4),
        "shukra": (125, 8.2, 0.78, 2.6),
        "ketu": (165, 8.4, 0.62, 2.3),
        "chandra": (205, 8.6, 0.85, 2.6),
    }
    for graha, (angle, radius, size, height_z) in layout.items():
        a = math.radians(angle)
        build_graha(scene, graha, (radius * math.cos(a), radius * math.sin(a), height_z), size)
    surya = build_graha(scene, "surya", (0, 0, 3.6), 1.9)
    surya.visible_shadow = False
    bsdf = next(n for n in surya.active_material.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    bsdf.inputs["Emission Strength"].default_value = 0.85

    sun_data = bpy.data.lights.new("SuryaLight", "POINT")
    sun_data.energy = 1400
    sun_data.color = hex_rgb("#ffb066")
    sun_data.shadow_soft_size = 1.6
    sun = bpy.data.objects.new("SuryaLight", sun_data)
    scene.collection.objects.link(sun)
    sun.location = (0, 0, 3.6)

    add_sun_light(scene, (50, 10, 30), energy=1.1, color=(0.85, 0.88, 1.0), angle_deg=18)
    add_area_light(scene, (-16, -14, 8), (0, 0, 0), energy=500, size=14, color=(0.7, 0.75, 1.0))

    add_camera(scene, (3.5, -29, 11.5), (0, 0, 1.6), lens=lens)
    scene.camera.data.dof.use_dof = True
    scene.camera.data.dof.focus_distance = 30.0
    scene.camera.data.dof.aperture_fstop = 5.6
    path = os.path.join(out_dir, f"{name}.webp")
    set_output(scene, path, fmt="WEBP", quality=88, alpha=False)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path, flush=True)


def main():
    argv = args()
    scale = float(argv[0]) if argv else 1.0
    samples = int(argv[1]) if len(argv) > 1 else 128
    which = argv[2].split(",") if len(argv) > 2 else ["plates", "sky", "hero"]
    out = ensure_dir("backgrounds")
    if "plates" in which:
        plate("cosmos-desktop", int(2560 * scale), int(1440 * scale), samples, (0, -20, 3), (3, 0, 1), 38, 1.0, 1.0, 1.9, out)
        plate("cosmos-mobile", int(1080 * scale), int(1920 * scale), samples, (0, -20, 3), (-2, 0, 1), 45, 1.0, 1.0, 5.2, out)
    if "sky" in which:
        skybox(out, int(4096 * scale), samples)
    if "hero" in which:
        hero(out, int(2560 * scale), int(1440 * scale), samples)
        hero(out, int(1080 * scale), int(1920 * scale), samples, name="navagraha-hero-mobile", lens=29)


main()
