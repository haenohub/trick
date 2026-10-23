// Only technical extraction/packing: all 64 poses per actor come from image_gen.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { decode, entityFrames, rgba, blit, png } from "./pack-pixel-art.mjs";
import { DIRECTIONS, SOUTH } from "../site/directions.js";

export async function packDirections({
  sourceFile = "art/directional-sources.json",
  output = "/tmp/leaftale-direction-assets",
  only = null,
} = {}) {
  const { sources } = JSON.parse(await readFile(sourceFile, "utf8"));
  const manifest = JSON.parse(
    await readFile("site/assets/manifest.json", "utf8"),
  );
  const registry = JSON.parse(
    await readFile("art/generated-assets.json", "utf8"),
  );
  const assets = [];
  await mkdir(output, { recursive: true });
  async function save(image, file, entry, extra = {}) {
    const target = resolve(output, file + ".png");
    await png(image, target);
    assets.push({
      id: file,
      target: "site/assets/" + file + ".png",
      tool: "image_gen",
      source: entry.source,
      request: entry.id,
      width: image.width,
      height: image.height,
      sha256: createHash("sha256")
        .update(await readFile(target))
        .digest("hex"),
      processing:
        "Eight independently generated headings; native pixel-grid extraction, shared palette, binary alpha; no mirroring or synthetic rotations",
      ...extra,
    });
  }
  manifest.version = 4;
  manifest.directionOrder = DIRECTIONS.map((d) => d.id);
  manifest.defaultDirection = SOUTH;
  manifest.npcLayouts ||= {};
  for (const entry of sources) {
    if (only && !only.includes(entry.id)) continue;
    console.log("Packing eight headings: " + entry.id);
    const size = entry.size;
    const frames = entityFrames(
      decode(entry.source),
      8,
      8,
      [0, 1, 2, 3, 4, 5, 6, 7],
      size,
    );
    const file =
      (entry.kind === "monster"
        ? "creatures/"
        : entry.kind === "character"
          ? "characters/"
          : "npcs/") + entry.id;
    const atlas = rgba(size * 8, size * 8);
    frames.forEach((frame, i) =>
      blit(frame, atlas, (i % 8) * size, Math.floor(i / 8) * size),
    );
    await save(atlas, file, entry, { cellSize: size, cols: 8, rows: 8 });
    const views = {};
    for (const [row, direction] of DIRECTIONS.entries()) {
      const path = `directions/${entry.id}/${direction.id}`;
      await save(frames[row * 8], path, entry, {
        cellSize: size,
        direction: direction.id,
      });
      views[direction.id] = path;
    }
    const layout = {
      file,
      cols: 8,
      rows: 8,
      size,
      views,
      animations: {
        idle: [0],
        walk: [0, 1, 2, 3],
        attack: [4, 5],
        hurt: [6],
        death: [7],
      },
    };
    if (entry.kind === "monster") {
      layout.portrait = "portraits/" + entry.id;
      manifest.monsters[entry.id] = layout;
      await save(frames[SOUTH * 8], layout.portrait, entry, {
        cellSize: size,
        direction: "S",
      });
    } else if (entry.kind === "character")
      manifest.characterLayouts[entry.id] = layout;
    else manifest.npcLayouts[entry.id] = layout;
    if (!manifest.files.includes(file)) manifest.files.push(file);
  }
  delete manifest.npcLayout;
  manifest.files = manifest.files.filter((f) => f !== "npcs");
  const replaced = new Set(assets.map((a) => a.id));
  registry.assets = [
    ...registry.assets.filter((a) => a.id !== "npcs" && !replaced.has(a.id)),
    ...assets,
  ];
  registry.generatedAt = new Date().toISOString();
  registry.style = "Native pixel art with eight 3D-informed directional views";
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await writeFile(
    resolve(output, "generated-assets.json"),
    JSON.stringify(registry, null, 2) + "\n",
  );
  console.log(
    `Packed ${assets.length} PNGs. Review in ${output} before copying to site/assets.`,
  );
  return { manifest, assets };
}
if (
  process.argv[1] &&
  new URL(import.meta.url).pathname === resolve(process.argv[1])
) {
  await packDirections({
    only: process.argv
      .find((a) => a.startsWith("--only="))
      ?.slice(7)
      .split(","),
  });
}
