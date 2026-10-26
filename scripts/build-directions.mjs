import { readFile, writeFile } from "node:fs/promises";
import { MONSTERS, CLASSES, NPCS, VERSION } from "../site/data.js";
import { DIRECTIONS } from "../site/directions.js";
import {
  equippedAppearance,
  starterEquipment,
} from "../site/equipment-appearance.js";
export async function buildDirections() {
  const art = JSON.parse(
    await readFile(
      new URL("../site/assets/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const actors = [
    ...CLASSES.map((a) => ({
      ...a,
      kind: "character",
      appearance: equippedAppearance(art, a.id, starterEquipment(a.id)),
      layout: art.appearance.bases[a.id].anchors
        ? {
            ...art.appearance.bases[a.id],
            views: art.characterLayouts[a.id].views,
            clips: {
              walk: {
                file: art.appearance.bases[a.id].file,
                cols: 32,
                rows: 8,
                size: 96,
                frames: [16, 17, 18, 19, 20, 21, 22, 23],
                duration: 1.28,
              },
              idle: {
                file: art.appearance.bases[a.id].file,
                cols: 32,
                rows: 8,
                size: 96,
                frames: [24, 25, 26, 27, 28, 29, 30, 31],
                duration: 0.72,
              },
            },
          }
        : art.characterLayouts[a.id],
    })),
    ...NPCS.map((a) => ({ ...a, kind: "npc", layout: art.npcLayouts?.[a.id] })),
    ...MONSTERS.map((a) => ({
      ...a,
      kind: "monster",
      layout: art.monsters[a.id],
    })),
  ].map((a) => ({
    id: a.id,
    name: a.name,
    kind: a.kind,
    description: a.lore || a.description || a.role,
    layout: a.layout,
    appearance: a.appearance,
  }));
  const data = JSON.stringify({
    version: VERSION,
    directions: DIRECTIONS,
    actors,
  }).replace(/</g, "\\u003c");
  const template = await readFile(
    new URL("../templates/directions.html", import.meta.url),
    "utf8",
  );
  await writeFile(
    new URL("../site/directions.html", import.meta.url),
    template.replace("<!-- DIRECTION_DATA -->", data),
  );
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1])
  await buildDirections();
