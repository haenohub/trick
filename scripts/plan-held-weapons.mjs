import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CLASSES, ITEMS } from "../site/data.js";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8")),
  icons = decode("site/assets/items.png");
const weapons = CLASSES.flatMap((c) =>
  Object.values(ITEMS).filter((i) => i.slot === "weapon" && i.classId === c.id),
);
const ref = rgba(512, 512);
for (let n = 0; n < weapons.length; n++) {
  const ix = art.items[weapons[n].id];
  blit(
    sampleNearest(
      icons,
      { sx: (ix % 8) * 32, sy: Math.floor(ix / 8) * 32, sw: 32, sh: 32 },
      112,
      112,
    ),
    ref,
    (n % 4) * 128 + 8,
    Math.floor(n / 4) * 128 + 8,
  );
}
await mkdir("/tmp/leaftale-held-weapons", { recursive: true });
await png(ref, "/tmp/leaftale-held-weapons/items.png");
const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  names = [
    "BACK view, viewer sees the rear of each object",
    "BACK-RIGHT three-quarter view",
    "RIGHT profile view",
    "FRONT-RIGHT three-quarter view",
    "FRONT view toward viewer",
    "FRONT-LEFT three-quarter view",
    "LEFT profile view",
    "BACK-LEFT three-quarter view",
  ];
const jobs = dirs.map((direction, d) => ({
  id: "held-" + direction,
  direction,
  directionRow: d,
  reference: "/tmp/leaftale-held-weapons/items.png",
  cols: 4,
  rows: 4,
  weapons: weapons.map((i, index) => ({ id: i.id, index, weapon: i.weapon })),
  prompt: `Production forest fantasy RPG EQUIPMENT ONLY sprite atlas. Reference contains sixteen distinct items in4columns x4rows. Preserve every corresponding item's exact shape, ornamentation, material and palette. Generate EXACTLY4columns x4rows: row1 four spears, row2 four magical staffs, row3 four bows, row4 four small herbal wands, SAME order as reference. EVERY one of the16 objects is seen in ${names[d]}, as if held by a character facing ${direction}. Keep ALL spear/staff/wand tips pointing UP in this neutral grip pose; bow held upright, string and sculpted leaf/feather perspective appropriate to ${names[d]}. No people, no hands, no character bodies, NO text or shadows. Each128px cell has8px transparent margins. Right-hand GRIP point of each handle is at(64,88) within the cell; for bows this is the CENTRAL HANDLE, not the bottom limb. Put a tiny 2-pixel pure MAGENTA registration dot exactly on this grip point; it will be removed during sprite packing. Draw the real complete handle behind the dot. Weapon length about96px, centered around the grip; keep complete tips and limbs inside the cell. 16 individual precisely readable native pixel sprites, thin local-color contour, rich 3D-informed shading, no glow, no blur. Transparent square1024x1024 atlas. This is actual held equipment, not compact inventory badges. All16 have ONE fixed viewing direction: ${names[d]}.`,
}));
let old = { sources: [] };
try {
  old = JSON.parse(await readFile("art/held-weapons.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await writeFile(
  "art/held-weapons.json",
  JSON.stringify(
    {
      version: 1,
      tool: "image_gen",
      status: "generating",
      sources: old.sources,
      pending: jobs.filter((j) => !old.sources.some((s) => s.id === j.id)),
    },
    null,
    2,
  ) + "\n",
);
console.log("Eight directional held-weapon sheets queued");
