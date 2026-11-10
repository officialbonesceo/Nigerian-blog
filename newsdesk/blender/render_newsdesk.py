import bpy, math, json, os, sys, argparse
from mathutils import Vector

av = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--seed", required=True)
p.add_argument("--output", required=True)
A = p.parse_args(av)

seed = json.load(open(A.seed))
cfg = seed["project"]
# CI-safe defaults (override seed if higher)
FPS = min(int(cfg.get("fps", 16)), 16)
W = min(int(cfg.get("width", 960)), 960)
H = min(int(cfg.get("height", 540)), 540)
DUR = min(float(cfg.get("duration_seconds", 8)), 8.0)
LAST = max(24, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"])
headline = seed.get("headline", "9jaBeacon Desk")
ticker = seed.get("ticker", "9jaBeacon · www.9jabeacon.name.ng")
boards_cfg = seed.get("boards", [{"label": "LEAD"}, {"label": "CONTEXT"}, {"label": "NEXT"}])

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(n, c, r=0.5, metallic=0.0):
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*c, 1)
    bsdf.inputs["Roughness"].default_value = r
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    return m

def cube(n, loc, dim, m, b=0.02):
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
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=10, radius=1, location=loc)
    o = bpy.context.object
    o.name = n
    o.scale = sc
    o.data.materials.append(m)
    for f in o.data.polygons:
        f.use_smooth = True
    return o

def cyl(n, loc, r, depth, m):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=r, depth=depth, location=loc)
    o = bpy.context.object
    o.name = n
    o.data.materials.append(m)
    return o

def aim(o, t):
    o.rotation_euler = (Vector(t) - o.location).to_track_quat("-Z", "Y").to_euler()

def text_obj(name, body, loc, size=0.18, extrude=0.006, color=(1, 1, 1), align="CENTER"):
    curve = bpy.data.curves.new(name=name, type="FONT")
    curve.body = body
    curve.size = size
    curve.extrude = extrude
    curve.align_x = align
    curve.align_y = "CENTER"
    ob = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(ob)
    ob.location = loc
    tm = mat(name + "_mat", color, 0.35)
    ob.data.materials.append(tm)
    return ob

m_wall = mat("Wall", tuple(env["wall"]), 0.65)
m_accent = mat("Accent", tuple(env["accent"]), 0.3)
m_desk = mat("Desk", tuple(env["desk"]), 0.35, 0.1)
m_floor = mat("Floor", (0.07, 0.08, 0.10), 0.75)
m_skin = mat("Skin", tuple(char.get("skin", [0.96, 0.97, 0.93])), 0.42)
m_outfit = mat("Outfit", tuple(char.get("outfit", [0.12, 0.22, 0.45])), 0.48)
m_ink = mat("Ink", (0.05, 0.05, 0.06), 0.4)
m_ticker = mat("Ticker", tuple(env["ticker"]["bg"]), 0.28)
m_board_frame = mat("BoardFrame", (0.18, 0.19, 0.22), 0.35, 0.15)
m_glass = mat("GlassPanel", (0.12, 0.18, 0.28), 0.15, 0.25)
m_led = mat("LED", (0.2, 0.85, 0.55), 0.25)

cube("FLOOR", (0, 0.2, -0.05), (14, 9, 0.12), m_floor)
cube("BACK_WALL", (0, 3.4, 2.4), (14, 0.25, 5.0), m_wall)
cube("LEFT_WALL", (-6.5, 0.6, 2.4), (0.25, 7, 5.0), m_wall)
cube("RIGHT_WALL", (6.5, 0.6, 2.4), (0.25, 7, 5.0), m_wall)
cube("COVE_LIGHT", (0, 3.25, 4.55), (10, 0.12, 0.08), m_led, 0.01)
cube("ACCENT_BAND", (0, 3.22, 2.85), (9, 0.1, 0.4), m_accent, 0.02)
cube("SET_LEFT", (-4.2, 2.9, 1.4), (1.2, 0.15, 2.6), m_glass, 0.02)
cube("SET_RIGHT", (4.2, 2.9, 1.4), (1.2, 0.15, 2.6), m_glass, 0.02)

cube("DESK_TOP", (0, -0.25, 0.95), (4.2, 1.35, 0.09), m_desk, 0.02)
cube("DESK_FRONT", (0, -0.88, 0.48), (4.1, 0.1, 0.95), m_desk, 0.02)
cube("DESK_LOGO", (0, -0.94, 0.58), (1.6, 0.05, 0.32), m_accent, 0.01)
text_obj("DESK_LOGO_TEXT", "9jaBeacon", (0, -0.97, 0.58), size=0.14, extrude=0.003, color=(0.95, 0.97, 0.98))

board_positions = [(-2.55, 2.85, 2.15), (0.0, 2.95, 2.35), (2.55, 2.85, 2.15)]
for i, (bx, by, bz) in enumerate(board_positions[: int(env.get("boards", 3))]):
    col = boards_cfg[i].get("color", [0.1, 0.35, 0.4]) if i < len(boards_cfg) else [0.1, 0.35, 0.4]
    label = boards_cfg[i].get("label", f"B{i+1}") if i < len(boards_cfg) else f"B{i+1}"
    cube(f"BOARD_FRAME_{i}", (bx, by, bz), (1.85, 0.1, 1.25), m_board_frame, 0.015)
    m_panel = mat(f"Panel_{i}", tuple(col), 0.22)
    cube(f"BOARD_PANEL_{i}", (bx, by - 0.07, bz), (1.65, 0.04, 1.08), m_panel, 0.01)
    text_obj(f"BOARD_LABEL_{i}", label, (bx, by - 0.12, bz + 0.35), size=0.15, extrude=0.004, color=(0.95, 0.96, 0.98))

