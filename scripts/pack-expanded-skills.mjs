// Register generated frames without drawing art. A single source-cell scale
// and pivot per animation preserve growth and keep every neighbor isolated.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const plan = await json("art/skills-v28.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
await mkdir("site/assets/skills", { recursive: true });
const classes = ["warden", "mage", "ranger", "herbalist"];
async function save(file, im, job, extra = {}) {
  const target = `site/assets/${file}.png`;
  await png(im, target);
  records.assets = records.assets.filter((a) => a.id !== file);
  records.assets.push({
    id: file,
    target,
    source: job.source,
    tool: "image_gen",
    width: im.width,
    height: im.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    ...extra,
  });
  if (!art.files.includes(file)) art.files.push(file);
  art.expansionArt = [...new Set([...art.expansionArt, file])];
}
for (const job of plan.sources) {
  const src = decode(job.source);
  for (let at = 0; at < src.data.length; at += 4)
    if (src.data[at + 3] < 220) src.data[at + 3] = 0;
  if (job.kind === "icons") {
    const out = rgba(128, 256),
      grid = directionalRects(src, 2, 4, { minArea: 0.01 });
    art.expandedSkillIcons = {};
    for (let i = 0; i < 8; i++) {
      const r = grid[Math.floor(i / 2)][i % 2],
        s = Math.min(56 / r.sw, 56 / r.sh),
        w = Math.round(r.sw * s),
        h = Math.round(r.sh * s);
      blit(
        sampleNearest(src, r, w, h),
        out,
        (i % 2) * 64 + Math.floor((64 - w) / 2),
        Math.floor(i / 2) * 64 + Math.floor((64 - h) / 2),
      );
      const cls = classes[Math.floor(i / 2)];
      (art.expandedSkillIcons[cls] ||= []).push({
        file: "skill-icons-v28",
        cols: 2,
        rows: 4,
        size: 64,
        index: i,
      });
    }
    await save("skill-icons-v28", out, job, { cols: 2, rows: 4, size: 64 });
    continue;
  }
  const out = rgba(1536, 256),
    registration = [];
  for (let skill = 0; skill < 2; skill++) {
    const ground =
        !(job.id === "warden" && skill === 1) &&
        !(job.id === "ranger" && skill === 0),
      frames = [];
    for (let f = 0; f < 12; f++) {
      const col = f % 4,
        row = skill * 3 + Math.floor(f / 4),
        x0 = Math.round((col * src.width) / 4),
        y0 = Math.round((row * src.height) / 6),
        x1 = Math.round(((col + 1) * src.width) / 4),
        y1 = Math.round(((row + 1) * src.height) / 6);
      const cell = sampleNearest(
        src,
        { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 },
        120,
        120,
      );
      blit(cell, out, f * 128 + 4, skill * 128 + 4);
      let minX = 127,
        minY = 127,
        maxX = 0,
        maxY = 0,
        ink = 0;
      for (let y = 0; y < 120; y++)
        for (let x = 0; x < 120; x++)
          if (cell.data[(y * 120 + x) * 4 + 3]) {
            minX = Math.min(minX, x + 4);
            maxX = Math.max(maxX, x + 4);
            minY = Math.min(minY, y + 4);
            maxY = Math.max(maxY, y + 4);
            ink++;
          }
      frames.push({
        frame: f,
        source: { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 },
        bounds: ink
          ? { minX, minY, maxX, maxY }
          : { minX: 64, minY: 64, maxX: 64, maxY: 64 },
      });
    }
    registration.push({
      ground,
      pivot: ground ? [64, 112] : [64, 64],
      method: "fixed-source-cell",
      frames,
    });
  }
  const file = "skills/expanded-" + job.id,
    layout = {
      file,
      cols: 12,
      rows: 2,
      size: 128,
      rowFrames: [12, 12],
      registration,
    };
  (art.expandedSkillEffects ||= {})[job.id] = layout;
  await save(file, out, job, { ...layout, expansionVersion: 28 });
}
plan.status = "complete";
await writeFile("art/skills-v28.json", JSON.stringify(plan, null, 2) + "\n");
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
