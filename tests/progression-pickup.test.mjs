import { test } from "node:test";
import assert from "node:assert/strict";
import {
  attributes,
  canEquip,
  derivedStats,
  monsterStats,
} from "../site/progression.js";
import {
  World,
  createPlayer,
  stats,
  grantXp,
  hydrateSave,
} from "../site/core.js";
import { CLASSES, ITEMS } from "../site/data.js";
import { PickupHold } from "../site/pickup-hold.js";
import { animationFrame, WALK_DURATION } from "../site/animation.js";
import { readFile } from "node:fs/promises";
test("all four professions gain their own attributes through multiple level-ups and saves cannot forge them", () => {
  for (const cls of CLASSES) {
    const p = createPlayer(cls.id),
      before = attributes(p),
      oldPower = stats(p).power;
    const gained = grantXp(p, 1200);
    assert.ok(gained > 1);
    for (const [key, n] of Object.entries(attributes(p)))
      assert.ok(n > before[key]);
    assert.ok(stats(p).power > oldPower);
    assert.equal(p.hp, stats(p).maxHp);
    const restored = hydrateSave({
      ...p,
      attributes: { strength: 999999 },
      stats: { attack: 999999 },
    });
    assert.deepEqual(attributes(restored), attributes(p));
    assert.equal(stats(restored).power, stats(p).power);
  }
  assert.ok(
    attributes({ classId: "warden", level: 20 }).strength >
      attributes({ classId: "mage", level: 20 }).strength,
  );
  assert.ok(
    attributes({ classId: "mage", level: 20 }).intelligence >
      attributes({ classId: "ranger", level: 20 }).intelligence,
  );
});
test("equipment has real combat bonuses and requirements are enforced without its own bonuses", () => {
  for (const i of Object.values(ITEMS).filter((i) => i.type === "equipment")) {
    assert.ok(Object.keys(i.requirements).length);
    for (const key of [
      "attack",
      "magicPower",
      "defense",
      "magicDefense",
      "accuracy",
      "evasion",
      "critChance",
      "critDamage",
    ])
      assert.ok(Number.isFinite(i[key]) && i[key] >= 0, i.id + " " + key);
  }
  const w = new World(),
    p = w.addPlayer(createPlayer());
  p.level = 20;
  p.inventory.spear2 = 1;
  assert.ok(canEquip(p, ITEMS.spear2));
  const old = ITEMS.spear2.requirements;
  try {
    ITEMS.spear2.requirements = { strength: 9999 };
    assert.equal(w.act(p.id, { type: "equip", item: "spear2" }), false);
    p.equipment.weapon = "spear2";
    assert.equal(
      stats(p).attack,
      derivedStats(
        p,
        Object.values(p.equipment)
          .filter((id) => id !== "spear2")
          .map((id) => ITEMS[id]),
      ).attack,
    );
  } finally {
    ITEMS.spear2.requirements = old;
  }
  assert.equal(canEquip(p, ITEMS.staff2), false);
  p.level = 1;
  assert.equal(canEquip(p, ITEMS.spear2), false);
});
test("physical and magical professions use separate power, and hit, critical and dodge stats change actual outcomes", () => {
  const w = new World(),
    p = w.addPlayer({ ...createPlayer("mage"), map: "sprout", level: 20 });
  const m = w.map("sprout").mobs[0];
  m.hp = m.maxHp = 100000;
  m.ai = "idle";
  assert.equal(stats(p).power, stats(p).magicPower);
  assert.notEqual(stats(p).magicPower, stats(p).attack);
  w.rng = () => 0.99999;
  const hp = m.hp;
  assert.equal(w.damage(p, m, 100), false);
  assert.equal(m.hp, hp);
  w.rng = () => 0.5;
  assert.ok(w.damage(p, m, 100));
  const normal = hp - m.hp;
  w.rng = () => 0;
  const before = m.hp;
  assert.ok(w.damage(p, m, 100));
  assert.ok(Math.abs(before - m.hp - normal * stats(p).critDamage) <= 2);
  assert.ok(w.effects.some((e) => e.crit));
  p.evadeUntil = 0;
  const life = p.hp;
  w.hurtPlayer(p, 20);
  assert.equal(p.hp, life);
  w.rng = () => 0.9;
  w.hurtPlayer(p, 20);
  assert.equal(p.hp, life - 20);
});
test("a held key and rapid repeated taps both respect the same 200ms cadence", () => {
  const held = new PickupHold();
  held.press("Space", 0);
  for (let n = 0; n < 5; n++) {
    assert.equal(held.take(n * 200), true);
    assert.equal(held.take(n * 200 + 199), false);
  }
  held.release("Space");
  held.press("Space", 850);
  assert.equal(held.take(850), false);
  assert.equal(held.take(1000), true);
  const taps = new PickupHold();
  let count = 0;
  for (let now = 0; now < 1000; now += 20) {
    taps.press("Space", now);
    if (taps.take(now)) count++;
    taps.release("Space");
  }
  assert.equal(count, 5);
});
test("the authoritative world accepts five nearby pickups per second, awards each at200ms and never duplicates loot", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer());
  const initial = p.inventory.fiber;
  w.spawnLoot(
    p,
    p,
    Array.from({ length: 10 }, () => ({ item: "fiber", count: 1 })),
  );
  let accepted = 0;
  for (let n = 0; n < 20; n++) {
    for (let burst = 0; burst < 5; burst++)
      if (w.act(p.id, { type: "pickupNearest" })) accepted++;
    w.step(0.05);
    if (n === 2) assert.equal(p.inventory.fiber, initial);
  }
  assert.equal(accepted, 5);
  assert.equal(p.inventory.fiber, initial + 5);
  assert.equal(w.map(p.map).drops.filter((d) => !d.collected).length, 5);
});
test("all native walk sheets play at half the previous rate without changing idle cadence", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  assert.equal(WALK_DURATION, 1.28);
  for (const l of Object.values({
    ...art.characterLayouts,
    ...art.npcLayouts,
    ...art.monsters,
  })) {
    assert.equal(l.clips.walk.duration, 1.28);
    assert.equal(animationFrame(l, "walk", 0.64, 0), 4);
    assert.equal(animationFrame(l, "walk", 1.28, 0), 0);
    assert.equal(l.clips.idle.duration, 0.72);
  }
});