head = ball("HEAD", (0, 0.12, 2.05), (0.22, 0.20, 0.24), m_skin)
cyl("NECK", (0, 0.12, 1.78), 0.055, 0.16, m_skin)
cube("SHOULDERS", (0, 0.12, 1.58), (0.55, 0.22, 0.18), m_outfit, 0.03)
torso = cube("TORSO", (0, 0.14, 1.28), (0.42, 0.28, 0.48), m_outfit, 0.04)
cube("LAPEL", (0, -0.02, 1.45), (0.12, 0.06, 0.35), m_accent, 0.01)
arm_l = cyl("ARM_L", (-0.42, -0.05, 1.15), 0.045, 0.62, m_skin)
arm_l.rotation_euler = (1.15, 0.15, 0.55)
arm_r = cyl("ARM_R", (0.42, -0.05, 1.15), 0.045, 0.62, m_skin)
arm_r.rotation_euler = (1.15, -0.15, -0.55)
ball("HAND_L", (-0.55, -0.35, 0.98), (0.06, 0.05, 0.04), m_skin)
ball("HAND_R", (0.55, -0.35, 0.98), (0.06, 0.05, 0.04), m_skin)
ball("EYE_L", (-0.07, -0.06, 2.08), (0.035, 0.02, 0.03), m_ink)
ball("EYE_R", (0.07, -0.06, 2.08), (0.035, 0.02, 0.03), m_ink)
cube("MOUTH", (0, -0.08, 1.95), (0.08, 0.02, 0.025), m_ink, 0.004)
# sparse keys for speed
for f in (1, LAST // 2, LAST):
    t = f / max(1, LAST)
    bob = 0.012 * math.sin(t * math.pi * 3)
    nod = 0.015 * math.sin(t * math.pi * 2)
    head.location = (0, 0.12 + nod * 0.3, 2.05 + bob)
    head.keyframe_insert(data_path="location", frame=f)
    torso.location = (0, 0.14, 1.28 + bob * 0.4)
    torso.keyframe_insert(data_path="location", frame=f)

cube("HEADLINE_BG", (0, -1.55, 0.55), (6.2, 0.08, 0.32), mat("HBg", (0.08, 0.09, 0.11), 0.4), 0.01)
text_obj("HEADLINE_TEXT", headline[:64], (0, -1.58, 0.55), size=0.16, extrude=0.004, color=(0.98, 0.98, 0.99))

cube("TICKER_BG", (0, -1.7, 0.22), (8.5, 0.1, 0.26), m_ticker, 0.01)
ticker_body = (ticker + "   ·   ") * 2
tx = text_obj("TICKER_TEXT", ticker_body, (3.5, -1.74, 0.22), size=0.12, extrude=0.003, color=(1, 1, 1), align="LEFT")
for f in (1, LAST):
    x = 3.8 - (f / max(1, LAST)) * 7.5
    tx.location = (x, -1.74, 0.22)
    tx.keyframe_insert(data_path="location", frame=f)
if tx.animation_data and tx.animation_data.action:
    for fc in tx.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

bpy.ops.object.camera_add(location=(0, -5.0, 1.6))
cam = bpy.context.object
cam.name = "NEWSDESK_CAM"
cam.data.lens = 42
bpy.context.scene.camera = cam

def camkey(f, loc, target, lens):
    cam.location = loc
    aim(cam, target)
    cam.data.lens = lens
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
    cam.data.keyframe_insert(data_path="lens", frame=f)

camkey(1, (0, -5.2, 1.65), (0, 0.15, 1.55), 40)
camkey(LAST, (-0.05, -4.2, 1.52), (0, 0.1, 1.6), 46)

bpy.ops.object.light_add(type="AREA", location=(-2.5, -2.5, 4.0))
L = bpy.context.object
L.data.energy = 900
L.data.size = 5
aim(L, (0, 0.1, 1.5))
bpy.ops.object.light_add(type="AREA", location=(2.8, 0.5, 3.4))
L2 = bpy.context.object
L2.data.energy = 500
L2.data.size = 3.5
aim(L2, (0, 0.1, 1.5))

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
# Prefer Eevee; fall back name if Next not present
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    scene.eevee.taa_render_samples = 8
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "LOW"
scene.render.ffmpeg.ffmpeg_preset = "REALTIME"
scene.render.filepath = os.path.abspath(A.output)
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.035, 0.04, 0.055)

for obj in scene.objects:
    if obj.name == "TICKER_TEXT":
        continue
    if obj.animation_data and obj.animation_data.action:
        for fc in obj.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "BEZIER"

os.makedirs(os.path.dirname(os.path.abspath(A.output)) or ".", exist_ok=True)
print("NEWSDESK_RENDER_START", json.dumps({"frames": LAST, "fps": FPS, "res": [W, H], "character": char.get("id"), "env": env.get("id")}), flush=True)
bpy.ops.render.render(animation=True)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
