import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, createPlayer, stats, distance } from "../site/core.js";
import { MONSTERS, MAPS } from "../site/data.js";
import { NAVIGATION, WORLD_ZOOM, isWalkable } from "../site/world-layout.js";
import { project } from "../site/view-projection.js";
import { clearSight } from "../site/combat.js";
import { DEFAULT_BINDINGS, restoreBindings } from "../site/controls.js";
import { setFullscreen, fullscreenSupported } from "../site/display-mode.js";
import { rgbaPixels } from "./png.mjs";
function fixture() {
  const w = new World(),
    raw = createPlayer("ranger");
  Object.assign(raw, {
    level: 30,
    map: "sprout",
    ...NAVIGATION.sprout.worldAt(8, 10),
  });
  const p = w.addPlayer(raw),
    m = w.map(p.map).mobs[0];
  w.updateMob = () => {};
  w.rng = () => 0.5;
  Object.assign(m, {
    x: p.x + 2,
    y: p.y,
    homeX: p.x + 2,
    homeY: p.y,
    hp: 1e7,
    maxHp: 1e7,
  });
  return { w, p, m };
}
function advance(w, t) {
  for (let n = 0; n < Math.ceil(t / 0.01); n++) w.step(0.01);
}
test("original population, player speed and an additional ten percent zoom are restored exactly", () => {
  const w = new World();
  assert.equal(
    MAPS.reduce((n, m) => n + w.map(m.id).mobs.length, 0),
    284,
  );
  assert.equal(stats(createPlayer()).speed, 16.5);
  assert.equal(stats(createPlayer("ranger")).speed, 18.5);
  assert.ok(Math.abs(WORLD_ZOOM / (1.1 / 1.2) - 1.1) < 1e-12);
});
test("tracking mark releases real delayed arrows while multiple new click routes keep moving", () => {
  const { w, p, m } = fixture(),
    start = { x: p.x, y: p.y };
  assert.ok(w.releaseSkill(p, 2, m));
  const hp = m.hp;
  const goals = [
    { x: p.x + 7, y: p.y },
    { x: p.x - 5, y: p.y },
    { x: p.x, y: p.y + 7 },
    { x: p.x, y: p.y - 5 },
  ].filter(
    (g) =>
      isWalkable(p.map, g.x, g.y) && clearSight(p.map, start, g, isWalkable),
  );
  assert.ok(goals.length > 0);
  const releases = [],
    positions = [];
  for (let n = 0; n < 160; n++) {
    if (n % 16 === 0) {
      const a = n % 32 === 0 ? goals[0] : start;
      assert.ok(w.act(p.id, { type: "moveTo", ...a }));
    }
    const old = w.sequence;
    w.step(0.01);
    positions.push(distance(p, start));
    for (const e of w.effects.filter(
      (e) => e.id > old && e.kind === "arrow-shot" && e.mobile,
    ))
      releases.push({ e, moving: !!p.moveTarget, dir: p.dir });
  }
  assert.ok(releases.length >= 2);
  assert.ok(releases.some((r) => r.moving));
  assert.ok(m.hp < hp);
  assert.ok(Math.max(...positions) > 1);
  assert.ok(w.snapshot(p.id).player.trackingRemaining > 0);
});
test("tracking shots stop outside range and on explicit cancellation, travel, expiry and a missed mark", () => {
  for (const mode of ["cancel", "travel", "expiry", "range"]) {
    const { w, p, m } = fixture();
    w.releaseSkill(p, 2, m);
    const hp = m.hp;
    w.act(p.id, { type: "move", x: 1, y: 0 });
    if (mode === "cancel") w.act(p.id, { type: "cancelCombat" });
    if (mode === "travel") w.travel(p, "village", true);
    if (mode === "expiry") w.time = 10;
    if (mode === "range") m.x += 100;
    advance(w, 0.8);
    assert.equal(m.hp, hp, mode);
    if (mode !== "range") assert.equal(p.trackingTarget, null);
  }
  const { w, p, m } = fixture();
  w.rng = () => 0.99999;
  w.releaseSkill(p, 2, m);
  assert.equal(p.trackingTarget, null);
  assert.equal(m.markedOwner, undefined);
});
test("fullscreen uses the real element API and exits cleanly; unsupported mode does not silently succeed", async () => {
  const doc = { fullscreenEnabled: true, fullscreenElement: null },
    element = {
      requestFullscreen: async () => {
        doc.fullscreenElement = element;
      },
    };
  doc.exitFullscreen = async () => {
    doc.fullscreenElement = null;
  };
  assert.ok(fullscreenSupported(doc, element));
  assert.equal(await setFullscreen(true, element, doc), true);
  assert.equal(await setFullscreen(false, element, doc), false);
  await assert.rejects(setFullscreen(true, {}, doc));
});
test("adding character status preserves old custom bindings, including an existing V pickup binding", () => {
  const { character, ...old } = DEFAULT_BINDINGS;
  const restored = restoreBindings({ ...old, pickup: "KeyV", skill0: "KeyZ" });
  assert.equal(restored.pickup, "KeyV");
  assert.equal(restored.skill0, "KeyZ");
  assert.notEqual(restored.character, "KeyV");
  assert.equal(
    new Set(Object.values(restored)).size,
    Object.keys(restored).length,
  );
});
test("every skill and hit animation has authored per-row frame counts, fixed pivots and isolated registered frames", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  assert.equal(art.skillEffects.warden.rowFrames[2], 11);
  assert.deepEqual(art.skillEffects.ranger.rowFrames, [12, 11, 12, 11, 11]);
  for (const a of [...Object.values(art.skillEffects), art.attackImpacts]) {
    const { width, height, pixels } = rgbaPixels(
      await readFile("site/assets/" + a.file + ".png"),
    );
    assert.equal(a.fxReviewVersion, 1);
    assert.equal(a.registration.length, a.rows);
    for (const row of a.registration) {
      assert.equal(row.frames.length, a.rowFrames[row.row]);
      assert.deepEqual(row.pivot, row.ground ? [64, 120] : [64, 64]);
      for (let f = 0; f < row.frames.length; f++) {
        let mass = 0;
        for (let y = 0; y < 128; y++)
          for (let x = 0; x < 128; x++) {
            const alpha =
              pixels[((row.row * 128 + y) * width + f * 128 + x) * 4 + 3];
            assert.ok(alpha === 0 || alpha === 255);
            if (x < 4 || y < 4 || x >= 124 || y >= 124) assert.equal(alpha, 0);
            mass += alpha > 0 ? 1 : 0;
          }
        assert.ok(
          mass > 0 || f >= row.frames.length - 2,
          a.file + ":" + row.row + ":" + f + " missing actual authored frame",
        );
      }
    }
  }
});
test("four diagonal walk rows are replaced in both the runtime body and standalone atlas with registered opaque palms", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8")),
    plan = JSON.parse(await readFile("art/diagonal-walk-v25.json", "utf8"));
  assert.equal(plan.status, "complete");
  for (const job of plan.sources) {
    assert.equal(job.registration.length, 32);
    const b = art.appearance.bases[job.id],
      body = rgbaPixels(await readFile("site/assets/" + b.file + ".png")),
      walk = rgbaPixels(
        await readFile("site/assets/locomotion/" + job.id + "-walk.png"),
      );
    for (const r of job.registration) {
      const [dx, dy] = r.hand;
      assert.ok(
        body.pixels[
          ((r.row * 96 + dy) * body.width + (r.frame + 16) * 96 + dx) * 4 + 3
        ],
      );
      for (let y = 0; y < 96; y++)
        assert.deepEqual(
          body.pixels.subarray(
            ((r.row * 96 + y) * body.width + (r.frame + 16) * 96) * 4,
            ((r.row * 96 + y) * body.width + (r.frame + 17) * 96) * 4,
          ),
          walk.pixels.subarray(
            ((r.row * 96 + y) * walk.width + r.frame * 96) * 4,
            ((r.row * 96 + y) * walk.width + (r.frame + 1) * 96) * 4,
          ),
        );
    }
  }
});
