import bpy, math, json, os, sys, argparse
from mathutils import Vector, Euler

av = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--seed", required=True)
p.add_argument("--output", required=True)
p.add_argument("--lipsync", default="", help="Path to Rhubarb JSON mouth cues")
A = p.parse_args(av)

seed = json.load(open(A.seed))
cfg = seed["project"]
FPS = min(int(cfg.get("fps", 24)), 24)
W = min(int(cfg.get("width", 1280)), 1280)
H = min(int(cfg.get("height", 720)), 720)
DUR = min(float(cfg.get("duration_seconds", 12)), 20.0)
LAST = max(24, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"]) if seed.get("environment") else {}
headline = seed.get("headline", "9jaBeacon")
ticker = seed.get("ticker", "9jaBeacon · www.9jabeacon.name.ng")
boards_cfg = seed.get("boards", [{"label": "A"}, {"label": "B"}, {"label": "C"}])
use_glb = bool(char.get("use_glb")) and bool(char.get("model_glb"))
glb_path = char.get("model_glb", "")

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

m_black = mat("Stick", (0.05, 0.05, 0.06), 0.35)
m_wall = mat("Wall", (0.90, 0.92, 0.95), 0.75)
m_floor = mat("Floor", (0.78, 0.80, 0.84), 0.55)
m_desk = mat("Desk", (0.10, 0.11, 0.13), 0.35)
m_accent = mat("Accent", (0.08, 0.62, 0.48), 0.28)
m_board = mat("Board", (0.18, 0.20, 0.24), 0.35)
m_screen = mat("Screen", (0.12, 0.32, 0.52), 0.22)
m_ticker = mat("Ticker", (0.78, 0.07, 0.10), 0.28)
m_white = mat("White", (0.95, 0.96, 0.97), 0.35)

cube("FLOOR", (0, 0.3, -0.04), (14, 10, 0.1), m_floor)
cube("BACK", (0, 3.2, 2.1), (12, 0.12, 4.4), m_wall)
cube("LEFT", (-5.6, 0.6, 2.1), (0.12, 7, 4.4), m_wall)
cube("RIGHT", (5.6, 0.6, 2.1), (0.12, 7, 4.4), m_wall)
cube("STRIPE", (0, 3.1, 3.35), (9, 0.06, 0.16), m_accent)

cube("DESK_TOP", (0, -0.15, 0.95), (4.0, 1.35, 0.08), m_desk)
cube("DESK_FRONT", (0, -0.78, 0.48), (3.9, 0.08, 0.92), m_desk)
cube("LOGO_PLATE", (0, -0.83, 0.55), (1.4, 0.04, 0.28), m_accent)
text_obj("LOGO", "9jaBeacon", (0, -0.86, 0.55), size=0.13, color=(0.95, 0.97, 0.98))

for i, (bx, by, bz) in enumerate([(-2.45, 2.7, 2.0), (0.0, 2.75, 2.15), (2.45, 2.7, 2.0)]):
    cube(f"BF{i}", (bx, by, bz), (1.7, 0.07, 1.15), m_board)
    cube(f"BP{i}", (bx, by - 0.05, bz), (1.55, 0.03, 1.0), m_screen)
    lab = boards_cfg[i].get("label", f"{i+1}") if i < len(boards_cfg) else f"{i+1}"
    text_obj(f"BL{i}", lab, (bx, by - 0.1, bz + 0.32), size=0.15, color=(0.95, 0.96, 0.98))

presenter_root = None
mouth_obj = None
armature_obj = None
pose_bones = {}

def find_pose_bone(arm, *candidates):
    if arm is None:
        return None
    names = {b.name: b for b in arm.pose.bones}
    lower = {b.name.lower(): b for b in arm.pose.bones}
    for c in candidates:
        if c in names:
            return names[c]
        if c.lower() in lower:
            return lower[c.lower()]
        for n, b in lower.items():
            if c.lower() in n:
                return b
    return None

def import_glb(path):
    global presenter_root, mouth_obj, armature_obj, pose_bones
    if not path or not os.path.isfile(path):
        print("GLB_MISSING", path, flush=True)
        return False
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    after = [o for o in bpy.data.objects if o.name not in before]
    if not after:
        print("GLB_IMPORT_EMPTY", flush=True)
        return False

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.12, 0.05))
    root = bpy.context.object
    root.name = "PRESENTER_ROOT"
    for o in after:
        if o.parent is None:
            o.parent = root
    root.location = (0, 0.12, 0.02)
    root.scale = (1.05, 1.05, 1.05)
    root.rotation_euler = Euler((math.radians(6), 0, 0), "XYZ")
    presenter_root = root

    for o in after:
        if o.type == "ARMATURE":
            armature_obj = o
            break
    if armature_obj is None:
        for o in bpy.data.objects:
            if o.type == "ARMATURE":
                armature_obj = o
                break

    if armature_obj is not None:
        bpy.context.view_layer.objects.active = armature_obj
        armature_obj.select_set(True)
        try:
            bpy.ops.object.mode_set(mode="POSE")
        except Exception:
            pass
        for b in armature_obj.pose.bones:
            pose_bones[b.name] = b
        print("ARMATURE", armature_obj.name, "bones=", len(armature_obj.pose.bones), flush=True)
        jaw = find_pose_bone(armature_obj, "Jaw", "jaw", "mixamorig:Jaw", "Jaw_Open")
        head = find_pose_bone(armature_obj, "mixamorig:Head", "Head", "head")
        neck = find_pose_bone(armature_obj, "mixamorig:Neck", "Neck", "neck")
        print("BONES jaw=", getattr(jaw, "name", None), "head=", getattr(head, "name", None), "neck=", getattr(neck, "name", None), flush=True)
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass
    else:
        print("NO_ARMATURE", flush=True)

    for o in after:
        ln = o.name.lower()
        if any(k in ln for k in ("mouth", "jaw", "lips")):
            mouth_obj = o
            break
    if mouth_obj is None and armature_obj is None:
        mouth_obj = ball("MOUTH_PROXY", (0, -0.12, 1.72), (0.06, 0.02, 0.035), m_white)
        mouth_obj.parent = root

    print("GLB_OK objects=", len(after), "mouth=", getattr(mouth_obj, "name", None), flush=True)
    return True

