import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  blocked,
  createPlayer,
  hydrateSave,
  serialize,
  stats,
  grantXp,
  rollDrops,
  recordEvent,
  questProgress,
} from "../site/core.js";
import {
  CLASSES,
  MONSTERS,
  ITEMS,
  QUESTS,
  PORTALS,
  MAPS,
  NPCS,
} from "../site/data.js";
import { imageToWorld } from "../site/art-layout.js";
const setup = (cls = "warden", map = "village", level = 1) => {
  const raw = createPlayer(cls, "테스트");
  raw.map = map;
  raw.level = level;
  if (map !== "village") raw.visited.push(map);
  if (["shelltown", "seacave"].includes(map)) raw.defeatedBosses = ["m20"];
  raw.hp = stats(raw).maxHp;
  const w = new World({ seed: 42 }),
    p = w.addPlayer(raw);
  return { w, p };
};
test("click movement routes around the generated village fountain", () => {
  const { w, p } = setup();
  const start = imageToWorld(0.39, 0.3),
    end = imageToWorld(0.65, 0.3);
  Object.assign(p, start);
  assert.ok(w.act("local", { type: "moveTo", ...end }));
  assert.ok(p.route.length > 1);
  for (let i = 0; i < 150; i++) w.step(0.1);
  assert.ok(Math.hypot(p.x - end.x, p.y - end.y) < 0.35);
});
test("combat awards XP, quest progress and real loot exactly once per death", () => {
  const { w, p } = setup("warden", "sprout");
  const m = w.map(p.map).mobs[0],
    d = MONSTERS.find((d) => d.id === m.def);
  m.x = p.x + 0.5;
  m.y = p.y;
  m.hp = 1;
  w.rng = () => 0;
  const before = p.inventory.fiber;
  assert.equal(w.act("local", { type: "attack", target: m.uid }), true);
  assert.equal(m.hp, 0);
  assert.equal(p.kills, 1);
  assert.equal(questProgress(p), 1);
  assert.equal(p.xp, d.xp);
  w.step(0.05);
  assert.ok(p.inventory.fiber > before);
  assert.equal(p.inventory.trophy1, 1);
  assert.equal(w.act("local", { type: "attack", target: m.uid }), false);
  assert.equal(p.kills, 1);
});
test("loot chances are independent and match tables across all forty species", () => {
  for (const m of MONSTERS) {
    assert.equal(rollDrops(m, () => 0).length, m.drops.length);
    assert.equal(
      rollDrops(m, () => 0.999999).length,
      m.drops.filter((d) => d.chance === 1).length,
    );
  }
  let x = 19;
  const rng = () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
  for (const m of MONSTERS) {
    const count = Object.fromEntries(m.drops.map((d) => [d.item, 0]));
    for (let i = 0; i < 5000; i++)
      for (const d of rollDrops(m, rng)) count[d.item]++;
    for (const d of m.drops)
      assert.ok(
        Math.abs(count[d.item] / 5000 - d.chance) < 0.035,
        `${m.id} ${d.item}`,
      );
  }
});
test("crafting consumes the exact recipe atomically and equipped gear cannot be destroyed", () => {
  const { w, p } = setup();
  const before = p.inventory.salve;
  assert.equal(w.act("local", { type: "craft", item: "salve" }), true);
  assert.equal(p.inventory.salve, before + 1);
  assert.equal(p.inventory.softleaf, 0);
  const snapshot = JSON.stringify(p.inventory);
  assert.equal(w.act("local", { type: "craft", item: "salve" }), false);
  assert.equal(JSON.stringify(p.inventory), snapshot);
  assert.equal(w.act("local", { type: "sell", item: "spear1" }), false);
  assert.equal(w.act("local", { type: "dismantle", item: "spear1" }), false);
  p.inventory.spear1 = 2;
  assert.equal(w.act("local", { type: "dismantle", item: "spear1" }), true);
  assert.equal(p.inventory.spear1, 1);
});
test("every class can gather and garden; waiting cannot kill a planted herb", () => {
  for (const cls of CLASSES) {
    const { w, p } = setup(cls.id, "sprout"),
      h = w.map(p.map).herbs[0];
    p.x = h.x;
    p.y = h.y;
    const before = p.inventory[h.item] || 0;
    assert.ok(w.act("local", { type: "interact", herb: h.id }));
    assert.equal(p.inventory[h.item], before + 1);
    assert.equal(w.act("local", { type: "interact", herb: h.id }), false);
  }
  const { w, p } = setup();
  assert.ok(w.act("local", { type: "plant", slot: 0, item: "softleaf" }));
  assert.equal(w.act("local", { type: "harvest", slot: 0 }), false);
  p.garden[0].readyAt = Date.now() - 1e8;
  assert.ok(w.act("local", { type: "harvest", slot: 0 }));
  assert.equal(p.garden[0], null);
});
test("progression unlocks the coast through the first boss and validates portal proximity", () => {
  const { w, p } = setup("warden", "stump");
  Object.assign(
    p,
    PORTALS("stump").find((port) => port.to === "shelltown"),
  );
  assert.equal(w.act("local", { type: "travel", map: "shelltown" }), false);
  p.defeatedBosses.push("m20");
  assert.equal(w.act("local", { type: "travel", map: "shelltown" }), true);
  assert.equal(p.map, "shelltown");
  assert.ok(p.visited.includes("shelltown"));
  assert.equal(w.act("local", { type: "travel", map: "saltwood" }), false);
  assert.equal(
    w.act("local", { type: "travel", map: "village", fast: true }),
    true,
  );
});
test("all eight specializations have working skills, resource costs and cooldowns", () => {
  for (const cls of CLASSES)
    for (const branch of cls.branches) {
      const { w, p } = setup(cls.id, "shelltown", 25);
      assert.ok(
        w.act("local", { type: "subclass", branch: branch.id }),
        branch.id,
      );
      assert.equal(
        w.act("local", { type: "subclass", branch: branch.id }),
        false,
      );
      p.map = "sprout";
      p.x = 14;
      p.y = 14;
      const m = w.map("sprout").mobs[0];
      m.x = 14.6;
      m.y = 14;
      m.hp = 1e5;
      assert.ok(
        w.act("local", { type: "skill", slot: 3, target: m.uid }),
        branch.id,
      );
      assert.equal(p.focus, 65);
      assert.equal(
        w.act("local", { type: "skill", slot: 3, target: m.uid }),
        false,
      );
      assert.ok(p.cooldowns[3] > w.time);
    }
});
test("telegraphed attacks can be dodged instead of applying unavoidable damage", () => {
  const { w, p } = setup("warden", "sprout"),
    m = w.map("sprout").mobs[0];
  for (const other of w.map("sprout").mobs) if (other !== m) other.hp = 0;
  m.x = p.x + 0.6;
  m.y = p.y;
  m.nextAttack = 0;
  w.step(0.05);
  assert.ok(m.windup);
  const hp = p.hp;
  p.x = 5;
  p.y = 14;
  for (let i = 0; i < 15; i++) w.step(0.1);
  assert.equal(p.hp, hp);
});
test("save roundtrip preserves equipment, quests, materials and specialization", () => {
  const { w, p } = setup("mage", "shelltown", 25);
  w.act("local", { type: "subclass", branch: "bloom" });
  p.inventory.seawood = 20;
  p.quest.index = 8;
  p.quest.counts.q8 = 2;
  const restored = hydrateSave(JSON.parse(JSON.stringify(serialize(p))));
  assert.equal(restored.branch, "bloom");
  assert.equal(restored.inventory.seawood, 20);
  assert.equal(restored.quest.index, 8);
  assert.equal(restored.quest.counts.q8, 2);
  assert.equal(hydrateSave({ classId: "missing" }), null);
  restored.inventory.fake = 999;
  const cleaned = hydrateSave(restored);
  assert.equal(cleaned.inventory.fake, undefined);
});
test("all thirteen quests can be completed and claimed once in order", () => {
  const { w, p } = setup();
  for (const q of QUESTS) {
    recordEvent(p, q.kind, {
      map: q.map,
      item: q.item,
      monster: q.monster,
      count: q.count,
    });
    assert.equal(questProgress(p), q.count);
    assert.ok(w.act("local", { type: "claimQuest" }));
  }
  assert.equal(p.quest.index, 13);
  assert.equal(w.act("local", { type: "claimQuest" }), false);
  assert.ok(p.level > 10);
});
test("server actions reject teleport, invented rewards and incompatible equipment", () => {
  const { w, p } = setup();
  const gold = p.gold;
  assert.equal(w.act("local", { type: "grantGold", amount: 1e8 }), false);
  assert.equal(p.gold, gold);
  assert.equal(w.act("local", { type: "moveTo", x: 1e8, y: 1e8 }), false);
  assert.equal(w.act("local", { type: "move", x: Infinity, y: 0 }), false);
  p.inventory.staff1 = 1;
  assert.equal(w.act("local", { type: "equip", item: "staff1" }), false);
  const x = p.x;
  w.act("local", { type: "move", x: 999, y: 0 });
  w.step(0.1);
  assert.ok(Math.abs(p.x - x) <= stats(p).speed * 0.1 + 0.001);
});

test("all map exits, NPC feet and creature spawns sit on generated walkable floor", () => {
  const w = new World({ seed: 42 });
  for (const map of MAPS) {
    for (const port of PORTALS(map.id))
      assert.equal(blocked(map.id, port.x, port.y), false, map.id + " exit");
    for (const npc of NPCS.filter((n) => n.map === map.id))
      assert.equal(blocked(map.id, npc.x, npc.y), false, npc.id);
    for (const entity of [...w.map(map.id).mobs, ...w.map(map.id).herbs])
      assert.equal(
        blocked(map.id, entity.x, entity.y),
        false,
        map.id + " spawn",
      );
  }
});
