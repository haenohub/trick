import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  World,
  createPlayer,
  stats,
  serialize,
  hydrateSave,
  blocked,
} from "../site/core.js";
import { CLASSES, ITEMS, SKILL_COSTS, SKILL_COOLDOWNS } from "../site/data.js";
import {
  SKILL_LEVELS,
  SKILL_SLOTS,
  extraSkill,
} from "../site/skill-expansion.js";
import { DEFAULT_BINDINGS, restoreBindings } from "../site/controls.js";
import { NAVIGATION } from "../site/world-layout.js";
import { facingVector } from "../site/directions.js";
import { heldWeaponPose, HELD_WEAPON_SCALE } from "../site/avatar-draw.js";
import { rgbaPixels } from "./png.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const advance = (w, t) => {
  while (w.time < t - 1e-8) w.step(Math.min(0.01, t - w.time));
};
function fixture(cls = "warden", level = 30) {
  const raw = createPlayer(cls);
  raw.level = level;
  raw.map = "sprout";
  delete raw.allocated;
  delete raw.allocationVersion;
  const w = new World({ seed: 42 }),
    p = w.addPlayer(raw),
    v = facingVector(2),
    nav = NAVIGATION.sprout;
  w.rng = () => 0.5;
  w.updateMob = () => {};
  w.advanceCombat = () => {};
  let found = false;
  for (let r = 2; r < nav.rows - 2 && !found; r++)
    for (let c = 2; c < nav.cols - 2; c++) {
      const a = nav.worldAt(c, r),
        end = { x: a.x + v.x * 9, y: a.y + v.y * 9 };
      if (w.sight("sprout", a, end)) {
        Object.assign(p, a);
        found = true;
        break;
      }
    }
  assert.ok(found);
  const mobs = w.map(p.map).mobs;
  for (const m of mobs) {
    m.hp = 0;
    m.respawn = Infinity;
  }
  const center = { x: p.x + v.x * 2, y: p.y + v.y * 2 };
  for (const [i, m] of mobs.slice(0, 6).entries())
    Object.assign(m, {
      x: center.x + v.x * i * 0.08,
      y: center.y + v.y * i * 0.08,
      hp: 100000,
      maxHp: 100000,
      ai: "idle",
      dotUntil: 0,
      rootUntil: 0,
    });
  return { w, p, mobs: mobs.slice(0, 6), center, v };
}

test("eight new skills unlock at 12/18, spend resources once and only hit after their preparation", () => {
  assert.equal(SKILL_SLOTS.length, 6);
  assert.deepEqual(SKILL_LEVELS, [1, 4, 8, 25, 12, 18]);
  for (const cls of CLASSES)
    for (const slot of [4, 5]) {
      const { w, p, mobs, center } = fixture(cls.id);
      const def = extraSkill(cls.id, slot),
        point = def.mode === "self" ? null : center;
      p.level = SKILL_LEVELS[slot] - 1;
      assert.equal(w.skill(p, slot, null, point), false);
      p.level = SKILL_LEVELS[slot];
      const hp = mobs[0].hp;
      assert.ok(w.skill(p, slot, null, point), cls.id + slot);
      assert.equal(p.focus, 100 - SKILL_COSTS[slot]);
      assert.equal(p.cooldowns[slot], SKILL_COOLDOWNS[slot]);
      assert.equal(w.skill(p, slot, null, point), false);
      advance(w, p.action.strikeAt - 0.001);
      assert.equal(mobs[0].hp, hp);
      if (slot === 4) {
        const hitAt = p.action.hitAt;
        advance(w, hitAt + 0.01);
        assert.ok(mobs[0].hp < hp, cls.id);
        advance(w, 1.5);
        assert.equal(
          mobs.filter((m) => m.hp < 100000).length,
          5,
          cls.id + " target cap",
        );
      }
    }
});

test("new control and toxin effects respect boss immunity, ownership and setup cost", () => {
  const a = fixture();
  a.mobs[0].def = "m20";
  const before = { x: a.mobs[0].x, y: a.mobs[0].y };
  a.w.releaseExtraSkill(a.p, 4, a.center);
  assert.deepEqual({ x: a.mobs[0].x, y: a.mobs[0].y }, before);
  assert.ok(a.mobs[0].rootUntil <= 0.4);
  assert.ok(
    Math.hypot(a.mobs[5].x - a.center.x, a.mobs[5].y - a.center.y) > 0.01,
  );
  const h = fixture("herbalist");
  h.mobs[0].toxinStacks = 3;
  h.mobs[0].dotOwner = h.p.id;
  h.mobs[0].dotUntil = 10;
  h.mobs[1].toxinStacks = 3;
  h.mobs[1].dotOwner = "other";
  h.mobs[1].dotUntil = 10;
  h.w.releaseExtraSkill(h.p, 4, h.center);
  assert.ok(h.mobs[0].hp < h.mobs[1].hp);
  assert.equal(h.mobs[0].toxinStacks, 0);
  assert.equal(h.mobs[0].dotUntil, 0);
  assert.equal(h.mobs[1].toxinStacks, 3);
});

