import { speciesForMap, encounterPoint } from "./ecology.js";
import {
  attackTimeline,
  HIT_OFFSET,
  STRIKE_DURATION,
  RECOVERY_DURATION,
} from "./animation.js";
import {
  attackZones,
  zoneHits,
  clearSight,
  bossAttack,
  bossPhase,
  segmentDistance,
} from "./combat.js";
import { DISCOVERIES, CHESTS } from "./exploration.js";
import {
  TEST_BALANCE,
  xpReward,
  dropChance,
  PICKUP_RANGE,
  NEARBY_PICKUP_RANGE,
  PICKUP_DURATION,
} from "./balance.js";
import { isWalkable, NAVIGATION } from "./art-layout.js";
import { direction, facesTarget, SOUTH } from "./directions.js";
import {
  LAYOUT_VERSION,
  habitatPoint,
  herbPoints,
  floorValue,
} from "./world-layout.js";
import {
  CLASSES,
  MAPS,
  MONSTERS,
  ITEMS,
  QUESTS,
  MAX_LEVEL,
  PORTALS,
  SKILL_COOLDOWNS,
  SKILL_COSTS,
} from "./data.js";
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export const hash = (s) =>
  [...s].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 17);
export const xpNeeded = (level) => 60 + level * 45;
export function stats(p) {
  const c = CLASSES.find((c) => c.id === p.classId) || CLASSES[0];
  const gear = Object.values(p.equipment || {})
    .map((id) => ITEMS[id])
    .filter(Boolean);
  return {
    maxHp:
      160 +
      p.level * (p.classId === "warden" ? 35 : 27) +
      (p.branch === "antler" ? p.level * 12 : 0),
    maxFocus: 100,
    attack: 12 + p.level * 4.5 + gear.reduce((s, i) => s + (i.attack || 0), 0),
    defense: p.level * 0.8 + gear.reduce((s, i) => s + (i.defense || 0), 0),
    range: c.id === "warden" ? 1.9 : c.id === "ranger" ? 7.5 : 6,
    speed: (c.id === "ranger" ? 3.7 : 3.3) * TEST_BALANCE.speed,
  };
}
export function createPlayer(classId = "warden", name = "새잎 모험가") {
  const cls = CLASSES.find((c) => c.id === classId) || CLASSES[0];
  const inventory = {
    [cls.weapon + "1"]: 1,
    [cls.id + "armor1"]: 1,
    hood1: 1,
    boots1: 1,
    charm1: 1,
    salve: 5,
    mintpotion: 3,
    fiber: 5,
    ironstone: 3,
    softleaf: 2,
    mint: 2,
  };
  const p = {
    version: 1,
    name: String(name).trim().slice(0, 16) || "새잎 모험가",
    classId: cls.id,
    branch: null,
    level: 1,
    xp: 0,
    gold: 80,
    inventory,
    equipment: {
      weapon: cls.weapon + "1",
      armor: cls.id + "armor1",
      head: "hood1",
      boots: "boots1",
      charm: "charm1",
    },
    map: "village",
    x: NAVIGATION.village.spawn.x,
    y: NAVIGATION.village.spawn.y,
    layoutVersion: LAYOUT_VERSION,
    visited: ["village"],
    defeatedBosses: [],
    discovered: [],
    quest: { index: 0, counts: {} },
    craftXp: 0,
    herbXp: 0,
    kills: 0,
    garden: [null, null],
    exploration: { discovered: [], opened: [], pending: [] },
  };
  p.hp = stats(p).maxHp;
  p.focus = 100;
  return p;
}
export function hydrateSave(raw) {
  if (
    !raw ||
    typeof raw !== "object" ||
    !CLASSES.some((c) => c.id === raw.classId)
  )
    return null;
  const p = createPlayer(raw.classId, raw.name);
  p.level = clamp(Math.floor(Number(raw.level) || 1), 1, MAX_LEVEL);
  p.xp = clamp(Number(raw.xp) || 0, 0, xpNeeded(p.level) - 1);
  p.gold = clamp(Math.floor(Number(raw.gold) || 0), 0, 1e8);
  p.inventory = Object.fromEntries(
    Object.entries(raw.inventory || {}).filter(
      ([id, n]) =>
        Object.hasOwn(ITEMS, id) &&
        Number.isSafeInteger(n) &&
        n > 0 &&
        n <= 99999,
    ),
  );
  for (const slot of ["weapon", "armor", "head", "boots", "charm"]) {
    const id = raw.equipment?.[slot],
      i = ITEMS[id];
    if (
      i &&
      i.slot === slot &&
      p.inventory[id] > 0 &&
      (!i.classId || i.classId === p.classId) &&
      i.level <= p.level
    )
      p.equipment[slot] = id;
    else if (!p.inventory[p.equipment[slot]])
      p.inventory[p.equipment[slot]] = 1;
  }
  const cls = CLASSES.find((c) => c.id === p.classId);
  if (p.level >= 25 && cls.branches.some((b) => b.id === raw.branch))
    p.branch = raw.branch;
  if (
    ITEMS[p.equipment.weapon].branch &&
    ITEMS[p.equipment.weapon].branch !== p.branch
  )
    p.equipment.weapon = cls.weapon + "1";
  p.visited = [
    ...new Set([
      "village",
      ...(raw.visited || []).filter((id) => MAPS.some((m) => m.id === id)),
    ]),
  ];
  p.defeatedBosses = (raw.defeatedBosses || []).filter((id) =>
    ["m20", "m40"].includes(id),
  );
  p.discovered = (raw.discovered || []).filter((id) =>
    MONSTERS.some((m) => m.id === id),
  );
  p.map = MAPS.some((m) => m.id === raw.map) ? raw.map : "village";
  if (
    MAPS.find((m) => m.id === p.map).region === 1 &&
    !p.defeatedBosses.includes("m20")
  )
    p.map = "village";
  if (
    Number(raw.layoutVersion) >= 2 &&
    !blocked(p.map, Number(raw.x), Number(raw.y))
  ) {
    p.x = Number(raw.x);
    p.y = Number(raw.y);
  } else Object.assign(p, NAVIGATION[p.map].spawn);
  p.quest = {
    index: clamp(Math.floor(raw.quest?.index || 0), 0, QUESTS.length),
    counts: {},
  };
  QUESTS.forEach((q) => {
    p.quest.counts[q.id] = clamp(
      Number(raw.quest?.counts?.[q.id]) || 0,
      0,
      q.count,
    );
  });
  p.craftXp = clamp(Number(raw.craftXp) || 0, 0, 1e7);
  p.herbXp = clamp(Number(raw.herbXp) || 0, 0, 1e7);
  p.kills = clamp(Number(raw.kills) || 0, 0, 1e7);
  p.garden = [0, 1].map((n) => {
    const g = raw.garden?.[n];
    return g &&
      ["softleaf", "mint", "saltflower", "breathgrass"].includes(g.item) &&
      Number.isFinite(g.readyAt)
      ? { item: g.item, readyAt: clamp(g.readyAt, 0, Date.now() + 120000) }
      : null;
  });
  p.exploration = {
    discovered: [
      ...new Set(
        (Array.isArray(raw.exploration?.discovered)
          ? raw.exploration.discovered
          : []
        ).filter((id) => DISCOVERIES.some((d) => d.id === id)),
      ),
    ],
    opened: [
      ...new Set(
        (Array.isArray(raw.exploration?.opened)
          ? raw.exploration.opened
          : []
        ).filter((id) => CHESTS.some((c) => c.id === id)),
      ),
    ],
  };
  p.exploration.pending = (
    Array.isArray(raw.exploration?.pending) ? raw.exploration.pending : []
  )
    .filter(
      (v, i, a) =>
        v &&
        CHESTS.some((c) => c.id === v.chest) &&
        p.exploration.opened.includes(v.chest) &&
        a.findIndex((o) => o?.chest === v.chest) === i,
    )
    .map((v) => ({
      chest: v.chest,
      rewards: [
        ...new Set(
          (Array.isArray(v.rewards) ? v.rewards : []).filter(
            (i) =>
              Number.isInteger(i) &&
              i >= 0 &&
              i < CHESTS.find((c) => c.id === v.chest).rewards.length,
          ),
        ),
      ],
    }))
    .filter((v) => v.rewards.length);
  p.hp = clamp(Number(raw.hp) || stats(p).maxHp, 1, stats(p).maxHp);
  p.focus = clamp(Number(raw.focus) || 100, 0, 100);
  return p;
}
export function serialize(p) {
  const keys = [
    "layoutVersion",
    "version",
    "name",
    "classId",
    "branch",
    "level",
    "xp",
    "gold",
    "inventory",
    "equipment",
    "map",
    "x",
    "y",
    "visited",
    "defeatedBosses",
    "discovered",
    "quest",
    "craftXp",
    "herbXp",
    "kills",
    "hp",
    "focus",
    "garden",
    "exploration",
  ];
  return structuredClone(Object.fromEntries(keys.map((k) => [k, p[k]])));
}
export function rollDrops(monster, rng = Math.random) {
  return monster.drops
    .filter((d) => rng() < dropChance(d.chance))
    .map((d) => ({
      item: d.item,
      count: d.min + Math.floor(rng() * (d.max - d.min + 1)),
    }));
}
export function grantXp(p, amount) {
  p.xp += xpReward(amount);
  let levels = 0;
  while (p.level < MAX_LEVEL && p.xp >= xpNeeded(p.level)) {
    p.xp -= xpNeeded(p.level);
    p.level++;
    levels++;
  }
  if (p.level === MAX_LEVEL) p.xp = 0;
  if (levels) {
    p.hp = stats(p).maxHp;
    p.focus = 100;
  }
  return levels;
}
export function recordEvent(p, kind, details = {}) {
  for (const q of QUESTS.slice(p.quest.index)) {
    if (
      q.kind !== kind ||
      (q.map && q.map !== details.map) ||
      (q.item && q.item !== details.item) ||
      (q.monster && q.monster !== details.monster)
    )
      continue;
    p.quest.counts[q.id] = Math.min(
      q.count,
      (p.quest.counts[q.id] || 0) + (details.count || 1),
    );
  }
}
export function questProgress(p) {
  const q = QUESTS[p.quest.index];
  return q ? Math.min(q.count, p.quest.counts[q.id] || 0) : 0;
}
export function blocked(map, x, y) {
  return !isWalkable(map, x, y);
}
export function findRoute(map, from, to) {
  const clear = (a, b) => {
    const n = Math.ceil(distance(a, b) * 10);
    for (let i = 1; i <= n; i++)
      if (
        floorValue(
          map,
          a.x + ((b.x - a.x) * i) / n,
          a.y + ((b.y - a.y) * i) / n,
        ) < (i === n ? 0.5 : 0.505)
      )
        return false;
    return true;
  };
  if (clear(from, to)) return [{ ...to }];
  const candidates = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const p = { x: Math.round(from.x) + dx, y: Math.round(from.y) + dy };
      if (!blocked(map, p.x, p.y) && clear(from, p)) candidates.push(p);
    }
  const start = candidates.sort(
    (a, b) => distance(a, from) - distance(b, from),
  )[0];
  if (!start) return [];
  const goal = { x: Math.round(to.x), y: Math.round(to.y) },
    key = (p) => p.x + "," + p.y;
  const open = [{ ...start, g: 0, f: distance(start, goal) }],
    best = new Map([[key(start), 0]]),
    parents = new Map(),
    closed = new Set();
  let reached = null;
  const push = (node) => {
    open.push(node);
    let i = open.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (open[p].f <= node.f) break;
      open[i] = open[p];
      i = p;
    }
    open[i] = node;
  };
  const pop = () => {
    const first = open[0],
      last = open.pop();
    if (open.length) {
      let i = 0;
      while (i * 2 + 1 < open.length) {
        let c = i * 2 + 1;
        if (c + 1 < open.length && open[c + 1].f < open[c].f) c++;
        if (last.f <= open[c].f) break;
        open[i] = open[c];
        i = c;
      }
      open[i] = last;
    }
    return first;
  };
  while (open.length) {
    const a = pop(),
      k = key(a);
    if (closed.has(k)) continue;
    closed.add(k);
    if (distance(a, to) < 1.5 && clear(a, to)) {
      reached = a;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const b = { x: a.x + dx, y: a.y + dy },
        bk = key(b),
        g = a.g + Math.hypot(dx, dy);
      if (
        closed.has(bk) ||
        blocked(map, b.x, b.y) ||
        !clear(a, b) ||
        g >= (best.get(bk) ?? Infinity)
      )
        continue;
      best.set(bk, g);
      parents.set(bk, a);
      push({ ...b, g, f: g + distance(b, goal) });
    }
  }
  if (!reached) return [];
  const route = [{ ...to }];
  let node = reached;
  while (node && key(node) !== key(start)) {
    route.unshift({ x: node.x, y: node.y });
    node = parents.get(key(node));
  }
  route.unshift({ ...start });
  const smooth = [];
  let anchor = from,
    index = 0;
  while (index < route.length) {
    let last = route.length - 1;
    while (last > index && !clear(anchor, route[last])) last--;
    smooth.push({ ...route[last] });
    anchor = route[last];
    index = last + 1;
  }
  return smooth;
}

