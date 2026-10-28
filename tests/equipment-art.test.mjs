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
test("non-weapon equipment leaves the original class costume unchanged while weapons change independently", async () => {
  const art = await json("site/assets/manifest.json");
  for (const cls of CLASSES) {
    const starter = starterEquipment(cls.id),
      initial = equippedAppearance(art, cls.id, starter);
    assert.equal(initial.layers.length, 3);
    assert.ok(initial.layout.clothedBody);
    assert.ok(!initial.layers.some((l) => l.fixedCostume));
    for (const item of Object.values(ITEMS).filter(
      (i) => i.type === "equipment" && (!i.classId || i.classId === cls.id),
    )) {
      const a = equippedAppearance(art, cls.id, {
        ...starter,
        [item.slot]: item.id,
      });
      if (item.slot === "weapon") {
        assert.equal(a.layers.find((l) => l.held).item, item.id);
        assert.deepEqual(
          a.layers.filter((l) => !l.held),
          initial.layers.filter((l) => !l.held),
        );
      } else assert.deepEqual(a, initial);
    }
  }
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
