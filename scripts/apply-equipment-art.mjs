// Crop/align image_gen originals onto the same native grid as animated bodies.
// Anatomical registration moves authored gear; it never draws replacement art.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { ITEMS } from "../site/data.js";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
const receipts = await json("art/equipment-generation-receipts.json");
for (const f of await readdir("/tmp"))
  if (/^leaftale-gear-.*\.json$/.test(f)) {
    const r = await json("/tmp/" + f);
    if (!r.classId) continue;
    receipts.sources = receipts.sources.filter((s) => s.id !== r.id);
    receipts.sources.push(r);
  }
const animations = {
  idle: [24, 25, 26, 27, 28, 29, 30, 31],
  walk: [16, 17, 18, 19, 20, 21, 22, 23],
  windup: [8, 9, 10],
  attack: [11, 12],
  recover: [13, 2],
  hurt: [14],
  death: [15],
};
const mapCell = (row, col) =>
  row < 8 ? { row, col } : { row: row - 8, col: col + 16 };
const crop = (src, r) => {
  const out = rgba(r.sw, r.sh);
  for (let y = 0; y < r.sh; y++)
    for (let x = 0; x < r.sw; x++) {
      const at = ((r.sy + y) * src.width + r.sx + x) * 4,
        to = (y * r.sw + x) * 4;
      src.data.copy(out.data, to, at, at + 4);
    }
  return out;
};
const bounds = (img) => {
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3] >= 220) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return x1 < 0 ? null : { sx: x0, sy: y0, sw: x1 - x0 + 1, sh: y1 - y0 + 1 };
};
async function register(file, image, source, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  await png(image, target);
  records.assets = records.assets.filter((r) => r.id !== file);
  records.assets.push({
    id: file,
    target,
    tool: "image_gen",
    source,
    width: image.width,
    height: image.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    appearanceVersion: 1,
    ...extra,
  });
  if (!art.files.includes(file)) art.files.push(file);
}
art.appearance ||= { version: 1, bases: {}, items: {} };
const bodies = new Map();
const warden = decode("/tmp/leaftale-equipment/warden-base.png");
bodies.set("warden", warden);
await register(
  "appearance/base/warden",
  warden,
  receipts.sources.find((s) => s.id === "base-warden-combat").path,
  {
    additionalSources: receipts.sources
      .filter((s) => s.id.startsWith("base-warden-") && s.kind !== "combat")
      .map((s) => s.path),
  },
);
art.appearance.bases.warden = {
  file: "appearance/base/warden",
  size: 96,
  cols: 32,
  rows: 8,
  animations,
};
for (const e of receipts.sources.filter((s) => s.kind === "base")) {
  const src = decode(e.path);
  for (let i = 3; i < src.data.length; i += 4)
    if (src.data[i] < 220) src.data[i] = 0;
  const grid = directionalRects(src, 16),
    atlas = rgba(3072, 768),
    guide = rgba(1536, 1536);
  for (let row = 0; row < 16; row++) {
    const median = grid[row]
      .slice(0, 8)
      .map((r) => r.sh)
      .sort((a, b) => a - b)[4];
    const scale = Math.min(
      76 / median,
      ...grid[row].map((r) => 88 / Math.max(r.sw, r.sh)),
    );
    for (let col = 0; col < 16; col++) {
      const r = grid[row][col],
        w = Math.round(r.sw * scale),
        h = Math.round(r.sh * scale),
        cell = rgba(96, 96);
      blit(
        sampleNearest(crop(src, r), { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        cell,
        Math.round((96 - w) / 2),
        92 - h,
      );
      const to = mapCell(row, col);
      blit(cell, atlas, to.col * 96, to.row * 96);
      blit(cell, guide, col * 96, row * 96);
    }
  }
  const file = "appearance/base/" + e.classId;
  await register(file, atlas, e.path);
  bodies.set(e.classId, atlas);
  art.appearance.bases[e.classId] = {
    file,
    size: 96,
    cols: 32,
    rows: 8,
    animations,
  };
  await png(guide, "art/equipment-guides/" + e.classId + ".png");
}
// Anchors are measured from the authored neutral body. The gear remains a
// separate fitted item, following its own heading and per-pose drawing.
function anatomy(body, col, row) {
  const cell = crop(body, { sx: col * 96, sy: row * 96, sw: 96, sh: 96 }),
    b = bounds(cell);
  const skin = [];
  for (let y = 45; y < 91; y++)
    for (let x = 10; x < 86; x++) {
      const at = (y * 96 + x) * 4,
        [r, g, blue, a] = cell.data.subarray(at, at + 4);
      if (
        a &&
        r > 150 &&
        g > 75 &&
        g < 205 &&
        blue < 155 &&
        r > g * 1.12 &&
        g > blue * 1.08
      )
        skin.push({ x, y });
    }
  const right = skin.filter((p) => p.x >= 62 && p.y < 81);
  const left = skin.filter((p) => p.x <= 34 && p.y < 81);
  const points = row >= 3 && row <= 6 ? left : right;
  const hand = points.length
    ? {
        x: points.reduce((a, p) => a + p.x, 0) / points.length,
        y: points.reduce((a, p) => a + p.y, 0) / points.length,
      }
    : { x: row >= 3 && row <= 6 ? 28 : 68, y: 68 };
  return { b, hand, cx: b.sx + b.sw / 2, top: b.sy, bottom: b.sy + b.sh };
}
if (!process.argv.includes("--bases"))
  for (const e of receipts.sources.filter((s) => s.kind === "equipment")) {
    const body = bodies.get(e.classId);
    if (!body) continue;
    const src = decode(e.path),
      atlas = rgba(3072, 768),
      item = ITEMS[e.item];
    for (let i = 3; i < src.data.length; i += 4)
      if (src.data[i] < 220) src.data[i] = 0;
    let nonempty = 0;
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 16; col++) {
        const x0 = Math.round((col * src.width) / 16),
          y0 = Math.round((row * src.height) / 16),
          x1 = Math.round(((col + 1) * src.width) / 16),
          y1 = Math.round(((row + 1) * src.height) / 16);
        const cell = crop(src, { sx: x0, sy: y0, sw: x1 - x0, sh: y1 - y0 }),
          b = bounds(cell);
        if (!b) continue;
        const to = mapCell(row, col),
          a = anatomy(body, to.col, to.row);
        let w, h, x, y;
        if (item.slot === "weapon") {
          const length =
            item.weapon === "wand" ? 37 : item.weapon === "bow" ? 56 : 70;
          const scale = Math.min(
            length / Math.max(b.sw, b.sh),
            80 / b.sw,
            80 / b.sh,
          );
          w = Math.max(1, Math.round(b.sw * scale));
          h = Math.max(1, Math.round(b.sh * scale));
          x = Math.round(a.hand.x - w * 0.5);
          y = Math.round(a.hand.y - h * 0.7);
        } else if (item.slot === "head") {
          w = Math.min(68, Math.round(a.b.sw * 1.12));
          h = Math.max(8, Math.round((w * b.sh) / b.sw));
          if (h > 40) {
            w = Math.round((w * 40) / h);
            h = 40;
          }
          x = Math.round(a.cx - w / 2);
          y = a.top - 2;
        } else if (item.slot === "armor") {
          h = 27;
          w = Math.min(60, Math.max(20, Math.round((h * b.sw) / b.sh)));
          x = Math.round(a.cx - w / 2);
          y = a.bottom - 34;
        } else if (item.slot === "boots") {
          w = to.col === 15 ? 34 : Math.min(46, Math.max(22, a.b.sw * 0.65));
          h = Math.min(22, Math.round((w * b.sh) / b.sw));
          w = Math.round(w);
          x = Math.round(a.cx - w / 2);
          y = a.bottom - h;
        } else {
          const ring = item.id === "charm2";
          h = ring ? 7 : 14;
          w = Math.max(
            3,
            Math.min(ring ? 9 : 17, Math.round((h * b.sw) / b.sh)),
          );
          x = Math.round((ring ? a.hand.x : a.cx) - w / 2);
          y = Math.round((ring ? a.hand.y : a.bottom - 25) - h / 2);
        }
        // Keep every authored pose inside its cell. No adjacent-cell bleed.
        const fit = Math.min(1, 88 / w, 88 / h);
        w = Math.max(1, Math.round(w * fit));
        h = Math.max(1, Math.round(h * fit));
        x = Math.max(4, Math.min(92 - w, x));
        y = Math.max(4, Math.min(92 - h, y));
        const sampled = sampleNearest(cell, b, w, h);
        if (
          item.slot === "head" &&
          to.row >= 2 &&
          to.row <= 6 &&
          to.col !== 15
        ) {
          // Hair/skin in the source body are authoritative. A hood's dark lining
          // must not paint over the eyes or replace the face with an opaque opening.
          const visible = new Set();
          for (let by = a.top + 25; by < Math.min(65, a.top + 47); by++)
            for (let bx = 10; bx < 86; bx++) {
              const at =
                ((to.row * 96 + by) * body.width + to.col * 96 + bx) * 4;
              const [r, g, blue, alpha] = body.data.subarray(at, at + 4);
              if (
                alpha &&
                r > 190 &&
                g > 125 &&
                blue > 75 &&
                r > g * 1.06 &&
                r > blue * 1.18
              )
                for (let dy = -2; dy <= 2; dy++)
                  for (let dx = -2; dx <= 2; dx++)
                    visible.add((by + dy) * 96 + bx + dx);
            }
          for (let yy = 0; yy < h; yy++)
            for (let xx = 0; xx < w; xx++)
              if (visible.has((y + yy) * 96 + x + xx))
                sampled.data[(yy * w + xx) * 4 + 3] = 0;
        }
        blit(sampled, atlas, to.col * 96 + x, to.row * 96 + y);
        nonempty++;
      }
    if (nonempty < 240)
      throw Error(e.id + " missing equipment poses: " + nonempty + "/256");
    const file = "appearance/gear/" + e.id;
    await register(file, atlas, e.path, {
      item: e.item,
      classId: e.classId,
      registration: {
        method: "anatomical-body-registration",
        poses: nonempty,
        cols: 32,
        rows: 8,
        size: 96,
      },
    });
    art.appearance.items[e.item] ||= {};
    const order = { boots: 10, armor: 20, head: 30, charm: 40, weapon: 50 }[
      item.slot
    ];
    art.appearance.items[e.item][e.classId] = { layers: [{ file, order }] };
  }
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
await writeFile(
  "art/equipment-generation-receipts.json",
  JSON.stringify(receipts, null, 2) + "\n",
);
const plan = await json("art/equipment-appearance-plan.json");
const jobs = [...plan.sources, ...plan.pending];
plan.sources = jobs
  .filter((j) =>
    j.kind === "base"
      ? !!art.appearance.bases[j.classId]
      : !!art.appearance.items[j.item]?.[j.classId],
  )
  .map((j) => ({
    ...j,
    sources: receipts.sources
      .filter((s) => s.id === j.id || s.id.startsWith(j.id + "-"))
      .map((s) => s.path),
  }));
plan.pending = jobs.filter((j) => !plan.sources.some((s) => s.id === j.id));
plan.updatedAt = new Date().toISOString();
plan.status = plan.pending.length ? "generating" : "complete";
delete plan.blocker;
await writeFile(
  "art/equipment-appearance-plan.json",
  JSON.stringify(plan, null, 2) + "\n",
);
console.log(
  "Appearance: " +
    Object.keys(art.appearance.bases).length +
    " bases; " +
    Object.values(art.appearance.items).reduce(
      (a, v) => a + Object.keys(v).length,
      0,
    ) +
    "/48 fitted item layers; " +
    plan.pending.length +
    " targets pending",
);
