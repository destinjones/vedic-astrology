"""Shared data and helpers for the Vedic astrology Blender pipeline (Blender 5.x)."""
import math
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "3d")

# The Store build of Blender discards console output, so scripts log to blender/.logs/<script>.log.
_script = next((a for a in sys.argv if a.endswith(".py")), "blender.py")
_log_dir = os.path.join(ROOT, "blender", ".logs")
os.makedirs(_log_dir, exist_ok=True)
sys.stdout = sys.stderr = open(
    os.path.join(_log_dir, os.path.splitext(os.path.basename(_script))[0] + ".log"), "w", buffering=1, encoding="utf-8"
)

from vedic_data import GRAHAS, NAKSHATRAS, RASHIS  # noqa: E402,F401

SERIF = r"C:\Windows\Fonts\georgia.ttf"
SYMBOL = r"C:\Windows\Fonts\seguisym.ttf"


def slug(name):
    return name.lower().replace(" ", "-")


def args():
    """Arguments after the `--` separator."""
    return sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def ensure_dir(*parts):
    path = os.path.join(OUT, *parts)
    os.makedirs(path, exist_ok=True)
    return path


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return bpy.context.scene


def setup_cycles(scene, res_x, res_y, samples=128, transparent=True):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "OPTIX"
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = "OPTIX"
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = transparent
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Medium High Contrast"


def set_output(scene, path, fmt="WEBP", quality=90, alpha=True):
    settings = scene.render.image_settings
    settings.file_format = fmt
    settings.color_mode = "RGBA" if alpha else "RGB"
    if fmt in ("WEBP", "JPEG"):
        settings.quality = quality
    scene.render.filepath = path


def add_camera(scene, location, target=(0, 0, 0), lens=85.0, ortho_scale=None):
    data = bpy.data.cameras.new("Camera")
    if ortho_scale is not None:
        data.type = "ORTHO"
        data.ortho_scale = ortho_scale
    else:
        data.lens = lens
    data.clip_end = 2000
    cam = bpy.data.objects.new("Camera", data)
    scene.collection.objects.link(cam)
    cam.location = location
    aim(cam, target)
    scene.camera = cam
    return cam


def aim(obj, target):
    from mathutils import Vector

    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_sun_light(scene, rotation, energy=3.0, color=(1, 1, 1), angle_deg=2.0):
    data = bpy.data.lights.new("Sun", "SUN")
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new("Sun", data)
    scene.collection.objects.link(obj)
    obj.rotation_euler = [math.radians(a) for a in rotation]
    return obj


def add_area_light(scene, location, target, energy, size, color=(1, 1, 1)):
    data = bpy.data.lights.new("Area", "AREA")
    data.energy = energy
    data.size = size
    data.color = color
    obj = bpy.data.objects.new("Area", data)
    scene.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)
    return obj


def black_world(scene, strength=0.0, color=(0, 0, 0)):
    world = bpy.data.worlds.new("World")
    scene.world = world
    bg = world.node_tree.nodes.get("Background")
    if bg is None:
        bg = world.node_tree.nodes.new("ShaderNodeBackground")
        out = world.node_tree.nodes.new("ShaderNodeOutputWorld")
        world.node_tree.links.new(bg.outputs[0], out.inputs[0])
    bg.inputs[0].default_value = (*color, 1)
    bg.inputs[1].default_value = strength
    return world


def uv_sphere(scene, name, radius=1.0, location=(0, 0, 0), segments=128, rings=64):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=rings, radius=radius, location=location
    )
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name
    bpy.ops.object.shade_smooth()
    return obj


def new_material(name):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return mat, nt, out


