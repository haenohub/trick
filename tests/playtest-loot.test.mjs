import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  createPlayer,
  stats,
  grantXp,
  serialize,
  hydrateSave,
} from "../site/core.js";
import { NAVIGATION } from "../site/world-layout.js";
import { MONSTERS } from "../site/data.js";
import {
  TEST_BALANCE,
  xpReward,
  dropChance,
  PICKUP_DURATION,
} from "../site/balance.js";
function setup() {
  const w = new World({ seed: 4 }),
    raw = createPlayer();
  Object.assign(raw, { map: "sprout", ...NAVIGATION.sprout.spawn });
  const p = w.addPlayer(raw);
  return { w, p };
}
function kill(w, p) {
  const m = w.map(p.map).mobs[0];
  Object.assign(m, { x: p.x + 0.7, y: p.y, hp: 1 });
  w.rng = () => 0;
  w.attack(p, m.uid);
  return m;
}
const tick = (w, t) => {
  for (let n = 0; n < Math.ceil(t / 0.05); n++) w.step(0.05);
};
test("playtest speed is exactly fivefold for players, with tenfold XP and capped independent loot chances", () => {
  assert.equal(stats(createPlayer()).speed, 3.3 * 5);
  assert.equal(stats(createPlayer("ranger")).speed, 3.7 * 5);
  assert.equal(xpReward(37), 370);
  assert.equal(dropChance(0.012), 0.12);
  assert.equal(dropChance(0.38), 1);
  const p = createPlayer();
  grantXp(p, 37);
  assert.equal(p.level, 3);
  assert.equal(p.xp, 115);
  assert.deepEqual(TEST_BALANCE, { speed: 5, experience: 10, drops: 10 });
});
test("monster death leaves items and currency on the floor until clicked and fully flown to the owner", () => {
  const { w, p } = setup(),
    before = p.gold,
    inventory = structuredClone(p.inventory);
  kill(w, p);
  assert.deepEqual(p.inventory, inventory);
  assert.equal(p.gold, before);
  tick(w, 0.4);
  const drops = w.snapshot(p.id).drops;
  assert.equal(drops.length, 6);
  const money = drops.find((d) => d.kind === "currency");
  assert.ok(money.count > 0);
  assert.equal(w.act(p.id, { type: "pickup", drop: money.id }), true);
  assert.equal(w.act(p.id, { type: "pickup", drop: money.id }), false);
  tick(w, PICKUP_DURATION - 0.15);
  assert.equal(p.gold, before);
  tick(w, 0.25);
  assert.equal(p.gold, before + money.count);
  assert.ok(!w.snapshot(p.id).drops.some((d) => d.id === money.id));
  assert.equal(p.lootNotices.at(-1).kind, "currency");
  assert.equal(p.lootNotices.at(-1).count, money.count);
  tick(w, 1);
  assert.equal(p.gold, before + money.count);
  const trophy = w.snapshot(p.id).drops.find((d) => d.item === "trophy1");
  assert.ok(w.act(p.id, { type: "pickup", drop: trophy.id }));
  tick(w, 1);
  assert.equal(p.inventory.trophy1, 1);
  assert.equal(p.lootNotices.at(-1).item, "trophy1");
});
test("pickup authority rejects unknown, distant, expired and other-owner drops and invented quantities", () => {
  const { w, p } = setup();
  kill(w, p);
  const d = w.snapshot(p.id).drops.find((d) => d.kind === "currency"),
    before = p.gold;
  const q = w.addPlayer(
    { ...createPlayer(), map: p.map, x: p.x, y: p.y },
    "other",
  );
  assert.equal(w.act(q.id, { type: "pickup", drop: d.id }), false);
  assert.equal(w.act(p.id, { type: "pickup", drop: 999999 }), false);
  const start = { x: p.x, y: p.y };
  p.x += 100;
  assert.equal(w.act(p.id, { type: "pickup", drop: d.id }), false);
  Object.assign(p, start);
  assert.ok(
    w.act(p.id, { type: "pickup", drop: d.id, count: 999999, item: "spear2" }),
  );
  tick(w, 1);
  assert.equal(p.gold, before + d.count);
  const another = w.snapshot(p.id).drops[0];
  another.until = w.time;
  assert.equal(w.act(p.id, { type: "pickup", drop: another.id }), false);
});
test("fivefold click movement follows curved corners without tunneling and preserves saved leaf balances", () => {
  const { w, p } = setup(),
    n = NAVIGATION.sprout;
  for (const m of w.map(p.map).mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  assert.ok(w.act(p.id, { type: "moveTo", ...n.eastLanding }));
  for (let i = 0; i < 500 && p.moveTarget; i++) w.step(0.1);
  assert.ok(Math.hypot(p.x - n.eastLanding.x, p.y - n.eastLanding.y) < 0.1);
  p.gold = 12345;
  assert.equal(hydrateSave(serialize(p)).gold, 12345);
});
