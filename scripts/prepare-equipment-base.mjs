// Register and pack image_gen body artwork; no body or equipment is drawn here.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const entries = [
  {
    kind: "combat",
    cols: 16,
    offset: 0,
    path: "/workspace/generated_images/exec-48b98af8-d720-4b2c-9b32-f0623b54d212.png",
  },
  {
    kind: "walk",
    cols: 8,
    offset: 16,
    path: "/workspace/generated_images/exec-bbcdee9c-bc8e-4196-be04-d1f81ffb8392.png",
  },
  {
    kind: "idle",
    cols: 8,
    offset: 24,
    path: "/workspace/generated_images/exec-ef56001a-a986-4ec8-a850-18c0048e109c.png",
  },
];
const atlas = rgba(3072, 768),
  guide = rgba(1536, 1536);
for (const entry of entries) {
  const src = decode(entry.path);
  for (let i = 3; i < src.data.length; i += 4)
    if (src.data[i] < 220) src.data[i] = 0;
  const grid = directionalRects(src, entry.cols, 8);
  for (let row = 0; row < 8; row++) {
    const normal = grid[row]
      .slice(0, 8)
      .map((r) => r.sh)
      .sort((a, b) => a - b)[4];
    const scale = Math.min(
      76 / normal,
      ...grid[row].map((r) => 88 / Math.max(r.sw, r.sh)),
    );
    for (let col = 0; col < entry.cols; col++) {
      const r = grid[row][col],
        crop = rgba(r.sw, r.sh);
      for (const part of r.components)
        for (let y = part.minY; y <= part.maxY; y++)
          for (let x = part.minX; x <= part.maxX; x++) {
            const at = (y * src.width + x) * 4,
              to = ((y - r.sy) * r.sw + x - r.sx) * 4;
            src.data.copy(crop.data, to, at, at + 4);
          }
      const w = Math.round(r.sw * scale),
        h = Math.round(r.sh * scale),
        cell = rgba(96, 96);
      blit(
        sampleNearest(crop, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        cell,
        Math.round((96 - w) / 2),
        92 - h,
      );
      blit(cell, atlas, (entry.offset + col) * 96, row * 96);
      const gx =
        entry.kind === "combat" ? col : entry.kind === "walk" ? col : col + 8;
      const gy = entry.kind === "combat" ? row : row + 8;
      blit(cell, guide, gx * 96, gy * 96);
    }
  }
}
await mkdir("art/equipment-guides", { recursive: true });
await png(guide, "art/equipment-guides/warden.png");
await mkdir("/tmp/leaftale-equipment", { recursive: true });
await png(atlas, "/tmp/leaftale-equipment/warden-base.png");
const receipts = JSON.parse(
  await readFile("art/equipment-generation-receipts.json", "utf8"),
);
receipts.sources = receipts.sources.filter(
  (s) => !s.id.startsWith("base-warden-"),
);
receipts.sources.push(
  ...entries.map((e) => ({ id: "base-warden-" + e.kind, ...e, rows: 8 })),
);
await writeFile(
  "art/equipment-generation-receipts.json",
  JSON.stringify(receipts, null, 2) + "\n",
);
console.log(
  "Prepared all 256 warden body poses and a registered 16 × 16 gear guide",
);
