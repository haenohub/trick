import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  NAVIGATION,
  LAYOUT_VERSION,
  worldToImage,
} from "../site/world-layout.js";
import { project, unproject } from "../site/view-projection.js";
import { hydrateSave, createPlayer, serialize } from "../site/core.js";
import { rgbaPixels } from "./png.mjs";
import { QUESTS } from "../site/data.js";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
test("map grid is genuinely orthogonal before a symmetric 2:1 projection, without the old inverse-image compensation", () => {
  assert.deepEqual(project(1, 0), { x: 32, y: 16 });
  assert.deepEqual(project(0, 1), { x: -32, y: 16 });
  for (const n of Object.values(NAVIGATION)) {
    const a = n.worldAt(3, 3),
      b = n.worldAt(4, 3),
      c = n.worldAt(3, 4);
    assert.equal(b.y, a.y);
    assert.equal(c.x, a.x);
    assert.equal(b.x - a.x, 7);
    assert.equal(c.y - a.y, 7);
    for (const p of [a, b, c]) {
      const q = project(p.x, p.y),
        back = unproject(q.x, q.y);
      assert.deepEqual(back, p);
    }
    assert.ok(n.props.length >= 35, n.id + " distinct scenery placement");
  }
});
test("all ten maps use twenty independently generated native floor and scenery atlases", async () => {
  const art = await json("site/assets/manifest.json"),
    plan = await json("art/isometric-map-plan.json"),
    records = await json("art/generated-assets.json");
  assert.equal(plan.status, "complete");
  assert.equal(plan.sources.length, 20);
  assert.equal(new Set(plan.sources.map((s) => s.source)).size, 20);
  assert.equal(Object.keys(art.world.isometric.maps).length, 10);
  for (const [id, scene] of Object.entries(art.world.isometric.maps)) {
    assert.equal(scene.floor.width / scene.floor.height, 2);
    assert.equal(scene.props.size, 384);
    assert.equal(scene.props.anchors.length, 16);
    assert.ok(scene.props.anchors[12] > 0.4 && scene.props.anchors[12] < 0.95);
    for (const kind of ["floor", "props"]) {
      const file = scene[kind].file,
        record = records.assets.find((r) => r.id === file),
        bytes = await readFile("site/assets/" + file + ".png");
      assert.equal(
        record.source,
        plan.sources.find((s) => s.id === id && s.kind === kind).source,
      );
      assert.equal(
        record.sha256,
        createHash("sha256").update(bytes).digest("hex"),
      );
    }
    const ground = rgbaPixels(
      await readFile("site/assets/" + scene.floor.file + ".png"),
    );
    assert.equal(ground.width, 448 * 8);
    assert.equal(ground.height, 224 * 4);
    for (let tile = 0; tile < 32; tile++) {
      const x = (tile % 8) * 448,
        y = Math.floor(tile / 8) * 224;
      for (const [dx, dy] of [
        [0, 0],
        [447, 0],
        [0, 223],
        [447, 223],
      ])
        assert.equal(
          ground.pixels[((y + dy) * ground.width + x + dx) * 4 + 3],
          0,
          id + " square-floor corner remains",
        );
      assert.equal(
        ground.pixels[((y + 112) * ground.width + x + 224) * 4 + 3],
        255,
        id + " hole in diamond center",
      );
    }
  }
});
test("old map positions migrate safely while inventory, quests, equipment and allocated stats survive", () => {
  const raw = createPlayer("mage");
  raw.level = 8;
  raw.allocated = { intelligence: 20 };
  raw.inventory.fiber = 37;
  raw.gold = 567;
  raw.quest.counts[QUESTS[0].id] = 1;
  raw.layoutVersion = 3;
  raw.x = 999;
  raw.y = 999;
  const p = hydrateSave(raw);
  assert.equal(p.layoutVersion, LAYOUT_VERSION);
  assert.equal(p.x, NAVIGATION.village.spawn.x);
  assert.equal(p.y, NAVIGATION.village.spawn.y);
  assert.equal(p.inventory.fiber, 37);
  assert.equal(p.gold, 567);
  assert.equal(p.allocated.intelligence, 20);
  assert.equal(p.quest.index, raw.quest.index);
  assert.equal(p.quest.counts[QUESTS[0].id], 1);
  assert.deepEqual(hydrateSave(serialize(p)).allocated, p.allocated);
});
