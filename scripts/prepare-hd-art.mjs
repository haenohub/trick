// Plan authored image generation separately from reproducible technical packing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const file = "art/hd-sources.json";
if (existsSync(file))
  throw Error("HD source plan already exists; resume it instead.");
const previous = JSON.parse(readFileSync("art/storybook-sources.json"));
const entries = [...previous.sources, ...previous.pending].map((entry) => {
  const a = { ...entry, baseSize: entry.size };
  if (a.size) a.size *= 2;
  if (!a.reference) a.reference = a.previousSource;
  a.prompt = a.prompt
    .replace(
      /(\d+)x(\d+) pixels/g,
      (_, w, h) => `${Number(w) * 2}x${Number(h) * 2} pixels`,
    )
    .replace(
      /native(16|32|48|64|112|256)px/gi,
      (_, n) => `native${Number(n) * 2}px`,
    );
  a.prompt +=
    "\nUPGRADED NATIVE RESOLUTION: retain the same screen footprint but use twice the pixel width and height, four times the pixel count. " +
    (a.size
      ? `Each sprite is now ${a.size}x${a.size} native pixels, formerly ${a.baseSize}x${a.baseSize}. `
      : "Item icons 32x32 (formerly16), terrain tiles224x224 (formerly112), environment props512x512 (formerly256), effects128x128 (formerly64). ") +
    "Repaint fine small pixel details into the new resolution; never simply duplicate 2x2 pixels. Thin selectively colored one-pixel contours, crisp material shading, no blur or thick black outline. Preserve exact atlas order, identities and genuine eight-direction 3D geometry where applicable.";
  return a;
});
const first = entries.find((a) => a.id === "m8");
first.source =
  "/workspace/generated_images/exec-47ddfe09-8b55-4424-97ad-4ddb9dee34dd.png";
writeFileSync(
  file,
  JSON.stringify(
    {
      version: 1,
      resolutionScale: 2,
      style: previous.style,
      guide: previous.guide,
      sources: entries.filter((a) => a.source),
      pending: entries.filter((a) => !a.source),
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "HD plan saved:",
  entries.length,
  "sources,",
  entries.filter((a) => !a.source).length,
  "remaining",
);
