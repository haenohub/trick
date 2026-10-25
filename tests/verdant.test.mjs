import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MONSTERS, ITEMS } from "../site/data.js";
import { VERDANT } from "../site/verdant.js";
import { NAVIGATION, TILE } from "../site/world-layout.js";
import { rgbaPixels } from "./png.mjs";

test("each region adds exactly ten plant/inanimate species with personal loot, lore and native sizes", () => {
  assert.equal(VERDANT.length, 20);
  for (const region of [0, 1]) {
    assert.equal(MONSTERS.filter((m) => m.region === region).length, 30);
    assert.equal(
      MONSTERS.filter((m) => m.region === region && m.index >= 40).length,
      10,
    );
  }
  for (const m of MONSTERS.filter((m) => m.index >= 40)) {
    assert.ok(["plant", "object"].includes(m.concept), m.id);
    assert.ok([32, 48, 64].includes(m.spriteSize));
    assert.ok(m.lore.length > 35);
    const t = m.drops.find((d) => d.item === "trophy" + m.id.slice(1));
    assert.ok(t && t.chance > 0 && t.chance <= 1, m.id);
    assert.equal(ITEMS[t.item].monster, m.id);
    assert.ok(ITEMS[t.item].lore.length > 30);
  }
  assert.ok(
    MONSTERS.find((m) => m.id === "m60").hp >
      MONSTERS.find((m) => m.id === "m41").hp * 10,
  );
});
test("every material-matched tile edge uses identical authored pixels and all maps share the dual grid", async () => {
  const nativeTile = TILE * 2;
  const pixel = (a, t, x, y) =>
    a.pixels.subarray(
      ((Math.floor(t / 4) * nativeTile + y) * a.width + (t % 4) * nativeTile + x) * 4,
      ((Math.floor(t / 4) * nativeTile + y) * a.width + (t % 4) * nativeTile + x) * 4 + 4,
    );
  for (const n of Object.values(NAVIGATION)) {
    const atlas = rgbaPixels(
      await readFile("site/assets/world/tiles-" + n.id + ".png"),
    );
    assert.equal(n.transitions.length, n.rows + 1);
    for (let a = 0; a < 16; a++)
      for (let b = 0; b < 16; b++) {
        if ((a & 2) / 2 === (b & 1) && (a & 4) / 4 === (b & 8) / 8)
          for (let y = 0; y < nativeTile; y++)
            assert.deepEqual(
              pixel(atlas, a, nativeTile - 1, y),
              pixel(atlas, b, 0, y),
              n.id + " horizontal " + a + "/" + b,
            );
        if ((a & 8) / 8 === (b & 1) && (a & 4) / 4 === (b & 2) / 2)
          for (let x = 0; x < nativeTile; x++)
            assert.deepEqual(
              pixel(atlas, a, x, nativeTile - 1),
              pixel(atlas, b, x, 0),
              n.id + " vertical " + a + "/" + b,
            );
      }
    for (let r = 0; r <= n.rows; r++)
      for (let c = 0; c <= n.cols; c++) {
        const m = n.transitions[r][c];
        if (c < n.cols) {
          const e = n.transitions[r][c + 1];
          assert.equal((m & 2) / 2, e & 1);
          assert.equal((m & 4) / 4, (e & 8) / 8);
        }
        if (r < n.rows) {
          const s = n.transitions[r + 1][c];
          assert.equal((m & 8) / 8, s & 1);
          assert.equal((m & 4) / 4, (s & 2) / 2);
        }
      }
  }
});
test("both codex data and all native portrait PNGs face southwest", async () => {
  const html = await readFile("dist/bestiary.html", "utf8");
  const data = JSON.parse(
    html.match(
      /<script id="bestiary-data" type="application\/json">\s*([\s\S]*?)<\/script>/,
    )[1],
  );
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  for (const m of data.monsters) {
    assert.equal(m.image.direction, "SW");
    assert.equal(m.image.file, "assets/directions/" + m.id + "/SW.png");
    assert.equal(art.monsters[m.id].portraitDirection, "SW");
    const a = rgbaPixels(
        await readFile("site/assets/portraits/" + m.id + ".png"),
      ),
      b = rgbaPixels(
        await readFile("site/assets/directions/" + m.id + "/SW.png"),
      );
    assert.deepEqual(a.pixels, b.pixels, m.id);
  }
});
