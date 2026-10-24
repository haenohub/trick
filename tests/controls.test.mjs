import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BINDINGS,
  CONTROL_ACTIONS,
  restoreBindings,
  rebind,
  actionForEvent,
} from "../site/controls.js";
import { World, createPlayer } from "../site/core.js";
import { NEARBY_PICKUP_RANGE } from "../site/balance.js";
test("default physical QWER skills have unique bindings with separate pickup, potion and interaction keys", () => {
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => DEFAULT_BINDINGS["skill" + i]),
    ["KeyQ", "KeyW", "KeyE", "KeyR"],
  );
  assert.equal(DEFAULT_BINDINGS.pickup, "KeyA");
  assert.equal(DEFAULT_BINDINGS.interact, "KeyF");
  assert.equal(DEFAULT_BINDINGS.potion, "KeyT");
  assert.equal(
    new Set(Object.values(DEFAULT_BINDINGS)).size,
    CONTROL_ACTIONS.length,
  );
  assert.equal(
    actionForEvent({ code: "KeyQ", key: "ㅂ" }, DEFAULT_BINDINGS),
    "skill0",
  );
  assert.equal(actionForEvent({ code: "KeyP" }, DEFAULT_BINDINGS), "bindings");
  assert.equal(
    actionForEvent({ code: "KeyP", ctrlKey: true }, DEFAULT_BINDINGS),
    null,
  );
});
test("key changes reject conflicts and reserved keys, restore valid saves and recover from corrupt settings", () => {
  assert.equal(rebind(DEFAULT_BINDINGS, "skill0", "KeyW").ok, false);
  for (const key of ["Escape", "KeyP", "F5", "ShiftLeft"])
    assert.equal(rebind(DEFAULT_BINDINGS, "skill0", key).ok, false);
  const result = rebind(DEFAULT_BINDINGS, "skill0", "KeyZ");
  assert.ok(result.ok);
  assert.equal(actionForEvent({ code: "KeyZ" }, result.bindings), "skill0");
  assert.equal(actionForEvent({ code: "KeyQ" }, result.bindings), null);
  assert.deepEqual(
    restoreBindings(JSON.parse(JSON.stringify(result.bindings))),
    result.bindings,
  );
  assert.deepEqual(
    restoreBindings({ ...result.bindings, attack: "KeyZ" }),
    DEFAULT_BINDINGS,
  );
  assert.deepEqual(restoreBindings({}), DEFAULT_BINDINGS);
});
test("one nearby pickup reserves only the closest available owned drop and awards it after the flight", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer()),
    map = w.map(p.map),
    base = p.gold;
  const item = (id, x, extra = {}) => ({
    id,
    owner: p.id,
    x: p.x + x,
    y: p.y,
    until: 100,
    kind: "item",
    item: "fiber",
    count: 1,
    pickupEnds: 0,
    ...extra,
  });
  map.drops = [
    item(80, 0.3, { owner: "other" }),
    item(81, 0.7, { pickupEnds: 10 }),
    item(82, 0.8, { until: 0 }),
    item(83, 1.2, { kind: "currency", count: 13 }),
    item(84, 2),
    item(85, NEARBY_PICKUP_RANGE + 2),
  ];
  assert.ok(w.act(p.id, { type: "pickupNearest", drop: 85, count: 999999 }));
  assert.ok(map.drops.find((d) => d.id === 83).pickupEnds > 0);
  assert.equal(map.drops.find((d) => d.id === 84).pickupEnds, 0);
  assert.equal(p.gold, base);
  for (let i = 0; i < 8; i++) w.step(0.1);
  assert.equal(p.gold, base + 13);
  assert.equal(p.lootNotices.at(-1).kind, "currency");
  assert.ok(w.act(p.id, { type: "pickupNearest" }));
  for (let i = 0; i < 8; i++) w.step(0.1);
  assert.equal(p.inventory.fiber, 6);
  assert.equal(w.act(p.id, { type: "pickupNearest" }), false);
});
