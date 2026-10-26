// Technical isolation, registration and rigging of image_gen-authored sprites.
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { combatRowCuts } from "./combat-grid.mjs";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
async function recordSources(file, prefix) {
  const p = await json(file);
  for (const n of await readdir("/tmp"))
    if (n.startsWith(prefix) && n.endsWith(".json")) {
      const r = await json("/tmp/" + n),
        job = [...p.sources, ...p.pending].find((j) => j.id === r.id);
      if (!job) continue;
      p.sources = p.sources.filter((s) => s.id !== r.id);
      p.sources.push({ ...job, source: r.path });
      p.pending = p.pending.filter((s) => s.id !== r.id);
    }
  p.status = p.pending.length ? "generating" : "complete";
  await writeFile(file, JSON.stringify(p, null, 2) + "\n");
  return p;
}
const plan = await recordSources(
    "art/combat-cycles.json",
    "leaftale-combat-combat-",
  ),
  weapons = await recordSources("art/held-weapons.json", "leaftale-held-held-");
if (plan.pending.length || weapons.pending.length)
  throw Error(
    "Still generating: " +
      plan.pending.length +
      " combat and " +
      weapons.pending.length +
      " weapon sheets",
  );
const art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json");
async function register(file, img, sources, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  await png(img, target);
  const old = records.assets.find((r) => r.id === file);
  records.assets = records.assets.filter((r) => r.id !== file);
  records.assets.push({
    ...old,
    id: file,
    target,
    tool: "image_gen",
    source: sources[0],
    additionalSources: [...new Set(sources.slice(1))],
    width: img.width,
    height: img.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    ...extra,
  });
  if (!art.files.includes(file)) art.files.push(file);
}
const crop = (src, x, y, w, h) => {
  const out = rgba(w, h);
  for (let row = 0; row < h; row++)
    src.data.copy(
      out.data,
      row * w * 4,
      ((y + row) * src.width + x) * 4,
      ((y + row) * src.width + x + w) * 4,
    );
  return out;
};
function bounds(img) {
  let x0 = img.width,
    y0 = img.height,
    x1 = -1,
    y1 = -1,
    cx = 0,
    cy = 0,
    n = 0;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if (img.data[(y * img.width + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
        cx += x;
        cy += y;
        n++;
      }
  return {
    sx: x0,
    sy: y0,
    sw: x1 - x0 + 1,
    sh: y1 - y0 + 1,
    cx: cx / n,
    cy: cy / n,
  };
}
const median = (a) => a.toSorted((x, y) => x - y)[Math.floor(a.length / 2)];
const packed = new Map(),
  bodies = new Map(),
  oldBodies = new Map();
for (const [id, l] of Object.entries(art.appearance.bases)) {
  const body = decode("site/assets/" + l.file + ".png");
  bodies.set(id, body);
  oldBodies.set(id, { ...body, data: Buffer.from(body.data) });
}
for (const e of plan.sources) {
  const src = decode(e.source);
  for (let i = 3; i < src.data.length; i += 4)
    if (src.data[i] < 220) src.data[i] = 0;
  const rects = directionalRects(src, 8, 8, {
    ys: combatRowCuts(src),
    minArea: 0.025,
  });
  for (const a of e.actors) {
    const layout =
        a.kind === "character"
          ? art.characterLayouts[a.id]
          : art.monsters[a.id],
      size = a.size;
    let reference =
      a.kind === "character"
        ? crop(oldBodies.get(a.id), 24 * 96, e.directionRow * 96, 96, 96)
        : decode("site/assets/" + layout.views[e.direction] + ".png");
    const ref = bounds(reference),
      row = rects[a.sourceRow],
      scale = Math.min(
        ref.sh / median(row.slice(0, 7).map((r) => r.sh)),
        ...row.map((r) => (size - 8) / Math.max(r.sw, r.sh)),
      );
    if (!packed.has(a.id))
      packed.set(a.id, {
        ...a,
        layout,
        image: rgba(size * 8, size * 8),
        sources: [],
        directions: [],
      });
    const out = packed.get(a.id);
    out.sources.push(e.source);
    out.directions.push(e.direction);
    for (let col = 0; col < 8; col++) {
      const r = row[col],
        cut = rgba(r.sw, r.sh);
      for (const part of r.components)
        for (let y = part.minY; y <= part.maxY; y++)
          for (let x = part.minX; x <= part.maxX; x++) {
            const at = (y * src.width + x) * 4,
              to = ((y - r.sy) * r.sw + x - r.sx) * 4;
            src.data.copy(cut.data, to, at, at + 4);
          }
      const w = Math.max(1, Math.round(r.sw * scale)),
        h = Math.max(1, Math.round(r.sh * scale)),
        frame = sampleNearest(cut, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        b = bounds(frame),
        x = Math.max(4, Math.min(size - 4 - w, Math.round(ref.cx - b.cx))),
        y = size - 4 - h;
      blit(frame, out.image, col * size + x, e.directionRow * size + y);
    }
  }
  console.log("isolated " + e.id);
}
const phaseFrames = {
  windup: [0, 1, 2],
  attack: [3, 4],
  recover: [5, 6],
  hurt: [7],
  combo: [0, 1, 2, 3, 4, 5, 6],
};
for (const [id, a] of packed) {
  if (a.directions.length !== 8) throw Error(id + " missing headings");
  const file = "combat/" + id;
  await register(file, a.image, a.sources, {
    combatVersion: 1,
    cols: 8,
    rows: 8,
    size: a.size,
    registration: {
      method: "isolated-per-cell",
      gutters: 4,
      directions: a.directions,
    },
  });
  for (const [anim, frames] of Object.entries(phaseFrames))
    a.layout.clips[anim] = {
      file,
      size: a.size,
      cols: 8,
      rows: 8,
      frames,
      loop: false,
      ...(anim === "combo" ? { duration: 0.56 } : {}),
    };
  if (a.kind === "character") {
    const body = bodies.get(id);
    for (let row = 0; row < 8; row++)
      for (let col = 0; col < 8; col++)
        blit(
          crop(a.image, col * 96, row * 96, 96, 96),
          body,
          col * 96,
          row * 96,
        );
    Object.assign(art.appearance.bases[id].animations, phaseFrames);
  }
}
// One genuinely authored view for each of16 weapons in each of8 directions.
const weaponAtlas = rgba(96 * 8, 96 * 16),
  definitions = {};
for (const e of weapons.sources) {
  const src = decode(e.source);
  for (const item of e.weapons) {
    const column = item.index % 4,
      row = Math.floor(item.index / 4),
      x0 = Math.floor((column * src.width) / 4),
      y0 = Math.floor((row * src.height) / 4),
      w = Math.floor(((column + 1) * src.width) / 4) - x0,
      h = Math.floor(((row + 1) * src.height) / 4) - y0,
      cell = crop(src, x0, y0, w, h),
      markers = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const at = (y * w + x) * 4,
          [r, g, b, alpha] = cell.data.subarray(at, at + 4);
        if (r > 225 && b > 180 && g < 75 && alpha > 180) {
          markers.push({ x, y });
          cell.data[at + 3] = 0;
        } else if (alpha < 220) cell.data[at + 3] = 0;
      }
    // The authored marker is measured in source coordinates, not guessed from
    // the bounding box of an inventory icon. It is removed from shipped pixels.
    const near = markers.filter(
        (p) =>
          Math.abs(p.x / w - 0.5) < 0.25 && Math.abs(p.y / h - 0.6875) < 0.3,
      ),
      grip = near.length
        ? { x: median(near.map((p) => p.x)), y: median(near.map((p) => p.y)) }
        : { x: w * 0.5, y: h * 0.6875 };
    const frame = sampleNearest(cell, { sx: 0, sy: 0, sw: w, sh: h }, 96, 96);
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 96; x++)
        if (x < 4 || y < 4 || x >= 92 || y >= 92)
          frame.data.fill(0, (y * 96 + x) * 4, (y * 96 + x + 1) * 4);
    blit(frame, weaponAtlas, e.directionRow * 96, item.index * 96);
    definitions[item.id] ||= {
      file: "appearance/held-weapons",
      size: 96,
      cols: 8,
      rows: 16,
      index: item.index,
      kind: item.weapon,
      grips: Array(8),
      axes: Array(8),
      measured: Array(8),
    };
    const pivot = [
        Math.round((grip.x / w) * 96),
        Math.round((grip.y / h) * 96),
      ],
      tips = [];
    for (let y = 4; y < pivot[1] - 10; y++)
      for (let x = 4; x < 92; x++)
        if (frame.data[(y * 96 + x) * 4 + 3])
          tips.push({ x, y, d: Math.hypot(x - pivot[0], y - pivot[1]) });
    tips.sort((a, b) => b.d - a.d);
    const tip = tips.slice(0, 5),
      tx = tip.length
        ? tip.reduce((s, p) => s + p.x, 0) / tip.length
        : pivot[0],
      ty = tip.length
        ? tip.reduce((s, p) => s + p.y, 0) / tip.length
        : pivot[1] - 20;
    definitions[item.id].grips[e.directionRow] = pivot;
    definitions[item.id].axes[e.directionRow] = Math.atan2(
      tx - pivot[0],
      pivot[1] - ty,
    );
    definitions[item.id].measured[e.directionRow] = near.length > 0;
  }
}
await register(
  "appearance/held-weapons",
  weaponAtlas,
  weapons.sources.map((e) => e.source),
  { rigVersion: 1, cols: 8, rows: 16, size: 96 },
);
art.appearance.weapons = definitions;
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
for (const [id, body] of bodies) {
  const l = art.appearance.bases[id],
    anchors = Array.from({ length: 8 }, (_, row) =>
      Array.from({ length: 32 }, (_, col) =>
        anchor(crop(body, col * 96, row * 96, 96, 96), row, col),
      ),
    ),
    hands = rgba(body.width, body.height);
  for (let row = 0; row < 8; row++)
    for (let col = 0; col < 32; col++) {
      const a = anchors[row][col],
        frame = crop(body, col * 96, row * 96, 96, 96);
      for (
        let y = Math.max(4, a.hand[1] - 4);
        y < Math.min(92, a.hand[1] + 5);
        y++
      )
        for (
          let x = Math.max(4, a.hand[0] - 4);
          x < Math.min(92, a.hand[0] + 5);
          x++
        ) {
          const at = (y * 96 + x) * 4;
          if (skin(frame.data.subarray(at, at + 4)))
            frame.data.copy(
              hands.data,
              ((row * 96 + y) * body.width + col * 96 + x) * 4,
              at,
              at + 4,
            );
        }
    }
  l.anchors = anchors;
  l.handFile = "appearance/hands/" + id;
  const sources = packed.get(id).sources;
  await register(
    l.file,
    body,
    [records.assets.find((r) => r.id === l.file).source, ...sources],
    { rigVersion: 1 },
  );
  await register(l.handFile, hands, sources, {
    rigVersion: 1,
    cols: 32,
    rows: 8,
    size: 96,
  });
  // Register rigid clothing to the same measured head/torso/foot joints. The
  // source garment's actual pixels are moved, never replaced by drawn shapes.
  for (const [item, byClass] of Object.entries(art.appearance.items)) {
    const def = byClass[id];
    if (!def || definitions[item]) continue;
    for (const layer of def.layers) {
      const img = decode("site/assets/" + layer.file + ".png");
      for (let row = 0; row < 8; row++) {
        const reference = crop(img, 24 * 96, row * 96, 96, 96),
          original = anchor(
            crop(oldBodies.get(id), 24 * 96, row * 96, 96, 96),
            row,
            24,
          );
        for (let col = 0; col < 8; col++) {
          const joint = item.startsWith("hood")
              ? "head"
              : item.startsWith("boots")
                ? "feet"
                : item === "charm2"
                  ? "hand"
                  : "torso",
            dx = anchors[row][col][joint][0] - original[joint][0],
            dy = anchors[row][col][joint][1] - original[joint][1];
          for (let y = 0; y < 96; y++)
            for (let x = 0; x < 96; x++) {
              const tx = x + dx,
                ty = y + dy,
                to = ((row * 96 + y) * img.width + col * 96 + x) * 4;
              img.data.fill(0, to, to + 4);
              if (
                x - dx >= 4 &&
                x - dx < 92 &&
                y - dy >= 4 &&
                y - dy < 92 &&
                x >= 4 &&
                x < 92 &&
                y >= 4 &&
                y < 92
              ) {
                const at = ((y - dy) * 96 + x - dx) * 4;
                reference.data.copy(img.data, to, at, at + 4);
              }
            }
        }
      }
      const record = records.assets.find((r) => r.id === layer.file);
      await register(layer.file, img, [record.source, ...sources], {
        rigVersion: 1,
      });
    }
  }
}
art.combat = {
  version: 1,
  actors: 64,
  directions: 8,
  frames: 8,
  windupFrames: 3,
  strikeFrames: 2,
  recoveryFrames: 2,
  hurtFrames: 1,
  oneDirectionPerSource: true,
};
art.appearance.rigVersion = 1;
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Packed64 combatants,16 held weapons and4 per-pose hand rigs");
