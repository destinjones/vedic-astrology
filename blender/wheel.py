"""Builds the sidereal rashi/nakshatra wheel: 12 rashis, 27 nakshatras, 108 pada ticks.

Geometry convention (shared with assets/3d/manifest.json):
- The wheel lies in the XY plane, centred on the origin, radius 10 units.
- 0 deg sidereal Aries is on +X and longitude increases counterclockwise seen from +Z.
- Every division is computed from longitude, so the rendered art is angularly exact:
  rashi = 30 deg, nakshatra = 13 deg 20', pada = 3 deg 20'.
"""
import math

import bmesh
import bpy

from common import NAKSHATRAS, RASHIS, SERIF, SYMBOL, enamel_material, gold_material, text_gold_material, text_mesh

R_CORE = 3.05
R_GRAHA = 4.0
R_RASHI_IN = 4.25
R_RASHI_OUT = 6.75
R_NAK_IN = 6.95
R_NAK_OUT = 9.35
R_PADA_OUT = 9.75
R_RIM = 10.0
DEPTH = 0.16


def annulus_sector(scene, name, r_in, r_out, start_deg, end_deg, z0, z1, material, seg_per_deg=1.0, bevel=0.0):
    """Extruded ring sector, with a small bevel to catch highlights."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    steps = max(2, int(abs(end_deg - start_deg) * seg_per_deg))
    bottom_in, bottom_out, top_in, top_out = [], [], [], []
    for i in range(steps + 1):
        a = math.radians(start_deg + (end_deg - start_deg) * i / steps)
        c, s = math.cos(a), math.sin(a)
        bottom_in.append(bm.verts.new((r_in * c, r_in * s, z0)))
        bottom_out.append(bm.verts.new((r_out * c, r_out * s, z0)))
        top_in.append(bm.verts.new((r_in * c, r_in * s, z1)))
        top_out.append(bm.verts.new((r_out * c, r_out * s, z1)))
    for i in range(steps):
        bm.faces.new((top_in[i], top_out[i], top_out[i + 1], top_in[i + 1]))
        bm.faces.new((bottom_in[i + 1], bottom_out[i + 1], bottom_out[i], bottom_in[i]))
        bm.faces.new((top_out[i], bottom_out[i], bottom_out[i + 1], top_out[i + 1]))
        bm.faces.new((bottom_in[i], top_in[i], top_in[i + 1], bottom_in[i + 1]))
    if abs(end_deg - start_deg) < 359.99:
        bm.faces.new((bottom_in[0], bottom_out[0], top_out[0], top_in[0]))
        bm.faces.new((top_in[-1], top_out[-1], bottom_out[-1], bottom_in[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    mesh.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(40)
    return obj


def radial_bar(scene, lon_deg, r_in, r_out, width, z0, z1, material):
    """Thin raised divider along a line of constant longitude."""
    half = math.degrees(width / 2 / ((r_in + r_out) / 2))
    return annulus_sector(scene, f"div_{lon_deg:.2f}", r_in, r_out, lon_deg - half, lon_deg + half, z0, z1, material)


def radial_text(scene, body, font, size, radius, lon_deg, z, extrude, material):
    """Text reading along the radius at the given longitude, flipped so it is never upside down."""
    deg = lon_deg % 360
    rot = deg - 180 if 90 < deg < 270 else deg
    a = math.radians(deg)
    return text_mesh(scene, body, font, size, location=(radius * math.cos(a), radius * math.sin(a), z),
                     rotation_z=math.radians(rot), extrude=extrude, material=material)


def upright_text(scene, body, font, size, radius, lon_deg, z, extrude, material):
    """Text tangent to the wheel, with its top toward the rim in the upper half."""
    deg = lon_deg % 360
    rot = deg - 90 if 0 <= deg < 180 else deg + 90
    a = math.radians(deg)
    return text_mesh(scene, body, font, size, location=(radius * math.cos(a), radius * math.sin(a), z),
                     rotation_z=math.radians(rot), extrude=extrude, material=material)


def build_wheel(scene):
    gold = gold_material("Gold")
    gold_soft = gold_material("GoldSoft", color="#c4913a", roughness=0.42)
    label = text_gold_material()
    lapis_a = enamel_material("LapisA", "#10204d")
    lapis_b = enamel_material("LapisB", "#172a60")
    night = enamel_material("Night", "#090c22", roughness=0.4)
    plum_a = enamel_material("PlumA", "#1f1138")
    plum_b = enamel_material("PlumB", "#2a1747")

    annulus_sector(scene, "backplate", 0.0001, R_RIM, 0, 360, -0.35, -0.05, night, seg_per_deg=1.0)
    annulus_sector(scene, "rim", R_PADA_OUT, R_RIM, 0, 360, -0.05, DEPTH + 0.14, gold, bevel=0.04)
    annulus_sector(scene, "core_ring", R_CORE, R_CORE + 0.14, 0, 360, -0.05, DEPTH + 0.1, gold, bevel=0.03)
    annulus_sector(scene, "rashi_in_ring", R_RASHI_IN - 0.1, R_RASHI_IN, 0, 360, -0.05, DEPTH + 0.1, gold_soft, bevel=0.02)
    annulus_sector(scene, "rashi_out_ring", R_RASHI_OUT, R_NAK_IN, 0, 360, -0.05, DEPTH + 0.1, gold, bevel=0.03)
    annulus_sector(scene, "nak_out_ring", R_NAK_OUT, R_NAK_OUT + 0.05, 0, 360, -0.05, DEPTH + 0.08, gold_soft)

    # Rashis: enamel plates, gold dividers, glyph and name.
    for i, (_key, name, _western, glyph) in enumerate(RASHIS):
        start = i * 30.0
        mid = start + 15.0
        plate = lapis_a if i % 2 == 0 else lapis_b
        annulus_sector(scene, f"rashi_{i}", R_RASHI_IN, R_RASHI_OUT, start + 0.25, start + 29.75, -0.05, DEPTH, plate)
        radial_bar(scene, start, R_RASHI_IN, R_RASHI_OUT, 0.075, -0.05, DEPTH + 0.1, gold)
        upright_text(scene, glyph, SYMBOL, 1.1, 5.65, mid, DEPTH, 0.04, label)
        upright_text(scene, name, SERIF, 0.34, 4.65, mid, DEPTH, 0.015, label)

    # Nakshatras: 13 deg 20' plates.
    span = 360.0 / 27.0
    for i, name in enumerate(NAKSHATRAS):
        start = i * span
        mid = start + span / 2
        plate = plum_a if i % 2 == 0 else plum_b
        annulus_sector(scene, f"nakshatra_{i}", R_NAK_IN, R_NAK_OUT, start + 0.12, start + span - 0.12, -0.05, DEPTH, plate)
        radial_bar(scene, start, R_NAK_IN, R_PADA_OUT, 0.06, -0.05, DEPTH + 0.1, gold)
        size = 0.335 if len(name) <= 11 else (0.27 if len(name) <= 14 else 0.235)
        radial_text(scene, name, SERIF, size, (R_NAK_IN + R_NAK_OUT) / 2 + 0.08, mid, DEPTH, 0.012, label)
        radial_text(scene, str(i + 1), SERIF, 0.16, R_NAK_IN + 0.22, mid - span * 0.36, DEPTH, 0.008, label)

    # Pada ticks: 108 divisions of 3 deg 20', nakshatra bars already cover every 4th.
    for i in range(108):
        if i % 4 != 0:
            radial_bar(scene, i * 360.0 / 108, R_NAK_OUT + 0.05, R_PADA_OUT, 0.03, -0.05, DEPTH + 0.02, gold_soft)
    annulus_sector(scene, "pada_track", R_NAK_OUT + 0.05, R_PADA_OUT, 0, 360, -0.05, DEPTH - 0.08, night)

    # Degree scale around the graha track: a tick per degree, longer per 5.
    annulus_sector(scene, "graha_track", R_CORE + 0.14, R_RASHI_IN - 0.1, 0, 360, -0.05, DEPTH - 0.1, night)
    for deg in range(360):
        length = 0.2 if deg % 5 == 0 else 0.09
        radial_bar(scene, float(deg), R_RASHI_IN - 0.1 - length, R_RASHI_IN - 0.1, 0.018, -0.05, DEPTH - 0.04, gold_soft)

    # Core: sunburst medallion with 27 rays, one on each nakshatra boundary.
    annulus_sector(scene, "core_plate", 0.0001, R_CORE, 0, 360, -0.05, DEPTH - 0.05, night)
    for i in range(27):
        lon = i * span
        half = 3.0
        mesh = bpy.data.meshes.new(f"ray_{i}")
        bm = bmesh.new()
        a0, a1, a2 = math.radians(lon - half), math.radians(lon), math.radians(lon + half)
        base = 1.15
        tip = 2.85 if i % 3 == 0 else 2.25
        z = DEPTH - 0.02
        v = [bm.verts.new((base * math.cos(a0), base * math.sin(a0), z)),
             bm.verts.new((tip * math.cos(a1), tip * math.sin(a1), z + 0.03)),
             bm.verts.new((base * math.cos(a2), base * math.sin(a2), z))]
        bm.faces.new(v)
        bm.to_mesh(mesh)
        bm.free()
        ray = bpy.data.objects.new(f"ray_{i}", mesh)
        scene.collection.objects.link(ray)
        mesh.materials.append(gold)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=1.05, location=(0, 0, 0.0), segments=96, ring_count=48)
    dome = bpy.context.active_object
    dome.name = "core_dome"
    dome.scale = (1, 1, 0.42)
    bpy.ops.object.shade_smooth()
    dome.data.materials.append(gold)
    return gold
