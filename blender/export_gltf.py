"""Bake the procedural graha surfaces to textures and export GLB models for the web sky view.

Output: assets/3d/models/<graha>.glb (unit radius) and wheel.glb (radius 10).
Requires assets/3d/wheel/wheel-top.webp, produced by render_wheel.py.
"""
import math
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402
import numpy as np  # noqa: E402

from common import GRAHAS, OUT, args, ensure_dir, hex_rgb, new_material, reset_scene, setup_cycles, uv_sphere  # noqa: E402
from grahas import add_ring, bake_material, surface_material  # noqa: E402

TMP = tempfile.mkdtemp(prefix="vedic_bake_")
NORMAL_MAPPED = {"chandra", "mangala", "budha"}
EMISSIVE = {"surya"}


def bake_image(obj, mat, name, width, height, bake_type, non_color=False):
    image = bpy.data.images.new(name, width=width, height=height, alpha=False, float_buffer=False)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    node = mat.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = image
    mat.node_tree.nodes.active = node
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    kwargs = {"normal_space": "TANGENT"} if bake_type == "NORMAL" else {}
    bpy.ops.object.bake(type=bake_type, margin=8, use_clear=True, **kwargs)
    path = os.path.join(TMP, f"{name}.jpg")
    image.filepath_raw = path
    image.file_format = "JPEG"
    image.save(quality=88)
    image.source = "FILE"
    image.filepath = path
    image.reload()
    mat.node_tree.nodes.remove(node)
    return image


def export_material(name, color_image, normal_image=None):
    mat, nt, out = new_material(f"graha_{name}_baked")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = color_image
    if name in EMISSIVE:
        bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
        bsdf.inputs["Roughness"].default_value = 1.0
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = {"shukra": 0.45, "rahu": 0.5}.get(name, 0.8)
    if normal_image is not None:
        ntex = nt.nodes.new("ShaderNodeTexImage")
        ntex.image = normal_image
        ntex.image.colorspace_settings.name = "Non-Color"
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def ring_texture():
    """Radial RGBA strip for Shani's rings, matching the render ring's bands."""
    size = 1024
    stops_rgb = [(0.0, "#5c6fa6"), (0.3, "#c0cbe6"), (0.55, "#7d8fbe"), (0.62, "#d7deef"), (1.0, "#6d7ba6")]
    stops_a = [(0.0, 0.0), (0.05, 0.6), (0.42, 1.0), (0.52, 1.0), (0.545, 0.02), (0.6, 0.02), (0.63, 0.88), (0.9, 0.62), (1.0, 0.0)]
    t = np.linspace(0, 1, size)
    rng = np.random.default_rng(7)
    grain = np.interp(t, np.linspace(0, 1, 120), rng.uniform(0.75, 1.0, 120))
    rgb_lin = [np.interp(t, [p for p, _ in stops_rgb], [hex_rgb(c)[k] for _, c in stops_rgb]) for k in range(3)]
    alpha = np.interp(t, [p for p, _ in stops_a], [a for _, a in stops_a]) * grain
    srgb = [np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) for c in rgb_lin]
    pixels = np.ones((4, size, 4), dtype=np.float32)
    for k in range(3):
        pixels[:, :, k] = srgb[k]
    pixels[:, :, 3] = alpha
    image = bpy.data.images.new("shani_ring", width=size, height=4, alpha=True)
    image.pixels.foreach_set(pixels.ravel())
    path = os.path.join(TMP, "shani_ring.png")
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    return image


def add_export_ring(scene):
    mat, nt, out = new_material("shani_ring_baked")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = ring_texture()
    tex.extension = "EXTEND"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    bsdf.inputs["Roughness"].default_value = 0.7
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    mat.surface_render_method = "BLENDED"
    mat.use_backface_culling = False
    ring = add_ring(scene, "shani_ring", 1.35, 2.35, mat, segments=128)
    # Replace the planar UVs with radial ones so u runs along the band strip.
    uv = ring.data.uv_layers[0].data
    for poly in ring.data.polygons:
        for li in poly.loop_indices:
            v = ring.data.vertices[ring.data.loops[li].vertex_index].co
            radius = math.hypot(v.x, v.y)
            uv[li].uv = ((radius - 1.35) / 1.0, 0.5)
    return ring


