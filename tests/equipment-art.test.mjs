import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CLASSES, ITEMS } from "../site/data.js";
import {
  starterEquipment,
  equippedAppearance,
} from "../site/equipment-appearance.js";
import { rgbaPixels } from "./png.mjs";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
test("all thirty equipment items have real fitted layers for every eligible class and every slot can change independently", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/equipment-appearance-plan.json"),
    receipts = await json("art/equipment-generation-receipts.json"),
    records = await json("art/generated-assets.json");
  assert.equal(plan.status, "complete");
  assert.equal(plan.pending.length, 0);
  assert.equal(plan.sources.length, 52);
  assert.equal(Object.keys(art.appearance.bases).length, 4);
  assert.equal(Object.keys(art.appearance.items).length, 30);
  const allFiles = new Set(),
    gearSources = new Set();
  for (const cls of CLASSES) {
    const starter = starterEquipment(cls.id),
      initial = equippedAppearance(art, cls.id, starter);
    assert.ok(initial, cls.id + " starter appearance");
    for (const item of Object.values(ITEMS).filter(
      (i) => i.type === "equipment" && (!i.classId || i.classId === cls.id),
    )) {
      const equipped = { ...starter, [item.slot]: item.id },
        a = equippedAppearance(art, cls.id, equipped);
      assert.ok(a, cls.id + " " + item.id + " must not fall back");
      assert.equal(a.layers.length, 7);
      const layer = a.layers.find((l) => l.item === item.id);
      assert.ok(layer.file.startsWith("appearance/gear/") || layer.held);
      allFiles.add(layer.file + (layer.held ? ":" + layer.index : ""));
      const record = records.assets.find((r) => r.id === layer.file),
        receipt = receipts.sources.find((s) => s.id === cls.id + "-" + item.id);
      assert.equal(record.tool, "image_gen");
      if (layer.held) {
        assert.equal(layer.index, art.appearance.weapons[item.id].index);
        const plan = await json("art/held-weapons.json");
        assert.equal(plan.sources.length, 8);
        for (const direction of plan.sources)
          assert.ok(
            direction.weapons.some(
              (w) => w.id === item.id && w.index === layer.index,
            ),
          );
      } else {
        assert.equal(record.source, receipt.path);
        assert.equal(record.item, item.id);
        assert.equal(record.classId, cls.id);
      }
      gearSources.add(receipt.path);
      for (const other of a.layers.filter(
        (l) => l.slot && l.slot !== item.slot,
      ))
        assert.equal(
          other.file,
          initial.layers.find((l) => l.slot === other.slot).file,
          "unrelated worn gear changed",
        );
    }
  }
  assert.equal(allFiles.size, 48);
  assert.equal(
    gearSources.size,
    48,
    "each fitted item needs its own authored artwork",
  );
});
test("paper-doll sheets keep all 256 poses on native 96px cells with clean four-pixel margins", async () => {
  const art = await json("site/assets/manifest.json");
  for (const file of art.files.filter(
    (f) => f.startsWith("appearance/") && f !== "appearance/held-weapons",
  )) {
    const { width, height, pixels } = rgbaPixels(
      await readFile("site/assets/" + file + ".png"),
    );
    assert.equal(width, 3072, file);
    assert.equal(height, 768, file);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 32; col++) {
        let ink = 0;
        for (let y = 0; y < 96; y++)
          for (let x = 0; x < 96; x++) {
            const alpha =
              pixels[((row * 96 + y) * width + col * 96 + x) * 4 + 3];
            if (x < 4 || y < 4 || x >= 92 || y >= 92)
              assert.equal(alpha, 0, file + " frame bleed " + row + ":" + col);
            if (alpha) ink++;
          }
        if (!file.startsWith("appearance/hands/"))
          assert.ok(ink > 0, file + " empty pose " + row + ":" + col);
      }
    if (file.startsWith("appearance/base/"))
      for (let row = 0; row < 8; row++)
        for (const start of [16, 24]) {
          const poses = new Set();
          for (let col = start; col < start + 8; col++) {
            const frame = Buffer.concat(
              Array.from({ length: 96 }, (_, y) =>
                pixels.subarray(
                  ((row * 96 + y) * width + col * 96) * 4,
                  ((row * 96 + y) * width + (col + 1) * 96) * 4,
                ),
              ),
            );
            poses.add(createHash("sha256").update(frame).digest("hex"));
          }
          assert.ok(
            poses.size >= (start === 16 ? 6 : 4),
            file + " substituted motion poses",
          );
        }
  }
});
