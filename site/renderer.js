import { animationFrame } from "./animation.js";
import { attackZones, zoneOutline } from "./combat.js";
import { MAPS, MONSTERS, NPCS, CLASSES, PORTALS, ITEMS } from "./data.js";
import { worldToImage } from "./art-layout.js";
import { direction, SOUTH } from "./directions.js";
import { NAVIGATION, TILE, WORLD_ZOOM } from "./world-layout.js";
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
// Native assets use equal, integer pixel cells.
function sourceRect(file, cols, rows, col, row) {
  const image = IMAGES.get(file),
    sw = image.width / cols,
    sh = image.height / rows;
  return { sx: col * sw, sy: row * sh, sw, sh };
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
  c.imageSmoothingEnabled = false;
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
  preview(canvas, "characters/" + id, l.cols, l.rows, 0, SOUTH, face);
}
export function drawMonsterPreview(canvas, id) {
  const m = ART.monsters[id];
  canvas.width = canvas.height = m.size * ART.pixelScale;
  canvas.style.width = canvas.style.height = canvas.width + "px";
  preview(canvas, m.file, m.cols, m.rows, 0, 5);
}
export const project = (x, y) => ({ x: (x - y) * 32, y: (x + y) * 16 });
export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.scene = document.createElement("canvas");
    this.ctx = this.scene.getContext("2d", { alpha: false });
    this.display = canvas.getContext("2d", { alpha: false });
    this.labels = [];
    this.minimap = minimap;
    this.camera = { x: 0, y: 448 };
    this.hitboxes = [];
    this.size = { width: 1000, height: 700 };
    this.destination = null;
    this.zoom = WORLD_ZOOM;
    this.shake = { x: 0, y: 0 };
    this.impactSeen = 0;
    this.impactUntil = 0;
    this.minimapCache = new Map();
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
    const sw = this.canvas.width,
      sh = this.canvas.height;
    if (this.scene.width !== sw || this.scene.height !== sh) {
      this.scene.width = sw;
      this.scene.height = sh;
    }
    this.dpr = d;
    this.size = { width: r.width, height: r.height };
  }
  worldToScreen(x, y) {
    const s = project(x, y);
    return {
      x:
        (s.x - this.camera.x) * this.zoom +
        this.size.width / 2 +
        (this.shake?.x || 0),
      y:
        (s.y - this.camera.y) * this.zoom +
        this.size.height * 0.53 +
        (this.shake?.y || 0),
    };
  }
  screenToWorld(x, y) {
    const xx =
        (x - (this.shake?.x || 0) - this.size.width / 2) / this.zoom +
        this.camera.x,
      yy =
        (y - (this.shake?.y || 0) - this.size.height * 0.53) / this.zoom +
        this.camera.y;
    return { x: xx / 64 + yy / 32, y: yy / 32 - xx / 64 };
  }
  text(text, x, y, color = "#fff5da", size = 12, align = "center") {
    this.labels.push({ text, x, y, color, size, align });
  }
  present() {
    const c = this.display,
      { width, height } = this.size;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    c.drawImage(
      this.scene,
      0,
      0,
      this.scene.width,
      this.scene.height,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const label of this.labels) {
      const { text, x, y, color, size, align } = label;
      // Two typographic points equal 8/3 CSS pixels, independent of world zoom.
      c.font = `600 ${size + 8 / 3}px system-ui,sans-serif`;
      c.textAlign = align;
      c.textBaseline = "middle";
      c.lineWidth = 3;
      c.strokeStyle = "#243c32db";
      c.strokeText(text, Math.round(x), Math.round(y));
      c.fillStyle = color;
      c.fillText(text, Math.round(x), Math.round(y));
    }
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
    // All doubled-resolution artwork shares one native pixel per world display unit.
    // Resolution changes do not alter the logical world or camera coverage.
    // World item/effect requests choose an atlas; they never stretch its cells.
    width = sw * ART.pixelScale;
    height = sh * ART.pixelScale;
    const snap = (v) => Math.round(v * (this.dpr || 1)) / (this.dpr || 1);
    const left = snap(x - (width * this.zoom) / 2),
      top = snap(y - height * anchor * this.zoom),
      right = snap(x + (width * this.zoom) / 2),
      bottom = snap(y + height * (1 - anchor) * this.zoom);
    c.save();
    c.imageSmoothingEnabled = false;
    if (mirror) {
      c.translate(left + right, 0);
      c.scale(-1, 1);
    }
    c.drawImage(image, sx, sy, sw, sh, left, top, right - left, bottom - top);
    c.restore();
  }
  icon(index, x, y, size = 32) {
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
  lootIcon(drop, x, y, rotation = 0) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    if (rotation) c.rotate(rotation);
    if (drop.kind === "currency" && ART.currency) {
      const a = ART.currency;
      this.cell(
        a.file,
        a.cols,
        a.rows,
        Math.floor((drop.spinTime || 0) * 8) % a.cols,
        0,
        0,
        0,
        32,
        32,
        0.5,
      );
    } else this.item(drop.kind === "currency" ? "fiber" : drop.item, 0, 0, 32);
    c.restore();
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
    // Keep long attack warnings and area boundaries at their real extents,
    // using native effect cells along the path instead of stretching pixels.
    if (width > 128 || height > 128 || (width > 64 && width > height * 2)) {
      const draw = (dx, dy) =>
        this.cell(
          ART.effects.variants[32],
          ART.effects.cols,
          ART.effects.rows,
          Math.min(ART.effects.cols - 1, Math.max(0, frame)),
          row,
          dx,
          dy,
          64,
          64,
          0.5,
        );
      if (height < 64) {
        const span = Math.max(0, width - 64);
        const count = Math.max(2, Math.ceil(span / 40) + 1);
        for (let i = 0; i < count; i++)
          draw(x + (-span / 2 + (span * i) / (count - 1)) * this.zoom, y);
      } else {
        const rx = Math.max(0, width / 2 - 32),
          ry = Math.max(0, height / 2 - 32);
        const count = Math.min(
          32,
          Math.max(8, Math.ceil((Math.PI * (width + height)) / 96)),
        );
        for (let i = 0; i < count; i++) {
          const a = (i * Math.PI * 2) / count;
          draw(
            x + Math.cos(a) * rx * this.zoom,
            y + Math.sin(a) * ry * this.zoom,
          );
        }
        if (row !== 5) draw(x, y);
      }
      c.restore();
      return;
    }
    const native =
      Math.max(width, height) <= 96
        ? 32
        : Math.max(width, height) <= 144
          ? 48
          : 64;
    this.cell(
      ART.effects.variants[native],
      ART.effects.cols,
      ART.effects.rows,
      Math.min(ART.effects.cols - 1, Math.max(0, frame)),
      row,
      x,
      y,
      width,
      height,
      0.65,
    );
    c.restore();
  }
  effectFrame(age, duration = 0.8, loop = false) {
    const frames = ART.effects.frames || 8;
    const progress = Math.max(0, age) / duration;
    return loop
      ? Math.floor(progress * frames) % frames
      : Math.min(frames - 1, Math.floor(progress * frames));
  }
  sprite(name, x, y, anim, dir, time, start, height = 96, duration = null) {
    const layout = /^m\d+$/.test(name)
      ? ART.monsters[name]
      : name.startsWith("npc:")
        ? ART.npcLayouts[name.slice(4)]
        : ART.characterLayouts[name];
    if (!layout) return;
    const file = layout.file || "characters/" + name,
      age = Math.max(0, time - start),
      c = this.ctx;
    if (anim === "death") {
      c.save();
      c.globalAlpha = Math.max(0, 1 - age / 0.85);
    }
    this.cell(
      file,
      layout.cols,
      layout.rows,
      animationFrame(layout, anim, time, start, duration),
      dir,
      x,
      y,
      height,
      height,
      1 - 2 / (layout.size / (ART.resolutionScale || 1)),
      false,
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
      nav = NAVIGATION[p.map];
    this.labels = [];
    for (const e of state.effects)
      if (e.id > this.impactSeen) {
        if (
          e.impact &&
          (e.owner === p.id ||
            (e.kind === "enemy" && Math.hypot(p.x - e.x, p.y - e.y) < 12))
        ) {
          this.impactUntil = time + 0.14;
          this.impactStrength = Math.min(3, e.impact);
        }
        this.impactSeen = Math.max(this.impactSeen, e.id);
      }
    const shake =
      Math.max(0, (this.impactUntil - time) / 0.14) *
      (this.impactStrength || 0);
    this.shake = matchMedia("(prefers-reduced-motion: reduce)").matches
      ? { x: 0, y: 0 }
      : {
          x: Math.round(Math.sin(time * 92) * shake),
          y: Math.round(Math.cos(time * 78) * shake * 0.6),
        };
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    const desired = project(p.x, p.y),
      cx = Math.max(
        -nav.width + w / (2 * this.zoom),
        Math.min(nav.width - w / (2 * this.zoom), desired.x),
      ),
      cy = Math.max(
        (h * 0.53) / this.zoom,
        Math.min(nav.height * 2 - (h * 0.47) / this.zoom, desired.y),
      );
    if (this.lastMap !== p.map) {
      this.camera = { x: cx, y: cy };
      this.lastMap = p.map;
      this.destination = null;
    } else {
      const t = 1 - Math.exp(-Math.min(dt, 0.1) * 7);
      this.camera.x += (cx - this.camera.x) * t;
      this.camera.y += (cy - this.camera.y) * t;
    }
    const zero = this.worldToScreen(0, 0);
    c.fillStyle = "#203c2f";
    c.fillRect(0, 0, w, h);
    this.drawTerrain(nav, zero);
    for (const prop of nav.props.filter((o) => o.walkThrough)) {
      const s = this.worldToScreen(prop.x, prop.y);
      this.cell(
        "world/props",
        4,
        4,
        prop.index % 4,
        Math.floor(prop.index / 4),
        s.x,
        s.y,
        512,
        512,
        1 - 2 / 256,
      );
    }
    this.hitboxes = [];
    for (const port of PORTALS(p.map)) {
      const s = this.worldToScreen(port.x, port.y);
      this.fx(
        8,
        this.effectFrame(time, 1.2, true),
        s.x,
        s.y + 12,
        100,
        95,
        0.85,
      );
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
    if (this.destination && time - this.destination.at < 0.8) {
      const d = this.worldToScreen(this.destination.x, this.destination.y);
      this.fx(
        7,
        this.effectFrame(time - this.destination.at, 0.8),
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
        t = Math.min(1, (time - a.start) / (a.at - a.start));
      for (const zone of attackZones(a)) {
        const points = zoneOutline(zone);
        for (const [i, q] of points.entries()) {
          if (zone.radius < 3 && i % 2) continue;
          const mark = this.worldToScreen(q.x, q.y);
          this.fx(
            7,
            this.effectFrame(t, 1),
            mark.x,
            mark.y,
            32,
            32,
            0.22 + t * 0.3,
            "sepia(1) saturate(4) hue-rotate(315deg)",
          );
        }
        if (zone.style === "ring")
          for (const q of zoneOutline(zone, true).filter(
            (_, i) => i % 2 === 0,
          )) {
            const mark = this.worldToScreen(q.x, q.y);
            this.fx(7, 2, mark.x, mark.y, 32, 32, 0.4);
          }
      }
      const label = this.worldToScreen(m.x, m.y);
      this.text(a.name || "공격 준비", label.x, label.y - 105, "#ffe5c4", 11);
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
        this.effectFrame(time, 2 / 3, true),
        s.x,
        s.y + 8,
        (e.radius || 2) * 55,
        (e.radius || 2) * 45,
        Math.min(0.85, age),
      );
    }
    const objects = [
      ...nav.props
        .filter((o) => !o.walkThrough)
        .map((o) => ({ ...o, kind: "prop" })),
      ...(state.chests || []).map((o) => ({ ...o, kind: "chest" })),
      ...(state.discoveries || [])
        .filter((o) => o.visible && !o.discovered)
        .map((o) => ({ ...o, kind: "discovery" })),
      ...state.herbs.map((h) => ({ ...h, kind: "herb" })),
      ...state.drops
        .filter((d) => !d.pickupEnds)
        .map((d) => ({ ...d, lootKind: d.kind, kind: "drop" })),
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
      const margin = o.kind === "prop" ? 450 : 200;
      if (
        s.x < -margin ||
        s.x > w + margin ||
        s.y < -margin ||
        s.y > h + margin
      )
        continue;
      if (o.kind === "prop") {
        this.cell(
          "world/props",
          4,
          4,
          o.index % 4,
          Math.floor(o.index / 4),
          s.x,
          s.y,
          512,
          512,
          1 - 2 / 256,
        );
        continue;
      }
      if (o.kind === "chest") {
        c.save();
        c.globalAlpha = o.opened ? 0.35 : 1;
        this.icon(56, s.x, s.y - 10, 32);
        c.restore();
        if (!o.opened)
          this.fx(
            6,
            this.effectFrame(time, 4 / 3, true),
            s.x,
            s.y - 10,
            32,
            32,
            0.65,
          );
        this.text(
          o.opened
            ? "열어 본 보물함"
            : o.locked
              ? "잠긴 보물함"
              : "숨은 보물함",
          s.x,
          s.y - 42,
          o.locked ? "#d7cabb" : "#fff1ba",
          10,
        );
        if (!o.opened)
          this.hitboxes.push({
            kind: "chest",
            id: o.id,
            x: s.x,
            y: s.y - 10,
            r: 23,
          });
        continue;
      }
      if (o.kind === "discovery") {
        this.icon(60, s.x, s.y - 12, 32);
        this.fx(
          6,
          this.effectFrame(time, 1.6, true),
          s.x,
          s.y - 12,
          32,
          32,
          0.5,
        );
        this.text("길가의 흔적", s.x, s.y - 38, "#e9edbb", 10);
        this.hitboxes.push({
          kind: "discovery",
          id: o.id,
          x: s.x,
          y: s.y - 12,
          r: 21,
        });
        continue;
      }
      if (o.kind === "herb") {
        if (o.patch === 0 && Math.hypot(p.x - o.x, p.y - o.y) < 14)
          this.text(o.siteName, s.x, s.y - 38, "#d9f4ba", 10);
        c.save();
        c.globalAlpha = o.ready ? 1 : 0.3;
        this.item(o.item, s.x, s.y - 12, 34);
        c.restore();
        if (o.ready)
          this.fx(
            6,
            this.effectFrame(time, 4 / 3, true),
            s.x,
            s.y,
            32,
            32,
            0.55,
          );
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
        this.lootIcon(
          { ...o, kind: o.lootKind, spinTime: time },
          s.x,
          s.y - 12,
        );
        this.hitboxes.push({
          kind: "drop",
          id: o.id,
          x: s.x,
          y: s.y - 12,
          r: 19,
        });
        this.text(
          o.lootKind === "currency" ? `${o.count} 리프` : `×${o.count}`,
          s.x,
          s.y + 12,
          o.lootKind === "currency" ? "#ffe6a1" : "#f8f5d8",
          10,
        );
        continue;
      }

      const monster = o.kind === "monster",
        def = monster ? MONSTERS.find((m) => m.id === o.def) : null,
        boss = def?.type === "boss",
        height = (monster ? def.spriteSize * 2 : 96) * this.zoom;
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
          ) *
          22 *
          this.zoom
        : 0;
      this.sprite(
        name,
        s.x,
        s.y - jump,
        o.anim || "idle",
        o.kind === "npc"
          ? Math.hypot(p.x - o.x, p.y - o.y) < 6
            ? direction(p.x - o.x, p.y - o.y)
            : SOUTH
          : (o.dir ?? SOUTH),
        time,
        o.animAt || 0,
        height,
        o.animDuration,
      );
      if (monster && o.hitUntil > time)
        this.fx(6, 1, s.x, s.y - height * 0.4, 32, 32, 0.45);
      if (monster && o.ai === "return")
        this.text("귀환 중", s.x, s.y - height - 18, "#cbd8d9", 9);
      if (monster && o.toxinStacks && o.dotUntil > time)
        this.text("독 " + o.toxinStacks + "겹", s.x, s.y + 18, "#dab6ef", 9);
      if (o.kind === "player" && o.shield > 0)
        this.fx(5, 3, s.x, s.y + 12, 105, 110, 0.65);
      if (monster && o.hp > 0) {
        this.hitboxes.push({
          kind: "monster",
          id: o.uid,
          x: s.x,
          y: s.y - height * 0.4,
          r: Math.max(14, (def.spriteSize - 4) * this.zoom),
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
        this.text(o.name, s.x, s.y - height - 5, "#fff1c0", 11);
        this.text(o.role, s.x, s.y - height - 18, "#def0cb", 9);
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
    for (const drop of state.drops.filter((d) => d.pickupEnds)) {
      const t = Math.max(
          0,
          Math.min(
            1,
            (time - drop.pickupAt) / (drop.pickupEnds - drop.pickupAt),
          ),
        ),
        ease = 1 - (1 - t) ** 3,
        start = this.worldToScreen(drop.x, drop.y),
        end = this.worldToScreen(p.x, p.y),
        x = start.x + (end.x - start.x) * ease,
        y =
          start.y -
          12 +
          (end.y - 40 - start.y) * ease -
          Math.sin(t * Math.PI) * 72;
      if (t < 0.8) this.fx(6, this.effectFrame(t, 0.8), x, y, 32, 32, 0.45);
      this.lootIcon({ ...drop, spinTime: time }, x, y, t * Math.PI * 4);
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
          this.effectFrame(time, 0.5, true),
          (s.x + end.x) / 2,
          (s.y + end.y) / 2 - 35,
          Math.max(50, Math.hypot(dx, dy) / this.zoom),
          e.kind === "beam" ? 54 : 28,
          0.9,
          null,
          Math.atan2(dy, dx),
        );
      }
      if (
        [
          "hit",
          "burst",
          "heal",
          "level",
          "enemy",
          "treasure",
          "discovery",
          "phase",
          "evade",
        ].includes(e.kind)
      )
        this.fx(
          e.kind === "heal"
            ? 2
            : ["level", "discovery", "treasure", "phase"].includes(e.kind)
              ? 6
              : e.kind === "burst"
                ? 1
                : 0,
          this.effectFrame(
            time - (e.started ?? e.until - 0.75),
            e.until - (e.started ?? e.until - 0.75),
          ),
          s.x,
          s.y - 25,
          e.kind === "level" ? 130 : 75,
          80,
          0.85,
        );
    }
    this.drawMinimap(state);
    this.present();
  }
  drawTerrain(nav, zero) {
    const terrain = ART.world.tiles[nav.id],
      image = IMAGES.get(terrain.file),
      nativeTile = terrain.size,
      c = this.ctx;
    const left =
      (this.camera.x - this.size.width / (2 * this.zoom) + nav.width) / 2;
    const top = (this.camera.y - (this.size.height * 0.53) / this.zoom) / 2;
    const right = left + this.size.width / (2 * this.zoom),
      bottom = top + this.size.height / (2 * this.zoom);
    const snap = (v) => Math.round(v * this.dpr) / this.dpr;
    for (
      let r = Math.max(0, Math.floor(top / TILE + 0.5));
      r <= Math.min(nav.rows, Math.ceil(bottom / TILE + 0.5));
      r++
    )
      for (
        let col = Math.max(0, Math.floor(left / TILE + 0.5));
        col <= Math.min(nav.cols, Math.ceil(right / TILE + 0.5));
        col++
      ) {
        const tile = nav.transitions[r][col],
          x0 = snap(
            zero.x + ((col - 0.5) * TILE - nav.width / 2) * 2 * this.zoom,
          ),
          y0 = snap(zero.y + (r - 0.5) * TILE * 2 * this.zoom),
          x1 = snap(
            zero.x + ((col + 0.5) * TILE - nav.width / 2) * 2 * this.zoom,
          ),
          y1 = snap(zero.y + (r + 0.5) * TILE * 2 * this.zoom);
        c.drawImage(
          image,
          (tile % 4) * nativeTile,
          Math.floor(tile / 4) * nativeTile,
          nativeTile,
          nativeTile,
          x0,
          y0,
          x1 - x0,
          y1 - y0,
        );
      }
  }

  drawMinimap(state) {
    const c = this.minimap.getContext("2d"),
      w = this.minimap.width,
      h = this.minimap.height;
    const nav = NAVIGATION[state.player.map];
    c.clearRect(0, 0, w, h);
    c.imageSmoothingEnabled = false;
    c.fillStyle = "#1e3d35";
    c.fillRect(0, 0, w, h);
    const scale = Math.min(w / nav.width, h / nav.height),
      mw = nav.width * scale,
      mh = nav.height * scale,
      ox = (w - mw) / 2,
      oy = (h - mh) / 2;
    let terrain = this.minimapCache.get(nav.id);
    if (!terrain) {
      terrain = document.createElement("canvas");
      terrain.width = w;
      terrain.height = h;
      const tc = terrain.getContext("2d");
      tc.imageSmoothingEnabled = false;
      const tileLayout = ART.world.tiles[nav.id],
        atlas = IMAGES.get(tileLayout.file),
        nativeTile = tileLayout.size;
      for (let r = 0; r <= nav.rows; r++)
        for (let col = 0; col <= nav.cols; col++) {
          const tile = nav.transitions[r][col],
            x = (col - 0.5) * TILE * scale,
            y = (r - 0.5) * TILE * scale;
          tc.drawImage(
            atlas,
            (tile % 4) * nativeTile,
            Math.floor(tile / 4) * nativeTile,
            nativeTile,
            nativeTile,
            ox + x,
            oy + y,
            TILE * scale + 0.5,
            TILE * scale + 0.5,
          );
        }
      this.minimapCache.set(nav.id, terrain);
    }
    c.drawImage(terrain, 0, 0);
    c.strokeStyle = "#fff0af";
    c.lineWidth = 1.5;
    c.strokeRect(
      ox +
        ((this.camera.x - this.size.width / (2 * this.zoom) + nav.width) / 2) *
          scale,
      oy +
        ((this.camera.y - (this.size.height * 0.53) / this.zoom) / 2) * scale,
      (this.size.width / (2 * this.zoom)) * scale,
      (this.size.height / (2 * this.zoom)) * scale,
    );
    const icons = IMAGES.get("items");
    const mark = (x, y, index, size) => {
      const pos = worldToImage(x, y, state.player.map);
      c.drawImage(
        icons,
        (index % 8) * ART.iconLayout.size,
        Math.floor(index / 8) * ART.iconLayout.size,
        ART.iconLayout.size,
        ART.iconLayout.size,
        ox + pos.u * mw - size / 2,
        oy + pos.v * mh - size / 2,
        size,
        size,
      );
    };
    if (icons) {
      for (const npc of NPCS.filter((n) => n.map === state.player.map))
        mark(
          npc.x,
          npc.y,
          npc.kind === "craft" ? 12 : npc.kind === "alchemy" ? 9 : 63,
          8,
        );
      for (const port of PORTALS(state.player.map)) mark(port.x, port.y, 62, 7);
      for (const d of state.discoveries || [])
        if (d.discovered) mark(d.x, d.y, 60, 7);
      for (const chest of state.chests || [])
        if (!chest.opened) mark(chest.x, chest.y, 56, 9);
      mark(state.player.x, state.player.y, 0, 10);
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
