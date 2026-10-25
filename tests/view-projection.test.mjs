import { test } from "node:test";
import assert from "node:assert/strict";
import {
  project,
  unproject,
  viewAnchor,
  fitProjected,
} from "../site/view-projection.js";
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

test("quarter-view minimaps preserve the same directions as the game for all ten regions", () => {
  for (const id of Object.keys(NAVIGATION)) {
    const corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].map(([u, v]) => imageToWorld(u, v, id));
    const f = fitProjected(corners, 174, 116),
      p = imageToWorld(0.4, 0.4, id),
      q = imageToWorld(0.7, 0.5, id);
    const a = f.point(p.x, p.y),
      b = f.point(q.x, q.y),
      s = project(p.x, p.y),
      t = project(q.x, q.y);
    assert.ok(Math.abs((b.x - a.x) / f.scale - (t.x - s.x)) < 1e-8);
    assert.ok(Math.abs((b.y - a.y) / f.scale - (t.y - s.y)) < 1e-8);
    for (const c of f.corners)
      assert.ok(c.x >= 3.99 && c.x <= 170.01 && c.y >= 3.99 && c.y <= 112.01);
    const width =
      Math.max(...f.corners.map((c) => c.x)) -
      Math.min(...f.corners.map((c) => c.x));
    const height =
      Math.max(...f.corners.map((c) => c.y)) -
      Math.min(...f.corners.map((c) => c.y));
    assert.ok(Math.abs(width / height - 2) < 1e-9);
  }
});