def hex_rgb(value):
    """Convert #rrggbb to a linear RGB tuple."""
    value = value.lstrip("#")
    srgb = [int(value[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb)


def ramp(nt, fac_socket, stops, interpolation="LINEAR"):
    """Colour ramp from [(position, '#hex'), ...]; returns the colour output."""
    node = nt.nodes.new("ShaderNodeValToRGB")
    cr = node.color_ramp
    cr.interpolation = interpolation
    while len(cr.elements) > 1:
        cr.elements.remove(cr.elements[-1])
    cr.elements[0].position = stops[0][0]
    cr.elements[0].color = (*hex_rgb(stops[0][1]), 1)
    for pos, col in stops[1:]:
        el = cr.elements.new(pos)
        el.color = (*hex_rgb(col), 1)
    nt.links.new(fac_socket, node.inputs["Fac"])
    return node.outputs["Color"]


def noise(nt, vector, scale=4.0, detail=8.0, roughness=0.55, distortion=0.0, lacunarity=2.0):
    node = nt.nodes.new("ShaderNodeTexNoise")
    node.noise_dimensions = "3D"
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    node.inputs["Roughness"].default_value = roughness
    node.inputs["Lacunarity"].default_value = lacunarity
    node.inputs["Distortion"].default_value = distortion
    if vector is not None:
        nt.links.new(vector, node.inputs["Vector"])
    return node.outputs["Fac"]


def tex_coord(nt, kind="Object"):
    return nt.nodes.new("ShaderNodeTexCoord").outputs[kind]


def math_node(nt, op, a, b=None, clamp=False):
    node = nt.nodes.new("ShaderNodeMath")
    node.operation = op
    node.use_clamp = clamp
    for i, value in enumerate((a, b)):
        if value is None:
            continue
        if isinstance(value, (int, float)):
            node.inputs[i].default_value = value
        else:
            nt.links.new(value, node.inputs[i])
    return node.outputs[0]


def mix_color(nt, fac, a, b, blend="MIX"):
    node = nt.nodes.new("ShaderNodeMix")
    node.data_type = "RGBA"
    node.blend_type = blend
    node.clamp_factor = True
    for key, value in (("A", a), ("B", b)):
        socket = node.inputs[key]
        if isinstance(value, tuple):
            socket.default_value = (*value, 1)
        else:
            nt.links.new(value, socket)
    if isinstance(fac, (int, float)):
        node.inputs["Factor"].default_value = fac
    else:
        nt.links.new(fac, node.inputs["Factor"])
    return node.outputs["Result"]


def separate_z(nt, vector):
    node = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(vector, node.inputs[0])
    return node.outputs


def glow_shell(scene, name, target_radius, shell_radius, color, strength=3.0, power=3.0, location=(0, 0, 0),
               max_alpha=0.55, rim_falloff=1.1):
    """Fresnel-faded emissive shell that reads as atmosphere; keeps alpha clean."""
    obj = uv_sphere(scene, name, radius=shell_radius, location=location, segments=96, rings=48)
    mat, nt, out = new_material(name)
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    dot = nt.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    nt.links.new(geo.outputs["Incoming"], dot.inputs[0])
    nt.links.new(geo.outputs["Normal"], dot.inputs[1])
    facing = math_node(nt, "ABSOLUTE", dot.outputs["Value"])
    # The planet's silhouette sits at facing = edge. Glow builds from the shell's limb (facing 0)
    # up to the silhouette, then falls away quickly inside the disc so the surface stays visible.
    edge = math.sqrt(max(1e-4, 1 - (target_radius / shell_radius) ** 2))
    x = math_node(nt, "DIVIDE", facing, edge)
    outer = math_node(nt, "POWER", math_node(nt, "MINIMUM", x, 1.0), power)
    inner = math_node(nt, "SUBTRACT", 1.0, math_node(nt, "MULTIPLY", math_node(nt, "MAXIMUM", math_node(nt, "SUBTRACT", x, 1.0), 0.0), rim_falloff), clamp=True)
    fade = math_node(nt, "MULTIPLY", math_node(nt, "MULTIPLY", outer, math_node(nt, "POWER", inner, 2.0)), max_alpha)
    fade = math_node(nt, "MULTIPLY", fade, math_node(nt, "SUBTRACT", 1.0, geo.outputs["Backfacing"]))
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (*hex_rgb(color), 1)
    emit.inputs["Strength"].default_value = strength
    transp = nt.nodes.new("ShaderNodeBsdfTransparent")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(fade, mix.inputs[0])
    nt.links.new(transp.outputs[0], mix.inputs[1])
    nt.links.new(emit.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs["Surface"])
    obj.data.materials.append(mat)
    obj.visible_shadow = False
    return obj


def text_mesh(scene, body, font_path, size, location=(0, 0, 0), rotation_z=0.0, extrude=0.0, bevel=0.0,
              align_x="CENTER", align_y="CENTER", material=None):
    font = bpy.data.fonts.load(font_path, check_existing=True)
    curve = bpy.data.curves.new("text", "FONT")
    curve.body = body
    curve.font = font
    curve.size = size
    curve.align_x = align_x
    curve.align_y = align_y
    curve.extrude = extrude
    curve.bevel_depth = bevel
    curve.bevel_resolution = 1
    curve.resolution_u = 6
    obj = bpy.data.objects.new("text", curve)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.rotation_euler = (0, 0, rotation_z)
    if material is not None:
        curve.materials.append(material)
    return obj


def gold_material(name="Gold", color="#d9a441", roughness=0.28):
    mat, nt, out = new_material(name)
    coord = tex_coord(nt)
    grain = noise(nt, coord, scale=40.0, detail=6.0)
    rough = math_node(nt, "ADD", roughness, math_node(nt, "MULTIPLY", grain, 0.14))
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*hex_rgb(color), 1)
    bsdf.inputs["Metallic"].default_value = 1.0
    nt.links.new(rough, bsdf.inputs["Roughness"])
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def enamel_material(name, color, roughness=0.32, coat=0.8):
    mat, nt, out = new_material(name)
    coord = tex_coord(nt)
    var = noise(nt, coord, scale=3.0, detail=7.0, roughness=0.6)
    tint = mix_color(nt, math_node(nt, "MULTIPLY", var, 0.55), hex_rgb(color),
                     tuple(c * 1.9 for c in hex_rgb(color)))
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(tint, bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Coat Weight"].default_value = coat
    bsdf.inputs["Coat Roughness"].default_value = 0.12
    nt.links.new(bsdf.outputs[0], out.inputs["Surface"])
    return mat


def text_gold_material(name="TextGold", color="#f2cc78", glow=0.55):
    """Gold that stays legible at small sizes by carrying a little self-illumination."""
    mat = gold_material(name, color=color, roughness=0.3)
    bsdf = next(n for n in mat.node_tree.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled")
    bsdf.inputs["Emission Color"].default_value = (*hex_rgb(color), 1)
    bsdf.inputs["Emission Strength"].default_value = glow
    return mat
