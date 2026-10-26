import { readFile, writeFile, mkdir } from "node:fs/promises";
import { ITEMS, CLASSES } from "../site/data.js";
import { decode, rgba, png } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const icons = decode("site/assets/items.png");
await mkdir("/tmp/leaftale-equipment/icons", { recursive: true });
const jobs = [];
for (const cls of CLASSES)
  for (const item of Object.values(ITEMS).filter(
    (i) => i.type === "equipment" && (!i.classId || i.classId === cls.id),
  )) {
    const icon = rgba(256, 256),
      index = art.items[item.id];
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const at =
          ((Math.floor(index / 8) * 32 + Math.floor(y / 8)) * icons.width +
            (index % 8) * 32 +
            Math.floor(x / 8)) *
          4;
        icons.data.copy(icon.data, (y * 256 + x) * 4, at, at + 4);
      }
    const reference = "/tmp/leaftale-equipment/icons/" + item.id + ".png";
    await png(icon, reference);
    const treatment = {
      weapon:
        "An actual held " +
        item.weapon +
        " fitted to the right hand, changing angle during preparation/strike/recovery. Full elongated weapon, not a compact inventory badge.",
      armor:
        "A fitted wearable torso garment, shoulders and waist wrapping around the body. Openings for head/arms remain transparent. Cloth/armor folds follow the body pose.",
      head: "A fitted wearable hat or forehead band resting over the hair. Preserve the opening for face. Show true front/back/side of the headwear.",
      boots:
        "A PAIR of fitted wearable boots or shoes following BOTH feet. Walk alternates left/right foot contact and passing; two separate shoes remain in a single cell with correct spacing.",
      charm:
        item.id === "charm1"
          ? "An acorn pendant on a fine necklace cord, worn around neck, back view shows cord only. Tiny proportionate pendant, not a large floating badge."
          : "A small silver-shell ring worn on the right hand, proportionate tiny ring; only the ring appears, not a large floating badge.",
    }[item.slot];
    jobs.push({
      id: cls.id + "-" + item.id,
      classId: cls.id,
      item: item.id,
      slot: item.slot,
      cols: 16,
      rows: 16,
      reference,
      body: "art/equipment-guides/" + cls.id + ".png",
      prompt: `Production fitted EQUIPMENT-ONLY paper-doll sprite layer for ${item.name}. Reference1 is the EXACT neutral body registration atlas,16columns x16rows. Reference2 is the EXACT item design: preserve silhouette, materials, colors and decoration. Item story: ${item.lore} ${treatment} Output1536x1536 TRANSPARENT background,256 isolated equipment poses. NO body, skin, hair, hands, face, underclothes or shadows visible: all non-equipment pixels are transparent. This is wearable gear fitted onto reference1 anatomy, never an inventory icon pasted into a cell. TOP8rows headings N NE E SE S SW W NW respectively;columns0-7 relaxed ready poses,8-10 windup,11-12 strike,13recovery,14hurt,15fallen gear. BOTTOM8rows SAME8headings;cols0-7 eight-frame alternating contact/down/pass/lift walk;cols8-15 planted-foot subtle idle breathing. Every cell's equipment corresponds to THAT body pose and exact direction; no arbitrary rotations or duplicated row headings. Same96px cell registration and4px empty margins. Respect all 256 pose positions. 3D-informed volume, rich forest fantasy native pixel shading, thin local-color contours, no blur, no labels, no glow. Only this ONE equipped item is visible, not the character and not other gear.`,
    });
  }
await writeFile(
  "/tmp/leaftale-equipment/jobs.json",
  JSON.stringify(jobs, null, 2) + "\n",
);
console.log(jobs.length + " fitted item/class layers prepared");
