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
DUR = min(float(cfg.get("duration_seconds", 8)), 20.0)
LAST = max(16, int(FPS * DUR))

def load_json(path):
    return json.load(open(path))

char = load_json(seed["character"])
env = load_json(seed["environment"]) if seed.get("environment") else {}
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

def world_bbox(objects):
    mins = Vector((1e9, 1e9, 1e9))
    maxs = Vector((-1e9, -1e9, -1e9))
    found = False
    for o in objects:
        if o.type not in ("MESH", "ARMATURE", "EMPTY", "CURVE"):
            continue
        try:
            for corner in o.bound_box:
                w = o.matrix_world @ Vector(corner)
                mins.x = min(mins.x, w.x); mins.y = min(mins.y, w.y); mins.z = min(mins.z, w.z)
                maxs.x = max(maxs.x, w.x); maxs.y = max(maxs.y, w.y); maxs.z = max(maxs.z, w.z)
                found = True
        except Exception:
            continue
    if not found:
        return None
    return mins, maxs

def scale_root_to_size(root, target_width=None, target_height=None, min_scale=0.5, max_scale=80.0):
    bpy.context.view_layer.update()
    kids = [root] + list(root.children_recursive)
    bb = world_bbox(kids)
    if not bb:
        print("SCALE_SKIP no bbox", root.name, flush=True)
        return 1.0
    mins, maxs = bb
    size = maxs - mins
    sx = sy = 1.0
    if target_width and size.x > 1e-6:
        sx = target_width / size.x
    if target_height and size.z > 1e-6:
        sy = target_height / size.z
    if target_width and target_height:
        s = (sx + sy) * 0.5
    elif target_width:
        s = sx
    else:
        s = sy
    s = max(min_scale, min(max_scale, s))
    root.scale = (s, s, s)
    bpy.context.view_layer.update()
    print("SCALE", root.name, "factor", round(s, 3), "from_size", [round(v, 3) for v in size], flush=True)
    return s

def place_on_floor(root):
    bpy.context.view_layer.update()
    kids = [root] + list(root.children_recursive)
    bb = world_bbox(kids)
    if not bb:
        return
    mins, maxs = bb
    root.location.z -= mins.z
    bpy.context.view_layer.update()

m_floor = mat("Floor", (0.08, 0.10, 0.11), 0.4, metallic=0.15)
m_wall = mat("Wall", (0.04, 0.12, 0.08), 0.85)
m_ceil = mat("Ceil", (0.08, 0.09, 0.11), 0.9)
cube("FLOOR", (0, 0.5, -0.02), (22, 16, 0.08), m_floor)
cube("BACK", (0, 5.5, 2.6), (20, 0.12, 5.6), m_wall)
cube("LEFT", (-9.0, 0.5, 2.6), (0.12, 12, 5.6), m_wall)
cube("RIGHT", (9.0, 0.5, 2.6), (0.12, 12, 5.6), m_wall)
cube("CEIL", (0, 0.5, 5.0), (20, 12, 0.1), m_ceil)

presenter_root = None
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
    root.location = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root.rotation_euler = Euler((0, 0, 0), "XYZ")
    scale_root_to_size(root, target_width=3.8, min_scale=0.5, max_scale=100.0)
    place_on_floor(root)
    root.location.y = 0.0
    desk_root = root
    bb = world_bbox([root] + list(root.children_recursive))
    if bb:
        print("DESK_BBOX", [round(v, 3) for v in (bb[1] - bb[0])], flush=True)
    print("DESK_OK objects=", len(after), flush=True)
    return True