def build_stickman():
    global presenter_root, mouth_obj
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.1, 0))
    root = bpy.context.object
    root.name = "PRESENTER_ROOT"
    presenter_root = root
    head = ball("HEAD", (0, 0.1, 2.0), (0.2, 0.18, 0.22), m_black)
    head.parent = root
    neck = cyl("NECK", (0, 0.1, 1.75), 0.04, 0.14, m_black)
    neck.parent = root
    torso = cyl("TORSO", (0, 0.12, 1.35), 0.05, 0.55, m_black)
    torso.parent = root
    al = cyl("ARM_L", (-0.38, -0.08, 1.12), 0.035, 0.55, m_black)
    al.rotation_euler = (1.1, 0.1, 0.5)
    al.parent = root
    ar = cyl("ARM_R", (0.38, -0.08, 1.12), 0.035, 0.55, m_black)
    ar.rotation_euler = (1.1, -0.1, -0.5)
    ar.parent = root
    ball("HAND_L", (-0.5, -0.32, 0.98), (0.05, 0.04, 0.035), m_black).parent = root
    ball("HAND_R", (0.5, -0.32, 0.98), (0.05, 0.04, 0.035), m_black).parent = root
    eye_w = mat("Eye", (0.95, 0.95, 0.95), 0.3)
    ball("E_L", (-0.06, -0.05, 2.03), (0.03, 0.015, 0.025), eye_w).parent = root
    ball("E_R", (0.06, -0.05, 2.03), (0.03, 0.015, 0.025), eye_w).parent = root
    mouth_obj = cube("MOUTH", (0, -0.07, 1.92), (0.07, 0.015, 0.02), eye_w, 0.002)
    mouth_obj.parent = root
    for f in (1, LAST // 2, LAST):
        t = f / max(1, LAST)
        bob = 0.012 * math.sin(t * math.pi * 2)
        head.location = (0, 0.1, 2.0 + bob)
        head.keyframe_insert(data_path="location", frame=f)

if use_glb:
    ok = import_glb(glb_path)
    if not ok:
        print("FALLBACK_STICKMAN", flush=True)
        build_stickman()
else:
    build_stickman()

OPEN_MAP = {
    "A": 0.12, "B": 0.55, "C": 0.90, "D": 0.72, "E": 0.48,
    "F": 0.35, "G": 0.52, "H": 0.28, "X": 0.05,
}

def keyframe_pose_bone(pb, frame, rot_euler):
    pb.rotation_mode = "XYZ"
    pb.rotation_euler = rot_euler
    pb.keyframe_insert(data_path="rotation_euler", frame=frame)

def apply_facial_and_lipsync(path):
    cues = []
    if path and os.path.isfile(path):
        data = json.load(open(path))
        cues = data.get("mouthCues") or data.get("cues") or []
    print("LIPSYNC_CUES", len(cues), flush=True)

    jaw = None
    head = None
    neck = None
    if armature_obj is not None:
        bpy.context.view_layer.objects.active = armature_obj
        try:
            bpy.ops.object.mode_set(mode="POSE")
        except Exception:
            pass
        jaw = find_pose_bone(armature_obj, "Jaw", "jaw", "mixamorig:Jaw")
        head = find_pose_bone(armature_obj, "mixamorig:Head", "Head", "head")
        neck = find_pose_bone(armature_obj, "mixamorig:Neck", "Neck", "neck")

    def open_at_time(t):
        if not cues:
            return 0.08
        amt = 0.08
        for cue in cues:
            start = float(cue.get("start", 0))
            if start <= t:
                amt = OPEN_MAP.get(str(cue.get("value", "X")), 0.2)
            else:
                break
        return amt

    step = max(1, FPS // 12)
    for f in range(1, LAST + 1, step):
        t = (f - 1) / float(FPS)
        open_amt = open_at_time(t)

        if jaw is not None:
            keyframe_pose_bone(jaw, f, Euler((math.radians(28 * open_amt), 0, 0), "XYZ"))
        elif head is not None:
            talk = 0.04 * math.sin(t * 9.0)
            keyframe_pose_bone(
                head, f,
                Euler((math.radians(-6 * open_amt + talk), math.radians(3 * math.sin(t * 2.2)), 0), "XYZ")
            )
        elif mouth_obj is not None:
            base = (1.0, 1.0, 1.0)
            mouth_obj.scale = (base[0] * (0.95 + 0.35 * open_amt), base[1], base[2] * (0.15 + open_amt))
            mouth_obj.keyframe_insert(data_path="scale", frame=f)

        if neck is not None and head is not None:
            keyframe_pose_bone(
                neck, f,
                Euler((math.radians(2.5 * open_amt), math.radians(1.5 * math.sin(t * 1.7)), 0), "XYZ")
            )

    if head is not None:
        blink_times = [1.8, 4.2, 7.5, 10.2]
        for bt in blink_times:
            bf = max(1, int(bt * FPS))
            if bf >= LAST:
                continue
            keyframe_pose_bone(head, max(1, bf - 2), Euler((0, 0, 0), "XYZ"))
            keyframe_pose_bone(head, bf, Euler((math.radians(4), 0, 0), "XYZ"))
            keyframe_pose_bone(head, min(LAST, bf + 2), Euler((0, 0, 0), "XYZ"))

    if armature_obj and armature_obj.animation_data and armature_obj.animation_data.action:
        for fc in armature_obj.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

    if mouth_obj and mouth_obj.animation_data and mouth_obj.animation_data.action:
        for fc in mouth_obj.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"

    try:
        if armature_obj:
            bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass
    print(
        "FACIAL_OK",
        json.dumps({
            "jaw": getattr(jaw, "name", None),
            "head": getattr(head, "name", None),
            "neck": getattr(neck, "name", None),
            "proxy": getattr(mouth_obj, "name", None),
            "cues": len(cues),
        }),
        flush=True,
    )

apply_facial_and_lipsync(A.lipsync)

cube("H_BG", (0, -1.55, 0.52), (6.2, 0.07, 0.30), mat("HBg", (0.09, 0.10, 0.12), 0.4))
text_obj("H_TXT", headline[:62], (0, -1.58, 0.52), size=0.15, color=(0.98, 0.98, 0.99))
cube("T_BG", (0, -1.72, 0.22), (8.5, 0.08, 0.24), m_ticker)
tx = text_obj("T_TXT", (ticker + "  ·  ") * 2, (3.5, -1.75, 0.22), size=0.12, color=(1, 1, 1), align="LEFT")
for f in (1, LAST):
    tx.location = (3.8 - (f / max(1, LAST)) * 8.0, -1.75, 0.22)
    tx.keyframe_insert(data_path="location", frame=f)
if tx.animation_data and tx.animation_data.action:
    for fc in tx.animation_data.action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"

bpy.ops.object.camera_add(location=(0, -4.8, 1.55))
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

camkey(1, (0, -5.2, 1.65), (0, 0.1, 1.45), 36)
camkey(int(LAST * 0.35), (0.35, -4.4, 1.5), (0, 0.1, 1.55), 42)
camkey(int(LAST * 0.7), (-0.25, -4.6, 1.7), (0, 0.1, 1.7), 48)
camkey(LAST, (0, -4.3, 1.55), (0, 0.1, 1.55), 40)

bpy.ops.object.light_add(type="AREA", location=(-2.2, -2.4, 4.0))
L = bpy.context.object
L.data.energy = 900
L.data.size = 4.5
aim(L, (0, 0.1, 1.4))
bpy.ops.object.light_add(type="AREA", location=(2.4, 0.6, 3.4))
L2 = bpy.context.object
L2.data.energy = 500
L2.data.size = 3.2
aim(L2, (0, 0.1, 1.4))
bpy.ops.object.light_add(type="AREA", location=(0, -1.5, 2.8))
L3 = bpy.context.object
L3.data.energy = 250
L3.data.size = 2.5

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    scene.eevee.taa_render_samples = 12
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.filepath = os.path.abspath(A.output)
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.72, 0.76, 0.82)

os.makedirs(os.path.dirname(os.path.abspath(A.output)) or ".", exist_ok=True)
print("NEWSDESK_RENDER_START", json.dumps({"frames": LAST, "fps": FPS, "glb": use_glb}), flush=True)
bpy.ops.render.render(animation=True)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
