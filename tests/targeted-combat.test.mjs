import { test } from "node:test";
import assert from "node:assert/strict";
import { World, createPlayer, stats } from "../site/core.js";
import { combatAim } from "../site/targeting.js";
import { MONSTERS } from "../site/data.js";
import { PLAYER_DAMAGE_SCALE } from "../site/balance.js";
import { WORLD_ZOOM } from "../site/world-layout.js";
const advance = (w, t) => {
  while (w.time + 1e-8 < t) w.step(Math.min(0.01, t - w.time));
};
function scene(cls) {
  const w = new World(),
    p = w.addPlayer({ ...createPlayer(cls), map: "sprout", level: 30 });
  w.rng = () => 0.5;
  const mobs = w.map(p.map).mobs,
    m = mobs[0];
  p.x = m.x - 0.8;
  p.y = m.y;
  for (const mob of mobs) {
    mob.hp = 0;
    mob.respawn = Infinity;
  }
  Object.assign(m, {
    hp: 100000,
    maxHp: 100000,
    rootUntil: Infinity,
    nextAttack: Infinity,
  });
  return { w, p, m };
}
test("basic attacks require an explicit target and ranged damage waits for arrow or descending beam impact", () => {
  for (const cls of ["ranger", "mage"]) {
    const { w, p, m } = scene(cls),
      hp = m.hp;
    assert.equal(w.attack(p), false);
    assert.ok(w.attack(p, m.uid));
    const release = p.action.hitAt;
    advance(w, release + 0.01);
    assert.equal(m.hp, hp);
    const e = w.effects.find(
      (e) => e.kind === (cls === "ranger" ? "arrow-shot" : "starfall"),
    );
    assert.ok(e);
    advance(w, e.hitAt - 0.01);
    assert.equal(m.hp, hp);
    advance(w, e.hitAt + 0.01);
    assert.ok(m.hp < hp);
    const after = m.hp;
    advance(w, w.time + 0.5);
    assert.equal(m.hp, after);
    assert.equal(w.pendingHits.length, 0);
    if (cls === "mage") assert.equal(p.spellCharge, 1);
  }
});
test("ground skills accept empty floor, preserve selected center and reject invalid placement without charging resources", () => {
  const { w, p, m } = scene("mage"),
    point = { x: m.x, y: m.y };
  m.hp = 0;
  const focus = p.focus;
  for (const bad of [
    { x: NaN, y: 0 },
    { x: Infinity, y: 0 },
    { x: p.x + 100, y: p.y },
  ])
    assert.equal(w.skill(p, 1, null, bad), false);
  assert.equal(p.focus, focus);
  assert.ok(w.skill(p, 1, null, point));
  assert.deepEqual(p.action.aim, point);
  advance(w, p.action.endAt + 0.01);
  const effect = w.effects.find((e) => e.kind === "magic");
  assert.equal(effect.x, point.x);
  assert.equal(effect.y, point.y);
});
test("ground targeting cannot turn a single-enemy skill into an arbitrary position cast", () => {
  const { w, p, m } = scene("ranger");
  assert.equal(w.skill(p, 0, null, { x: m.x, y: m.y }), false);
  assert.equal(w.skill(p, 0, "missing"), false);
  assert.equal(combatAim(p, 0).mode, "enemy");
  assert.equal(combatAim({ ...p, classId: "mage" }, 1).mode, "ground");
});
test("all player damage paths share half scaling and viewport is ten percent larger", () => {
  const { w, p, m } = scene("warden"),
    def = MONSTERS.find((d) => d.id === m.def),
    hp = m.hp;
  assert.equal(PLAYER_DAMAGE_SCALE, 0.5);
  w.damage(p, m, 1000);
  assert.equal(hp - m.hp, Math.round((1000 - def.defense * 0.4) * 0.5));
  const after = m.hp;
  w.damage(p, m, 1000, "poison");
  assert.equal(after - m.hp, Math.round((1000 - def.defense * 0.4) * 0.5));
  assert.equal(WORLD_ZOOM, (1 / 1.2) * 1.1);
});
