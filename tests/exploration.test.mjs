import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  createPlayer,
  hydrateSave,
  serialize,
  findRoute,
} from "../site/core.js";
import { NAVIGATION, isWalkable } from "../site/world-layout.js";
import { DISCOVERIES, CHESTS } from "../site/exploration.js";
import { ITEMS } from "../site/data.js";
function setup(map = "sprout") {
  const w = new World(),
    p = w.addPlayer({
      ...createPlayer(),
      map,
      defeatedBosses: ["m20"],
      ...NAVIGATION[map].spawn,
    });
  for (const m of w.map(map).mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  return { w, p };
}
const tick = (w) => {
  for (let i = 0; i < 18; i++) w.step(0.05);
};
test("eighteen story locations and eight treasure alcoves connect to the main route on authored terrain", () => {
  assert.equal(DISCOVERIES.length, 18);
  assert.equal(CHESTS.length, 8);
  for (const chest of CHESTS) {
    const nav = NAVIGATION[chest.map];
    assert.ok(nav.secretPassage.cells.length >= 2);
    assert.ok(isWalkable(chest.map, chest.x, chest.y));
    assert.ok(findRoute(chest.map, nav.spawn, chest).length > 0);
    for (const r of chest.rewards) if (r.item) assert.ok(ITEMS[r.item]);
  }
});
test("discoveries award once, reveal hidden treasure only at close range and survive older saves", () => {
  const { w, p } = setup(),
    site = DISCOVERIES.find((d) => d.map === "sprout" && d.hidden);
  assert.equal(w.snapshot(p.id).chests.length, 0);
  Object.assign(p, { x: site.x, y: site.y });
  w.step(0.01);
  assert.ok(p.exploration.discovered.includes(site.id));
  assert.equal(w.snapshot(p.id).chests.length, 1);
  const xp = p.xp,
    level = p.level;
  w.step(0.01);
  assert.equal(p.xp, xp);
  assert.equal(p.level, level);
  const restored = hydrateSave(serialize(p));
  assert.deepEqual(restored.exploration, p.exploration);
  assert.deepEqual(hydrateSave({ classId: "warden" }).exploration, {
    discovered: [],
    opened: [],
    pending: [],
  });
});
test("chests require discovery, distance and boss conditions, and cannot be reopened or spoof their rewards", () => {
  const { w, p } = setup("stump"),
    chest = CHESTS.find((c) => c.map === p.map);
  p.defeatedBosses = [];
  assert.equal(w.act(p.id, { type: "openChest", chest: chest.id }), false);
  Object.assign(p, { x: chest.x, y: chest.y });
  w.step(0.01);
  assert.equal(w.act(p.id, { type: "openChest", chest: chest.id }), false);
  p.defeatedBosses.push("m20");
  assert.ok(
    w.act(p.id, {
      type: "openChest",
      chest: chest.id,
      rewards: [{ count: 999999 }],
    }),
  );
  assert.equal(w.map(p.map).drops.length, 4);
  assert.equal(w.act(p.id, { type: "openChest", chest: chest.id }), false);
  assert.equal(
    w.map(p.map).drops.find((d) => d.kind === "currency").count,
    chest.rewards.at(-1).count,
  );
});
test("uncollected chest rewards resume after reload and collected rewards never duplicate on reconnect", () => {
  const { w, p } = setup(),
    chest = CHESTS.find((c) => c.map === p.map);
  Object.assign(p, { x: chest.x, y: chest.y });
  w.step(0.01);
  assert.ok(w.openChest(p, chest.id));
  const base = p.gold;
  const money = w.map(p.map).drops.find((d) => d.kind === "currency");
  w.pickup(p, money.id);
  const mid = serialize(p),
    resumed = new World(),
    q = resumed.addPlayer(mid);
  assert.equal(q.gold, base);
  assert.equal(resumed.map(q.map).drops.length, 4);
  const cash = resumed.map(q.map).drops.find((d) => d.kind === "currency");
  resumed.pickup(q, cash.id);
  tick(resumed);
  assert.equal(q.gold, base + cash.count);
  assert.equal(q.exploration.pending[0].rewards.length, 3);
  const saved = serialize(q);
  resumed.players.delete(q.id);
  resumed.addPlayer(saved, q.id);
  assert.equal(
    resumed.map(q.map).drops.length,
    3,
    "no duplicated remaining ground rewards",
  );
  const third = new World(),
    r = third.addPlayer(saved);
  assert.equal(third.map(r.map).drops.length, 3);
  assert.ok(!third.map(r.map).drops.some((d) => d.kind === "currency"));
  assert.equal(third.openChest(r, chest.id), false);
});
