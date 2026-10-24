import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rgbaPixels } from "./png.mjs";
test("all assets originate from generated artwork with clean transparent native sprite margins", async () => {
  const repaint = JSON.parse(
    await readFile("art/refinement-sources.json", "utf8"),
  );
  const records = JSON.parse(
    await readFile("art/generated-assets.json", "utf8"),
  );
  assert.equal(repaint.sources.length, 67);
  const world = JSON.parse(await readFile("art/world-sources.json", "utf8"));
  const crisp = JSON.parse(await readFile("art/crisp-sources.json", "utf8"));
  const sources = new Set(
    [...repaint.sources, ...world.sources, ...crisp.sources].map(
      (s) => s.source,
    ),
  );
  for (const a of records.assets)
    assert.ok(sources.has(a.source), a.id + " was not repainted");
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  const layouts = [
    ...Object.values(art.monsters),
    ...Object.values(art.characterLayouts),
    ...Object.values(art.npcLayouts),
  ];
  for (const l of layouts) {
    const { width, height, pixels } = rgbaPixels(
      await readFile("site/assets/" + l.views.S + ".png"),
    );
    // A dark-edge percentage measured color, not stroke width. The requested
    // crisper contours may use darker local colors; guard against atlas bleed
    // and resampling fringe with actual transparent native margins instead.
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const alpha = pixels[(y * width + x) * 4 + 3];
        assert.ok(
          alpha === 0 || alpha === 255,
          l.file + " has an antialiased fringe",
        );
        if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2)
          assert.equal(alpha, 0, l.file + " bleeds outside its native frame");
      }
  }
});
