import { test } from "node:test";
import assert from "node:assert/strict";
import {
  World,
  createPlayer,
  hydrateSave,
  serialize,
  grantXp,
} from "../site/core.js";
import {
  attributes,
  unspentPoints,
  legacyAttributes,
  GROWTH,
} from "../site/progression.js";
test("manual allocations accept single and bulk amounts, reject invalid requests and survive save hydration", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer("mage"));
  grantXp(p, 600);
  const before = attributes(p),
    points = unspentPoints(p);
  assert.ok(points >= 12);
  for (const amount of [-1, 0, 1.5, "2", NaN, Infinity, points + 1])
    assert.equal(
      w.act(p.id, { type: "allocateStat", attribute: "intelligence", amount }),
      false,
    );
  assert.equal(
    w.act(p.id, { type: "allocateStat", attribute: "__proto__", amount: 1 }),
    false,
  );
  assert.ok(
    w.act(p.id, { type: "allocateStat", attribute: "intelligence", amount: 1 }),
  );
  assert.ok(
    w.act(p.id, { type: "allocateStat", attribute: "intelligence", amount: 7 }),
  );
  assert.equal(attributes(p).intelligence, before.intelligence + 8);
  assert.equal(unspentPoints(p), points - 8);
  const saved = hydrateSave(serialize(p));
  assert.deepEqual(attributes(saved), attributes(p));
  assert.equal(unspentPoints(saved), points - 8);
  const forged = hydrateSave({
    ...serialize(p),
    allocated: { intelligence: 9999999 },
  });
  assert.equal(attributes(forged).intelligence, GROWTH.mage.base[2]);
});
test("legacy automatic growth migrates without weakening existing builds; new levels leave points unspent", () => {
  for (const classId of Object.keys(GROWTH)) {
    const raw = { ...createPlayer(classId), level: 30 };
    delete raw.allocationVersion;
    delete raw.allocated;
    const old = legacyAttributes(raw),
      p = hydrateSave(raw);
    assert.deepEqual(attributes(p), old);
    const available = unspentPoints(p);
    p.level++;
    assert.deepEqual(attributes(p), old);
    assert.equal(unspentPoints(p), available + 12);
  }
});
