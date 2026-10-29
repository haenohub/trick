import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, sampleNearest, blit, png } from "./pack-pixel-art.mjs";
const plan = JSON.parse(await readFile("art/targeted-combat-vfx.json")),
  src = decode(plan.source),
  out = rgba(768, 384);
for (let i = 3; i < src.data.length; i += 4)
  if (src.data[i] < 220) src.data[i] = 0;
for (let r = 0; r < 4; r++)
  for (let c = 0; c < 8; c++) {
    const f = sampleNearest(
      src,
      {
        sx: (c * src.width) / 8,
        sy: (r * src.height) / 4,
        sw: src.width / 8,
        sh: src.height / 4,
      },
      96,
      96,
    );
    for (let y = 0; y < 96; y++)
      for (let x = 0; x < 96; x++)
        if (x < 4 || y < 4 || x >= 92 || y >= 92)
          f.data.fill(0, (y * 96 + x) * 4, (y * 96 + x + 1) * 4);
    blit(f, out, c * 96, r * 96);
  }
const file = "targeted-combat",
  target = "site/assets/" + file + ".png";
await png(out, target);
const art = JSON.parse(await readFile("site/assets/manifest.json"));
art.targetCombat = { file, cols: 8, rows: 4, size: 96 };
if (!art.files.includes(file)) art.files.push(file);
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
const records = JSON.parse(await readFile("art/generated-assets.json"));
records.assets = records.assets.filter((r) => r.id !== file);
records.assets.push({
  id: file,
  target,
  source: plan.source,
  tool: "image_gen",
  width: 768,
  height: 384,
  sha256: createHash("sha256")
    .update(await readFile(target))
    .digest("hex"),
});
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
