// Native-grid packing and registration of generated originals, no drawn art.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { ITEMS, CLASSES } from "../site/data.js";
import { tierItemId, EQUIPMENT_LEVELS } from "../site/equipment-tiers.js";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const plan = await json("art/v23-art.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
const median = (a) => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
function cut(src, r) {
  const out = rgba(r.sw, r.sh);
  for (const p of r.components)
    for (let y = p.minY; y <= p.maxY; y++)
      for (let x = p.minX; x <= p.maxX; x++)
        src.data.copy(
          out.data,
          ((y - r.sy) * r.sw + x - r.sx) * 4,
          (y * src.width + x) * 4,
          (y * src.width + x + 1) * 4,
        );
  return out;
}
function source(path) {
  const im = decode(path);
  for (let a = 0; a < im.data.length; a += 4) {
    const [r, g, b, alpha] = im.data.subarray(a, a + 4);
    if (
      alpha < 220 ||
      (r > 220 && g < 40 && b < 85) ||
      (b > 230 && r < 30 && g < 30)
    )
      im.data[a + 3] = 0;
  }
  return im;
}
function measure(im) {
  let minY = im.height,
    maxY = 0,
    cx = 0,
    n = 0;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++)
      if (im.data[(y * im.width + x) * 4 + 3]) {
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        cx += x;
        n++;
      }
  return { height: maxY - minY + 1, cx: cx / n };
}
async function save(file, im, job, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await png(im, target);
  const old = records.assets.find((a) => a.id === file);
  records.assets = records.assets.filter((a) => a.id !== file);
  records.assets.push({
    ...old,
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
}
for (const job of plan.sources.filter((j) => j.monster)) {
  const l = art.monsters[job.monster],
    s = l.size,
    src = source(job.source),
    grid = directionalRects(src, 8, 8, { minArea: 0.02 }),
    out = rgba(s * 8, s * 8);
  const ref = measure(decode("site/assets/" + l.views.SW + ".png"));
  const rects = grid.flat(),
    scale = Math.min(
      ref.height / median(rects.map((r) => r.sh)),
      ...rects.map((r) => (s - 8) / Math.max(r.sw, r.sh)),
    );
  for (let d = 0; d < 8; d++)
    for (let f = 0; f < 8; f++) {
      const r = grid[d][f],
        w = Math.max(1, Math.round(r.sw * scale)),
        h = Math.max(1, Math.round(r.sh * scale)),
        im = sampleNearest(
          cut(src, r),
          { sx: 0, sy: 0, sw: r.sw, sh: r.sh },
          w,
          h,
        );
      const root = measure(im),
        px = Math.max(4, Math.min(s - 4 - w, Math.round(ref.cx - root.cx)));
      blit(im, out, f * s + px, d * s + s - 4 - h);
    }
  const file =
    job.motion === "combat"
      ? "combat/" + job.monster
      : "locomotion/" + job.monster + "-" + job.motion;
  await save(file, out, job, {
    motionReviewVersion: 1,
    registration: {
      method: "one-scale-body-root",
      anchor: job.motion === "idle" ? "planted-feet" : "body-root",
      directions: plan.directions.map((direction, d) => ({
        direction,
        source: job.source,
        sourceRow: d,
        destinationRow: d,
        scale,
      })),
    },
  });
  l.reviewVersion = 1;
}
// Two icon sheets, same column rank in each family.
for (const kind of ["weapon-icons", "armor-icons"]) {
  const job = plan.sources.find((j) => j.id === kind);
  if (!job) continue;
  const src = source(job.source),
    rows = kind === "weapon-icons" ? 4 : 7,
    grid = directionalRects(src, 7, rows, { minArea: 0.015 }),
    out = rgba(224, rows * 32);
  for (let row = 0; row < rows; row++)
    for (let stage = 0; stage < 7; stage++) {
      const r = grid[row][stage],
        scale = Math.min(24 / r.sw, 24 / r.sh),
        w = Math.max(1, Math.round(r.sw * scale)),
        h = Math.max(1, Math.round(r.sh * scale));
      blit(
        sampleNearest(cut(src, r), { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        out,
        stage * 32 + Math.round((32 - w) / 2),
        row * 32 + Math.round((32 - h) / 2),
      );
      const cls = CLASSES[kind === "weapon-icons" ? row : Math.min(row, 3)],
        slot =
          kind === "weapon-icons"
            ? "weapon"
            : row < 4
              ? "armor"
              : ["head", "boots", "charm"][row - 4],
        id = tierItemId(cls, slot, EQUIPMENT_LEVELS[stage]);
      art.items[id] ??= 0;
      art.itemOverrides[id] = {
        file: "tier-" + kind,
        cols: 7,
        rows,
        index: row * 7 + stage,
      };
    }
  await save("tier-" + kind, out, job, { cols: 7, rows, size: 32 });
}
for (const kind of ["spear", "staff", "bow", "wand"]) {
  const job = plan.sources.find((j) => j.id === "held-" + kind);
  if (!job) continue;
  const src = source(job.source),
    grid = directionalRects(src, 8, 7, { minArea: 0.015 }),
    out = rgba(768, 672),
    cls = CLASSES.find((c) => c.weapon === kind);
  for (let stage = 0; stage < 7; stage++) {
    const id = tierItemId(cls, "weapon", EQUIPMENT_LEVELS[stage]),
      def = {
        file: "appearance/tier-" + kind,
        kind,
        index: stage,
        grips: [],
        axes: [],
        tips: [],
        measured: [],
        size: 96,
        cols: 8,
        rows: 7,
      };
    for (let d = 0; d < 8; d++) {
      const r = grid[stage][d],
        im = cut(src, r),
        marks = [];
      for (let y = 0; y < im.height; y++)
        for (let x = 0; x < im.width; x++) {
          const a = (y * im.width + x) * 4,
            [red, g, b, alpha] = im.data.subarray(a, a + 4);
          if (alpha && red > 200 && b > 160 && g < 100) {
            marks.push({ x, y });
            im.data[a + 3] = 0;
          }
        }
      const scale = Math.min(82 / im.width, 82 / im.height),
        w = Math.max(1, Math.round(im.width * scale)),
        h = Math.max(1, Math.round(im.height * scale)),
        left = Math.round((96 - w) / 2),
        top = 92 - h;
      const frame = sampleNearest(
        im,
        { sx: 0, sy: 0, sw: im.width, sh: im.height },
        w,
        h,
      );
      blit(frame, out, d * 96 + left, stage * 96 + top);
      const grip = marks.length
        ? [
            left + (median(marks.map((p) => p.x)) * w) / im.width,
            top + (median(marks.map((p) => p.y)) * h) / im.height,
          ]
        : [48, kind === "bow" ? 52 : 68];
      def.grips.push(grip.map(Math.round));
      def.measured.push(marks.length > 0);
      const tips = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (y + top < grip[1] - 10 && frame.data[(y * w + x) * 4 + 3])
            tips.push({
              x: x + left,
              y: y + top,
              d: Math.hypot(x + left - grip[0], y + top - grip[1]),
            });
      tips.sort((a, b) => b.d - a.d);
      const t = tips.slice(0, 5),
        tip = t.length
          ? [
              t.reduce((s, p) => s + p.x, 0) / t.length,
              t.reduce((s, p) => s + p.y, 0) / t.length,
            ]
          : [grip[0], grip[1] - 25];
      def.tips.push(tip);
      def.axes.push(Math.atan2(tip[0] - grip[0], grip[1] - tip[1]));
    }
    art.appearance.weapons[id] = def;
  }
  await save("appearance/tier-" + kind, out, job, {
    cols: 8,
    rows: 7,
    size: 96,
  });
}
const fx = plan.sources.find((j) => j.id === "skill-fx");
if (fx) {
  const src = source(fx.source),
    grid = Array.from({ length: 4 }, (_, row) =>
      Array.from({ length: 8 }, (_, f) => {
        const sx = Math.round((f * src.width) / 8) + 6,
          sy = Math.round((row * src.height) / 4) + 6,
          ex = Math.round(((f + 1) * src.width) / 8) - 7,
          ey = Math.round(((row + 1) * src.height) / 4) - 7;
        return {
          sx,
          sy,
          sw: ex - sx + 1,
          sh: ey - sy + 1,
          components: [{ minX: sx, minY: sy, maxX: ex, maxY: ey }],
        };
      }),
    ),
    out = rgba(1024, 512);
  for (let row = 0; row < 4; row++)
    for (let f = 0; f < 8; f++) {
      const r = grid[row][f],
        scale = Math.min(112 / r.sw, 112 / r.sh),
        w = Math.max(1, Math.round(r.sw * scale)),
        h = Math.max(1, Math.round(r.sh * scale));
      blit(
        sampleNearest(cut(src, r), { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        out,
        f * 128 + Math.round((128 - w) / 2),
        row * 128 + Math.round((128 - h) / 2),
      );
    }
  await save("class-skills-v23", out, fx, { cols: 8, rows: 4, size: 128 });
  art.skillMotion = { file: "class-skills-v23", size: 128, cols: 8, rows: 4 };
}
art.expansionArt = [
  "tier-weapon-icons",
  "tier-armor-icons",
  "class-skills-v23",
];
plan.status = plan.sources.length === 18 ? "complete" : "generating";
await writeFile("art/v23-art.json", JSON.stringify(plan, null, 2) + "\n");
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Packed", plan.sources.length, "new generated originals");
