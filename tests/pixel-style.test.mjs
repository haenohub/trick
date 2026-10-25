import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { rgbaPixels } from "./png.mjs";
test("all assets originate from generated artwork with clean transparent native sprite margins", async () => {
  const repaint = JSON.parse(await readFile("art/hd-sources.json", "utf8"));
  const records = JSON.parse(
    await readFile("art/generated-assets.json", "utf8"),
  );
  assert.equal(repaint.sources.length, 90);
  assert.equal(repaint.pending.length, 0);
  assert.equal(repaint.resolutionScale, 2);
  const previous = (
    await Promise.all(
      ["refinement", "world", "crisp"].map(async (name) =>
        JSON.parse(await readFile("art/" + name + "-sources.json", "utf8")),
      ),
    )
  ).flatMap((r) => r.sources);
  const motion = JSON.parse(await readFile("art/motion-sources.json", "utf8"));
  const sources = new Set(
    [...previous, ...repaint.sources, ...motion.sources].flatMap((s) => [
      s.source,
      ...(s.deathSource ? [s.deathSource] : []),
    ]),
  );
  for (const actor of repaint.sources.filter((a) =>
    ["monster", "character", "npc"].includes(a.kind),
  )) {
    const atlas = records.assets.find(
      (a) =>
        a.id ===
        (actor.kind === "character"
          ? "characters/"
          : actor.kind === "npc"
            ? "npcs/"
            : "creatures/") +
          actor.id,
    );
    assert.equal(
      atlas.source,
      actor.source,
      actor.id + " new artwork was not applied",
    );
  }
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