export class World {
  constructor({ seed = 1234 } = {}) {
    this.time = 0;
    this.rng = seeded(seed);
    this.players = new Map();
    this.maps = new Map();
    this.effects = [];
    this.sequence = 0;
  }
  addPlayer(raw, id = "local") {
    const base = hydrateSave(raw) || createPlayer(raw?.classId, raw?.name);
    const p = {
      ...base,
      id,
      move: { x: 0, y: 0 },
      moveTarget: null,
      queuedAttack: null,
      cooldowns: [0, 0, 0, 0],
      attackReady: 0,
      potionReady: 0,
      anim: "idle",
      animAt: 0,
      animDuration: 0,
      action: null,
      dir: SOUTH,
      shield: 0,
      shieldUntil: 0,
      lastHit: -100,
      logs: [],
      lootNotices: [],
      poisonUntil: 0,
      poisonTick: 0,
      regenUntil: 0,
      guardPower: 0,
      spellCharge: 0,
      precisionUntil: 0,
      evadeUntil: 0,
    };
    if (blocked(p.map, p.x, p.y)) {
      Object.assign(p, NAVIGATION[p.map].spawn);
    }
    this.players.set(id, p);
    this.map(p.map);
    for (const pending of p.exploration.pending) {
      const chest = CHESTS.find((c) => c.id === pending.chest);
      this.spawnLoot(
        p,
        chest,
        pending.rewards
          .filter(
            (index) =>
              !this.map(chest.map).drops.some(
                (d) =>
                  d.owner === id &&
                  d.treasure === chest.id &&
                  d.reward === index &&
                  d.until > this.time,
              ),
          )
          .map((index) => ({
            ...chest.rewards[index],
            treasure: chest.id,
            reward: index,
          })),
        chest.map,
      );
    }
    this.log(p, "벨로아 대수림에 오신 것을 환영합니다.", "story");
    return p;
  }
  map(id) {
    if (this.maps.has(id)) return this.maps.get(id);
    const config = MAPS.find((m) => m.id === id);
    if (!config) throw new Error("Unknown map");
    const rng = seeded(hash(id)),
      mobs = [],
      herbs = [];
    const definitions = speciesForMap(id);
    for (const { habitat, def, guest } of definitions) {
      const count = def.type === "normal" ? (guest ? 3 : 6) : 1;
      for (let j = 0; j < count; j++) {
        let { x, y } = encounterPoint(id, habitat, j, rng);
        if (def.type === "boss") {
          ({ x, y } = NAVIGATION[id].boss || NAVIGATION[id].habitats[habitat]);
        }
        const safe = [
          NAVIGATION[id].west,
          NAVIGATION[id].east,
          NAVIGATION[id].spawn,
        ];
        for (
          let trial = 0;
          trial < 24 && safe.some((a) => distance(a, { x, y }) < 4);
          trial++
        )
          ({ x, y } = encounterPoint(id, habitat, j, rng));
        mobs.push({
          uid: `${def.id}-${guest ? "guest-" : ""}${j}`,
          def: def.id,
          x,
          y,
          homeX: x,
          homeY: y,
          hp: def.hp,
          maxHp: def.hp,
          dir: SOUTH,
          anim: "idle",
          animAt: 0,
          nextAttack: 1 + rng() * 2,
          respawn: 0,
          windup: null,
          rootUntil: 0,
          dotUntil: 0,
          dotTick: 0,
          markedUntil: 0,
          wanderAt: 0,
          ai: "idle",
          phase: 1,
          toxinStacks: 0,
        });
      }
    }
    if (!config.town)
      for (const [i, point] of herbPoints(id).entries()) {
        const { x, y, item, site, name, patch } = point;
        herbs.push({
          id: `herb-${id}-${i}`,
          x,
          y,
          item,
          site,
          siteName: name,
          patch,
          readyAt: 0,
        });
      }
    const value = { config, mobs, herbs, drops: [] };
    this.maps.set(id, value);
    return value;
  }
  log(p, text, type = "info") {
    p.logs.push({ id: ++this.sequence, text, type });
    if (p.logs.length > 12) p.logs.shift();
  }
  effect(map, kind, x, y, props = {}) {
    this.effects.push({
      id: ++this.sequence,
      map,
      kind,
      x,
      y,
      started: this.time,
      until: this.time + (props.duration || 0.75),
      ...props,
    });
  }
  gain(p, amount) {
    if (grantXp(p, amount)) {
      this.log(p, `레벨 ${p.level}! 새로운 숲길이 열립니다.`, "level");
      this.effect(p.map, "level", p.x, p.y, {
        text: `LEVEL ${p.level}`,
        duration: 1.6,
      });
    }
  }
  addItem(p, id, n = 1) {
    if (ITEMS[id]) p.inventory[id] = (p.inventory[id] || 0) + n;
  }
  spawnLoot(p, monster, entries, mapId = p.map) {
    entries.forEach((entry, i) => {
      let point = { x: monster.x, y: monster.y };
      for (let trial = 0; trial < 16; trial++) {
        const angle = (i / entries.length) * Math.PI * 2 + trial * 0.45,
          radius = 1.4 + (i % 2) * 0.6 + trial * 0.06,
          x = monster.x + Math.cos(angle) * radius,
          y = monster.y + Math.sin(angle) * radius;
        if (!blocked(mapId, x, y)) {
          point = { x, y };
          break;
        }
      }
      this.map(mapId).drops.push({
        id: ++this.sequence,
        kind: "item",
        ...entry,
        ...point,
        owner: p.id,
        until: this.time + (entry.treasure ? 86400 : 120),
        pickupAt: 0,
        pickupEnds: 0,
      });
    });
  }
  pickup(p, id) {
    const d = this.map(p.map).drops.find((d) => d.id === Number(id));
    if (
      !d ||
      d.owner !== p.id ||
      d.until <= this.time ||
      d.collected ||
      d.pickupEnds ||
      distance(p, d) > PICKUP_RANGE
    )
      return false;
    d.pickupAt = this.time;
    d.pickupEnds = this.time + PICKUP_DURATION;
    d.until = Math.max(d.until, d.pickupEnds + 1);
    return true;
  }
  moveEntity(entity, map, dx, dy, dt, speed) {
    const n = Math.hypot(dx, dy);
    if (n < 0.01) return false;
    dx /= Math.max(1, n);
    dy /= Math.max(1, n);
    const pieces = Math.max(1, Math.ceil((speed * dt) / 0.2)),
      sx = (dx * speed * dt) / pieces,
      sy = (dy * speed * dt) / pieces;
    let moved = false;
    entity.dir = direction(dx, dy);
    for (let step = 0; step < pieces; step++) {
      const nx = entity.x + sx,
        ny = entity.y + sy;
      if (!blocked(map, nx, ny)) {
        entity.x = nx;
        entity.y = ny;
        moved = true;
        continue;
      }
      if (!blocked(map, nx, entity.y)) {
        entity.x = nx;
        moved = true;
      }
      if (!blocked(map, entity.x, ny)) {
        entity.y = ny;
        moved = true;
      }
    }
    return moved;
  }

