import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  createPlayer,
  stats,
  findRoute,
  blocked,
} from "../site/core.js";
import { NAVIGATION } from "../site/world-layout.js";
import { combatAim } from "../site/targeting.js";
const advance = (w, t) => {
  while (w.time + 1e-8 < t) w.step(Math.min(0.01, t - w.time));
};
function scene(cls = "warden") {
  const w = new World(),
    p = w.addPlayer({
      ...createPlayer(cls),
      map: "sprout",
      level: 30,
      ...NAVIGATION.sprout.worldAt(8, 10),
    });
  w.rng = () => 0.5;
  w.updateMob = () => {};
  for (const m of w.map(p.map).mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  const m = w.map(p.map).mobs[0];
  Object.assign(m, {
    x: p.x + 0.8,
    y: p.y,
    homeX: p.x + 0.8,
    homeY: p.y,
    hp: 1000000,
    maxHp: 1000000,
    ai: "idle",
  });
  return { w, p, m };
}
test("one attack command repeats basics on the chosen enemy, follows it, and stops when it dies", () => {
  const { w, p, m } = scene();
  assert.ok(w.act(p.id, { type: "attack", target: m.uid }));
  const first = { ...p.action };
  advance(w, 2.4);
  assert.ok(
    w.effects.filter((e) => e.owner === p.id && e.kind === "action").length > 0,
  );
  assert.ok(m.hp < 1000000 - stats(p).power * 0.5);
  assert.equal(p.combatTarget, m.uid);
  assert.ok(
    p.action.start > first.start,
    "subsequent cycles must start without another command",
  );
  const goal = NAVIGATION.sprout.worldAt(9, 10);
  Object.assign(m, goal);
  Object.assign(m, { homeX: m.x, homeY: m.y });
  const before = { x: p.x, y: p.y };
  advance(w, w.time + 1);
  assert.ok(Math.hypot(p.x - before.x, p.y - before.y) > 1);
  m.hp = 0;
  advance(w, w.time + 1);
  assert.equal(p.combatTarget, null);
  assert.equal(p.moveTarget, null);
});
test("cancel before release prevents a hit and suppresses retaliation until another explicit combat command", () => {
  const { w, p, m } = scene();
  w.act(p.id, { type: "attack", target: m.uid });
  w.act(p.id, { type: "cancelCombat" });
  advance(w, 0.9);
  assert.equal(m.hp, 1000000);
  assert.equal(p.action, null);
  w.hurtPlayer(p, 1, { avoidable: false, source: m });
  advance(w, 2);
  assert.equal(p.combatTarget, null);
  assert.equal(m.hp, 1000000);
  assert.ok(w.act(p.id, { type: "attack", target: m.uid }));
  advance(w, 3);
  assert.ok(m.hp < 1000000);
});
test("being attacked enters combat, while ordinary manual movement cancels pursuit and pending casts", () => {
  const { w, p, m } = scene();
  w.hurtPlayer(p, 1, { avoidable: false, source: m });
  assert.equal(p.combatTarget, m.uid);
  advance(w, 0.8);
  assert.ok(m.hp < 1000000);
  assert.ok(
    w.act(p.id, { type: "moveTo", ...NAVIGATION.sprout.worldAt(8, 11) }),
  );
  assert.equal(p.combatTarget, null);
  assert.equal(p.queuedSkill, null);
  advance(w, 1.8);
  assert.equal(p.action, null);
});
function distantFloor(p) {
  const nav = NAVIGATION[p.map];
  for (let r = 3; r < nav.rows - 3; r++)
    for (let c = 3; c < nav.cols - 3; c++) {
      const q = nav.worldAt(c, r),
        d = Math.hypot(p.x - q.x, p.y - q.y);
      if (
        d > 13 &&
        d < 30 &&
        !blocked(p.map, q.x, q.y) &&
        findRoute(p.map, p, q).length
      )
        return q;
    }
  throw Error("missing reachable distant floor");
}
test("out-of-range ground skills keep the exact center, move into range, then pay once and cast once", () => {
  const { w, p, m } = scene("mage"),
    point = distantFloor(p);
  m.hp = 0;
  const focus = p.focus,
    start = { x: p.x, y: p.y };
  assert.ok(w.act(p.id, { type: "skill", slot: 1, point }));
  assert.deepEqual(p.queuedSkill.point, point);
  assert.equal(p.focus, focus);
  assert.equal(p.cooldowns[1], 0);
  assert.equal(p.action, null);
  for (let i = 0; i < 1500 && !p.action; i++) w.step(0.01);
  assert.equal(p.action?.kind, "skill");
  assert.equal(p.queuedSkill, null);
  assert.deepEqual(p.action.aim, point);
  assert.ok(Math.hypot(p.x - start.x, p.y - start.y) > 1);
  assert.ok(
    Math.hypot(p.x - point.x, p.y - point.y) <=
      combatAim({ ...p, stats: stats(p) }, 1).range,
  );
  assert.ok(w.sight(p.map, p, point));
  assert.ok(p.focus < focus);
  const cooldown = p.cooldowns[1];
  advance(w, p.action.endAt + 0.01);
  const effect = w.effects.find((e) => e.kind === "magic");
  assert.equal(effect.x, point.x);
  assert.equal(effect.y, point.y);
  assert.equal(p.cooldowns[1], cooldown);
});
test("a queued skill takes precedence over repeated basics and basics resume afterwards", () => {
  const { w, p, m } = scene("mage");
  assert.ok(w.act(p.id, { type: "attack", target: m.uid }));
  const basic = { ...p.action };
  assert.ok(w.act(p.id, { type: "skill", slot: 1, point: { x: m.x, y: m.y } }));
  assert.equal(p.action.kind, "basic");
  advance(w, basic.endAt + 0.02);
  assert.equal(p.action.kind, "skill");
  const spell = { ...p.action };
  advance(w, spell.endAt + 0.2);
  assert.equal(p.action.kind, "basic");
  assert.equal(p.combatTarget, m.uid);
});
test("invalid or cancelled queued casts never charge focus or cooldown and cannot cast on a later map", () => {
  const { w, p } = scene("mage"),
    focus = p.focus;
  for (const point of [
    { x: NaN, y: 0 },
    { x: Infinity, y: 0 },
    { x: 1e6, y: 1e6 },
  ])
    assert.equal(w.act(p.id, { type: "skill", slot: 1, point }), false);
  assert.equal(p.queuedSkill, null);
  assert.equal(p.focus, focus);
  assert.ok(w.act(p.id, { type: "skill", slot: 1, point: distantFloor(p) }));
  w.act(p.id, { type: "cancelCombat" });
  advance(w, 2);
  assert.equal(p.focus, focus);
  assert.equal(p.cooldowns[1], 0);
  assert.equal(p.queuedSkill, null);
  assert.ok(w.act(p.id, { type: "skill", slot: 1, point: distantFloor(p) }));
  p.map = "village";
  Object.assign(p, NAVIGATION.village.spawn);
  advance(w, 3);
  assert.equal(p.queuedSkill, null);
  assert.equal(p.cooldowns[1], 0);
  assert.equal(p.action, null);
});

test("arrow rain uses a normal preparation and resumes automatic basics after recovery", () => {
  const { w, p, m } = scene("ranger");
  assert.ok(w.act(p.id, { type: "attack", target: m.uid }));
  const basic = { ...p.action };
  assert.ok(w.act(p.id, { type: "skill", slot: 1, point: { x: m.x, y: m.y } }));
  advance(w, basic.endAt + 0.02);
  assert.equal(p.anim, "windup");
  const cast = { ...p.action };
  advance(w, w.time + 0.1);
  assert.equal(p.action.kind, "skill");
  advance(w, cast.endAt + 0.1);
  assert.equal(p.action?.kind, "basic");
});
