// Technical isolation and native-grid palette sampling of generated originals.
// No game artwork is drawn by this script.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { CRAFT_MATERIALS, TROPHY_CONSUMABLES } from "../site/crafting.js";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const plan = await json("art/crafting-v26.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
for (const job of plan.sources) {
  const src = decode(job.source),
    size = 32,
    out = rgba(job.cols * size, job.rows * size);
  for (let at = 0; at < src.data.length; at += 4)
    if (src.data[at + 3] < 220) src.data[at + 3] = 0;
  const entries =
    job.kind === "materials" ? CRAFT_MATERIALS : TROPHY_CONSUMABLES;
  const cuts = [];
  for (let n = 0; n < entries.length; n++) {
    const col = n % job.cols,
      row = Math.floor(n / job.cols);
    const x0 = Math.round((col * src.width) / job.cols),
      x1 = Math.round(((col + 1) * src.width) / job.cols),
      y0 = Math.round((row * src.height) / job.rows),
      y1 = Math.round(((row + 1) * src.height) / job.rows);
    const cell = rgba(x1 - x0, y1 - y0);
    for (let y = y0; y < y1; y++)
      src.data.copy(
        cell.data,
        (y - y0) * cell.width * 4,
        (y * src.width + x0) * 4,
        (y * src.width + x1) * 4,
      );
    const r = directionalRects(cell, 1, 1, { minArea: 0.01 })[0][0];
    const scale = Math.min(26 / r.sw, 26 / r.sh),
      w = Math.round(r.sw * scale),
      h = Math.round(r.sh * scale);
    blit(
      sampleNearest(cell, r, w, h),
      out,
      col * size + Math.floor((size - w) / 2),
      row * size + Math.floor((size - h) / 2),
    );
    cuts.push({
      item: entries[n].id,
      sx: x0 + r.sx,
      sy: y0 + r.sy,
      sw: r.sw,
      sh: r.sh,
    });
    art.items[entries[n].id] = 0;
    art.itemOverrides[entries[n].id] = {
      file: job.id,
      cols: job.cols,
      rows: job.rows,
      index: n,
    };
  }
  const target = `site/assets/${job.id}.png`;
  await png(out, target);
  records.assets = records.assets.filter((a) => a.id !== job.id);
  records.assets.push({
    id: job.id,
    target,
    source: job.source,
    tool: "image_gen",
    width: out.width,
    height: out.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    cols: job.cols,
    rows: job.rows,
    size,
    cuts,
  });
  if (!art.files.includes(job.id)) art.files.push(job.id);
  art.expansionArt = [...new Set([...art.expansionArt, job.id])];
}
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
