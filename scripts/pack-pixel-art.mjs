// Technical sprite packing of image_gen originals: no shapes or game art are drawn.
// Source artwork is cropped, aligned, sampled onto native pixel grids and indexed
// to one shared palette. Committed native PNGs are used by the normal build.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve, dirname } from "node:path";
import { MONSTERS, MAPS, CLASSES, ITEMS } from "../site/data.js";

const legacyPalette = [
  "222034",
  "45283c",
  "663931",
  "8f563b",
  "df7126",
  "d9a066",
  "eec39a",
  "fbf236",
  "99e550",
  "6abe30",
  "37946e",
  "4b692f",
  "524b24",
  "323c39",
  "3f3f74",
  "306082",
  "5b6ee1",
  "639bff",
  "5fcde4",
  "cbdbfc",
  "ffffff",
  "9badb7",
  "847e87",
  "696a6a",
  "595652",
  "76428a",
  "ac3232",
  "d95763",
  "d77bba",
  "8f974a",
  "8a6f30",
  "000000",
];
const paletteFile = new URL("../art/shared-palette.json", import.meta.url);
export const PALETTE = (
  existsSync(paletteFile)
    ? JSON.parse(readFileSync(paletteFile, "utf8")).colors
    : legacyPalette
).map((hex) =>
  [0, 2, 4].map((i) => parseInt(hex.replace(/^#/, "").slice(i, i + 2), 16)),
);
const quantized = new Map();
function color(r, g, b) {
  const key =
    (Math.min(63, Math.round(r / 4)) << 12) |
    (Math.min(63, Math.round(g / 4)) << 6) |
    Math.min(63, Math.round(b / 4));
  if (quantized.has(key)) return quantized.get(key);
  let best = PALETTE[0],
    distance = Infinity;
  for (const candidate of PALETTE) {
    const d =
      2 * (r - candidate[0]) ** 2 +
      3 * (g - candidate[1]) ** 2 +
      (b - candidate[2]) ** 2;
    if (d < distance) {
      best = candidate;
      distance = d;
    }
  }
  quantized.set(key, best);
  return best;
}
const rgba = (width, height) => ({
  width,
  height,
  data: Buffer.alloc(width * height * 4),
});
function decode(path) {
  const [width, height] = execFileSync(
    "magick",
    ["identify", "-format", "%w %h", path],
    { encoding: "utf8" },
  )
    .trim()
    .split(" ")
    .map(Number);
  const data = execFileSync(
    "magick",
    [path, "-alpha", "on", "-depth", "8", "rgba:-"],
    { maxBuffer: 96 * 1024 * 1024 },
  );
  if (data.length !== width * height * 4)
    throw Error("Unexpected decoded pixel count: " + path);
  return { width, height, data };
}
function sample(source, rect, width, height, opaque = false) {
  const out = rgba(width, height),
    { sx, sy, sw, sh } = rect;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const x0 = sx + (x * sw) / width,
        x1 = sx + ((x + 1) * sw) / width,
        y0 = sy + (y * sh) / height,
        y1 = sy + ((y + 1) * sh) / height;
      let alpha = 0,
        r = 0,
        g = 0,
        b = 0,
        area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y1); yy++)
        for (let xx = Math.floor(x0); xx < Math.ceil(x1); xx++) {
          if (xx < 0 || yy < 0 || xx >= source.width || yy >= source.height)
            continue;
          const weight =
            (Math.min(x1, xx + 1) - Math.max(x0, xx)) *
            (Math.min(y1, yy + 1) - Math.max(y0, yy));
          if (weight <= 0) continue;
          const at = (yy * source.width + xx) * 4,
            a = source.data[at + 3] / 255;
          area += weight;
          alpha += a * weight;
          r += source.data[at] * a * weight;
          g += source.data[at + 1] * a * weight;
          b += source.data[at + 2] * a * weight;
        }
      if (!area || (!opaque && alpha / area < 0.42) || alpha < 0.001) continue;
      const at = (y * width + x) * 4,
        c = color(r / alpha, g / alpha, b / alpha);
      out.data[at] = c[0];
      out.data[at + 1] = c[1];
      out.data[at + 2] = c[2];
      out.data[at + 3] = 255;
    }
  return out;
}
// Nearest-neighbor is a technical native-grid sample: authored colors are
// selected, never averaged across the silhouette into pale fringe colors.
function sampleNearest(source, rect, width, height, opaque = false) {
  const out = rgba(width, height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const sx = Math.min(
          source.width - 1,
          Math.floor(rect.sx + ((x + 0.5) * rect.sw) / width),
        ),
        sy = Math.min(
          source.height - 1,
          Math.floor(rect.sy + ((y + 0.5) * rect.sh) / height),
        ),
        at = (sy * source.width + sx) * 4;
      if (!opaque && source.data[at + 3] < 140) continue;
      const c = color(
          source.data[at],
          source.data[at + 1],
          source.data[at + 2],
        ),
        to = (y * width + x) * 4;
      out.data[to] = c[0];
      out.data[to + 1] = c[1];
      out.data[to + 2] = c[2];
      out.data[to + 3] = 255;
    }
  return out;
}
function blit(source, target, x, y) {
  for (let row = 0; row < source.height; row++)
    source.data.copy(
      target.data,
      ((row + y) * target.width + x) * 4,
      row * source.width * 4,
      (row + 1) * source.width * 4,
    );
}
function cell(source, cols, rows, col, row) {
  const sx = Math.round((col * source.width) / cols),
    sy = Math.round((row * source.height) / rows);
  return {
    sx,
    sy,
    cols,
    rows,
    col,
    row,
    sw: Math.round(((col + 1) * source.width) / cols) - sx,
    sh: Math.round(((row + 1) * source.height) / rows) - sy,
  };
}
const componentsCache = new WeakMap();
function sourceComponents(source) {
  if (componentsCache.has(source)) return componentsCache.get(source);
  const width = source.width,
    height = source.height,
    mask = new Uint8Array(width * height),
    seen = new Uint8Array(mask.length),
    components = [];
  for (let i = 0; i < mask.length; i++)
    mask[i] = source.data[i * 4 + 3] >= 140 ? 1 : 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const queue = [start];
    seen[start] = 1;
    let minX = width,
      minY = height,
      maxX = 0,
      maxY = 0;
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i],
        x = at % width,
        y = Math.floor(at / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = x + dx,
          ny = y + dy,
          n = ny * width + nx;
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < width &&
          ny < height &&
          mask[n] &&
          !seen[n]
        ) {
          seen[n] = 1;
          queue.push(n);
        }
      }
    }
    if (queue.length >= 4)
      components.push({ area: queue.length, minX, minY, maxX, maxY });
  }
  componentsCache.set(source, components);
  return components;
}
const gridCache = new WeakMap();
function gridSubjects(source, cols, rows) {
  let grids = gridCache.get(source);
  if (!grids) {
    grids = new Map();
    gridCache.set(source, grids);
  }
  const key = cols + "x" + rows;
  if (grids.has(key)) return grids.get(key);
  const components = sourceComponents(source),
    major = components.filter(
      (c) => c.area >= ((source.width * source.height) / (cols * rows)) * 0.08,
    );
  function centers(count, axis, length) {
    const positions = major
      .map((c) =>
        axis === "x" ? (c.minX + c.maxX) / 2 : (c.minY + c.maxY) / 2,
      )
      .sort((a, b) => a - b);
    let means = Array.from(
      { length: count },
      (_, i) =>
        positions[
          Math.min(
            positions.length - 1,
            Math.floor(((i + 0.5) * positions.length) / count),
          )
        ] ?? ((i + 0.5) * length) / count,
    );
    for (let pass = 0; pass < 15; pass++) {
      const bins = means.map(() => []);
      for (const c of major) {
        const v = axis === "x" ? (c.minX + c.maxX) / 2 : (c.minY + c.maxY) / 2;
        const n = means.reduce(
          (best, m, i) =>
            Math.abs(v - m) < Math.abs(v - means[best]) ? i : best,
          0,
        );
        bins[n].push(v);
      }
      means = means.map((m, i) =>
        bins[i].length
          ? bins[i].reduce((a, b) => a + b, 0) / bins[i].length
          : m,
      );
    }
    return means;
  }
  const xs = centers(cols, "x", source.width),
    ys = centers(rows, "y", source.height),
    groups = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => []),
    );
  const pitch = source.height / rows;
  for (let col = 0; col < cols; col++) {
    const candidates = components
      .filter((c) => {
        const cx = (c.minX + c.maxX) / 2;
        return (
          xs.reduce(
            (best, x, i) =>
              Math.abs(cx - x) < Math.abs(cx - xs[best]) ? i : best,
            0,
          ) === col
        );
      })
      .sort((a, b) => a.minY + a.maxY - (b.minY + b.maxY));
    const cy = (c) => (c.minY + c.maxY) / 2;
    let previous = new Map();
    for (let row = 0; row < rows; row++) {
      const next = new Map();
      for (let i = 0; i < candidates.length; i++) {
        const c = candidates[i],
          y = cy(c),
          score = Math.log(c.area) - 0.8 * ((y - ys[row]) / pitch) ** 2;
        if (Math.abs(y - ys[row]) > pitch * 0.9) continue;
        if (row === 0) {
          next.set(i, { score, path: [i] });
          continue;
        }
        for (const [last, state] of previous) {
          const gap = y - cy(candidates[last]);
          if (last >= i || gap < pitch * 0.35 || gap > pitch * 1.9) continue;
          const value = state.score + score;
          if (!next.has(i) || value > next.get(i).score)
            next.set(i, { score: value, path: [...state.path, i] });
        }
      }
      previous = next;
    }
    const best = [...previous.values()].sort((a, b) => b.score - a.score)[0];
    if (best) {
      const mains = best.path.map((i) => candidates[i]);
      for (let row = 0; row < rows; row++) groups[row][col].push(mains[row]);
      for (const c of candidates) {
        if (mains.includes(c)) continue;
        const y = cy(c),
          row = mains.reduce(
            (best, m, i) =>
              Math.abs(y - cy(m)) < Math.abs(y - cy(mains[best])) ? i : best,
            0,
          );
        if (
          Math.abs(y - cy(mains[row])) < pitch * 0.35 &&
          c.area >= mains[row].area * 0.1
        )
          groups[row][col].push(c);
      }
    } else {
      for (const c of candidates) {
        const y = cy(c),
          row = ys.reduce(
            (best, v, i) =>
              Math.abs(y - v) < Math.abs(y - ys[best]) ? i : best,
            0,
          );
        groups[row][col].push(c);
      }
    }
  }
  grids.set(key, groups);
  return groups;
}
function foreground(source, rect) {
  const components = gridSubjects(source, rect.cols, rect.rows)[rect.row][
    rect.col
  ].toSorted((a, b) => b.area - a.area);
  if (!components.length)
    throw Error(`No complete subject at ${rect.col},${rect.row}`);
  const main = components[0],
    keep = components.filter((c) => c.area >= main.area * 0.1);
  const sx = Math.min(...keep.map((c) => c.minX)),
    sy = Math.min(...keep.map((c) => c.minY));
  return {
    sx,
    sy,
    sw: Math.max(...keep.map((c) => c.maxX)) - sx + 1,
    sh: Math.max(...keep.map((c) => c.maxY)) - sy + 1,
  };
}
function entityFrames(
  source,
  cols,
  rows,
  rowIndices,
  size,
  { walkRows = null, sampling = "area", padding = 2 } = {},
) {
  const rects = rowIndices.flatMap((row) =>
    Array.from({ length: cols }, (_, col) =>
      foreground(source, cell(source, cols, rows, col, row)),
    ),
  );
  const walkExtents = rects
    .filter((_, i) =>
      walkRows ? Math.floor(i / cols) < walkRows : i % cols < 4,
    )
    .map((r) => Math.max(r.sw, r.sh))
    .sort((a, b) => a - b);
  const scale =
    (size - padding * 2) / walkExtents[Math.floor(walkExtents.length / 2)];
  const frames = rects.map((rect) => {
    const frame = rgba(size, size),
      fit = Math.min(scale, (size - padding * 2) / Math.max(rect.sw, rect.sh)),
      w = Math.max(1, Math.round(rect.sw * fit)),
      h = Math.max(1, Math.round(rect.sh * fit));
    blit(
      (sampling === "nearest" ? sampleNearest : sample)(source, rect, w, h),
      frame,
      Math.floor((size - w) / 2),
      size - padding - h,
    );
    return frame;
  });
  return frames;
}
// Effects have detached particles and sometimes touching low-alpha glows.
// Their authored equal cells are authoritative; global subject tracking would
// merge neighboring bursts and lose frames. Keep each frame inside its cell.
function effectBounds(source, rect) {
  let minX = rect.sx + rect.sw,
    minY = rect.sy + rect.sh,
    maxX = -1,
    maxY = -1;
  for (let y = rect.sy; y < rect.sy + rect.sh; y++)
    for (let x = rect.sx; x < rect.sx + rect.sw; x++) {
      if (source.data[(y * source.width + x) * 4 + 3] < 140) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  return maxX < 0
    ? rect
    : { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}
async function png(image, path) {
  await mkdir(dirname(path), { recursive: true });
  execFileSync(
    "magick",
    [
      "-size",
      `${image.width}x${image.height}`,
      "-depth",
      "8",
      "rgba:-",
      "-define",
      "png:color-type=6",
      path,
    ],
    { input: image.data, maxBuffer: 16 * 1024 * 1024 },
  );
}

export async function packPixelArt({
  sourceFile = "art/pixel-sources.json",
  output = "/tmp/leaftale-pixel-assets",
  only = null,
  resolutionScale = 1,
} = {}) {
  const registry = JSON.parse(await readFile(sourceFile, "utf8")),
    assets = [],
    files = [];
  await mkdir(output, { recursive: true });
  async function save(image, file, entry, extra = {}) {
    const target = resolve(output, file + ".png");
    await png(image, target);
    assets.push({
      id: file,
      target: "site/assets/" + file + ".png",
      tool: "image_gen",
      source: entry.source,
      request: entry.id,
      width: image.width,
      height: image.height,
      sha256: createHash("sha256")
        .update(await readFile(target))
        .digest("hex"),
      processing:
        "Native pixel-grid packing, shared palette and binary transparency; artwork originates from image_gen",
      ...extra,
    });
  }
  for (const entry of registry.sources) {
    if (only && !only.includes(entry.id)) continue;
    console.log("Packing " + entry.id);
    const source = decode(entry.source),
      sampling = entry.sampling || "nearest",
      unit = 16 * resolutionScale;
    if (entry.id.startsWith("monsters-")) {
      const group = Number(entry.id.slice(9));
      for (const [local, m] of MONSTERS.slice(
        group * 4,
        group * 4 + 4,
      ).entries()) {
        const frames = entityFrames(
            source,
            8,
            8,
            [local * 2, local * 2 + 1],
            m.spriteSize,
          ),
          atlas = rgba(m.spriteSize * 8, m.spriteSize * 2);
        frames.forEach((frame, i) =>
          blit(
            frame,
            atlas,
            (i % 8) * m.spriteSize,
            Math.floor(i / 8) * m.spriteSize,
          ),
        );
        await save(atlas, "creatures/" + m.id, entry, {
          cellSize: m.spriteSize,
          cols: 8,
          rows: 2,
        });
        await save(frames[0], "portraits/" + m.id, entry, {
          cellSize: m.spriteSize,
        });
        files.push("creatures/" + m.id);
      }
    } else if (entry.id.startsWith("character-")) {
      const id = entry.id.slice(10),
        frames = entityFrames(source, 8, 4, [0, 1, 2, 3], 48),
        atlas = rgba(8 * 48, 4 * 48);
      frames.forEach((frame, i) =>
        blit(frame, atlas, (i % 8) * 48, Math.floor(i / 8) * 48),
      );
      await save(atlas, "characters/" + id, entry, {
        cellSize: 48,
        cols: 8,
        rows: 4,
      });
      files.push("characters/" + id);
    } else if (entry.id === "npcs") {
      const atlas = rgba(384, 384);
      for (let row = 0; row < 8; row++)
        entityFrames(source, 8, 8, [row], 48).forEach((frame, col) =>
          blit(frame, atlas, col * 48, row * 48),
        );
      await save(atlas, "npcs", entry, { cellSize: 48, cols: 8, rows: 8 });
      files.push("npcs");
    } else if (["icons", "loot"].includes(entry.id)) {
      const rows = entry.id === "icons" ? 8 : 5,
        file = entry.id === "icons" ? "items" : "loot",
        atlas = rgba(unit * 8, rows * unit);
      for (let row = 0; row < rows; row++)
        for (let col = 0; col < 8; col++) {
          const rect = foreground(source, cell(source, 8, rows, col, row)),
            scale = (12 * resolutionScale) / Math.max(rect.sw, rect.sh),
            w = Math.max(1, Math.round(rect.sw * scale)),
            h = Math.max(1, Math.round(rect.sh * scale));
          blit(
            (sampling === "nearest" ? sampleNearest : sample)(
              source,
              rect,
              w,
              h,
            ),
            atlas,
            col * unit + Math.floor((unit - w) / 2),
            row * unit + Math.floor((unit - h) / 2),
          );
        }
      await save(atlas, file, entry, { cellSize: unit, cols: 8, rows });
      files.push(file);
    } else if (entry.id === "effects") {
      const effectSize = 64 * resolutionScale,
        atlas = rgba(effectSize * 8, effectSize * 8);
      for (let row = 0; row < 8; row++) {
        const rects = Array.from({ length: 8 }, (_, col) =>
          effectBounds(source, cell(source, 8, 8, col, row)),
        );
        const scale =
          (56 * resolutionScale) /
          Math.max(...rects.map((r) => Math.max(r.sw, r.sh)));
        for (let col = 0; col < 8; col++) {
          const rect = rects[col],
            w = Math.max(1, Math.round(rect.sw * scale)),
            h = Math.max(1, Math.round(rect.sh * scale));
          blit(
            (sampling === "nearest" ? sampleNearest : sample)(
              source,
              rect,
              w,
              h,
            ),
            atlas,
            col * effectSize + Math.floor((effectSize - w) / 2),
            row * effectSize + Math.floor((effectSize - h) / 2),
          );
        }
      }
      await save(atlas, "effects", entry, {
        cellSize: effectSize,
        cols: 8,
        rows: 8,
      });
      files.push("effects");
      for (const baseSize of [32, 48]) {
        const size = baseSize * resolutionScale;
        const smaller = rgba(size * 8, size * 8);
        for (let row = 0; row < 8; row++)
          for (let col = 0; col < 8; col++)
            blit(
              sampleNearest(source, cell(source, 8, 8, col, row), size, size),
              smaller,
              col * size,
              row * size,
            );
        await save(smaller, "effects-" + baseSize, entry, {
          cellSize: size,
          cols: 8,
          rows: 8,
        });
        files.push("effects-" + size);
      }
    } else {
      const map = entry.id.startsWith("map-"),
        file = map
          ? "maps/" + entry.id.slice(4)
          : entry.id === "title"
            ? "title-forest"
            : "interface";
      const [baseW, baseH] = map
        ? [960, 640]
        : entry.id === "title"
          ? [480, 320]
          : [128, 128];
      const w = baseW * resolutionScale,
        h = baseH * resolutionScale;
      await save(
        (sampling === "nearest" ? sampleNearest : sample)(
          source,
          { sx: 0, sy: 0, sw: source.width, sh: source.height },
          w,
          h,
          entry.id !== "interface",
        ),
        file,
        entry,
      );
      files.push(file);
    }
  }
  const monsterArt = Object.fromEntries(
    MONSTERS.map((m) => [
      m.id,
      {
        file: "creatures/" + m.id,
        portrait: "portraits/" + m.id,
        size: m.spriteSize,
        cols: 8,
        rows: 2,
        animations: {
          idle: [0],
          walk: [0, 1, 2, 3],
          attack: [4, 5],
          hurt: [6],
          death: [7],
        },
      },
    ]),
  );
  const baseItems = Object.values(ITEMS).filter((i) => i.type !== "trophy"),
    trophies = Object.values(ITEMS).filter((i) => i.type === "trophy");
  const manifest = {
    version: 3,
    provenance: "image_gen",
    pixelScale: 2,
    palette: PALETTE.map(
      (c) => "#" + c.map((n) => n.toString(16).padStart(2, "0")).join(""),
    ),
    files,
    monsters: monsterArt,
    items: Object.fromEntries([
      ...baseItems.map((i, n) => [i.id, n]),
      ...trophies.map((i, n) => [i.id, n]),
    ]),
    itemOverrides: Object.fromEntries(
      trophies.map((i, index) => [
        i.id,
        { file: "loot", cols: 8, rows: 5, index },
      ]),
    ),
    characterLayouts: Object.fromEntries(
      CLASSES.map((c) => [
        c.id,
        {
          cols: 8,
          rows: 4,
          size: 48,
          animations: {
            idle: [0],
            walk: [0, 1, 2, 3],
            attack: [4, 5],
            hurt: [6],
            death: [7],
          },
        },
      ]),
    ),
    npcLayout: { cols: 8, rows: 8, framesPerNpc: 8, size: 48 },
    effects: {
      cols: 8,
      rows: 8,
      size: 64,
      variants: { 32: "effects-32", 48: "effects-48", 64: "effects" },
    },
    iconLayout: { cols: 8, rows: 8, size: 16 },
    skillIcons: {
      warden: [42, 43, 44, 45],
      mage: [46, 47, 48, 49],
      ranger: [50, 51, 52, 53],
      herbalist: [54, 55, 56, 57],
    },
  };
  await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  await writeFile(
    resolve(output, "generated-assets.json"),
    JSON.stringify(
      {
        generatedAt: "2026-10-24",
        style: "Native low-resolution pixel art",
        assets,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `Packed ${assets.length} native image assets from ${registry.sources.length} image-generation originals into ${output}`,
  );
  return { manifest, assets };
}

export { decode, entityFrames, rgba, blit, png, sample, cell };

if (
  process.argv[1] &&
  new URL(import.meta.url).pathname === resolve(process.argv[1])
) {
  const only = process.argv
    .find((x) => x.startsWith("--only="))
    ?.slice(7)
    .split(",");
  await packPixelArt({ only });
}

export { sampleNearest, color as paletteColor };
