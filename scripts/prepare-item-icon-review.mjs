// Contact sheets only: crop existing authored icons without drawing new art.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ITEMS } from "../site/data.js";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const planPath = "art/icon-refinement-v27.json";
const previous = existsSync(planPath)
  ? JSON.parse(await readFile(planPath, "utf8"))
  : null;
const layouts = [
  ["basics", "items", 5, 4],
  ["weapons", "tier-weapon-icons", 7, 4],
  ["armor", "tier-armor-icons", 7, 7],
  ["forest-trophies", "loot", 8, 5],
  ["verdant-trophies", "verdant-trophies", 5, 4],
  ["forest-consumables", "consumables-v24", 5, 4],
  ["materials", "craft-materials-v26", 4, 2],
  ["coast-consumables", "consumables-v26", 5, 4],
];
const root = "/tmp/leaftale-icon-reference";
await mkdir(root, { recursive: true });
const sources = [];
for (const [id, file, cols, rows] of layouts) {
  const recorded = previous?.sources.find((j) => j.id === id);
  const entries =
    recorded?.entries ||
    Object.values(ITEMS)
      .filter((i) => (art.itemOverrides[i.id]?.file || "items") === file)
      .map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        lore: i.lore,
        level: i.level,
        original: art.itemOverrides[i.id] || {
          file: "items",
          cols: 8,
          rows: 8,
          index: art.items[i.id],
        },
      }))
      .sort((a, b) => a.original.index - b.original.index);
  if (!entries.length) throw Error(`Missing original icon layout for ${id}`);
  const src = decode(`site/assets/${file}.png`),
    out = rgba(cols * 128, rows * 128);
  entries.forEach((entry, index) => {
    const l = entry.original,
      size = l.size || art.iconLayout.size;
    const rect = {
      sx: (entry.original.index % l.cols) * size,
      sy: Math.floor(entry.original.index / l.cols) * size,
      sw: size,
      sh: size,
    };
    blit(
      sampleNearest(src, rect, 128, 128),
      out,
      (index % cols) * 128,
      Math.floor(index / cols) * 128,
    );
  });
  const reference = `${root}/${id}.png`;
  await png(out, reference);
  sources.push({
    ...recorded,
    id,
    file: `icons-v27/${id}`,
    reference,
    cols,
    rows,
    size: 64,
    tool: "image_gen",
    entries,
  });
}
await writeFile(
  planPath,
  JSON.stringify(
    {
      release: "0.27.0",
      status: previous?.status || "awaiting-generation",
      nativeSize: 64,
      displaySize: 32,
      sources,
    },
    null,
    2,
  ) + "\n",
);
