import bpy, math, json, os, sys, argparse, subprocess
from mathutils import Vector, Euler

av = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
p = argparse.ArgumentParser()
p.add_argument("--seed", required=True)
p.add_argument("--output", required=True)
p.add_argument("--lipsync", default="", help="Path to Rhubarb JSON mouth cues")
A = p.parse_args(av)

seed = json.load(open(A.seed))
cfg = seed["project"]
FPS = min(int(cfg.get("fps", 16)), 24)
W = min(int(cfg.get("width", 960)), 1280)
H = min(int(cfg.get("height", 540)), 720)
DUR = min(float(cfg.get("duration_seconds", 8)), 18.0)
LAST = max(16, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"]) if seed.get("environment") else {}
headline = seed.get("headline", "9jaBeacon")
anim_plan = seed.get("animation_plan") or []
use_glb = bool(char.get("use_glb")) and bool(char.get("model_glb"))
glb_path = char.get("model_glb", "")
desk_glb = seed.get("desk_glb") or "assets/presenter/Newsdesk.glb"

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

def cube(n, loc, dim, m, b=0.0):
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

def aim(o, t):
    o.rotation_euler = (Vector(t) - o.location).to_track_quat("-Z", "Y").to_euler()

def set_linear_interp(obj):
    try:
        ad = getattr(obj, "animation_data", None)
        if not ad or not ad.action:
            return
        act = ad.action
        fcurves = getattr(act, "fcurves", None)
        if fcurves is None:
            try:
                for layer in getattr(act, "layers", []) or []:
                    for strip in getattr(layer, "strips", []) or []:
                        ch = getattr(strip, "channelbag", None) or getattr(strip, "action", None)
                        fcs = getattr(ch, "fcurves", None) if ch else None
                        if fcs:
                            for fc in fcs:
                                for kp in fc.keyframe_points:
                                    kp.interpolation = "LINEAR"
            except Exception as e:
                print("LINEAR_SKIP", e, flush=True)
            return
        for fc in fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = "LINEAR"
    except Exception as e:
        print("LINEAR_FAIL", e, flush=True)

# Soft neutral backdrop only (no full studio yet)
m_floor = mat("Floor", (0.12, 0.13, 0.15), 0.55, metallic=0.05)
m_wall = mat("Wall", (0.10, 0.12, 0.16), 0.85)
m_ceil = mat("Ceil", (0.08, 0.09, 0.11), 0.9)
cube("FLOOR", (0, 0.5, -0.02), (18, 14, 0.08), m_floor)
cube("BACK", (0, 4.0, 2.4), (16, 0.12, 5.2), m_wall)
cube("LEFT", (-7.0, 0.5, 2.4), (0.12, 10, 5.2), m_wall)
cube("RIGHT", (7.0, 0.5, 2.4), (0.12, 10, 5.2), m_wall)
cube("CEIL", (0, 0.5, 4.6), (16, 10, 0.1), m_ceil)

presenter_root = None
mouth_obj = None
armature_obj = None
mesh_with_shapes = None
pose_bones = {}
imported_actions = {}
desk_root = None

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

def import_desk(path):
    global desk_root
    if not path or not os.path.isfile(path):
        print("DESK_MISSING", path, flush=True)
        return False
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
    after = [o for o in bpy.data.objects if o.name not in before]
    if not after:
        print("DESK_IMPORT_EMPTY", flush=True)
        return False
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root = bpy.context.object
    root.name = "DESK_ROOT"
    for o in after:
        if o.parent is None:
            o.parent = root
    # Sit desk at origin; scale conservatively so character fits
    root.location = (0.0, 0.35, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root.rotation_euler = Euler((0, 0, 0), "XYZ")
    desk_root = root
    print("DESK_OK objects=", len(after), flush=True)
    return True

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
    # Seat presenter behind desk; slight scale so proportions look natural
    root.location = (0.0, 0.15, 0.0)
    root.scale = (0.92, 0.92, 0.92)
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
    if armature_obj is None:
        print("ANIM_PLAN skip — no armature", flush=True)
        return
    plan = list(anim_plan) if anim_plan else []
    if not plan:
        plan = [
            {"name": "Sit idle (chair)", "start": 0.0, "end": 1.2},
            {"name": "Talk with gestures", "start": 1.2, "end": DUR - 1.2},
            {"name": "Sit idle (chair)", "start": DUR - 1.2, "end": DUR},
        ]
    if resolve_action("Talk with gestures") is None and resolve_action("Talk"):
        plan = [{"name": "Talk", "start": 0.0, "end": DUR}]
    if resolve_action("Sit idle (chair)") is None and resolve_action("Idle") and len(plan) > 1:
        for step in plan:
            if "sit" in step.get("name", "").lower():
                step["name"] = "Idle"

    if armature_obj.animation_data is None:
        armature_obj.animation_data_create()
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

# Desk first, then character
import_desk(desk_glb)
if use_glb:
    ok = import_glb(glb_path)
    if ok:
        apply_animation_plan()
    else:
        print("CHARACTER_IMPORT_FAIL", flush=True)
else:
    print("CHARACTER_NO_GLB", flush=True)

# Softer lipsync — avoid sucking/popping mouth
OPEN_MAP = {
    "A": 0.10, "B": 0.32, "C": 0.55, "D": 0.42, "E": 0.28,
    "F": 0.22, "G": 0.30, "H": 0.18, "X": 0.03,
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
            return 0.05, "X"
        amt, val = 0.05, "X"
        for cue in cues:
            start = float(cue.get("start", 0))
            if start <= t:
                val = str(cue.get("value", "X"))
                amt = OPEN_MAP.get(val, 0.15)
            else:
                break
        return amt, val

    step = max(1, FPS // 10)
    for f in range(1, LAST + 1, step):
        t = (f - 1) / float(FPS)
        open_amt, cue_val = open_at_time(t)

        if sk is not None:
            blocks = sk.key_blocks
            if "jawOpen" in blocks:
                # Soften jawOpen — was over-driving into "sucking" look
                blocks["jawOpen"].value = min(0.55, open_amt * 0.7)
                blocks["jawOpen"].keyframe_insert(data_path="value", frame=f)
            for vn in ("viseme_aa", "viseme_E", "viseme_O", "viseme_U", "viseme_PP", "viseme_FF"):
                if vn in blocks:
                    blocks[vn].value = 0.0
            target = VISEME_MAP.get(cue_val)
            if target and target in blocks:
                blocks[target].value = min(0.6, open_amt * 0.65)
                blocks[target].keyframe_insert(data_path="value", frame=f)
            if "eyeBlinkLeft" in blocks and f % max(1, FPS * 4) < 2:
                blocks["eyeBlinkLeft"].value = 1.0
                blocks["eyeBlinkLeft"].keyframe_insert(data_path="value", frame=f)
                if "eyeBlinkRight" in blocks:
                    blocks["eyeBlinkRight"].value = 1.0
                    blocks["eyeBlinkRight"].keyframe_insert(data_path="value", frame=f)

        if jaw is not None:
            # Gentle jaw (was ~22 deg → looked robotic)
            keyframe_pose_bone(jaw, f, Euler((math.radians(10 * open_amt), 0, 0), "XYZ"))
        elif head is not None:
            talk = 0.015 * math.sin(t * 7.0)
            keyframe_pose_bone(
                head, f,
                Euler((math.radians(-2.5 * open_amt + talk), math.radians(1.5 * math.sin(t * 1.6)), 0), "XYZ")
            )

        if neck is not None:
            keyframe_pose_bone(
                neck, f,
                Euler((math.radians(1.0 * open_amt), math.radians(0.8 * math.sin(t * 1.2)), 0), "XYZ")
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
            "soft": True,
        }),
        flush=True,
    )

apply_facial_and_lipsync(A.lipsync)

# Camera: far → zoom in → slight arc around desk
bpy.ops.object.camera_add(location=(0, -7.5, 2.2))
cam = bpy.context.object
cam.data.lens = 35
bpy.context.scene.camera = cam

def camkey(f, loc, target, lens):
    cam.location = loc
    aim(cam, target)
    cam.data.lens = lens
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
    cam.data.keyframe_insert(data_path="lens", frame=f)

# Look-at point near presenter chest/desk height
look = (0.0, 0.2, 1.25)
camkey(1, (0.0, -8.2, 2.6), look, 32)                    # far wide
camkey(int(LAST * 0.28), (0.15, -5.4, 1.85), look, 38)   # push in
camkey(int(LAST * 0.55), (0.55, -4.3, 1.55), (0.05, 0.2, 1.35), 42)  # closer + slight right
camkey(int(LAST * 0.78), (-0.35, -4.0, 1.50), (0.0, 0.2, 1.40), 44)  # arc left
camkey(LAST, (0.1, -3.7, 1.45), (0.0, 0.15, 1.38), 46)   # medium close
set_linear_interp(cam)

# Soft realistic lighting (less flat / less cartoon)
bpy.ops.object.light_add(type="AREA", location=(-2.8, -3.2, 4.0))
L = bpy.context.object
L.data.energy = 650
L.data.size = 5.5
L.data.color = (1.0, 0.97, 0.94)
aim(L, (0, 0.2, 1.2))

bpy.ops.object.light_add(type="AREA", location=(3.0, -1.0, 3.4))
L2 = bpy.context.object
L2.data.energy = 320
L2.data.size = 4.0
L2.data.color = (0.85, 0.92, 1.0)  # cool fill
aim(L2, (0, 0.2, 1.2))

bpy.ops.object.light_add(type="AREA", location=(0.0, 2.5, 3.8))
L3 = bpy.context.object
L3.data.energy = 220
L3.data.size = 3.5
L3.data.color = (1.0, 1.0, 1.0)
aim(L3, (0, 0.2, 1.1))

bpy.ops.object.light_add(type="AREA", location=(0.0, -2.0, 2.2))
L4 = bpy.context.object
L4.data.energy = 120
L4.data.size = 2.5
L4.data.color = (1.0, 0.95, 0.9)
aim(L4, (0, 0.2, 1.0))

# Soft world ambient so skin isn't pure black in shadows
world = bpy.context.scene.world
if world is None:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.08, 0.09, 0.11, 1)
    bg.inputs[1].default_value = 0.35

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    # 8 samples: cleaner than 4, still CI-friendly
    scene.eevee.taa_render_samples = 8 if LAST <= 160 else 12
scene.render.resolution_x = W
scene.render.resolution_y = H
out_abs = os.path.abspath(A.output)
frames_dir = out_abs + "_frames"
os.makedirs(frames_dir, exist_ok=True)
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = os.path.join(frames_dir, "frame_")
scene.view_settings.view_transform = "Standard"

print(
    "NEWSDESK_RENDER_START",
    json.dumps({
        "frames": LAST,
        "fps": FPS,
        "glb": use_glb,
        "desk": bool(desk_root),
        "anims": len(imported_actions),
        "mode": "png",
        "res": [W, H],
    }),
    flush=True,
)
bpy.ops.render.render(animation=True)

pattern = os.path.join(frames_dir, "frame_%04d.png")
cmd = [
    "ffmpeg", "-y", "-framerate", str(FPS),
    "-i", pattern,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    out_abs,
]
print("FFMPEG_ASSEMBLE", " ".join(cmd), flush=True)
subprocess.check_call(cmd)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
