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
DUR = min(float(cfg.get("duration_seconds", 12)), 22.0)
LAST = max(24, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"]) if seed.get("environment") else {}
headline = seed.get("headline", "9jaBeacon")
ticker = seed.get("ticker", "9jaBeacon · www.9jabeacon.name.ng")
boards_cfg = seed.get("boards", [{"label": "A"}, {"label": "B"}, {"label": "C"}])
anim_plan = seed.get("animation_plan") or []
use_glb = bool(char.get("use_glb")) and bool(char.get("model_glb"))
glb_path = char.get("model_glb", "")

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

def mat(n, c, r=0.45, metallic=0.0):
    m = bpy.data.materials.new(n)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*c, 1)
    bsdf.inputs["Roughness"].default_value = r
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = metallic
    return m

def cube(n, loc, dim, m, b=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = n
    o.dimensions = dim
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if b > 0:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = b
        mod.segments = 2
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

wall_c = tuple(env.get("wall", [0.07, 0.11, 0.16]))
accent_c = tuple(env.get("accent", [0.10, 0.62, 0.48]))
desk_c = tuple(env.get("desk", [0.09, 0.10, 0.12]))
floor_c = tuple(env.get("floor", [0.14, 0.15, 0.18]))

m_black = mat("Stick", (0.05, 0.05, 0.06), 0.35)
m_wall = mat("Wall", wall_c, 0.82)
m_floor = mat("Floor", floor_c, 0.45, metallic=0.15)
m_desk = mat("Desk", desk_c, 0.28, metallic=0.25)
m_accent = mat("Accent", accent_c, 0.22, metallic=0.35)
m_board = mat("Board", (0.12, 0.14, 0.18), 0.30, metallic=0.2)
m_screen = mat("Screen", (0.08, 0.22, 0.38), 0.15)
m_glass = mat("Glass", (0.55, 0.65, 0.72), 0.08, metallic=0.4)
m_ticker = mat("Ticker", (0.72, 0.06, 0.09), 0.28)
m_white = mat("White", (0.95, 0.96, 0.97), 0.35)
m_panel = mat("Panel", (0.16, 0.18, 0.22), 0.4)

cube("FLOOR", (0, 0.3, -0.04), (16, 12, 0.12), m_floor)
cube("BACK", (0, 3.4, 2.2), (14, 0.14, 4.6), m_wall)
cube("LEFT", (-6.2, 0.5, 2.2), (0.14, 8, 4.6), m_wall)
cube("RIGHT", (6.2, 0.5, 2.2), (0.14, 8, 4.6), m_wall)
cube("CEIL", (0, 0.5, 4.35), (14, 8, 0.1), mat("Ceil", (0.12, 0.14, 0.18), 0.7))
cube("STRIPE_TOP", (0, 3.28, 3.55), (10, 0.08, 0.18), m_accent)
cube("STRIPE_MID", (0, 3.28, 0.55), (10, 0.06, 0.10), m_accent)
cube("COL_L", (-4.2, 3.2, 2.0), (0.22, 0.22, 3.6), m_panel)
cube("COL_R", (4.2, 3.2, 2.0), (0.22, 0.22, 3.6), m_panel)

cube("DESK_TOP", (0, -0.05, 0.98), (4.2, 1.45, 0.09), m_desk)
cube("DESK_FRONT", (0, -0.72, 0.50), (4.1, 0.10, 0.95), m_desk)
cube("DESK_EDGE", (0, -0.78, 0.95), (4.15, 0.06, 0.06), m_accent)
cube("LOGO_PLATE", (0, -0.82, 0.52), (1.55, 0.05, 0.32), m_accent)
text_obj("LOGO", "9jaBeacon", (0, -0.86, 0.52), size=0.14, color=(0.95, 0.98, 0.97))

for i, (bx, by, bz) in enumerate([(-2.55, 2.85, 2.05), (0.0, 2.9, 2.2), (2.55, 2.85, 2.05)]):
    cube(f"BF{i}", (bx, by, bz), (1.85, 0.08, 1.25), m_board)
    cube(f"BP{i}", (bx, by - 0.06, bz), (1.68, 0.04, 1.08), m_screen)
    cube(f"BG{i}", (bx, by - 0.02, bz), (1.78, 0.03, 1.18), m_glass, b=0.004)
    lab = boards_cfg[i].get("label", f"{i+1}") if i < len(boards_cfg) else f"{i+1}"
    text_obj(f"BL{i}", lab, (bx, by - 0.12, bz + 0.35), size=0.16, color=(0.95, 0.97, 0.98))

presenter_root = None
mouth_obj = None
armature_obj = None
mesh_with_shapes = None
pose_bones = {}
imported_actions = {}

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
    global presenter_root, mouth_obj, armature_obj, mesh_with_shapes, imported_actions
    if not path or not os.path.isfile(path):
        print("GLB_MISSING", path, flush=True)
        return False
    before = set(bpy.data.objects.keys())
    before_actions = set(bpy.data.actions.keys())
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    after = [o for o in bpy.data.objects if o.name not in before]
    if not after:
        print("GLB_IMPORT_EMPTY", flush=True)
        return False

    for a in bpy.data.actions:
        if a.name not in before_actions:
            imported_actions[a.name] = a
    print("GLB_ACTIONS", list(imported_actions.keys())[:25], "count", len(imported_actions), flush=True)

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.15, 0.0))
    root = bpy.context.object
    root.name = "PRESENTER_ROOT"
    for o in after:
        if o.parent is None:
            o.parent = root
    root.location = (0, 0.22, 0.0)
    root.scale = (0.95, 0.95, 0.95)
    root.rotation_euler = Euler((0, 0, 0), "XYZ")
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
        jaw = find_pose_bone(armature_obj, "jaw", "Jaw", "mixamorig:Jaw")
        head = find_pose_bone(armature_obj, "head", "Head", "mixamorig:Head")
        print("BONES jaw=", getattr(jaw, "name", None), "head=", getattr(head, "name", None), flush=True)
        try:
            bpy.ops.object.mode_set(mode="OBJECT")
        except Exception:
            pass

    for o in after:
        if o.type == "MESH" and o.data.shape_keys and o.data.shape_keys.key_blocks:
            mesh_with_shapes = o
            print("SHAPE_KEYS", [kb.name for kb in o.data.shape_keys.key_blocks][:20], flush=True)
            break

    print("GLB_OK objects=", len(after), flush=True)
    return True

