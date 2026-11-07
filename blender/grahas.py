"""Procedural surface materials for the nine grahas.

Each builder returns a dict of sockets {color, roughness, emission, bump, metallic}
so the same surface drives both Cycles renders and the glTF texture bakes.
"""
import math

import bpy

from common import (glow_shell, hex_rgb, math_node, mix_color, new_material, noise, ramp, separate_z, tex_coord, uv_sphere)


def latitude_bands(nt, coord, warp=0.08, warp_scale=3.0):
    """Z coordinate with turbulence, returns 0..1 for band ramps."""
    wobble = noise(nt, coord, scale=warp_scale, detail=6.0, roughness=0.55)
    z = separate_z(nt, coord)["Z"]
    shifted = math_node(nt, "ADD", z, math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", wobble, 0.5), warp))
    return math_node(nt, "ADD", math_node(nt, "MULTIPLY", shifted, 0.5), 0.5)


def surya(nt):
    coord = tex_coord(nt)
    warp = noise(nt, coord, scale=2.4, detail=10.0, roughness=0.6, distortion=1.2)
    cells = noise(nt, coord, scale=11.0, detail=12.0, roughness=0.62, distortion=2.0 * 1.2)
    mixed = math_node(nt, "ADD", math_node(nt, "MULTIPLY", warp, 0.42), math_node(nt, "MULTIPLY", cells, 0.58))
    color = ramp(nt, mixed, [(0.28, "#6e1605"), (0.42, "#d9420c"), (0.52, "#ff9413"), (0.62, "#ffd451"), (0.74, "#fff4c4")])
    return {"color": color, "emission": color, "emission_strength": 1.5, "roughness": 1.0}


def chandra(nt):
    coord = tex_coord(nt)
    maria = noise(nt, coord, scale=1.9, detail=9.0, roughness=0.58, distortion=0.25)
    fine = noise(nt, coord, scale=26.0, detail=10.0, roughness=0.65)
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "F1"
    vor.inputs["Scale"].default_value = 15.0
    nt.links.new(coord, vor.inputs["Vector"])
    craters = ramp(nt, vor.outputs["Distance"], [(0.02, "#000000"), (0.09, "#ffffff"), (0.13, "#7f7f7f")])
    col = ramp(nt, maria, [(0.36, "#6c6f7c"), (0.5, "#b9b8bb"), (0.62, "#e9e4d8")])
    col = mix_color(nt, math_node(nt, "MULTIPLY", fine, 0.22), col, (1.0, 0.98, 0.92))
    col = mix_color(nt, math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", 1.0, craters), 0.55), col, (0.16, 0.16, 0.2))
    bump = math_node(nt, "ADD", math_node(nt, "MULTIPLY", craters, 0.5), math_node(nt, "MULTIPLY", fine, 0.5))
    return {"color": col, "roughness": 0.85, "bump": bump, "bump_strength": 0.9}


def mangala(nt):
    coord = tex_coord(nt)
    region = noise(nt, coord, scale=2.2, detail=9.0, roughness=0.6, distortion=0.7)
    fine = noise(nt, coord, scale=18.0, detail=10.0, roughness=0.62)
    col = ramp(nt, region, [(0.3, "#2d0f0c"), (0.43, "#7c2410"), (0.54, "#bd4a1d"), (0.66, "#e08a4a")])
    z = separate_z(nt, coord)["Z"]
    edge = math_node(nt, "ABSOLUTE", math_node(nt, "ADD", z, math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", region, 0.5), 0.12)))
    cap = ramp(nt, edge, [(0.93, "#000000"), (0.965, "#ffffff")])
    col = mix_color(nt, cap, col, (0.9, 0.84, 0.78))
    return {"color": col, "roughness": 0.82, "bump": fine, "bump_strength": 0.3}


def budha(nt):
    # Emerald-tinted rocky world (Budha's traditional gemstone is emerald).
    coord = tex_coord(nt)
    region = noise(nt, coord, scale=3.2, detail=10.0, roughness=0.62, distortion=0.45)
    fine = noise(nt, coord, scale=30.0, detail=9.0, roughness=0.65)
    col = ramp(nt, region, [(0.3, "#0d2c25"), (0.45, "#1f6e52"), (0.56, "#6cae80"), (0.68, "#d3cf9f")])
    return {"color": col, "roughness": 0.68, "bump": fine, "bump_strength": 0.28}


def guru(nt):
    coord = tex_coord(nt)
    bands = latitude_bands(nt, coord, warp=0.16, warp_scale=4.0)
    fine = noise(nt, coord, scale=13.0, detail=10.0, roughness=0.6, distortion=1.0)
    bands = math_node(nt, "ADD", bands, math_node(nt, "MULTIPLY", math_node(nt, "SUBTRACT", fine, 0.5), 0.05))
    col = ramp(nt, bands, [
        (0.08, "#6e4b28"), (0.2, "#c79b60"), (0.3, "#f0dcab"), (0.38, "#b47c43"), (0.46, "#f6e8c4"),
        (0.56, "#d6a360"), (0.63, "#9a5f30"), (0.72, "#efd9a9"), (0.82, "#b98a55"), (0.94, "#7a5a36"),
    ])
    return {"color": col, "roughness": 0.55}


def shukra(nt):
    coord = tex_coord(nt)
    swirl = noise(nt, coord, scale=2.4, detail=9.0, roughness=0.5, distortion=2.2)
    col = ramp(nt, swirl, [(0.3, "#b48d70"), (0.45, "#ecd2b0"), (0.58, "#fff4df"), (0.72, "#fffdf6")])
    return {"color": col, "roughness": 0.42, "emission": col, "emission_strength": 0.06}


def shani(nt):
    coord = tex_coord(nt)
    bands = latitude_bands(nt, coord, warp=0.05, warp_scale=3.0)
    col = ramp(nt, bands, [
        (0.1, "#26366e"), (0.28, "#4865ad"), (0.4, "#7f9ad6"), (0.5, "#c3cfe8"),
        (0.6, "#7894cf"), (0.74, "#425da3"), (0.9, "#222f63"),
    ])
    return {"color": col, "roughness": 0.7}


def rahu(nt):
    # The north lunar node: an eclipse shadow rather than a body. Near-black obsidian.
    coord = tex_coord(nt)
    smoke = noise(nt, coord, scale=3.0, detail=10.0, roughness=0.62, distortion=1.6)
    col = ramp(nt, smoke, [(0.35, "#030208"), (0.55, "#0a0614"), (0.72, "#26123e")])
    return {"color": col, "roughness": 0.5, "metallic": 0.0}


def ketu(nt):
    # The south lunar node: a smouldering, ember-veined dark orb.
    coord = tex_coord(nt)
    smoke = noise(nt, coord, scale=2.8, detail=11.0, roughness=0.62, distortion=2.4)
    col = ramp(nt, smoke, [(0.3, "#0a0d11"), (0.5, "#2a343b"), (0.62, "#7a8a85"), (0.74, "#c8c3ac")])
    veins = ramp(nt, smoke, [(0.505, "#000000"), (0.52, "#d9591a"), (0.535, "#000000")])
    return {"color": col, "roughness": 0.6, "emission": veins, "emission_strength": 1.4}


BUILDERS = {
    "surya": surya, "chandra": chandra, "mangala": mangala, "budha": budha, "guru": guru,
    "shukra": shukra, "shani": shani, "rahu": rahu, "ketu": ketu,
}

# Atmosphere colour, rim strength and shell scale per graha.
ATMOSPHERE = {
    "surya": ("#ff8a1e", 2.2, 1.5, 3.2),
    "chandra": ("#c7d4ff", 0.5, 1.07, 3.5),
    "mangala": ("#ff6a3a", 0.8, 1.09, 3.5),
    "budha": ("#58e0a2", 0.8, 1.09, 3.5),
    "guru": ("#ffd68a", 0.7, 1.08, 3.5),
    "shukra": ("#fff0d0", 1.0, 1.14, 3.0),
    "shani": ("#7c9bff", 0.8, 1.08, 3.5),
    "rahu": ("#ff5a14", 2.6, 1.34, 3.4),
    "ketu": ("#6fc7c7", 0.9, 1.12, 3.5),
}

ROTATION = {"guru": 3, "shani": 26, "mangala": 25, "shukra": 3}


def surface_material(name):
    """Full render material for a graha."""
    mat, nt, out = new_material(f"graha_{name}")
    data = BUILDERS[name](nt)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(data["color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = data.get("roughness", 0.6)
    bsdf.inputs["Metallic"].default_value = data.get("metallic", 0.0)
    if "emission" in data:
        nt.links.new(data["emission"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = data["emission_strength"]
    if "bump" in data:
        bump = nt.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = data["bump_strength"]
        nt.links.new(data["bump"], bump.inputs["Height"])
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def bake_material(name):
    """Unlit version of the surface for baking; returns material and data dict."""
    mat, nt, out = new_material(f"bake_{name}")
    data = BUILDERS[name](nt)
    emit = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(data["color"], emit.inputs["Color"])
    nt.links.new(emit.outputs[0], out.inputs["Surface"])
    return mat, data


def shani_ring_material(alpha_only=False):
    """Banded ring with gaps, driven by distance from the planet centre."""
    mat, nt, out = new_material("shani_ring")
    coord = tex_coord(nt)
    vec = nt.nodes.new("ShaderNodeVectorMath")
    vec.operation = "LENGTH"
    nt.links.new(coord, vec.inputs[0])
    # Ring spans radius 1.35-2.35: normalise to 0..1.
    t = math_node(nt, "DIVIDE", math_node(nt, "SUBTRACT", vec.outputs["Value"], 1.35), 1.0, clamp=True)
    grain = noise(nt, None, scale=1.0)
    links_node = nt.nodes.new("ShaderNodeCombineXYZ")
    nt.links.new(math_node(nt, "MULTIPLY", t, 60.0), links_node.inputs[0])
    grain_node = grain.node
    nt.links.new(links_node.outputs[0], grain_node.inputs["Vector"])
    grain_node.inputs["Scale"].default_value = 1.0
    grain_node.inputs["Detail"].default_value = 3.0
    col = ramp(nt, t, [(0.0, "#5c6fa6"), (0.3, "#c0cbe6"), (0.55, "#7d8fbe"), (0.62, "#d7deef"), (1.0, "#6d7ba6")])
    opacity = ramp(nt, t, [
        (0.0, "#000000"), (0.05, "#9a9a9a"), (0.42, "#ffffff"), (0.52, "#ffffff"),
        (0.545, "#050505"), (0.60, "#050505"), (0.63, "#e0e0e0"), (0.9, "#a0a0a0"), (1.0, "#000000"),
    ])
    rough = math_node(nt, "MULTIPLY", opacity, math_node(nt, "ADD", math_node(nt, "MULTIPLY", grain, 0.7), 0.5), clamp=True)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(col, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.5
    nt.links.new(rough, bsdf.inputs["Alpha"])
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def add_ring(scene, name, inner, outer, material, location=(0, 0, 0), segments=256):
    import bmesh

    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new("UVMap")
    in_verts, out_verts = [], []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        in_verts.append(bm.verts.new((inner * math.cos(a), inner * math.sin(a), 0)))
        out_verts.append(bm.verts.new((outer * math.cos(a), outer * math.sin(a), 0)))
    for i in range(segments):
        j = (i + 1) % segments
        face = bm.faces.new((in_verts[i], out_verts[i], out_verts[j], in_verts[j]))
        for loop in face.loops:
            co = loop.vert.co
            loop[uv_layer].uv = (0.5 + co.x / (2 * outer), 0.5 + co.y / (2 * outer))
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = location
    mesh.materials.append(material)
    return obj


def build_graha(scene, name, location=(0, 0, 0), size=1.0):
    """Planet, atmosphere (and ring for Shani) at the given location; radius = size."""
    planet = uv_sphere(scene, name, radius=1.0, location=location, segments=96, rings=48)
    planet.data.materials.append(surface_material(name))
    tilt = ROTATION.get(name, 8)
    planet.rotation_euler = (math.radians(tilt), math.radians(-tilt / 2), math.radians(35))
    planet.scale = (size, size, size)
    colour, strength, shell_scale, power = ATMOSPHERE[name]
    extra = {"max_alpha": 0.85, "rim_falloff": 9.0} if name == "rahu" else {}
    shell = glow_shell(scene, f"{name}_atmo", 1.0, shell_scale, colour, strength=strength, power=power,
                       location=location, **extra)
    shell.scale = (size, size, size)
    if name == "shani":
        ring = add_ring(scene, "shani_ring", 1.35, 2.35, shani_ring_material(), location=location)
        ring.rotation_euler = (math.radians(20), math.radians(-16), 0)
        ring.scale = (size, size, size)
        planet.rotation_euler = ring.rotation_euler
    return planet
