import { test } from "node:test";
import assert from "node:assert/strict";
import { worldPulse } from "../site/living-world.js";
import { MAPS, MONSTERS } from "../site/data.js";
import { World, createPlayer } from "../site/core.js";
test("every map event loops exactly and town safety disables reward events", () => {
  for (const m of MAPS)
    for (const t of [0, 35, 90, 119, 179]) {
      assert.deepEqual(worldPulse(m, t), worldPulse(m, t + 180));
      assert.ok(worldPulse(m, t).remaining > 0);
      if (m.town) assert.equal(worldPulse(m, t).active, false);
    }
});
test("forest event grants one extra herb and keeps whole-harvest cooldown intact", () => {
  const w = new World(),
    p = w.addPlayer(createPlayer());
  p.map = "sprout";
  const map = w.map(p.map),
    h = map.herbs[0];
  p.x = h.x;
  p.y = h.y;
  while (!worldPulse(map.config, w.time).active) w.time++;
  const before = p.inventory[h.item] || 0;
  assert.ok(w.act(p.id, { type: "interact", herb: h.id, harvest: "whole" }));
  assert.equal(p.inventory[h.item] - before, 4);
  assert.equal(h.readyAt - w.time, 38);
  assert.equal(w.snapshot(p.id).ambience.active, true);
});
test("coastal event increases only currency drops by 25 percent",()=>{
 const w=new World(),p=w.addPlayer(createPlayer());p.map='glassbeach';const map=w.map(p.map),m=map.mobs[0],def=MONSTERS.find(d=>d.id===m.def);
 while(!worldPulse(map.config,w.time).active)w.time++;
 w.rng=()=>.5;assert.ok(w.damage(p,m,100000));
 const gold=map.drops.find(d=>d.kind==='currency');
 assert.equal(gold.count,Math.round(Math.round(def.level*(def.type==='boss'?15:1.8)+5)*1.25));
});
