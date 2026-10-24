// Reproduce the reviewed art update when original image_gen sources are present.
// Normal build/CI uses committed PNGs and does not run this script.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { packDirections } from "./pack-directions.mjs";
const fresh = JSON.parse(await readFile("art/crisp-sources.json", "utf8"));
const actors = fresh.sources.filter((s) =>
  ["monster", "character", "npc"].includes(s.kind),
);
if (actors.length !== 72 || new Set(actors.map((a) => a.id)).size !== 72)
  throw Error("Need all 72 reviewed actors");
const previous = JSON.parse(
  await readFile("art/directional-sources.json", "utf8"),
);
previous.sources = actors.map((a) => ({
  ...a,
  sampling: "nearest",
  layout: a.layout || "directions-down",
  sourceRows: a.sourceRows || 8,
}));
previous.style =
  "Crisp one-pixel material-colored contours; eight independently generated headings";
await writeFile(
  "art/directional-sources.json",
  JSON.stringify(previous, null, 2) + "\n",
);
const output = "/tmp/leaftale-crisp-final";
const { assets } = await packDirections({ output });
for (const a of assets) {
  await mkdir(dirname(a.target), { recursive: true });
  await copyFile(output + "/" + a.id + ".png", a.target);
}
await copyFile(output + "/manifest.json", "site/assets/manifest.json");
await copyFile(output + "/generated-assets.json", "art/generated-assets.json");
await import("./pack-transitions.mjs");
await import("./pack-verdant-loot.mjs");
console.log(
  "Applied crisp artwork, connected terrain and twenty new loot icons.",
);
