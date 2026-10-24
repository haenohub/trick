// Technical assembly of image-generated terrain tiles and scenery; no art shapes.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import {
  decode,
  rgba,
  blit,
  png,
  sample,
  cell,
  entityFrames,
} from "./pack-pixel-art.mjs";
import { NAVIGATION, TILE } from "../site/world-layout.js";
const sources = JSON.parse(
  await readFile("art/world-sources.json", "utf8"),
).sources;
const manifest = JSON.parse(
  await readFile("site/assets/manifest.json", "utf8"),
);
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
const assets = [];
const tiles = {};
async function save(im, file, source, extra = {}) {
  const target = "site/assets/" + file + ".png";
  await mkdir(dirname(target), { recursive: true });
  await png(im, target);
  assets.push({
    id: file,
    target,
    tool: "image_gen",
    source: source.source,
    request: source.id,
    width: im.width,
    height: im.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    processing:
      "Native image-generated tiles/scenery; shared palette; layout assembly without stretching terrain",
    ...extra,
  });
}
const propSource = sources.find((s) => s.id === "world-props");
const propFrames = entityFrames(
  decode(propSource.source),
  4,
  4,
  [0, 1, 2, 3],
  256,
);
const props = rgba(1024, 1024);
propFrames.forEach((f, i) =>
  blit(f, props, (i % 4) * 256, Math.floor(i / 4) * 256),
);
await save(props, "world/props", propSource, {
  cols: 4,
  rows: 4,
  cellSize: 256,
});
for (const nav of Object.values(NAVIGATION)) {
  const source = sources.find((s) => s.map === nav.id),
    raw = decode(source.source),
    atlas = rgba(TILE * 4, TILE * 4),
    frames = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const rect = cell(raw, 4, 4, c, r);
      rect.sx += 2;
      rect.sy += 2;
      rect.sw -= 4;
      rect.sh -= 4;
      const frame = sample(raw, rect, TILE, TILE, true);
      frames.push(frame);
      blit(frame, atlas, c * TILE, r * TILE);
    }
  const file = "world/tiles-" + nav.id;
  await save(atlas, file, source, { cols: 4, rows: 4, cellSize: TILE });
  tiles[nav.id] = { file, size: TILE, cols: 4, rows: 4 };
  const full = rgba(nav.width, nav.height);
  for (let r = 0; r < nav.rows; r++)
    for (let c = 0; c < nav.cols; c++)
      blit(frames[nav.tiles[r][c]], full, c * TILE, r * TILE);
  // The overview is a small navigation image, never the source of world terrain.
  const ordered = nav.props.toSorted((a, b) => a.py - b.py);
  for (const p of ordered) {
    const image = propFrames[p.index],
      ox = Math.round(p.px - image.width / 2),
      oy = Math.round(p.py - image.height + 2);
    for (let y = 0; y < image.height; y++)
      for (let x = 0; x < image.width; x++) {
        const tx = x + ox,
          ty = y + oy,
          at = (y * image.width + x) * 4;
        if (
          tx >= 0 &&
          ty >= 0 &&
          tx < full.width &&
          ty < full.height &&
          image.data[at + 3]
        )
          image.data.copy(full.data, (ty * full.width + tx) * 4, at, at + 4);
      }
  }
  const fit = Math.min(384 / nav.width, 256 / nav.height),
    w = Math.round(nav.width * fit),
    h = Math.round(nav.height * fit);
  await save(
    sample(full, { sx: 0, sy: 0, sw: full.width, sh: full.height }, w, h, true),
    "maps/" + nav.id,
    source,
    {
      worldWidth: nav.width,
      worldHeight: nav.height,
      additionalSources: [propSource.source],
    },
  );
  console.log(
    nav.id,
    nav.width + "x" + nav.height,
    "area " + nav.areaScale.toFixed(2) + "x",
    "walk " + nav.walkableScale.toFixed(2) + "x",
  );
}
manifest.version = 6;
manifest.world = {
  tiles,
  props: { file: "world/props", cols: 4, rows: 4, size: 256 },
  tileSize: TILE,
  maps: Object.fromEntries(
    Object.values(NAVIGATION).map((n) => [
      n.id,
      {
        width: n.width,
        height: n.height,
        areaScale: n.areaScale,
        walkableScale: n.walkableScale,
        shape: n.shape,
      },
    ]),
  ),
};
manifest.files = [
  ...new Set([
    ...manifest.files,
    ...Object.values(tiles).map((t) => t.file),
    "world/props",
  ]),
];
const replaced = new Set(assets.map((a) => a.id));
records.assets = [
  ...records.assets.filter((a) => !replaced.has(a.id)),
  ...assets,
];
records.generatedAt = new Date().toISOString();
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
