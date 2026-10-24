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
const crisp = JSON.parse(
  await readFile(new URL("../art/crisp-sources.json", import.meta.url), "utf8"),
);
const records = JSON.parse(
  await readFile(
    new URL("../art/generated-assets.json", import.meta.url),
    "utf8",
  ),
);
const used = new Set(
  records.assets.flatMap((a) => [a.source, ...(a.additionalSources || [])]),
);
const unique = new Map(
  [...refinement.sources, ...world.sources, ...crisp.sources]
    .filter((s) => used.has(s.source))
    .map((s) => [s.source, s]),
);
const requests = [...unique.values()].map(
  ({ id, prompt, transparent_background }) => ({
    id,
    prompt,
    transparent_background,
  }),
);
await writeFile(
  new URL("../art/image-requests.json", import.meta.url),
  JSON.stringify(
    {
      status: "generated-and-integrated-crisp-corner-world",
      productionRecord: "art/generated-assets.json",
      requirements:
        "Artwork preserves the uploaded animation style identity with crisper edge pixels, with sharp discrete shading and thin well-defined local-color contours. No forced dark outline. Shared adaptive palette up to 256 colors. All world assets share a 2x native base scale with 70% camera zoom; UI previews retain 2x scale. Ten unique connected worlds use sixteen corner autotiles per biome with identical matching edge pixels. Twenty new species are plants and inanimate relics. Both bestiaries face southwest. All 72 actors have eight independently generated 3D-informed headings N,NE,E,SE,S,SW,W,NW and eight animation columns. Monster sizes 32,48,64; shared palette; no mirroring, synthetic rotation or procedural drawing fallback.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} pixel-art generation specifications; no images generated or overwritten.`,
);
