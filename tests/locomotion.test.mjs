import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { animationFrame, LocomotionClocks } from "../site/animation.js";
import { rgbaPixels } from "./png.mjs";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const json = async (f) => JSON.parse(await readFile(f, "utf8"));
function frame(image, size, col, row) {
  return Buffer.concat(
    Array.from({ length: size }, (_, y) =>
      image.pixels.subarray(
        ((row * size + y) * image.width + col * size) * 4,
        ((row * size + y) * image.width + (col + 1) * size) * 4,
      ),
    ),
  );
}
test("walk phase survives heading changes, begins on contact and returns to individual breathing clocks", () => {
  const clocks = new LocomotionClocks(),
    layout = {
      animations: { idle: [0] },
      clips: {
        walk: { frames: [0, 1, 2, 3, 4, 5, 6, 7], duration: 0.64 },
        idle: { frames: [0, 1, 2, 3, 4, 5, 6, 7], duration: 0.72 },
      },
    };
  const first = clocks.start("hero", "walk", 10);
  assert.equal(first, 10);
  assert.equal(animationFrame(layout, "walk", 10, first), 0);
  assert.equal(
    clocks.start("hero", "walk", 10.24),
    first,
    "changing direction must not restart the feet",
  );
  assert.equal(animationFrame(layout, "walk", 10.24, first), 3);
  assert.equal(
    animationFrame(layout, "walk", 10.64, first),
    0,
    "closed walk loop",
  );
  const rest = clocks.start("hero", "idle", 10.7);
  assert.equal(rest, 10.7);
  assert.equal(animationFrame(layout, "idle", 10.7, rest), 0);
  assert.equal(
    animationFrame(layout, "idle", 11.42, rest),
    0,
    "reference breathing cadence",
  );
  assert.equal(clocks.start("hero", "idle", 11.3), rest);
  assert.notEqual(
    clocks.start("npc-a", "idle", 11.3),
    clocks.start("npc-b", "idle", 11.3),
    "NPCs must not breathe in lockstep",
  );
  const crowd = Array.from({ length: 20 }, (_, i) =>
    Math.floor((11.3 - clocks.start("mob-" + i, "idle", 11.3)) / 0.09),
  );
  assert.ok(
    new Set(crowd).size >= 5,
    "sequential spawn IDs need visibly different breathing phases",
  );
  assert.equal(clocks.start("hero", "walk", 11.4), 11.4);
  assert.equal(
    clocks.start("hero", "walk", 1),
    1,
    "new world clock must not retain stale phase",
  );
});
test("each completed actor has eight separately authored walk and idle headings, and unfinished actors stay explicitly tracked", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/locomotion-sources.json"),
    records = await json("art/generated-assets.json");
  assert.equal(plan.sources.length + plan.pending.length, 144);
  assert.equal(
    new Set([...plan.sources, ...plan.pending].map((a) => a.id)).size,
    144,
  );
  assert.equal(plan.grid.oneDirectionPerSource, true);
  const layouts = {
    ...art.characterLayouts,
    ...art.npcLayouts,
    ...art.monsters,
  };
  assert.equal(Object.keys(layouts).length, 72);
  const complete = Object.keys(layouts).filter(
    (id) =>
      plan.sources.filter((s) => s.actors.some((a) => a.id === id)).length ===
      8,
  );
  assert.equal(art.locomotion.actors, complete.length);
  assert.equal(art.locomotion.complete, complete.length === 72);
  assert.deepEqual(
    art.locomotion.pendingActors.sort(),
    Object.keys(layouts)
      .filter((id) => !complete.includes(id))
      .sort(),
  );
  for (const [id, l] of Object.entries(layouts)) {
    if (!complete.includes(id)) {
      assert.ok(
        !l.clips,
        id + " must not substitute another direction for a missing one",
      );
      continue;
    }
    for (const kind of ["walk", "idle"]) {
      const clip = l.clips[kind];
      assert.equal(l.locomotionVersion, 3, id);
      assert.equal(clip.cols, 8, id);
      assert.equal(clip.rows, 8, id);
      assert.equal(clip.size, l.size, id);
      assert.deepEqual(clip.frames, [0, 1, 2, 3, 4, 5, 6, 7], id);
      assert.notEqual(
        clip.file,
        l.file,
        "old interleaved atlas must not supply locomotion",
      );
      const record = records.assets.find((a) => a.id === clip.file);
      assert.equal(record.registration.method, "one-scale-body-root");
      assert.equal(
        record.registration.anchor,
        kind === "idle" ? "planted-feet" : "body-root",
      );
      const mappings = record.registration.directions;
      assert.equal(mappings.length, 8, id);
      if (!record.motionReviewVersion)
        assert.equal(
          new Set(mappings.map((r) => r.source)).size,
          8,
          id + " reused a generated heading",
        );
      assert.deepEqual(
        mappings.map((r) => r.direction).sort(),
        [...plan.directionOrder].sort(),
      );
      for (const mapping of mappings) {
        if (record.motionReviewVersion) {
          assert.equal(mapping.sourceRow, mapping.destinationRow);
          assert.ok(mapping.scale > 0);
          continue;
        }
        const source = plan.sources.find((a) => a.id === mapping.id),
          actor = source.actors.find((a) => a.id === id);
        assert.equal(source.direction, mapping.direction);
        assert.equal(
          mapping.destinationRow,
          plan.directionOrder.indexOf(source.direction),
        );
        assert.equal(mapping.sourceRow, actor[kind + "Row"]);
        assert.ok(mapping.scale > 0);
      }
      const image = rgbaPixels(
        await readFile("site/assets/" + clip.file + ".png"),
      );
      assert.equal(image.width, l.size * 8);
      assert.equal(image.height, l.size * 8);
      const rows = [];
      for (let row = 0; row < 8; row++) {
        const poses = [];
        for (let col = 0; col < 8; col++) {
          const pixels = frame(image, l.size, col, row);
          poses.push(hash(pixels));
          assert.ok(
            pixels.some((v, i) => i % 4 === 3 && v === 255),
            id + " empty " + kind + " " + row + ":" + col,
          );
          for (let y = 0; y < l.size; y++)
            for (let x = 0; x < l.size; x++)
              if (x < 4 || y < 4 || x >= l.size - 4 || y >= l.size - 4)
                assert.equal(
                  pixels[(y * l.size + x) * 4 + 3],
                  0,
                  id + " frame bleed",
                );
        }
        assert.ok(
          new Set(poses).size >= (kind === "walk" ? 6 : 4),
          id + " " + kind + " " + row + " repeats standing poses",
        );
        rows.push(hash(Buffer.from(poses.join(""))));
      }
      assert.equal(new Set(rows).size, 8, id + " repeated a direction");
    }
  }
});
