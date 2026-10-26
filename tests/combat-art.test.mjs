import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rgbaPixels } from "./png.mjs";
import { drawPaperDoll, heldWeaponPose } from "../site/avatar-draw.js";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
test("all 64 combatants have independently authored, isolated eight-direction preparation, strike, recovery and hurt poses", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/combat-cycles.json");
  assert.equal(plan.status, "complete");
  assert.equal(plan.pending.length, 0);
  assert.equal(plan.sources.length, 64);
  const actors = new Map();
  for (const s of plan.sources)
    for (const a of s.actors) {
      if (!actors.has(a.id)) actors.set(a.id, new Set());
      actors.get(a.id).add(s.direction);
    }
  assert.equal(actors.size, 64);
  for (const [id, dirs] of actors) {
    assert.equal(dirs.size, 8, id);
    const l = art.characterLayouts[id] || art.monsters[id];
    for (const [phase, frames] of Object.entries({
      windup: [0, 1, 2],
      attack: [3, 4],
      recover: [5, 6],
      hurt: [7],
    })) {
      assert.equal(l.clips[phase].file, "combat/" + id);
      assert.deepEqual(l.clips[phase].frames, frames);
    }
    const { width, height, pixels } = rgbaPixels(
      await readFile("site/assets/combat/" + id + ".png"),
    );
    assert.equal(width, l.size * 8);
    assert.equal(height, l.size * 8);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        let ink = 0;
        for (let y = 0; y < l.size; y++)
          for (let x = 0; x < l.size; x++) {
            const a =
              pixels[((row * l.size + y) * width + col * l.size + x) * 4 + 3];
            ink += a > 0;
            if (x < 4 || y < 4 || x >= l.size - 4 || y >= l.size - 4)
              assert.equal(a, 0, id + " adjacent cell leak " + row + ":" + col);
          }
        assert.ok(ink > 10, id + " empty combat pose");
      }
  }
});
test("all 128 directional weapon grips are measured, cells stay isolated, and every pose attaches exactly at an actual hand pixel", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/held-weapons.json");
  assert.equal(plan.status, "complete");
  assert.equal(plan.sources.length, 8);
  const image = rgbaPixels(
    await readFile("site/assets/appearance/held-weapons.png"),
  );
  assert.equal(image.width, 768);
  assert.equal(image.height, 1536);
  for (const w of Object.values(art.appearance.weapons)) {
    assert.deepEqual(w.measured, Array(8).fill(true));
    for (let dir = 0; dir < 8; dir++)
      for (let y = 0; y < 96; y++)
        for (let x = 0; x < 96; x++) {
          const a =
            image.pixels[
              ((w.index * 96 + y) * image.width + dir * 96 + x) * 4 + 3
            ];
          if (x < 4 || y < 4 || x >= 92 || y >= 92)
            assert.equal(a, 0, "held weapon cell bleed");
        }
  }
  for (const [id, l] of Object.entries(art.appearance.bases)) {
    const body = rgbaPixels(await readFile("site/assets/" + l.file + ".png"));
    const w =
      art.appearance.weapons[
        {
          warden: "spear1",
          mage: "staff1",
          ranger: "bow1",
          herbalist: "wand1",
        }[id]
      ];
    for (let dir = 0; dir < 8; dir++)
      for (const frame of [
        ...Array(8).keys(),
        ...Array.from({ length: 16 }, (_, i) => i + 16),
      ]) {
        const p = heldWeaponPose(l, w, frame, dir),
          [x, y] = p.hand;
        assert.ok(
          body.pixels[((dir * 96 + y) * body.width + frame * 96 + x) * 4 + 3] >
            0,
          id + " hand anchor is outside body " + dir + ":" + frame,
        );
        let contact = null,
          tx = 0,
          ty = 0,
          angle = 0;
        const ctx = {
          save() {},
          restore() {},
          translate(x, y) {
            tx = x;
            ty = y;
          },
          rotate(a) {
            angle = a;
          },
          drawImage(image, ...args) {
            const dx = args[4] + (p.grip[0] * args[6]) / 96,
              dy = args[5] + (p.grip[1] * args[7]) / 96;
            contact = [
              tx + dx * Math.cos(angle) - dy * Math.sin(angle),
              ty + dx * Math.sin(angle) + dy * Math.cos(angle),
            ];
          },
        };
        drawPaperDoll(
          ctx,
          { layout: l, layers: [{ ...w, held: true }] },
          new Map([[w.file, {}]]),
          frame,
          dir,
          11,
          17,
          1.5,
        );
        assert.deepEqual(
          contact,
          [Math.round(11 + x * 1.5), Math.round(17 + y * 1.5)],
          "runtime weapon handle must land on palm at actual rendering scale",
        );
        if (w.kind === "spear") {
          const rest = (x < 48 ? -1 : 1) * 0.18 - w.axes[dir],
            swing = p.angle - (l.anchors[dir][frame].angle || 0) - rest;
          assert.ok(
            Math.abs(swing) <= Math.PI + 1e-6,
            "weapon spins the long way around",
          );
        }
      }
  }
});
