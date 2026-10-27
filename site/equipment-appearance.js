import { ITEMS, CLASSES } from "./data.js";
export const APPEARANCE_SLOTS = ["boots", "armor", "head", "charm", "weapon"];
export function starterEquipment(classId) {
  const cls = CLASSES.find((c) => c.id === classId);
  return cls
    ? {
        weapon: cls.weapon + "1",
        armor: classId + "armor1",
        head: "hood1",
        boots: "boots1",
        charm: "charm1",
      }
    : null;
}
export function equipmentSignature(classId, equipment) {
  return classId + ":" + (equipment?.weapon || "");
}
// Class costume is fixed; only the weapon follows equipped items.
// Keep both registered to the existing 32-pose/eight-direction body rig.
export function equippedAppearance(art, classId, equipment) {
  const base = art.appearance?.bases?.[classId];
  if (
    !base ||
    !equipment ||
    base.cols !== 32 ||
    base.rows !== 8 ||
    base.size !== 96 ||
    !base.animations?.idle?.length ||
    !base.animations?.walk?.length
  )
    return null;
  const available = new Set(art.files),
    layers = [{ file: base.file, order: 0 }];
  if (!available.has(base.file)) return null;
  const costume = base.costumeFile;
  if (costume) {
    if (!available.has(costume)) return null;
    layers.push({ file: costume, order: 20, fixedCostume: true });
  }
  const id = equipment.weapon,
    item = ITEMS[id],
    held = art.appearance.weapons?.[id];
  if (
    !item ||
    item.slot !== "weapon" ||
    (item.classId && item.classId !== classId) ||
    !held ||
    !available.has(held.file)
  )
    return null;
  layers.push({ ...held, held: true, order: 50, slot: "weapon", item: id });
  if (base.handFile) {
    if (!available.has(base.handFile)) return null;
    layers.push({ file: base.handFile, order: 60, hands: true });
  }
  return {
    layout: base,
    layers,
    signature: equipmentSignature(classId, equipment),
  };
}
export function orderedEquipmentLayers(appearance, dir) {
  const order = (l) => l.orderByDirection?.[dir] ?? l.order ?? 10;
  return appearance.layers.toSorted((a, b) => order(a) - order(b));
}
