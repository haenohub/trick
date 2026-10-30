// Register two four-heading originals; never mirror or substitute a pose.
import { readFile, writeFile } from "node:fs/promises";
import { decode, rgba, blit, png } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const plan = JSON.parse(await readFile("art/v24-art.json", "utf8")),
  sources = [];
for (const id of ["warden", "mage", "ranger", "herbalist"]) {
  const jobs = plan.sources
      .filter((j) => j.actor === id)
      .sort((a, b) => a.half - b.half),
    out = rgba(3072, 3072);
  for (const job of jobs) {
    const src = decode(job.source),
      grid = directionalRects(src, 8, 4, { minArea: 0.025 });
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 8; col++) {
        const r = grid[row][col],
          cut = rgba(r.sw, r.sh);
        for (let y = 0; y < r.sh; y++)
          src.data.copy(
            cut.data,
            y * r.sw * 4,
            ((r.sy + y) * src.width + r.sx) * 4,
            ((r.sy + y) * src.width + r.sx + r.sw) * 4,
          );
        if (r.sw > 360 || r.sh > 360)
          throw Error("Source cell needs larger registration canvas");
        blit(cut, out, col * 384 + 12, (row + job.half * 4) * 384 + 12);
      }
  }
  const packedSource = "/tmp/v24-body-" + id + ".png";
  await png(out, packedSource);
  sources.push({
    id,
    source: jobs[0].source,
    additionalSources: [jobs[1].source],
    packedSource,
    tool: "image_gen",
  });
}
await writeFile(
  "art/dynamic-motion-v24.json",
  JSON.stringify({ version: 1, status: "packing", sources }, null, 2) + "\n",
);
