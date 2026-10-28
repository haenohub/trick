import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, sampleNearest, blit, png } from "./pack-pixel-art.mjs";
const plan = JSON.parse(await readFile("art/ambient-sources.json")),
  src = decode(plan.source),
  out = rgba(512, 256);
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
      64,
      64,
    );
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++)
        if (x < 4 || y < 4 || x >= 60 || y >= 60)
          f.data.fill(0, (y * 64 + x) * 4, (y * 64 + x + 1) * 4);
    blit(f, out, c * 64, r * 64);
  }
const target = "site/assets/ambient.png";
await png(out, target);
const art = JSON.parse(await readFile("site/assets/manifest.json"));
art.ambient = { file: "ambient", cols: 8, rows: 4, size: 64 };
if (!art.files.includes("ambient")) art.files.push("ambient");
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
const records = JSON.parse(await readFile("art/generated-assets.json"));
records.assets = records.assets.filter((r) => r.id !== "ambient");
records.assets.push({
  id: "ambient",
  target,
  source: plan.source,
  tool: "image_gen",
  width: 512,
  height: 256,
  sha256: createHash("sha256")
    .update(await readFile(target))
    .digest("hex"),
});
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
