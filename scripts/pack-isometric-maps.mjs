// Technical assembly of image_gen-native isometric diamonds and upright scenery.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  decode,
  rgba,
  blit,
  png,
  sample,
  sampleNearest,
  paletteColor,
} from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
import { NAVIGATION } from "../site/world-layout.js";
import { project } from "../site/view-projection.js";
import { floorTileCode } from "../site/isometric-layouts.js";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json"),
  plan = await json("art/isometric-map-plan.json");
const W = 448,
  H = 224,
  P = 384;
const crop = (src, r) => {
  const out = rgba(r.sw, r.sh);
  for (const part of r.components)
    for (let y = part.minY; y <= part.maxY; y++)
      for (let x = part.minX; x <= part.maxX; x++) {
        const a = (y * src.width + x) * 4,
          b = ((y - r.sy) * r.sw + x - r.sx) * 4;
        src.data.copy(out.data, b, a, a + 4);
      }
  return out;
};
async function save(file, img, sources, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await mkdir(target.slice(0, target.lastIndexOf("/")), { recursive: true });
  await png(img, target);
  const old = records.assets.find((r) => r.id === file);
  records.assets = records.assets.filter((r) => r.id !== file);
  records.assets.push({
    ...old,
    id: file,
    target,
    source: sources[0],
    additionalSources: sources.slice(1),
    tool: "image_gen",
    width: img.width,
    height: img.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    ...extra,
  });
  if (!art.files.includes(file) && !file.startsWith("maps/"))
    art.files.push(file);
}
function extract(source, width, height) {
  const src = decode(source);
  for (let i = 3; i < src.data.length; i += 4)
    if (src.data[i] < 220) src.data[i] = 0;
  return directionalRects(src, 4, 4, { minArea: 0.025 })
    .flat()
    .map((r) =>
      sampleNearest(
        crop(src, r),
        { sx: 0, sy: 0, sw: r.sw, sh: r.sh },
        width,
        height,
      ),
    );
}
function sampleOpaque(frame, x, y) {
  x = Math.max(0, Math.min(W - 1, Math.round(x)));
  y = Math.max(0, Math.min(H - 1, Math.round(y)));
  let a = (y * W + x) * 4;
  if (frame.data[a + 3]) return frame.data.subarray(a, a + 3);
  for (let n = 1; n < 40; n++) {
    const xx = Math.round(x + ((W / 2 - x) * n) / 40),
      yy = Math.round(y + ((H / 2 - y) * n) / 40);
    a = (yy * W + xx) * 4;
    if (frame.data[a + 3]) return frame.data.subarray(a, a + 3);
  }
  a = ((H / 2) * W + W / 2) * 4;
  return frame.data.subarray(a, a + 3);
}
function waterTexture(frame) {
  let best = null;
  for (let y = 48; y < H - 64; y += 8)
    for (let x = 96; x < W - 128; x += 8) {
      const sum = [0, 0, 0],
        squares = [0, 0, 0];
      let valid = 0;
      for (let dy = 0; dy < 16; dy++)
        for (let dx = 0; dx < 32; dx++) {
          const a = ((y + dy) * W + x + dx) * 4;
          const [r, g, b, alpha] = frame.data.subarray(a, a + 4);
          if (alpha && b > r * 1.2 && g > r * 1.1) valid++;
          for (const [i, n] of [r, g, b].entries()) {
            sum[i] += n;
            squares[i] += n * n;
          }
        }
      if (valid < 500) continue;
      const score = sum.reduce(
        (s, n, i) => s + squares[i] / 512 - (n / 512) ** 2,
        0,
      );
      if (!best || score < best.score) best = { x, y, score };
    }
  return best;
}
function makeDiamond(frames, mask, variant = null) {
  const out = rgba(W, H),
    bits = [mask & 1, (mask >> 1) & 1, (mask >> 2) & 1, (mask >> 3) & 1];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5 - W / 2) / W,
        sy = (y + 0.5 - H / 2) / H,
        u = sx + sy + 0.5,
        v = sy - sx + 0.5;
      if (u < 0 || v < 0 || u > 1 || v > 1) continue;
      const amount =
          bits[0] * (1 - u) * (1 - v) +
          bits[1] * u * (1 - v) +
          bits[2] * u * v +
          bits[3] * (1 - u) * v,
        material = amount >= 0.5 ? 1 : 0;
      // Repeat quiet water pixels extracted from the generated material, without
      // authored tile rims or mirrored decorations. Both periods divide W/2,H/2.
      const water = !material && frames.waterMaterial;
      let rgb = [
        ...(water
          ? sampleOpaque(frames[8], water.x + (x % 32), water.y + (y % 16))
          : sampleOpaque(frames[variant ?? (material ? 0 : 8)], x, y)),
      ];
      const d = Math.min(u, v, 1 - u, 1 - v),
        edge = u === d || 1 - u === d ? v : u,
        t = Math.min(edge, 1 - edge) * 2;
      if (!water && d < 0.055) {
        const canonical = sampleOpaque(
            frames[material ? 0 : 8],
            64 + t * 320,
            H / 2,
          ),
          weight = d < 0.012 ? 1 : (0.055 - d) / (0.055 - 0.012);
        rgb = rgb.map((n, i) => n * (1 - weight) + canonical[i] * weight);
      }
      const color = paletteColor(...rgb),
        a = (y * W + x) * 4;
      out.data[a] = color[0];
      out.data[a + 1] = color[1];
      out.data[a + 2] = color[2];
      out.data[a + 3] = 255;
    }
  return out;
}
function scenery(source) {
  const src = decode(source);
  for (let i = 3; i < src.data.length; i += 4)
    if (src.data[i] < 220) src.data[i] = 0;
  return directionalRects(src, 4, 4, { minArea: 0.025 })
    .flat()
    .map((r) => {
      const cut = crop(src, r),
        scale = Math.min((P - 16) / r.sw, (P - 16) / r.sh),
        w = Math.max(1, Math.round(r.sw * scale)),
        h = Math.max(1, Math.round(r.sh * scale)),
        out = rgba(P, P);
      blit(
        sampleNearest(cut, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h),
        out,
        Math.round((P - w) / 2),
        P - 8 - h,
      );
      return out;
    });
}
function overview(nav, floors, props, width, height, anchors) {
  const corners = [
    [0, 0],
    [nav.cols, 0],
    [nav.cols, nav.rows],
    [0, nav.rows],
  ].map(([c, r]) => project((c * 112 - nav.width / 2) / 16, (r * 112) / 16));
  const minX = Math.min(...corners.map((p) => p.x)) - 224,
    maxX = Math.max(...corners.map((p) => p.x)) + 224,
    minY = Math.min(...corners.map((p) => p.y)) - 512,
    maxY = Math.max(...corners.map((p) => p.y)) + 224;
  const scale = Math.min(
      (width - 8) / (maxX - minX),
      (height - 8) / (maxY - minY),
    ),
    ox = (width - (maxX - minX) * scale) / 2 - minX * scale,
    oy = (height - (maxY - minY) * scale) / 2 - minY * scale,
    out = rgba(width, height);
  const paint = (frame, x, y, w, h) => {
    const small = sample(
      frame,
      { sx: 0, sy: 0, sw: frame.width, sh: frame.height },
      Math.max(1, Math.round(w)),
      Math.max(1, Math.round(h)),
    );
    for (let yy = 0; yy < small.height; yy++)
      for (let xx = 0; xx < small.width; xx++) {
        const tx = Math.round(x) + xx,
          ty = Math.round(y) + yy,
          a = (yy * small.width + xx) * 4;
        if (
          tx < 0 ||
          ty < 0 ||
          tx >= width ||
          ty >= height ||
          !small.data[a + 3]
        )
          continue;
        small.data.copy(out.data, (ty * width + tx) * 4, a, a + 4);
      }
  };
  for (let r = 0; r <= nav.rows; r++)
    for (let c = 0; c <= nav.cols; c++) {
      const p = project((c * 112 - nav.width / 2) / 16, (r * 112) / 16);
      paint(
        floors[floorTileCode(nav, c, r)],
        ox + p.x * scale - (W * scale) / 2,
        oy + p.y * scale - (H * scale) / 2,
        W * scale + 1,
        H * scale + 1,
      );
    }
  for (const prop of nav.props.toSorted(
    (a, b) => project(a.x, a.y).y - project(b.x, b.y).y,
  )) {
    const p = project(prop.x, prop.y),
      size = prop.size || P;
    paint(
      props[prop.index],
      ox + p.x * scale - (size * scale) / 2,
      oy +
        p.y * scale -
        size * scale * (anchors[prop.index] ?? prop.anchor ?? 0.98),
      size * scale,
      size * scale,
    );
  }
  return out;
}
art.world.isometric ??= {
  version: 1,
  projection: "symmetric-2:1-native-diamonds",
  maps: {},
  files: [],
};
const sources = [];
for (const nav of Object.values(NAVIGATION)) {
  if (process.argv[2] && process.argv[2] !== nav.id) continue;
  let floorEntry, propEntry;
  try {
    floorEntry = await json(`art/isometric-${nav.id}-floor.json`);
    propEntry = await json(`art/isometric-${nav.id}-props.json`);
  } catch {
    console.log("Not ready " + nav.id);
    continue;
  }
  sources.push(floorEntry, propEntry);
  const authored = extract(floorEntry.source, W, H);
  if (
    ["brook", "shelltown", "glassbeach", "tideroot", "seacave"].includes(nav.id)
  )
    authored.waterMaterial = waterTexture(authored[8]);
  const frames = Array.from({ length: 16 }, (_, n) => makeDiamond(authored, n));
  for (let n = 0; n < 8; n++) frames.push(makeDiamond(authored, 15, n));
  for (let n = 0; n < 8; n++) frames.push(makeDiamond(authored, 0, n + 8));
  const ground = rgba(W * 8, H * 4);
  frames.forEach((f, i) => blit(f, ground, (i % 8) * W, Math.floor(i / 8) * H));
  const propFrames = scenery(propEntry.source),
    props = rgba(P * 4, P * 4);
  propFrames.forEach((f, i) =>
    blit(f, props, (i % 4) * P, Math.floor(i / 4) * P),
  );
  const anchors = propFrames.map((frame, i) => {
    if (i !== 12) return 1 - 8 / P;
    let sum = 0,
      n = 0;
    for (let y = 0; y < P; y++)
      for (let x = 0; x < P; x++)
        if (frame.data[(y * P + x) * 4 + 3]) {
          sum += y;
          n++;
        }
    return n ? sum / n / P : 0.82;
  });
  const floorFile = `world/iso-${nav.id}-floor`,
    propFile = `world/iso-${nav.id}-props`;
  await save(floorFile, ground, [floorEntry.source], {
    cols: 8,
    rows: 4,
    tileWidth: W,
    tileHeight: H,
    projection: "native-2:1-diamond",
  });
  await save(propFile, props, [propEntry.source], {
    cols: 4,
    rows: 4,
    size: P,
  });
  const old = records.assets.find((r) => r.id === "maps/" + nav.id);
  await save(
    "maps/" + nav.id,
    overview(nav, frames, propFrames, old.width, old.height, anchors),
    [floorEntry.source, propEntry.source],
  );
  art.world.isometric.maps[nav.id] = {
    floor: { file: floorFile, width: W, height: H, cols: 8, rows: 4 },
    props: { file: propFile, size: P, cols: 4, rows: 4, anchors },
    concept: floorEntry.concept,
  };
  for (const f of [floorFile, propFile])
    if (!art.world.isometric.files.includes(f))
      art.world.isometric.files.push(f);
  console.log("Packed true isometric " + nav.id + " with16 scenery assets");
}
for (const id of Object.keys(art.world.isometric.maps))
  for (const kind of ["floor", "props"]) {
    const entry = await json(`art/isometric-${id}-${kind}.json`);
    if (!sources.some((s) => s.id === id && s.kind === kind))
      sources.push(entry);
  }
plan.sources = sources;
plan.status = sources.length === 20 ? "complete" : "generating";
await writeFile(
  "art/isometric-map-plan.json",
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