def export_selected(path, objects):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True,
        export_image_format="AUTO", export_yup=True, export_animations=False, export_lights=False,
        export_cameras=False, export_materials="EXPORT",
    )
    print("EXPORTED", path, os.path.getsize(path), flush=True)


def graha_glb(name, out, width):
    scene = reset_scene()
    setup_cycles(scene, 64, 64, samples=4, transparent=False)
    scene.cycles.use_denoising = False
    sphere = uv_sphere(scene, name, radius=1.0, segments=96, rings=48)

    mat, _data = bake_material(name)
    sphere.data.materials.append(mat)
    color_image = bake_image(sphere, mat, f"{name}_color", width, width // 2, "EMIT")

    normal_image = None
    if name in NORMAL_MAPPED:
        full = surface_material(name)
        sphere.data.materials[0] = full
        scene.cycles.samples = 8
        normal_image = bake_image(sphere, full, f"{name}_normal", width // 2, width // 4, "NORMAL", non_color=True)

    sphere.data.materials[0] = export_material(name, color_image, normal_image)
    objects = [sphere]
    if name == "shani":
        ring = add_export_ring(scene)
        ring.parent = sphere
        objects.append(ring)
    export_selected(os.path.join(out, f"{name}.glb"), objects)


def wheel_glb(out):
    """Flat disc textured with the exact top-down plate, unlit via emission so labels stay readable."""
    scene = reset_scene()
    setup_cycles(scene, 64, 64, samples=4, transparent=False)
    source = bpy.data.images.load(os.path.join(OUT, "wheel", "wheel-top.webp"))
    # Flatten onto the plate colour and store as JPEG to keep the model small.
    w, h = source.size
    px = np.empty(w * h * 4, dtype=np.float32)
    source.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    px[:, :, :3] = px[:, :, :3] * px[:, :, 3:4] + (1 - px[:, :, 3:4]) * np.array(hex_rgb("#090c22"), dtype=np.float32) ** (1 / 2.2)
    px[:, :, 3] = 1
    flat = bpy.data.images.new("wheel_plate", width=w, height=h, alpha=False)
    flat.pixels.foreach_set(px.ravel())
    path = os.path.join(TMP, "wheel_plate.jpg")
    flat.filepath_raw = path
    flat.file_format = "JPEG"
    flat.save(quality=90)
    flat.source = "FILE"
    flat.filepath = path
    flat.reload()

    mat, nt, mout = new_material("wheel_plate")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = flat
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 1.0
    nt.links.new(bsdf.outputs[0], mout.inputs["Surface"])
    mat.use_backface_culling = False

    bpy.ops.mesh.primitive_circle_add(vertices=256, radius=10.0, fill_type="NGON")
    disc = bpy.context.active_object
    disc.name = "wheel"
    disc.data.materials.append(mat)
    uv = disc.data.uv_layers.new(name="UVMap").data
    # The plate frames radius 10 inside an ortho width of 20.4 world units.
    for poly in disc.data.polygons:
        for li in poly.loop_indices:
            v = disc.data.vertices[disc.data.loops[li].vertex_index].co
            uv[li].uv = (0.5 + v.x / 20.4, 0.5 + v.y / 20.4)
    export_selected(os.path.join(out, "wheel.glb"), [disc])


def main():
    argv = args()
    width = int(argv[0]) if argv else 2048
    names = argv[1].split(",") if len(argv) > 1 else GRAHAS + ["wheel"]
    out = ensure_dir("models")
    for name in names:
        if name == "wheel":
            wheel_glb(out)
        else:
            graha_glb(name, out, width)


main()