  act(id, action) {
    const p = this.players.get(id);
    if (!p || !action || typeof action.type !== "string") return false;
    const map = this.map(p.map),
      s = stats(p);
    switch (action.type) {
      case "move": {
        const x = Number(action.x),
          y = Number(action.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
        this.cancelAction(p);
        p.move = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
        p.moveTarget = null;
        p.route = [];
        p.queuedAttack = null;
        return true;
      }
      case "moveTo": {
        const x = Number(action.x),
          y = Number(action.y);
        if (!Number.isFinite(x) || !Number.isFinite(y) || blocked(p.map, x, y))
          return false;
        p.route = findRoute(p.map, p, { x, y });
        if (!p.route.length) return false;
        this.cancelAction(p);
        p.moveTarget = { x, y };
        p.move = { x: 0, y: 0 };
        p.queuedAttack = null;
        return true;
      }
      case "openChest":
        return this.openChest(p, action.chest);
      case "pickup":
        return this.pickup(p, action.drop);
      case "pickupNearest": {
        const drop = map.drops
          .filter(
            (d) =>
              d.owner === p.id &&
              !d.collected &&
              !d.pickupEnds &&
              d.until > this.time &&
              distance(p, d) <= NEARBY_PICKUP_RANGE &&
              this.sight(p.map, p, d),
          )
          .sort((a, b) => distance(p, a) - distance(p, b) || a.id - b.id)[0];
        return !!drop && this.pickup(p, drop.id);
      }
      case "attack":
        return this.attack(p, action.target);
      case "skill":
        return this.skill(p, Number(action.slot), action.target);
      case "potion":
        return this.potion(p, action.item || "salve");
      case "interact": {
        if (action.herb) {
          const h = map.herbs.find((h) => h.id === action.herb);
          if (!h || distance(p, h) > 2 || h.readyAt > this.time) return false;
          const n = action.harvest === "whole" ? 3 : 1;
          h.readyAt = this.time + (n === 3 ? 38 : 12);
          this.addItem(p, h.item, n);
          p.herbXp += n * 4;
          recordEvent(p, "gather", { item: h.item, count: n });
          this.log(p, `${ITEMS[h.item].name} ×${n} 채집`, "loot");
          this.effect(p.map, "leaf", h.x, h.y, { duration: 1 });
          return true;
        }
        const h = map.herbs
          .filter((h) => h.readyAt <= this.time)
          .sort((a, b) => distance(a, p) - distance(b, p))[0];
        if (h && distance(h, p) < 2)
          return this.act(id, {
            type: "interact",
            herb: h.id,
            harvest: action.harvest,
          });
        return false;
      }
      case "travel":
        return this.travel(p, action.map, !!action.fast);
      case "equip": {
        const i = ITEMS[action.item];
        if (
          !i?.slot ||
          !p.inventory[i.id] ||
          i.level > p.level ||
          (i.classId && i.classId !== p.classId) ||
          (i.branch && i.branch !== p.branch)
        )
          return false;
        p.equipment[i.slot] = i.id;
        p.hp = Math.min(p.hp, stats(p).maxHp);
        this.log(p, `${i.name} 장착`);
        return true;
      }
      case "craft":
        return this.craft(p, action.item);
      case "dismantle": {
        const i = ITEMS[action.item];
        if (
          !map.config.town ||
          i?.type !== "equipment" ||
          !i.recipe ||
          !p.inventory[i.id]
        )
          return false;
        const wearing = Object.values(p.equipment).includes(i.id) ? 1 : 0;
        if (p.inventory[i.id] <= wearing) return false;
        p.inventory[i.id]--;
        for (const [id, n] of Object.entries(i.recipe))
          this.addItem(p, id, Math.max(1, Math.floor(n * 0.35)));
        this.log(p, `${i.name}에서 재료 일부를 되찾았습니다.`, "loot");
        return true;
      }
      case "plant": {
        const slot = Number(action.slot),
          id = action.item;
        if (
          !map.config.town ||
          ![0, 1].includes(slot) ||
          p.garden[slot] ||
          !["softleaf", "mint", "saltflower", "breathgrass"].includes(id) ||
          !p.inventory[id]
        )
          return false;
        p.inventory[id]--;
        p.garden[slot] = { item: id, readyAt: Date.now() + 120000 };
        this.log(p, `${ITEMS[id].name}을 화단에 심었습니다.`);
        return true;
      }
      case "harvest": {
        const slot = Number(action.slot),
          g = p.garden[slot];
        if (
          !map.config.town ||
          ![0, 1].includes(slot) ||
          !g ||
          g.readyAt > Date.now()
        )
          return false;
        this.addItem(p, g.item, 3);
        p.herbXp += 10;
        recordEvent(p, "gather", { item: g.item, count: 3 });
        p.garden[slot] = null;
        this.log(p, `${ITEMS[g.item].name} ×3 수확`, "loot");
        return true;
      }
      case "buy": {
        const i = ITEMS[action.item];
        if (
          !map.config.town ||
          !i ||
          i.type !== "consumable" ||
          p.gold < i.price
        )
          return false;
        p.gold -= i.price;
        this.addItem(p, i.id);
        this.log(p, `${i.name} 구입`, "loot");
        return true;
      }
      case "sell": {
        const i = ITEMS[action.item];
        if (!map.config.town || !i || !p.inventory[i.id]) return false;
        const equipped = Object.values(p.equipment).includes(i.id) ? 1 : 0;
        if (p.inventory[i.id] <= equipped) return false;
        p.inventory[i.id]--;
        p.gold += Math.max(1, Math.floor(i.price * 0.25));
        this.log(p, `${i.name} 판매`);
        return true;
      }
      case "rest": {
        if (!map.config.town) return false;
        p.hp = s.maxHp;
        p.focus = 100;
        p.poisonUntil = 0;
        this.log(p, "따뜻한 쉼터에서 기운을 되찾았습니다.", "heal");
        return true;
      }
      case "claimQuest": {
        const q = QUESTS[p.quest.index];
        if (!q || questProgress(p) < q.count) return false;
        p.gold += q.gold;
        this.gain(p, q.xp);
        p.quest.index++;
        this.addItem(p, "salve", 2);
        this.addItem(
          p,
          MAPS.find((m) => m.id === p.map).region ? "seawood" : "fiber",
          3,
        );
        this.log(
          p,
          `「${q.title}」 완료 · ${xpReward(q.xp)} 경험치 · ${q.gold} 리프`,
          "story",
        );
        this.effect(p.map, "quest", p.x, p.y, {
          text: "이야기 완료",
          duration: 1.2,
        });
        return true;
      }
      case "subclass": {
        const c = CLASSES.find((c) => c.id === p.classId);
        if (
          p.branch ||
          p.level < 25 ||
          p.map !== "shelltown" ||
          !c.branches.some((b) => b.id === action.branch)
        )
          return false;
        p.branch = action.branch;
        this.gain(p, 0);
        p.hp = stats(p).maxHp;
        this.log(
          p,
          `${c.branches.find((b) => b.id === p.branch).name}의 길을 선택했습니다!`,
          "level",
        );
        this.effect(p.map, "level", p.x, p.y, {
          text: "새로운 숲길",
          duration: 1.6,
        });
        return true;
      }
      default:
        return false;
    }
  }
  sight(map, a, b) {
    return clearSight(map, a, b, isWalkable);
  }
  explore(p) {
    for (const site of DISCOVERIES)
      if (
        site.map === p.map &&
        !p.exploration.discovered.includes(site.id) &&
        distance(p, site) < site.radius &&
        this.sight(p.map, p, site)
      ) {
        p.exploration.discovered.push(site.id);
        this.gain(p, site.xp);
        this.log(p, site.name + " 발견 · " + site.lore, "story");
        this.effect(p.map, "discovery", site.x, site.y, {
          text: site.name + " 발견",
          owner: p.id,
          color: "#e8efad",
          duration: 1.8,
          cue: "discovery",
        });
      }
  }
  openChest(p, id) {
    const chest = CHESTS.find((c) => c.id === id && c.map === p.map);
    if (
      !chest ||
      p.exploration.opened.includes(id) ||
      !p.exploration.discovered.includes(chest.site) ||
      distance(p, chest) > 2.6 ||
      !this.sight(p.map, p, chest)
    )
      return false;
    if (chest.boss && !p.defeatedBosses.includes(chest.boss)) {
      this.log(p, "이 지역의 수호자를 진정시키면 보물함이 열립니다.", "story");
      return false;
    }
    p.exploration.opened.push(id);
    p.exploration.pending.push({
      chest: id,
      rewards: chest.rewards.map((_, i) => i),
    });
    this.spawnLoot(
      p,
      chest,
      chest.rewards.map((r, i) => ({ ...r, treasure: id, reward: i })),
    );
    this.log(
      p,
      chest.name + "을 열었습니다. 바닥의 보물을 클릭해 가져가세요.",
      "story",
    );
    this.effect(p.map, "treasure", chest.x, chest.y, {
      text: "숨은 보물 발견",
      owner: p.id,
      cue: "treasure",
      duration: 1.4,
    });
    return true;
  }
  toxin(p, m, amount = 1, duration = 6) {
    if (m.hp <= 0) return;
    m.toxinStacks = Math.min(
      3,
      (m.dotUntil > this.time ? m.toxinStacks || 0 : 0) + amount,
    );
    m.dotUntil = this.time + duration;
    m.dotOwner = p.id;
    m.dotPower = stats(p).attack * (0.18 + m.toxinStacks * 0.12);
    m.dotTick = this.time + 1;
  }
  target(p, uid, range = 12) {
    const mobs = this.map(p.map).mobs.filter((m) => m.hp > 0);
    return (
      mobs.find((m) => m.uid === uid && distance(m, p) <= range) ||
      mobs
        .filter((m) => distance(m, p) <= range)
        .sort((a, b) => distance(a, p) - distance(b, p))[0]
    );
  }
  attack(p, uid) {
    if (p.action || this.time < p.attackReady) return false;
    const t = this.target(p, uid);
    if (!t) return false;
    const s = stats(p);
    if (distance(p, t) > s.range + 0.2 || !this.sight(p.map, p, t)) {
      p.moveTarget = { x: t.x, y: t.y };
      p.route = findRoute(p.map, p, t);
      if (!p.route.length) return false;
      p.queuedPathAt = this.time + 0.5;
      p.queuedAttack = t.uid;
      return true;
    }
    p.attackReady = this.time + 0.62;
    return this.beginAction(p, "basic", t);
  }
  cancelAction(p) {
    p.action = null;
    if (["windup", "attack", "recover"].includes(p.anim)) p.anim = "idle";
  }
  beginAction(p, kind, target, slot = null, selfCast = false) {
    p.action = {
      ...attackTimeline(this.time, p.classId),
      kind,
      slot,
      target: target?.uid || null,
      selfCast,
      map: p.map,
      released: false,
    };
    p.anim = "windup";
    p.animAt = this.time;
    p.animDuration = p.action.strikeAt - this.time;
    p.attackReady = Math.max(p.attackReady, p.action.endAt);
    p.moveTarget = null;
    p.move = { x: 0, y: 0 };
    p.route = [];
    p.queuedAttack = null;
    if (target) p.dir = direction(target.x - p.x, target.y - p.y);
    return true;
  }
  advanceAction(p) {
    const a = p.action;
    if (!a) return;
    if (a.map !== p.map || p.hp <= 0) {
      this.cancelAction(p);
      return;
    }
    if (!a.released && this.time + 1e-9 >= a.hitAt) {
      a.released = true;
      const target = this.map(p.map).mobs.find(
        (m) => m.uid === a.target && m.hp > 0,
      );
      const range = stats(p).range + (a.kind === "basic" ? 0.6 : 2);
      const valid =
        target &&
        this.sight(p.map, p, target) &&
        distance(p, target) <=
          (a.slot === 3 && p.branch === "hawk" ? 11 : range);
      if (a.kind === "basic" && valid) this.releaseBasic(p, target);
      if (a.kind === "skill" && (a.selfCast || valid))
        this.releaseSkill(p, a.slot, valid ? target : null);
    }
    if (this.time >= a.endAt) {
      this.cancelAction(p);
      return;
    }
    if (this.time < a.strikeAt) {
      p.anim = "windup";
      p.animAt = a.start;
      p.animDuration = a.strikeAt - a.start;
    } else if (this.time < a.strikeEnd) {
      p.anim = "attack";
      p.animAt = a.strikeAt;
      p.animDuration = STRIKE_DURATION;
    } else {
      p.anim = "recover";
      p.animAt = a.strikeEnd;
      p.animDuration = RECOVERY_DURATION;
    }
  }
  releaseBasic(p, t) {
    const s = stats(p);
    this.damage(p, t, s.attack, "hit");
    if (p.classId === "mage") p.spellCharge = Math.min(3, p.spellCharge + 1);
    if (p.classId === "herbalist") this.toxin(p, t, 1, 4);
    this.effect(p.map, "action", p.x, p.y, {
      cue: p.classId,
      owner: p.id,
      duration: 0.2,
    });
    if (s.range > 2)
      this.effect(p.map, "projectile", p.x, p.y, {
        tx: t.x,
        ty: t.y,
        color: CLASSES.find((c) => c.id === p.classId).color,
        duration: 0.32,
      });
  }
  damage(p, m, value, kind = "hit") {
    if (m.hp <= 0 || m.ai === "return") return;
    const def = MONSTERS.find((d) => d.id === m.def),
      crit = this.rng() < 0.12;
    const armored =
      ["beetle", "hermit", "crab"].includes(def.shape) &&
      m.windup &&
      facesTarget(m, p);
    const precision =
      p.classId === "ranger" &&
      p.precisionUntil > this.time &&
      kind !== "poison";
    if (precision) p.precisionUntil = 0;
    const n = Math.max(
      1,
      Math.round(
        (value * (precision ? 1.55 : 1) - def.defense * 0.4) *
          (m.markedUntil > this.time ? 1.3 : 1) *
          (crit ? 1.5 : 1) *
          (armored ? 0.65 : 1),
      ),
    );
    m.hp = Math.max(0, m.hp - n);
    m.threat = p.id;
    m.threatUntil = this.time + 4;
    m.hitUntil = this.time + 0.12;
    m.anim = "hurt";
    m.animAt = this.time;
    if (!p.discovered.includes(def.id)) p.discovered.push(def.id);
    this.effect(p.map, kind, m.x, m.y, {
      text: String(n),
      crit,
      owner: p.id,
      impact: crit ? 2 : 1,
      cue: kind === "poison" ? null : crit ? "critical" : "hit",
      color: crit ? "#ffe7a1" : "#fff1ce",
      duration: 0.85,
    });
    if (m.hp <= 0) {
      m.anim = "death";
      m.animAt = this.time;
      m.windup = null;
      m.respawn =
        this.time +
        (def.type === "boss" ? 95 : def.type === "normal" ? 20 : 45);
      p.kills++;
      this.gain(p, def.xp);
      const gold = Math.round(def.level * (def.type === "boss" ? 15 : 1.8) + 5);
      recordEvent(p, "kill", { map: p.map });
      if (def.type === "boss") {
        if (!p.defeatedBosses.includes(def.id)) p.defeatedBosses.push(def.id);
        recordEvent(p, "boss", { monster: def.id });
        this.log(
          p,
          `${def.name}이 고요해졌습니다. 숲에 길이 열립니다.`,
          "story",
        );
      }
      this.spawnLoot(p, m, [
        ...rollDrops(def, this.rng),
        { kind: "currency", count: gold },
      ]);
      this.log(
        p,
        `${def.name} · +${xpReward(def.xp)} 경험치 · 전리품이 떨어졌습니다.`,
        "combat",
      );
    }
  }
  skill(p, slot, uid) {
    if (
      p.action ||
      !Number.isInteger(slot) ||
      slot < 0 ||
      slot > 3 ||
      p.cooldowns[slot] > this.time ||
      p.focus < SKILL_COSTS[slot] ||
      (slot === 1 && p.level < 4) ||
      (slot === 2 && p.level < 8) ||
      (slot === 3 && !p.branch)
    )
      return false;
    const s = stats(p),
      t = this.target(p, uid, slot === 3 ? 11 : 9);
    const selfCast =
      (p.classId === "herbalist" && [0, 2].includes(slot)) ||
      (slot === 1 && ["warden", "ranger"].includes(p.classId)) ||
      (slot === 3 && ["antler", "flower", "mist"].includes(p.branch));
    if (t && !selfCast && !this.sight(p.map, p, t)) return false;
    if (
      !t &&
      !(p.classId === "herbalist" && (slot === 0 || slot === 2)) &&
      !(slot === 1 && ["warden", "ranger"].includes(p.classId)) &&
      !(slot === 3 && ["antler", "flower", "mist"].includes(p.branch))
    )
      return false;
    if (
      t &&
      !selfCast &&
      distance(t, p) > s.range + 2 &&
      !(slot === 3 && p.branch === "hawk")
    )
      return false;
    p.focus -= SKILL_COSTS[slot];
    p.cooldowns[slot] = this.time + SKILL_COOLDOWNS[slot];
    if (p.classId === "ranger" && slot === 1) {
      p.moveTarget = null;
      p.queuedAttack = null;
      this.releaseSkill(p, slot, t);
      p.anim = "recover";
      p.animAt = this.time;
      p.animDuration = RECOVERY_DURATION;
      return true;
    }
    return this.beginAction(p, "skill", t, slot, selfCast);
  }
  releaseSkill(p, slot, t) {
    const s = stats(p);
    const aoe = (center, r, mult, root = 0) => {
      for (const m of this.map(p.map).mobs)
        if (
          m.hp > 0 &&
          distance(m, center) <= r &&
          this.sight(p.map, center, m)
        ) {
          this.damage(p, m, s.attack * mult, "burst");
          if (root)
            m.rootUntil =
              this.time +
              (MONSTERS.find((d) => d.id === m.def).type === "boss"
                ? Math.min(1, root)
                : root);
        }
    };
    const heal = (amount) => {
      for (const ally of this.players.values())
        if (ally.map === p.map && distance(ally, p) < 4) {
          ally.hp = Math.min(stats(ally).maxHp, ally.hp + amount);
          this.effect(p.map, "heal", ally.x, ally.y, {
            text: "+" + Math.round(amount),
            color: "#b7edab",
          });
        }
    };
    if (p.classId === "warden") {
      if (slot === 0 && t) {
        const dx = t.x - p.x,
          dy = t.y - p.y,
          n = Math.hypot(dx, dy) || 1,
          end = { x: p.x + (dx / n) * 3.6, y: p.y + (dy / n) * 3.6 };
        const power = 2.1 + p.guardPower * 0.35;
        p.guardPower = 0;
        for (const mob of this.map(p.map).mobs)
          if (
            mob.hp > 0 &&
            (mob === t || segmentDistance(mob, p, end) < 0.75) &&
            this.sight(p.map, p, mob)
          )
            this.damage(p, mob, s.attack * power);
        this.effect(p.map, "beam", p.x, p.y, {
          tx: end.x,
          ty: end.y,
          duration: 0.3,
        });
      }
      if (slot === 1) {
        p.shield = s.maxHp * 0.28;
        p.shieldUntil = this.time + 7;
        this.effect(p.map, "shield", p.x, p.y, { duration: 1 });
      }
      if (slot === 2) {
        aoe(p, 3, 1.9);
        for (const mob of this.map(p.map).mobs)
          if (
            mob.hp > 0 &&
            distance(mob, p) < 3 &&
            this.sight(p.map, p, mob) &&
            MONSTERS.find((d) => d.id === mob.def).type !== "boss"
          ) {
            mob.windup = null;
            mob.nextAttack = this.time + 1.2;
            mob.rootUntil = this.time + 0.6;
          }
        this.effect(p.map, "slash", p.x, p.y, { radius: 3 });
      }
    }
    if (p.classId === "mage") {
      if (slot === 0 && t) {
        this.damage(p, t, s.attack * 2.2, "burst");
        p.spellCharge = Math.min(3, p.spellCharge + 1);
      }
      if (slot === 1 && t) {
        const charge = p.spellCharge;
        p.spellCharge = 0;
        aoe(t, 2.5 + charge * 0.3, 2.1 + charge * 0.45);
        this.effect(p.map, "magic", t.x, t.y, {
          radius: 2.5 + charge * 0.3,
          text: charge ? "달씨앗 " + charge + " 공명" : null,
        });
      }
      if (slot === 2 && t) {
        aoe(t, 3, 1.35, 3);
        this.effect(p.map, "vine", t.x, t.y, { radius: 3 });
      }
    }
    if (p.classId === "ranger") {
      if (slot === 0 && t) this.damage(p, t, s.attack * 2.2);
      if (slot === 1) {
        const dx = t ? p.x - t.x : p.move.x || 1,
          dy = t ? p.y - t.y : p.move.y;
        for (let n = 0; n < 8; n++) this.moveEntity(p, p.map, dx, dy, 0.075, 5);
        p.evadeUntil = this.time + 0.45;
        p.precisionUntil = this.time + 4;
        this.effect(p.map, "dash", p.x, p.y, {
          text: "회피 · 정조준",
          cue: "dodge",
          owner: p.id,
        });
      }
      if (slot === 2 && t) {
        t.markedUntil = this.time + 9;
        this.damage(p, t, s.attack * 1.2);
        this.effect(p.map, "mark", t.x, t.y, { duration: 1 });
      }
    }
    if (p.classId === "herbalist") {
      if (slot === 0) heal(s.maxHp * 0.32);
      if (slot === 1 && t) {
        this.damage(p, t, s.attack * 1.4);
        this.toxin(p, t, 2, 8);
        this.effect(p.map, "poison", t.x, t.y);
      }
      if (slot === 2) {
        heal(s.maxHp * 0.12);
        aoe(p, 3, 1.2);
        this.effect(p.map, "garden", p.x, p.y, {
          radius: 3,
          duration: 7,
          owner: p.id,
          tickAt: this.time + 1,
          power: s.attack,
        });
      }
    }
    if (slot === 3) {
      if (p.branch === "antler") {
        for (const ally of this.players.values())
          if (ally.map === p.map && distance(ally, p) < 5) {
            ally.shield = stats(ally).maxHp * 0.45;
            ally.shieldUntil = this.time + 9;
          }
        aoe(p, 3, 2);
        this.effect(p.map, "shield", p.x, p.y, { radius: 4, duration: 1.3 });
      }
      if (p.branch === "thorn" && t) {
        const d = distance(p, t);
        for (let i = 0; i < 12 && distance(p, t) > 1.2; i++)
          this.moveEntity(
            p,
            p.map,
            t.x - p.x,
            t.y - p.y,
            0.05,
            Math.min(12, d * 2),
          );
        this.damage(p, t, s.attack * 4.4);
      }
      if (p.branch === "moon" && t) {
        this.damage(p, t, s.attack * (5.5 + p.spellCharge * 0.5), "burst");
        p.spellCharge = 0;
        this.effect(p.map, "beam", p.x, p.y, { tx: t.x, ty: t.y, duration: 1 });
      }
      if (p.branch === "bloom" && t) {
        aoe(t, 4, 3.6, 3);
        this.effect(p.map, "garden", t.x, t.y, { radius: 4, duration: 1.6 });
      }
      if (p.branch === "hawk" && t) {
        this.damage(p, t, s.attack * 5.8);
        this.effect(p.map, "beam", p.x, p.y, {
          tx: t.x,
          ty: t.y,
          duration: 0.5,
        });
      }
      if (p.branch === "mist") {
        aoe(p, 5, 2.8);
        p.shield = s.maxHp * 0.22;
        p.shieldUntil = this.time + 5;
        this.effect(p.map, "dash", p.x, p.y, { radius: 4 });
      }
      if (p.branch === "flower") {
        heal(s.maxHp * 0.6);
        p.regenUntil = this.time + 10;
        p.poisonUntil = 0;
        this.effect(p.map, "garden", p.x, p.y, { radius: 4, duration: 2 });
      }
      if (p.branch === "venom" && t) {
        aoe(t, 3.5, 3.5);
        for (const m of this.map(p.map).mobs)
          if (m.hp > 0 && distance(m, t) < 4) {
            this.toxin(p, m, 3, 10);
          }
        this.effect(p.map, "poison", t.x, t.y, { radius: 3.5 });
      }
    }
    this.effect(p.map, "action", p.x, p.y, {
      cue: p.classId,
      owner: p.id,
      duration: 0.2,
    });
    return true;
  }
  potion(p, id) {
    const i = ITEMS[id];
    if (
      i?.type !== "consumable" ||
      !p.inventory[id] ||
      p.potionReady > this.time
    )
      return false;
    p.inventory[id]--;
    p.potionReady = this.time + 3;
    if (i.heal) p.hp = Math.min(stats(p).maxHp, p.hp + stats(p).maxHp * i.heal);
    if (i.focus) p.focus = Math.min(100, p.focus + i.focus);
    if (i.cleanse) p.poisonUntil = 0;
    this.log(p, `${i.name} 사용`, "heal");
    this.effect(p.map, "heal", p.x, p.y, { text: "회복", color: "#b8efaf" });
    return true;
  }
  craft(p, id) {
    const i = ITEMS[id];
    if (
      !i?.recipe ||
      !this.map(p.map).config.town ||
      (i.level || 1) > p.level ||
      (i.branch && i.branch !== p.branch)
    )
      return false;
    const cost = i.type === "consumable" ? 2 : 5 * (i.tier || 1);
    if (
      p.gold < cost ||
      Object.entries(i.recipe).some(([id, n]) => (p.inventory[id] || 0) < n)
    )
      return false;
    for (const [id, n] of Object.entries(i.recipe)) p.inventory[id] -= n;
    p.gold -= cost;
    this.addItem(p, i.id);
    p.craftXp += i.type === "consumable" ? 5 : 15;
    recordEvent(p, "craft", { item: i.id });
    this.log(p, `${i.name} 제작 완료`, "loot");
    return true;
  }
  travel(p, dest, fast) {
    const next = MAPS.find((m) => m.id === dest);
    if (!next || dest === p.map) return false;
    if (next.region === 1 && !p.defeatedBosses.includes("m20")) {
      this.log(p, "그루터기 할아범을 진정시키면 해안으로 가는 길이 열립니다.");
      return false;
    }
    if (fast) {
      if (!next.town || !p.visited.includes(dest) || this.time - p.lastHit < 5)
        return false;
    } else {
      const portal = PORTALS(p.map).find((a) => a.to === dest);
      if (!portal || distance(p, portal) > 2.5) return false;
    }
    const prev = MAPS.findIndex((m) => m.id === p.map),
      ni = MAPS.findIndex((m) => m.id === dest);
    this.cancelAction(p);
    p.map = dest;
    const entry = fast
      ? NAVIGATION[dest].spawn
      : ni > prev
        ? NAVIGATION[dest].westLanding
        : NAVIGATION[dest].eastLanding;
    Object.assign(p, entry);
    p.move = { x: 0, y: 0 };
    p.moveTarget = null;
    p.route = [];
    p.queuedAttack = null;
    p.poisonUntil = 0;
    if (!p.visited.includes(dest)) p.visited.push(dest);
    this.map(dest);
    recordEvent(p, "travel", { map: dest });
    this.log(p, `${next.name}에 도착했습니다.`, "story");
    this.effect(dest, "arrival", p.x, p.y, { text: next.name, duration: 1.5 });
    return true;
  }
  hurtPlayer(p, n, { avoidable = true } = {}) {
    if (avoidable && p.evadeUntil > this.time) {
      this.effect(p.map, "evade", p.x, p.y, {
        text: "회피",
        owner: p.id,
        cue: "dodge",
        duration: 0.5,
      });
      return;
    }
    if (p.shieldUntil <= this.time) p.shield = 0;
    const absorbed = Math.min(n, p.shield);
    p.shield -= absorbed;
    if (absorbed > 0 && p.classId === "warden")
      p.guardPower = Math.min(3, p.guardPower + 1);
    n -= absorbed;
    p.hp = Math.max(0, p.hp - n);
    p.lastHit = this.time;
    if (!p.action) {
      p.anim = "hurt";
      p.animAt = this.time;
      p.animDuration = 0.3;
    }
    this.effect(p.map, "hurt", p.x, p.y, {
      text: n > 0 ? "-" + n : "방어",
      color: "#f6b4a4",
      owner: p.id,
      cue: absorbed > 0 ? "guard" : "hurt",
      impact: n > 0 ? 2 : 0,
    });
    if (p.hp <= 0) {
      this.cancelAction(p);
      const town = MAPS.find(
        (m) => m.town && m.region === MAPS.find((m) => m.id === p.map).region,
      );
      p.map = town.id;
      Object.assign(p, NAVIGATION[p.map].spawn);
      p.hp = Math.ceil(stats(p).maxHp * 0.65);
      p.focus = 70;
      p.moveTarget = null;
      p.move = { x: 0, y: 0 };
      p.queuedAttack = null;
      p.poisonUntil = 0;
      p.gold -= Math.min(p.gold, Math.floor(p.gold * 0.03));
      this.log(
        p,
        "마을에서 깨어났습니다. 장비와 아이템은 무사합니다.",
        "story",
      );
    }
  }
  moveMob(m, map, target, dt, speed) {
    if (m.rootUntil > this.time) return false;
    if (this.sight(map, m, target))
      return this.moveEntity(
        m,
        map,
        target.x - m.x,
        target.y - m.y,
        dt,
        Math.min(speed, distance(m, target) / Math.max(dt, 0.001)),
      );
    if (
      this.time >= (m.pathAt || 0) ||
      !m.pathGoal ||
      distance(m.pathGoal, target) > 2
    ) {
      m.path = findRoute(map, m, target);
      m.pathGoal = { x: target.x, y: target.y };
      m.pathAt = this.time + 0.8;
    }
    while (m.path?.length && distance(m, m.path[0]) < 0.15) m.path.shift();
    const next = m.path?.[0];
    return (
      !!next &&
      this.moveEntity(
        m,
        map,
        next.x - m.x,
        next.y - m.y,
        dt,
        Math.min(speed, distance(m, next) / Math.max(dt, 0.001)),
      )
    );
  }
  updateMob(m, id, players, dt) {
    const def = MONSTERS.find((d) => d.id === m.def),
      boss = def.type === "boss";
    const home = { x: m.homeX, y: m.homeY };
    if (boss) {
      const phase = bossPhase(m);
      if (phase > m.phase) {
        m.phase = phase;
        this.effect(id, "phase", m.x, m.y, {
          text:
            (phase === 2 ? "수호자의 힘이 깨어납니다" : "마지막 숨결") +
            " · " +
            phase +
            "단계",
          cue: "phase",
          duration: 1.6,
        });
      }
    }
    if (m.windup) {
      const strikeAt = m.windup.strikeAt ?? m.windup.at - HIT_OFFSET;
      if (this.time < m.windup.at) {
        m.anim = this.time < strikeAt ? "windup" : "attack";
        m.animAt =
          this.time < strikeAt ? (m.windup.start ?? m.animAt) : strikeAt;
        m.animDuration =
          this.time < strikeAt ? strikeAt - m.animAt : STRIKE_DURATION;
        return;
      }
      const w = m.windup;
      m.windup = null;
      m.anim = "attack";
      m.animAt = strikeAt;
      m.animDuration = STRIKE_DURATION;
      m.attackEnd = strikeAt + STRIKE_DURATION;
      for (const p of players)
        if (
          p.map === id &&
          attackZones(w).some((zone) => zoneHits(p, zone)) &&
          this.sight(id, m, p)
        ) {
          this.hurtPlayer(
            p,
            Math.max(
              2,
              Math.round(
                (def.attack - stats(p).defense * 0.45) * (w.damageScale || 1),
              ),
            ),
          );
          if (
            ["bug", "jelly", "mantis", "anemone"].includes(def.shape) &&
            def.region === 1 &&
            p.map === id &&
            p.evadeUntil <= this.time
          )
            p.poisonUntil = this.time + 5;
        }
      if (w.jump || w.charge) {
        const dest = w.jump ? w : { x: w.tx, y: w.ty };
        for (let i = 0; i < 12 && distance(m, dest) > 0.2; i++)
          this.moveEntity(m, id, dest.x - m.x, dest.y - m.y, 0.05, 6);
      }
      for (const [i, zone] of attackZones(w).entries()) {
        this.effect(id, "enemy", zone.x, zone.y, {
          radius: zone.radius || 2,
          duration: 0.45,
          cue: i === 0 ? (boss ? "slam" : "enemy") : null,
          impact: boss ? 2 : 0,
        });
        if (w.slow)
          this.effect(id, "slow", zone.x, zone.y, {
            radius: zone.radius,
            duration: 4,
          });
      }
      if (def.ranged)
        this.effect(id, "projectile", m.x, m.y, {
          tx: w.x,
          ty: w.y,
          duration: 0.3,
        });
      m.recoverUntil = m.attackEnd + (boss ? 0.65 : 0.3);
      m.nextAttack = this.time + (boss ? 2.2 - (m.phase - 1) * 0.35 : 2.1);
      return;
    }
    if (m.recoverUntil > this.time) {
      if (this.time < m.attackEnd) {
        m.anim = "attack";
        m.animDuration = STRIKE_DURATION;
      } else {
        m.anim = "recover";
        m.animAt = m.attackEnd;
        m.animDuration = boss ? 0.65 : 0.3;
      }
      return;
    }
    const active = players.filter((p) => p.hp > 0 && p.map === id);
    const threat = active.find(
      (p) =>
        p.id === m.threat && m.threatUntil > this.time && distance(p, m) < 14,
    );
    const nearest = active
      .slice()
      .sort((a, b) => distance(a, m) - distance(b, m))[0];
    let target = threat || nearest;
    const homeDistance = distance(m, home),
      aggro = boss ? 10 : def.ranged ? 7 : 5.3;
    if (
      m.ai === "return" ||
      homeDistance > 14 ||
      (m.ai === "chase" && (!target || distance(target, home) > 19))
    ) {
      m.ai = "return";
      m.windup = null;
      if (homeDistance < 0.4) {
        m.hp = m.maxHp;
        m.ai = "idle";
        m.threat = null;
        m.threatUntil = 0;
        m.dotUntil = 0;
        m.rootUntil = 0;
        m.toxinStacks = 0;
        m.markedUntil = 0;
        m.phase = 1;
        m.pattern = 0;
        m.path = [];
      } else if (this.moveMob(m, id, home, dt, def.speed * 1.3))
        m.anim = "walk";
      return;
    }
    if (
      target &&
      (threat ||
        m.ai === "chase" ||
        (distance(m, target) < aggro && this.sight(id, m, target)))
    ) {
      if (distance(m, target) > 16) {
        m.ai = "return";
        return;
      }
      m.ai = "chase";
      if (!target.discovered.includes(def.id)) target.discovered.push(def.id);
      const d = distance(m, target),
        reach = boss ? 9 : def.ranged ? 4.8 : 1.25;
      const visible = this.sight(id, m, target);
      if (visible && d <= reach && this.time >= m.nextAttack) {
        let w;
        if (boss) w = bossAttack(m, target, this.time);
        else {
          w = {
            x: target.x,
            y: target.y,
            radius: 0.95,
            start: this.time,
            at: this.time + 0.75,
            style: "circle",
            name: def.ranged ? "조준 사격" : "공격 준비",
          };
          if (["boar", "squirrel", "weasel", "fox"].includes(def.shape)) {
            const n = d || 1;
            w = {
              ...w,
              x: m.x,
              y: m.y,
              tx: m.x + ((target.x - m.x) / n) * 4,
              ty: m.y + ((target.y - m.y) / n) * 4,
              style: "line",
              width: 0.75,
              charge: true,
              at: this.time + 0.95,
              name: "돌진 준비",
            };
          }
          if (["frog", "monkey"].includes(def.shape))
            w = {
              ...w,
              radius: 1.4,
              jump: true,
              at: this.time + 0.95,
              name: "도약 준비",
            };
          if (["jelly", "anemone"].includes(def.shape))
            w = { ...w, radius: 1.7, name: "독향 확산" };
        }
        m.pattern = (m.pattern || 0) + 1;
        w.strikeAt = w.at;
        w.at += HIT_OFFSET;
        m.windup = w;
        m.anim = "windup";
        m.animDuration = w.strikeAt - w.start;
        m.animAt = this.time;
        m.dir = direction(target.x - m.x, target.y - m.y);
        if (boss)
          this.effect(id, "warning", m.x, m.y, {
            cue: "warning",
            duration: 0.5,
          });
      } else if (def.ranged && d < 2.7 && visible && m.rootUntil <= this.time) {
        const moved = this.moveEntity(
          m,
          id,
          m.x - target.x,
          m.y - target.y,
          dt,
          def.speed * 0.9,
        );
        m.anim = moved ? "walk" : "idle";
      } else if (d > reach * 0.85 || !visible) {
        const moved = this.moveMob(m, id, target, dt, def.speed);
        m.anim = moved ? "walk" : "idle";
      } else m.anim = "idle";
      return;
    }
    m.ai = "idle";
    if (homeDistance > 2) {
      if (this.moveMob(m, id, home, dt, def.speed * 0.8)) m.anim = "walk";
    } else {
      if (this.time > m.wanderAt) {
        m.wanderAt = this.time + 2 + this.rng() * 3;
        m.wanderX = m.homeX + (this.rng() - 0.5) * 3;
        m.wanderY = m.homeY + (this.rng() - 0.5) * 3;
      }
      const next = { x: m.wanderX ?? m.x, y: m.wanderY ?? m.y };
      m.anim =
        distance(m, next) > 0.35 &&
        this.moveMob(m, id, next, dt, def.speed * 0.4)
          ? "walk"
          : "idle";
    }
  }
  step(dt) {
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.effects = this.effects.filter((e) => e.until > this.time);
    for (const p of this.players.values()) {
      this.explore(p);
      const s = stats(p),
        map = this.map(p.map);
      p.focus = Math.min(100, p.focus + dt * 4);
      if (map.config.town || this.time - p.lastHit > 8)
        p.hp = Math.min(s.maxHp, p.hp + dt * (map.config.town ? 12 : 1.8));
      if (p.regenUntil > this.time)
        p.hp = Math.min(s.maxHp, p.hp + dt * s.maxHp * 0.03);
      if (p.poisonUntil > this.time && this.time > p.poisonTick) {
        p.poisonTick = this.time + 1;
        this.hurtPlayer(p, Math.max(1, Math.round(s.maxHp * 0.015)), {
          avoidable: false,
        });
      }
      this.advanceAction(p);
      let dx = p.move.x,
        dy = p.move.y;
      if (p.moveTarget) {
        if (p.route?.length && distance(p, p.route[0]) < 0.001) p.route.shift();
        const point = p.route?.[0] || p.moveTarget,
          d = distance(p, point);
        if (d < 0.001) p.moveTarget = null;
        else {
          dx = (point.x - p.x) / d;
          dy = (point.y - p.y) / d;
        }
      }
      const inSlime = this.effects.some(
        (e) =>
          e.map === p.map &&
          e.kind === "slow" &&
          distance(p, e) < (e.radius || 1.2),
      );
      const tideSlow =
        inSlime ||
        (map.config.biome === "marsh" &&
          Math.sin(this.time / 12) > 0 &&
          !NAVIGATION[p.map].props.some(
            (o) => o.walkThrough && distance(p, o) < 3,
          ))
          ? 0.75
          : 1;
      const moveSpeed = p.moveTarget
        ? Math.min(
            s.speed * tideSlow,
            distance(p, p.route?.[0] || p.moveTarget) / Math.max(dt, 0.001),
          )
        : s.speed * tideSlow;
      const moving = this.moveEntity(p, p.map, dx, dy, dt, moveSpeed);
      if (
        !p.action &&
        (this.time - p.animAt > 0.5 ||
          !["attack", "hurt", "recover"].includes(p.anim))
      )
        p.anim = moving ? "walk" : "idle";
      if (p.queuedAttack) {
        const t = map.mobs.find((m) => m.uid === p.queuedAttack);
        if (!t || t.hp <= 0) {
          p.queuedAttack = null;
          p.moveTarget = null;
        } else if (distance(p, t) <= s.range && this.sight(p.map, p, t))
          this.attack(p, t.uid);
        else if (this.time >= (p.queuedPathAt || 0)) {
          p.route = findRoute(p.map, p, t);
          p.moveTarget = { x: t.x, y: t.y };
          p.queuedPathAt = this.time + 0.5;
          if (!p.route.length) {
            p.queuedAttack = null;
            p.moveTarget = null;
          }
        }
      }
    }
    for (const field of this.effects.filter(
      (e) => e.kind === "garden" && e.tickAt && e.tickAt <= this.time,
    )) {
      field.tickAt = this.time + 1;
      const owner = this.players.get(field.owner);
      if (!owner || owner.map !== field.map) continue;
      for (const ally of this.players.values())
        if (
          ally.map === field.map &&
          distance(ally, field) <= field.radius &&
          this.sight(field.map, field, ally)
        ) {
          const heal = stats(ally).maxHp * 0.045;
          ally.hp = Math.min(stats(ally).maxHp, ally.hp + heal);
          this.effect(field.map, "heal", ally.x, ally.y, {
            text: "+" + Math.round(heal),
            owner: ally.id,
            duration: 0.5,
          });
        }
      for (const mob of this.map(field.map).mobs)
        if (
          mob.hp > 0 &&
          mob.dotUntil > this.time &&
          distance(mob, field) <= field.radius &&
          this.sight(field.map, field, mob)
        )
          this.damage(owner, mob, field.power * 0.3, "poison");
    }
    for (const [id, map] of this.maps) {
      const players = [...this.players.values()].filter((p) => p.map === id);
      for (const d of map.drops) {
        if (!d.pickupEnds || d.collected) continue;
        const owner = this.players.get(d.owner);
        if (!owner || owner.map !== id) {
          d.pickupAt = 0;
          d.pickupEnds = 0;
          continue;
        }
        if (this.time < d.pickupEnds || d.until <= this.time) continue;
        d.collected = true;
        d.until = 0;
        if (d.kind === "currency")
          owner.gold = Math.min(1e8, owner.gold + d.count);
        else this.addItem(owner, d.item, d.count);
        const notice = {
          id: ++this.sequence,
          item: d.item,
          kind: d.kind || "item",
          count: d.count,
          at: this.time,
        };
        if (d.treasure) {
          const pending = owner.exploration.pending.find(
            (v) => v.chest === d.treasure,
          );
          if (pending)
            pending.rewards = pending.rewards.filter((i) => i !== d.reward);
          owner.exploration.pending = owner.exploration.pending.filter(
            (v) => v.rewards.length,
          );
        }
        owner.lootNotices.push(notice);
        owner.lootNotices = owner.lootNotices.slice(-8);
        this.log(
          owner,
          d.kind === "currency"
            ? `리프 +${d.count}`
            : `${ITEMS[d.item].name} ×${d.count} 획득`,
          "pickup",
        );
      }
      map.drops = map.drops.filter((d) => d.until > this.time);
      if (!players.length) continue;
      for (const m of map.mobs) {
        const def = MONSTERS.find((d) => d.id === m.def);
        if (m.hp <= 0) {
          if (this.time > m.respawn) {
            m.hp = def.hp;
            m.x = m.homeX;
            m.y = m.homeY;
            m.anim = "idle";
            m.windup = null;
            m.dotUntil = 0;
            m.rootUntil = 0;
            m.toxinStacks = 0;
            m.ai = "idle";
            m.phase = 1;
            m.pattern = 0;
            m.threat = null;
          }
          continue;
        }
        if (m.dotUntil > this.time && m.dotTick < this.time) {
          m.dotTick = this.time + 1;
          const owner = this.players.get(m.dotOwner);
          if (owner?.map === id) this.damage(owner, m, m.dotPower, "poison");
          if (m.hp <= 0) continue;
        }
        this.updateMob(m, id, players, dt);
        if (
          def.shape === "snail" &&
          m.anim === "walk" &&
          this.time > (m.trailAt || 0)
        ) {
          m.trailAt = this.time + 3;
          this.effect(id, "slow", m.x, m.y, { radius: 1.2, duration: 5 });
        }
        if (m.anim === "hurt" && this.time - m.animAt > 0.3) m.anim = "idle";
      }
    }
  }
  snapshot(id) {
    const p = this.players.get(id);
    if (!p) return null;
    const map = this.map(p.map);
    return {
      time: this.time,
      player: {
        ...serialize(p),
        id: p.id,
        stats: stats(p),
        anim: p.anim,
        animAt: p.animAt,
        animDuration: p.animDuration,
        dir: p.dir,
        shield: p.shieldUntil > this.time ? p.shield : 0,
        cooldowns: p.cooldowns.map((t) => Math.max(0, t - this.time)),
        potionCooldown: Math.max(0, p.potionReady - this.time),
        logs: p.logs,
        lootNotices: p.lootNotices,
        poisoned: p.poisonUntil > this.time,
        guardPower: p.guardPower,
        spellCharge: p.spellCharge,
        precise: p.precisionUntil > this.time,
        evading: p.evadeUntil > this.time,
      },
      peers: [...this.players.values()]
        .filter((a) => a.id !== id && a.map === p.map)
        .map((a) => ({
          id: a.id,
          name: a.name,
          x: a.x,
          y: a.y,
          classId: a.classId,
          branch: a.branch,
          level: a.level,
          hp: a.hp,
          maxHp: stats(a).maxHp,
          anim: a.anim,
          animAt: a.animAt,
          animDuration: a.animDuration,
          dir: a.dir,
        })),
      mobs: map.mobs.map(({ path, pathAt, pathGoal, ...m }) => ({ ...m })),
      herbs: map.herbs.map((h) => ({ ...h, ready: h.readyAt <= this.time })),
      drops: map.drops.filter((d) => d.owner === id),
      discoveries: DISCOVERIES.filter((d) => d.map === p.map).map((d) => ({
        ...d,
        discovered: p.exploration.discovered.includes(d.id),
        visible: !d.hidden || p.exploration.discovered.includes(d.id),
      })),
      chests: CHESTS.filter(
        (c) => c.map === p.map && p.exploration.discovered.includes(c.site),
      ).map((c) => ({
        ...c,
        opened: p.exploration.opened.includes(c.id),
        locked: !!c.boss && !p.defeatedBosses.includes(c.boss),
      })),
      effects: this.effects.filter((e) => e.map === p.map),
    };
  }
}