def resolve_action(name):
    if not name:
        return None
    if name in imported_actions:
        return imported_actions[name]
    lower = {k.lower(): v for k, v in imported_actions.items()}
    if name.lower() in lower:
        return lower[name.lower()]
    for k, v in imported_actions.items():
        if name.lower() in k.lower() or k.lower() in name.lower():
            return v
    return None

def apply_animation_plan():
    """Sequential body clips via NLA — one track per strip (no overlap)."""
    if armature_obj is None:
        print("ANIM_PLAN skip — no armature", flush=True)
        return
    plan = list(anim_plan) if anim_plan else []
    if not plan:
        plan = [
            {"name": "Sit idle (chair)", "start": 0.0, "end": 2.5},
            {"name": "Talk with gestures", "start": 2.5, "end": DUR - 2.0},
            {"name": "Sit idle (chair)", "start": DUR - 2.0, "end": DUR},
        ]
    # Prefer Talk if specific names missing
    if resolve_action("Talk with gestures") is None and resolve_action("Talk"):
        plan = [{"name": "Talk", "start": 0.0, "end": DUR}]
    if resolve_action("Sit idle (chair)") is None and resolve_action("Idle") and len(plan) > 1:
        for step in plan:
            if "sit" in step.get("name", "").lower():
                step["name"] = "Idle"

    if armature_obj.animation_data is None:
        armature_obj.animation_data_create()
    # Drop any previous NLA tracks
    while armature_obj.animation_data.nla_tracks:
        armature_obj.animation_data.nla_tracks.remove(armature_obj.animation_data.nla_tracks[0])
    armature_obj.animation_data.action = None

    used = 0
    cursor = 1
    for i, step in enumerate(plan):
        act = resolve_action(step.get("name", ""))
        if act is None:
            print("ANIM_MISS", step.get("name"), flush=True)
            continue
        f0 = max(1, int(float(step.get("start", 0)) * FPS) + 1)
        f1 = min(LAST, int(float(step.get("end", DUR)) * FPS))
        # Force non-overlapping sequential placement if seed overlaps
        if f0 < cursor:
            f0 = cursor
        if f1 <= f0:
            f1 = min(LAST, f0 + max(FPS, 12))
        cursor = f1 + 1

        track = armature_obj.animation_data.nla_tracks.new()
        track.name = f"clip_{i}_{act.name[:24]}"
        try:
            strip = track.strips.new(act.name[:40], f0, act)
            strip.frame_end = f1
            # loop action if strip longer than source
            try:
                strip.scale = 1.0
                if hasattr(strip, "repeat"):
                    src_len = max(1, int(act.frame_range[1] - act.frame_range[0]))
                    need = max(1, f1 - f0)
                    strip.repeat = max(1.0, need / float(src_len))
            except Exception:
                pass
            strip.blend_type = "REPLACE"
            strip.extrapolation = "HOLD"
            used += 1
            print("ANIM_STRIP", act.name, f0, f1, flush=True)
        except Exception as e:
            print("ANIM_STRIP_FAIL", act.name, e, flush=True)
            # Fallback: assign as active action for whole range
            try:
                armature_obj.animation_data.action = act
                used += 1
                print("ANIM_ACTION_FALLBACK", act.name, flush=True)
            except Exception as e2:
                print("ANIM_ACTION_FAIL", e2, flush=True)

    if used == 0:
        for nm in ("Talk with gestures", "Talk", "Idle", "Sit idle (chair)"):
            act = resolve_action(nm)
            if act:
                armature_obj.animation_data.action = act
                print("ANIM_FALLBACK_ACTION", act.name, flush=True)
                used = 1
                break
    print("ANIM_PLAN_APPLIED", used, flush=True)

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
    mouth_obj = cube("MOUTH", (0, -0.07, 1.92), (0.07, 0.015, 0.02), m_white, 0.002)
    mouth_obj.parent = root

