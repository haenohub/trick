import { combatAim } from "./targeting.js";
import { worldPulse } from "./living-world.js";
import { speciesForMap, encounterPoint } from "./ecology.js";
import { applyConsumableStats } from "./consumables.js";
import { skillVisual } from "./skill-visuals.js";
import { extraSkill, skillUnlocked, SKILL_SLOTS } from "./skill-expansion.js";
import {
  derivedStats,
  normalizeAllocation,
  unspentPoints,
  ATTRIBUTE_NAMES,
  canEquip,
  monsterStats,
  hitChance,
} from "./progression.js";
import {
  attackTimeline,
  HIT_OFFSET,
  STRIKE_DURATION,
  RECOVERY_DURATION,
  MONSTER_HIT_DURATION,
  IMPACT_DURATION,
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
  PICKUP_INTERVAL,
  PLAYER_DAMAGE_SCALE,
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
  const result = applyConsumableStats(p, {
    ...derivedStats(
      p,
      gear.filter((i) => canEquip(p, i)),
    ),
    range: c.id === "warden" ? 1.9 : c.id === "ranger" ? 11.25 : 6,
    speed: (c.id === "ranger" ? 3.7 : 3.3) * TEST_BALANCE.speed,
  });
  if (p.featherBonus)
    result.evasion = Math.min(0.55, result.evasion + p.featherBonus);
  return result;
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
    allocationVersion: 1,
    allocated: {},
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
  p.branch =
    p.level >= 25 &&
    CLASSES.find((c) => c.id === p.classId).branches.some(
      (b) => b.id === raw.branch,
    )
      ? raw.branch
      : null;
  normalizeAllocation(p, raw);
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
  for (const [slot, id] of Object.entries(p.equipment))
    if (!canEquip(p, ITEMS[id])) {
      const replacement = createPlayer(p.classId).equipment[slot];
      p.equipment[slot] = replacement;
      p.inventory[replacement] = Math.max(1, p.inventory[replacement] || 0);
    }
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
    Number(raw.layoutVersion) === LAYOUT_VERSION &&
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
    "allocationVersion",
    "allocated",
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
      combatTarget: null,
      queuedSkill: null,
      trackingTarget: null,
      trackingUntil: 0,
      mobileAction: null,
      autoCombatArmed: false,
      autoAttackSuppressed: false,
      cooldowns: SKILL_SLOTS.map(() => 0),
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
      buffs: [],
      guardPower: 0,
      spellCharge: 0,
      precisionUntil: 0,
      evadeUntil: 0,
      counterGuardUntil: 0,
      counterCharges: 0,
      counterReady: 0,
      featherUntil: 0,
      featherBonus: 0,
      quickRegenUntil: 0,
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
    for (const [
      speciesIndex,
      { habitat, def, guest },
    ] of definitions.entries()) {
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
        if (def.type !== "boss") {
          // Best-candidate placement spreads all species together instead of
          // keeping little same-species packs at habitat centers.
          let best = { x, y },
            score = -1;
          for (let attempt = 0; attempt < 64; attempt++) {
            const point = encounterPoint(id, habitat, j + attempt, rng),
              separation = Math.min(20, ...mobs.map((m) => distance(m, point)));
            if (safe.some((a) => distance(a, point) < 5)) continue;
            if (separation > score) {
              best = point;
              score = separation;
            }
            if (score >= 8) break;
          }
          ({ x, y } = best);
        }
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
          hitUntil: 0,
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
        this.stopCombat(p, p.autoAttackSuppressed, Math.hypot(x, y) > 0);
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
        const route = findRoute(p.map, p, { x, y });
        if (!route.length) return false;
        this.stopCombat(p, p.autoAttackSuppressed, true);
        p.route = route;
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
        if (this.time + 1e-9 < (p.nearbyPickupReady || 0)) return false;
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
        if (!drop || !this.pickup(p, drop.id)) return false;
        p.nearbyPickupReady = this.time + PICKUP_INTERVAL;
        return true;
      }
      case "attack":
        return this.requestAttack(p, action.target);
      case "skill":
        return this.requestSkill(
          p,
          Number(action.slot),
          action.target,
          action.point,
        );
      case "cancelCombat":
        this.stopCombat(p);
        return true;
      case "potion":
        return this.potion(p, action.item || "salve");
      case "interact": {
        if (action.herb) {
          const h = map.herbs.find((h) => h.id === action.herb);
          if (!h || distance(p, h) > 2 || h.readyAt > this.time) return false;
          const n =
            (action.harvest === "whole" ? 3 : 1) +
            (worldPulse(map.config, this.time).active && map.config.region === 0
              ? 1
              : 0);
          h.readyAt = this.time + (action.harvest === "whole" ? 38 : 12);
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
      case "allocateStat": {
        const { attribute, amount } = action;
        if (
          !Object.hasOwn(ATTRIBUTE_NAMES, attribute) ||
          !Number.isSafeInteger(amount) ||
          amount < 1 ||
          amount > unspentPoints(p)
        )
          return false;
        p.allocated[attribute] = (p.allocated[attribute] || 0) + amount;
        this.log(p, `${ATTRIBUTE_NAMES[attribute]} +${amount}`);
        return true;
      }
      case "equip": {
        const i = ITEMS[action.item];
        if (!i?.slot || !p.inventory[i.id] || !canEquip(p, i)) return false;
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
          i.craftOnly ||
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
          p.level < 25 ||
          p.branch === action.branch ||
          !c.branches.some((b) => b.id === action.branch)
        )
          return false;
        const oldBranch = p.branch;
        this.stopCombat(p, false);
        p.branch = action.branch;
        for (const [slot, id] of Object.entries(p.equipment))
          if (id && !canEquip(p, ITEMS[id])) {
            p.equipment[slot] = null;
            if (slot === "weapon") {
              const replacement = Object.values(ITEMS)
                .filter(
                  (i) =>
                    i.slot === "weapon" && p.inventory[i.id] && canEquip(p, i),
                )
                .sort((a, b) => b.level - a.level)[0];
              p.equipment[slot] = replacement?.id || null;
            }
          }
        if (oldBranch) {
          p.shield = 0;
          p.shieldUntil = 0;
          p.regenUntil = 0;
          this.effects = this.effects.filter(
            (e) =>
              e.owner !== p.id || !(e.kind === "garden" || e.key === oldBranch),
          );
        }
        this.pendingAreas = (this.pendingAreas || []).filter(
          (a) => a.owner !== p.id,
        );
        p.hp = Math.min(p.hp, stats(p).maxHp);
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
    m.dotPower = stats(p).power * (0.18 + m.toxinStacks * 0.12);
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
    const t = this.map(p.map).mobs.find((m) => m.uid === uid && m.hp > 0);
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
    return this.beginAction(p, "basic", t);
  }
  stopCombat(p, suppress = true, keepTracking = false) {
    this.cancelAction(p);
    p.combatTarget = null;
    p.queuedAttack = null;
    p.queuedSkill = null;
    p.autoCombatArmed = false;
    // Explicit cancellation remains effective even when an enemy hits again.
    p.autoAttackSuppressed = suppress;
    if (!keepTracking) {
      p.trackingTarget = null;
      p.trackingUntil = 0;
      p.mobileAction = null;
    }
    p.moveTarget = null;
    p.move = { x: 0, y: 0 };
    p.route = [];
  }
  skillAvailable(p, slot) {
    return (
      skillUnlocked(p, slot) &&
      p.cooldowns[slot] <= this.time &&
      p.focus >= SKILL_COSTS[slot]
    );
  }
  requestAttack(p, uid) {
    const t = this.map(p.map).mobs.find(
      (m) => m.uid === uid && m.hp > 0 && m.ai !== "return",
    );
    if (!t) return false;
    if (p.trackingTarget && p.trackingTarget !== uid) {
      p.trackingTarget = null;
      p.trackingUntil = 0;
      p.mobileAction = null;
    }
    if (
      (distance(p, t) > stats(p).range || !this.sight(p.map, p, t)) &&
      !findRoute(p.map, p, t).length
    )
      return false;
    if (p.action && p.action.target !== uid && !p.action.released)
      this.cancelAction(p);
    p.combatTarget = uid;
    p.autoCombatArmed = true;
    p.autoAttackSuppressed = false;
    p.queuedSkill = null;
    this.advanceCombat(p);
    return true;
  }
  requestSkill(p, slot, uid, point = null) {
    if (!this.skillAvailable(p, slot)) return false;
    const rule = combatAim({ ...p, stats: stats(p) }, slot);
    const enemy = this.map(p.map).mobs.find(
      (m) => m.uid === uid && m.hp > 0 && m.ai !== "return",
    );
    let goal = null;
    if (rule.mode === "ground") {
      goal = point || enemy;
      if (
        !goal ||
        !Number.isFinite(goal.x) ||
        !Number.isFinite(goal.y) ||
        blocked(p.map, goal.x, goal.y)
      )
        return false;
      goal = { x: goal.x, y: goal.y };
    } else if (rule.mode === "enemy") {
      if (!enemy || point) return false;
      goal = enemy;
    } else if (point) return false;
    if (
      goal &&
      (distance(p, goal) > rule.range || !this.sight(p.map, p, goal)) &&
      !findRoute(p.map, p, goal).length
    )
      return false;
    p.queuedSkill = {
      slot,
      target: rule.mode === "enemy" ? uid : null,
      point: rule.mode === "ground" ? goal : null,
      map: p.map,
      until: this.time + 45,
    };
    p.autoAttackSuppressed = false;
    p.autoCombatArmed = true;
    if (rule.mode === "enemy") p.combatTarget = uid;
    p.queuedAttack = null;
    p.route = [];
    p.moveTarget = null;
    p.move = { x: 0, y: 0 };
    this.advanceCombat(p);
    return true;
  }
  approachCombat(p, goal) {
    if (!p.moveTarget || this.time >= (p.combatPathAt || 0)) {
      p.route = findRoute(p.map, p, goal);
      p.moveTarget = p.route.length ? { x: goal.x, y: goal.y } : null;
      p.combatPathAt = this.time + 0.4;
    }
    return !!p.moveTarget;
  }
  advanceCombat(p) {
    if (
      p.hp <= 0 ||
      p.action ||
      (p.anim === "hurt" && this.time < p.animAt + 0.1) ||
      (p.anim === "recover" && this.time < p.animAt + p.animDuration)
    )
      return;
    const q = p.queuedSkill;
    if (q) {
      const rule = combatAim({ ...p, stats: stats(p) }, q.slot);
      const t =
        q.point ||
        this.map(p.map).mobs.find(
          (m) => m.uid === q.target && m.hp > 0 && m.ai !== "return",
        );
      if (
        q.map !== p.map ||
        q.until < this.time ||
        !this.skillAvailable(p, q.slot) ||
        (rule.mode !== "self" && !t)
      ) {
        p.queuedSkill = null;
        p.moveTarget = null;
        p.route = [];
      } else if (
        t &&
        (distance(p, t) > rule.range || !this.sight(p.map, p, t))
      ) {
        if (!this.approachCombat(p, t)) p.queuedSkill = null;
        return;
      } else {
        p.queuedSkill = null;
        p.moveTarget = null;
        p.route = [];
        if (this.skill(p, q.slot, q.target, q.point)) return;
      }
    }
    if (!p.combatTarget) return;
    const t = this.map(p.map).mobs.find(
      (m) => m.uid === p.combatTarget && m.hp > 0 && m.ai !== "return",
    );
    if (!t) {
      p.combatTarget = null;
      p.queuedAttack = null;
      p.autoCombatArmed = false;
      p.moveTarget = null;
      p.route = [];
      return;
    }
    if (distance(p, t) > stats(p).range || !this.sight(p.map, p, t)) {
      if (!this.approachCombat(p, t)) {
        p.combatTarget = null;
        p.queuedAttack = null;
        p.autoCombatArmed = false;
      }
    } else {
      p.moveTarget = null;
      p.route = [];
      p.queuedAttack = null;
      if (this.time >= p.attackReady) this.attack(p, t.uid);
    }
  }
  advanceTracking(p) {
    if (p.classId !== "ranger" || !p.trackingTarget) return;
    const t = this.map(p.map).mobs.find(
      (m) => m.uid === p.trackingTarget && m.hp > 0 && m.ai !== "return",
    );
    if (
      p.hp <= 0 ||
      p.trackingUntil <= this.time ||
      !t ||
      t.markedOwner !== p.id ||
      t.markedUntil <= this.time
    ) {
      p.trackingTarget = null;
      p.trackingUntil = 0;
      p.mobileAction = null;
      return;
    }
    const a = p.mobileAction,
      s = stats(p),
      inRange = distance(p, t) <= s.range && this.sight(p.map, p, t);
    if (a) {
      if (!a.released && this.time + 1e-9 >= a.hitAt) {
        a.released = true;
        if (inRange) this.releaseBasic(p, t, { mobile: true });
      }
      if (this.time >= a.endAt) p.mobileAction = null;
      return;
    }
    if (p.action || this.time < p.attackReady || !inRange || p.queuedSkill)
      return;
    const moving = !!p.moveTarget || Math.hypot(p.move.x, p.move.y) > 0.01;
    if (!moving) {
      p.combatTarget = t.uid;
      p.autoCombatArmed = true;
      p.autoAttackSuppressed = false;
      this.beginAction(p, "basic", t);
    } else {
      // An independent upper-body release clock keeps the clicked route and
      // walk heading intact. It never steers toward an out-of-range target.
      p.mobileAction = {
        ...attackTimeline(this.time, "ranger"),
        target: t.uid,
        map: p.map,
        released: false,
      };
      p.attackReady = p.mobileAction.endAt + 2 / 30;
    }
  }
  cancelAction(p) {
    if (p.action?.extraVisual && !p.action.released)
      this.effects = this.effects.filter((e) => e.castId !== p.action.castId);
    p.action = null;
    if (["windup", "attack", "recover"].includes(p.anim)) p.anim = "idle";
  }
  beginAction(p, kind, target, slot = null, selfCast = false) {
    p.mobileAction = null;
    p.action = {
      ...attackTimeline(this.time, p.classId),
      kind,
      slot,
      target: target?.uid || null,
      selfCast,
      aim: target && !target.uid ? { x: target.x, y: target.y } : null,
      map: p.map,
      released: false,
    };
    if (kind === "skill" && p.classId === "warden" && slot === 2 && target) {
      const landAt = p.action.hitAt + 0.36;
      p.action.leap = {
        from: { x: p.x, y: p.y },
        to: { x: target.x, y: target.y },
        start: p.action.strikeAt,
        landAt,
      };
      p.action.hitAt = landAt;
      p.action.strikeEnd = landAt + 2 / 30;
      p.action.endAt = p.action.strikeEnd + RECOVERY_DURATION;
    }
    if (kind === "skill" && extraSkill(p.classId, slot)?.mobility && target) {
      p.action.strikeAt = this.time + 0.1;
      const landAt = p.action.strikeAt + 0.16;
      p.action.leap = {
        from: { x: p.x, y: p.y },
        to: { x: target.x, y: target.y },
        start: p.action.strikeAt,
        landAt,
        height: p.classId === "ranger" ? 24 : p.classId === "mage" ? 0 : 6,
      };
      p.action.hitAt = landAt;
      p.action.strikeEnd = landAt + 2 / 30;
      p.action.endAt = p.action.strikeEnd + 0.1;
    }
    p.anim = "windup";
    p.animAt = this.time;
    p.animDuration = p.action.strikeAt - this.time;
    p.attackReady = Math.max(p.attackReady, p.action.endAt + 2 / 30);
    p.moveTarget = null;
    p.move = { x: 0, y: 0 };
    p.route = [];
    p.queuedAttack = null;
    if (target) p.dir = direction(target.x - p.x, target.y - p.y);
    const extra = kind === "skill" && extraSkill(p.classId, slot);
    if (extra && (slot === 4 || extra.mode === "self")) {
      let center = target || p;
      if (extra.shape === "line" && target) {
        const dx = target.x - p.x,
          dy = target.y - p.y,
          n = Math.hypot(dx, dy) || 1;
        center = {
          x: p.x + (dx / n) * extra.length,
          y: p.y + (dy / n) * extra.length,
        };
      }
      p.action.extraVisual = true;
      p.action.castId = ++this.sequence;
      this.extraEffect(p, slot, center, null, {
        castId: p.action.castId,
        ...(extra.shape === "line" ? { tx: center.x, ty: center.y } : {}),
      });
    }
    return true;
  }
  advanceAction(p) {
    const a = p.action;
    if (!a) return;
    if (a.map !== p.map || p.hp <= 0) {
      this.cancelAction(p);
      return;
    }
    if (a.leap && this.time >= a.leap.start) {
      if (!a.leap.departed && a.slot >= 4) {
        a.leap.departed = true;
        this.extraEffect(p, a.slot, a.leap.from, 0.4);
      }
      const t = clamp(
        (this.time - a.leap.start) / (a.leap.landAt - a.leap.start),
        0,
        1,
      );
      const next = {
        x: a.leap.from.x + (a.leap.to.x - a.leap.from.x) * t,
        y: a.leap.from.y + (a.leap.to.y - a.leap.from.y) * t,
      };
      if (blocked(p.map, next.x, next.y) || !this.sight(p.map, p, next)) {
        this.cancelAction(p);
        return;
      }
      p.x = next.x;
      p.y = next.y;
    }
    if (!a.released && this.time + 1e-9 >= a.hitAt) {
      a.released = true;
      const target =
        a.aim ||
        this.map(p.map).mobs.find((m) => m.uid === a.target && m.hp > 0);
      const range = a.aim
        ? combatAim({ ...p, stats: stats(p) }, a.slot).range
        : stats(p).range +
          (a.kind === "basic" ? 0.6 : p.classId === "ranger" ? 3 : 2);
      const valid =
        target &&
        this.sight(p.map, p, target) &&
        distance(p, target) <=
          (a.slot === 3 && p.branch === "hawk" ? 16.5 : range);
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
      p.animDuration = a.strikeEnd - a.strikeAt;
    } else {
      p.anim = "recover";
      p.animAt = a.strikeEnd;
      p.animDuration = a.endAt - a.strikeEnd;
    }
  }
  releaseBasic(p, t, { mobile = false } = {}) {
    const s = stats(p);
    if (["ranger", "mage", "herbalist"].includes(p.classId)) {
      const travel = { ranger: 0.26, mage: 0.48, herbalist: 0.22 }[p.classId];
      this.pendingHits ||= [];
      this.effect(
        p.map,
        { ranger: "arrow-shot", mage: "starfall", herbalist: "herb-shot" }[
          p.classId
        ],
        p.x,
        p.y,
        {
          tx: t.x,
          ty: t.y,
          target: t.uid,
          owner: p.id,
          dir: mobile ? direction(t.x - p.x, t.y - p.y) : p.dir,
          mobile,
          bodyDir: p.dir,
          hitAt: this.time + travel,
          duration: travel + 0.2,
        },
      );
      this.pendingHits.push({
        owner: p.id,
        target: t.uid,
        map: p.map,
        at: this.time + travel,
        power: s.power,
        effect: this.sequence,
      });
    } else {
      this.damage(p, t, s.power, "hit");
      if (s.range > 2)
        this.effect(p.map, "projectile", p.x, p.y, {
          tx: t.x,
          ty: t.y,
          color: CLASSES.find((c) => c.id === p.classId).color,
          duration: 0.32,
        });
    }
    this.effect(p.map, "action", p.x, p.y, {
      cue: p.classId,
      owner: p.id,
      duration: 0.2,
    });
  }
  advanceProjectiles() {
    for (const shot of this.pendingHits || []) {
      const p = this.players.get(shot.owner),
        m = this.map(shot.map).mobs.find((m) => m.uid === shot.target),
        e = this.effects.find((e) => e.id === shot.effect);
      if (m && e) {
        e.tx = m.x;
        e.ty = m.y;
      }
      if (shot.done || this.time + 1e-9 < shot.at) continue;
      shot.done = true;
      if (!p || p.map !== shot.map || p.hp <= 0 || !m || m.hp <= 0) continue;
      const landed = this.damage(p, m, shot.power, "hit");
      if (e) e.landed = landed;
      if (landed && p.classId === "mage")
        p.spellCharge = Math.min(3, p.spellCharge + 1);
      if (landed && p.classId === "herbalist") this.toxin(p, m, 1, 4);
    }
    this.pendingHits = (this.pendingHits || []).filter((s) => !s.done);
  }
  damage(p, m, value, kind = "hit") {
    if (m.hp <= 0 || m.ai === "return") return;
    const def = MONSTERS.find((d) => d.id === m.def),
      s = stats(p),
      enemy = monsterStats(def),
      dot = kind === "poison";
    const roll = dot ? 0 : this.rng(),
      chance = hitChance(s, enemy);
    if (!dot && roll >= chance) {
      m.threat = p.id;
      m.threatUntil = this.time + 4;
      this.effect(p.map, "miss", m.x, m.y, {
        text: "빗나감",
        owner: p.id,
        duration: 0.5,
        color: "#b9c9bd",
      });
      return false;
    }
    const crit = !dot && roll / chance < s.critChance;
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
        (value * (precision ? 1.55 : 1) -
          (s.damageType === "magic" ? enemy.magicDefense : def.defense) * 0.4) *
          (m.markedUntil > this.time ? 1.3 : 1) *
          (crit ? s.critDamage : 1) *
          (armored ? 0.65 : 1) *
          PLAYER_DAMAGE_SCALE,
      ),
    );
    m.hp = Math.max(0, m.hp - n);
    m.threat = p.id;
    m.threatUntil = this.time + 4;
    if (
      p.autoCombatArmed &&
      !p.autoAttackSuppressed &&
      !this.map(p.map).mobs.some((t) => t.uid === p.combatTarget && t.hp > 0)
    )
      p.combatTarget = m.uid;
    if (!dot) {
      const until = this.time + MONSTER_HIT_DURATION,
        pause = Math.max(0, until - Math.max(this.time, m.hitUntil || 0));
      m.hitUntil = until;
      m.hitAt = this.time;
      m.hitDx = m.x - p.x;
      m.hitDy = m.y - p.y;
      m.anim = "hurt";
      m.animAt = this.time;
      m.animDuration = MONSTER_HIT_DURATION;
      // Pause an existing attack rather than release it invisibly during hurt.
      // Simultaneous hits share one pause; rapid hits only add the extension.
      if (m.windup)
        for (const key of ["start", "strikeAt", "at"])
          if (Number.isFinite(m.windup[key])) m.windup[key] += pause;
      for (const key of ["attackEnd", "recoverUntil", "nextAttack"])
        if (m[key] > this.time) m[key] += pause;
    }
    if (!p.discovered.includes(def.id)) p.discovered.push(def.id);
    this.effect(p.map, kind, m.x, m.y, {
      text: String(n),
      crit,
      owner: p.id,
      impact: dot ? 0 : crit ? 2 : 1,
      cue: kind === "poison" ? null : crit ? "critical" : "hit",
      color: crit ? "#ffe7a1" : "#fff1ce",
      duration: 0.85,
    });
    if (!dot)
      this.effect(p.map, "attack-impact", m.x, m.y, {
        classId: p.classId,
        owner: p.id,
        dir: p.dir,
        duration: IMPACT_DURATION,
        crit,
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
        {
          kind: "currency",
          count: Math.round(
            gold *
              (worldPulse(
                MAPS.find((a) => a.id === p.map),
                this.time,
              ).active && MAPS.find((a) => a.id === p.map).region === 1
                ? 1.25
                : 1),
          ),
        },
      ]);
      this.log(
        p,
        `${def.name} · +${xpReward(def.xp)} 경험치 · 전리품이 떨어졌습니다.`,
        "combat",
      );
    }
    return true;
  }
  skill(p, slot, uid, point = null) {
    if (p.action || !this.skillAvailable(p, slot)) return false;
    const s = stats(p),
      rule = combatAim({ ...p, stats: s }, slot);
    let t = uid
      ? this.map(p.map).mobs.find((m) => m.uid === uid && m.hp > 0)
      : null;
    if (point) {
      if (
        rule.mode !== "ground" ||
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        distance(p, point) > rule.range ||
        blocked(p.map, point.x, point.y) ||
        !this.sight(p.map, p, point)
      )
        return false;
      t = { x: point.x, y: point.y };
    }
    const selfCast =
      rule.mode === "self" ||
      (p.classId === "herbalist" && [0, 2].includes(slot)) ||
      (slot === 1 && p.classId === "warden") ||
      (slot === 3 && ["antler", "flower", "mist"].includes(p.branch));
    if (t && !selfCast && !this.sight(p.map, p, t)) return false;
    if (
      !t &&
      !selfCast &&
      !(p.classId === "herbalist" && (slot === 0 || slot === 2)) &&
      !(slot === 1 && p.classId === "warden") &&
      !(slot === 3 && ["antler", "flower", "mist"].includes(p.branch))
    )
      return false;
    if (
      t &&
      !selfCast &&
      !point &&
      distance(t, p) > rule.range &&
      !(slot === 3 && p.branch === "hawk")
    )
      return false;
    p.focus -= SKILL_COSTS[slot];
    p.cooldowns[slot] = this.time + SKILL_COOLDOWNS[slot];
    return this.beginAction(p, "skill", t, slot, selfCast);
  }
  extraEffect(p, slot, point = p, duration = null, extra = {}) {
    const v = skillVisual(p, slot);
    if (!v) return;
    this.effect(p.map, "skill-vfx", point.x, point.y, {
      key: v.key,
      radius: extraSkill(p.classId, slot)?.radius || 0,
      owner: p.id,
      fromX: p.x,
      fromY: p.y,
      dir: p.dir,
      duration: duration || v.duration,
      cue: p.classId,
      ...extra,
    });
  }
  releaseExtraSkill(p, slot, target) {
    const def = extraSkill(p.classId, slot),
      s = stats(p),
      center = target || p;
    if (slot === 5) {
      if (p.classId === "warden") {
        p.counterGuardUntil = this.time + 3;
        p.counterCharges = 2;
        p.counterReady = this.time;
      } else if (p.classId === "mage") {
        if (p.shieldUntil <= this.time || p.shield <= s.maxHp * 0.12) {
          p.shield = s.maxHp * 0.12;
          p.shieldUntil = this.time + 3;
        }
      } else if (p.classId === "ranger") {
        p.featherUntil = this.time + 2;
        p.featherBonus = 0.1;
      } else {
        p.poisonUntil = 0;
        p.quickRegenUntil = this.time + 3;
      }
      if (!p.action?.extraVisual) this.extraEffect(p, slot, p);
      return true;
    }
    let end = center;
    if (def.shape === "line") {
      const dx = center.x - p.x,
        dy = center.y - p.y,
        n = Math.hypot(dx, dy) || 1;
      end = { x: p.x + (dx / n) * def.length, y: p.y + (dy / n) * def.length };
    }
    const foes = this.map(p.map)
      .mobs.filter(
        (m) =>
          m.hp > 0 &&
          m.ai !== "return" &&
          (def.shape === "line"
            ? segmentDistance(m, p, end) <= def.radius
            : distance(m, center) <= def.radius) &&
          this.sight(p.map, def.shape === "line" ? p : center, m),
      )
      .sort(
        (a, b) =>
          distance(a, def.shape === "line" ? p : center) -
          distance(b, def.shape === "line" ? p : center),
      )
      .slice(0, 5);
    for (const m of foes) {
      const stacks =
        p.classId === "herbalist" &&
        m.dotOwner === p.id &&
        m.dotUntil > this.time
          ? m.toxinStacks || 0
          : 0;
      const landed = this.damage(
        p,
        m,
        s.power * (def.power + stacks * (def.toxinPower || 0)),
        "burst",
      );
      if (!landed) continue;
      const boss = MONSTERS.find((d) => d.id === m.def).type === "boss";
      if (def.pull && !boss && m.hp > 0) {
        const d = distance(m, center);
        if (d > 0.01)
          this.moveEntity(
            m,
            p.map,
            (center.x - m.x) / d,
            (center.y - m.y) / d,
            1,
            Math.min(d, def.pull),
          );
      }
      if (def.root)
        m.rootUntil = Math.max(
          m.rootUntil,
          this.time + (boss ? Math.min(0.4, def.root) : def.root),
        );
      if (stacks) {
        m.toxinStacks = 0;
        m.dotUntil = 0;
        m.dotPower = 0;
      }
    }
    if (def.waves) {
      this.pendingAreas ||= [];
      this.pendingAreas.push({
        owner: p.id,
        map: p.map,
        x: center.x,
        y: center.y,
        radius: def.radius,
        power: s.power * def.power,
        waves: def.waves.slice(1).map((delay) => this.time + delay),
        limit: 5,
      });
    }
    if (!p.action?.extraVisual)
      this.extraEffect(
        p,
        slot,
        end,
        null,
        def.shape === "line" ? { tx: end.x, ty: end.y } : {},
      );
    return true;
  }
  releaseSkill(p, slot, t) {
    if (extraSkill(p.classId, slot)) return this.releaseExtraSkill(p, slot, t);
    const s = stats(p);
    const visual = skillVisual(p, slot);
    if (
      visual &&
      !(p.classId === "ranger" && slot === 1) &&
      !(p.classId === "warden" && slot === 2)
    )
      this.effect(p.map, "skill-vfx", (t || p).x, (t || p).y, {
        key: visual.key,
        radius: combatAim({ ...p, stats: s }, slot).radius,
        owner: p.id,
        fromX: p.x,
        fromY: p.y,
        dir: p.dir,
        duration: visual.duration,
      });
    const aoe = (center, r, mult, root = 0) => {
      for (const m of this.map(p.map).mobs)
        if (
          m.hp > 0 &&
          distance(m, center) <= r &&
          this.sight(p.map, center, m)
        ) {
          const landed = this.damage(p, m, s.power * mult, "burst");
          if (landed && root)
            m.rootUntil =
              this.time +
              (MONSTERS.find((d) => d.id === m.def).type === "boss"
                ? Math.min(1, root)
                : root);
        }
    };
    const heal = (amount) => {
      for (const ally of this.players.values())
        if (ally.map === p.map && distance(ally, t || p) < 4) {
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
            this.damage(p, mob, s.power * power);
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
        aoe(t || p, 3, 1.9);
        for (const mob of this.map(p.map).mobs)
          if (
            mob.hp > 0 &&
            distance(mob, t || p) < 3 &&
            this.sight(p.map, p, mob) &&
            MONSTERS.find((d) => d.id === mob.def).type !== "boss"
          ) {
            mob.windup = null;
            mob.nextAttack = this.time + 1.2;
            mob.rootUntil = this.time + 0.6;
          }
        this.effect(p.map, "leaf-landing", (t || p).x, (t || p).y, {
          radius: 3,
          duration: 0.55,
          owner: p.id,
          cue: "slam",
          impact: 2,
        });
      }
    }
    if (p.classId === "mage") {
      if (slot === 0 && t) {
        if (this.damage(p, t, s.power * 2.2, "burst"))
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
      if (slot === 0 && t) this.damage(p, t, s.power * 2.2);
      if (slot === 1) {
        if (!t) return;
        this.pendingAreas ||= [];
        const area = {
          owner: p.id,
          map: p.map,
          x: t.x,
          y: t.y,
          radius: 3.4,
          power: s.power * 0.8,
          waves: [0.55, 0.72, 0.89].map((delay) => this.time + delay),
        };
        this.pendingAreas.push(area);
        this.effect(p.map, "arrow-rain", p.x, p.y, {
          tx: t.x,
          ty: t.y,
          radius: 3.4,
          owner: p.id,
          dir: p.dir,
          duration: 1.2,
          cue: "ranger",
        });
      }
      if (slot === 2 && t) {
        if (this.damage(p, t, s.power * 1.2)) {
          t.markedUntil = this.time + 9;
          t.markedOwner = p.id;
          p.trackingTarget = t.uid;
          p.trackingUntil = t.markedUntil;
          this.effect(p.map, "mark", t.x, t.y, { duration: 1 });
        }
      }
    }
    if (p.classId === "herbalist") {
      if (slot === 0) heal(s.maxHp * 0.32);
      if (slot === 1 && t) {
        if (this.damage(p, t, s.power * 1.4)) this.toxin(p, t, 2, 8);
        this.effect(p.map, "poison", t.x, t.y);
      }
      if (slot === 2) {
        heal(s.maxHp * 0.12);
        aoe(t || p, 3, 1.2);
        this.effect(p.map, "garden", (t || p).x, (t || p).y, {
          radius: 3,
          duration: 7,
          owner: p.id,
          tickAt: this.time + 1,
          power: s.power,
        });
      }
    }
    if (slot === 3) {
      if (p.branch === "antler") {
        for (const ally of this.players.values())
          if (ally.map === p.map && distance(ally, t || p) < 5) {
            ally.shield = stats(ally).maxHp * 0.45;
            ally.shieldUntil = this.time + 9;
          }
        aoe(t || p, 3, 2);
        this.effect(p.map, "shield", (t || p).x, (t || p).y, {
          radius: 4,
          duration: 1.3,
        });
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
        this.damage(p, t, s.power * 4.4);
      }
      if (p.branch === "moon" && t) {
        this.damage(p, t, s.power * (5.5 + p.spellCharge * 0.5), "burst");
        p.spellCharge = 0;
        this.effect(p.map, "beam", p.x, p.y, { tx: t.x, ty: t.y, duration: 1 });
      }
      if (p.branch === "bloom" && t) {
        aoe(t, 4, 3.6, 3);
        this.effect(p.map, "garden", t.x, t.y, { radius: 4, duration: 1.6 });
      }
      if (p.branch === "hawk" && t) {
        this.damage(p, t, s.power * 5.8);
        this.effect(p.map, "beam", p.x, p.y, {
          tx: t.x,
          ty: t.y,
          duration: 0.5,
        });
      }
      if (p.branch === "mist") {
        aoe(t || p, 5, 2.8);
        p.shield = s.maxHp * 0.22;
        p.shieldUntil = this.time + 5;
        this.effect(p.map, "dash", (t || p).x, (t || p).y, { radius: 4 });
      }
      if (p.branch === "flower") {
        heal(s.maxHp * 0.6);
        p.regenUntil = this.time + 10;
        p.poisonUntil = 0;
        this.effect(p.map, "garden", (t || p).x, (t || p).y, {
          radius: 4,
          duration: 2,
        });
      }
      if (p.branch === "venom" && t) {
        aoe(t, 3.5, 3.5);
        for (const m of this.map(p.map).mobs)
          if (m.hp > 0 && distance(m, t) < 4 && this.sight(p.map, t, m)) {
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
    p.buffs = (p.buffs || []).filter(
      (b) => b.until > this.time && b.item !== id,
    );
    if (i.duration)
      p.buffs.push({
        item: id,
        until: this.time + i.duration,
        buff: i.buff,
        flatBuff: i.flatBuff,
        speedBonus: i.speedBonus,
        regen: i.regen,
      });
    if (i.heal) p.hp = Math.min(stats(p).maxHp, p.hp + stats(p).maxHp * i.heal);
    if (i.focus) p.focus = Math.min(100, p.focus + i.focus);
    if (i.cleanse) p.poisonUntil = 0;
    this.log(p, `${i.name} 사용`, "heal");
    this.effect(p.map, "heal", p.x, p.y, {
      text: i.duration ? i.name : "회복",
      color: "#b8efaf",
    });
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
    if (!fast && next.region === 1 && !p.defeatedBosses.includes("m20")) {
      this.log(p, "그루터기 할아범을 진정시키면 해안으로 가는 길이 열립니다.");
      return false;
    }
    if (!fast) {
      const portal = PORTALS(p.map).find((a) => a.to === dest);
      if (!portal || distance(p, portal) > 2.5) return false;
    }
    const prev = MAPS.findIndex((m) => m.id === p.map),
      ni = MAPS.findIndex((m) => m.id === dest);
    this.stopCombat(p, false);
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
  hurtPlayer(p, n, { avoidable = true, accuracy = 80, source = null } = {}) {
    const s = stats(p),
      evade = Math.max(
        0.01,
        Math.min(0.55, s.evasion + (s.accuracy - accuracy) * 0.001),
      );
    if (avoidable && (p.evadeUntil > this.time || this.rng() < evade)) {
      this.effect(p.map, "evade", p.x, p.y, {
        text: "회피",
        owner: p.id,
        cue: "dodge",
        duration: 0.5,
      });
      return false;
    }
    if (p.shieldUntil <= this.time) p.shield = 0;
    if (avoidable && source && p.counterGuardUntil > this.time)
      n = Math.max(1, Math.round(n * 0.75));
    const absorbed = Math.min(n, p.shield);
    p.shield -= absorbed;
    if (absorbed > 0 && p.classId === "warden")
      p.guardPower = Math.min(3, p.guardPower + 1);
    n -= absorbed;
    p.hp = Math.max(0, p.hp - n);
    p.lastHit = this.time;
    if (
      source?.hp > 0 &&
      !p.autoAttackSuppressed &&
      !p.combatTarget &&
      !p.moveTarget &&
      !p.move.x &&
      !p.move.y &&
      this.map(p.map).mobs.includes(source)
    ) {
      p.combatTarget = source.uid;
      p.autoCombatArmed = true;
    }
    if (!p.action) {
      p.anim = "hurt";
      p.animAt = this.time;
      p.animDuration = MONSTER_HIT_DURATION;
    }
    this.effect(p.map, "hurt", p.x, p.y, {
      text: n > 0 ? "-" + n : "방어",
      color: "#f6b4a4",
      owner: p.id,
      cue: absorbed > 0 ? "guard" : "hurt",
      impact: n > 0 ? 2 : 0,
    });
    if (
      p.hp > 0 &&
      avoidable &&
      source?.hp > 0 &&
      p.counterGuardUntil > this.time &&
      p.counterCharges > 0 &&
      p.counterReady <= this.time &&
      distance(p, source) <= 3 &&
      this.sight(p.map, p, source) &&
      this.map(p.map).mobs.includes(source)
    ) {
      p.counterCharges--;
      p.counterReady = this.time + 0.45;
      this.damage(p, source, stats(p).power * 1.1, "burst");
      this.extraEffect(p, 5, p, 0.45);
    }
    if (p.hp <= 0) {
      this.stopCombat(p);
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
    return true;
  }
  moveMob(m, map, target, dt, speed) {
    if (m.rootUntil > this.time || m.hitUntil > this.time + 1e-9) return false;
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
    if (m.hitUntil > this.time + 1e-9) {
      m.anim = "hurt";
      m.animAt = m.hitAt;
      m.animDuration = MONSTER_HIT_DURATION;
      return;
    }
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
          const landed = this.hurtPlayer(
            p,
            Math.max(
              2,
              Math.round(
                (def.attack -
                  (["jelly", "anemone", "dragon", "totem", "crystal"].includes(
                    def.shape,
                  )
                    ? stats(p).magicDefense
                    : stats(p).defense) *
                    0.45) *
                  (w.damageScale || 1),
              ),
            ),
            { accuracy: monsterStats(def).accuracy, source: m },
          );
          if (
            landed &&
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
          duration: IMPACT_DURATION,
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
    this.advanceProjectiles();
    for (const area of this.pendingAreas || []) {
      const owner = this.players.get(area.owner);
      if (!owner || owner.map !== area.map || owner.hp <= 0) {
        area.waves = [];
        continue;
      }
      while (area.waves.length && area.waves[0] <= this.time + 1e-9) {
        area.waves.shift();
        const targets = this.map(area.map).mobs.filter(
          (m) =>
            m.hp > 0 &&
            distance(m, area) <= area.radius &&
            this.sight(area.map, area, m),
        );
        if (area.limit)
          targets.sort((a, b) => distance(a, area) - distance(b, area));
        for (const m of targets.slice(0, area.limit || targets.length))
          this.damage(owner, m, area.power, "burst");
      }
    }
    this.pendingAreas = (this.pendingAreas || []).filter((a) => a.waves.length);
    this.effects = this.effects.filter((e) => e.until > this.time);
    for (const p of this.players.values()) {
      this.explore(p);
      p.buffs = (p.buffs || []).filter((b) => b.until > this.time);
      if (p.featherUntil <= this.time) p.featherBonus = 0;
      const s = stats(p),
        map = this.map(p.map);
      p.hp = Math.min(p.hp, s.maxHp);
      for (const b of p.buffs)
        if (b.regen) p.hp = Math.min(s.maxHp, p.hp + dt * s.maxHp * b.regen);
      p.focus = Math.min(100, p.focus + dt * 4);
      if (map.config.town || this.time - p.lastHit > 8)
        p.hp = Math.min(s.maxHp, p.hp + dt * (map.config.town ? 12 : 1.8));
      if (p.regenUntil > this.time)
        p.hp = Math.min(s.maxHp, p.hp + dt * s.maxHp * 0.03);
      if (p.quickRegenUntil > this.time)
        p.hp = Math.min(s.maxHp, p.hp + dt * s.maxHp * 0.02);
      if (p.poisonUntil > this.time && this.time > p.poisonTick) {
        p.poisonTick = this.time + 1;
        this.hurtPlayer(p, Math.max(1, Math.round(s.maxHp * 0.015)), {
          avoidable: false,
        });
      }
      this.advanceAction(p);
      this.advanceCombat(p);
      this.advanceTracking(p);
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
        (this.time - p.animAt >
          (p.anim === "hurt" ? MONSTER_HIT_DURATION : 0.5) ||
          !["attack", "hurt", "recover"].includes(p.anim))
      )
        p.anim = moving ? "walk" : "idle";
      if (p.queuedAttack && !p.combatTarget && !p.queuedSkill) {
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
        if (this.time + 1e-9 < d.pickupEnds || d.until <= this.time) continue;
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
            m.hitUntil = 0;
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
        if (m.anim === "hurt" && m.hitUntil <= this.time) m.anim = "idle";
      }
    }
  }
  snapshot(id) {
    const p = this.players.get(id);
    if (!p) return null;
    const map = this.map(p.map);
    return {
      time: this.time,
      ambience: worldPulse(map.config, this.time),
      player: {
        ...serialize(p),
        id: p.id,
        stats: stats(p),
        anim: p.anim,
        animAt: p.animAt,
        animDuration: p.animDuration,
        action: p.action ? { ...p.action } : null,
        combatTarget: p.combatTarget,
        trackingTarget: p.trackingTarget,
        trackingRemaining: Math.max(0, p.trackingUntil - this.time),
        mobileAction: p.mobileAction ? { ...p.mobileAction } : null,
        queuedSkill: p.queuedSkill ? structuredClone(p.queuedSkill) : null,
        dir: p.dir,
        shield: p.shieldUntil > this.time ? p.shield : 0,
        cooldowns: p.cooldowns.map((t) => Math.max(0, t - this.time)),
        potionCooldown: Math.max(0, p.potionReady - this.time),
        consumableBuffs: (p.buffs || []).map((b) => ({
          item: b.item,
          remaining: Math.max(0, b.until - this.time),
        })),
        logs: p.logs,
        lootNotices: p.lootNotices,
        poisoned: p.poisonUntil > this.time,
        guardPower: p.guardPower,
        spellCharge: p.spellCharge,
        precise: p.precisionUntil > this.time,
        evading: p.evadeUntil > this.time,
        counterRemaining: Math.max(0, p.counterGuardUntil - this.time),
        counterCharges: p.counterGuardUntil > this.time ? p.counterCharges : 0,
        featherRemaining: Math.max(0, p.featherUntil - this.time),
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
          equipment: { ...a.equipment },
          level: a.level,
          hp: a.hp,
          maxHp: stats(a).maxHp,
          anim: a.anim,
          animAt: a.animAt,
          animDuration: a.animDuration,
          action: a.action
            ? { kind: a.action.kind, slot: a.action.slot, leap: a.action.leap }
            : null,
          combatTarget: a.combatTarget,
          mobileAction: a.mobileAction ? { ...a.mobileAction } : null,
          queuedSkill: a.queuedSkill
            ? { slot: a.queuedSkill.slot, point: a.queuedSkill.point }
            : null,
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
