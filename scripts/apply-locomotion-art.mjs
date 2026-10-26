// Technical packing only. image_gen authors each directional cycle; one common
// registration scale is used for every walk and idle pose in a direction.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
const plan = await json("art/locomotion-sources.json");
const art = await json("site/assets/manifest.json");
const records = await json("art/generated-assets.json");
const only = process.argv
  .find((a) => a.startsWith("--only="))
  ?.slice(7)
  .split(",");
const available = process.argv.includes("--available");
if (!only && !available && (plan.pending.length || plan.sources.length !== 144))
  throw Error(
    "Finish all 144 directional sources first, or use --available for complete actors only",
  );
const median = (a) => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
function bounds(image) {
  let minX = image.width,
    minY = image.height,
    maxX = -1,
    maxY = -1,
    mass = 0,
    cx = 0,
    cy = 0;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (image.data[(y * image.width + x) * 4 + 3] >= 140) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        mass++;
        cx += x;
        cy += y;
      }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    cx: cx / mass,
    cy: cy / mass,
  };
}
const packed = new Map();
for (const entry of plan.sources.filter(
  (a) => !only || a.actors.some((x) => only.includes(x.id)),
)) {
  const source = decode(entry.source);
  for (let i = 3; i < source.data.length; i += 4)
    if (source.data[i] < 220) source.data[i] = 0;
  const rects = directionalRects(source);
  for (const actor of entry.actors.filter(
    (a) => !only || only.includes(a.id),
  )) {
    const layout =
        art.characterLayouts[actor.id] ||
        art.npcLayouts[actor.id] ||
        art.monsters[actor.id],
      size = layout.size;
    const approved = decode(
      "site/assets/" + layout.views[entry.direction] + ".png",
    );
    const original = bounds(approved),
      both = [...rects[actor.walkRow], ...rects[actor.idleRow]];
    const scale = Math.min(
      original.height / median(both.map((r) => r.sh)),
      ...both.map((r) => (size - 8) / Math.max(r.sw, r.sh)),
    );
    for (const kind of ["walk", "idle"]) {
      const key = actor.id + "-" + kind;
      if (!packed.has(key))
        packed.set(key, {
          actor: actor.id,
          kind,
          size,
          layout,
          atlas: rgba(size * 8, size * 8),
          sources: [],
          directions: [],
          measurements: [],
        });
      const result = packed.get(key),
        row = actor[kind + "Row"];
      result.sources.push({
        source: entry.source,
        id: entry.id,
        sourceRow: row,
        direction: entry.direction,
        destinationRow: entry.directionRow,
        scale,
      });
      result.directions.push(entry.direction);
      for (let col = 0; col < 8; col++) {
        const rect = rects[row][col],
          cropped = rgba(rect.sw, rect.sh);
        for (const part of rect.components)
          for (let y = part.minY; y <= part.maxY; y++)
            for (let x = part.minX; x <= part.maxX; x++) {
              const from = (y * source.width + x) * 4,
                to = ((y - rect.sy) * rect.sw + x - rect.sx) * 4;
              source.data.copy(cropped.data, to, from, from + 4);
            }
        const w = Math.max(1, Math.round(rect.sw * scale)),
          h = Math.max(1, Math.round(rect.sh * scale));
        const f = sampleNearest(
          cropped,
          { sx: 0, sy: 0, sw: rect.sw, sh: rect.sh },
          w,
          h,
        );
        const mass = bounds(f);
        // A reaching toe changes the bounding box without moving the body root.
        // Walking aligns mass to the approved body root; idle plants the feet.
        const px = Math.max(
          4,
          Math.min(size - 4 - w, Math.round(original.cx - mass.cx)),
        );
        const py =
          kind === "idle"
            ? size - 4 - h
            : Math.max(
                4,
                Math.min(size - 4 - h, Math.round(original.cy - mass.cy)),
              );
        blit(f, result.atlas, col * size + px, entry.directionRow * size + py);
        result.measurements.push({
          row: entry.directionRow,
          col,
          width: w,
          height: h,
        });
      }
    }
  }
  console.log("read " + entry.id);
}
for (const [key, a] of packed) {
  if (a.directions.length !== 8 || new Set(a.directions).size !== 8) {
    console.log("incomplete " + key + " " + a.directions.length + "/8");
    continue;
  }
  const file = "locomotion/" + key,
    target = "site/assets/" + file + ".png";
  await mkdir(dirname(target), { recursive: true });
  await png(a.atlas, target);
  records.assets = records.assets.filter((x) => x.id !== file);
  records.assets.push({
    id: file,
    target,
    tool: "image_gen",
    source: a.sources[0].source,
    additionalSources: a.sources.slice(1).map((x) => x.source),
    width: a.atlas.width,
    height: a.atlas.height,
    sha256: createHash("sha256")
      .update(await readFile(target))
      .digest("hex"),
    motionVersion: 3,
    registration: {
      method: "one-scale-body-root",
      anchor: a.kind === "idle" ? "planted-feet" : "body-root",
      directions: a.sources,
    },
    measurements: a.measurements,
  });
  if (!art.files.includes(file)) art.files.push(file);
  a.layout.clips ||= {};
  a.layout.clips[a.kind] = {
    file,
    cols: 8,
    rows: 8,
    size: a.size,
    frames: [0, 1, 2, 3, 4, 5, 6, 7],
    duration: a.kind === "walk" ? 1.28 : 0.72,
    loop: true,
  };
  a.layout.locomotionVersion = 3;
  console.log("packed " + key);
}
art.version = 10;
const layouts = { ...art.characterLayouts, ...art.npcLayouts, ...art.monsters };
const ready = Object.entries(layouts)
  .filter(([id, l]) => l.clips?.walk && l.clips?.idle)
  .map(([id]) => id);
art.locomotion = {
  version: 3,
  actors: ready.length,
  totalActors: 72,
  complete: ready.length === 72,
  pendingActors: Object.keys(layouts).filter((id) => !ready.includes(id)),
  directions: plan.directionOrder,
  walkFrames: 8,
  idleFrames: 8,
  source: "image_gen",
  oneDirectionPerSource: true,
  referenceVideo: plan.referenceVideo,
};
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