if use_glb:
    ok = import_glb(glb_path)
    if not ok:
        print("FALLBACK_STICKMAN", flush=True)
        build_stickman()
    else:
        apply_animation_plan()
else:
    build_stickman()

OPEN_MAP = {
    "A": 0.15, "B": 0.55, "C": 0.90, "D": 0.72, "E": 0.48,
    "F": 0.35, "G": 0.52, "H": 0.28, "X": 0.05,
}
VISEME_MAP = {
    "A": "viseme_aa", "B": "viseme_PP", "C": "viseme_E",
    "D": "viseme_aa", "E": "viseme_E", "F": "viseme_U",
    "G": "viseme_FF", "H": "viseme_O", "X": None,
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

    jaw = head = neck = None
    if armature_obj is not None:
        bpy.context.view_layer.objects.active = armature_obj
        try:
            bpy.ops.object.mode_set(mode="POSE")
        except Exception:
            pass
        jaw = find_pose_bone(armature_obj, "jaw", "Jaw", "mixamorig:Jaw")
        head = find_pose_bone(armature_obj, "head", "Head", "mixamorig:Head")
        neck = find_pose_bone(armature_obj, "neck03", "neck02", "neck01", "Neck", "mixamorig:Neck")

    sk = None
    if mesh_with_shapes and mesh_with_shapes.data.shape_keys:
        sk = mesh_with_shapes.data.shape_keys
        if sk.animation_data is None:
            sk.animation_data_create()

    def open_at_time(t):
        if not cues:
            return 0.08, "X"
        amt, val = 0.08, "X"
        for cue in cues:
            start = float(cue.get("start", 0))
            if start <= t:
                val = str(cue.get("value", "X"))
                amt = OPEN_MAP.get(val, 0.2)
            else:
                break
        return amt, val

    step = max(1, FPS // 12)
    for f in range(1, LAST + 1, step):
        t = (f - 1) / float(FPS)
        open_amt, cue_val = open_at_time(t)

        if sk is not None:
            blocks = sk.key_blocks
            if "jawOpen" in blocks:
                blocks["jawOpen"].value = min(1.0, open_amt)
                blocks["jawOpen"].keyframe_insert(data_path="value", frame=f)
            for vn in ("viseme_aa", "viseme_E", "viseme_O", "viseme_U", "viseme_PP", "viseme_FF"):
                if vn in blocks:
                    blocks[vn].value = 0.0
            target = VISEME_MAP.get(cue_val)
            if target and target in blocks:
                blocks[target].value = min(1.0, open_amt * 0.85)
                blocks[target].keyframe_insert(data_path="value", frame=f)
            if "eyeBlinkLeft" in blocks and f % (FPS * 3) < 2:
                blocks["eyeBlinkLeft"].value = 1.0
                blocks["eyeBlinkLeft"].keyframe_insert(data_path="value", frame=f)
                if "eyeBlinkRight" in blocks:
                    blocks["eyeBlinkRight"].value = 1.0
                    blocks["eyeBlinkRight"].keyframe_insert(data_path="value", frame=f)

        if jaw is not None:
            keyframe_pose_bone(jaw, f, Euler((math.radians(22 * open_amt), 0, 0), "XYZ"))
        elif head is not None:
            talk = 0.03 * math.sin(t * 9.0)
            keyframe_pose_bone(
                head, f,
                Euler((math.radians(-5 * open_amt + talk), math.radians(2.5 * math.sin(t * 2.0)), 0), "XYZ")
            )
        elif mouth_obj is not None:
            mouth_obj.scale = (0.95 + 0.35 * open_amt, 1.0, 0.15 + open_amt)
            mouth_obj.keyframe_insert(data_path="scale", frame=f)

        if neck is not None:
            keyframe_pose_bone(
                neck, f,
                Euler((math.radians(2.0 * open_amt), math.radians(1.2 * math.sin(t * 1.5)), 0), "XYZ")
            )

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
            "shapes": bool(sk),
            "cues": len(cues),
        }),
        flush=True,
    )

