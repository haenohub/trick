import { test } from "node:test";
import assert from "node:assert/strict";
import { World, createPlayer, stats } from "../site/core.js";
import { NAVIGATION, isWalkable } from "../site/world-layout.js";
import { MONSTERS } from "../site/data.js";
import {
  zoneHits,
  zoneOutline,
  attackZones,
  bossAttack,
  clearSight,
} from "../site/combat.js";
function setup(cls = "warden", map = "sprout") {
  const raw = createPlayer(cls);
  Object.assign(raw, {
    level: 20,
    map,
    defeatedBosses: ["m20"],
    ...NAVIGATION[map].spawn,
  });
  raw.hp = stats(raw).maxHp;
  const w = new World({ seed: 9 }),
    p = w.addPlayer(raw);
  w.rng = () => 0.5;
  for (const m of w.map(map).mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  return { w, p };
}
function enemy(w, p, index = 0) {
  const m = w.map(p.map).mobs[index];
  Object.assign(m, {
    x: p.x + 0.8,
    y: p.y,
    homeX: p.x + 0.8,
    homeY: p.y,
    hp: 10000,
    maxHp: 10000,
    nextAttack: Infinity,
    rootUntil: Infinity,
    ai: "idle",
  });
  return m;
}
const tick = (w, t) => {
  for (let i = 0; i < Math.ceil(t / 0.05); i++) w.step(0.05);
};
const finishAction = (w, p) => {
  for (let n = 0; n < 120 && (p.action || (w.pendingHits || []).length); n++)
    w.step(0.01);
};
test("telegraph circles, safe rings and finite-width lines share exact outline geometry", () => {
  const ring = { x: 0, y: 0, style: "ring", radius: 5, innerRadius: 2 };
  assert.ok(!zoneHits({ x: 1, y: 0 }, ring));
  assert.ok(zoneHits({ x: 3, y: 0 }, ring));
  assert.ok(!zoneHits({ x: 6, y: 0 }, ring));
  const line = { x: 0, y: 0, tx: 6, ty: 0, style: "line", width: 0.75 };
  assert.ok(zoneHits({ x: 3, y: 0.7 }, line));
  assert.ok(!zoneHits({ x: 3, y: 1 }, line));
  assert.ok(!zoneHits({ x: 8, y: 0 }, line));
  for (const p of zoneOutline(ring))
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 5) < 1e-10);
  for (const p of zoneOutline(ring, true))
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 2) < 1e-10);
});
test("warden banks absorbed guard into a piercing counter and interrupts ordinary windups", () => {
  const { w, p } = setup(),
    a = enemy(w, p),
    b = enemy(w, p, 1);
  b.x = p.x + 2.2;
  p.shield = 100;
  p.shieldUntil = 10;
  for (let i = 0; i < 3; i++) w.hurtPlayer(p, 10);
  assert.equal(p.guardPower, 3);
  const hp = p.hp;
  assert.ok(w.skill(p, 0, a.uid));
  finishAction(w, p);
  assert.equal(p.guardPower, 0);
  assert.ok(a.hp < 10000 && b.hp < 10000);
  assert.equal(p.hp, hp);
  a.windup = { at: 10 };
  b.windup = { at: 10 };
  p.focus = 100;
  assert.ok(w.skill(p, 2, a.uid));
  finishAction(w, p);
  assert.equal(a.windup, null);
  assert.equal(b.windup, null);
});
test("mage builds three seeds through attacks and spends them on a stronger wider burst", () => {
  const { w, p } = setup("mage"),
    m = enemy(w, p);
  for (let i = 0; i < 3; i++) {
    p.attackReady = 0;
    assert.ok(w.attack(p, m.uid));
    finishAction(w, p);
  }
  assert.equal(p.spellCharge, 3);
  const before = m.hp;
  assert.ok(w.skill(p, 1, m.uid));
  finishAction(w, p);
  assert.equal(p.spellCharge, 0);
  const def = MONSTERS.find((d) => d.id === m.def);
  assert.equal(
    before - m.hp,
    Math.round(
      (stats(p).magicPower * 3.45 -
        Math.round(def.defense * 0.75 + def.level * 0.15) * 0.4) *
        0.5,
    ),
  );
  assert.ok(w.effects.some((e) => e.kind === "magic" && e.radius > 3));
});
test("ranged monsters retreat during cooldown and roots prevent the retreat", () => {
  const { w, p } = setup(),
    m = enemy(w, p);
  m.def = MONSTERS.find((d) => d.ranged).id;
  m.rootUntil = 0;
  const before = Math.hypot(m.x - p.x, m.y - p.y);
  w.updateMob(m, p.map, [p], 0.1);
  assert.ok(Math.hypot(m.x - p.x, m.y - p.y) > before);
  assert.ok(isWalkable(p.map, m.x, m.y));
  const at = { x: m.x, y: m.y };
  m.rootUntil = 10;
  w.updateMob(m, p.map, [p], 0.1);
  assert.equal(m.x, at.x);
  assert.equal(m.y, at.y);
});
test("arrow rain releases upward, then deals three delayed area waves without dodge or precision bonuses", () => {
  const { w, p } = setup("ranger"),
    m = enemy(w, p),
    before = m.hp;
  assert.ok(w.skill(p, 1, m.uid));
  finishAction(w, p);
  assert.equal(p.evadeUntil, 0);
  assert.equal(p.precisionUntil, 0);
  const e = w.effects.find((e) => e.kind === "arrow-rain");
  assert.ok(e);
  const areas = w.pendingAreas[0];
  assert.equal(areas.waves.length, 3);
  const release = e.started;
  while (w.time < release + 0.53) w.step(0.01);
  assert.equal(m.hp, before);
  while (w.time < release + 0.57) w.step(0.01);
  const once = m.hp;
  assert.ok(once < before);
  while (w.time < release + 0.92) w.step(0.01);
  assert.equal(before - m.hp, (before - once) * 3);
  assert.equal(w.pendingAreas.length, 0);
});
test("herbalist stacks poison and a stationary garden heals allies rather than following its caster", () => {
  const { w, p } = setup("herbalist"),
    m = enemy(w, p);
  p.lastHit = 0;
  w.attack(p, m.uid);
  finishAction(w, p);
  assert.equal(m.toxinStacks, 1);
  w.skill(p, 1, m.uid);
  finishAction(w, p);
  assert.equal(m.toxinStacks, 3);
  p.focus = 100;
  assert.ok(w.skill(p, 2, m.uid));
  finishAction(w, p);
  const field = w.effects.find((e) => e.tickAt);
  const ally = w.addPlayer(
    { ...createPlayer(), map: p.map, x: field.x, y: field.y },
    "ally",
  );
  ally.hp = 20;
  ally.lastHit = 0;
  p.x += 5;
  const before = m.hp;
  tick(w, 1.1);
  assert.ok(ally.hp > 20);
  assert.ok(m.hp < before);
  assert.ok(Math.abs(field.x - p.x) > 4);
});
test("monster pursuit routes around a wall, cannot shoot through it and respects a hard leash", () => {
  const { w, p } = setup("mage", "village");
  const fountain = NAVIGATION.village.worldAt(...NAVIGATION.village.fountain);
  Object.assign(p, { x: fountain.x - 4.3, y: fountain.y });
  const template = structuredClone(w.map("sprout").mobs[0]),
    home = { x: fountain.x + 4.3, y: fountain.y };
  const m = {
    ...template,
    ...home,
    homeX: home.x,
    homeY: home.y,
    ai: "chase",
    nextAttack: 0,
  };
  w.map("village").mobs = [m];
  assert.ok(!clearSight("village", p, m, isWalkable));
  assert.equal(w.skill(p, 0, m.uid), false);
  const start = Math.hypot(m.x - p.x, m.y - p.y);
  let distance = start;
  for (let i = 0; i < 200; i++) {
    w.step(0.05);
    assert.ok(isWalkable("village", m.x, m.y));
    distance = Math.min(distance, Math.hypot(m.x - p.x, m.y - p.y));
  }
  assert.ok(distance < start - 2);
  assert.ok(m.pathGoal);
  // Isolate the leash check from a windup/recovery already in progress.
  m.windup = null;
  m.attackEnd = 0;
  m.recoverUntil = 0;
  m.x = m.homeX + 20;
  m.y = m.homeY;
  w.step(0.05);
  assert.equal(m.ai, "return");
});
test("bosses have different three-phase patterns, safe centers and no damage multiplication on overlapping zones", () => {
  for (const id of ["m20", "m40"]) {
    const m = { def: id, x: 0, y: 0, hp: 100, maxHp: 100, pattern: 0 },
      p = { x: 3, y: 1 };
    const first = bossAttack(m, p, 1);
    m.hp = 20;
    const last = bossAttack(m, p, 1);
    assert.equal(first.phase, 1);
    assert.equal(last.phase, 3);
    assert.ok(last.at < first.at);
    assert.ok(last.damageScale > first.damageScale);
    m.pattern = id === "m20" ? 2 : 1;
    const ring = bossAttack(m, p, 1);
    assert.ok(!attackZones(ring).some((z) => zoneHits(m, z)));
  }
  const { w, p } = setup("warden", "stump"),
    m = enemy(w, p);
  m.def = "m20";
  m.rootUntil = 0;
  const hp = p.hp;
  m.windup = {
    x: p.x,
    y: p.y,
    start: 0,
    at: 0.01,
    zones: [
      { x: p.x, y: p.y, radius: 2 },
      { x: p.x, y: p.y, radius: 2 },
    ],
  };
  w.step(0.05);
  const damage = Math.max(
    2,
    Math.round(
      MONSTERS.find((d) => d.id === "m20").attack - stats(p).defense * 0.45,
    ),
  );
  assert.equal(hp - p.hp, damage);
});
