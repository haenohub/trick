import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ITEMS, MONSTERS } from "../site/data.js";
import { CRAFT_MATERIALS, TROPHY_CONSUMABLES } from "../site/crafting.js";
import { assignDropTables, DROP_RATES } from "../site/drop-tables.js";
import {
  World,
  createPlayer,
  stats,
  serialize,
  hydrateSave,
} from "../site/core.js";
import { rgbaPixels } from "./png.mjs";

const recipes = Object.values(ITEMS).filter((i) => i.craftGuide);
const hero = () => {
  const w = new World({ seed: 123 }),
    p = w.addPlayer(createPlayer());
  p.level = 30;
  return { w, p };
};
const advance = (w, seconds) => {
  const end = w.time + seconds;
  while (w.time < end - 1e-8) w.step(Math.min(0.1, end - w.time));
};

test("forty trophy recipes and seven new materials are obtainable with level-appropriate independent loot", () => {
  assert.equal(recipes.length, 40);
  assert.equal(TROPHY_CONSUMABLES.length, 20);
  assert.equal(CRAFT_MATERIALS.length, 7);
  assert.equal(new Set(recipes.map((i) => i.name)).size, 40);
  for (const i of recipes) {
    assert.ok(i.recipeNote.length > 20, i.id);
    const trophies = Object.keys(i.recipe)
      .map((id) => ITEMS[id])
      .filter((i) => i.type === "trophy");
    assert.ok(trophies.length > 0, i.id);
    for (const trophy of trophies)
      assert.ok(
        i.level >= MONSTERS.find((m) => m.id === trophy.monster).level,
        i.id,
      );
    for (const id of Object.keys(i.recipe))
      assert.ok(
        MONSTERS.some((m) => m.drops.some((d) => d.item === id)),
        `${i.id}: ${id} needs a real source`,
      );
    const hosts = MONSTERS.filter((m) => m.drops.some((d) => d.item === i.id));
    assert.equal(hosts.length === 0, Boolean(i.craftOnly), i.id);
    for (const m of hosts) {
      assert.ok(m.level >= i.level, `${m.id} drops an overleveled ${i.id}`);
      assert.equal(m.drops.find((d) => d.item === i.id).chance, 0.05);
    }
  }
  for (const i of CRAFT_MATERIALS) {
    const source = MONSTERS.filter((m) => m.drops.some((d) => d.item === i.id));
    assert.deepEqual(
      source.map((m) => m.id),
      i.dropSpecies.map((n) => `m${n}`),
    );
    assert.ok(
      recipes.some((r) => r.recipe[i.id]),
      i.id,
    );
    assert.ok(
      source.every((m) => m.drops.find((d) => d.item === i.id).chance === 0.1),
    );
  }
  const repeated = structuredClone(MONSTERS);
  assignDropTables(repeated, ITEMS);
  assert.deepEqual(
    repeated.map((m) => m.drops),
    MONSTERS.map((m) => m.drops),
  );
  for (const m of repeated) {
    assert.equal(new Set(m.drops.map((d) => d.item)).size, m.drops.length);
    for (const d of m.drops)
      assert.equal(d.chance, DROP_RATES[ITEMS[d.item].type]);
  }
});

test("every recipe crafts exactly once at its unlock and rejects missing material, low level or field crafting atomically", () => {
  const { w, p } = hero();
  for (const i of recipes) {
    p.level = i.level;
    p.inventory = Object.fromEntries(Object.entries(i.recipe));
    p.gold = 2;
    const [material, needed] = Object.entries(i.recipe)[0];
    p.inventory[material] = needed - 1;
    let before = JSON.stringify([p.inventory, p.gold]);
    assert.equal(w.craft(p, i.id), false, i.id);
    assert.equal(JSON.stringify([p.inventory, p.gold]), before);
    p.inventory[material] = needed;
    if (i.level > 1) {
      p.level = i.level - 1;
      assert.equal(w.craft(p, i.id), false, i.id);
      p.level = i.level;
    }
    p.map = "sprout";
    before = JSON.stringify([p.inventory, p.gold]);
    assert.equal(w.craft(p, i.id), false);
    assert.equal(JSON.stringify([p.inventory, p.gold]), before);
    p.map = "village";
    assert.equal(w.craft(p, i.id), true, i.id);
    assert.equal(p.gold, 0);
    assert.equal(p.inventory[i.id], 1);
    for (const id of Object.keys(i.recipe))
      assert.equal(p.inventory[id], 0, i.id);
    assert.equal(hydrateSave(serialize(p)).inventory[i.id], 1);
  }
});

