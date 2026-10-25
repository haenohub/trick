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
  return (
    classId +
    ":" +
    APPEARANCE_SLOTS.map((slot) => equipment?.[slot] || "").join(":")
  );
}
// All pieces must be real authored, aligned 32-pose/8-direction layers. Do not
// paste inventory icons over baked gear or show a half-finished naked base.
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
  for (const slot of APPEARANCE_SLOTS) {
    const id = equipment[slot],
      item = ITEMS[id],
      definition = art.appearance.items?.[id]?.[classId];
    if (
      !item ||
      item.slot !== slot ||
      (item.classId && item.classId !== classId) ||
      !definition?.layers?.length
    )
      return null;
    for (const layer of definition.layers) {
      if (!available.has(layer.file)) return null;
      layers.push({ ...layer, slot, item: id });
    }
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
