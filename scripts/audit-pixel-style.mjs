import { readFile, writeFile } from "node:fs/promises";
import { rgbaPixels } from "../tests/png.mjs";
import { CLASSES, NPCS, MONSTERS } from "../site/data.js";
const records = [];
for (const actor of [...CLASSES, ...NPCS, ...MONSTERS]) {
  const { width, height, pixels } = rgbaPixels(
    await readFile(`site/assets/directions/${actor.id}/S.png`),
  );
  let solid = 0,
    dark = 0,
    edge = 0,
    darkEdge = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (!pixels[at + 3]) continue;
      solid++;
      const ink = Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) < 80;
      if (ink) dark++;
      const border = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(
        ([dx, dy]) =>
          x + dx < 0 ||
          y + dy < 0 ||
          x + dx >= width ||
          y + dy >= height ||
          !pixels[((y + dy) * width + x + dx) * 4 + 3],
      );
      if (border) {
        edge++;
        if (ink) darkEdge++;
      }
    }
  records.push({ id: actor.id, solid, dark, edge, darkEdge });
}
const total = records.reduce(
  (s, r) => ({
    solid: s.solid + r.solid,
    dark: s.dark + r.dark,
    edge: s.edge + r.edge,
    darkEdge: s.darkEdge + r.darkEdge,
  }),
  { solid: 0, dark: 0, edge: 0, darkEdge: 0 },
);
const result = {
  definition:
    "Near black: all RGB channels below 80; edge: an opaque pixel adjacent to transparency",
  ...total,
  darkFraction: total.dark / total.solid,
  darkEdgeFraction: total.darkEdge / total.edge,
  actors: records,
};
await writeFile(
  process.argv[2] || "/tmp/leaftale-style-audit.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    darkFraction: result.darkFraction,
    darkEdgeFraction: result.darkEdgeFraction,
  }),
);
