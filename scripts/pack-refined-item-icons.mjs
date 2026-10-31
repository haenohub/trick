// Isolate and register image_gen redraws on a 64px native grid. This only
// crops, aligns and quantizes authored pixels; it never draws game artwork.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const plan = await json("art/icon-refinement-v27.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
if (plan.sources.some((j) => !j.source))
  throw Error("Missing generated item atlas");
await mkdir("site/assets/icons-v27", { recursive: true });
function cuts(src, axis, count) {
  const len = axis === "x" ? src.width : src.height,
    histogram = new Uint32Array(len);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (src.data[(y * src.width + x) * 4 + 3] >= 220)
        histogram[axis === "x" ? x : y]++;
  const result = [0],
    pitch = len / count;
  for (let n = 1; n < count; n++) {
    const nominal = n * pitch;
    let best = Math.round(nominal),
      score = Infinity;
    for (
      let at = Math.ceil(nominal - pitch * 0.24);
      at <= Math.floor(nominal + pitch * 0.24);
      at++
    ) {
      const cost =
        (histogram[at - 1] + histogram[at] + histogram[at + 1]) / 3 +
        Math.abs(at - nominal) * 0.15;
      if (cost < score) {
        score = cost;
        best = at;
      }
    }
    result.push(best);
  }
  return [...result, len];
}
for (const job of plan.sources) {
  const src = decode(job.source),
    size = 64,
    out = rgba(job.cols * size, job.rows * size),
    frames = [];
  for (let at = 0; at < src.data.length; at += 4)
    if (src.data[at + 3] < 220) src.data[at + 3] = 0;
  const xs = cuts(src, "x", job.cols),
    ys = cuts(src, "y", job.rows);
  for (const [index, entry] of job.entries.entries()) {
    const col = index % job.cols,
      row = Math.floor(index / job.cols),
      x0 = xs[col],
      y0 = ys[row];
    const cell = rgba(xs[col + 1] - x0, ys[row + 1] - y0);
    for (let y = 0; y < cell.height; y++)
      src.data.copy(
        cell.data,
        y * cell.width * 4,
        ((y + y0) * src.width + x0) * 4,
        ((y + y0) * src.width + xs[col + 1]) * 4,
      );
    const r = directionalRects(cell, 1, 1, { minArea: 0.008 })[0][0],
      scale = Math.min(56 / r.sw, 56 / r.sh);
    const w = Math.max(1, Math.round(r.sw * scale)),
      h = Math.max(1, Math.round(r.sh * scale));
    blit(
      sampleNearest(cell, r, w, h),
      out,
      col * size + Math.floor((size - w) / 2),
      row * size + Math.floor((size - h) / 2),
    );
    frames.push({
      item: entry.id,
      sx: x0 + r.sx,
      sy: y0 + r.sy,
      sw: r.sw,
      sh: r.sh,
      width: w,
      height: h,
    });
    art.itemOverrides[entry.id] = {
      file: job.file,
      cols: job.cols,
      rows: job.rows,
      index,
      size,
      qualityVersion: 27,
    };
  }
  const target = `site/assets/${job.file}.png`;
  await png(out, target);
  records.assets = records.assets.filter((a) => a.id !== job.file);
  records.assets.push({
    id: job.file,
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
    qualityVersion: 27,
    frames,
  });
  if (!art.files.includes(job.file)) art.files.push(job.file);
  art.expansionArt = [...new Set([...art.expansionArt, job.file])];
}
art.iconQuality = {
  version: 27,
  nativeSize: 64,
  defaultDisplaySize: 32,
  items: plan.sources.reduce((n, j) => n + j.entries.length, 0),
  files: plan.sources.map((j) => j.file),
  sourcePlan: "art/icon-refinement-v27.json",
  contour: "authored-local-color",
  gutter: 4,
};
plan.status = "complete";
await writeFile(
  "art/icon-refinement-v27.json",
  JSON.stringify(plan, null, 2) + "\n",
);
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
