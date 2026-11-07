"""Render a transparent portrait of each graha to assets/3d/grahas/<name>.webp."""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

from common import (GRAHAS, add_area_light, add_camera, add_sun_light, args, black_world, ensure_dir, glow_shell,
                    hex_rgb, math_node, new_material, noise, reset_scene, set_output, setup_cycles, tex_coord,
                    uv_sphere)  # noqa: E402
from grahas import ATMOSPHERE, ROTATION, add_ring, shani_ring_material, surface_material  # noqa: E402


def ketu_tail(scene):
    """Smoky comet tail for Ketu, trailing up and to the right."""
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.92, radius2=0.06, depth=3.3, location=(1.02, 1.2, 1.26))
    obj = bpy.context.active_object
    obj.rotation_euler = (0, math.radians(39), 0)
    bpy.ops.object.shade_smooth()
    mat, nt, out = new_material("ketu_tail")
    coord = tex_coord(nt, "Generated")
    z = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(coord, z.inputs[0])
    wisps = noise(nt, tex_coord(nt, "Object"), scale=2.2, detail=9.0, roughness=0.6, distortion=2.0)
    fade = math_node(nt, "POWER", math_node(nt, "SUBTRACT", 1.0, z.outputs["Z"]), 2.2)
    alpha = math_node(nt, "MULTIPLY", fade, math_node(nt, "POWER", wisps, 3.0))
    alpha = math_node(nt, "MULTIPLY", alpha, 1.6, clamp=True)
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*hex_rgb("#7fd6d0"), 1)
    emit.inputs["Strength"].default_value = 1.6
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(alpha, mix.inputs[0])
    nt.links.new(transp.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    obj.data.materials.append(mat)
    obj.visible_shadow = False
    return obj


def render(name, out_dir, size, samples):
    scene = reset_scene()
    setup_cycles(scene, size, size, samples=samples, transparent=True)
    black_world(scene, strength=0.015, color=(0.5, 0.55, 1.0))

    planet = uv_sphere(scene, name, radius=1.0)
    planet.data.materials.append(surface_material(name))
    tilt = ROTATION.get(name, 8)
    planet.rotation_euler = (math.radians(tilt), math.radians(-tilt / 2), math.radians(35))

    colour, strength, shell_scale, power = ATMOSPHERE[name]
    extra = {"max_alpha": 0.85, "rim_falloff": 9.0} if name == "rahu" else {}
    glow_shell(scene, f"{name}_atmo", 1.0, shell_scale, colour, strength=strength, power=power, **extra)

    frame = 2.9
    if name == "surya":
        frame = 3.4
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    if name == "shani":
        frame = 5.4
        ring = add_ring(scene, "shani_ring", 1.35, 2.35, shani_ring_material())
        ring.rotation_euler = (math.radians(20), math.radians(-16), 0)
        planet.rotation_euler = (math.radians(20), math.radians(-16), 0)
    if name == "ketu":
        frame = 5.2
        ketu_tail(scene)

    # Camera on -Y looking at the origin; orthographic-feel long lens.
    distance = 14.0
    lens = 36 * distance / frame
    target = (0, 0, 0)
    add_camera(scene, (target[0], -distance, target[2]), target, lens=lens)

    if name != "surya":
        key_rot = (62, 18, 48)
        energy = 3.4
        if name == "rahu":
            energy = 0.15
        add_sun_light(scene, key_rot, energy=energy, color=(1.0, 0.95, 0.88), angle_deg=14)
        add_area_light(scene, (-5, -5, -2), (0, 0, 0), energy=70 if name != "rahu" else 2, size=8,
                       color=hex_rgb(ATMOSPHERE[name][0]))

    path = os.path.join(out_dir, f"{name}.webp")
    set_output(scene, path, fmt="WEBP", quality=90, alpha=True)
    bpy.ops.render.render(write_still=True)
    print("RENDERED", path, flush=True)


def main():
    argv = args()
    size = int(argv[0]) if argv else 1024
    samples = int(argv[1]) if len(argv) > 1 else 192
    names = argv[2].split(",") if len(argv) > 2 else GRAHAS
    out_dir = ensure_dir("grahas")
    for name in names:
        render(name, out_dir, size, samples)


main()