apply_facial_and_lipsync(A.lipsync)

cube("H_BG", (0, -1.55, 0.48), (6.4, 0.08, 0.32), mat("HBg", (0.06, 0.08, 0.10), 0.35))
cube("H_ACCENT", (-2.9, -1.55, 0.48), (0.08, 0.09, 0.32), m_accent)
text_obj("H_TXT", headline[:58], (0.15, -1.58, 0.48), size=0.14, color=(0.98, 0.98, 0.99))
cube("T_BG", (0, -1.72, 0.18), (9.0, 0.08, 0.22), m_ticker)
tx = text_obj("T_TXT", (ticker + "  ·  ") * 2, (3.8, -1.75, 0.18), size=0.11, color=(1, 1, 1), align="LEFT")
for f in (1, LAST):
    tx.location = (4.0 - (f / max(1, LAST)) * 9.0, -1.75, 0.18)
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

camkey(1, (0, -5.0, 1.6), (0, 0.2, 1.35), 36)
camkey(int(LAST * 0.3), (0.4, -4.3, 1.45), (0, 0.2, 1.5), 42)
camkey(int(LAST * 0.65), (-0.3, -4.5, 1.65), (0, 0.2, 1.55), 46)
camkey(LAST, (0, -4.2, 1.5), (0, 0.2, 1.45), 40)

bpy.ops.object.light_add(type="AREA", location=(-2.4, -2.6, 3.8))
L = bpy.context.object
L.data.energy = 1100
L.data.size = 4.8
aim(L, (0, 0.2, 1.4))
bpy.ops.object.light_add(type="AREA", location=(2.6, 0.4, 3.2))
L2 = bpy.context.object
L2.data.energy = 550
L2.data.size = 3.5
aim(L2, (0, 0.2, 1.4))
bpy.ops.object.light_add(type="AREA", location=(0, 2.8, 3.6))
L3 = bpy.context.object
L3.data.energy = 400
L3.data.size = 3.0
aim(L3, (0, 0.2, 1.3))
bpy.ops.object.light_add(type="AREA", location=(0, -1.2, 2.5))
L4 = bpy.context.object
L4.data.energy = 280
L4.data.size = 2.2

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    scene.eevee.taa_render_samples = 16
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.image_settings.file_format = "FFMPEG"
scene.render.ffmpeg.format = "MPEG4"
scene.render.ffmpeg.codec = "H264"
scene.render.ffmpeg.constant_rate_factor = "MEDIUM"
scene.render.ffmpeg.ffmpeg_preset = "GOOD"
scene.render.filepath = os.path.abspath(A.output)
scene.view_settings.view_transform = "Standard"
scene.world.color = (0.08, 0.10, 0.14)

os.makedirs(os.path.dirname(os.path.abspath(A.output)) or ".", exist_ok=True)
print("NEWSDESK_RENDER_START", json.dumps({"frames": LAST, "fps": FPS, "glb": use_glb, "anims": len(imported_actions)}), flush=True)
bpy.ops.render.render(animation=True)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
