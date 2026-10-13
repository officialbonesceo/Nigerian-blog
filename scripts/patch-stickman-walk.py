#!/usr/bin/env python3
"""Apply walk/chair detachment patches to StickmanStudio.astro."""
from pathlib import Path

path = Path("src/components/StickmanStudio.astro")
text = path.read_text(encoding="utf-8")

text = text.replace(
    "walkAnimInterval: null,",
    "walkAnimInterval: null,\n      walkBob: 0,\n      preferDeskAfterWalk: false,",
    1,
)

old_t = """    function updateActorTransform() {
      const actorGroup = document.getElementById('sm-actor-group');
      if (!actorGroup) return;
      const facing = smState.motion === 'walk_left' ? -1 : 1;
      // Mirror cleanly around center X=300 without displacing joints
      if (facing === -1) {
        actorGroup.setAttribute('transform', `translate(${smState.stageX}, 0) translate(600, 0) scale(-1, 1)`);
      } else {
        actorGroup.setAttribute('transform', `translate(${smState.stageX}, 0)`);
      }
    }"""

new_t = """    function updateActorTransform() {
      const actorGroup = document.getElementById('sm-actor-group');
      if (!actorGroup) return;
      const facing = smState.motion === 'walk_left' ? -1 : 1;
      const bob = (typeof smState.walkBob === 'number') ? smState.walkBob : 0;
      if (facing === -1) {
        actorGroup.setAttribute('transform', `translate(${smState.stageX}, ${bob}) translate(600, 0) scale(-1, 1)`);
      } else {
        actorGroup.setAttribute('transform', `translate(${smState.stageX}, ${bob})`);
      }
    }"""

if old_t in text:
    text = text.replace(old_t, new_t)
    print("patched transform")
else:
    print("transform already patched or not found")

old_w = """      } else {
        // When walking starts, switch to full screen legs if behind desk was on
        if (legsStand) legsStand.classList.add('hidden');
        if (legsWalk) legsWalk.classList.remove('hidden');

        // Hide other arm poses and activate dynamic walking arms
        document.querySelectorAll('.sm-arm-pose').forEach(el => el.classList.add('hidden'));
        if (walkArmPose) walkArmPose.classList.remove('hidden');

        startHumanWalkCycle();
      }
    };"""

new_w = """      } else {
        const legsSeated = document.getElementById('sm-legs-seated');
        if (smState.isBehindDesk) {
          smState.preferDeskAfterWalk = true;
          setStickmanDeskMode(false);
        }
        if (legsStand) legsStand.classList.add('hidden');
        if (legsSeated) legsSeated.classList.add('hidden');
        if (legsWalk) legsWalk.classList.remove('hidden');
        document.querySelectorAll('.sm-arm-pose').forEach(el => el.classList.add('hidden'));
        if (walkArmPose) walkArmPose.classList.remove('hidden');
        startHumanWalkCycle();
      }
    };"""

if old_w in text:
    text = text.replace(old_w, new_w)
    print("patched walk")
else:
    print("walk already patched or not found")

path.write_text(text, encoding="utf-8")
print("bytes", len(text))
