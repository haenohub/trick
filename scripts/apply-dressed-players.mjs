import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { combatRowCuts } from "./combat-grid.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8")),
  art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
const crop = (src, x, y, w, h) => {
  const out = rgba(w, h);
  for (let r = 0; r < h; r++)
    src.data.copy(
      out.data,
      r * w * 4,
      ((y + r) * src.width + x) * 4,
      ((y + r) * src.width + x + w) * 4,
    );
  return out;
};
function bounds(im) {
  let sx = im.width,
    sy = im.height,
    ex = 0,
    ey = 0,
    cx = 0,
    n = 0;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++)
      if (im.data[(y * im.width + x) * 4 + 3]) {
        sx = Math.min(sx, x);
        sy = Math.min(sy, y);
        ex = Math.max(ex, x);
        ey = Math.max(ey, y);
        cx += x;
        n++;
      }
  return { sx, sy, sw: ex - sx + 1, sh: ey - sy + 1, cx: cx / n };
}
const skin = ([r, g, b, a]) =>
  a && r > 150 && g > 75 && b < 205 && r > g * 1.08 && g > b * 1.04;
function anchor(frame, dir, col) {
  const b = bounds(frame),
    cx = b.cx,
    positive = !(dir >= 3 && dir <= 6),
    torso = { x: cx, y: b.sy + b.sh * 0.63 },
    points = [];
  for (let y = b.sy + 20; y < b.sy + b.sh - 14; y++)
    for (let x = 4; x < 92; x++) {
      const at = (y * 96 + x) * 4;
      if (!skin(frame.data.subarray(at, at + 4))) continue;
      if (y < b.sy + 43 && Math.abs(x - cx) < 20) continue;
      if (positive ? x < cx + 9 : x > cx - 9) continue;
      points.push({ x, y, d: Math.hypot(x - torso.x, y - torso.y) });
    }
  points.sort((a, b) => b.d - a.d);
  const tip = points.slice(0, Math.max(1, Math.ceil(points.length * 0.25)));
  let hand = tip.length
    ? [
        Math.round(tip.reduce((s, p) => s + p.x, 0) / tip.length),
        Math.round(tip.reduce((s, p) => s + p.y, 0) / tip.length),
      ]
    : [Math.round(cx + (positive ? 21 : -21)), Math.round(b.sy + b.sh - 24)];
  // Ensure the pivot lies ON the authored body, even when the far palm is
  // partially occluded. A weapon must never hover beside a guessed hand.
  let closest = null;
  for (let y = Math.max(4, hand[1] - 12); y < Math.min(92, hand[1] + 13); y++)
    for (
      let x = Math.max(4, hand[0] - 12);
      x < Math.min(92, hand[0] + 13);
      x++
    ) {
      const at = (y * 96 + x) * 4;
      if (!skin(frame.data.subarray(at, at + 4))) continue;
      const d = Math.hypot(x - hand[0], y - hand[1]);
      if (!closest || d < closest.d) closest = { x, y, d };
    }
  if (!closest)
    for (let y = b.sy + 35; y < b.sy + b.sh - 14; y++)
      for (let x = 4; x < 92; x++) {
        const at = (y * 96 + x) * 4;
        if (!skin(frame.data.subarray(at, at + 4))) continue;
        const d = Math.hypot(x - hand[0], y - hand[1]);
        if (!closest || d < closest.d) closest = { x, y, d };
      }
  if (closest) hand = [closest.x, closest.y];
  return {
    hand,
    angle:
      col >= 16 && col < 24 ? Math.sin(((col - 16) * Math.PI) / 4) * 0.035 : 0,
    head: [Math.round(cx), b.sy + 22],
    torso: [Math.round(cx), Math.round(torso.y)],
    feet: [Math.round(cx), b.sy + b.sh - 6],
  };
}
async function register(file, img, sources) {
  const target = "site/assets/" + file + ".png";
  await png(img, target);
  const r = records.assets.find((r) => r.id === file);
  Object.assign(r, {
    source: sources[0],
    additionalSources: sources.slice(1),
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    clothedBody: true,
  });
}
const hurt = await json("art/dressed-hurt.json"),
  hurtSrc = decode(hurt.source);
for (let i = 3; i < hurtSrc.data.length; i += 4)
  if (hurtSrc.data[i] < 220) hurtSrc.data[i] = 0;
