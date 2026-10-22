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
  const entry = await readFile(new URL("../dist/app.js", import.meta.url), "utf8");
  assert.match(entry, /from "\.\/core.js\?v=/);
  const hero = await stat(
    new URL("../dist/assets/title-forest.png", import.meta.url),
  );
  assert.ok(hero.size > 100000);
});
test("all monsters and classes have full four-direction animation atlases", async () => {
  for (const name of [
    ...MONSTERS.map((m) => m.id),
    "warden",
    "mage",
    "ranger",
    "herbalist",
  ]) {
    const image = await readFile(
      new URL(`../dist/assets/${name}.png`, import.meta.url),
    );
    assert.equal(image.readUInt32BE(16), 1536, name);
    assert.equal(image.readUInt32BE(20), 256, name);
  }
  const art = JSON.parse(
    await readFile(
      new URL("../dist/assets/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(Object.keys(art.items).length, 42);
  assert.equal(art.animations.walk[1], 6);
});
