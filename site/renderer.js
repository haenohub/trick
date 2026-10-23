import { MAPS, MONSTERS, NPCS, CLASSES, PORTALS, ITEMS } from "./data.js";
import { worldToImage } from "./art-layout.js";
const IMAGES = new Map();
let ART = null;
const REVISION =
  document.querySelector('meta[name="leaftale-revision"]')?.content || "local";
function load(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      IMAGES.set(file, image);
      resolve();
    };
    image.onerror = () =>
      reject(new Error(`필수 아트를 불러오지 못했습니다: ${file}`));
    image.src = `./assets/${file}.png?v=${REVISION}`;
  });
}
export async function loadArt(progress = () => {}) {
  const response = await fetch("./assets/manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Art manifest unavailable");
  ART = await response.json();
  let done = 0;
  await Promise.all(
    ART.files.map(async (file) => {
      await load(file);
      progress(++done / ART.files.length);
    }),
  );
}
// Measured UV boundaries keep uneven generated rows from leaking into neighbors.
function sourceRect(file, cols, rows, col, row) {
  const image = IMAGES.get(file),
    bounds = ART.frameBounds?.[file];
  if (bounds?.rects?.[row]?.[col]) return bounds.rects[row][col];
  const sx =
    bounds?.xByRow?.[row]?.[col] ??
    bounds?.x?.[col] ??
    Math.round((col * image.width) / cols);
  const sy = bounds?.y?.[row] ?? Math.round((row * image.height) / rows);
  const ex =
    bounds?.xByRow?.[row]?.[col + 1] ??
    bounds?.x?.[col + 1] ??
    Math.round(((col + 1) * image.width) / cols);
  const ey =
    bounds?.y?.[row + 1] ?? Math.round(((row + 1) * image.height) / rows);
  return { sx, sy, sw: ex - sx, sh: ey - sy };
}
function preview(canvas, file, cols, rows, col, row, face = false) {
  const image = IMAGES.get(file);
  if (!image) return;
  let { sx, sy, sw, sh } = sourceRect(file, cols, rows, col, row);
  if (face) {
    sy += sh * 0.3;
    sh *= 0.6;
  }
  const c = canvas.getContext("2d"),
    scale = Math.min(canvas.width / sw, canvas.height / sh);
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.drawImage(
    image,
    sx,
    sy,
    sw,
    sh,
    (canvas.width - sw * scale) / 2,
    canvas.height - sh * scale,
    sw * scale,
    sh * scale,
  );
}
export function drawCharacterPreview(canvas, id, face = false) {
  const l = ART.characterLayouts[id];
  preview(canvas, "characters/" + id, l.cols, l.rows, 0, 0, face);
}
export function drawMonsterPreview(canvas, id) {
  const i = Number(id.slice(1)) - 1,
    l = ART.creatureLayouts[Math.floor(i / 4)],
    row = l.speciesRows?.[i % 4]?.[0] ?? (i % 4) * 2;
  preview(
    canvas,
    "creatures/group-" + Math.floor(i / 4),
    l.cols,
    l.rows,
    0,
    row,
  );
}
export const project = (x, y) => ({ x: (x - y) * 32, y: (x + y) * 16 });
export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.minimap = minimap;
    this.camera = { x: 0, y: 448 };
    this.hitboxes = [];
    this.size = { width: 1000, height: 700 };
    this.destination = null;
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    if (
      this.canvas.width !== Math.round(r.width * d) ||
      this.canvas.height !== Math.round(r.height * d)
    ) {
      this.canvas.width = Math.round(r.width * d);
      this.canvas.height = Math.round(r.height * d);
    }
    this.dpr = d;
    this.size = { width: r.width, height: r.height };
  }
  worldToScreen(x, y) {
    const s = project(x, y);
    return {
      x: s.x - this.camera.x + this.size.width / 2,
      y: s.y - this.camera.y + this.size.height * 0.53,
    };
  }
  screenToWorld(x, y) {
    const xx = x + this.camera.x - this.size.width / 2,
      yy = y + this.camera.y - this.size.height * 0.53;
    return { x: xx / 64 + yy / 32, y: yy / 32 - xx / 64 };
  }
  text(text, x, y, color = "#fff5da", size = 12, align = "center") {
    const c = this.ctx;
    c.font = `600 ${size}px system-ui,sans-serif`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.lineWidth = 3;
    c.strokeStyle = "#243c32db";
    c.strokeText(text, Math.round(x), Math.round(y));
    c.fillStyle = color;
    c.fillText(text, Math.round(x), Math.round(y));
  }
  cell(
    file,
    cols,
    rows,
    col,
    row,
    x,
    y,
    width,
    height,
    anchor = 0.5,
    mirror = false,
  ) {
    const image = IMAGES.get(file);
    if (!image) return;
    const { sx, sy, sw, sh } = sourceRect(file, cols, rows, col, row),
      c = this.ctx;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    if (mirror) c.scale(-1, 1);
    c.drawImage(
      image,
      sx,
      sy,
      sw,
      sh,
      -width / 2,
      -height * anchor,
      width,
      height,
    );
    c.restore();
  }
  icon(index, x, y, size = 30) {
    if (index >= 58) {
      this.cell("items", 6, 8, index - 58, 7, x, y, size, size, 0.5);
      return;
    }
    this.cell(
      "items",
      8,
      8,
      index % 8,
      Math.floor(index / 8),
      x,
      y,
      size,
      size,
      0.5,
    );
  }
  item(id, x, y, size = 30) {
    const special = ART.itemOverrides?.[id];
    if (special) {
      this.cell(
        special.file,
        special.cols,
        special.rows,
        special.index % special.cols,
        Math.floor(special.index / special.cols),
        x,
        y,
        size,
        size,
        0.5,
      );
      return;
    }
    this.icon(ART.items[id] || 0, x, y, size);
  }
  fx(
    row,
    frame,
    x,
    y,
    width = 80,
    height = width,
    opacity = 1,
    tint = null,
    angle = 0,
  ) {
    const c = this.ctx;
    c.save();
    c.globalAlpha = opacity;
    if (tint) c.filter = tint;
    if (angle) {
      c.translate(x, y);
      c.rotate(angle);
      x = 0;
      y = 0;
    }
    this.cell(
      "effects",
      8,
      8,
      Math.min(7, Math.max(0, frame)),
      row,
      x,
      y,
      width,
      height,
      0.65,
    );
    c.restore();
  }
  sprite(name, x, y, anim, dir, time, start, height = 100) {
    let file,
      cols,
      rows,
      row,
      frames,
      mirror = false,
      anchor = 0.94;
    if (/^m\d+$/.test(name)) {
      const index = Number(name.slice(1)) - 1;
      if (!Number.isInteger(index) || index < 0) return;
      file = `creatures/group-${Math.floor(index / 4)}`;
      const layout = ART.creatureLayouts?.[Math.floor(index / 4)] || {
        cols: 8,
        rows: 8,
      };
      cols = layout.cols;
      rows = layout.rows;
      row =
        layout.speciesRows?.[index % 4]?.[dir === 2 || dir === 3 ? 1 : 0] ??
        (index % 4) * 2 + (dir === 2 || dir === 3 ? 1 : 0);
      mirror = dir === 0 || dir === 3;
      frames =
        anim === "walk"
          ? [0, 1, 2, 3, 4]
          : anim === "attack"
            ? [5, 6]
            : anim === "hurt"
              ? [6]
              : anim === "death"
                ? [7]
                : [0];
    } else if (name.startsWith("npc:")) {
      const n = NPCS.findIndex((n) => n.id === name.slice(4));
      if (n < 0) return;
      const layout = ART.npcLayout || { cols: 8, rows: 4, framesPerNpc: 4 };
      file = "npcs";
      cols = layout.cols;
      rows = layout.rows;
      const base = n * layout.framesPerNpc,
        local = Math.floor(time * 1.5) % Math.min(2, layout.framesPerNpc);
      const index = base + local;
      row = Math.floor(index / cols);
      frames = [index % cols];
    } else {
      file = `characters/${name}`;
      const layout = ART.characterLayouts?.[name] || { cols: 10, rows: 6 };
      cols = layout.cols;
      rows = layout.rows;
      row = { 0: 0, 1: 2, 2: 3, 3: 2 }[dir] || 0;
      mirror = dir === 1;
      frames =
        anim === "walk"
          ? [0, 1, 2, 3, 4]
          : anim === "attack"
            ? [5, 6, 7]
            : anim === "hurt"
              ? [8]
              : anim === "death"
                ? [9]
                : [0];
      frames = layout.animations?.[anim] || frames;
    }
    const image = IMAGES.get(file);
    if (!image) return;
    const c = this.ctx,
      age = Math.max(0, time - start);
    if (anim === "death") {
      c.save();
      c.globalAlpha = Math.max(0, 1 - age / 0.85);
    }
    const index =
      anim === "attack" || anim === "hurt" || anim === "death"
        ? Math.min(frames.length - 1, Math.floor(age * 11))
        : Math.floor(time * (anim === "walk" ? 9 : 1.5)) % frames.length;
    const { sw, sh } = sourceRect(file, cols, rows, frames[index], row);
    const width = (height * sw) / sh;
    const breath = anim === "idle" ? Math.sin(time * 2) * 0.35 : 0;
    this.cell(
      file,
      cols,
      rows,
      frames[index],
      row,
      x,
      y + breath,
      width,
      height,
      anchor,
      mirror,
    );
    if (anim === "death") c.restore();
  }
  render(state, target, dt = 1 / 60) {
    this.resize();
    const c = this.ctx,
      { width: w, height: h } = this.size,
      p = state.player,
      time = state.time,
      map = MAPS.find((m) => m.id === p.map),
      bg = IMAGES.get(`maps/${p.map}`);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    const desired = project(p.x, p.y),
      cx = Math.max(-960 + w / 2, Math.min(960 - w / 2, desired.x)),
      cy = Math.max(-160 + h * 0.53, Math.min(1120 - h * 0.47, desired.y));
    if (this.lastMap !== p.map) {
      this.camera = { x: cx, y: cy };
      this.lastMap = p.map;
      this.destination = null;
    } else {
      const t = 1 - Math.exp(-dt * 9);
      this.camera.x += (cx - this.camera.x) * t;
      this.camera.y += (cy - this.camera.y) * t;
    }
    const zero = this.worldToScreen(0, 0);
    c.fillStyle = "#203c2f";
    c.fillRect(0, 0, w, h);
    if (bg) c.drawImage(bg, zero.x - 960, zero.y - 160, 1920, 1280);
    this.hitboxes = [];
    for (const port of PORTALS(p.map)) {
      const s = this.worldToScreen(port.x, port.y);
      this.fx(7, Math.floor(time * 7) % 8, s.x, s.y + 12, 100, 95, 0.85);
      this.text(port.label, s.x, s.y - 65, "#fff1c5", 12);
      this.text("클릭하여 이동", s.x, s.y + 29, "#ffefc9", 9);
      this.hitboxes.push({
        kind: "portal",
        id: port.to,
        x: s.x,
        y: s.y - 20,
        r: 40,
      });
    }
    if (this.destination && time - this.destination.at < 1.5) {
      const d = this.worldToScreen(this.destination.x, this.destination.y);
      this.fx(
        7,
        Math.floor((time - this.destination.at) * 8) % 8,
        d.x,
        d.y + 8,
        40,
        32,
        0.8,
      );
    }
    for (const m of state.mobs) {
      if (!m.windup || m.hp <= 0) continue;
      const a = m.windup,
        s = this.worldToScreen(a.x, a.y),
        t = Math.min(1, (time - a.start) / (a.at - a.start));
      if (a.style === "line") {
        const e = this.worldToScreen(a.tx, a.ty),
          length = Math.hypot(e.x - s.x, e.y - s.y);
        this.fx(
          3,
          Math.min(7, Math.floor(t * 8)),
          (s.x + e.x) / 2,
          (s.y + e.y) / 2,
          length + 35,
          42,
          0.65,
          "sepia(1) saturate(4) hue-rotate(315deg)",
          Math.atan2(e.y - s.y, e.x - s.x),
        );
      } else {
        this.fx(
          5,
          Math.min(7, Math.floor(t * 7)),
          s.x,
          s.y + 12,
          a.radius * 75,
          a.radius * 45,
          0.7,
          "sepia(1) saturate(4) hue-rotate(315deg)",
        );
        if (a.style === "ring") {
          this.fx(7, 3, s.x, s.y + 8, 72, 50, 0.8);
          this.text("안쪽 안전", s.x, s.y + 17, "#efffd5", 10);
        }
      }
    }
    for (const e of state.effects.filter((e) =>
      ["garden", "vine", "shield", "magic", "poison", "slash", "slow"].includes(
        e.kind,
      ),
    )) {
      const s = this.worldToScreen(e.x, e.y),
        age = e.until - time;
      const row = {
        garden: 2,
        vine: 0,
        shield: 5,
        magic: 1,
        poison: 4,
        slash: 0,
        slow: 2,
      }[e.kind];
      this.fx(
        row,
        Math.floor(time * 12) % 8,
        s.x,
        s.y + 8,
        (e.radius || 2) * 55,
        (e.radius || 2) * 45,
        Math.min(0.85, age),
      );
    }
    const objects = [
      ...state.herbs.map((h) => ({ ...h, kind: "herb" })),
      ...state.drops.map((d) => ({ ...d, kind: "drop" })),
      ...NPCS.filter((n) => n.map === p.map).map((n) => ({
        ...n,
        kind: "npc",
      })),
      ...state.mobs
        .filter((m) => m.hp > 0 || time - m.animAt < 0.85)
        .map((m) => ({ ...m, kind: "monster" })),
      ...state.peers.map((peer) => ({ ...peer, kind: "peer" })),
      { ...p, kind: "player" },
    ].sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const o of objects) {
      const s = this.worldToScreen(o.x, o.y);
      if (s.x < -200 || s.x > w + 200 || s.y < -100 || s.y > h + 200) continue;
      if (o.kind === "herb") {
        c.save();
        c.globalAlpha = o.ready ? 1 : 0.3;
        this.item(o.item, s.x, s.y - 12, 34);
        c.restore();
        if (o.ready)
          this.fx(6, Math.floor(time * 6) % 8, s.x, s.y, 32, 32, 0.55);
        this.hitboxes.push({
          kind: "herb",
          id: o.id,
          x: s.x,
          y: s.y - 12,
          r: 22,
        });
        continue;
      }
      if (o.kind === "drop") {
        this.fx(6, Math.floor(time * 7) % 8, s.x, s.y, 35, 25, 0.8);
        this.item(o.item, s.x, s.y - 10 + Math.sin(time * 3) * 2, 28);
        continue;
      }
      const monster = o.kind === "monster",
        def = monster ? MONSTERS.find((m) => m.id === o.def) : null,
        boss = def?.type === "boss",
        height = monster
          ? boss
            ? 172
            : def.type === "elite"
              ? 100
              : def.type === "rare"
                ? 108
                : 76
          : o.kind === "npc"
            ? 110
            : 116;
      const name = monster
        ? o.def
        : o.kind === "npc"
          ? "npc:" + o.id
          : o.classId;
      if (monster && o.uid === target)
        this.fx(
          7,
          3,
          s.x,
          s.y + 10,
          boss ? 115 : 68,
          boss ? 70 : 45,
          0.7,
          "sepia(.8)",
        );
      const jump = o.windup?.jump
        ? Math.sin(
            Math.min(
              1,
              (time - o.windup.start) / (o.windup.at - o.windup.start),
            ) * Math.PI,
          ) * 22
        : 0;
      this.sprite(
        name,
        s.x,
        s.y - jump,
        o.anim || "idle",
        o.dir || 0,
        time,
        o.animAt || 0,
        height,
      );
      if (o.kind === "player" && o.shield > 0)
        this.fx(5, 3, s.x, s.y + 12, 105, 110, 0.65);
      if (monster && o.hp > 0) {
        this.hitboxes.push({
          kind: "monster",
          id: o.uid,
          x: s.x,
          y: s.y - height * 0.4,
          r: boss ? 65 : 34,
        });
        if (o.hp < o.maxHp || o.uid === target || boss) {
          const bw = boss ? 100 : 50;
          c.fillStyle = "#293d2fdc";
          c.fillRect(s.x - bw / 2, s.y - height * 0.9, bw, 5);
          c.fillStyle = boss ? "#e2b582" : "#d7c88d";
          c.fillRect(
            s.x - bw / 2 + 1,
            s.y - height * 0.9 + 1,
            ((bw - 2) * o.hp) / o.maxHp,
            3,
          );
        }
        if (o.uid === target || boss)
          this.text(
            def.name,
            s.x,
            s.y - height * 0.9 - 12,
            boss ? "#ffe2b4" : "#fff0cf",
            boss ? 12 : 10,
          );
        if (o.markedUntil > time)
          this.text("⌖", s.x, s.y - height * 0.88 - 25, "#fff0b4", 20);
      } else if (o.kind === "npc") {
        this.text(o.name, s.x, s.y - 111, "#fff1c0", 11);
        this.text(o.role, s.x, s.y - 124, "#def0cb", 9);
        this.hitboxes.push({
          kind: "npc",
          id: o.id,
          x: s.x,
          y: s.y - 45,
          r: 34,
        });
      } else if (o.kind !== "monster")
        this.text(
          o.name,
          s.x,
          s.y - height - 6,
          o.kind === "player" ? "#fff4d3" : "#d6eed8",
          11,
        );
    }
    for (const e of state.effects) {
      const s = this.worldToScreen(e.x, e.y),
        remaining = e.until - time;
      if (e.text)
        this.text(
          e.text,
          s.x,
          s.y - 60 - (1 - remaining) * 23,
          e.color || "#fff1c8",
          e.crit ? 22 : e.kind === "level" ? 24 : 16,
        );
      if (["projectile", "beam"].includes(e.kind)) {
        const end = this.worldToScreen(e.tx, e.ty),
          dx = end.x - s.x,
          dy = end.y - s.y;
        this.fx(
          e.kind === "beam" ? 1 : 3,
          Math.floor(time * 16) % 8,
          (s.x + end.x) / 2,
          (s.y + end.y) / 2 - 35,
          Math.max(50, Math.hypot(dx, dy)),
          e.kind === "beam" ? 54 : 28,
          0.9,
          null,
          Math.atan2(dy, dx),
        );
      }
      if (["hit", "burst", "heal", "level", "enemy"].includes(e.kind))
        this.fx(
          e.kind === "heal"
            ? 2
            : e.kind === "level"
              ? 6
              : e.kind === "burst"
                ? 1
                : 0,
          Math.floor((1 - remaining) * 9) % 8,
          s.x,
          s.y - 25,
          e.kind === "level" ? 130 : 75,
          80,
          0.85,
        );
    }
    this.drawMinimap(state);
  }
  drawMinimap(state) {
    const c = this.minimap.getContext("2d"),
      w = this.minimap.width,
      h = this.minimap.height,
      bg = IMAGES.get("maps/" + state.player.map);
    c.clearRect(0, 0, w, h);
    if (bg) c.drawImage(bg, 0, 0, w, h);
    const p = worldToImage(state.player.x, state.player.y);
    c.strokeStyle = "#fff0af";
    c.lineWidth = 2;
    c.strokeRect(
      ((this.camera.x - this.size.width / 2 + 960) / 1920) * w,
      ((this.camera.y - this.size.height * 0.53 + 160) / 1280) * h,
      (this.size.width / 1920) * w,
      (this.size.height / 1280) * h,
    );
    const image = IMAGES.get("items");
    if (image) {
      const cw = image.width / 8,
        ch = image.height / 8;
      c.drawImage(image, 0, 0, cw, ch, p.u * w - 5, p.v * h - 5, 10, 10);
    }
  }
  hit(x, y) {
    return this.hitboxes
      .filter((h) => Math.hypot(h.x - x, h.y - y) < h.r)
      .sort(
        (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
      )[0];
  }
}
