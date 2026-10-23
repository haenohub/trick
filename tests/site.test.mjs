import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, stat } from "node:fs/promises";
import { MONSTERS, ITEMS, MAPS } from "../site/data.js";

test("two complete regions contain ten maps, forty documented enemies and valid individual loot", () => {
  assert.equal(MAPS.length, 10);
  assert.equal(MAPS.filter((m) => m.town).length, 2);
  assert.equal(MONSTERS.length, 40);
  assert.equal(new Set(MONSTERS.map((m) => m.name)).size, 40);
  for (const m of MONSTERS) {
    assert.ok(m.lore.length > 20);
    assert.ok(MAPS.some((map) => map.id === m.map));
    assert.equal(m.drops.length, 4);
    for (const d of m.drops) {
      assert.ok(ITEMS[d.item]);
      assert.ok(d.chance > 0 && d.chance <= 1);
      assert.ok(d.min >= 1 && d.max >= d.min);
    }
  }
  assert.equal(MONSTERS.filter((m) => m.type === "boss").length, 2);
  assert.ok(MONSTERS[39].hp > MONSTERS[19].hp * 2);
});
test("all items have lore and every recipe resolves to existing materials", () => {
  assert.equal(Object.keys(ITEMS).length, 42);
  for (const i of Object.values(ITEMS)) {
    assert.ok(i.lore.length > 20, i.id);
    for (const [id, n] of Object.entries(i.recipe || {})) {
      assert.ok(ITEMS[id], id);
      assert.ok(Number.isInteger(n) && n > 0);
    }
  }
});
test("public build includes the game and no backend code or private persistence", async () => {
  const files = await readdir(new URL("../dist/", import.meta.url));
  assert.ok(!files.includes("server"));
  assert.ok(!files.includes("node_modules"));
  for (const f of [
    "index.html",
    "app.js",
    "core.js",
    "data.js",
    "renderer.js",
    "styles.css",
    "assets",
  ])
    assert.ok(files.includes(f), f);
  const manifest = JSON.parse(
    await readFile(new URL("../dist/deployment.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.kind, "leaftale");
  const html = await readFile(
    new URL("../dist/index.html", import.meta.url),
    "utf8",
  );
  assert.match(html, /리프테일/);
  assert.match(html, /src="\.\/app.js\?v=/);
  assert.match(html, /href="\.\/styles.css\?v=/);
  const entry = await readFile(
    new URL("../dist/app.js", import.meta.url),
    "utf8",
  );
  assert.match(entry, /from "\.\/core.js\?v=/);
  const hero = await stat(
    new URL("../dist/assets/title-forest.png", import.meta.url),
  );
  assert.ok(hero.size > 100000);
});
test("image-generated assets cover every map, creature, class and equipment item", async () => {
  const art = JSON.parse(
    await readFile(
      new URL("../dist/assets/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(art.provenance, "image_gen");
  assert.equal(art.files.length, 29);
  assert.equal(new Set(art.files).size, art.files.length);
  for (const name of art.files) {
    const png = await readFile(
      new URL(`../dist/assets/${name}.png`, import.meta.url),
    );
    assert.equal(png.subarray(1, 4).toString(), "PNG", name);
    assert.ok(png.readUInt32BE(16) >= 1000, name);
    assert.ok(png.readUInt32BE(20) >= 1000, name);
    assert.ok(png.length > 100000, name);
    const bounds = art.frameBounds?.[name];
    if (bounds) {
      for (const [axis, limit] of [
        ["x", png.readUInt32BE(16)],
        ["y", png.readUInt32BE(20)],
      ]) {
        const values = bounds[axis];
        if (!values) continue;
        assert.equal(values[0], 0, name);
        assert.equal(values.at(-1), limit, name);
        for (let i = 1; i < values.length; i++)
          assert.ok(values[i] > values[i - 1], name);
      }
      for (const row of bounds.rects || [])
        for (const rect of row) {
          assert.ok(rect.sw > 0 && rect.sh > 0, name);
          assert.ok(rect.sx >= 0 && rect.sy >= 0, name);
          assert.ok(rect.sx + rect.sw <= png.readUInt32BE(16), name);
          assert.ok(rect.sy + rect.sh <= png.readUInt32BE(20), name);
        }
    }
  }
  for (const m of MAPS) assert.ok(art.files.includes("maps/" + m.id));
  for (const id of Object.keys(ITEMS))
    assert.ok(Number.isInteger(art.items[id]));
  for (const m of MONSTERS) {
    const i = Number(m.id.slice(1)) - 1,
      layout = art.creatureLayouts[Math.floor(i / 4)];
    assert.ok(art.files.includes("creatures/group-" + Math.floor(i / 4)));
    assert.ok(layout.cols >= 8 && layout.rows >= 8);
    for (const row of layout.speciesRows?.[i % 4] || [
      (i % 4) * 2,
      (i % 4) * 2 + 1,
    ])
      assert.ok(row < layout.rows);
  }
  for (const c of ["warden", "mage", "ranger", "herbalist"]) {
    assert.ok(art.files.includes("characters/" + c));
    assert.ok(art.characterLayouts[c].cols >= 9);
    assert.ok(art.characterLayouts[c].rows >= 4);
    for (const frames of Object.values(
      art.characterLayouts[c].animations || {},
    ))
      for (const frame of frames)
        assert.ok(frame >= 0 && frame < art.characterLayouts[c].cols, c);
  }
  assert.equal(Object.keys(art.itemOverrides).length, 8);
  for (const id of Object.keys(art.itemOverrides)) assert.ok(ITEMS[id], id);
  const records = JSON.parse(
    await readFile(
      new URL("../art/generated-assets.json", import.meta.url),
      "utf8",
    ),
  );
  for (const file of art.files)
    assert.ok(
      records.assets.some(
        (a) =>
          a.target === "site/assets/" + file + ".png" && a.tool === "image_gen",
      ),
      file,
    );
});
