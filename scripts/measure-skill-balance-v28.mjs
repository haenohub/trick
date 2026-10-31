import { World, createPlayer, stats } from "../site/core.js";
import { CLASSES, MONSTERS } from "../site/data.js";
import { NAVIGATION } from "../site/world-layout.js";
import { facingVector } from "../site/directions.js";
import { tierItemId } from "../site/equipment-tiers.js";
const rows = [];
for (const level of [20, 30])
  for (const targetId of ["m1", "m31", "m40"])
    for (const cls of CLASSES) {
      const raw = createPlayer(cls.id);
      raw.level = level;
      raw.map = "sprout";
      delete raw.allocated;
      delete raw.allocationVersion;
      for (const slot of ["weapon", "armor", "head", "boots", "charm"]) {
        const id = tierItemId(cls, slot, level);
        raw.inventory[id] = 1;
        raw.equipment[slot] = id;
      }
      const w = new World({ seed: 42 }),
        p = w.addPlayer(raw),
        nav = NAVIGATION.sprout,
        v = facingVector(2);
      w.rng = () => 0.5;
      w.updateMob = () => {};
      w.advanceCombat = () => {};
      let anchor;
      for (let r = 2; r < nav.rows - 2 && !anchor; r++)
        for (let c = 2; c < nav.cols - 2; c++) {
          const a = nav.worldAt(c, r),
            end = { x: a.x + v.x * 9, y: a.y + v.y * 9 };
          if (w.sight(p.map, a, end)) {
            anchor = a;
            break;
          }
        }
      if (!anchor) throw Error("No safe balance lane");
      Object.assign(p, anchor);
      const mobs = w.map(p.map).mobs;
      for (const m of mobs) {
        m.hp = 0;
        m.respawn = Infinity;
      }
      const selected = mobs.slice(0, 3),
        center = { x: p.x + v.x * 2, y: p.y + v.y * 2 };
      for (const [i, m] of selected.entries())
        Object.assign(m, {
          def: targetId,
          x: center.x + v.x * i * 0.25,
          y: center.y + v.y * i * 0.25,
          hp: 100000,
          maxHp: 100000,
          ai: "idle",
          dotUntil: 0,
        });
      const skill =
        p.classId === "herbalist"
          ? "115% / 독3겹 220%"
          : p.classId === "mage"
            ? "50% × 3"
            : "";
      const run = (stacks) => {
        for (const m of selected) {
          m.hp = 100000;
          m.toxinStacks = stacks;
          m.dotUntil = stacks ? 100 : 0;
          m.dotOwner = p.id;
          m.dotTick = 999;
        }
        p.cooldowns[4] = 0;
        p.focus = 100;
        p.action = null;
        p.anim = "idle";
        w.time = 0;
        if (!w.skill(p, 4, null, center)) throw Error("Cannot cast " + cls.id);
        while (w.time < 1.5) w.step(0.01);
        return selected.map((m) => 100000 - m.hp);
      };
      const damage = run(0),
        charged = cls.id === "herbalist" ? run(3) : null;
      rows.push({
        level,
        class: cls.name,
        target: MONSTERS.find((m) => m.id === targetId).name,
        targetId,
        power: stats(p).power,
        damage,
        threeTargets: damage.reduce((a, b) => a + b, 0),
        chargedThreeTargets: charged?.reduce((a, b) => a + b, 0),
        focus: 24,
        cooldown: 11,
        skill,
      });
    }
console.log(JSON.stringify(rows, null, 2));
