import { test } from "node:test";
import assert from "node:assert/strict";
import { direction, facesTarget, SOUTH } from "../site/directions.js";
import { NAVIGATION } from "../site/world-layout.js";
import { World, createPlayer } from "../site/core.js";

const headings = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
].map(([x, y]) => {
  const length = Math.hypot(x, y);
  return [x / length, y / length];
});

test("eight world routes face their actual compass direction on the isometric screen", () => {
  headings.forEach(([dx, dy], row) => {
    assert.equal(direction(dx, dy), row);
    assert.equal(direction(dx * 0.001, dy * 0.001), row);
    assert.equal(direction(-dx, -dy), (row + 4) % 8);
  });
  assert.equal(direction(0, 0), SOUTH);
  assert.equal(direction(0, 0, 7), 7);
});
test("armor protects the front in every heading and leaves the opposite side exposed", () => {
  headings.forEach(([dx, dy], dir) => {
    const actor = { x: 10, y: 10, dir };
    assert.ok(facesTarget(actor, { x: 10 + dx, y: 10 + dy }));
    assert.ok(!facesTarget(actor, { x: 10 - dx, y: 10 - dy }));
    assert.ok(!facesTarget(actor, actor));
  });
});
test("authoritative movement and attacks publish eight directions to clients", () => {
  const w = new World({ seed: 42 }),
    p = w.addPlayer(createPlayer());
  assert.equal(p.dir, SOUTH);
  headings.forEach(([dx, dy], row) => {
    const { x, y } = NAVIGATION.village.worldAt(10, 10);
    Object.assign(p, { x, y });
    w.moveEntity(p, p.map, dx, dy, 0.05, 1);
    assert.ok(Math.hypot(p.x - x, p.y - y) > 0);
    assert.equal(p.dir, row);
    assert.equal(w.snapshot(p.id).player.dir, row);
  });
  p.map = "sprout";
  const target = w.map(p.map).mobs[0];
  for (const [row, [dx, dy]] of headings.entries()) {
    Object.assign(p, { ...NAVIGATION.sprout.spawn, attackReady: 0 });
    Object.assign(target, { x: p.x + dx * 0.5, y: p.y + dy * 0.5, hp: 10000 });
    w.cancelAction(p);
    assert.ok(w.attack(p, target.uid));
    assert.equal(p.dir, row);
    assert.equal(w.snapshot(p.id).player.dir, row);
  }
});
