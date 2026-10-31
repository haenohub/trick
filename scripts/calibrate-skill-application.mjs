// Read existing authored pixels; change only placement metadata, never artwork.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode } from "./pack-pixel-art.mjs";
import { SKILL_VISUALS } from "../site/skill-visuals.js";

const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
// Ground bands isolate the painted contact plane from rising foliage/particles.
// Fixed anchors retain deliberate motion in free bursts and flying projectiles.
const profiles = {
  "warden-0": { kind: "line", scale: 1, travel: 0.22 },
  "warden-1": { kind: "self", scale: 1, fixed: [64, 94] },
  "warden-2": { kind: "ground", maxScale: 1.5, band: [98, 122], depth: 10 },
  antler: { kind: "body", scale: 1, fixed: [64, 105] },
  thorn: { kind: "impact", scale: 1, fixed: [64, 64] },
  "mage-0": { kind: "impact", scale: 0.75 },
  "mage-1": { kind: "impact", scale: 1.25 },
  "mage-2": { kind: "ground", maxScale: 1.5, band: [105, 122], depth: 12 },
  moon: { kind: "beam", scale: 1.5, band: [105, 122], depth: 10 },
  bloom: { kind: "ground", maxScale: 1.5, band: [105, 122], depth: 8 },
  "ranger-0": { kind: "line", scale: 0.75, travel: 0.22 },
  "ranger-1": { kind: "ground", maxScale: 2, band: [110, 122], depth: 5 },
  "ranger-2": { kind: "impact", scale: 0.75 },
  hawk: { kind: "line", scale: 1.25, travel: 0.32 },
  mist: { kind: "ground", maxScale: 1.5, band: [103, 122], depth: 10 },
  "herbalist-0": { kind: "ground", maxScale: 1.5, band: [105, 122], depth: 12 },
  "herbalist-1": { kind: "impact", scale: 0.75 },
  "herbalist-2": {
    kind: "ground",
    maxScale: 2,
    band: [82, 122],
    depth: 20,
    hold: [5, 6, 7, 6],
  },
  flower: { kind: "ground", maxScale: 1.5, band: [105, 122], depth: 12 },
  venom: { kind: "ground", maxScale: 1.5, band: [100, 122], depth: 12 },
  "warden-4": {
    kind: "ground",
    maxScale: 1.5,
    band: [85, 117],
    depth: 18,
    burstFrom: 7,
    burstAnchor: [64, 85],
  },
  "warden-5": { kind: "self", scale: 1, fixed: [64, 75] },
  "mage-4": { kind: "ground", maxScale: 1.5, band: [99, 123], depth: 11 },
  "mage-5": { kind: "ground", maxScale: 1, band: [101, 122], depth: 12 },
  "ranger-4": { kind: "line", scale: 1, travel: 0.32, fixed: [64, 79] },
  "ranger-5": { kind: "body", scale: 1, fixed: [64, 86] },
  "herbalist-4": { kind: "ground", maxScale: 1.5, band: [108, 123], depth: 8 },
  "herbalist-5": { kind: "ground", maxScale: 1, band: [102, 120], depth: 11 },
};
const cache = new Map();
const audit = {
  version: 29,
  method:
    "native-cell placement with measured ground contact; fixed clip scale and integer anchors; no pixel changes",
  skills: {},
};
const quantile = (a, t) =>
  a[Math.min(a.length - 1, Math.floor((a.length - 1) * t))];
art.skillApplication = {};
for (const [key, v] of Object.entries(SKILL_VISUALS)) {
  const profile = profiles[key];
  if (!profile) throw Error("Unreviewed skill " + key);
  const atlas = (
    v.atlas === "expanded" ? art.expandedSkillEffects : art.skillEffects
  )[v.classId];
  if (!cache.has(atlas.file))
    cache.set(atlas.file, decode("site/assets/" + atlas.file + ".png"));
  const image = cache.get(atlas.file),
    count = atlas.rowFrames[v.row],
    measurements = [];
  for (let f = 0; f < count; f++) {
    const xs = [],
      ys = [];
    for (let y = 4; y < 124; y++)
      for (let x = 4; x < 124; x++) {
        if (
          !image.data[((v.row * 128 + y) * image.width + f * 128 + x) * 4 + 3]
        )
          continue;
        if (profile.band && y >= profile.band[0] && y <= profile.band[1]) {
          xs.push(x);
          ys.push(y);
        }
      }
    xs.sort((a, b) => a - b);
    ys.sort((a, b) => a - b);
    const width = xs.length ? quantile(xs, 0.97) - quantile(xs, 0.03) + 1 : 0;
    measurements.push({
      width,
      ink: xs.length,
      anchor:
        width >= 12 && xs.length >= 35
          ? [
              Math.round((quantile(xs, 0.03) + quantile(xs, 0.97)) / 2),
              Math.round(quantile(ys, 0.99) - profile.depth),
            ]
          : null,
    });
  }
  const reference = measurements.slice(3, 8).find((m) => m.anchor)?.anchor ||
    profile.fixed || [64, 64];
  const anchors = measurements.map(
    (m, f) =>
      profile.fixed ||
      (f >= profile.burstFrom ? profile.burstAnchor : m.anchor || reference),
  );
  // Dispersing leaves have no stable contact plane: retain the last settled
  // origin rather than following a stray fragment across the closing frames.
  if (profile.band && !profile.burstFrom) {
    const settle = Math.min(count - 1, Math.floor(count * 0.65));
    for (let f = settle + 1; f < count; f++) anchors[f] = anchors[settle];
  }
  const footprint = Math.max(32, ...measurements.map((m) => m.width));
  const application = {
    ...profile,
    anchors,
    footprint,
    size: 128,
    version: 29,
  };
  delete application.fixed;
  delete application.band;
  delete application.depth;
  delete application.burstFrom;
  delete application.burstAnchor;
  art.skillApplication[key] = application;
  audit.skills[key] = {
    file: atlas.file,
    row: v.row,
    count,
    sha256: createHash("sha256")
      .update(await readFile("site/assets/" + atlas.file + ".png"))
      .digest("hex"),
    profile,
    measurements,
    application,
  };
}
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/skill-application-v29.json",
  JSON.stringify(audit, null, 2) + "\n",
);
console.log(
  "Registered all 28 skill clips without repainting or resizing source pixels",
);
