import { readFile, writeFile } from "node:fs/promises";
import {
  MONSTERS,
  MAPS,
  REGIONS,
  ITEMS,
  TYPE_NAMES,
  VERSION,
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
    const file = sprite.portrait;
    const rect = { sx: 0, sy: 0, sw: sprite.size, sh: sprite.size };
    return {
      ...m,
      gold: Math.round(m.level * (m.type === "boss" ? 15 : 1.8) + 5),
      image: { file: `assets/${file}.png`, ...rect },
      drops: m.drops.map((d) => ({
        ...d,
        name: ITEMS[d.item].name,
        lore: ITEMS[d.item].lore,
        itemType: ITEMS[d.item].type,
        slot: ITEMS[d.item].slot || null,
      })),
    };
  });
  const data = JSON.stringify({
    version: VERSION,
    regions: REGIONS,
    maps: MAPS.filter((m) => !m.town),
    types: TYPE_NAMES,
    monsters,
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
