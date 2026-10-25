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
  assert.equal(h.take(PICKUP_DURATION * 1000), false);
  assert.equal(h.press("Space", 100), false);
  assert.equal(h.take(900, true), false);
  assert.ok(h.take(950));
  assert.equal(h.take(950), false);
  h.release("KeyA");
  assert.equal(h.code, "Space");
  h.release("Space");
  assert.equal(h.take(99999), false);
  assert.ok(h.press("KeyV", 1000));
  assert.ok(h.take(1000));
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
test("paper-doll layers activate only when a neutral body and every real equipped piece are available", () => {
  const gear = starterEquipment("warden");
  assert.equal(equippedAppearance({ files: [] }, "warden", gear), null);
  const base = {
    file: "body",
    cols: 32,
    rows: 8,
    size: 96,
    animations: {
      idle: [24, 25, 26, 27, 28, 29, 30, 31],
      walk: [16, 17, 18, 19, 20, 21, 22, 23],
    },
  };
  const art = {
    files: ["body"],
    appearance: { bases: { warden: base }, items: {} },
  };
  for (const [slot, id] of Object.entries(gear)) {
    const file = "layer-" + id;
    art.files.push(file);
    art.appearance.items[id] = {
      warden: {
        layers: [
          {
            file,
            order: 10,
            orderByDirection:
              slot === "weapon"
                ? [-10, -10, 20, 20, 20, 20, -10, -10]
                : undefined,
          },
        ],
      },
    };
  }
  const a = equippedAppearance(art, "warden", gear);
  assert.equal(a.layers.length, 6);
  assert.equal(orderedEquipmentLayers(a, 0)[0].item, "spear1");
  assert.equal(orderedEquipmentLayers(a, 4)[0].file, "body");
  assert.equal(
    equippedAppearance(art, "warden", { ...gear, weapon: "spear2" }),
    null,
    "never show baked starter gear over a different equipped weapon",
  );
  art.files = art.files.filter((f) => f !== "layer-hood1");
  assert.equal(
    equippedAppearance(art, "warden", gear),
    null,
    "never expose an incomplete naked body",
  );
});