const hurtGrid = directionalRects(hurtSrc, 8, 4, { minArea: 0.025 });
const sources = [hurt];
for (const id of ["warden", "mage", "ranger", "herbalist"]) {
  const body = rgba(3072, 768),
    jobs = [];
  for (const motion of ["combat", "walk", "idle"]) {
    const job = await json(`art/dressed-${id}-${motion}.json`);
    sources.push(job);
    jobs.push(job);
    const src = decode(job.source);
    for (let i = 3; i < src.data.length; i += 4)
      if (src.data[i] < 220) src.data[i] = 0;
    const grid = directionalRects(src, 8, 8, {
        ys: combatRowCuts(src),
        minArea: 0.025,
      }),
      sizes = grid
        .flat()
        .map((r) => r.sh)
        .sort((a, b) => a - b),
      scale = Math.min(
        78 / sizes[32],
        ...grid.flat().map((r) => 88 / Math.max(r.sw, r.sh)),
      ),
      atlas = rgba(768, 768);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++) {
        const r = grid[row][col],
          cut = rgba(r.sw, r.sh);
        for (const part of r.components)
          for (let y = part.minY; y <= part.maxY; y++)
            for (let x = part.minX; x <= part.maxX; x++) {
              const a = (y * src.width + x) * 4,
                b = ((y - r.sy) * r.sw + x - r.sx) * 4;
              src.data.copy(cut.data, b, a, a + 4);
            }
        const w = Math.max(1, Math.round(r.sw * scale)),
          h = Math.max(1, Math.round(r.sh * scale)),
          frame = sampleNearest(
            cut,
            { sx: 0, sy: 0, sw: r.sw, sh: r.sh },
            w,
            h,
          );
        blit(
          frame,
          atlas,
          col * 96 + Math.round((96 - w) / 2),
          row * 96 + 92 - h,
        );
      }
    const offset = { combat: 0, walk: 16, idle: 24 }[motion];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        blit(
          crop(atlas, c * 96, r * 96, 96, 96),
          body,
          (offset + c) * 96,
          r * 96,
        );
    if (motion === "combat") {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          blit(crop(atlas, c * 96, r * 96, 96, 96), body, (8 + c) * 96, r * 96);
      await register("combat/" + id, atlas, [job.source]);
    } else await register(`locomotion/${id}-${motion}`, atlas, [job.source]);
  }
  const hurtRow = ["warden", "mage", "ranger", "herbalist"].indexOf(id);
  for (let dir = 0; dir < 8; dir++) {
    const r = hurtGrid[hurtRow][dir],
      cell = rgba(96, 96),
      scale = Math.min(78 / r.sh, 88 / r.sw),
      w = Math.max(1, Math.round(r.sw * scale)),
      h = Math.max(1, Math.round(r.sh * scale)),
      cut = rgba(r.sw, r.sh);
    for (const part of r.components)
      for (let y = part.minY; y <= part.maxY; y++)
        for (let x = part.minX; x <= part.maxX; x++) {
          const a = (y * hurtSrc.width + x) * 4,
            b = ((y - r.sy) * r.sw + x - r.sx) * 4;
          hurtSrc.data.copy(cut.data, b, a, a + 4);
        }
    blit(
      sampleNearest(cut, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
      cell,
      Math.round((96 - w) / 2),
      92 - h,
    );
    blit(cell, body, 7 * 96, dir * 96);
    blit(cell, body, 15 * 96, dir * 96);
  }
  const combat = rgba(768, 768);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      blit(crop(body, c * 96, r * 96, 96, 96), combat, c * 96, r * 96);
  await register("combat/" + id, combat, [jobs[0].source, hurt.source]);
  jobs.push(hurt);
  const l = art.appearance.bases[id];
  delete l.costumeFile;
  l.clothedBody = true;
  l.anchors = Array.from({ length: 8 }, (_, r) =>
    Array.from({ length: 32 }, (_, c) =>
      anchor(crop(body, c * 96, r * 96, 96, 96), r, c),
    ),
  );
  const hands = rgba(3072, 768);
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 32; c++) {
      const a = l.anchors[r][c].hand;
      for (let y = Math.max(4, a[1] - 4); y < Math.min(92, a[1] + 5); y++)
        for (let x = Math.max(4, a[0] - 4); x < Math.min(92, a[0] + 5); x++) {
          const at = ((r * 96 + y) * body.width + c * 96 + x) * 4;
          if (skin(body.data.subarray(at, at + 4)))
            body.data.copy(hands.data, at, at, at + 4);
        }
    }
  await register(
    l.file,
    body,
    jobs.map((j) => j.source),
  );
  await register(
    l.handFile,
    hands,
    jobs.map((j) => j.source),
  );
}
art.appearance.mode = "integrated-clothed-body-with-equipped-weapon";
await writeFile(
  "art/dressed-players.json",
  JSON.stringify({ status: "complete", tool: "image_gen", sources }, null, 2) +
    "\n",
);
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
