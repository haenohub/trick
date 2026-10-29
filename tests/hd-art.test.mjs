import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rgbaPixels } from "./png.mjs";
test("the entire authored asset set has twice the native density without changing world footprints", async () => {
  const json = async (file) => JSON.parse(await readFile(file, "utf8"));
  const before = await json("art/hd-baseline.json");
  const after = await json("art/generated-assets.json");
  const plan = await json("art/hd-sources.json");
  const art = await json("site/assets/manifest.json");
  assert.equal(plan.sources.length, 90);
  assert.equal(plan.pending.length, 0);
  assert.equal(new Set(plan.sources.map((a) => a.id)).size, 90);
  const motion = await json("art/motion-sources.json");
  const locomotion = await json("art/locomotion-sources.json");
  const sources = new Set(
    [
      ...plan.sources,
      ...motion.sources,
      ...locomotion.sources,
      ...(await json("art/isometric-map-plan.json")).sources,
    ].map((a) => a.source),
  );
  assert.equal(
    after.assets.length,
    before.assets.length +
      art.locomotion.actors * 2 +
      art.files.filter((f) => f.startsWith("appearance/")).length +
      (art.combat?.actors || 0) +
      (art.ambient ? 1 : 0) +
      (art.targetCombat ? 1 : 0) +
      (art.world.isometric?.files?.length || 0) +
      (art.expansionArt?.length || 0),
  );
  for (const previous of before.assets) {
    const current = after.assets.find((a) => a.id === previous.id);
    assert.ok(current, previous.id + " missing");
    assert.ok(
      sources.has(current.source),
      previous.id + " not using replacement originals",
    );
    assert.notEqual(
      current.sha256,
      previous.sha256,
      previous.id + " retained old packed artwork",
    );
    // Currency gained four authored rotation views in place of one static coin.
    assert.equal(
      current.width,
      previous.width *
        (previous.id === "currency-leaf"
          ? 8
          : current.motionVersion === 2
            ? 4
            : 2),
      previous.id + " width",
    );
    assert.equal(
      current.height,
      previous.height * 2 * (previous.id.startsWith("effects") ? 9 / 8 : 1),
      previous.id + " height",
    );
  }
  assert.equal(art.pixelScale, 1);
  assert.equal(art.iconLayout.size, 32);
  assert.equal(art.world.nativeTileSize, art.world.tileSize * 2);
  for (const layout of [
    ...Object.values(art.monsters),
    ...Object.values(art.characterLayouts),
    ...Object.values(art.npcLayouts),
  ]) {
    assert.equal(layout.size, layout.baseSize * 2);
    assert.equal(
      layout.size * art.pixelScale,
      layout.baseSize * 2,
      "world footprint changed",
    );
    const { width, height, pixels } = rgbaPixels(
      await readFile("site/assets/" + layout.views.SW + ".png"),
    );
    let detail = 0;
    for (let y = 0; y < height; y += 2)
      for (let x = 0; x < width; x += 2) {
        const offsets = [
          (y * width + x) * 4,
          (y * width + x + 1) * 4,
          ((y + 1) * width + x) * 4,
          ((y + 1) * width + x + 1) * 4,
        ];
        const values = offsets.map((at) =>
          pixels.subarray(at, at + 4).toString("hex"),
        );
        if (new Set(values).size > 1) detail++;
      }
    assert.ok(
      detail > 32,
      layout.file +
        " only duplicated 2x2 pixels instead of retaining authored detail",
    );
  }
});
