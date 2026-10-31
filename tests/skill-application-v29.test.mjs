import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { World, createPlayer } from "../site/core.js";
import { SKILL_VISUALS } from "../site/skill-visuals.js";
import {
  skillPlacement,
  impactFrame,
  HIT_FRAMES,
} from "../site/skill-effects.js";
import { MONSTER_HIT_DURATION, IMPACT_DURATION } from "../site/animation.js";
import { project } from "../site/view-projection.js";
import { NAVIGATION } from "../site/world-layout.js";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const advance = (w, t) => {
  while (w.time < t - 1e-9) w.step(Math.min(0.005, t - w.time));
};
const scene = { time: 0, player: { id: "local", x: 1, y: 1 }, peers: [] };
const effect = {
  started: 0,
  until: 1,
  owner: "local",
  x: 5,
  y: 6,
  fromX: 1,
  fromY: 1,
  radius: 3,
};

test("all 28 clips have individually reviewed native anchors and retain the exact authored pixels", async () => {
  const audit = JSON.parse(
    await readFile("art/skill-application-v29.json", "utf8"),
  );
  assert.equal(Object.keys(art.skillApplication).length, 28);
  for (const [key, v] of Object.entries(SKILL_VISUALS)) {
    const a = art.skillApplication[key],
      atlas = (
        v.atlas === "expanded" ? art.expandedSkillEffects : art.skillEffects
      )[v.classId];
    assert.equal(a.version, 29);
    assert.equal(a.anchors.length, atlas.rowFrames[v.row]);
    assert.equal(a.size, 128);
    for (const anchor of a.anchors)
      for (const n of anchor)
        assert.ok(Number.isInteger(n) && n >= 4 && n < 124, key);
    assert.equal(
      audit.skills[key].sha256,
      createHash("sha256")
        .update(await readFile("site/assets/" + atlas.file + ".png"))
        .digest("hex"),
    );
  }
});
test("every frame shares one undistorted pixel scale, bounded size and an exact registered origin at different zooms", () => {
  for (const [key, v] of Object.entries(SKILL_VISUALS))
    for (const zoom of [0.8, 1.21 / 1.2, 1.5]) {
      const a = art.skillApplication[key];
      let size;
      for (let f = 0; f < a.anchors.length; f++) {
        const state = { ...scene, time: (f + 0.5) / a.anchors.length };
        const q = skillPlacement(a, v, effect, state, project, zoom);
        assert.ok(q && q.frame >= 0 && q.frame < a.anchors.length, key);
        assert.ok(q.alpha >= 0 && q.alpha <= 1);
        assert.equal(q.size / 64, Math.round(q.size / 64));
        assert.ok(
          q.size <= 128 * Math.max(0.5, (a.maxScale || a.scale) * zoom) + 1e-8,
          key + " bounded size",
        );
        if (size !== undefined)
          assert.equal(q.size, size, key + " no per-frame resizing");
        size = q.size;
        const dx = Math.round((-q.pivot[0] / 128) * q.size),
          dy = Math.round((-q.pivot[1] / 128) * q.size);
        assert.ok(Math.abs(dx + (q.pivot[0] / 128) * q.size) <= 0.5);
        assert.ok(Math.abs(dy + (q.pivot[1] / 128) * q.size) <= 0.5);
        if (a.kind === "ground" || a.kind === "beam")
          assert.deepEqual(
            [q.x, q.y],
            [Math.round(project(5, 6).x), Math.round(project(5, 6).y)],
          );
      }
    }
});
test("rain stays at its selected floor, self effects follow their owner and fields keep a stable held animation", () => {
  const rain = art.skillApplication["ranger-1"],
    visual = SKILL_VISUALS["ranger-1"];
  for (const time of [0.01, 0.31, 0.32, 0.33, 0.6, 0.99]) {
    const q = skillPlacement(
      rain,
      visual,
      effect,
      { ...scene, time },
      project,
      1,
    );
    assert.equal(q.x, project(5, 6).x);
    assert.equal(q.y, project(5, 6).y);
  }
  const p = skillPlacement(
    art.skillApplication["warden-1"],
    SKILL_VISUALS["warden-1"],
    effect,
    { ...scene, time: 0.5, player: { id: "local", x: 7, y: 3 } },
    project,
    1,
  );
  assert.deepEqual([p.x, p.y], [project(7, 3).x, project(7, 3).y - 36]);
  for (const time of [1, 2, 3, 4, 5]) {
    const q = skillPlacement(
      art.skillApplication["herbalist-2"],
      SKILL_VISUALS["herbalist-2"],
      { ...effect, until: 7 },
      { ...scene, time },
      project,
      1,
    );
    assert.ok([5, 6, 7].includes(q.frame));
  }
  assert.equal(
    skillPlacement(rain, visual, effect, { ...scene, time: 1 }, project, 1),
    null,
  );
});

test("the healing ring anchors its ellipse center rather than its front edge and closing fragments cannot drag the origin", () => {
  const ring = art.skillApplication["herbalist-2"];
  // The authored settled ring spans roughly y=80..120; y=112..120 is
  // the front rim, not the selected floor point at the ellipse's center.
  for (const f of [5, 6, 7])
    assert.ok(ring.anchors[f][1] >= 95 && ring.anchors[f][1] <= 103);
  for (const a of Object.values(art.skillApplication)) {
    if (a.kind !== "ground" || a === art.skillApplication["warden-4"]) continue;
    const settle = Math.floor(a.anchors.length * 0.65);
    for (const anchor of a.anchors.slice(settle + 1))
      assert.deepEqual(anchor, a.anchors[settle]);
  }
});