def import_glb(path):
    global presenter_root, armature_obj, mesh_with_shapes, imported_actions
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

    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
    root = bpy.context.object
    root.name = "PRESENTER_ROOT"
    for o in after:
        if o.parent is None:
            o.parent = root
    root.location = (0.0, 0.0, 0.0)
    root.scale = (1.0, 1.0, 1.0)
    root.rotation_euler = Euler((0, 0, 0), "XYZ")
    scale_root_to_size(root, target_height=1.55, min_scale=0.3, max_scale=50.0)
    place_on_floor(root)

    if desk_root is not None:
        bpy.context.view_layer.update()
        dbb = world_bbox([desk_root] + list(desk_root.children_recursive))
        if dbb:
            dmins, dmaxs = dbb
            cx = (dmins.x + dmaxs.x) * 0.5
            cy = (dmins.y + dmaxs.y) * 0.5
            depth = (dmaxs.y - dmins.y)
            root.location.x = cx
            root.location.y = cy + depth * 0.14
            place_on_floor(root)
            root.location.z -= 0.22
            print("CHAR_SEAT chair", round(root.location.x, 3), round(root.location.y, 3), round(root.location.z, 3), flush=True)
    else:
        root.location.y = 0.0

    presenter_root = root
    bpy.context.view_layer.update()
    bb = world_bbox([root] + list(root.children_recursive))
    if bb:
        print("CHAR_BBOX", [round(v, 3) for v in (bb[1] - bb[0])], flush=True)

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
        plan = [{"name": "Sit idle (chair)", "start": 0.0, "end": DUR}]
    if resolve_action("Sit idle (chair)") is None and resolve_action("Idle"):
        plan = [{"name": "Idle", "start": 0.0, "end": DUR}]
    elif resolve_action("Talk with gestures") is None and resolve_action("Talk"):
        plan = [{"name": "Talk", "start": 0.0, "end": DUR}]

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
        for nm in ("Sit idle (chair)", "Idle", "Talk with gestures", "Talk"):
            act = resolve_action(nm)
            if act:
                armature_obj.animation_data.action = act
                print("ANIM_FALLBACK_ACTION", act.name, flush=True)
                used = 1
                break
    print("ANIM_PLAN_APPLIED", used, flush=True)

import_desk(desk_glb)
if use_glb:
    ok = import_glb(glb_path)
    if ok:
        apply_animation_plan()
    else:
        print("CHARACTER_IMPORT_FAIL", flush=True)
else:
    print("CHARACTER_NO_GLB", flush=True)

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
    print("FACIAL_OK", json.dumps({"jaw": getattr(jaw, "name", None), "head": getattr(head, "name", None), "shapes": bool(sk), "cues": len(cues)}), flush=True)

apply_facial_and_lipsync(A.lipsync)

# --- Broadcast lower-third (red news bar + green brand) ---
headline = str(seed.get("headline") or "9jaBeacon News")[:64]

def emission_mat(name, color, strength=3.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*color, 1)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

m_red = emission_mat("LT_RED", (0.85, 0.08, 0.12), 4.0)
cube("LT_RED_BAR", (0.0, -2.85, 0.22), (3.6, 0.02, 0.035), m_red)
m_green = emission_mat("LT_GREEN", (0.05, 0.65, 0.32), 3.5)
cube("LT_GREEN_BAR", (0.0, -2.85, 0.32), (3.6, 0.02, 0.12), m_green)
m_plate = mat("LT_PLATE", (0.02, 0.03, 0.04), 0.7)
cube("LT_PLATE", (0.0, -2.84, 0.48), (3.6, 0.015, 0.22), m_plate)
try:
    bpy.ops.object.text_add(location=(-1.65, -2.82, 0.42))
    t = bpy.context.object
    t.name = "LT_HEADLINE"
    t.data.body = headline
    t.data.size = 0.09
    t.data.extrude = 0.002
    t.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    mt = mat("LT_TEXT", (1.0, 1.0, 1.0), 0.3)
    if t.data.materials:
        t.data.materials[0] = mt
    else:
        t.data.materials.append(mt)
except Exception as e:
    print("LT_TEXT_FAIL", e, flush=True)
try:
    bpy.ops.object.text_add(location=(-1.65, -2.82, 0.28))
    t2 = bpy.context.object
    t2.name = "LT_BRAND"
    t2.data.body = "9jaBeacon"
    t2.data.size = 0.055
    t2.data.extrude = 0.001
    t2.rotation_euler = Euler((math.radians(90), 0, 0), "XYZ")
    mt2 = mat("LT_BRAND_MAT", (0.9, 1.0, 0.92), 0.3)
    if t2.data.materials:
        t2.data.materials[0] = mt2
    else:
        t2.data.materials.append(mt2)
