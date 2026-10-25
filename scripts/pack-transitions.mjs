// Assemble image-generated Wang tiles. Shared edge strips use the SAME authored
// pixels for matching material pairs, so adjacent tile borders agree exactly.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  decode,
  rgba,
  png,
  sample,
  sampleNearest,
  paletteColor,
  cell,
  blit,
} from "./pack-pixel-art.mjs";
import { NAVIGATION, TILE } from "../site/world-layout.js";
const sources = JSON.parse(
  await readFile(
    process.env.LEAFTALE_ART_SOURCE || "art/crisp-sources.json",
    "utf8",
  ),
).sources;
const manifest = JSON.parse(
  await readFile("site/assets/manifest.json", "utf8"),
);
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
const assets = [];
async function save(im, file, entry, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await png(im, target);
  assets.push({
    id: file,
    target,
    tool: "image_gen",
    source: entry.source,
    request: entry.id,
    width: im.width,
    height: im.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    processing:
      "Native corner autotile extraction; matching shared edge pixels; shared palette; no new art drawing",
    ...extra,
  });
}
const RESOLUTION = Number(process.env.LEAFTALE_ART_RESOLUTION || 1);
const NATIVE_TILE = TILE * RESOLUTION;
const EDGE = 2 * RESOLUTION;
const propSize = 256 * RESOLUTION;
const propAtlas = decode("site/assets/world/props.png");
for (const nav of Object.values(NAVIGATION)) {
  const entry = sources.find(
    (s) => s.map === nav.id && s.id.startsWith("autotiles-"),
  );
  const raw = decode(entry.source),
    frames = [];
  for (let i = 0; i < 16; i++) {
    const rect = cell(raw, 4, 4, i % 4, Math.floor(i / 4));
    rect.sx += 2;
    rect.sy += 2;
    rect.sw -= 4;
    rect.sh -= 4;
    frames.push(sampleNearest(raw, rect, NATIVE_TILE, NATIVE_TILE, true));
  }
  // Canonical strips come from the top or left edge of a generated matching tile.
  // Width two pixels, with corner pixels canonical for their single material.
  const authored = frames.map((f) => ({ ...f, data: Buffer.from(f.data) }));
  const edges = [0, 1, 2, 3].map((code) => {
    const hi = (code >> 1) & 1,
      lo = code & 1;
    // A homogeneous edge must use the homogeneous material, not a corner
    // tile whose flowers or coastline can bleed into an otherwise open road.
    return {
      h: authored[hi === lo ? (hi ? 15 : 0) : hi | (lo * 2)],
      v: authored[hi === lo ? (hi ? 15 : 0) : hi | (lo * 8)],
    };
  });
  // Preserve exact shared boundary pixels, then ease their authored texture
  // into each tile's interior. This is palette-only atlas stitching, not blur
  // applied to actors or artwork; the original authored pixels remain crisp.
  const BAND = 12 * RESOLUTION;
  const copy = (src, sx, sy, dst, dx, dy, weight = 1) => {
    const from = (sy * NATIVE_TILE + sx) * 4,
      to = (dy * NATIVE_TILE + dx) * 4;
    if (weight >= 1) {
      src.data.copy(dst.data, to, from, from + 4);
      return;
    }
    const c = paletteColor(
      ...[0, 1, 2].map((i) =>
        Math.round(
          src.data[from + i] * weight + dst.data[to + i] * (1 - weight),
        ),
      ),
    );
    for (let i = 0; i < 3; i++) dst.data[to + i] = c[i];
  };
  for (let mask = 0; mask < 16; mask++) {
    const f = frames[mask],
      tl = mask & 1 ? 1 : 0,
      tr = mask & 2 ? 1 : 0,
      br = mask & 4 ? 1 : 0,
      bl = mask & 8 ? 1 : 0;
    for (let t = 0; t < BAND; t++)
      for (let p = EDGE; p < NATIVE_TILE - EDGE; p++) {
        const weight = t < EDGE ? 1 : (BAND - t) / (BAND - EDGE);
        copy(edges[tl * 2 + tr].h, p, t, f, p, t, weight);
        copy(edges[bl * 2 + br].h, p, t, f, p, NATIVE_TILE - 1 - t, weight);
        copy(edges[tl * 2 + bl].v, t, p, f, t, p, weight);
        copy(edges[tr * 2 + br].v, t, p, f, NATIVE_TILE - 1 - t, p, weight);
      }
    for (const [cx, cy, bit] of [
      [0, 0, tl],
      [NATIVE_TILE - EDGE, 0, tr],
      [NATIVE_TILE - EDGE, NATIVE_TILE - EDGE, br],
      [0, NATIVE_TILE - EDGE, bl],
    ])
      for (let y = 0; y < EDGE; y++)
        for (let x = 0; x < EDGE; x++)
          copy(frames[bit ? 15 : 0], EDGE, EDGE, f, cx + x, cy + y);
  }
  const atlas = rgba(NATIVE_TILE * 4, NATIVE_TILE * 4);
  frames.forEach((f, i) =>
    blit(f, atlas, (i % 4) * NATIVE_TILE, Math.floor(i / 4) * NATIVE_TILE),
  );
  await save(atlas, "world/tiles-" + nav.id, entry, {
    cols: 4,
    rows: 4,
    cellSize: NATIVE_TILE,
    autotile: "corner-16",
  });
  const full = rgba(nav.width, nav.height);
  for (let y = 0; y < nav.height; y++)
    for (let x = 0; x < nav.width; x++) {
      const cx = Math.floor(x / TILE + 0.5),
        cy = Math.floor(y / TILE + 0.5),
        f = frames[nav.transitions[cy][cx]],
        sx = (x + TILE / 2) % TILE,
        sy = (y + TILE / 2) % TILE;
      f.data.copy(
        full.data,
        (y * nav.width + x) * 4,
        (sy * RESOLUTION * NATIVE_TILE + sx * RESOLUTION) * 4,
        (sy * RESOLUTION * NATIVE_TILE + sx * RESOLUTION) * 4 + 4,
      );
    }
  for (const p of nav.props.toSorted((a, b) => a.py - b.py)) {
    const sx = (p.index % 4) * propSize,
      sy = Math.floor(p.index / 4) * propSize,
      ox = Math.round(p.px - 128),
      oy = Math.round(p.py - 254);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const at =
            ((sy + y * RESOLUTION) * propAtlas.width + sx + x * RESOLUTION) * 4,
          tx = ox + x,
          ty = oy + y;
        if (
          tx >= 0 &&
          ty >= 0 &&
          tx < nav.width &&
          ty < nav.height &&
          propAtlas.data[at + 3]
        )
          propAtlas.data.copy(full.data, (ty * nav.width + tx) * 4, at, at + 4);
      }
  }
  const fit = Math.min(384 / nav.width, 256 / nav.height);
  await save(
    sample(
      full,
      { sx: 0, sy: 0, sw: full.width, sh: full.height },
      Math.round(nav.width * fit) * RESOLUTION,
      Math.round(nav.height * fit) * RESOLUTION,
      true,
    ),
    "maps/" + nav.id,
    entry,
    { worldWidth: nav.width, worldHeight: nav.height },
  );
  console.log("Connected terrain: " + nav.id);
}
manifest.version = RESOLUTION === 2 ? 8 : 7;
for (const t of Object.values(manifest.world.tiles)) t.size = NATIVE_TILE;
manifest.world.nativeTileSize = NATIVE_TILE;
manifest.world.props.size = propSize;
manifest.world.resolutionScale = RESOLUTION;
manifest.world.autotile = "corner-16";
const replaced = new Set(assets.map((a) => a.id));
records.assets = [
  ...records.assets.filter((a) => !replaced.has(a.id)),
  ...assets,
];
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
