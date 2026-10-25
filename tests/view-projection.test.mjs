import { test } from "node:test";
import assert from "node:assert/strict";
import { project, unproject, viewAnchor } from "../site/view-projection.js";
import { imageToWorld, NAVIGATION } from "../site/world-layout.js";
import { direction, facingVector } from "../site/directions.js";
test("quarter-view floor cells are 2:1 diamonds and mouse picking inverts the exact projection", () => {
  for (const id of Object.keys(NAVIGATION)) {
    const nav = NAVIGATION[id],
      x = 0.4,
      y = 0.4;
    const corners = [
      [x, y],
      [x + 112 / nav.width, y],
      [x + 112 / nav.width, y + 112 / nav.height],
      [x, y + 112 / nav.height],
    ]
      .map(([u, v]) => imageToWorld(u, v, id))
      .map((p) => project(p.x, p.y));
    const w =
      Math.max(...corners.map((p) => p.x)) -
      Math.min(...corners.map((p) => p.x));
    const h =
      Math.max(...corners.map((p) => p.y)) -
      Math.min(...corners.map((p) => p.y));
    assert.ok(Math.abs(w / h - 2) < 1e-10, id + " floor is not quarter-view");
    for (const point of corners) {
      const world = unproject(point.x, point.y),
        back = project(world.x, world.y);
      assert.ok(Math.hypot(back.x - point.x, back.y - point.y) < 1e-9);
    }
  }
  for (let i = -100; i <= 100; i++) {
    const p = project(i / 3, i * 0.73),
      q = unproject(p.x, p.y);
    assert.ok(Math.hypot(q.x - i / 3, q.y - i * 0.73) < 1e-10);
  }
});
test("every screen direction and facing vector agree with the new quarter-view camera", () => {
  for (let row = 0; row < 8; row++) {
    const angle = (row * Math.PI) / 4,
      world = unproject(Math.sin(angle), -Math.cos(angle));
    assert.equal(direction(world.x, world.y), row);
    const facing = facingVector(row),
      screen = project(facing.x, facing.y),
      length = Math.hypot(screen.x, screen.y);
    assert.ok(Math.abs(screen.x / length - Math.sin(angle)) < 1e-10);
    assert.ok(Math.abs(screen.y / length + Math.cos(angle)) < 1e-10);
  }
  const anchor = viewAnchor(1440, 900, 1 / 1.2);
  assert.equal(anchor.x, 720);
  assert.equal(anchor.y, 470);
});
