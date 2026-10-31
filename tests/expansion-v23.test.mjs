import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  World,
  createPlayer,
  stats,
  serialize,
  hydrateSave,
} from "../site/core.js";
import { ITEMS, CLASSES } from "../site/data.js";
import { tierItemId, EQUIPMENT_LEVELS } from "../site/equipment-tiers.js";
import { canEquip, legacyAttributes } from "../site/progression.js";
import { combatAim } from "../site/targeting.js";
import { NAVIGATION } from "../site/world-layout.js";
import { rgbaPixels } from "./png.mjs";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const advance = (w, t) => {
  while (w.time + 1e-8 < t) w.step(Math.min(0.01, t - w.time));
};
test("each class has a complete seven-step equipment ladder and level-zero starters are weaker", () => {
  assert.deepEqual(EQUIPMENT_LEVELS, [0, 5, 10, 15, 20, 25, 30]);
  assert.equal(Object.keys(ITEMS).length, 204);
  for (const cls of CLASSES) {
    const p = createPlayer(cls.id);
    for (const slot of ["weapon", "armor", "head", "boots", "charm"]) {
      const ids = EQUIPMENT_LEVELS.map((l) => tierItemId(cls, slot, l));
      assert.equal(new Set(ids).size, 7);
      for (const [n, id] of ids.entries()) {
        const i = ITEMS[id];
        assert.equal(i.level, EQUIPMENT_LEVELS[n]);
        assert.equal(i.slot, slot);
        assert.ok(i.lore.length > 40);
        if (n === 0) {
          assert.equal(p.equipment[slot], id);
          assert.deepEqual(i.requirements, {});
          assert.ok(canEquip(p, i));
        } else {
          assert.ok(i.price > ITEMS[ids[n - 1]].price);
          assert.ok(i.recipe);
          assert.ok(
            i.attack +
              i.magicPower +
              i.defense +
              i.magicDefense +
              i.maxHp +
              i.accuracy +
              i.critChance +
              i.evasion >
              ITEMS[ids[n - 1]].attack +
                ITEMS[ids[n - 1]].magicPower +
                ITEMS[ids[n - 1]].defense +
                ITEMS[ids[n - 1]].magicDefense +
                ITEMS[ids[n - 1]].maxHp +
                ITEMS[ids[n - 1]].accuracy +
                ITEMS[ids[n - 1]].critChance +
                ITEMS[ids[n - 1]].evasion,
          );
        }
      }
    }
  }
});
test("all new equipment is craftable with real materials, respects requirements, and survives saves", () => {
  const raw = createPlayer("ranger");
  raw.level = 30;
  delete raw.allocationVersion;
  delete raw.allocated;
  const w = new World(),
    p = w.addPlayer(raw);
  p.gold = 100000;
  const item = ITEMS.bowlv30;
  for (const [id, n] of Object.entries(item.recipe)) p.inventory[id] = n;
  assert.ok(w.act(p.id, { type: "craft", item: item.id }));
  assert.ok(w.act(p.id, { type: "equip", item: item.id }));
  assert.equal(hydrateSave(serialize(p)).equipment.weapon, item.id);
  const low = createPlayer("ranger");
  assert.equal(canEquip(low, item), false);
  for (const i of Object.values(ITEMS).filter((i) => i.progressionEquipment))
    for (const [mat, n] of Object.entries(i.recipe)) {
      assert.ok(ITEMS[mat]);
      assert.ok(Number.isSafeInteger(n) && n > 0);
    }
});
test("archer basic range is exactly fifty percent longer and all aiming shares that range", () => {
  const p = createPlayer("ranger");
  assert.equal(stats(p).range, 7.5 * 1.5);
  assert.equal(combatAim(p).range, 11.25);
  assert.equal(combatAim(p, 1).shape, undefined);
  assert.equal(combatAim(p, 1).radius, 3.4);
  assert.equal(CLASSES.find((c) => c.id === "ranger").skills[1], "화살비");
});
test("guardian leap moves along its arc, damages only at landing, and cancels safely in flight", () => {
  for (const cancel of [false, true]) {
    const w = new World(),
      p = w.addPlayer({
        ...createPlayer("warden"),
        map: "sprout",
        level: 20,
        ...NAVIGATION.sprout.worldAt(8, 10),
      });
    w.rng = () => 0.5;
    w.updateMob = () => {};
    const mobs = w.map(p.map).mobs;
    for (const m of mobs) {
      m.hp = 0;
      m.respawn = Infinity;
    }
    const m = mobs[0];
    Object.assign(m, {
      x: p.x + 4,
      y: p.y,
      hp: 10000,
      maxHp: 10000,
      ai: "idle",
    });
    const start = p.x,
      point = { x: m.x, y: m.y };
    assert.ok(w.act(p.id, { type: "skill", slot: 2, point }));
    const a = structuredClone(p.action);
    assert.ok(a.leap);
    advance(w, a.leap.start + 0.1);
    assert.ok(p.x > start && p.x < point.x);
    assert.equal(m.hp, 10000);
    if (cancel) {
      w.act(p.id, { type: "cancelCombat" });
      const x = p.x;
      advance(w, a.endAt + 0.1);
      assert.equal(p.x, x);
      assert.equal(m.hp, 10000);
    } else {
      advance(w, a.hitAt + 0.01);
      assert.equal(p.x, point.x);
      assert.equal(p.y, point.y);
      assert.ok(m.hp < 10000);
      assert.ok(w.effects.some((e) => e.kind === "leaf-landing"));
    }
  }
});
test("all 180 monster sheets have review records and every regenerated clip uses new independent source art", async () => {
  const audit = await json("art/monster-motion-audit.json"),
    plan = await json("art/v23-art.json"),
    records = await json("art/generated-assets.json");
  assert.equal(audit.sheetsReviewed, 180);
  assert.equal(audit.before.length, 60);
  assert.equal(audit.directionRowsReviewed, 1440);
  const jobs = plan.sources.filter((s) => s.monster);
  assert.equal(jobs.length, 11);
  for (const job of jobs) {
    const id =
        job.motion === "combat"
          ? "combat/" + job.monster
          : "locomotion/" + job.monster + "-" + job.motion,
      r = records.assets.find((r) => r.id === id);
    assert.equal(r.source, job.source);
    assert.equal(r.motionReviewVersion, 1);
    assert.equal(
      r.sha256,
      createHash("sha256")
        .update(await readFile(r.target))
        .digest("hex"),
    );
  }
});
test("all seven equipment ranks have real icons and matching eight-direction held weapon sheets", async () => {
  const art = await json("site/assets/manifest.json");
  for (const cls of CLASSES)
    for (const level of EQUIPMENT_LEVELS) {
      for (const slot of ["weapon", "armor", "head", "boots", "charm"])
        assert.ok(art.itemOverrides[tierItemId(cls, slot, level)]);
      const w = art.appearance.weapons[tierItemId(cls, "weapon", level)];
      assert.equal(w.rows, cls.id === "ranger" ? 9 : 7);
      assert.equal(w.grips.length, 8);
      assert.equal(w.tips.length, 8);
      const im = rgbaPixels(await readFile("site/assets/" + w.file + ".png"));
      assert.equal(im.width, 768);
      assert.equal(im.height, w.rows * 96);
      for (let d = 0; d < 8; d++)
        assert.ok(
          w.grips[d].every((n) => Number.isFinite(n) && n >= 4 && n < 92),
        );
    }
});
