// Quantization metadata only: no artwork is drawn or outlined.
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const registry = JSON.parse(
  await readFile(process.argv[2] || "art/refinement-sources.json", "utf8"),
);
const paths = registry.sources.map((a) => a.source);
const pixels = execFileSync(
  "magick",
  [
    ...paths,
    "-thumbnail",
    "128x128!",
    "-background",
    "#f4f4ed",
    "-alpha",
    "remove",
    "-alpha",
    "off",
    "+append",
    "-dither",
    "None",
    "-colors",
    "256",
    "-unique-colors",
    "-depth",
    "8",
    "txt:-",
  ],
  { encoding: "utf8", maxBuffer: 1024 * 1024 },
);
const colors = [
  ...new Set(
    [...pixels.matchAll(/#([0-9A-Fa-f]{6})(?:\s|$)/g)].map((m) =>
      m[1].toLowerCase(),
    ),
  ),
];
if (colors.length < 128 || colors.length > 256)
  throw Error("Expected 128–256 palette entries, received " + colors.length);
await writeFile(
  "art/shared-palette.json",
  JSON.stringify(
    {
      name: "LeafTale video-reference pastel palette",
      size: colors.length,
      colors,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Built shared " +
    colors.length +
    "-color palette from " +
    paths.length +
    " generated originals",
);
