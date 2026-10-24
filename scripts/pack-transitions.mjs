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
  cell,
  blit,
} from "./pack-pixel-art.mjs";
import { NAVIGATION, TILE } from "../site/world-layout.js";
const sources = JSON.parse(
  await readFile("art/crisp-sources.json", "utf8"),
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
    frames.push(sampleNearest(raw, rect, TILE, TILE, true));
  }
  // Canonical strips come from the top or left edge of a generated matching tile.
  // Width two pixels, with corner pixels canonical for their single material.
  const edges = [0, 1, 2, 3].map((code) => {
    const hi = (code >> 1) & 1,
      lo = code & 1;
    return { h: frames[hi | (lo * 2)], v: frames[hi | (lo * 8)] };
  });
  const copy = (src, sx, sy, dst, dx, dy) =>
    src.data.copy(
      dst.data,
      (dy * TILE + dx) * 4,
      (sy * TILE + sx) * 4,
      (sy * TILE + sx) * 4 + 4,
    );
  for (let mask = 0; mask < 16; mask++) {
    const f = frames[mask],
      tl = mask & 1 ? 1 : 0,
      tr = mask & 2 ? 1 : 0,
      br = mask & 4 ? 1 : 0,
      bl = mask & 8 ? 1 : 0;
    for (let t = 0; t < 2; t++)
      for (let p = 2; p < TILE - 2; p++) {
        copy(edges[tl * 2 + tr].h, p, t, f, p, t);
        copy(edges[bl * 2 + br].h, p, t, f, p, TILE - 1 - t);
        copy(edges[tl * 2 + bl].v, t, p, f, t, p);
        copy(edges[tr * 2 + br].v, t, p, f, TILE - 1 - t, p);
      }
    for (const [cx, cy, bit] of [
      [0, 0, tl],
      [TILE - 2, 0, tr],
      [TILE - 2, TILE - 2, br],
      [0, TILE - 2, bl],
    ])
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++)
          copy(frames[bit ? 15 : 0], 2, 2, f, cx + x, cy + y);
  }
  const atlas = rgba(TILE * 4, TILE * 4);
  frames.forEach((f, i) =>
    blit(f, atlas, (i % 4) * TILE, Math.floor(i / 4) * TILE),
  );
  await save(atlas, "world/tiles-" + nav.id, entry, {
    cols: 4,
    rows: 4,
    cellSize: TILE,
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
        (sy * TILE + sx) * 4,
        (sy * TILE + sx) * 4 + 4,
      );
    }
  for (const p of nav.props.toSorted((a, b) => a.py - b.py)) {
    const sx = (p.index % 4) * 256,
      sy = Math.floor(p.index / 4) * 256,
      ox = Math.round(p.px - 128),
      oy = Math.round(p.py - 254);
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const at = ((sy + y) * propAtlas.width + sx + x) * 4,
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
      Math.round(nav.width * fit),
      Math.round(nav.height * fit),
      true,
    ),
    "maps/" + nav.id,
    entry,
    { worldWidth: nav.width, worldHeight: nav.height },
  );
  console.log("Connected terrain: " + nav.id);
}
manifest.version = 7;
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
