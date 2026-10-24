// Run after all image_gen originals are present. Technical packing only.
import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { execFileSync } from "node:child_process";
const registry = JSON.parse(
  await readFile("art/refinement-sources.json", "utf8"),
);
if (registry.sources.length !== 67)
  throw Error("All 67 replacement originals are required");
const actorSources = registry.sources.filter((s) => s.kind);
const baseSources = registry.sources.filter((s) => !s.kind);
if (actorSources.length !== 52 || baseSources.length !== 15)
  throw Error("Incomplete source categories");
await writeFile(
  "art/directional-sources.json",
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      directionOrder: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
      sources: actorSources,
    },
    null,
    2,
  ) + "\n",
);
const historical = JSON.parse(await readFile("art/pixel-sources.json", "utf8"));
historical.sources = historical.sources.map(
  (s) => baseSources.find((b) => b.id === s.id) || s,
);
await writeFile(
  "art/pixel-sources.json",
  JSON.stringify(historical, null, 2) + "\n",
);
execFileSync(process.execPath, ["scripts/build-shared-palette.mjs"], {
  stdio: "inherit",
});
const { packPixelArt } = await import("./pack-pixel-art.mjs");
const { packDirections } = await import("./pack-directions.mjs");
const baseDir = "/tmp/leaftale-refined-base",
  actorsDir = "/tmp/leaftale-refined-actors";
const base = await packPixelArt({
  sourceFile: "art/refinement-sources.json",
  output: baseDir,
  only: baseSources.map((s) => s.id),
});
const actors = await packDirections({ output: actorsDir });
// Both source sets must pack successfully before any runtime PNG is changed.
for (const a of base.assets) {
  await mkdir(dirname(a.target), { recursive: true });
  await copyFile(baseDir + "/" + a.id + ".png", a.target);
}
for (const a of actors.assets) {
  await mkdir(dirname(a.target), { recursive: true });
  await copyFile(actorsDir + "/" + a.id + ".png", a.target);
}
await copyFile(actorsDir + "/manifest.json", "site/assets/manifest.json");
const final = JSON.parse(
  await readFile(actorsDir + "/generated-assets.json", "utf8"),
);
const baseIds = new Set(base.assets.map((a) => a.id));
final.assets = [
  ...final.assets.filter((a) => !baseIds.has(a.id)),
  ...base.assets,
];
final.style =
  "Fine pastel pixel art matching the user video, selective local-color outlines, uniform two-screen-pixel grid";
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(final, null, 2) + "\n",
);
execFileSync(
  process.execPath,
  ["scripts/audit-pixel-style.mjs", "/tmp/leaftale-style-after.json"],
  { stdio: "inherit" },
);
const before = JSON.parse(
  await readFile("/tmp/leaftale-style-before.json", "utf8"),
);
const after = JSON.parse(
  await readFile("/tmp/leaftale-style-after.json", "utf8"),
);
await writeFile(
  "art/style-audit.json",
  JSON.stringify(
    {
      reference: {
        file: "몬스터 샘플.mp4",
        width: 156,
        height: 102,
        seconds: 4.166633,
      },
      pixelGrid: { native: 1, display: 2 },
      before,
      after,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Applied all " +
    final.assets.length +
    " new PNGs; black edge fraction " +
    before.darkEdgeFraction +
    " -> " +
    after.darkEdgeFraction,
);
