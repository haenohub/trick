// Technical extraction only. All artwork is authored with image_gen.
// Requires the original generated source files and ImageMagick; CI uses PNGs.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sourceFile = "art/storybook-sources.json";
const fresh = JSON.parse(await readFile(sourceFile, "utf8"));
const complete = fresh.sources.length === 90;
if (!fresh.sources.length) throw Error("No generated sources");
// Palette must exist before the packer modules are loaded.
if (complete)
  execFileSync(
    process.execPath,
    ["scripts/build-shared-palette.mjs", sourceFile],
    { stdio: "inherit" },
  );
const { decode, entityFrames, rgba, blit, png, PALETTE } = await import(
  "./pack-pixel-art.mjs"
);
const { packPixelArt } = await import("./pack-pixel-art.mjs");
const { packDirections } = await import("./pack-directions.mjs");
const output = "/tmp/leaftale-storybook-final";
const actors = fresh.sources.filter((a) =>
  ["monster", "character", "npc"].includes(a.kind),
);
const previous = JSON.parse(
  await readFile("art/directional-sources.json", "utf8"),
);
const updates = new Map(actors.map((a) => [a.id, a]));
previous.sources = previous.sources.map((a) => updates.get(a.id) || a);
await writeFile(
  "art/directional-sources.json",
  JSON.stringify(previous, null, 2) + "\n",
);
const packed = await packDirections({ output, only: actors.map((a) => a.id) });
for (const a of packed.assets) {
  await mkdir(dirname(a.target), { recursive: true });
  await copyFile(output + "/" + a.id + ".png", a.target);
}
await copyFile(output + "/manifest.json", "site/assets/manifest.json");
await copyFile(output + "/generated-assets.json", "art/generated-assets.json");
const misc = await packPixelArt({
  sourceFile,
  output: output + "/misc",
  only: ["icons", "loot", "effects", "interface", "title"],
});
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
const manifest = JSON.parse(
  await readFile("site/assets/manifest.json", "utf8"),
);
const replaced = new Set(misc.assets.map((a) => a.id));
records.assets = records.assets.filter((a) => !replaced.has(a.id));
for (const a of misc.assets) {
  await copyFile(output + "/misc/" + a.id + ".png", a.target);
  records.assets.push(a);
}
async function extra(id, file, cols, rows, size) {
  const entry = fresh.sources.find((a) => a.id === id);
  const frames = entityFrames(
    decode(entry.source),
    cols,
    rows,
    Array.from({ length: rows }, (_, i) => i),
    size,
    { sampling: "nearest" },
  );
  const atlas = rgba(cols * size, rows * size);
  frames.forEach((f, i) =>
    blit(f, atlas, (i % cols) * size, Math.floor(i / cols) * size),
  );
  const target = "site/assets/" + file + ".png";
  await png(atlas, target);
  records.assets = records.assets.filter((a) => a.id !== file);
  records.assets.push({
    id: file,
    target,
    tool: "image_gen",
    source: entry.source,
    request: id,
    width: atlas.width,
    height: atlas.height,
    cellSize: size,
    cols,
    rows,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    processing:
      "Nearest native grid extraction; shared palette and binary alpha; no new artwork drawn",
  });
}
if (fresh.sources.some((a) => a.id === "world-props"))
  await extra("world-props", "world/props", 4, 4, 256);
if (fresh.sources.some((a) => a.id === "currency-leaf")) {
  await extra("currency-leaf", "currency-leaf", 4, 1, 16);
  manifest.currency = { file: "currency-leaf", cols: 4, rows: 1, size: 16 };
} else {
  // The existing image-generated gold coin is a valid currency icon while
  // the new four-view coin request is blocked by image-generation quota.
  const atlas = decode("site/assets/items.png"),
    coin = rgba(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const at = ((112 + y) * atlas.width + 112 + x) * 4;
      atlas.data.copy(coin.data, (y * 16 + x) * 4, at, at + 4);
    }
  const target = "site/assets/currency-leaf.png";
  await png(coin, target);
  const origin = records.assets.find((a) => a.id === "items");
  records.assets = records.assets.filter((a) => a.id !== "currency-leaf");
  records.assets.push({
    ...origin,
    id: "currency-leaf",
    target,
    width: 16,
    height: 16,
    cols: 1,
    rows: 1,
    cellSize: 16,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    processing:
      "Technical extraction of authored gold coin icon 64 from existing image_gen item atlas; no new drawing",
  });
  manifest.currency = { file: "currency-leaf", cols: 1, rows: 1, size: 16 };
}
manifest.files = [...new Set([...manifest.files, "currency-leaf"])];
manifest.palette = PALETTE.map(
  (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join(""),
);
manifest.style = complete
  ? fresh.style
  : "Partial bright storybook actors; existing connected world assets";
records.style = manifest.style;
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
process.env.LEAFTALE_ART_SOURCE = sourceFile;
if (fresh.sources.filter((a) => a.id.startsWith("autotiles-")).length === 10)
  await import("./pack-transitions.mjs");
if (fresh.sources.some((a) => a.id === "verdant-trophies"))
  await import("./pack-verdant-loot.mjs");
console.log(
  `Applied ${actors.length} storybook actors and currency; ${fresh.pending.length} image requests remain blocked.`,
);
