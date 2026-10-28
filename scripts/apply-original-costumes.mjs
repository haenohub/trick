// Register image_gen-authored original costumes on the existing per-pose rig.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, sampleNearest, png } from "./pack-pixel-art.mjs";
const plan = JSON.parse(await readFile("art/original-costumes.json", "utf8"));
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8"));
if(art.appearance.mode==="integrated-clothed-body-with-equipped-weapon")throw Error("Use apply-dressed-players.mjs for integrated character art");
const src = decode(plan.source);
for (let i = 3; i < src.data.length; i += 4)
  if (src.data[i] < 220) src.data[i] = 0;
for (const [row, id] of ["warden", "mage", "ranger", "herbalist"].entries()) {
  const l = art.appearance.bases[id],
    out = rgba(3072, 768);
  for (let dir = 0; dir < 8; dir++) {
    const sampled = sampleNearest(
      src,
      {
        sx: (dir * src.width) / 8,
        sy: (row * src.height) / 4,
        sw: src.width / 8,
        sh: src.height / 4,
      },
      96,
      96,
    );
    const cell = rgba(96, 96),
      scale = id === "warden" || id === "ranger" ? 0.56 : 0.82;
    const resized = sampleNearest(
      sampled,
      { sx: 0, sy: 0, sw: 96, sh: 96 },
      Math.round(96 * scale),
      Math.round(96 * scale),
    );
    const ox = Math.round((96 - resized.width) / 2),
      oy = 92 - resized.height;
    for (let y = 0; y < resized.height; y++)
      for (let x = 0; x < resized.width; x++) {
        const a = (y * resized.width + x) * 4,
          b = ((oy + y) * 96 + ox + x) * 4;
        resized.data.copy(cell.data, b, a, a + 4);
      }
    const reference = l.anchors[dir][24];
    for (let col = 0; col < 32; col++)
      for (let y = 4; y < 92; y++)
        for (let x = 4; x < 92; x++) {
          const joint = y < 45 ? "head" : y < 78 ? "torso" : "feet",
            a = l.anchors[dir][col][joint],
            b = reference[joint];
          let dx = a[0] - b[0],
            dy = a[1] - b[1];
          if (y >= 78 && col >= 16 && col < 24) {
            const step =
              Math.sin(((col - 16) * Math.PI) / 4) * (x < 48 ? 1 : -1);
            dx += Math.round(step * 2);
            dy += Math.round(Math.max(0, step) * -2);
          }
          const tx = x + dx,
            ty = y + dy;
          if (tx < 4 || ty < 4 || tx >= 92 || ty >= 92) continue;
          const from = (y * 96 + x) * 4,
            to = ((dir * 96 + ty) * out.width + col * 96 + tx) * 4;
          if (cell.data[from + 3]) cell.data.copy(out.data, to, from, from + 4);
        }
  }
  const file = `appearance/gear/${id}-${id}armor1`,
    target = `site/assets/${file}.png`;
  await png(out, target);
  l.costumeFile = file;
  const r = records.assets.find((r) => r.id === file);
  r.source = plan.source;
  r.additionalSources = [];
  r.fixedOriginalCostume = true;
  r.sha256 = createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
}
art.appearance.mode = "original-costume-with-equipped-weapon";
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
