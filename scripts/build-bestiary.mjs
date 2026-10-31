import { mapsForSpecies } from "../site/ecology.js";
import { consumableLines } from "../site/consumables.js";
import { createPlayer } from "../site/core.js";
import { STAT_NAMES, ATTRIBUTE_NAMES, statValue } from "../site/progression.js";
import { CHESTS } from "../site/exploration.js";
import { xpReward, dropChance, TEST_BALANCE } from "../site/balance.js";
import { readFile, writeFile } from "node:fs/promises";
import {
  MONSTERS,
  MAPS,
  REGIONS,
  ITEMS,
  TYPE_NAMES,
  VERSION,
  CLASSES,
  SLOT_NAMES,
} from "../site/data.js";

// Bake the live game data into a single HTML document, including frame UVs.
// Opening the downloaded file never requires an ES-module server.
export async function buildBestiary() {
  const art = JSON.parse(
    await readFile(
      new URL("../site/assets/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const monsters = MONSTERS.map((m) => {
    const sprite = art.monsters[m.id];
    const file = sprite.views.SW;
    const rect = { sx: 0, sy: 0, sw: sprite.size, sh: sprite.size };
    return {
      ...m,
      spawnMaps: mapsForSpecies(m.id).map((a) => a.id),
      habitatNames: mapsForSpecies(m.id).map((a) => a.name),
      spriteSize: sprite.size,
      baseSpriteSize: m.spriteSize,
      xp: xpReward(m.xp),
      gold: Math.round(m.level * (m.type === "boss" ? 15 : 1.8) + 5),
      image: { file: `assets/${file}.png`, direction: "SW", ...rect },
      drops: m.drops.map((d) => ({
        ...d,
        chance: dropChance(d.chance),
        image: art.itemOverrides[d.item]
          ? {
              ...art.itemOverrides[d.item],
              file: `assets/${art.itemOverrides[d.item].file}.png`,
              size: art.itemOverrides[d.item].size || art.iconLayout.size,
            }
          : {
              file: "assets/items.png",
              cols: 8,
              rows: 8,
              index: art.items[d.item],
              size: art.iconLayout.size,
            },
        name: ITEMS[d.item].name,
        lore: ITEMS[d.item].lore,
        itemType: ITEMS[d.item].type,
        slot: ITEMS[d.item].slot || null,
      })),
    };
  });
  const iconFor = (id) =>
    art.itemOverrides[id]
      ? {
          ...art.itemOverrides[id],
          file: `assets/${art.itemOverrides[id].file}.png`,
          size: art.itemOverrides[id].size || art.iconLayout.size,
        }
      : {
          file: "assets/items.png",
          cols: 8,
          rows: 8,
          index: art.items[id],
          size: art.iconLayout.size,
        };
  const itemTypes = {
    equipment: "장비",
    consumable: "소비 아이템",
    material: "제작 재료",
    trophy: "고유 전리품",
  };
  const items = Object.values(ITEMS).map((item, index) => ({
    ...item,
    effectLines: consumableLines(item),
    statLines: Object.entries(STAT_NAMES)
      .filter(([key]) => item[key])
      .map(([key, label]) => ({
        label,
        value: statValue(key, item[key], true),
      })),
    requirementLines: Object.entries(item.requirements || {}).map(
      ([key, value]) => ({ label: ATTRIBUTE_NAMES[key], value }),
    ),
    index,
    image: iconFor(item.id),
    typeName: itemTypes[item.type],
    slotName: SLOT_NAMES[item.slot] || "",
    className: CLASSES.find((c) => c.id === item.classId)?.name || "모든 직업",
    branchName:
      CLASSES.flatMap((c) => c.branches).find((b) => b.id === item.branch)
        ?.name || "",
    sellPrice: Math.max(1, Math.floor(item.price * 0.25)),
    ingredients: Object.entries(item.recipe || {}).map(([id, count]) => ({
      id,
      name: ITEMS[id].name,
      count,
      image: iconFor(id),
    })),
    usedBy: Object.values(ITEMS)
      .filter((i) => i.recipe?.[item.id])
      .map((i) => ({ id: i.id, name: i.name })),
    sources: {
      monsters: monsters.flatMap((m) =>
        m.drops
          .filter((d) => d.item === item.id)
          .flatMap((d) =>
            m.spawnMaps.map((map) => ({
              id: m.id,
              name: m.name,
              map,
              mapName: MAPS.find((a) => a.id === map).name,
              chance: d.chance,
              min: d.min,
              max: d.max,
            })),
          ),
      ),
      shop: item.type === "consumable" && !item.craftOnly,
      starting: CLASSES.filter(
        (c) => createPlayer(c.id).inventory[item.id],
      ).map((c) => c.name),
      herbs: ["softleaf", "mint", "saltflower", "breathgrass"].includes(item.id)
        ? MAPS.filter(
            (m) =>
              !m.town &&
              m.region === (["softleaf", "mint"].includes(item.id) ? 0 : 1),
          ).map((m) => m.name)
        : [],
      chests: CHESTS.filter((c) =>
        c.rewards.some((r) => r.item === item.id),
      ).map((c) => c.name),
      quest: ["salve", "fiber", "seawood"].includes(item.id),
    },
  }));
  const data = JSON.stringify({
    version: VERSION,
    testBalance: TEST_BALANCE,
    regions: REGIONS,
    maps: MAPS.filter((m) => !m.town),
    types: TYPE_NAMES,
    monsters,
    items,
    itemTypes,
  }).replace(/</g, "\\u003c");
  const template = await readFile(
    new URL("../templates/bestiary.html", import.meta.url),
    "utf8",
  );
  const html = template.replace("<!-- BESTIARY_DATA -->", data);
  await writeFile(new URL("../site/bestiary.html", import.meta.url), html);
  return html;
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  await buildBestiary();
  console.log("Built standalone LeafTale bestiary: site/bestiary.html");
}
