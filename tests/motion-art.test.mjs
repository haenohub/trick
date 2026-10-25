import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { rgbaPixels } from "./png.mjs";
const hash = (p) => createHash("sha256").update(p).digest("hex");
function frame(a, size, col, row) {
  return Buffer.concat(
    Array.from({ length: size }, (_, y) =>
      a.pixels.subarray(
        ((row * size + y) * a.width + col * size) * 4,
        ((row * size + y) * a.width + (col + 1) * size) * 4,
      ),
    ),
  );
}
test("approved appearances stay intact while generated in-betweens and contained sixteen-frame effects are added", async () => {
  const json = async (p) => JSON.parse(await readFile(p, "utf8"));
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/motion-sources.json"),
    baseline = await json("art/motion-baseline.json");
  assert.equal(plan.pending.length, 0);
  assert.equal(plan.sources.length, 73);
  for (const old of baseline.assets.filter(
    (a) => a.id.startsWith("directions/") || a.id.startsWith("portraits/"),
  ))
    assert.equal(
      hash(await readFile(old.target)),
      old.sha256,
      old.id + " approved appearance changed",
    );
  const actors = [
    ...Object.values(art.monsters),
    ...Object.values(art.characterLayouts),
  ];
  assert.equal(actors.length, 64);
  for (const l of actors) {
    assert.equal(l.cols, 16);
    assert.equal(l.animations.walk.length, 8);
    assert.deepEqual(l.animations.windup, [8, 9, 10]);
    assert.deepEqual(l.animations.attack, [11, 12]);
    const a = rgbaPixels(await readFile("site/assets/" + l.file + ".png"));
    for (let dir = 0; dir < 8; dir++) {
      const poses = l.animations.walk.map((i) =>
        hash(frame(a, l.size, i, dir)),
      );
      assert.ok(
        new Set(poses).size >= 6,
        l.file + " " + dir + " lacks distinct intermediate strides",
      );
    }
  }
  assert.equal(art.effects.cols, 16);
  assert.equal(art.effects.rows, 9);
  for (const [logical, file] of Object.entries(art.effects.variants)) {
    const size = Number(logical) * 2,
      a = rgbaPixels(await readFile("site/assets/" + file + ".png"));
    for (let row = 0; row < 9; row++) {
      const unique = new Set();
      for (let col = 0; col < 16; col++) {
        const f = frame(a, size, col, row);
        unique.add(hash(f));
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++)
            if (x < 4 || y < 4 || x >= size - 4 || y >= size - 4)
              assert.equal(
                f[(y * size + x) * 4 + 3],
                0,
                file + " frame gutter bleeds into its neighbor",
              );
      }
      assert.ok(
        unique.size >= 12,
        file +
          " sequence " +
          row +
          " does not contain enough distinct animation frames",
      );
    }
  }
});
