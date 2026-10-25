import { readFile, writeFile, mkdir } from "node:fs/promises";
import { decode, rgba, blit, png } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
let previous = {};
try {
  previous = JSON.parse(await readFile("art/locomotion-sources.json", "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const actors = Object.entries({
  ...art.characterLayouts,
  ...art.npcLayouts,
  ...art.monsters,
});
const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const descriptions = [
  "NORTH, directly away from camera, showing the BACK, face NEVER visible",
  "NORTHEAST, diagonally away toward upper RIGHT, showing back and right side",
  "EAST, directly toward screen RIGHT, right-facing PROFILE, nose points RIGHT throughout",
  "SOUTHEAST, toward bottom RIGHT, three-quarter FRONT-RIGHT",
  "SOUTH, directly toward viewer, FRONT visible throughout",
  "SOUTHWEST, toward bottom LEFT, three-quarter FRONT-LEFT",
  "WEST, directly toward screen LEFT, LEFT-facing PROFILE, nose points LEFT throughout",
  "NORTHWEST, diagonally away toward upper LEFT, showing back and left side",
];
const pending = [];
await mkdir("/tmp/leaftale-direction-cycles", { recursive: true });
for (let g = 0; g < 18; g++)
  for (let d = 0; d < 8; d++) {
    const group = actors.slice(g * 4, g * 4 + 4),
      ref = rgba(128, 512);
    for (let i = 0; i < 4; i++) {
      const view = decode(
        "site/assets/" + group[i][1].views[directions[d]] + ".png",
      );
      const frame = rgba(112, 112);
      for (let y = 0; y < 112; y++)
        for (let x = 0; x < 112; x++) {
          const from =
            (Math.floor((y * view.height) / 112) * view.width +
              Math.floor((x * view.width) / 112)) *
            4;
          view.data.copy(frame.data, (y * 112 + x) * 4, from, from + 4);
        }
      blit(frame, ref, 8, i * 128 + 12);
    }
    const id = "g" + g + "-" + directions[d],
      reference = "/tmp/leaftale-direction-cycles/" + id + ".png";
    await png(ref, reference);
    const prompt = `Production pixel RPG animation sheet. The reference shows FOUR DIFFERENT actors stacked top to bottom. ALL face ${descriptions[d]}. Make EXACTLY 8 columns by 8 rows, 64 isolated sprites, 1024x1024 transparent background. THIS ENTIRE SHEET HAS ONLY ONE DIRECTION: ${descriptions[d]}. Never turn around, never mirror a pose when changing leading foot. Row1: reference actor1 WALK; row2: actor1 IDLE; row3: actor2 WALK; row4: actor2 IDLE; row5: actor3 WALK; row6: actor3 IDLE; row7: actor4 WALK; row8: actor4 IDLE. Keep each actor's exact identity, model, size, colors, facial features and asymmetrical equipment. WALK rows (1,3,5,7): one seamless eight-frame cycle, clearly differing alternating left/right foot placements: left contact, left down, right passing, right lifted, RIGHT contact, right down, left passing, left lifted. Feet separate on contacts and cross on passing; arms swing opposite legs; grounded supporting foot, small hip rotation, cape/ears/leaves follow through. Quadrupeds use diagonal leg pairs, insects coordinated alternating legs; legless creatures crawl, undulate or pulse fins/roots anatomically. Foot motion must be visibly different across frames while head and body remain consistent. IDLE rows (2,4,6,8): eight quiet poses of one seamless breathing cycle, rest → inhale → full inhale → exhale → rest; inspired by a classic isometric monster .72-second breathing reference. Feet stay PLANTED, no stepping or hopping. Tiny chest/shoulder breath, delayed head and leaf/ear/fin response, subtle blink. Hats/shells/armor remain rigid. No scaling or translating the entire sprite as fake motion. Same pixel density and proportions as the input, crisp thin local-color outlines and rich forest fantasy colors, 3D-informed volume, no blurry edges. Each128px cell has at least8px transparent gutters, consistent foot pivot(64,116), no ground shadows, no text, no labels, no extra actors. ALL 64 SPRITES FACE ${descriptions[d]}.`;
    pending.push({
      id,
      group: g,
      direction: directions[d],
      directionRow: d,
      actors: group.map(([id, l], i) => ({
        id,
        size: l.size,
        baseFile: l.file,
        walkRow: i * 2,
        idleRow: i * 2 + 1,
      })),
      reference,
      prompt,
      cols: 8,
      rows: 8,
    });
  }
// Rebuilding temporary guides must never discard already generated sources.
const sources = pending.flatMap((entry) => {
  const saved = previous.sources?.find(
    (s) =>
      s.id === entry.id &&
      JSON.stringify(s.actors) === JSON.stringify(entry.actors),
  );
  return saved ? [{ ...saved, reference: entry.reference }] : [];
});
const plan = {
  ...previous,
  version: 2,
  tool: "image_gen",
  referenceVideo: {
    fileId: "file_0000000073448230ba32982f9e2f08e5",
    frames: 6,
    duration: 0.72,
    notes:
      "Planted feet, torso breathing and delayed appendage motion; eight authored poses retain the same cycle.",
  },
  directionOrder: directions,
  grid: {
    cols: 8,
    rows: 8,
    walkFrames: 8,
    idleFrames: 8,
    oneDirectionPerSource: true,
  },
  sources,
  pending: pending.filter((entry) => !sources.some((s) => s.id === entry.id)),
};
await writeFile(
  "art/locomotion-sources.json",
  JSON.stringify(plan, null, 2) + "\n",
);
console.log(
  sources.length +
    " sources preserved; " +
    plan.pending.length +
    " pending direction guides prepared",
);
