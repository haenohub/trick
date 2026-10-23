import { readFile, writeFile } from "node:fs/promises";
const source = JSON.parse(
  await readFile(new URL("../art/pixel-sources.json", import.meta.url), "utf8"),
);
const requests = source.sources.map(
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
      status: "generated-and-integrated-native-pixels",
      productionRecord: "art/generated-assets.json",
      requirements:
        "All artwork originates from image_gen, then is packed onto exact native pixel grids. Monster sizes 32,48,64; shared palette; no procedural drawing fallback.",
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} pixel-art generation specifications; no images generated or overwritten.`,
);