test("mobile skills interpolate inside walkable terrain and apply their distinct defenses on landing", () => {
  for (const cls of ["mage", "ranger", "herbalist"]) {
    const { w, p, center } = fixture(cls);
    const start = { x: p.x, y: p.y },
      base = stats(p);
    p.hp = base.maxHp * 0.5;
    p.lastHit = 0;
    p.poisonUntil = 10;
    assert.ok(w.skill(p, 5, null, center));
    advance(w, p.action.strikeAt - 0.001);
    assert.equal(p.x, start.x);
    assert.equal(p.y, start.y);
    advance(w, (p.action.leap.start + p.action.leap.landAt) / 2);
    assert.ok(Math.hypot(p.x - start.x, p.y - start.y) > 0);
    assert.ok(Math.hypot(p.x - center.x, p.y - center.y) > 0);
    assert.equal(blocked(p.map, p.x, p.y), false);
    advance(w, 0.8);
    assert.ok(Math.hypot(p.x - center.x, p.y - center.y) < 1e-7);
    if (cls === "mage") assert.equal(p.shield, base.maxHp * 0.12);
    if (cls === "ranger")
      assert.ok(Math.abs(stats(p).evasion - base.evasion - 0.1) < 1e-8);
    if (cls === "herbalist") {
      assert.equal(p.poisonUntil, 0);
      const hp = p.hp;
      advance(w, 1.3);
      assert.ok(p.hp > hp);
    }
    const focus = p.focus,
      cd = p.cooldowns[5];
    p.action = null;
    assert.equal(w.skill(p, 5, null, { x: p.x + 100, y: p.y + 100 }), false);
    assert.equal(p.focus, focus);
    assert.equal(p.cooldowns[5], cd);
    advance(w, 5);
    if (cls === "ranger") assert.equal(stats(p).evasion, base.evasion);
  }
});

test("counter stance reduces direct hits and allows only two bounded reactions", () => {
  const { w, p, mobs } = fixture(),
    m = mobs[0];
  p.counterGuardUntil = 3;
  p.counterCharges = 2;
  p.counterReady = 0;
  p.shield = 0;
  const hp = p.hp;
  w.hurtPlayer(p, 100, { source: m });
  assert.equal(p.hp, hp - 75);
  assert.equal(p.counterCharges, 1);
  const enemy = m.hp;
  w.hurtPlayer(p, 100, { source: m });
  assert.equal(m.hp, enemy);
  assert.equal(p.counterCharges, 1);
  w.time = 0.5;
  w.hurtPlayer(p, 100, { source: m });
  assert.equal(p.counterCharges, 0);
  assert.ok(m.hp < enemy);
  const last = m.hp;
  w.time = 1;
  w.hurtPlayer(p, 10, { source: m });
  assert.equal(m.hp, last);
});

test("new casts cancel before release and remaining star waves stop on travel or defeat", () => {
  for (const cls of CLASSES) {
    const { w, p, center, mobs } = fixture(cls.id);
    assert.ok(w.skill(p, 4, null, center));
    assert.ok(w.effects.some((e) => e.castId === p.action.castId));
    const focus = p.focus,
      cooldown = p.cooldowns[4];
    assert.ok(w.act(p.id, { type: "moveTo", x: p.x, y: p.y }));
    assert.equal(p.action, null);
    assert.equal(w.effects.filter((e) => e.castId).length, 0);
    assert.equal(p.focus, focus);
    assert.equal(p.cooldowns[4], cooldown);
    advance(w, 1.5);
    assert.ok(mobs.every((m) => m.hp === 100000));
  }
  for (const interrupt of ["travel", "defeat"]) {
    const { w, p, center, mobs } = fixture("mage");
    assert.ok(w.skill(p, 4, null, center));
    advance(w, p.action.hitAt + 0.01);
    assert.equal(w.pendingAreas.length, 1);
    const hp = mobs[0].hp;
    if (interrupt === "travel") p.map = "village";
    else w.hurtPlayer(p, p.hp + 999999, { avoidable: false });
    advance(w, 2);
    assert.equal(mobs[0].hp, hp);
    assert.equal(w.pendingAreas.length, 0);
  }
});

