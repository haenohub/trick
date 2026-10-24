import { test } from "node:test";
import assert from "node:assert/strict";
import {
  NAVIGATION,
  LAYOUT_VERSION,
  WORLD_ZOOM,
  isWalkable,
  worldToImage,
  imageToWorld,
} from "../site/world-layout.js";
import {
  World,
  createPlayer,
  findRoute,
  hydrateSave,
  serialize,
} from "../site/core.js";
import { MAPS, NPCS, MONSTERS, PORTALS } from "../site/data.js";

test("all ten maps expand bounds and usable floor by 5–10x with connected distinct layouts", () => {
  assert.equal(WORLD_ZOOM, 1);
  assert.equal(new Set(MAPS.map((m) => m.shape)).size, 10);
  for (const n of Object.values(NAVIGATION)) {
    assert.ok(n.areaScale >= 5 && n.areaScale <= 10, n.id + " bounds");
    assert.ok(n.walkableScale >= 5 && n.walkableScale <= 10, n.id + " floor");
    const cells = n.floor.flatMap((row, r) =>
      row.flatMap((open, c) => (open ? [[c, r]] : [])),
    );
    const seen = new Set(),
      queue = [cells[0]];
    for (let i = 0; i < queue.length; i++) {
      const [c, r] = queue[i],
        key = `${c},${r}`;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        if (n.floor[r + dy]?.[c + dx]) queue.push([c + dx, r + dy]);
    }
    assert.equal(seen.size, cells.length, n.id + " connected floor");
    for (const p of [n.spawn, n.westLanding, n.eastLanding, ...n.habitats]) {
      assert.ok(isWalkable(n.id, p.x, p.y), n.id);
      const uv = worldToImage(p.x, p.y, n.id),
        q = imageToWorld(uv.u, uv.v, n.id);
      assert.ok(
        Math.hypot(q.x - p.x, q.y - p.y) < 1e-10,
        n.id + " coordinate inverse",
      );
    }
  }
});
test("click routes traverse every expanded map without cutting walls or stalling", () => {
  for (const n of Object.values(NAVIGATION)) {
    const w = new World({ seed: 42 }),
      raw = createPlayer();
    Object.assign(raw, {
      map: n.id,
      defeatedBosses: ["m20"],
      ...n.westLanding,
    });
    const p = w.addPlayer(raw);
    for (const m of w.map(n.id).mobs) {
      m.hp = 0;
      m.respawn = Infinity;
    }
    const route = findRoute(n.id, p, n.eastLanding);
    assert.ok(route.length > 0, n.id + " route exists");
    let from = p;
    for (const to of route) {
      const count = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 10);
      for (let i = 0; i <= count; i++)
        assert.ok(
          isWalkable(
            n.id,
            from.x + ((to.x - from.x) * i) / count,
            from.y + ((to.y - from.y) * i) / count,
          ),
          n.id + " segment stays on floor",
        );
      from = to;
    }
    assert.ok(w.act(p.id, { type: "moveTo", ...n.eastLanding }));
    for (let i = 0; i < 3000 && p.moveTarget; i++) w.step(0.1);
    assert.ok(
      Math.hypot(p.x - n.eastLanding.x, p.y - n.eastLanding.y) < 0.35,
      n.id + " reaches destination",
    );
  }
});
test("legacy saves migrate location while retaining progress; new saves retain expanded coordinates", () => {
  const old = createPlayer("mage", "기존 여행자");
  Object.assign(old, { map: "acorn", x: 14, y: 14, level: 18, gold: 991 });
  delete old.layoutVersion;
  old.inventory.fiber = 123;
  old.quest.counts.q0 = 3;
  const p = hydrateSave(old);
  assert.equal(p.level, 18);
  assert.equal(p.gold, 991);
  assert.equal(p.inventory.fiber, 123);
  assert.equal(p.quest.counts.q0, 3);
  assert.equal(p.layoutVersion, LAYOUT_VERSION);
  assert.equal(p.x, NAVIGATION.acorn.spawn.x);
  assert.equal(p.y, NAVIGATION.acorn.spawn.y);
  Object.assign(p, NAVIGATION.acorn.eastLanding);
  const restored = hydrateSave(serialize(p));
  assert.equal(restored.x, p.x);
  assert.equal(restored.y, p.y);
  assert.ok(p.x > 28 || p.y > 28 || p.x < 2 || p.y < 2);
});
test("NPCs face their service buildings, species inhabit separate zones, and portal arrivals do not bounce", () => {
  const w = new World();
  for (const npc of NPCS) {
    const n = NAVIGATION[npc.map];
    assert.ok(isWalkable(n.id, npc.x, npc.y));
    assert.ok(
      n.props.some(
        (p) =>
          Math.abs(p.x + p.y - npc.x - npc.y) < 5 &&
          Math.abs(p.x - p.y - npc.x + npc.y) < 1,
      ),
      npc.id + " building behind",
    );
  }
  for (const n of Object.values(NAVIGATION)) {
    const defs = MONSTERS.filter((m) => m.map === n.id),
      mobs = w.map(n.id).mobs;
    for (const [i, d] of defs.entries()) {
      const center = d.type === "boss" ? n.boss : n.habitats[i];
      const group = mobs.filter((m) => m.def === d.id);
      assert.equal(group.length, d.type === "normal" ? 6 : 1);
      for (const m of group)
        assert.ok(
          Math.hypot(m.x - center.x, m.y - center.y) < 6,
          d.id + " habitat",
        );
    }
  }
  const p = w.addPlayer(createPlayer());
  for (const dest of MAPS.slice(1)) {
    p.defeatedBosses = ["m20"];
    const port = PORTALS(p.map).find((a) => a.to === dest.id);
    Object.assign(p, port);
    const previous = p.map;
    assert.ok(w.travel(p, dest.id, false));
    assert.equal(
      w.travel(p, previous, false),
      false,
      dest.id + " no instant return",
    );
  }
});
