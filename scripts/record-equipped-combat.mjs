import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, sampleNearest, png } from "./pack-pixel-art.mjs";
const records = JSON.parse(await readFile("art/generated-assets.json", "utf8")),
  art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
for (const id of ["warden", "mage", "ranger", "herbalist"]) {
  const src = decode("/tmp/leaftale-combat-equipped-" + id + ".png"),
    file = "combat/" + id,
    target = "site/assets/" + file + ".png";
  await png(
    sampleNearest(
      src,
      { sx: 0, sy: 0, sw: src.width, sh: src.height },
      src.width,
      src.height,
    ),
    target,
  );
  const record = records.assets.find((r) => r.id === file);
  record.sha256 = createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
  record.compositedStarterEquipment = true;
  const weapon = records.assets.find((r) => r.id === "appearance/held-weapons");
  record.additionalSources = [
    ...new Set([
      ...record.additionalSources,
      weapon.source,
      ...weapon.additionalSources,
    ]),
  ];
}
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
console.log("Registered four isolated, fully equipped fallback combat atlases");
