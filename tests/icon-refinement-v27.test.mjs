import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ITEMS } from "../site/data.js";
import { rgbaPixels } from "./png.mjs";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));

test("all 204 item icons have unique redrawn 64px cells, visible native detail and clean gutters", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/icon-refinement-v27.json");
  assert.equal(plan.status, "complete");
  assert.equal(plan.sources.length, 8);
  assert.equal(
    plan.sources.flatMap((j) => j.entries).length,
    Object.keys(ITEMS).length,
  );
  const hashes = new Set(),
    seen = new Set();
  for (const job of plan.sources) {
    const { width, height, pixels } = rgbaPixels(
      await readFile(`site/assets/${job.file}.png`),
    );
    assert.equal(width, job.cols * 64);
    assert.equal(height, job.rows * 64);
    for (const [index, entry] of job.entries.entries()) {
      assert.ok(ITEMS[entry.id]);
      assert.ok(!seen.has(entry.id));
      seen.add(entry.id);
      const l = art.itemOverrides[entry.id];
      assert.equal(l.file, job.file);
      assert.equal(l.index, index);
      assert.equal(l.size, 64);
      const frame = Buffer.alloc(64 * 64 * 4),
        x0 = (index % job.cols) * 64,
        y0 = Math.floor(index / job.cols) * 64;
      let ink = 0;
      for (let y = 0; y < 64; y++)
        for (let x = 0; x < 64; x++) {
          const at = ((y0 + y) * width + x0 + x) * 4,
            to = (y * 64 + x) * 4,
            a = pixels[at + 3];
          pixels.copy(frame, to, at, at + 4);
          assert.ok(a === 0 || a === 255);
          if (x < 4 || y < 4 || x >= 60 || y >= 60)
            assert.equal(a, 0, `${entry.id} spills into its neighbor`);
          if (a) ink++;
        }
      assert.ok(ink > 120 && ink < 56 * 56, entry.id);
      hashes.add(createHash("sha256").update(frame).digest("hex"));
      let fineBlocks = 0;
      for (let y = 0; y < 64; y += 2)
        for (let x = 0; x < 64; x += 2) {
          const at = (y * 64 + x) * 4,
            color = frame.readUInt32BE(at);
          if (
            [at + 4, at + 256, at + 260].some(
              (p) => frame.readUInt32BE(p) !== color,
            )
          )
            fineBlocks++;
        }
      assert.ok(fineBlocks > 12, `${entry.id} is only a block enlargement`);
    }
  }
  assert.deepEqual([...seen].sort(), Object.keys(ITEMS).sort());
  assert.equal(hashes.size, 204);
});

test("the standalone item and monster guides use the same 64px item frame coordinates as the game", async () => {
  const art = await json("site/assets/manifest.json");
  const html = await readFile("dist/bestiary.html", "utf8");
  const data = JSON.parse(
    html.match(
      /<script id="bestiary-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1],
  );
  for (const i of data.items) {
    const l = art.itemOverrides[i.id];
    assert.equal(i.image.size, 64);
    assert.equal(i.image.file, `assets/${l.file}.png`);
    assert.equal(i.image.index, l.index);
    for (const ingredient of i.ingredients)
      assert.equal(ingredient.image.size, 64);
  }
  for (const m of data.monsters)
    for (const d of m.drops) {
      assert.equal(d.image.size, 64);
      assert.equal(d.image.index, art.itemOverrides[d.item].index);
    }
});
