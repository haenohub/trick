import { readFile, writeFile } from "node:fs/promises";
const refinement = JSON.parse(
  await readFile(
    new URL("../art/refinement-sources.json", import.meta.url),
    "utf8",
  ),
);
const world = JSON.parse(
  await readFile(new URL("../art/world-sources.json", import.meta.url), "utf8"),
);
const requests = [
  ...refinement.sources.filter((s) => !s.id.startsWith("map-")),
  ...world.sources,
].map(({ id, prompt, transparent_background }) => ({
  id,
  prompt,
  transparent_background,
}));
await writeFile(
  new URL("../art/image-requests.json", import.meta.url),
  JSON.stringify(
    {
      status: "generated-and-integrated-expanded-world",
      productionRecord: "art/generated-assets.json",
      requirements:
        "All artwork is regenerated from the uploaded animation style reference, with fine pastel shading and thin local-color contours. No forced dark outline. Shared adaptive palette up to 256 colors. All world assets share a 2x native base scale with 70% camera zoom; UI previews retain 2x scale. Ten unique connected worlds use native generated tiles and scenery rather than stretching old map paintings. All 52 actors have eight independently generated 3D-informed headings N,NE,E,SE,S,SW,W,NW and eight animation columns. Monster sizes 32,48,64; shared palette; no mirroring, synthetic rotation or procedural drawing fallback.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} pixel-art generation specifications; no images generated or overwritten.`,
);
