import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CLASSES, MONSTERS } from "../site/data.js";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8"));
const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const headings = [
  "directly AWAY, BACK view, absolutely no face",
  "upper RIGHT, BACK-RIGHT three-quarter",
  "screen RIGHT profile",
  "lower RIGHT, FRONT-RIGHT three-quarter",
  "toward viewer, FRONT view",
  "lower LEFT, FRONT-LEFT three-quarter",
  "screen LEFT profile",
  "upper LEFT, BACK-LEFT three-quarter",
];
const actors = [
  ...CLASSES.map((c) => ({ id: c.id, kind: "character", size: 96 })),
  ...MONSTERS.map((m) => ({
    id: m.id,
    kind: "monster",
    size: art.monsters[m.id].size,
  })),
];
let old = { sources: [] };
try {
  old = JSON.parse(await readFile("art/combat-cycles.json", "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
}
await mkdir("/tmp/leaftale-combat-guides", { recursive: true });
const jobs = [];
for (let group = 0; group < 8; group++)
  for (let d = 0; d < 8; d++) {
    const members = actors.slice(group * 8, group * 8 + 8),
      ref = rgba(128, 1024);
    for (let i = 0; i < 8; i++) {
      const a = members[i],
        src = decode(
          "site/assets/" +
            (a.kind === "character"
              ? art.appearance.bases[a.id].file
              : art.monsters[a.id].views[dirs[d]]) +
            ".png",
        );
      const rect =
        a.kind === "character"
          ? { sx: 24 * 96, sy: d * 96, sw: 96, sh: 96 }
          : { sx: 0, sy: 0, sw: src.width, sh: src.height };
      blit(sampleNearest(src, rect, 112, 112), ref, 8, i * 128 + 8);
    }
    const id = "combat-g" + group + "-" + dirs[d],
      reference = "/tmp/leaftale-combat-guides/" + id + ".png";
    await png(ref, reference);
    const roles = members
      .map(
        (a, i) =>
          "Row" +
          (i + 1) +
          ": " +
          a.id +
          (a.id === "warden"
            ? " upright spear thrust with empty gripping hands"
            : a.id === "mage"
              ? " upright one-hand staff casting with empty grip"
              : a.id === "ranger"
                ? " upright bow draw/release with empty gripping hands"
                : a.id === "herbalist"
                  ? " UPRIGHT gentle herbal wand casting, one hand draws back to shoulder then extends palm forward at chest height, graceful short arm arc, FEET PLANTED, absolutely no crouching, hip thrusting, bending over, spreading legs, or lower-body gestures"
                  : "; anatomically natural attack using its actual body, limbs, leaves or roots"),
      )
      .join(". ");
    jobs.push({
      id,
      group,
      direction: dirs[d],
      directionRow: d,
      actors: members.map((a, row) => ({ ...a, sourceRow: row })),
      reference,
      cols: 8,
      rows: 8,
      prompt: `Production forest fantasy pixel RPG COMBAT cycle sheet. The reference contains EIGHT different actors vertically. Create EXACTLY8columns x8rows,one corresponding actor per row,64 isolated poses on transparent1024x1024 canvas. ALL poses throughout this ENTIRE sheet face ${headings[d]}. NEVER rotate toward viewer during a back-facing row; keep head, torso, hips, and feet facing the SAME heading throughout all phases. ${roles}. Columns1-3 are WINDUP: alert ready, arm/root/claw pulls back, fully prepared. Columns4-5 are STRIKE: release/thrust, full impact extension along assigned heading. Columns6-7 are RECOVERY: controlled follow-through then settle back to ready. Column8 mild HURT recoil still facing same direction. Continuous adjacent poses of one action, controlled weight shift, no teleporting or unrelated poses. Preserve exact identity, proportions, colors, fur/leaves/hair from reference. The first four human characters, if present, wear the same modest plain ivory linen tunic and dark shorts as reference, complete visible hands and feet; NO weapons, armor, headwear or jewelry because equipment is a separate layer. Right gripping palm must be clearly formed at chest or shoulder height with plausible wrist, not hidden in the torso. Monsters keep all their own original natural features; do not add human clothing or weapons. Keep head height stable, feet planted, single consistent model. Crisp fine native pixels, thin local-color contours, forest palette, no blur or soft alpha fringes. Each128px cell has at least8px empty transparent margins, consistent foot pivot(64,116), no shadows, text, labels, projectile effects or neighboring sprites. Single fixed direction: ${headings[d]}.`,
    });
  }
const sources = old.sources || [],
  plan = {
    version: 1,
    tool: "image_gen",
    status: "generating",
    directionOrder: dirs,
    grid: {
      cols: 8,
      rows: 8,
      oneDirectionPerSource: true,
      windup: [0, 1, 2],
      attack: [3, 4],
      recover: [5, 6],
      hurt: [7],
    },
    sources,
    pending: jobs.filter((j) => !sources.some((s) => s.id === j.id)),
  };
await writeFile("art/combat-cycles.json", JSON.stringify(plan, null, 2) + "\n");
console.log(
  plan.pending.length +
    " fixed-direction combat sheets queued for64 combatants",
);
