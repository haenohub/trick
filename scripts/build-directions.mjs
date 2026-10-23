import { readFile, writeFile } from "node:fs/promises";
import { MONSTERS, CLASSES, NPCS, VERSION } from "../site/data.js";
import { DIRECTIONS } from "../site/directions.js";
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
      layout: art.characterLayouts[a.id],
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