test("actual monster kills, floor pickup, acorn helmet baking and consumption form one complete gameplay loop", () => {
  const { w, p } = hero();
  w.rng = () => 0; // All independent rolls succeed in this deterministic hunt.
  const requirements = ITEMS.acornbread.recipe;
  assert.equal(requirements.trophy6, 1);
  assert.equal(ITEMS.trophy6.name, "금 간 도토리투구");
  for (const species of ["m6", "m6", "m1"]) {
    const def = MONSTERS.find((m) => m.id === species);
    w.travel(p, def.map, true);
    const mob = w.map(p.map).mobs.find((m) => m.def === species && m.hp > 0);
    assert.ok(mob);
    Object.assign(p, { x: mob.x, y: mob.y });
    w.damage(p, mob, 1e6);
    assert.equal(mob.hp, 0);
    for (const d of w
      .map(p.map)
      .drops.filter(
        (d) => requirements[d.item] && !d.pickupEnds && !d.collected,
      )) {
      Object.assign(p, { x: d.x, y: d.y });
      assert.ok(w.pickup(p, d.id));
    }
    advance(w, 0.65);
  }
  for (const [id, n] of Object.entries(requirements))
    assert.ok(p.inventory[id] >= n, id);
  const before = { ...p.inventory };
  w.travel(p, "village", true);
  assert.ok(w.craft(p, "acornbread"));
  for (const [id, n] of Object.entries(requirements))
    assert.equal(p.inventory[id], before[id] - n);
  p.hp = 1;
  p.focus = 0;
  assert.ok(w.potion(p, "acornbread"));
  assert.equal(p.hp, 1 + stats(p).maxHp * 0.3);
  assert.equal(p.focus, 15);
});

test("ten powerful consumables cannot be bought or dropped, but their crafted recovery and combat bonuses work", () => {
  const { w, p } = hero(),
    only = recipes.filter((i) => i.craftOnly);
  assert.equal(only.length, 10);
  p.gold = 1e6;
  for (const i of only) {
    const before = JSON.stringify([p.inventory, p.gold]);
    assert.equal(w.act(p.id, { type: "buy", item: i.id }), false, i.id);
    assert.equal(JSON.stringify([p.inventory, p.gold]), before);
    assert.ok(MONSTERS.every((m) => !m.drops.some((d) => d.item === i.id)));
  }
  for (const [id, n] of Object.entries(ITEMS.starbreath.recipe))
    p.inventory[id] = n;
  const base = stats(p);
  assert.ok(w.craft(p, "starbreath"));
  p.hp = 1;
  p.focus = 0;
  p.poisonUntil = 100;
  assert.ok(w.potion(p, "starbreath"));
  assert.equal(p.inventory.starbreath, 0);
  assert.equal(p.hp, stats(p).maxHp);
  assert.equal(p.focus, 100);
  assert.equal(p.poisonUntil, 0);
  assert.equal(stats(p).attack, Math.round(base.attack * 1.4));
  assert.equal(stats(p).magicPower, Math.round(base.magicPower * 1.4));
  w.time += 91;
  w.step(0.01);
  assert.equal(stats(p).attack, base.attack);
  assert.ok(ITEMS.blueshellbroth.level > ITEMS.seedcrunch.level);
  assert.ok(ITEMS.blueshellbroth.heal > ITEMS.seedcrunch.heal);
  assert.ok(
    ITEMS.crystalbloomcordial.buff.magicPower >
      ITEMS.starcordial.buff.magicPower,
  );
});

test("generated native icons have isolated cells and the standalone crafting data matches the real workshop and drop authority", async () => {
  const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
  const all = [...CRAFT_MATERIALS, ...TROPHY_CONSUMABLES];
  assert.equal(
    new Set(all.map((i) => JSON.stringify(art.itemOverrides[i.id]))).size,
    27,
  );
  for (const name of ["consumables-v26", "craft-materials-v26"]) {
    const { width, height, pixels } = rgbaPixels(
      await readFile(`site/assets/${name}.png`),
    );
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const a = pixels[(y * width + x) * 4 + 3];
        assert.ok(a === 0 || a === 255);
        if (x % 32 < 3 || x % 32 >= 29 || y % 32 < 3 || y % 32 >= 29)
          assert.equal(a, 0, name);
      }
  }
  const html = await readFile("dist/bestiary.html", "utf8");
  const baked = JSON.parse(
    html.match(
      /<script id="bestiary-data" type="application\/json">([\s\S]*?)<\/script>/,
    )[1],
  );
  assert.equal(baked.items.filter((i) => i.craftGuide).length, 40);
  for (const i of baked.items.filter((i) => i.craftGuide)) {
    assert.deepEqual(i.recipe, ITEMS[i.id].recipe);
    assert.equal(i.level, ITEMS[i.id].level);
    assert.equal(i.sources.shop, !Boolean(i.craftOnly));
    for (const ingredient of i.ingredients) {
      assert.equal(ingredient.name, ITEMS[ingredient.id].name);
      assert.ok(ingredient.image.file);
    }
  }
});
