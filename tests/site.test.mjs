import { test } from "node:test";
import { createHash } from "node:crypto";
import { rgbaPixels } from "./png.mjs";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { MONSTERS, ITEMS, MAPS } from "../site/data.js";

test("two complete regions contain ten maps, forty documented enemies and valid individual loot", () => {
  assert.equal(MAPS.length, 10);
  assert.equal(MAPS.filter((m) => m.town).length, 2);
  assert.equal(MONSTERS.length, 40);
  assert.equal(new Set(MONSTERS.map((m) => m.name)).size, 40);
  for (const m of MONSTERS) {
    assert.ok(m.lore.length > 20);
    assert.ok(MAPS.some((map) => map.id === m.map));
    assert.equal(m.drops.length, 5);
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
  assert.equal(Object.keys(ITEMS).length, 82);
  for (const i of Object.values(ITEMS)) {
    assert.ok(i.lore.length > 20, i.id);
    for (const [id, n] of Object.entries(i.recipe || {})) {
      assert.ok(ITEMS[id], id);
      assert.ok(Number.isInteger(n) && n > 0);
    }
  }
});
test("standalone HTML bestiary preserves every real loot probability and story", async () => {
  const html = await readFile(
    new URL("../dist/bestiary.html", import.meta.url),
    "utf8",
  );
  const match = html.match(
    /<script id="bestiary-data" type="application\/json">\s*([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "embedded data works without fetching modules");
  const data = JSON.parse(match[1]);
  assert.equal(data.monsters.length, MONSTERS.length);
  assert.equal(data.maps.length, MAPS.filter((m) => !m.town).length);
  for (const monster of MONSTERS) {
    const entry = data.monsters.find((m) => m.id === monster.id);
    assert.equal(entry.name, monster.name);
    assert.equal(entry.lore, monster.lore);
    assert.equal(entry.map, monster.map);
    assert.equal(entry.hp, monster.hp);
    assert.equal(
      entry.gold,
      Math.round(monster.level * (monster.type === "boss" ? 15 : 1.8) + 5),
    );
    assert.deepEqual(
      entry.drops.map(({ item, chance, min, max }) => ({
        item,
        chance,
        min,
        max,
      })),
      monster.drops,
    );
    for (const drop of entry.drops) {
      assert.equal(drop.name, ITEMS[drop.item].name);
      assert.equal(drop.lore, ITEMS[drop.item].lore);
    }
    assert.ok(entry.image.sw > 0 && entry.image.sh > 0);
    assert.equal(entry.image.file, `assets/portraits/${monster.id}.png`);
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
  const hero = await readFile(
    new URL("../dist/assets/title-forest.png", import.meta.url),
  );
  assert.equal(hero.readUInt32BE(16), 480);
  assert.equal(hero.readUInt32BE(20), 320);
});
test("native pixel assets have the required grids, shared palette and binary alpha", async () => {
  const art = JSON.parse(
    await readFile(
      new URL("../dist/assets/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const records = JSON.parse(
    await readFile(
      new URL("../art/generated-assets.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(art.version, 4);
  assert.equal(art.provenance, "image_gen");
  assert.equal(art.pixelScale, 2);
  assert.equal(art.files.length, 69);
  assert.equal(records.assets.length, 525);
  assert.equal(art.palette.length, 32);
  const palette = new Set(art.palette.map((c) => c.slice(1).toLowerCase()));
  for (const record of records.assets) {
    const png = await readFile(new URL("../" + record.target, import.meta.url));
    assert.equal(
      createHash("sha256").update(png).digest("hex"),
      record.sha256,
      record.id,
    );
    const { width, height, pixels } = rgbaPixels(png);
    assert.equal(width, record.width, record.id);
    assert.equal(height, record.height, record.id);
    for (let i = 0; i < pixels.length; i += 4) {
      assert.ok(
        pixels[i + 3] === 0 || pixels[i + 3] === 255,
        record.id + " has fractional alpha",
      );
      if (pixels[i + 3])
        assert.ok(
          palette.has(pixels.subarray(i, i + 3).toString("hex")),
          record.id + " color outside shared palette",
        );
    }
  }
  for (const m of MONSTERS) {
    const l = art.monsters[m.id];
    assert.equal(l.size, m.spriteSize);
    assert.ok([32, 48, 64].includes(l.size));
    const portrait = await readFile(
      new URL("../dist/assets/" + l.portrait + ".png", import.meta.url),
    );
    assert.equal(portrait.readUInt32BE(16), l.size, m.id);
    assert.equal(portrait.readUInt32BE(20), l.size, m.id);
    const { width, pixels } = rgbaPixels(
      await readFile(
        new URL("../dist/assets/" + l.file + ".png", import.meta.url),
      ),
    );
    assert.equal(width, l.size * 8, m.id);
    const hashes = l.animations.walk.map((frame) => {
      const data = Buffer.concat(
        Array.from({ length: l.size }, (_, y) =>
          pixels.subarray(
            (y * width + frame * l.size) * 4,
            (y * width + (frame + 1) * l.size) * 4,
          ),
        ),
      );
      return createHash("sha256").update(data).digest("hex");
    });
    assert.ok(
      new Set(hashes).size >= 2,
      m.id + " needs distinct native walking frames",
    );
  }
  for (const c of ["warden", "mage", "ranger", "herbalist"]) {
    assert.deepEqual(
      [
        art.characterLayouts[c].cols,
        art.characterLayouts[c].rows,
        art.characterLayouts[c].size,
      ],
      [8, 8, 48],
    );
  }
  assert.equal(Object.keys(art.items).length, 82);
  assert.equal(Object.keys(art.itemOverrides).length, 40);
  for (const size of [32, 48, 64]) {
    const file = art.effects.variants[size];
    const png = await readFile(
      new URL(`../dist/assets/${file}.png`, import.meta.url),
    );
    assert.equal(png.readUInt32BE(16), size * 8);
    assert.equal(png.readUInt32BE(20), size * 8);
  }
});

test("every monster has its own usable miscellaneous trophy with a unique story", () => {
  const ids = new Set();
  for (const monster of MONSTERS) {
    const drops = monster.drops.filter((d) => ITEMS[d.item].type === "trophy");
    assert.equal(drops.length, 1, monster.id);
    const trophy = ITEMS[drops[0].item];
    assert.equal(trophy.monster, monster.id);
    assert.ok(trophy.lore.length > 20);
    assert.ok(trophy.price > 0);
    ids.add(trophy.id);
  }
  assert.equal(ids.size, 40);
});
