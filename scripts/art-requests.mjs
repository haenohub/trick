import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(
  await readFile(new URL("../art/pixel-sources.json", import.meta.url), "utf8"),
);
const directional = JSON.parse(
  await readFile(
    new URL("../art/directional-sources.json", import.meta.url),
    "utf8",
  ),
);
const active = source.sources.filter(
  ({ id }) =>
    !id.startsWith("monsters-") &&
    !id.startsWith("character-") &&
    id !== "npcs",
);
const requests = [...active, ...directional.sources].map(
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
      status: "generated-and-integrated-eight-direction-native-pixels",
      productionRecord: "art/generated-assets.json",
      requirements:
        "All artwork is regenerated from the uploaded animation style reference, with fine pastel shading and thin local-color contours. No forced dark outline. Shared adaptive palette up to 256 colors. One native pixel occupies two screen pixels throughout the world. All 52 actors have eight independently generated 3D-informed headings N,NE,E,SE,S,SW,W,NW and eight animation columns. Monster sizes 32,48,64; shared palette; no mirroring, synthetic rotation or procedural drawing fallback.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} pixel-art generation specifications; no images generated or overwritten.`,
);
