import { test } from "node:test";
import assert from "node:assert/strict";
import { World, createPlayer, stats, findRoute } from "../site/core.js";
import { animationFrame, HIT_OFFSET } from "../site/animation.js";
import { NAVIGATION, isWalkable, herbPoints } from "../site/world-layout.js";
import { speciesForMap, mapsForSpecies } from "../site/ecology.js";
const advance = (w, until) => {
  while (w.time + 1e-8 < until) w.step(Math.min(0.01, until - w.time));
};
function encounter(classId = "warden") {
  const raw = createPlayer(classId);
  Object.assign(raw, {
    map: "sprout",
    level: 20,
    ...NAVIGATION.sprout.worldAt(8, 5),
  });
  const w = new World({ seed: 5 }),
    p = w.addPlayer(raw);
  w.rng = () => 0.5;
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
    hp: 10000,
    maxHp: 10000,
    rootUntil: Infinity,
    nextAttack: Infinity,
    ai: "idle",
  });
  return { w, p, m };
}
test("damage, resource procs and strike-frame feedback occur after preparation exactly once", () => {
  const layout = {
    animations: {
      idle: [0],
      windup: [8, 9, 10],
      attack: [11, 12],
      recover: [13, 2],
    },
  };
  for (const cls of ["warden", "mage", "ranger", "herbalist"]) {
    const { w, p, m } = encounter(cls),
      before = m.hp;
    assert.ok(w.attack(p, m.uid));
    const action = { ...p.action };
    assert.equal(p.anim, "windup");
    assert.equal(m.hp, before);
    assert.equal(w.attack(p, m.uid), false);
    advance(w, action.strikeAt + 0.001);
    assert.equal(p.anim, "attack");
    assert.equal(m.hp, before);
    assert.equal(
      animationFrame(layout, p.anim, w.time, p.animAt, p.animDuration),
      11,
    );
    advance(w, action.hitAt + 0.001);
    assert.ok(m.hp < before);
    assert.equal(
      animationFrame(layout, p.anim, w.time, p.animAt, p.animDuration),
      12,
    );
    const after = m.hp;
    advance(w, action.endAt + 0.01);
    assert.equal(m.hp, after);
    if (cls === "mage") assert.equal(p.spellCharge, 1);
    if (cls === "herbalist") assert.equal(m.toxinStacks, 1);
    assert.equal(p.action, null);
  }
});
test("moving, changing maps or a target leaving reach prevents latent player hits", () => {
  for (const mode of ["move", "map", "escape"]) {
    const { w, p, m } = encounter();
    assert.ok(w.attack(p, m.uid));
    if (mode === "move")
      assert.ok(
        w.act(p.id, { type: "moveTo", ...NAVIGATION.sprout.worldAt(8, 6) }),
      );
    if (mode === "map") p.map = "village";
    if (mode === "escape") {
      m.x += 10;
      m.homeX = m.x;
    }
    advance(w, 0.6);
    assert.equal(m.hp, 10000, mode);
  }
});
test("enemy preparation, visible strike and recovery share the authoritative impact time", () => {
  const { w, p, m } = encounter();
  m.rootUntil = 0;
  m.nextAttack = 0;
  m.hp = m.maxHp = 1000;
  w.updateMob(m, p.map, [p], 0.01);
  assert.ok(m.windup);
  assert.equal(m.anim, "windup");
  const a = { ...m.windup },
    hp = p.hp;
  p.lastHit = 0;
  assert.ok(Math.abs(a.at - a.strikeAt - HIT_OFFSET) < 1e-9);
  w.time = a.strikeAt + 0.001;
  w.updateMob(m, p.map, [p], 0.01);
  assert.equal(m.anim, "attack");
  assert.equal(p.hp, hp);
  w.time = a.at + 0.001;
  w.updateMob(m, p.map, [p], 0.01);
  assert.ok(p.hp < hp);
  const after = p.hp;
  w.time = m.attackEnd + 0.01;
  w.updateMob(m, p.map, [p], 0.01);
  assert.equal(m.anim, "recover");
  assert.equal(p.hp, after);
});
test("all eight specializations release their damage, shields or healing after the casting tell", () => {
  for (const [cls, branches] of [
    ["warden", ["antler", "thorn"]],
    ["mage", ["moon", "bloom"]],
    ["ranger", ["hawk", "mist"]],
    ["herbalist", ["flower", "venom"]],
  ])
    for (const branch of branches) {
      const { w, p, m } = encounter(cls);
      p.branch = branch;
      p.level = 30;
      p.hp = 30;
      p.lastHit = 0;
      assert.ok(w.skill(p, 3, m.uid));
      const action = { ...p.action };
      assert.equal(m.hp, 10000);
      assert.equal(p.hp, 30);
      assert.equal(p.shield, 0);
      advance(w, action.endAt + 0.01);
      if (branch === "flower") assert.ok(p.hp > 30);
      else if (branch === "mist") assert.ok(p.shield > 0);
      else assert.ok(m.hp < 10000, branch + " failed to release");
    }
});
test("branching maps contain bent hidden approaches, ecological herb patches and shared species", () => {
  const w = new World();
  for (const nav of Object.values(NAVIGATION)) {
    if (!nav.secretPassage) continue;
    assert.ok(nav.routeCount >= 3, nav.id);
    assert.ok(nav.secretPassage.cells.length >= 4);
    assert.ok(
      findRoute(nav.id, nav.spawn, nav.secretPassage.finish).length > 0,
      nav.id,
    );
    assert.equal(
      w.sight(nav.id, nav.secretPassage.entrance, nav.secretPassage.finish),
      false,
      nav.id + " cache must be out of sight around bends",
    );
    const points = herbPoints(nav.id);
    assert.equal(points.length, 12);
    assert.equal(new Set(points.map((a) => a.site)).size, 3);
    for (const a of points) {
      assert.ok(isWalkable(nav.id, a.x, a.y));
      assert.ok(
        nav.gatherSites.some(
          (s) => s.item === a.item && Math.hypot(s.x - a.x, s.y - a.y) < 2,
        ),
      );
    }
    const map = w.map(nav.id),
      species = speciesForMap(nav.id);
    assert.ok(
      species.some((a) => a.guest),
      nav.id + " needs compatible visiting species",
    );
    assert.equal(new Set(map.mobs.map((m) => m.uid)).size, map.mobs.length);
    assert.ok(map.mobs.some((m) => mapsForSpecies(m.def).length > 1));
  }
});
