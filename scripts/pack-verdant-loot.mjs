import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, entityFrames, rgba, blit, png } from "./pack-pixel-art.mjs";
import { VERDANT } from "../site/verdant.js";
const source = JSON.parse(
  await readFile(
    process.env.LEAFTALE_ART_SOURCE || "art/crisp-sources.json",
    "utf8",
  ),
).sources.find((s) => s.id === "verdant-trophies");
const scale = Number(process.env.LEAFTALE_ART_RESOLUTION || 1),
  size = 16 * scale;
const frames = entityFrames(
    decode(source.source),
    4,
    5,
    [0, 1, 2, 3, 4],
    size,
    {
      sampling: "nearest",
      padding: 2 * scale,
    },
  ),
  atlas = rgba(size * 4, size * 5);
frames.forEach((f, i) =>
  blit(f, atlas, (i % 4) * size, Math.floor(i / 4) * size),
);
const target = "site/assets/verdant-trophies.png";
await png(atlas, target);
const manifest = JSON.parse(
    await readFile("site/assets/manifest.json", "utf8"),
  ),
  records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
for (const [index, m] of VERDANT.entries()) {
  const id = "trophy" + m.id.slice(1);
  manifest.items[id] = 0;
  manifest.itemOverrides[id] = {
    file: "verdant-trophies",
    cols: 4,
    rows: 5,
    index,
    size,
  };
}
manifest.files = [...new Set([...manifest.files, "verdant-trophies"])];
manifest.version = Math.max(manifest.version, 7);
records.assets = records.assets.filter((a) => a.id !== "verdant-trophies");
records.assets.push({
  id: "verdant-trophies",
  target,
  tool: "image_gen",
  source: source.source,
  request: source.id,
  width: size * 4,
  height: size * 5,
  cellSize: size,
  cols: 4,
  rows: 5,
  sha256: createHash("sha256")
    .update(await readFile(target))
    .digest("hex"),
  processing:
    "Twenty separately generated loot icons; nearest native icon extraction, shared palette, binary alpha",
});
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Packed twenty creature-specific loot icons.");