except Exception as e:
    print("LT_BRAND_FAIL", e, flush=True)
print("LOWER_THIRD_OK", headline[:40], flush=True)

bpy.ops.object.camera_add(location=(0, -5.2, 1.15))
cam = bpy.context.object
cam.data.lens = 28
bpy.context.scene.camera = cam

def camkey(f, loc, target, lens):
    cam.location = loc
    aim(cam, target)
    cam.data.lens = lens
    cam.keyframe_insert(data_path="location", frame=f)
    cam.keyframe_insert(data_path="rotation_euler", frame=f)
    cam.data.keyframe_insert(data_path="lens", frame=f)

camkey(1, (0.0, -5.2, 1.15), (0.0, 0.3, 0.85), 28)
camkey(int(LAST * 0.22), (0.0, -4.6, 1.05), (0.0, 0.2, 0.90), 30)
camkey(int(LAST * 0.45), (0.05, -4.0, 1.25), (0.0, 0.12, 1.15), 34)
camkey(int(LAST * 0.70), (0.1, -3.5, 1.45), (0.0, 0.10, 1.32), 38)
camkey(LAST, (0.0, -3.2, 1.52), (0.0, 0.08, 1.35), 40)
set_linear_interp(cam)

bpy.ops.object.light_add(type="AREA", location=(-2.8, -2.8, 3.8))
L = bpy.context.object
L.data.energy = 380
L.data.size = 5.0
L.data.color = (0.95, 1.0, 0.96)
aim(L, (0, 0.1, 1.2))

bpy.ops.object.light_add(type="AREA", location=(2.8, -1.2, 3.4))
L2 = bpy.context.object
L2.data.energy = 200
L2.data.size = 4.0
L2.data.color = (0.75, 1.0, 0.85)
aim(L2, (0, 0.1, 1.2))

bpy.ops.object.light_add(type="AREA", location=(0.0, 2.5, 3.6))
L3 = bpy.context.object
L3.data.energy = 140
L3.data.size = 3.5
L3.data.color = (0.7, 1.0, 0.8)
aim(L3, (0, 0.1, 1.1))

bpy.ops.object.light_add(type="AREA", location=(0.0, -1.8, 0.9))
L4 = bpy.context.object
L4.data.energy = 120
L4.data.size = 2.8
L4.data.color = (0.2, 0.95, 0.45)
aim(L4, (0, 0.0, 0.6))

world = bpy.context.scene.world
if world is None:
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs[0].default_value = (0.04, 0.08, 0.06, 1)
    bg.inputs[1].default_value = 0.22

scene = bpy.context.scene
scene.frame_start = 1
scene.frame_end = LAST
scene.render.fps = FPS
try:
    scene.render.engine = "BLENDER_EEVEE_NEXT"
except Exception:
    scene.render.engine = "BLENDER_EEVEE"
if hasattr(scene, "eevee"):
    scene.eevee.taa_render_samples = 10 if LAST <= 100 else 8
scene.render.resolution_x = W
scene.render.resolution_y = H
out_abs = os.path.abspath(A.output)
frames_dir = out_abs + "_frames"
os.makedirs(frames_dir, exist_ok=True)
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.filepath = os.path.join(frames_dir, "frame_")
scene.view_settings.view_transform = "Standard"

print("NEWSDESK_RENDER_START", json.dumps({"frames": LAST, "fps": FPS, "glb": use_glb, "desk": bool(desk_root), "anims": len(imported_actions), "mode": "png", "res": [W, H]}), flush=True)
bpy.ops.render.render(animation=True)

pattern = os.path.join(frames_dir, "frame_%04d.png")
cmd = ["ffmpeg", "-y", "-framerate", str(FPS), "-i", pattern, "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out_abs]
print("FFMPEG_ASSEMBLE", " ".join(cmd), flush=True)
subprocess.check_call(cmd)
print("NEWSDESK_RENDER_COMPLETE", A.output, flush=True)
