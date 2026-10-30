// Technical isolation, planted-foot alignment and measured palm registration.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8")),
  plan = await json("art/diagonal-walk-v25.json"),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
const marker = (r, g, b, a) =>
    a >= 220 && r > 120 && b > 90 && g < 100 && g < r * 0.65 && g < b * 0.8,
  median = (a) => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
function crop(src, x, y, w, h) {
  const o = rgba(w, h);
  for (let yy = 0; yy < h; yy++)
    src.data.copy(
      o.data,
      yy * w * 4,
      ((y + yy) * src.width + x) * 4,
      ((y + yy) * src.width + x + w) * 4,
    );
  return o;
}
async function save(file, image, job, replace = false) {
  const target = "site/assets/" + file + ".png";
  await png(image, target);
  const r = records.assets.find((a) => a.id === file);
  r.additionalSources = [
    ...new Set([r.source, ...(r.additionalSources || []), job.source]),
  ].filter((s) => s !== (replace ? job.source : r.source));
  if (replace) r.source = job.source;
  r.sha256 = createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
  r.diagonalWalkVersion = 1;
}
for (const job of plan.sources) {
  const src = decode(job.source),
    marks = [];
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const a = (y * src.width + x) * 4,
        [r, g, b, alpha] = src.data.subarray(a, a + 4);
      if (marker(r, g, b, alpha)) marks.push({ x, y });
      else if (
        alpha < 220 ||
        (r > 220 && g < 40 && b < 85) ||
        (b > 230 && r < 30 && g < 30)
      )
        src.data[a + 3] = 0;
    }
  const original = Buffer.from(src.data);
  for (const p of marks) {
    let best = null;
    for (let dy = -6; dy <= 6; dy++)
      for (let dx = -6; dx <= 6; dx++) {
        const x = p.x + dx,
          y = p.y + dy;
        if (x < 0 || y < 0 || x >= src.width || y >= src.height) continue;
        const at = (y * src.width + x) * 4,
          [r, g, b, a] = original.subarray(at, at + 4);
        if (a < 220 || marker(r, g, b, a)) continue;
        const score = Math.hypot(dx, dy) + (r > 130 && g > 70 && r > b ? 0 : 8);
        if (!best || score < best.score) best = { at, score };
      }
    if (best)
      original.copy(
        src.data,
        (p.y * src.width + p.x) * 4,
        best.at,
        best.at + 4,
      );
  }
  const grid = directionalRects(src, 8, 4, { minArea: 0.025 }),
    l = art.appearance.bases[job.id],
    body = decode("site/assets/" + l.file + ".png"),
    walk = decode("site/assets/locomotion/" + job.id + "-walk.png");
  const heights = job.destinationRows.map((d) => {
    let lo = 96,
      hi = 0;
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 96; x++)
        if (body.data[((d * 96 + y) * body.width + 24 * 96 + x) * 4 + 3]) {
          lo = Math.min(lo, y);
          hi = Math.max(hi, y);
        }
    return hi - lo + 1;
  });
  const scale = Math.min(
    median(heights) / median(grid.flat().map((r) => r.sh)),
    ...grid.flat().map((r) => 88 / Math.max(r.sw, r.sh)),
  );
  job.registration = [];
  for (let row = 0; row < 4; row++)
    for (let f = 0; f < 8; f++) {
      const r = grid[row][f],
        dir = job.destinationRows[row],
        im = crop(src, r.sx, r.sy, r.sw, r.sh),
        w = Math.round(r.sw * scale),
        h = Math.round(r.sh * scale),
        feet = [];
      for (let y = r.sh - 5; y < r.sh; y++)
        for (let x = 0; x < r.sw; x++)
          if (im.data[(y * r.sw + x) * 4 + 3]) feet.push(x);
      const left = Math.max(
          4,
          Math.min(
            92 - w,
            Math.round(48 - (feet.length ? median(feet) : r.sw / 2) * scale),
          ),
        ),
        top = 92 - h,
        frame = rgba(96, 96);
      blit(
        sampleNearest(im, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        frame,
        left,
        top,
      );
      const palm = marks.filter(
        (p) =>
          p.x >= r.sx &&
          p.x < r.sx + r.sw &&
          p.y > r.sy + r.sh * 0.35 &&
          p.y < r.sy + r.sh,
      );
      const goal = palm.length
        ? [
            left + (median(palm.map((p) => p.x)) - r.sx) * scale,
            top + (median(palm.map((p) => p.y)) - r.sy) * scale,
          ]
        : l.anchors[dir][16 + f].hand;
      let nearest = null;
      for (
        let y = Math.floor(goal[1]) - (palm.length ? 3 : 12);
        y <= Math.ceil(goal[1]) + (palm.length ? 3 : 12);
        y++
      )
        for (
          let x = Math.floor(goal[0]) - (palm.length ? 3 : 12);
          x <= Math.ceil(goal[0]) + (palm.length ? 3 : 12);
          x++
        )
          if (
            x >= 4 &&
            y >= 4 &&
            x < 92 &&
            y < 92 &&
            frame.data[(y * 96 + x) * 4 + 3]
          ) {
            const dist = Math.hypot(x - goal[0], y - goal[1]);
            if (!nearest || dist < nearest.dist) nearest = { x, y, dist };
          }
      if (!nearest) throw Error("Palm outside sprite");
      const hand = [nearest.x, nearest.y];
      l.anchors[dir][16 + f] = {
        ...l.anchors[dir][16 + f],
        hand,
        measured: true,
        calibration: palm.length ? "authored-palm-marker" : "visible-palm",
      };
      for (const [target, col] of [
        [body, 16 + f],
        [walk, f],
      ]) {
        for (let y = 0; y < 96; y++)
          target.data.fill(
            0,
            ((dir * 96 + y) * target.width + col * 96) * 4,
            ((dir * 96 + y) * target.width + (col + 1) * 96) * 4,
          );
        blit(frame, target, col * 96, dir * 96);
      }
      job.registration.push({
        direction: job.directions[row],
        row: dir,
        frame: f,
        hand,
        source: [r.sx, r.sy, r.sw, r.sh],
        scale,
      });
    }
  const hands = rgba(3072, 768);
  for (let d = 0; d < 8; d++)
    for (let f = 0; f < 32; f++) {
      const [hx, hy] = l.anchors[d][f].hand;
      for (let y = hy - 2; y <= hy + 2; y++)
        for (let x = hx - 2; x <= hx + 2; x++)
          if (
            x >= 4 &&
            y >= 4 &&
            x < 92 &&
            y < 92 &&
            Math.hypot(x - hx, y - hy) <= 2.25
          ) {
            const a = ((d * 96 + y) * body.width + f * 96 + x) * 4;
            body.data.copy(hands.data, a, a, a + 4);
          }
    }
  await save(l.file, body, job);
  await save(l.handFile, hands, job);
  await save("locomotion/" + job.id + "-walk", walk, job, true);
  l.diagonalWalkVersion = 1;
  art.characterLayouts[job.id].diagonalWalkVersion = 1;
}
plan.status = "complete";
await writeFile(
  "art/diagonal-walk-v25.json",
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
