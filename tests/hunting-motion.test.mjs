import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { heldWeaponPose, heldWeaponTip } from "../site/avatar-draw.js";
import {
  equippedAppearance,
  starterEquipment,
} from "../site/equipment-appearance.js";
import {
  attackTimeline,
  STRIKE_DURATION,
  RECOVERY_DURATION,
} from "../site/animation.js";
test("all four corrected combat sheets have calibrated palms, planted registration and genuine new image sources", async () => {
  const plan = JSON.parse(await readFile("art/hunting-motion.json", "utf8")),
    art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  assert.equal(plan.status, "complete");
  assert.equal(plan.sources.length, 4);
  assert.equal(new Set(plan.sources.map((s) => s.source)).size, 4);
  for (const cls of ["warden", "ranger", "mage", "herbalist"]) {
    const body = art.appearance.bases[cls];
    assert.equal(body.combatGripVersion, 1);
    const job = plan.sources.find((s) => s.id === cls);
    assert.equal(job.measuredCombatPalms, 64);
    for (let d = 0; d < 8; d++)
      for (let f = 0; f < 7; f++) {
        const a = body.anchors[d][f];
        assert.ok(a.measured);
        assert.equal(a.feet[1], 88);
        assert.ok(
          ["authored-palm-marker", "visible-palm"].includes(a.calibration),
        );
        if (f === 6)
          assert.deepEqual(
            a.hand,
            body.anchors[d][0].hand,
            "recovery must end at the same ready grip",
          );
        if (f > 0 && f < 6) {
          const prev = body.anchors[d][f - 1].hand;
          assert.ok(
            (a.hand[0] - 48) * (prev[0] - 48) >= 0 ||
              Math.abs(a.hand[0] - prev[0]) <= 24,
            "weapon must not jump to the opposite hand",
          );
        }
      }
  }
});
test("weapons point in the actor direction, bows stay perpendicular, mage staffs release upward, and all use the measured palm", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  for (const cls of ["warden", "ranger", "mage", "herbalist"]) {
    const a = equippedAppearance(art, cls, starterEquipment(cls)),
      w = a.layers.find((l) => l.held);
    for (let d = 0; d < 8; d++) {
      const p = heldWeaponPose(a.layout, w, 4, d),
        tip = heldWeaponTip(a.layout, w, 4, d),
        angle = p.angle + w.axes[d],
        heading = (d * Math.PI) / 4;
      assert.deepEqual(p.hand, a.layout.anchors[d][4].hand);
      if (cls === "ranger")
        assert.ok(
          Math.abs(Math.cos(angle - heading)) < 0.04,
          "bow must face its target rather than stay upright in every direction",
        );
      else if (cls === "mage")
        assert.ok(Math.cos(angle) > 0.95, "sky cast staff must point up");
      else
        assert.ok(
          Math.cos(angle - heading) > 0.98,
          "spear/wand release points away from target",
        );
      assert.ok(tip.every(Number.isFinite));
    }
    assert.ok(
      a.layers.find((l) => l.held).orderByDirection[0] < 0,
      "far-side weapons must be occluded by body",
    );
  }
});
test("weapon angles vary continuously within each stage and use the same contact clock as damage", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  for (const cls of ["warden", "ranger", "mage", "herbalist"]) {
    const a = equippedAppearance(art, cls, starterEquipment(cls)),
      weapon = a.layers.find((l) => l.held),
      timeline = attackTimeline(0, cls);
    assert.ok(
      Math.abs(timeline.hitAt - timeline.strikeAt - STRIKE_DURATION / 2) <
        1e-10,
    );
    assert.ok(RECOVERY_DURATION >= 7 / 30);
    for (let dir = 0; dir < 8; dir++)
      for (const [anim, start, duration, frame] of [
        ["windup", 0, timeline.strikeAt, 1],
        ["attack", timeline.strikeAt, STRIKE_DURATION, 4],
        ["recover", timeline.strikeEnd, RECOVERY_DURATION, 5],
      ]) {
        let prev = null;
        for (let i = 0; i <= 20; i++) {
          const pose = heldWeaponPose(a.layout, weapon, frame, dir, {
            anim,
            start,
            duration,
            time: start + (duration * i) / 20,
          });
          if (prev !== null)
            assert.ok(
              Math.abs(
                Math.atan2(
                  Math.sin(pose.angle - prev),
                  Math.cos(pose.angle - prev),
                ),
              ) < 0.03,
            );
          prev = pose.angle;
        }
      }
  }
});
