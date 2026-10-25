// Technical extraction of image_gen originals at 2x native resolution.
// This never enlarges previously packed low-resolution PNGs.
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const sourceFile = "art/hd-sources.json";
const plan = JSON.parse(await readFile(sourceFile, "utf8"));
if (plan.pending.length || plan.sources.length !== 90)
  throw Error(
    `Generate remaining ${plan.pending.length} sources before applying the full replacement.`,
  );
execFileSync(
  process.execPath,
  ["scripts/build-shared-palette.mjs", sourceFile],
  { stdio: "inherit" },
);
const { packDirections } = await import("./pack-directions.mjs");
const { packPixelArt, decode, entityFrames, rgba, blit, png, PALETTE } =
  await import("./pack-pixel-art.mjs");
const output = "/tmp/leaftale-hd-packed";
const actors = plan.sources.filter((a) =>
  ["monster", "character", "npc"].includes(a.kind),
);
if (actors.length !== 72) throw Error("Expected all 72 directional actors");
await writeFile(
  "art/directional-sources.json",
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      style: plan.style,
      resolutionScale: 2,
      directionOrder: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
      sources: actors,
    },
    null,
    2,
  ) + "\n",
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
  resolutionScale: 2,
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
  const entry = plan.sources.find((a) => a.id === id);
  const frames = entityFrames(
    decode(entry.source),
    cols,
    rows,
    Array.from({ length: rows }, (_, i) => i),
    size,
    { sampling: "nearest", padding: 4 },
  );
  const atlas = rgba(size * cols, size * rows);
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
      "Re-extracted authored high-resolution original at twice native resolution; nearest pixel sampling, shared palette, binary alpha",
  });
}
await extra("world-props", "world/props", 4, 4, 512);
await extra("currency-leaf", "currency-leaf", 4, 1, 32);
manifest.currency = { file: "currency-leaf", cols: 4, rows: 1, size: 32 };
manifest.version = 8;
manifest.resolutionScale = 2;
manifest.pixelScale = 1;
manifest.pixelGrid = {
  nativeUnit: 1,
  displayUnit: 1,
  outline: "selective-local-color",
  forcedOutline: false,
};
manifest.iconLayout.size = 32;
for (const a of Object.values(manifest.itemOverrides)) a.size = 32;
manifest.effects.size = 128;
manifest.effects.nativeSizes = { 32: 64, 48: 96, 64: 128 };
manifest.palette = PALETTE.map(
  (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join(""),
);
manifest.style = plan.style + "; doubled native resolution throughout";
records.style = manifest.style;
records.generatedAt = new Date().toISOString();
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
process.env.LEAFTALE_ART_SOURCE = sourceFile;
process.env.LEAFTALE_ART_RESOLUTION = "2";
await import("./pack-transitions.mjs");
await import("./pack-verdant-loot.mjs");
console.log(
  "Applied full 90-source replacement: 72 actors, 10 biomes, all icons, effects and scenery.",
);
