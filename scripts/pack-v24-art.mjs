// Grid isolation and palette quantization only: all original art is image_gen.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { NEW_CONSUMABLES } from "../site/consumables.js";
const json = async (p) => JSON.parse(await readFile(p, "utf8")),
  plan = await json("art/v24-art.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
async function save(file, out, job, extra) {
  const target = "site/assets/" + file + ".png";
  await png(out, target);
  records.assets = records.assets.filter((a) => a.id !== file);
  records.assets.push({
    id: file,
    target,
    source: job.source,
    tool: "image_gen",
    width: out.width,
    height: out.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    ...extra,
  });
  if (!art.files.includes(file)) art.files.push(file);
  art.expansionArt = [...new Set([...art.expansionArt, file])];
}
function cleaned(path) {
  const im = decode(path);
  for (let p = 0; p < im.data.length; p += 4) {
    const [r, g, b, a] = im.data.subarray(p, p + 4);
    if (
      a < 220 ||
      (r > 220 && g < 40 && b < 85) ||
      (b > 230 && r < 30 && g < 30)
    )
      im.data[p + 3] = 0;
  }
  return im;
}
for (const job of plan.sources.filter(
  (j) => j.kind === "fx" || j.kind === "hit",
)) {
  const src = cleaned(job.source),
    cols = job.kind === "hit" ? 13 : 12,
    rows = job.kind === "hit" ? 4 : 5,
    size = 128,
    out = rgba(cols * size, rows * size);
  // Original hit atlas has thirteen authored phases. Its measured transparent
  // cuts are uneven: preserve all phases instead of slicing through neighbours.
  const xs =
    job.kind === "hit"
      ? [
          0,
          140,
          300,
          475,
          640,
          830,
          1025,
          1225,
          1410,
          1590,
          1770,
          1935,
          2075,
          src.width,
        ]
      : Array.from({ length: cols + 1 }, (_, i) =>
          Math.round((i * src.width) / cols),
        );
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const left = xs[col] + 4,
        top = Math.round((row * src.height) / rows) + 4,
        sw = xs[col + 1] - xs[col] - 8,
        sh = Math.round(((row + 1) * src.height) / rows) - 4 - top;
      const cell = sampleNearest(
        src,
        { sx: left, sy: top, sw, sh },
        size - 8,
        size - 8,
      );
      blit(cell, out, col * size + 4, row * size + 4);
    }
  const file =
      job.kind === "hit"
        ? "combat-impacts-v24"
        : "skills/" + job.id.replace("fx-", ""),
    layout = { file, cols, rows, size };
  if (job.kind === "hit") art.attackImpacts = layout;
  else {
    art.skillEffects ??= {};
    art.skillEffects[job.id.replace("fx-", "")] = layout;
  }
  await save(file, out, job, { ...layout, animationVersion: 24 });
}
const job = plan.sources.find((j) => j.kind === "icons");
if (job) {
  const src = cleaned(job.source),
    grid = directionalRects(src, 5, 4, { minArea: 0.02 }),
    out = rgba(160, 128);
  for (let i = 0; i < 20; i++) {
    const r = grid[Math.floor(i / 5)][i % 5],
      scale = Math.min(26 / r.sw, 26 / r.sh),
      w = Math.round(r.sw * scale),
      h = Math.round(r.sh * scale);
    blit(
      sampleNearest(src, r, w, h),
      out,
      (i % 5) * 32 + Math.round((32 - w) / 2),
      Math.floor(i / 5) * 32 + Math.round((32 - h) / 2),
    );
    art.items[NEW_CONSUMABLES[i].id] = 0;
    art.itemOverrides[NEW_CONSUMABLES[i].id] = {
      file: "consumables-v24",
      cols: 5,
      rows: 4,
      index: i,
    };
  }
  await save("consumables-v24", out, job, { cols: 5, rows: 4, size: 32 });
}
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
