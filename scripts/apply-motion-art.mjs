// Technical assembly only: each additional pose and VFX frame is image_gen art.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import {
  decode,
  entityFrames,
  rgba,
  blit,
  png,
  sampleNearest,
  cell,
} from "./pack-pixel-art.mjs";
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const plan = await json("art/motion-sources.json");
if (plan.pending.length || plan.sources.length !== 73)
  throw Error("Finish all 73 image generation requests before applying.");
const manifest = await json("site/assets/manifest.json");
const records = await json("art/generated-assets.json");
const actors = plan.sources.filter((a) => a.kind !== "effect");
const base = "/tmp/leaftale-motion-originals";
// Read approved packed pixels verbatim from the recorded revision. Re-quantizing
// source paintings can change a few colors; it must not alter existing poses.
const baseline = await json("art/motion-baseline.json");
for (const a of actors) {
  const target = "site/assets/" + a.baseFile + ".png";
  const pixels = execFileSync("git", ["show", baseline.commit + ":" + target], {
    maxBuffer: 64 * 1024 * 1024,
  });
  const expected = baseline.assets.find((r) => r.id === a.baseFile).sha256;
  if (createHash("sha256").update(pixels).digest("hex") !== expected)
    throw Error("Original atlas differs: " + a.id);
  const file = base + "/" + a.baseFile + ".png";
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, pixels);
}
const replace = async (image, file, source, extra = {}) => {
  const target = "site/assets/" + file + ".png",
    old = records.assets.find((a) => a.id === file);
  await png(image, target);
  const record = {
    ...old,
    id: file,
    target,
    tool: "image_gen",
    source,
    width: image.width,
    height: image.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    ...extra,
  };
  records.assets = records.assets.filter((a) => a.id !== file);
  records.assets.push(record);
};
// Match the artist's actual row order to the approved eight headings. Some
// generated sheets rotate in the opposite order. This only reorders genuine
// views: no mirroring, image rotation, optical-flow or synthetic artwork.
function cut(sheet, size, col, row) {
  const f = rgba(size, size);
  for (let y = 0; y < size; y++)
    sheet.data.copy(
      f.data,
      y * size * 4,
      ((row * size + y) * sheet.width + col * size) * 4,
      ((row * size + y) * sheet.width + (col + 1) * size) * 4,
    );
  return f;
}
function directionFeatures(frames, size) {
  const bins = 12,
    values = new Float64Array(bins * bins * 4),
    counts = new Uint32Array(bins * bins);
  for (const f of frames)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const bin =
            Math.floor((y * bins) / size) * bins +
            Math.floor((x * bins) / size),
          at = (y * size + x) * 4,
          alpha = f.data[at + 3] / 255;
        counts[bin]++;
        for (let c = 0; c < 3; c++)
          values[bin * 4 + c] += f.data[at + c] * alpha;
        values[bin * 4 + 3] += 255 * alpha;
      }
  for (let i = 0; i < counts.length; i++)
    for (let c = 0; c < 4; c++) values[i * 4 + c] /= counts[i] || 1;
  return values;
}
function alignRows(original, added, size) {
  const before = Array.from({ length: 8 }, (_, d) =>
    directionFeatures([cut(original, size, 0, d)], size),
  );
  const after = Array.from({ length: 8 }, (_, d) =>
    directionFeatures(added.slice(d * 8, d * 8 + 4), size),
  );
  const costs = before.map((a) =>
    after.map((b) =>
      a.reduce(
        (sum, v, i) =>
          sum +
          (v - b[i]) ** 2 *
            (i % 4 === 3 ? 0.5 : 1) *
            (Math.floor(i / 48) < 7 ? 1.5 : 0.7),
        0,
      ),
    ),
  );
  const memo = new Map();
  function best(dir, mask) {
    if (dir === 8) return { cost: 0, rows: [] };
    if (memo.has(mask)) return memo.get(mask);
    let result = { cost: Infinity, rows: [] };
    for (let row = 0; row < 8; row++)
      if (!(mask & (1 << row))) {
        const tail = best(dir + 1, mask | (1 << row)),
          cost = costs[dir][row] + tail.cost;
        if (cost < result.cost) result = { cost, rows: [row, ...tail.rows] };
      }
    memo.set(mask, result);
    return result;
  }
  const result = best(0, 0),
    identity = costs.reduce((sum, row, i) => sum + row[i], 0);
  const rows =
    result.cost < identity * 0.9999 ? result.rows : [0, 1, 2, 3, 4, 5, 6, 7];
  // Do not force a front-facing approved view into a back-facing row just to
  // consume every row once. Adjacent headings may share a compatible authored
  // passing pose, while their approved base views remain distinct.
  return rows.map((row, dir) => {
    const closest = costs[dir].reduce(
      (best, value, index) => (value < costs[dir][best] ? index : best),
      0,
    );
    return costs[dir][row] > costs[dir][closest] * 1.15 ? closest : row;
  });
}
for (const a of actors) {
  const layout = (
    a.kind === "monster" ? manifest.monsters : manifest.characterLayouts
  )[a.id];
  const original = decode(base + "/" + layout.file + ".png"),
    size = layout.size;
  const added = entityFrames(
    decode(a.source),
    8,
    8,
    [0, 1, 2, 3, 4, 5, 6, 7],
    size,
    { sampling: "nearest", padding: 4 },
  );
  const directionRows = alignRows(original, added, size);
  a.directionRows = directionRows;
  const atlas = rgba(size * 16, size * 8);
  for (let dir = 0; dir < 8; dir++) {
    const old = Array.from({ length: 8 }, (_, col) => {
      const f = rgba(size, size);
      for (let y = 0; y < size; y++)
        original.data.copy(
          f.data,
          y * size * 4,
          ((dir * size + y) * original.width + col * size) * 4,
          ((dir * size + y) * original.width + (col + 1) * size) * 4,
        );
      return f;
    });
    const sourceRow = directionRows[dir];
    const n = added.slice(sourceRow * 8, sourceRow * 8 + 8);
    const frames = [
      old[0],
      n[0],
      old[1],
      n[1],
      old[2],
      n[2],
      old[3],
      n[3],
      n[4],
      n[5],
      old[4],
      n[6],
      old[5],
      n[7],
      old[6],
      old[7],
    ];
    frames.forEach((f, col) => blit(f, atlas, col * size, dir * size));
  }
  layout.sourceDirectionRows = directionRows;
  layout.cols = 16;
  layout.motionVersion = 2;
  layout.animations = {
    idle: [0],
    walk: [0, 1, 2, 3, 4, 5, 6, 7],
    windup: [8, 9, 10],
    attack: [11, 12],
    recover: [13, 2],
    hurt: [14],
    death: [15],
  };
  const originalSource = records.assets.find(
    (r) => r.id === layout.file,
  ).source;
  await replace(atlas, layout.file, originalSource, {
    additionalSources: [a.source],
    cols: 16,
    rows: 8,
    motionVersion: 2,
    processing:
      "Original approved poses interleaved with 64 independently image-generated intermediate poses; aligned native grid, binary alpha, no synthetic interpolation or mirroring",
  });
  console.log("Smooth actor: " + a.id);
}
for (const [logical, file] of [
  [32, "effects-32"],
  [48, "effects-48"],
  [64, "effects"],
]) {
  const size = logical * 2,
    atlas = rgba(size * 16, size * 9);
  for (let row = 0; row < 9; row++) {
    const source = plan.sources.find((a) => a.id === "fx-" + row),
      raw = decode(source.source);
    for (let index = 0; index < 16; index++) {
      const frame = sampleNearest(
        raw,
        cell(raw, 4, 4, index % 4, Math.floor(index / 4)),
        size,
        size,
      );
      // Fixed cell origins preserve expansion/fade. Hard safety gutters remove
      // neighboring artwork and low-alpha fringes without scaling every pose.
      const gutter = Math.max(4, Math.round(size * 0.08));
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (
            x < gutter ||
            y < gutter ||
            x >= size - gutter ||
            y >= size - gutter
          )
            frame.data.fill(0, (y * size + x) * 4, (y * size + x + 1) * 4);
      blit(frame, atlas, index * size, row * size);
    }
  }
  await replace(atlas, file, plan.sources.find((a) => a.id === "fx-0").source, {
    additionalSources: plan.sources
      .filter((a) => a.kind === "effect" && a.row > 0)
      .map((a) => a.source),
    cellSize: size,
    cols: 16,
    rows: 9,
    motionVersion: 2,
    processing:
      "Nine image-generated 16-frame VFX sequences; fixed cell extraction with generous transparent safety gutters, shared palette and binary alpha",
  });
}
manifest.version = 9;
manifest.effects = {
  ...manifest.effects,
  cols: 16,
  rows: 9,
  frames: 16,
  portalRow: 8,
};
manifest.motion = {
  version: 2,
  actorFrames: 16,
  walkFrames: 8,
  walkCycle: 0.5,
  windupFrames: 3,
  strikeFrames: 2,
  recoveryFrames: 2,
};
records.generatedAt = new Date().toISOString();
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
process.env.LEAFTALE_ART_SOURCE = "art/hd-sources.json";
process.env.LEAFTALE_ART_RESOLUTION = "2";
await import("./pack-transitions.mjs");
console.log(
  "Applied 64 actor supplements, 9 sixteen-frame VFX sequences and dynamic map overviews.",
);

await writeFile(
  "art/motion-sources.json",
  JSON.stringify(plan, null, 2) + "\n",
);
