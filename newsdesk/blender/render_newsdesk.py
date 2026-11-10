import bpy, math, json, os, sys, argparse
from mathutils import Vector

av = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--seed", required=True)
p.add_argument("--output", required=True)
A = p.parse_args(av)

seed = json.load(open(A.seed))
cfg = seed["project"]
FPS = min(int(cfg.get("fps", 16)), 16)
W = min(int(cfg.get("width", 960)), 960)
H = min(int(cfg.get("height", 540)), 540)
DUR = min(float(cfg.get("duration_seconds", 8)), 8.0)
LAST = max(24, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"])
headline = seed.get("headline", "9jaBeacon")
ticker = seed.get("ticker", "9jaBeacon · www.9jabeacon.name.ng")
boards_cfg = seed.get("boards", [{"label": "A"}, {"label": "B"}, {"label": "C"}])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(n, c, r=0.45):
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*c, 1)
    bsdf.inputs["Roughness"].default_value = r
    return m

def cube(n, loc, dim, m, b=0.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = n
    o.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if b > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = b
        mod.segments = 1
    o.data.materials.append(m)
    return o

def ball(n, loc, sc, m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=1, location=loc)
    o = bpy.context.object
    o.name = n
    o.scale = sc
    o.data.materials.append(m)
    for f in o.data.polygons:
        f.use_smooth = True
    return o

def cyl(n, loc, r, depth, m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=r, depth=depth, location=loc)
    o = bpy.context.object
    o.name = n
    o.data.materials.append(m)
    return o

def aim(o, t):
    o.rotation_euler = (Vector(t) - o.location).to_track_quat("-Z", "Y").to_euler()

def text_obj(name, body, loc, size=0.16, extrude=0.004, color=(1, 1, 1), align="CENTER"):
    curve = bpy.data.curves.new(name=name, type="FONT")
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.align_x = align
    curve.align_y = "CENTER"
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    tm = mat(name + "_mat", color, 0.3)
    ob.data.materials.append(tm)
    return ob

# Black stickman + light studio (matches admin look better)
m_black = mat("Stick", (0.05, 0.05, 0.06), 0.35)
m_wall = mat("Wall", (0.88, 0.90, 0.93), 0.7)
m_floor = mat("Floor", (0.82, 0.84, 0.87), 0.65)
m_desk = mat("Desk", (0.12, 0.14, 0.16), 0.4)
m_accent = mat("Accent", (0.10, 0.55, 0.45), 0.3)
m_board = mat("Board", (0.22, 0.24, 0.28), 0.4)
m_screen = mat("Screen", (0.15, 0.35, 0.55), 0.25)
m_ticker = mat("Ticker", (0.75, 0.08, 0.10), 0.3)
m_white = mat("White", (0.95, 0.96, 0.97), 0.35)

# Clean room
cube("FLOOR", (0, 0.3, -0.04), (12, 8, 0.1), m_floor)
cube("BACK", (0, 3.0, 2.0), (11, 0.15, 4.2), m_wall)
cube("LEFT", (-5.2, 0.5, 2.0), (0.15, 6, 4.2), m_wall)
cube("RIGHT", (5.2, 0.5, 2.0), (0.15, 6, 4.2), m_wall)
cube("STRIPE", (0, 2.9, 3.15), (8, 0.08, 0.18), m_accent)

# Desk covers lower body
cube("DESK_TOP", (0, -0.2, 0.95), (3.8, 1.2, 0.08), m_desk)
cube("DESK_FRONT", (0, -0.75, 0.48), (3.7, 0.08, 0.9), m_desk)
cube("LOGO_PLATE", (0, -0.8, 0.55), (1.3, 0.04, 0.26), m_accent)
text_obj("LOGO", "9jaBeacon", (0, -0.83, 0.55), size=0.12, color=(0.95, 0.97, 0.98))

# 3 boards
for i, (bx, by, bz) in enumerate([(-2.3, 2.55, 1.95), (0.0, 2.6, 2.1), (2.3, 2.55, 1.95)]):
    cube(f"BF{i}", (bx, by, bz), (1.6, 0.08, 1.1), m_board)
    cube(f"BP{i}", (bx, by - 0.05, bz), (1.45, 0.03, 0.95), m_screen)
    lab = boards_cfg[i].get("label", f"{i+1}") if i < len(boards_cfg) else f"{i+1}"
    text_obj(f"BL{i}", lab, (bx, by - 0.1, bz + 0.28), size=0.14, color=(0.95, 0.96, 0.98))

# Black stickman seated (line style)
head = ball("HEAD", (0, 0.1, 2.0), (0.2, 0.18, 0.22), m_black)
cyl("NECK", (0, 0.1, 1.75), 0.04, 0.14, m_black)
cyl("TORSO", (0, 0.12, 1.35), 0.05, 0.55, m_black)
# arms on desk
al = cyl("ARM_L", (-0.38, -0.08, 1.12), 0.035, 0.55, m_black)
al.rotation_euler = (1.1, 0.1, 0.5)
ar = cyl("ARM_R", (0.38, -0.08, 1.12), 0.035, 0.55, m_black)
ar.rotation_euler = (1.1, -0.1, -0.5)
ball("HAND_L", (-0.5, -0.32, 0.98), (0.05, 0.04, 0.035), m_black)
ball("HAND_R", (0.5, -0.32, 0.98), (0.05, 0.04, 0.035), m_black)
# simple face (white dots so they read on black head)
eye_w = mat("Eye", (0.95, 0.95, 0.95), 0.3)
ball("E_L", (-0.06, -0.05, 2.03), (0.03, 0.015, 0.025), eye_w)
ball("E_R", (0.06, -0.05, 2.03), (0.03, 0.015, 0.025), eye_w)
cube("MOUTH", (0, -0.07, 1.92), (0.07, 0.015, 0.02), eye_w, 0.002)

for f in (1, LAST // 2, LAST):
    t = f / max(1, LAST)
    bob = 0.01 * math.sin(t * math.pi * 2)
    head.location = (0, 0.1, 2.0 + bob)
    head.keyframe_insert(data_path="location", frame=f)

# Headline + scrolling ticker
cube("H_BG", (0, -1.45, 0.52), (5.8, 0.07, 0.28), mat("HBg", (0.1, 0.11, 0.13), 0.4))
text_obj("H_TXT", headline[:58], (0, -1.48, 0.52), size=0.14, color=(0.98, 0.98, 0.99))
cube("T_BG", (0, -1.62, 0.22), (8.0, 0.08, 0.24), m_ticker)
tx = text_obj("T_TXT", (ticker + "  ·  ") * 2, (3.2, -1.65, 0.22), size=0.11, color=(1, 1, 1), align="LEFT")
for f in (1, LAST):
    tx.location = (3.5 - (f / max(1, LAST)) * 7.0, -1.65, 0.22)
    tx.keyframe_insert(data_path="location", frame=f)
if tx.animation_data and tx.animation_data.action:
    for fc in tx.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

bpy.ops.object.camera_add(location=(0, -4.6, 1.55))
cam = bpy.context.object
cam.data.lens = 40
bpy.context.scene.camera = cam

def camkey(f, loc, target, lens):
    cam.location = loc
    aim(cam, target)
    cam.data.lens = lens
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
    cam.data.keyframe_insert(data_path="lens", frame=f)

camkey(1, (0, -5.0, 1.6), (0, 0.1, 1.5), 38)
camkey(LAST, (0, -4.2, 1.5), (0, 0.1, 1.55), 44)

bpy.ops.object.light_add(type="AREA", location=(-2, -2.2, 3.8))
L = bpy.context.object
L.data.energy = 800
L.data.size = 4
aim(L, (0, 0.1, 1.4))
bpy.ops.object.light_add(type="AREA", location=(2.2, 0.5, 3.2))
L2 = bpy.context.object
L2.data.energy = 450
L2.data.size = 3
aim(L2, (0, 0.1, 1.4))

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    scene.eevee.taa_render_samples = 8
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "LOW"
scene.render.ffmpeg.ffmpeg_preset = "REALTIME"
scene.render.filepath = os.path.abspath(A.output)
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.75, 0.78, 0.82)

os.makedirs(os.path.dirname(os.path.abspath(A.output)) or ".", exist_ok=True)
print("NEWSDESK_RENDER_START", json.dumps({"frames": LAST, "fps": FPS}), flush=True)
bpy.ops.render.render(animation=True)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
