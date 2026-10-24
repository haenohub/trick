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
const storybook = JSON.parse(
  await readFile(
    new URL("../art/storybook-sources.json", import.meta.url),
    "utf8",
  ),
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
  [
    ...refinement.sources,
    ...world.sources,
    ...crisp.sources,
    ...storybook.sources,
  ]
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
      status: "partial-storybook-generation-quota-reached",
      productionRecord: "art/generated-assets.json",
      requirements:
        "Target style from the user screenshot guide: bright cream ground, lime foliage, turquoise water, broad clean volume, thin crisp local-color contours. Shared adaptive palette up to 256 colors. All world assets use a 2x native scale; the physical game window is 70vw by 70vh with original font sizes and outer margins. Ten connected worlds use sixteen corner autotiles each with identical matching edge pixels. All 72 actors have eight independently generated 3D-informed headings N,NE,E,SE,S,SW,W,NW and motion frames. Monster sizes32/48/64, players48,items16,effects32/48/64. Both codices face southwest. A generated gold coin drops on the floor and spins during click pickup. No mirroring, procedural drawing or thick outline fallback.",
      completedStorybook: storybook.sources.length,
      pendingStorybook: storybook.pending.map(({ id, prompt }) => ({
        id,
        prompt,
      })),
      blocker: storybook.generationError,
      requests,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `Saved ${requests.length} pixel-art generation specifications; no images generated or overwritten.`,
);
