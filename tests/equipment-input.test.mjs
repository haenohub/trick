import { test } from "node:test";
import assert from "node:assert/strict";
import { PickupHold } from "../site/pickup-hold.js";
import { PICKUP_DURATION } from "../site/balance.js";
import {
  equippedAppearance,
  orderedEquipmentLayers,
  equipmentSignature,
  starterEquipment,
} from "../site/equipment-appearance.js";
import { World, createPlayer } from "../site/core.js";
test("held pickup fires once per flight, does not burst after a pause, and releases by the actual bound key", () => {
  const h = new PickupHold();
  assert.equal(h.take(0), false);
  assert.ok(h.press("Space", 0));
  assert.ok(h.take(0));
  assert.equal(h.take(PICKUP_DURATION * 1000 - 1), false);
  assert.equal(h.press("Space", 100), false);
  assert.equal(h.take(900, true), false);
  assert.ok(h.take(950));
  assert.equal(h.take(950), false);
  h.release("KeyA");
  assert.equal(h.code, "Space");
  h.release("Space");
  assert.equal(h.take(99999), false);
  assert.ok(h.press("KeyV", 1200));
  assert.ok(h.take(1200));
  assert.ok(h.take(99999));
  assert.equal(h.take(99999), false);
  h.cancel();
  assert.equal(h.take(100000), false);
});
test("equipped items replicate to peers immediately and snapshots cannot mutate another player equipment", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer("warden"), "one"),
    other = w.addPlayer(createPlayer("mage"), "two");
  p.level = 30;
  p.inventory.spear2 = 1;
  const before = equipmentSignature(
    p.classId,
    w.snapshot(other.id).peers[0].equipment,
  );
  assert.ok(w.act(p.id, { type: "equip", item: "spear2" }));
  const remote = w.snapshot(other.id).peers[0];
  assert.equal(remote.equipment.weapon, "spear2");
  assert.notEqual(equipmentSignature(p.classId, remote.equipment), before);
  remote.equipment.weapon = "staff2";
  assert.equal(p.equipment.weapon, "spear2");
});
test("missing weapon artwork falls back rather than showing an incorrect weapon", () => {
  const gear = starterEquipment("warden");
  assert.equal(equippedAppearance({ files: [] }, "warden", gear), null);
});
