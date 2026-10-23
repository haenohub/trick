import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { rgbaPixels } from "./png.mjs";
import { MONSTERS, CLASSES, NPCS } from "../site/data.js";
import { DIRECTIONS, SOUTH } from "../site/directions.js";
const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");
function cell(image, size, col, row) {
  return Buffer.concat(
    Array.from({ length: size }, (_, y) =>
      image.pixels.subarray(
        ((row * size + y) * image.width + col * size) * 4,
        ((row * size + y) * image.width + (col + 1) * size) * 4,
      ),
    ),
  );
}
test("all 52 actors have eight distinct native views matching their animated atlas rows", async () => {
  const art = JSON.parse(await readFile("dist/assets/manifest.json", "utf8"));
  assert.deepEqual(
    art.directionOrder,
    DIRECTIONS.map((d) => d.id),
  );
  assert.equal(art.defaultDirection, SOUTH);
  const groups = [
    [MONSTERS, art.monsters],
    [CLASSES, art.characterLayouts],
    [NPCS, art.npcLayouts],
  ];
  let count = 0;
  for (const [actors, layouts] of groups)
    for (const actor of actors) {
      count++;
      const l = layouts[actor.id],
        size = l.size;
      assert.equal(l.cols, 8, actor.id);
      assert.equal(l.rows, 8, actor.id);
      assert.equal(Object.keys(l.views).length, 8, actor.id);
      const atlas = rgbaPixels(
        await readFile("dist/assets/" + l.file + ".png"),
      );
      assert.equal(atlas.width, size * 8);
      assert.equal(atlas.height, size * 8);
      const hashes = [];
      for (const [row, d] of DIRECTIONS.entries()) {
        const view = rgbaPixels(
          await readFile("dist/assets/" + l.views[d.id] + ".png"),
        );
        assert.equal(view.width, size);
        assert.equal(view.height, size);
        assert.deepEqual(
          view.pixels,
          cell(atlas, size, 0, row),
          actor.id + " " + d.id + " wrong atlas row",
        );
        assert.ok(
          view.pixels.some((v, i) => i % 4 === 3 && v === 255),
          actor.id + " empty view",
        );
        hashes.push(sha(view.pixels));
        const walk = l.animations.walk.map((frame) =>
          sha(cell(atlas, size, frame, row)),
        );
        assert.ok(
          new Set(walk).size > 1,
          actor.id + " " + d.id + " needs actual walking poses",
        );
      }
      assert.equal(new Set(hashes).size, 8, actor.id + " repeats a direction");
      if (l.portrait) {
        const portrait = rgbaPixels(
          await readFile("dist/assets/" + l.portrait + ".png"),
        );
        assert.deepEqual(
          portrait.pixels,
          cell(atlas, size, 0, SOUTH),
          actor.id + " must show the front in the bestiary",
        );
      }
    }
  assert.equal(count, 52);
});
test("direction atelier includes all actors and downloadable PNGs without needing a game session", async () => {
  const html = await readFile("dist/directions.html", "utf8");
  const data = JSON.parse(
    html.match(
      /<script id="direction-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1],
  );
  assert.equal(data.actors.length, 52);
  for (const a of data.actors)
    assert.equal(Object.keys(a.layout.views).length, 8, a.id);
  assert.equal(data.actors.filter((a) => a.kind === "character").length, 4);
  assert.equal(data.actors.filter((a) => a.kind === "npc").length, 8);
  assert.equal(data.actors.filter((a) => a.kind === "monster").length, 40);
});