function fixture(def = "m1") {
  const raw = createPlayer();
  Object.assign(raw, {
    level: 30,
    map: "sprout",
    ...NAVIGATION.sprout.worldAt(8, 10),
  });
  const w = new World({ seed: 42 }),
    p = w.addPlayer(raw);
  w.rng = () => 0.5;
  w.advanceCombat = () => {};
  for (const m of w.map(p.map).mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  const m = w.map(p.map).mobs[0];
  Object.assign(m, {
    def,
    x: p.x + 0.8,
    y: p.y,
    homeX: p.x + 0.8,
    homeY: p.y,
    hp: 1e6,
    maxHp: 1e6,
    nextAttack: Infinity,
    hitUntil: 0,
    ai: "chase",
  });
  p.hp = 1e6;
  return { w, p, m };
}
test("direct monster hits stop AI and locomotion for exactly 0.1 seconds, including bosses", () => {
  assert.equal(MONSTER_HIT_DURATION, 0.1);
  for (const id of ["m1", "m20"]) {
    const { w, p, m } = fixture(id),
      start = { x: m.x, y: m.y };
    assert.ok(w.damage(p, m, 20));
    assert.equal(m.hitUntil, 0.1);
    assert.equal(m.animDuration, 0.1);
    assert.equal(w.moveMob(m, p.map, p, 0.05, 5), false);
    advance(w, 0.099);
    assert.equal(m.anim, "hurt");
    assert.deepEqual({ x: m.x, y: m.y }, start);
    advance(w, 0.1);
    assert.notEqual(m.anim, "hurt");
  }
});
test("stagger pauses a pending strike instead of firing during hurt, and simultaneous hits never multiply the pause", () => {
  const { w, p, m } = fixture();
  m.windup = {
    start: 0,
    strikeAt: 0,
    at: 0.05,
    x: p.x,
    y: p.y,
    radius: 1,
    style: "circle",
  };
  assert.ok(w.damage(p, m, 20));
  assert.ok(w.damage(p, m, 20));
  assert.ok(Math.abs(m.windup.at - 0.15) < 1e-8);
  advance(w, 0.05);
  assert.ok(w.damage(p, m, 20));
  assert.ok(Math.abs(m.windup.at - 0.2) < 1e-8);
  const hp = p.hp;
  advance(w, 0.199);
  assert.equal(p.hp, hp);
  assert.ok(m.windup);
  advance(w, 0.201);
  assert.equal(m.windup, null);
  assert.ok(p.hp < hp);
});
test("a monster's landed strike also uses a 0.1-second effect and player hurt pose", () => {
  const { w, p, m } = fixture();
  p.autoAttackSuppressed = true;
  m.windup = {
    start: -0.7,
    strikeAt: -0.05,
    at: 0.01,
    x: p.x,
    y: p.y,
    radius: 1,
    style: "circle",
  };
  advance(w, 0.01);
  assert.equal(p.anim, "hurt");
  assert.equal(p.animDuration, 0.1);
  const strike = w.effects.find((e) => e.kind === "enemy");
  assert.ok(strike);
  assert.ok(Math.abs(strike.until - strike.started - 0.1) < 1e-8);
  advance(w, 0.109);
  assert.equal(p.anim, "hurt");
  advance(w, 0.111);
  assert.equal(p.anim, "idle");
  assert.equal(w.effects.filter((e) => e.kind === "enemy").length, 0);
});
test("impacts use only three native 30fps contact frames for 0.1 seconds; poison and misses add no stun or flash", () => {
  assert.equal(IMPACT_DURATION, 0.1);
  for (const [cls, frames] of Object.entries(HIT_FRAMES)) {
    assert.equal(frames.length, 3);
    assert.deepEqual(
      [0, 1, 2].map((f) => impactFrame(cls, (f + 0.5) / 30)),
      frames,
    );
    assert.equal(impactFrame(cls, 0.1), null);
    assert.equal(impactFrame(cls, -0.001), null);
    assert.ok(
      frames.every(
        (f) =>
          f <
          art.attackImpacts.rowFrames[
            ["warden", "mage", "ranger", "herbalist"].indexOf(cls)
          ],
      ),
    );
  }
  const { w, p, m } = fixture();
  w.damage(p, m, 20, "poison");
  assert.equal(m.hitUntil, 0);
  assert.notEqual(m.anim, "hurt");
  assert.equal(w.effects.filter((e) => e.kind === "attack-impact").length, 0);
  assert.ok(
    w.effects.filter((e) => e.kind === "poison").every((e) => !e.impact),
  );
  w.rng = () => 0.999999;
  assert.equal(w.damage(p, m, 20), false);
  assert.equal(m.hitUntil, 0);
  w.rng = () => 0.5;
  assert.ok(w.damage(p, m, 20));
  const hit = w.effects.find((e) => e.kind === "attack-impact");
  assert.equal(hit.until - hit.started, 0.1);
  advance(w, 0.1);
  assert.equal(w.effects.filter((e) => e.kind === "attack-impact").length, 0);
});
