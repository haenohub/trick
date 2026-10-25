import { readFile, writeFile } from "node:fs/promises";
import { CLASSES, ITEMS } from "../site/data.js";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const jobs = [];
const animations = {
  idle: [24, 25, 26, 27, 28, 29, 30, 31],
  walk: [16, 17, 18, 19, 20, 21, 22, 23],
  windup: [8, 9, 10],
  attack: [11, 12],
  recover: [13, 2],
  hurt: [14],
  death: [15],
};
for (const cls of CLASSES) {
  const l = art.characterLayouts[cls.id];
  const clips = [
    { kind: "combat", cols: 16, file: l.file },
    { kind: "walk", cols: 8, file: l.clips.walk.file },
    { kind: "idle", cols: 8, file: l.clips.idle.file },
  ];
  jobs.push({
    id: "base-" + cls.id,
    kind: "base",
    classId: cls.id,
    target: "appearance/base/" + cls.id,
    size: 96,
    cols: 32,
    rows: 8,
    segments: clips,
    directionReferences: l.views,
    animations,
    prompt:
      "Use the three approved animation sheets as exact registration guides. Generate the same character as a clean unarmed paper-doll body in neutral fitted linen underclothes. Remove all baked weapons, capes, hats, armor, boots and jewelry; paint complete hands/feet rather than holes. Preserve face, hair, proportions, eight true directions, poses and frame order. Work on combat16/walk8/idle8 segments separately, then pack into32x8 native96px cells. Thin sharp local-color contours, no blur, four-pixel transparent gutters. Do not mirror directions or substitute poses.",
  });
  for (const item of Object.values(ITEMS).filter(
    (i) => i.type === "equipment" && (!i.classId || i.classId === cls.id),
  )) {
    jobs.push({
      id: cls.id + "-" + item.id,
      kind: "equipment",
      classId: cls.id,
      item: item.id,
      slot: item.slot,
      requires: ["base-" + cls.id],
      target: "appearance/gear/" + cls.id + "-" + item.id,
      icon: {
        file: "items",
        cols: 8,
        rows: 8,
        index: art.items[item.id],
        size: 32,
      },
      size: 96,
      cols: 32,
      rows: 8,
      segments: clips.map((c) => ({
        ...c,
        reference: "appearance/base/" + cls.id,
      })),
      prompt:
        "Create transparent wearable layers of " +
        item.name +
        " for the approved unarmed " +
        cls.name +
        " body. Match the actual item icon EXACTLY: shape, colors, materials, decorations and silhouette. This is fitted " +
        item.slot +
        " equipment, not a floating inventory icon or badge. Keep all32 poses and8 headings aligned to the96px body cells: combat16, walk8, idle8. Fit hands, torso, head or feet according to the slot; leave face/fingers and all non-equipment pixels transparent. Produce separate back/front layers when the object crosses behind the body. Never repaint or include the body in a gear layer. Every heading is authored, asymmetry remains correct, four-pixel gutters, sharp native pixels. Follow breathing, footfalls, preparation, impact and recovery without clipping adjacent cells.",
    });
  }
}
const file = "art/equipment-appearance-plan.json";
let previous = {};
try {
  previous = JSON.parse(await readFile(file, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
const sources = previous.sources || [];
const plan = {
  ...previous,
  version: 1,
  tool: "image_gen",
  status: "blocked-usage-limit",
  blocker: {
    type: "usage_limit_reached",
    resetAt: "2026-10-26T02:40:29.000Z",
    clientResetAt: "2026-10-26T11:40:29+09:00",
  },
  directionOrder: art.directionOrder,
  layout: { size: 96, cols: 32, rows: 8, animations },
  integration:
    "Pack neutral bases and aligned gear front/back layers. Register them in manifest.appearance.bases/items and manifest.files. Each item entry is keyed by item ID then class ID; layers have file and optional orderByDirection. Runtime falls back until all five equipped slots are ready. No inventory-icon overlays.",
  sources,
  pending: jobs.filter((j) => !sources.some((s) => s.id === j.id)),
};
await writeFile(file, JSON.stringify(plan, null, 2) + "\n");
console.log(
  plan.pending.length +
    " authored appearance targets queued: 4 neutral bodies and 48 class/item combinations",
);
