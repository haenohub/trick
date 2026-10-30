import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  World,
  createPlayer,
  stats,
  serialize,
  hydrateSave,
  seeded,
} from "../site/core.js";
import { MONSTERS, ITEMS, MAPS } from "../site/data.js";
import { DROP_RATES } from "../site/drop-tables.js";
import { NEW_CONSUMABLES, consumableLines } from "../site/consumables.js";
import { SKILL_VISUALS } from "../site/skill-visuals.js";
import { speciesForMap } from "../site/ecology.js";
import { isWalkable, NAVIGATION } from "../site/world-layout.js";
import { rgbaPixels } from "./png.mjs";
test("all sixty species have exact independent category chances and distinct randomized equipment pools", () => {
  const covered = new Set(),
    signatures = new Set();
  for (const m of MONSTERS) {
    assert.equal(new Set(m.drops.map((d) => d.item)).size, m.drops.length);
    for (const d of m.drops) {
      assert.equal(d.chance, DROP_RATES[ITEMS[d.item].type]);
      covered.add(d.item);
    }
    const gear = m.drops.filter((d) => ITEMS[d.item].slot);
    assert.ok(gear.length >= 4 && gear.length <= 6);
    signatures.add(gear.map((d) => d.item).join(","));
    assert.equal(
      m.drops.filter((d) => ITEMS[d.item].type === "trophy").length,
      1,
    );
    assert.equal(
      m.drops.filter((d) => ITEMS[d.item].type === "consumable").length,
      2,
    );
  }
  assert.equal(signatures.size, 60);
  assert.ok(
    MONSTERS.some((m) => m.drops.some((d) => ITEMS[d.item].level === 30)),
  );
  for (const i of NEW_CONSUMABLES)
    assert.ok(covered.has(i.id), i.id + " must be obtainable");
});
test("each map keeps every species and boss while restoring original population and separating homes", () => {
  const w = new World();
  let before = 0,
    after = 0;
  for (const map of MAPS.filter((m) => !m.town)) {
    const definitions = speciesForMap(map.id),
      old = definitions.reduce(
        (s, { def, guest }) =>
          s + (def.type === "normal" ? (guest ? 3 : 6) : 1),
        0,
      ),
      mobs = w.map(map.id).mobs;
    assert.equal(mobs.length, old, map.id);
    assert.equal(new Set(mobs.map((m) => m.def)).size, definitions.length);
    for (const m of mobs) {
      assert.ok(isWalkable(map.id, m.x, m.y));
      if (MONSTERS.find((d) => d.id === m.def).type === "boss")
        assert.ok(
          Math.hypot(
            m.x - NAVIGATION[map.id].boss.x,
            m.y - NAVIGATION[map.id].boss.y,
          ) < 0.01,
        );
    }
    before += old;
    after += mobs.length;
  }
  assert.equal(after, before);
  assert.equal(stats(createPlayer()).speed, 16.5);
  assert.equal(stats(createPlayer("ranger")).speed, 18.5);
});
test("twenty additional consumables have distinct icons, lore, real effects, shop prices and valid recipes", () => {
  assert.equal(NEW_CONSUMABLES.length, 20);
  assert.equal(
    Object.values(ITEMS).filter((i) => i.type === "consumable").length,
    24,
  );
  for (const i of NEW_CONSUMABLES) {
    assert.ok(i.lore.length > 20);
    assert.ok(i.price > 0);
    assert.ok(consumableLines({ ...i, type: "consumable" }).length >= 2);
    for (const id of Object.keys(i.recipe)) assert.ok(ITEMS[id]);
  }
});
test("buffs change authoritative combat stats, refresh without stacking, expire and share potion cooldown", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer()),
    base = stats(p);
  p.inventory.barktonic = 3;
  p.inventory.mistlozenge = 1;
  assert.ok(w.potion(p, "barktonic"));
  assert.equal(stats(p).attack, Math.round(base.attack * 1.2));
  assert.equal(w.potion(p, "mistlozenge"), false);
  assert.equal(p.inventory.mistlozenge, 1);
  w.time = 4;
  assert.ok(w.potion(p, "barktonic"));
  assert.equal(p.buffs.length, 1);
  assert.equal(p.buffs[0].until, 94);
  w.time = 93.95;
  w.step(0.1);
  assert.equal(p.buffs.length, 0);
  assert.equal(stats(p).attack, base.attack);
  p.inventory.heartroot = 1;
  w.time = 98;
  assert.ok(w.potion(p, "heartroot"));
  assert.equal(stats(p).maxHp, Math.round(base.maxHp * 1.25));
  p.hp = stats(p).maxHp;
  w.time = 219;
  w.step(0.01);
  assert.equal(p.hp, base.maxHp);
});
test("instant, focus, cleanse and gradual recovery consumables work and buffs remain runtime-only", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer());
  p.hp = 20;
  p.focus = 0;
  p.poisonUntil = 100;
  p.inventory.springphial = 1;
  assert.ok(w.potion(p, "springphial"));
  assert.equal(p.hp, stats(p).maxHp);
  assert.equal(p.focus, 100);
  assert.equal(p.poisonUntil, 0);
  w.time = 4;
  p.inventory.rootbroth = 1;
  p.hp = 30;
  assert.ok(w.potion(p, "rootbroth"));
  p.lastHit = w.time;
  w.step(0.1);
  assert.ok(p.hp > 30);
  assert.equal(w.snapshot(p.id).player.consumableBuffs[0].item, "rootbroth");
  assert.equal(serialize(p).buffs, undefined);
});
test("world map test travel reaches all ten unvisited maps during combat and survives reload without a boss flag", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer());
  for (const m of MAPS.filter((m) => m.id !== "village")) {
    p.lastHit = w.time;
    p.combatTarget = "anything";
    assert.ok(w.act(p.id, { type: "travel", map: m.id, fast: true }));
    assert.equal(p.map, m.id);
    assert.equal(p.combatTarget, null);
    assert.ok(isWalkable(m.id, p.x, p.y));
    assert.equal(hydrateSave(serialize(p)).map, m.id);
  }
  assert.deepEqual(p.defeatedBosses, []);
  assert.equal(w.travel(p, "invalid", true), false);
});
test("each of twenty skills releases its dedicated generated animation at its actual effect point", () => {
  assert.equal(Object.keys(SKILL_VISUALS).length, 20);
  for (const visual of Object.values(SKILL_VISUALS)) {
    const w = new World(),
      p = w.addPlayer(createPlayer(visual.classId)),
      m = w.map("sprout").mobs[0];
    p.map = "sprout";
    p.x = m.x - 0.8;
    p.y = m.y;
    p.branch = visual.key.includes("-") ? null : visual.key;
    w.rng = () => 0.5;
    const slot = visual.key.includes("-")
      ? Number(visual.key.split("-")[1])
      : 3;
    assert.ok(w.releaseSkill(p, slot, m));
    const effect = w.effects.find(
      (e) =>
        e.key === visual.key ||
        (visual.key === "ranger-1" && e.kind === "arrow-rain") ||
        (visual.key === "warden-2" && e.kind === "leaf-landing"),
    );
    assert.ok(effect, visual.key);
    assert.equal(effect.owner, p.id);
  }
});
test("new effects and all item icons have isolated native frames with no adjacent sprite pixels", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  assert.equal(Object.keys(art.skillEffects).length, 4);
  assert.equal(art.attackImpacts.cols, 13);
  for (const layout of [
    ...Object.values(art.skillEffects),
    art.attackImpacts,
  ]) {
    const { pixels, width, height } = rgbaPixels(
      await readFile("site/assets/" + layout.file + ".png"),
    );
    assert.equal(width, layout.cols * 128);
    assert.equal(height, layout.rows * 128);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = pixels[(y * width + x) * 4 + 3];
        assert.ok(a === 0 || a === 255);
        if (x % 128 < 4 || x % 128 >= 124 || y % 128 < 4 || y % 128 >= 124)
          assert.equal(a, 0, layout.file + " gutter");
      }
  }
  for (const i of NEW_CONSUMABLES) {
    assert.equal(art.itemOverrides[i.id].file, "consumables-v24");
  }
});
test("every class and heading has a newly authored lower anticipation pose and registered weapon palms", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8")),
    plan = JSON.parse(await readFile("art/v24-art.json", "utf8"));
  assert.equal(plan.status, "complete");
  assert.equal(plan.sources.filter((s) => s.kind === "body").length, 8);
  for (const cls of ["warden", "mage", "ranger", "herbalist"]) {
    const layout = art.appearance.bases[cls],
      { pixels, width } = rgbaPixels(
        await readFile("site/assets/" + layout.file + ".png"),
      );
    assert.equal(layout.dynamicMotionVersion, 1);
    for (let d = 0; d < 8; d++) {
      const heights = [0, 2, 4].map((frame) => {
        let lo = 96,
          hi = 0;
        for (let y = 0; y < 96; y++)
          for (let x = 0; x < 96; x++)
            if (pixels[((d * 96 + y) * width + frame * 96 + x) * 4 + 3]) {
              lo = Math.min(lo, y);
              hi = Math.max(hi, y);
            }
        return hi - lo + 1;
      });
      assert.ok(
        heights[1] <= heights[0] - 4,
        cls + ":" + d + " must coil/crouch visibly before release",
      );
      assert.ok(heights[2] >= heights[1] + 4);
      for (let f = 0; f < 7; f++) {
        const a = layout.anchors[d][f];
        assert.ok(a.measured);
        assert.ok(
          pixels[((d * 96 + a.hand[1]) * width + f * 96 + a.hand[0]) * 4 + 3],
        );
      }
    }
  }
});
