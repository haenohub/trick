import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rgbaPixels } from "./png.mjs";
test("all assets originate from the video-reference repaint, with selective colored contours", async () => {
  const repaint = JSON.parse(
    await readFile("art/refinement-sources.json", "utf8"),
  );
  const records = JSON.parse(
    await readFile("art/generated-assets.json", "utf8"),
  );
  assert.equal(repaint.sources.length, 67);
  const sources = new Set(repaint.sources.map((s) => s.source));
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
    let edge = 0,
      dark = 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const at = (y * width + x) * 4;
        if (!pixels[at + 3]) continue;
        if (
          [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ].some(
            ([dx, dy]) =>
              x + dx < 0 ||
              y + dy < 0 ||
              x + dx >= width ||
              y + dy >= height ||
              !pixels[((y + dy) * width + x + dx) * 4 + 3],
          )
        ) {
          edge++;
          if (Math.max(...pixels.subarray(at, at + 3)) < 80) dark++;
        }
      }
    assert.ok(dark / edge < 0.25, l.file + " has a heavy near-black contour");
  }
});