test("an out-of-range new mobility command approaches before spending focus and casting", () => {
  for (const cls of ["mage", "ranger", "herbalist"]) {
    const { w, p, v } = fixture(cls);
    // Use the real request/approach loop; the fixture only disables auto-attacks.
    w.advanceCombat = World.prototype.advanceCombat;
    const goal = { x: p.x + v.x * 8, y: p.y + v.y * 8 },
      start = { x: p.x, y: p.y };
    assert.ok(w.requestSkill(p, 5, null, goal));
    assert.equal(p.action, null);
    assert.equal(p.focus, 100);
    assert.equal(p.cooldowns[5], 0);
    assert.ok(p.queuedSkill && p.moveTarget);
    while (!p.action && w.time < 3) w.step(0.01);
    assert.ok(p.action?.leap, cls);
    assert.ok(Math.hypot(p.x - start.x, p.y - start.y) > 3);
    assert.ok(Math.hypot(p.x - goal.x, p.y - goal.y) <= 4.5);
    const landAt = p.action.leap.landAt;
    advance(w, landAt + 0.01);
    assert.ok(Math.hypot(p.x - goal.x, p.y - goal.y) < 1e-7);
    assert.ok(p.focus < 80 && p.cooldowns[5] > w.time);
  }
});

test("level-only repeatable profession changes preserve resources, reject other classes and keep old gear in the bag", () => {
  for (const cls of CLASSES) {
    const { w, p } = fixture(cls.id, 24);
    assert.equal(
      w.act(p.id, { type: "subclass", branch: cls.branches[0].id }),
      false,
    );
    p.level = 30;
    p.hp = 30;
    p.focus = 17;
    p.cooldowns[3] = 12;
    assert.ok(w.act(p.id, { type: "subclass", branch: cls.branches[0].id }));
    assert.equal(p.hp, 30);
    assert.equal(p.focus, 17);
    assert.equal(p.cooldowns[3], 12);
    const weapon = Object.values(ITEMS).find((i) => i.branch === p.branch);
    p.inventory[weapon.id] = 1;
    p.equipment.weapon = weapon.id;
    assert.ok(w.act(p.id, { type: "subclass", branch: cls.branches[1].id }));
    assert.equal(p.inventory[weapon.id], 1);
    assert.notEqual(p.equipment.weapon, weapon.id);
    assert.equal(p.hp, 30);
    assert.equal(p.focus, 17);
    assert.equal(p.cooldowns[3], 12);
    assert.equal(hydrateSave(serialize(p)).branch, cls.branches[1].id);
    assert.equal(w.act(p.id, { type: "subclass", branch: "invalid" }), false);
    assert.ok(w.act(p.id, { type: "subclass", branch: cls.branches[0].id }));
  }
});

test("new key bindings migrate around old custom D/G mappings", () => {
  const old = { ...DEFAULT_BINDINGS };
  delete old.skill4;
  delete old.skill5;
  old.pickup = "KeyG";
  old.inventory = "KeyD";
  old.skill0 = "KeyZ";
  const migrated = restoreBindings(old);
  assert.equal(migrated.pickup, "KeyG");
  assert.equal(migrated.inventory, "KeyD");
  assert.equal(migrated.skill0, "KeyZ");
  assert.equal(
    new Set(Object.values(migrated)).size,
    Object.keys(DEFAULT_BINDINGS).length,
  );
});

test("all nine bows use solid central contacts and real forward axes at 80% scale in every heading and motion", async () => {
  const art = await json("site/assets/manifest.json"),
    images = new Map();
  assert.equal(HELD_WEAPON_SCALE, 0.8);
  let bows = 0;
  for (const [id, w] of Object.entries(art.appearance.weapons)) {
    if (!images.has(w.file))
      images.set(
        w.file,
        rgbaPixels(await readFile(`site/assets/${w.file}.png`)),
      );
    const im = images.get(w.file);
    const cls = ITEMS[id].classId,
      body = art.appearance.bases[cls];
    for (let d = 0; d < 8; d++) {
      const g = w.grips[d];
      assert.equal(
        im.pixels[((w.index * 96 + g[1]) * im.width + d * 96 + g[0]) * 4 + 3],
        255,
        id + " missing grip",
      );
      for (let frame = 0; frame < 32; frame++) {
        const pose = heldWeaponPose(body, w, frame, d);
        assert.deepEqual(pose.hand, body.anchors[d][frame].hand);
        assert.ok(pose.weaponScale <= 0.8 && pose.weaponScale >= 0.56 - 1e-10);
      }
    }
    if (w.kind === "bow") {
      bows++;
      for (let d = 0; d < 8; d++) {
        const pose = heldWeaponPose(body, w, 4, d),
          angle = pose.angle + w.forwardAxes[pose.col],
          wanted = (d * Math.PI) / 4;
        assert.ok(Math.cos(angle - wanted) > 0.999, id + ":" + d);
        assert.equal(pose.weaponScale, 0.8);
      }
    }
  }
  assert.equal(bows, 9);
});
