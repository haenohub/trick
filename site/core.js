import { isWalkable, NAVIGATION } from "./art-layout.js";
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
    speed: c.id === "ranger" ? 3.7 : 3.3,
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
    x: 14,
    y: 14,
    visited: ["village"],
    defeatedBosses: [],
    discovered: [],
    quest: { index: 0, counts: {} },
    craftXp: 0,
    herbXp: 0,
    kills: 0,
    garden: [null, null],
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
  p.x = clamp(Number(raw.x) || 14, 2, 28);
  p.y = clamp(Number(raw.y) || 14, 2, 28);
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
  p.hp = clamp(Number(raw.hp) || stats(p).maxHp, 1, stats(p).maxHp);
  p.focus = clamp(Number(raw.focus) || 100, 0, 100);
  return p;
}
export function serialize(p) {
  const keys = [
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
  ];
  return structuredClone(Object.fromEntries(keys.map((k) => [k, p[k]])));
}
export function rollDrops(monster, rng = Math.random) {
  return monster.drops
    .filter((d) => rng() < d.chance)
    .map((d) => ({
      item: d.item,
      count: d.min + Math.floor(rng() * (d.max - d.min + 1)),
    }));
}
export function grantXp(p, amount) {
  p.xp += Math.max(0, amount);
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
  return x < 1.6 || y < 1.6 || x > 28.4 || y > 28.4 || !isWalkable(map, x, y);
}
export function findRoute(map, from, to) {
  const clear = (a, b) => {
    const n = Math.ceil(distance(a, b) * 5);
    for (let i = 1; i <= n; i++)
      if (
        blocked(map, a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)
      )
        return false;
    return true;
  };
  if (clear(from, to)) return [{ ...to }];
  const start = { x: Math.round(from.x), y: Math.round(from.y) },
    goal = { x: Math.round(to.x), y: Math.round(to.y) },
    key = (p) => p.x + "," + p.y;
  const open = [{ ...start, g: 0, f: distance(start, goal) }],
    best = new Map([[key(start), 0]]),
    parents = new Map(),
    closed = new Set();
  let reached = null;
  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const a = open.shift(),
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
      open.push({ ...b, g, f: g + distance(b, goal) });
    }
  }
  if (!reached) return [];
  const route = [{ ...to }];
  let node = reached;
  while (node && key(node) !== key(start)) {
    route.unshift({ x: node.x, y: node.y });
    node = parents.get(key(node));
  }
  return route;
}
function direction(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 1 : 3;
  return dy > 0 ? 0 : 2;
}
function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    t = clamp(
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
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
      dir: 0,
      shield: 0,
      shieldUntil: 0,
      lastHit: -100,
      logs: [],
      poisonUntil: 0,
      poisonTick: 0,
      regenUntil: 0,
    };
    if (blocked(p.map, p.x, p.y)) {
      p.x = 14;
      p.y = 14;
    }
    this.players.set(id, p);
    this.map(p.map);
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
    const definitions = MONSTERS.filter((m) => m.map === id);
    for (const def of definitions) {
      const count = def.type === "normal" ? 4 : 1;
      for (let j = 0; j < count; j++) {
        let x, y;
        for (let k = 0; k < 100; k++) {
          x = 6 + rng() * 18;
          y = 5 + rng() * 20;
          if (!blocked(id, x, y) && distance({ x, y }, { x: 14, y: 14 }) > 3)
            break;
        }
        if (def.type === "boss") {
          ({ x, y } = NAVIGATION[id].boss || { x: 18, y: 18 });
        }
        mobs.push({
          uid: `${def.id}-${j}`,
          def: def.id,
          x,
          y,
          homeX: x,
          homeY: y,
          hp: def.hp,
          maxHp: def.hp,
          dir: 0,
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
        });
      }
    }
    if (!config.town)
      for (let i = 0; i < 9; i++) {
        let x = 6 + rng() * 17,
          y = 6 + rng() * 17;
        while (blocked(id, x, y)) {
          x = 6 + rng() * 17;
          y = 6 + rng() * 17;
        }
        herbs.push({
          id: `herb-${id}-${i}`,
          x,
          y,
          item: config.region
            ? i % 3 === 0
              ? "breathgrass"
              : "saltflower"
            : i % 3 === 0
              ? "mint"
              : "softleaf",
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
  moveEntity(entity, map, dx, dy, dt, speed) {
    const n = Math.hypot(dx, dy);
    if (n < 0.01) return false;
    dx /= Math.max(1, n);
    dy /= Math.max(1, n);
    const nx = entity.x + dx * speed * dt,
      ny = entity.y + dy * speed * dt;
    let moved = false;
    if (!blocked(map, nx, entity.y)) {
      entity.x = nx;
      moved = true;
    }
    if (!blocked(map, entity.x, ny)) {
      entity.y = ny;
      moved = true;
    }
    entity.dir = direction(dx, dy);
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
        p.moveTarget = { x, y };
        p.move = { x: 0, y: 0 };
        p.queuedAttack = null;
        return true;
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
          `「${q.title}」 완료 · ${q.xp} 경험치 · ${q.gold} 골드`,
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
    if (this.time < p.attackReady) return false;
    const t = this.target(p, uid);
    if (!t) return false;
    const s = stats(p);
    if (distance(p, t) > s.range + 0.2) {
      p.moveTarget = { x: t.x, y: t.y };
      p.route = findRoute(p.map, p, t);
      p.queuedAttack = t.uid;
      return true;
    }
    p.attackReady = this.time + 0.62;
    p.anim = "attack";
    p.animAt = this.time;
    p.dir = direction(t.x - p.x, t.y - p.y);
    p.moveTarget = null;
    p.queuedAttack = null;
    this.damage(p, t, s.attack, "hit");
    if (s.range > 2)
      this.effect(p.map, "projectile", p.x, p.y, {
        tx: t.x,
        ty: t.y,
        color: CLASSES.find((c) => c.id === p.classId).color,
        duration: 0.32,
      });
    return true;
  }
  damage(p, m, value, kind = "hit") {
    if (m.hp <= 0) return;
    const def = MONSTERS.find((d) => d.id === m.def),
      crit = this.rng() < 0.12;
    const armored =
      ["beetle", "hermit", "crab"].includes(def.shape) &&
      m.windup &&
      ((m.dir === 0 && p.y > m.y) ||
        (m.dir === 1 && p.x > m.x) ||
        (m.dir === 2 && p.y < m.y) ||
        (m.dir === 3 && p.x < m.x));
    const n = Math.max(
      1,
      Math.round(
        (value - def.defense * 0.4) *
          (m.markedUntil > this.time ? 1.3 : 1) *
          (crit ? 1.5 : 1) *
          (armored ? 0.65 : 1),
      ),
    );
    m.hp = Math.max(0, m.hp - n);
    m.anim = "hurt";
    m.animAt = this.time;
    if (!p.discovered.includes(def.id)) p.discovered.push(def.id);
    this.effect(p.map, kind, m.x, m.y, {
      text: String(n),
      crit,
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
      p.gold += gold;
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
      for (const drop of rollDrops(def, this.rng))
        this.map(p.map).drops.push({
          id: ++this.sequence,
          ...drop,
          x: m.x + (this.rng() - 0.5) * 0.6,
          y: m.y + (this.rng() - 0.5) * 0.6,
          owner: p.id,
          until: this.time + 90,
        });
      this.log(p, `${def.name} · +${def.xp} 경험치 · +${gold} 골드`, "combat");
    }
  }
  skill(p, slot, uid) {
    if (
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
    if (
      !t &&
      !(p.classId === "herbalist" && (slot === 0 || slot === 2)) &&
      !(slot === 1 && ["warden", "ranger"].includes(p.classId)) &&
      !(slot === 3 && ["antler", "flower", "mist"].includes(p.branch))
    )
      return false;
    if (
      t &&
      distance(t, p) > s.range + 2 &&
      !(slot === 3 && p.branch === "hawk")
    )
      return false;
    p.focus -= SKILL_COSTS[slot];
    p.cooldowns[slot] = this.time + SKILL_COOLDOWNS[slot];
    p.anim = "attack";
    p.animAt = this.time;
    p.moveTarget = null;
    p.queuedAttack = null;
    if (t) p.dir = direction(t.x - p.x, t.y - p.y);
    const aoe = (center, r, mult, root = 0) => {
      for (const m of this.map(p.map).mobs)
        if (m.hp > 0 && distance(m, center) <= r) {
          this.damage(p, m, s.attack * mult, "burst");
          if (root) m.rootUntil = this.time + root;
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
      if (slot === 0 && t) this.damage(p, t, s.attack * 2.1);
      if (slot === 1) {
        p.shield = s.maxHp * 0.28;
        p.shieldUntil = this.time + 7;
        this.effect(p.map, "shield", p.x, p.y, { duration: 1 });
      }
      if (slot === 2) {
        aoe(p, 3, 1.9);
        this.effect(p.map, "slash", p.x, p.y, { radius: 3 });
      }
    }
    if (p.classId === "mage") {
      if (slot === 0 && t) this.damage(p, t, s.attack * 2.2, "burst");
      if (slot === 1 && t) {
        aoe(t, 2.5, 2.1);
        this.effect(p.map, "magic", t.x, t.y, { radius: 2.5 });
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
        this.effect(p.map, "dash", p.x, p.y);
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
        t.dotUntil = this.time + 8;
        t.dotPower = s.attack * 0.32;
        t.dotOwner = p.id;
        t.dotTick = this.time + 1;
        this.effect(p.map, "poison", t.x, t.y);
      }
      if (slot === 2) {
        p.regenUntil = this.time + 7;
        heal(s.maxHp * 0.12);
        aoe(p, 3, 1.2);
        this.effect(p.map, "garden", p.x, p.y, { radius: 3, duration: 2 });
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
        if (d > 1.5) {
          const ratio = (d - 1.2) / d;
          const x = p.x + (t.x - p.x) * ratio,
            y = p.y + (t.y - p.y) * ratio;
          if (!blocked(p.map, x, y)) {
            p.x = x;
            p.y = y;
          }
        }
        this.damage(p, t, s.attack * 4.4);
      }
      if (p.branch === "moon" && t) {
        this.damage(p, t, s.attack * 5.5, "burst");
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
            m.dotUntil = this.time + 10;
            m.dotPower = s.attack * 0.5;
            m.dotOwner = p.id;
            m.dotTick = this.time + 1;
          }
        this.effect(p.map, "poison", t.x, t.y, { radius: 3.5 });
      }
    }
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
    p.map = dest;
    const entry = ni > prev ? NAVIGATION[dest].west : NAVIGATION[dest].east;
    p.x = fast ? 14 : entry.x + (14 - entry.x) * 0.12;
    p.y = fast ? 14 : entry.y + (14 - entry.y) * 0.12;
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
  hurtPlayer(p, n) {
    if (p.shieldUntil <= this.time) p.shield = 0;
    const absorbed = Math.min(n, p.shield);
    p.shield -= absorbed;
    n -= absorbed;
    p.hp = Math.max(0, p.hp - n);
    p.lastHit = this.time;
    p.anim = "hurt";
    p.animAt = this.time;
    this.effect(p.map, "hurt", p.x, p.y, {
      text: n > 0 ? "-" + n : "방어",
      color: "#f6b4a4",
    });
    if (p.hp <= 0) {
      const town = MAPS.find(
        (m) => m.town && m.region === MAPS.find((m) => m.id === p.map).region,
      );
      p.map = town.id;
      p.x = 14;
      p.y = 14;
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
  step(dt) {
    dt = clamp(dt, 0, 0.1);
    this.time += dt;
    this.effects = this.effects.filter((e) => e.until > this.time);
    for (const p of this.players.values()) {
      const s = stats(p),
        map = this.map(p.map);
      p.focus = Math.min(100, p.focus + dt * 4);
      if (map.config.town || this.time - p.lastHit > 8)
        p.hp = Math.min(s.maxHp, p.hp + dt * (map.config.town ? 12 : 1.8));
      if (p.regenUntil > this.time)
        p.hp = Math.min(s.maxHp, p.hp + dt * s.maxHp * 0.03);
      if (p.poisonUntil > this.time && this.time > p.poisonTick) {
        p.poisonTick = this.time + 1;
        this.hurtPlayer(p, Math.max(1, Math.round(s.maxHp * 0.015)));
      }
      let dx = p.move.x,
        dy = p.move.y;
      if (p.moveTarget) {
        if (p.route?.length && distance(p, p.route[0]) < 0.25) p.route.shift();
        const point = p.route?.[0] || p.moveTarget,
          d = distance(p, point);
        if (d < 0.18) p.moveTarget = null;
        else {
          dx = (point.x - p.x) / d;
          dy = (point.y - p.y) / d;
        }
      }
      const inSlime = this.effects.some(
        (e) => e.map === p.map && e.kind === "slow" && distance(p, e) < 1.2,
      );
      const tideSlow =
        inSlime ||
        (map.config.biome === "marsh" &&
          Math.sin(this.time / 12) > 0 &&
          Math.abs(p.y - 14) > 2)
          ? 0.75
          : 1;
      const moving = this.moveEntity(p, p.map, dx, dy, dt, s.speed * tideSlow);
      if (this.time - p.animAt > 0.5 || !["attack", "hurt"].includes(p.anim))
        p.anim = moving ? "walk" : "idle";
      if (p.queuedAttack) {
        const t = map.mobs.find((m) => m.uid === p.queuedAttack);
        if (!t || t.hp <= 0) {
          p.queuedAttack = null;
          p.moveTarget = null;
        } else if (distance(p, t) <= s.range) this.attack(p, t.uid);
        else p.moveTarget = { x: t.x, y: t.y };
      }
      for (const drop of map.drops)
        if (
          drop.owner === p.id &&
          drop.until > this.time &&
          distance(p, drop) < 1.3
        ) {
          this.addItem(p, drop.item, drop.count);
          drop.until = 0;
          this.log(p, `${ITEMS[drop.item].name} ×${drop.count} 획득`, "loot");
        }
    }
    for (const [id, map] of this.maps) {
      const players = [...this.players.values()].filter((p) => p.map === id);
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
          }
          continue;
        }
        if (m.dotUntil > this.time && m.dotTick < this.time) {
          m.dotTick = this.time + 1;
          const owner = this.players.get(m.dotOwner);
          if (owner?.map === id) this.damage(owner, m, m.dotPower, "poison");
          if (m.hp <= 0) continue;
        }
        if (m.windup) {
          if (this.time >= m.windup.at) {
            const w = m.windup;
            m.windup = null;
            m.anim = "attack";
            m.animAt = this.time;
            for (const p of players) {
              if (p.map !== id) continue;
              let hit = false;
              if (w.style === "line")
                hit =
                  segmentDistance(p, { x: w.x, y: w.y }, { x: w.tx, y: w.ty }) <
                  0.9;
              else {
                const d = distance(p, w);
                hit = d < w.radius && (w.style !== "ring" || d > 1.25);
              }
              if (hit) {
                this.hurtPlayer(
                  p,
                  Math.max(2, Math.round(def.attack - stats(p).defense * 0.45)),
                );
                if (
                  ["bug", "jelly", "mantis", "anemone"].includes(def.shape) &&
                  def.region === 1
                )
                  p.poisonUntil = this.time + 5;
              }
            }
            if (w.jump && !blocked(id, w.x, w.y)) {
              m.x = w.x;
              m.y = w.y;
            }
            if (w.charge) {
              const n = distance({ x: w.x, y: w.y }, { x: w.tx, y: w.ty }) || 1;
              for (let i = 0; i < 10; i++)
                this.moveEntity(
                  m,
                  id,
                  (w.tx - w.x) / n,
                  (w.ty - w.y) / n,
                  0.06,
                  5,
                );
            }
            if (def.ranged)
              this.effect(id, "projectile", m.x, m.y, {
                tx: w.x,
                ty: w.y,
                color: "#c2e5cf",
                duration: 0.3,
              });
            this.effect(id, "enemy", w.x, w.y, {
              radius: w.radius || 3,
              duration: 0.45,
            });
            m.nextAttack = this.time + (def.type === "boss" ? 1.8 : 2.1);
          }
          continue;
        }
        const p = players.sort((a, b) => distance(a, m) - distance(b, m))[0],
          d = distance(m, p),
          reach = def.ranged ? 4.2 : 1.15;
        if (
          d < (def.type === "boss" ? 8 : 5.3) &&
          distance(m, { x: m.homeX, y: m.homeY }) < 11
        ) {
          if (!p.discovered.includes(def.id)) p.discovered.push(def.id);
          if (d <= reach && this.time >= m.nextAttack) {
            const boss = def.type === "boss",
              pattern = (m.pattern || 0) % 3;
            m.pattern = (m.pattern || 0) + 1;
            let w = {
              x: p.x,
              y: p.y,
              radius: boss ? 2.5 : 0.95,
              at: this.time + (boss ? 1.2 : 0.7),
              start: this.time,
              style: "circle",
            };
            if (
              !boss &&
              ["boar", "squirrel", "weasel", "fox"].includes(def.shape)
            ) {
              const dx = p.x - m.x,
                dy = p.y - m.y,
                n = Math.hypot(dx, dy) || 1;
              w = {
                ...w,
                x: m.x,
                y: m.y,
                tx: m.x + (dx / n) * 4,
                ty: m.y + (dy / n) * 4,
                style: "line",
                charge: true,
                at: this.time + 0.9,
              };
            }
            if (!boss && ["frog", "monkey"].includes(def.shape))
              w = { ...w, radius: 1.4, jump: true, at: this.time + 0.9 };
            if (!boss && ["jelly", "anemone"].includes(def.shape))
              w = { ...w, radius: 1.7 };
            if (boss && pattern === 1)
              w = { ...w, x: m.x, y: m.y, radius: 4, style: "ring" };
            if (boss && pattern === 2) {
              const dx = p.x - m.x,
                dy = p.y - m.y,
                n = Math.hypot(dx, dy) || 1;
              w = {
                ...w,
                x: m.x,
                y: m.y,
                tx: m.x + (dx / n) * 8,
                ty: m.y + (dy / n) * 8,
                style: "line",
              };
            }
            m.windup = w;
            m.anim = "attack";
            m.animAt = this.time;
            m.dir = direction(p.x - m.x, p.y - m.y);
          } else if (d > reach * 0.8 && m.rootUntil < this.time) {
            this.moveEntity(m, id, p.x - m.x, p.y - m.y, dt, def.speed);
            m.anim = "walk";
          }
        } else if (distance(m, { x: m.homeX, y: m.homeY }) > 2) {
          this.moveEntity(
            m,
            id,
            m.homeX - m.x,
            m.homeY - m.y,
            dt,
            def.speed * 0.8,
          );
          m.anim = "walk";
        } else {
          if (this.time > m.wanderAt) {
            m.wanderAt = this.time + 2 + this.rng() * 3;
            m.wanderX = m.homeX + (this.rng() - 0.5) * 3;
            m.wanderY = m.homeY + (this.rng() - 0.5) * 3;
          }
          if (
            distance(m, { x: m.wanderX || m.x, y: m.wanderY || m.y }) > 0.35
          ) {
            this.moveEntity(
              m,
              id,
              m.wanderX - m.x,
              m.wanderY - m.y,
              dt,
              def.speed * 0.4,
            );
            m.anim = "walk";
          } else m.anim = "idle";
        }
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
        dir: p.dir,
        shield: p.shieldUntil > this.time ? p.shield : 0,
        cooldowns: p.cooldowns.map((t) => Math.max(0, t - this.time)),
        potionCooldown: Math.max(0, p.potionReady - this.time),
        logs: p.logs,
        poisoned: p.poisonUntil > this.time,
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
          dir: a.dir,
        })),
      mobs: map.mobs.map((m) => ({ ...m })),
      herbs: map.herbs.map((h) => ({ ...h, ready: h.readyAt <= this.time })),
      drops: map.drops.filter((d) => d.owner === id),
      effects: this.effects.filter((e) => e.map === p.map),
    };
  }
}
