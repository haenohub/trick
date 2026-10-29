import { floorTileCode } from "./isometric-layouts.js";
import { animationFrame, LocomotionClocks } from "./animation.js";
import { drawPaperDoll, heldWeaponTip } from "./avatar-draw.js";
import {
  equippedAppearance,
  orderedEquipmentLayers,
} from "./equipment-appearance.js";
import {
  project,
  unproject,
  viewAnchor,
  fitProjected,
} from "./view-projection.js";
export { project } from "./view-projection.js";
import { attackZones, zoneOutline } from "./combat.js";
import { MAPS, MONSTERS, NPCS, CLASSES, PORTALS, ITEMS } from "./data.js";
import { imageToWorld, worldToImage } from "./art-layout.js";
import { direction, SOUTH } from "./directions.js";
import { NAVIGATION, TILE, WORLD_ZOOM, isWalkable } from "./world-layout.js";
const IMAGES = new Map();
const REQUESTS = new Map();
const PREVIEWS = new WeakMap();
let ART = null;
const REVISION =
  document.querySelector('meta[name="leaftale-revision"]')?.content || "local";
function load(file) {
  if (IMAGES.has(file)) return Promise.resolve();
  if (REQUESTS.has(file)) return REQUESTS.get(file);
  const request = new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      IMAGES.set(file, image);
      resolve();
    };
    image.onerror = () => {
      REQUESTS.delete(file);
      reject(new Error(`필수 아트를 불러오지 못했습니다: ${file}`));
    };
    image.src = `./assets/${file}.png?v=${REVISION}`;
  });
  REQUESTS.set(file, request);
  return request;
}
const WORLD_FAILURES = new Map();
const WORLD_CACHE = new Map();
let activeWorld = "village";
export function worldArtReady(id) {
  activeWorld = id;
  const scene = ART?.world?.isometric?.maps?.[id];
  return (
    !scene || [scene.floor.file, scene.props.file].every((f) => IMAGES.has(f))
  );
}
export async function prepareWorldArt(id) {
  const scene = ART?.world?.isometric?.maps?.[id];
  if (!scene) return;
  const failed = WORLD_FAILURES.get(id);
  if (failed && Date.now() < failed.retryAt) throw failed.error;
  try {
    await Promise.all([load(scene.floor.file), load(scene.props.file)]);
    WORLD_FAILURES.delete(id);
  } catch (error) {
    WORLD_FAILURES.set(id, { retryAt: Date.now() + 2000, error });
    throw error;
  }
  WORLD_CACHE.delete(id);
  WORLD_CACHE.set(id, scene);
  while (WORLD_CACHE.size > 3) {
    const old = [...WORLD_CACHE.keys()].find((k) => k !== activeWorld);
    if (!old) break;
    const a = WORLD_CACHE.get(old);
    WORLD_CACHE.delete(old);
    for (const f of [a.floor.file, a.props.file]) {
      IMAGES.delete(f);
      REQUESTS.delete(f);
    }
  }
}
export async function loadArt(progress = () => {}) {
  const response = await fetch("./assets/manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Art manifest unavailable");
  ART = await response.json();
  let done = 0;
  const legacyWorld = new Set(
    Object.values(ART.world.tiles)
      .map((t) => t.file)
      .concat("world/props"),
  );
  const nativeWorldComplete =
    Object.keys(ART.world.isometric?.maps || {}).length === 10;
  const initial = ART.files.filter(
    (file) =>
      !file.startsWith("appearance/") &&
      !file.startsWith("world/iso-") &&
      !(nativeWorldComplete && legacyWorld.has(file)),
  );
  await Promise.all(
    initial.map(async (file) => {
      await load(file);
      progress(++done / initial.length);
    }),
  );
  let savedMap = "village";
  try {
    savedMap =
      JSON.parse(localStorage.getItem("leaftale:save:v1"))?.map || "village";
  } catch {}
  activeWorld = Object.hasOwn(ART.world?.isometric?.maps || {}, savedMap)
    ? savedMap
    : "village";
  await Promise.all(
    [...new Set(["village", activeWorld])].map(prepareWorldArt),
  );
  for (const portal of PORTALS(activeWorld))
    prepareWorldArt(portal.to).catch(() => {});
}
export async function prepareEquipmentArt(classId, equipment) {
  const appearance = equippedAppearance(ART, classId, equipment);
  if (!appearance) return null;
  await Promise.all(appearance.layers.map((layer) => load(layer.file)));
  return appearance;
}
function readyAppearance(classId, equipment) {
  const appearance = equippedAppearance(ART, classId, equipment);
  if (!appearance) return null;
  if (appearance.layers.every((layer) => IMAGES.has(layer.file)))
    return appearance;
  prepareEquipmentArt(classId, equipment).catch(() => {});
  return null;
}
// Native assets use equal, integer pixel cells.
function sourceRect(file, cols, rows, col, row) {
  const image = IMAGES.get(file),
    sw = Math.floor(image.width / cols),
    sh = Math.floor(image.height / rows);
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
export function drawCharacterPreview(
  canvas,
  id,
  face = false,
  equipment = null,
) {
  const signature = id + ":" + JSON.stringify(equipment);
  PREVIEWS.set(canvas, signature);
  const appearance = equipment ? readyAppearance(id, equipment) : null;
  if (equipment && !appearance && equippedAppearance(ART, id, equipment))
    prepareEquipmentArt(id, equipment)
      .then(() => {
        if (PREVIEWS.get(canvas) === signature)
          drawCharacterPreview(canvas, id, face, equipment);
      })
      .catch(() => {});
  if (appearance) {
    const l = appearance.layout,
      c = canvas.getContext("2d"),
      frame = l.animations.idle[0];
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.imageSmoothingEnabled = false;
    const avatar = document.createElement("canvas");
    avatar.width = avatar.height = 96;
    const context = avatar.getContext("2d");
    context.imageSmoothingEnabled = false;
    drawPaperDoll(context, appearance, IMAGES, frame, SOUTH, 0, 0, 1);
    const sy = face ? 28.8 : 0,
      sh = face ? 57.6 : 96,
      scale = Math.min(canvas.width / 96, canvas.height / sh);
    c.drawImage(
      avatar,
      0,
      sy,
      96,
      sh,
      (canvas.width - 96 * scale) / 2,
      canvas.height - sh * scale,
      96 * scale,
      sh * scale,
    );
    return;
  }
  const l = ART.characterLayouts[id];
  preview(canvas, "characters/" + id, l.cols, l.rows, 0, SOUTH, face);
}
export function drawMonsterPreview(canvas, id) {
  const m = ART.monsters[id];
  canvas.width = canvas.height = m.size * ART.pixelScale;
  canvas.style.width = canvas.style.height = canvas.width + "px";
  preview(canvas, m.file, m.cols, m.rows, 0, 5);
}
export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.scene = document.createElement("canvas");
    this.ctx = this.scene.getContext("2d", { alpha: false });
    this.display = canvas.getContext("2d", { alpha: false });
    this.labels = [];
    this.locomotion = new LocomotionClocks();
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
    const anchor = viewAnchor(this.size.width, this.size.height, this.zoom);
    return {
      x: (s.x - this.camera.x) * this.zoom + anchor.x + (this.shake?.x || 0),
      y: (s.y - this.camera.y) * this.zoom + anchor.y + (this.shake?.y || 0),
    };
  }
  screenToWorld(x, y) {
    const anchor = viewAnchor(this.size.width, this.size.height, this.zoom);
    const xx =
        (x - (this.shake?.x || 0) - anchor.x) / this.zoom + this.camera.x,
      yy = (y - (this.shake?.y || 0) - anchor.y) / this.zoom + this.camera.y;
    return unproject(xx, yy);
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
    if (!image || col < 0 || col >= cols || row < 0 || row >= rows) return;
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
  sprite(
    name,
    x,
    y,
    anim,
    dir,
    time,
    start,
    height = 96,
    duration = null,
    actorKey = name,
    equipment = null,
    combatReady = false,
    skyshot = false,
  ) {
    const originalLayout = /^m\d+$/.test(name)
      ? ART.monsters[name]
      : name.startsWith("npc:")
        ? ART.npcLayouts[name.slice(4)]
        : ART.characterLayouts[name];
    if (!originalLayout) return;
    const appearance = readyAppearance(name, equipment);
    const layout = appearance?.layout || originalLayout;
    const clip = layout.clips?.[anim];
    const file = clip?.file || layout.file || "characters/" + name,
      age = Math.max(0, time - start),
      c = this.ctx;
    const loopStart = this.locomotion.start(actorKey, anim, time);
    if (anim === "death") {
      c.save();
      c.globalAlpha = Math.max(0, 1 - age / 0.85);
    }
    const frame =
      combatReady && anim === "idle"
        ? 6
        : animationFrame(
            layout,
            anim,
            time,
            ["idle", "walk"].includes(anim) ? loopStart : start,
            duration,
          );
    if (appearance && layout.anchors) {
      const anchor = 1 - 2 / (layout.size / (ART.resolutionScale || 1));
      drawPaperDoll(
        c,
        appearance,
        IMAGES,
        frame,
        dir,
        x - 48 * this.zoom,
        y - 96 * anchor * this.zoom,
        this.zoom,
        { anim, time, start, duration: duration || 0.2, combatReady, skyshot },
      );
      if (anim === "death") c.restore();
      return;
    }
    const layers = appearance
      ? orderedEquipmentLayers(appearance, dir)
      : [{ file }];
    for (const layer of layers)
      this.cell(
        layer.file,
        clip?.cols || layout.cols,
        clip?.rows || layout.rows,
        frame,
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
    const desired = project(p.x, p.y);
    if (this.lastMap !== p.map) {
      this.lastMap = p.map;
      this.destination = null;
    }
    // Movement already advances every animation frame. Follow that exact
    // position, so the hero never drifts off center or hits a camera edge stop.
    this.camera = desired;
    c.fillStyle = "#203c2f";
    c.fillRect(0, 0, w, h);
    if (!worldArtReady(p.map)) {
      this.camera = project(p.x, p.y);
      this.hitboxes = [];
      prepareWorldArt(p.map).catch((e) => {
        this.worldLoadError =
          "지역 풍경을 불러오지 못했습니다. 다시 연결하고 있습니다…";
      });
      this.text(
        this.worldLoadError || "새로운 길을 여는 중…",
        w / 2,
        h / 2,
        "#f4e9c6",
        18,
      );
      return;
    }
    this.worldLoadError = null;
    this.drawTerrain(nav);
    this.drawAimPreview();
    for (const prop of nav.props.filter((o) => o.walkThrough)) {
      const s = this.worldToScreen(prop.x, prop.y);
      this.cell(
        ART.world.isometric?.maps?.[nav.id]?.props.file || "world/props",
        4,
        4,
        prop.index % 4,
        Math.floor(prop.index / 4),
        s.x,
        s.y,
        prop.size || 384,
        prop.size || 384,
        ART.world.isometric?.maps?.[nav.id]?.props.anchors?.[prop.index] ??
          prop.anchor ??
          1 - 8 / 384,
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
    ].sort((a, b) => project(a.x, a.y).y - project(b.x, b.y).y);
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
        const hero = this.worldToScreen(p.x, p.y);
        c.save();
        if (
          s.y >= hero.y &&
          s.y - hero.y < (o.size || 384) * 0.9 * this.zoom &&
          Math.abs(s.x - hero.x) < (o.size || 384) * 0.45 * this.zoom
        )
          c.globalAlpha = 0.38;
        this.cell(
          ART.world.isometric?.maps?.[nav.id]?.props.file || "world/props",
          4,
          4,
          o.index % 4,
          Math.floor(o.index / 4),
          s.x,
          s.y,
          o.size || 384,
          o.size || 384,
          ART.world.isometric?.maps?.[nav.id]?.props.anchors?.[o.index] ??
            o.anchor ??
            1 - 8 / 384,
        );
        c.restore();
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
      const recoil =
        monster &&
        o.hitUntil > time &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches;
      const hitAge = recoil ? time - (o.hitAt ?? o.animAt) : 1;
      if (recoil) {
        const v = project(o.hitDx || 0, o.hitDy || 0),
          n = Math.hypot(v.x, v.y) || 1;
        const k =
          Math.max(0, Math.sin(Math.min(1, hitAge / 0.12) * Math.PI)) *
          3 *
          this.zoom;
        s.x += (v.x / n) * k;
        s.y += (v.y / n) * k;
      }
      const leap = o.action?.leap;
      const jump = leap
        ? Math.sin(
            Math.PI *
              Math.max(
                0,
                Math.min(1, (time - leap.start) / (leap.landAt - leap.start)),
              ),
          ) *
          76 *
          this.zoom
        : o.windup?.jump
          ? Math.sin(
              Math.min(
                1,
                (time - o.windup.start) / (o.windup.at - o.windup.start),
              ) * Math.PI,
            ) *
            22 *
            this.zoom
          : 0;
      c.save();
      if (recoil && hitAge < 2 / 30) c.filter = "brightness(1.55)";
      this.sprite(
        name,
        s.x,
        s.y - jump,
        recoil && o.hp > 0 ? "hurt" : o.anim || "idle",
        o.kind === "npc"
          ? Math.hypot(p.x - o.x, p.y - o.y) < 6
            ? direction(p.x - o.x, p.y - o.y)
            : SOUTH
          : (o.dir ?? SOUTH),
        time,
        o.animAt || 0,
        height,
        o.animDuration,
        o.kind + ":" + (o.uid || o.id || name),
        o.equipment,
        !!o.combatTarget && !o.queuedSkill,
        o.classId === "ranger" &&
          o.action?.kind === "skill" &&
          o.action.slot === 1,
      );
      c.restore();
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
      } else if (o.kind !== "monster") {
        this.text(
          o.name,
          s.x,
          s.y - height - 6,
          o.kind === "player" ? "#fff4d3" : "#d6eed8",
          11,
        );
        if (o.kind === "player") {
          const width = 44,
            left = Math.round(s.x - width / 2),
            top = Math.round(s.y + 7);
          c.fillStyle = "#182030";
          c.fillRect(left - 1, top - 1, width + 2, 10);
          c.fillStyle = "#e87c87";
          c.fillRect(left, top, (width * p.hp) / p.stats.maxHp, 3);
          c.fillStyle = "#7dbbe8";
          c.fillRect(left, top + 5, (width * p.focus) / 100, 2);
        }
      }
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
      if (["arrow-rain", "leaf-landing"].includes(e.kind))
        this.classSkillEffect(e, state);
      if (["arrow-shot", "starfall", "herb-shot"].includes(e.kind))
        this.targetedCombatEffect(e, state);
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
    this.drawAmbience(state, map);
    this.drawMinimap(state);
    this.present();
  }
  drawAimPreview() {
    const a = this.aim;
    if (!a) return;
    const c = this.ctx,
      point = a.mode === "self" ? a.origin : a.point;
    const valid =
      a.mode === "self" ||
      (Math.hypot(point.x - a.origin.x, point.y - a.origin.y) <= a.range &&
        (a.mode !== "ground" || isWalkable(a.origin.map, point.x, point.y)));
    const approaching =
      !valid &&
      a.mode === "ground" &&
      isWalkable(a.origin.map, point.x, point.y);
    const path = (zone, fill = false) => {
      const points = zoneOutline(zone).map((p) => this.worldToScreen(p.x, p.y));
      c.beginPath();
      points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.closePath();
      if (fill) c.fill();
      c.stroke();
    };
    c.save();
    c.strokeStyle = valid ? "#b3f4cf" : approaching ? "#f4d28d" : "#fa8e83";
    c.lineWidth = 1.5;
    c.fillStyle = valid ? "#7edaaa2e" : approaching ? "#e9b55c2e" : "#ef60452e";
    if (a.queued) c.setLineDash([5, 4]);
    if (a.range > 0) {
      c.globalAlpha = 0.45;
      path({ ...a.origin, radius: a.range });
      c.globalAlpha = 1;
    }
    if (a.shape === "line") {
      const n = Math.hypot(point.x - a.origin.x, point.y - a.origin.y) || 1,
        k = (a.length || n) / n;
      path(
        {
          style: "line",
          ...a.origin,
          tx: a.origin.x + (point.x - a.origin.x) * k,
          ty: a.origin.y + (point.y - a.origin.y) * k,
          width: a.radius,
        },
        true,
      );
    } else path({ ...point, radius: a.radius || 0.45 }, true);
    c.restore();
  }
  classSkillEffect(e, state) {
    const a = ART.skillMotion,
      image = a && IMAGES.get(a.file);
    if (!image) return;
    const c = this.ctx,
      z = this.zoom,
      age = state.time - e.started,
      origin = this.worldToScreen(e.x, e.y),
      end = this.worldToScreen(e.tx ?? e.x, e.ty ?? e.y);
    const cell = (row, t, x, y, w, h) => {
      c.drawImage(
        image,
        Math.min(7, Math.max(0, Math.floor(t * 8))) * 128,
        row * 128,
        128,
        128,
        Math.round(x - (w * z) / 2),
        Math.round(y - (h * z) / 2),
        w * z,
        h * z,
      );
    };
    if (e.kind === "leaf-landing") {
      cell(3, age / 0.55, end.x, end.y - 15 * z, 220, 130);
      return;
    }
    const actor =
        e.owner === state.player.id
          ? state.player
          : state.peers.find((p) => p.id === e.owner),
      base = ART.appearance?.bases?.[actor?.classId],
      weapon = ART.appearance?.weapons?.[actor?.equipment?.weapon];
    const hand =
      base && weapon
        ? heldWeaponTip(base, weapon, 4, e.dir || 0, { skyshot: true })
        : null;
    const launch = hand
      ? { x: origin.x + (hand[0] - 48) * z, y: origin.y - (92 - hand[1]) * z }
      : origin;
    if (age < 0.38)
      cell(0, age / 0.38, launch.x, launch.y - 50 * z - age * 220 * z, 80, 130);
    if (age >= 0.32 && age < 1.05)
      cell(1, (age - 0.32) / 0.73, end.x, end.y - 100 * z, 240, 230);
    if (age >= 0.55)
      cell(2, (age - 0.55) / 0.6, end.x, end.y - 12 * z, 230, 125);
  }
  targetedCombatEffect(e, state) {
    const file = ART.targetCombat?.file,
      image = file && IMAGES.get(file);
    if (!image) return;
    const age = state.time - e.started,
      travel = e.hitAt - e.started,
      origin = this.worldToScreen(e.x, e.y),
      end = this.worldToScreen(e.tx, e.ty),
      z = this.zoom,
      c = this.ctx;
    const actor =
        e.owner === state.player.id
          ? state.player
          : state.peers.find((p) => p.id === e.owner),
      base = ART.appearance?.bases?.[actor?.classId],
      weapon = ART.appearance?.weapons?.[actor?.equipment?.weapon],
      hand = base && weapon ? heldWeaponTip(base, weapon, 4, e.dir || 0) : null;
    const start = {
        x: origin.x + (hand ? hand[0] - 48 : 0) * z,
        y: origin.y - (hand ? 92 - hand[1] : 42) * z,
      },
      dest = { x: end.x, y: end.y - 28 * z };
    const cell = (row, frame, x, y, w, h, angle = 0, alpha = 1) => {
      c.save();
      c.globalAlpha = alpha;
      c.translate(Math.round(x), Math.round(y));
      c.rotate(angle);
      c.drawImage(
        image,
        Math.min(7, Math.max(0, frame)) * 96,
        row * 96,
        96,
        96,
        (-w * z) / 2,
        (-h * z) / 2,
        w * z,
        h * z,
      );
      c.restore();
    };
    if (e.kind === "herb-shot") {
      if (age >= travel) return;
      const t = Math.max(0, Math.min(1, age / travel));
      for (const [delay, alpha, size] of [
        [0.12, 0.2, 15],
        [0.06, 0.4, 20],
        [0, 1, 28],
      ]) {
        const k = Math.max(0, t - delay);
        this.fx(
          3,
          this.effectFrame(age, 0.22),
          start.x + (dest.x - start.x) * k,
          start.y + (dest.y - start.y) * k,
          size,
          size,
          alpha,
        );
      }
    } else if (e.kind === "arrow-shot") {
      const t = Math.min(1, age / travel),
        angle = Math.atan2(dest.y - start.y, dest.x - start.x),
        landed = age >= travel,
        tipX = dest.x - Math.cos(angle) * 22 * z,
        tipY = dest.y - Math.sin(angle) * 22 * z;
      if (landed && e.landed === false) return;
      cell(
        0,
        Math.floor((landed ? (age - travel) / 0.2 : t) * 8),
        start.x + (tipX - start.x) * t,
        start.y + (tipY - start.y) * t,
        56,
        40,
        angle,
        landed ? Math.max(0, 1 - (age - travel) / 0.2) : 1,
      );
    } else {
      if (age < 0.28)
        cell(
          2,
          Math.floor(Math.min(1, age / 0.22) * 7),
          start.x,
          start.y - Math.min(1, age / 0.22) * 100 * z,
          36,
          52,
          0,
          age > 0.22 ? 0.5 : 1,
        );
      if (age >= 0.28) {
        c.save();
        if (age < travel) {
          c.beginPath();
          c.rect(
            dest.x - 40 * z,
            dest.y - 101 * z,
            80 * z,
            112 * z * Math.min(1, (age - 0.28) / 0.2),
          );
          c.clip();
        }
        cell(
          3,
          Math.floor(((age - 0.28) / 0.4) * 8),
          dest.x,
          dest.y - 45 * z,
          54,
          112,
        );
        c.restore();
      }
    }
  }
  drawAmbience(state, map) {
    if (!ART.ambient || matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const p = state.player,
      t = state.time,
      row = map.region === 0 ? (state.ambience?.active ? 3 : 0) : 1;
    const cx = Math.floor(p.x / 6),
      cy = Math.floor(p.y / 6);
    for (let iy = cy - 5; iy <= cy + 5; iy++)
      for (let ix = cx - 5; ix <= cx + 5; ix++) {
        const seed = Math.abs((ix * 73856093) ^ (iy * 19349663));
        if (seed % 4) continue;
        const x = ix * 6 + (seed % 41) / 10,
          y = iy * 6 + ((seed >> 5) % 41) / 10,
          s = this.worldToScreen(x, y);
        if (
          s.x < -40 ||
          s.y < -40 ||
          s.x > this.size.width + 40 ||
          s.y > this.size.height + 40
        )
          continue;
        if (
          map.region === 0
            ? !isWalkable(map.id, x, y)
            : isWalkable(map.id, x, y)
        )
          continue;
        const frame = Math.floor((t + (seed % 80) / 10) * 6) % 8,
          drift = Math.sin(t * 0.7 + seed) * 8;
        this.cell(
          ART.ambient.file,
          8,
          4,
          frame,
          row,
          s.x + drift,
          s.y - 12,
          32,
          32,
          0.55,
        );
        if (map.region === 0 && seed % 12 === 0)
          this.cell(
            ART.ambient.file,
            8,
            4,
            frame,
            2,
            s.x,
            s.y - 25,
            24,
            24,
            0.65,
          );
      }
  }
  drawTerrain(nav) {
    const scene = ART.world.isometric?.maps?.[nav.id];
    if (scene)
      return this.drawIsometricFloor(
        this.ctx,
        nav,
        scene.floor,
        (p) => this.worldToScreen(p.x, p.y),
        this.zoom,
      );
    return this.drawLegacyTerrain(nav);
  }
  drawIsometricFloor(c, nav, layout, point, scale, overview = false) {
    const image = IMAGES.get(layout.file);
    if (!image) return;
    let minC = 0,
      maxC = nav.cols,
      minR = 0,
      maxR = nav.rows;
    if (!overview) {
      const corners = [
        [0, 0],
        [this.size.width, 0],
        [this.size.width, this.size.height],
        [0, this.size.height],
      ]
        .map(([x, y]) => this.screenToWorld(x, y))
        .map((p) => worldToImage(p.x, p.y, nav.id));
      minC = Math.floor(Math.min(...corners.map((p) => p.u * nav.cols))) - 2;
      maxC = Math.ceil(Math.max(...corners.map((p) => p.u * nav.cols))) + 2;
      minR = Math.floor(Math.min(...corners.map((p) => p.v * nav.rows))) - 2;
      maxR = Math.ceil(Math.max(...corners.map((p) => p.v * nav.rows))) + 2;
    }
    for (let r = minR; r <= maxR; r++)
      for (let col = minC; col <= maxC; col++) {
        const tile = floorTileCode(nav, col, r);
        const p = point(imageToWorld(col / nav.cols, r / nav.rows, nav.id)),
          w = layout.width * scale,
          h = layout.height * scale;
        c.drawImage(
          image,
          (tile % 8) * layout.width,
          Math.floor(tile / 8) * layout.height,
          layout.width,
          layout.height,
          Math.round(p.x - w / 2),
          Math.round(p.y - h / 2),
          Math.ceil(w) + 1,
          Math.ceil(h) + 1,
        );
      }
  }
  drawLegacyTerrain(nav) {
    const terrain = ART.world.tiles[nav.id],
      image = IMAGES.get(terrain.file),
      c = this.ctx;
    const corners = [
      [0, 0],
      [this.size.width, 0],
      [this.size.width, this.size.height],
      [0, this.size.height],
    ]
      .map(([x, y]) => this.screenToWorld(x, y))
      .map((p) => worldToImage(p.x, p.y, nav.id));
    const minCol =
      Math.floor(Math.min(...corners.map((p) => p.u * nav.cols)) - 0.5) - 1;
    const maxCol =
      Math.ceil(Math.max(...corners.map((p) => p.u * nav.cols)) + 0.5) + 1;
    const minRow =
      Math.floor(Math.min(...corners.map((p) => p.v * nav.rows)) - 0.5) - 1;
    const maxRow =
      Math.ceil(Math.max(...corners.map((p) => p.v * nav.rows)) + 0.5) + 1;
    const anchor = viewAnchor(this.size.width, this.size.height, this.zoom);
    c.save();
    c.translate(
      anchor.x - this.camera.x * this.zoom + this.shake.x,
      anchor.y - this.camera.y * this.zoom + this.shake.y,
    );
    // Project only the floor. Upright sprites keep their approved native pixels.
    c.transform(this.zoom, this.zoom / 2, -this.zoom, this.zoom / 2, 0, 0);
    for (let row = minRow; row <= maxRow; row++)
      for (let col = minCol; col <= maxCol; col++) {
        // Continue the biome past collision bounds so a centered camera never
        // exposes an empty border when the hero approaches the edge of a map.
        const tile = nav.transitions[row]?.[col] ?? 0,
          size = terrain.size;
        c.drawImage(
          image,
          (tile % 4) * size,
          Math.floor(tile / 4) * size,
          size,
          size,
          (col - 0.5) * TILE * 2 - nav.width,
          (row - 0.5) * TILE * 2,
          TILE * 2 + 1,
          TILE * 2 + 1,
        );
      }
    c.restore();
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
    const frame = fitProjected(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ].map(([u, v]) => imageToWorld(u, v, nav.id)),
      w,
      h,
    );
    const { scale, offsetX, offsetY } = frame;
    const clipDiamond = (ctx) => {
      ctx.beginPath();
      frame.corners.forEach((p, i) => ctx[i ? "lineTo" : "moveTo"](p.x, p.y));
      ctx.closePath();
      ctx.clip();
    };
    const cacheKey = nav.id + ":" + w + "x" + h + ":quarter";
    let terrain = this.minimapCache.get(cacheKey);
    if (!terrain) {
      terrain = document.createElement("canvas");
      terrain.width = w;
      terrain.height = h;
      const tc = terrain.getContext("2d"),
        tileLayout = ART.world.tiles[nav.id],
        atlas = IMAGES.get(tileLayout.file),
        size = tileLayout.size;
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = "high";
      tc.save();
      clipDiamond(tc);
      const scene = ART.world.isometric?.maps?.[nav.id];
      if (scene)
        this.drawIsometricFloor(
          tc,
          nav,
          scene.floor,
          (p) => frame.point(p.x, p.y),
          scale,
          true,
        );
      else {
        tc.transform(scale, scale / 2, -scale, scale / 2, offsetX, offsetY);
        for (let row = 0; row <= nav.rows; row++)
          for (let col = 0; col <= nav.cols; col++) {
            const tile = nav.transitions[row][col];
            tc.drawImage(
              atlas,
              (tile % 4) * size,
              Math.floor(tile / 4) * size,
              size,
              size,
              (col - 0.5) * TILE * 2 - nav.width,
              (row - 0.5) * TILE * 2,
              TILE * 2 + 1,
              TILE * 2 + 1,
            );
          }
      }
      tc.restore();
      this.minimapCache.set(cacheKey, terrain);
    }
    c.drawImage(terrain, 0, 0);
    c.save();
    clipDiamond(c);
    c.strokeStyle = "#fff0af";
    c.lineWidth = 1.5;
    c.beginPath();
    [
      [0, 0],
      [this.size.width, 0],
      [this.size.width, this.size.height],
      [0, this.size.height],
    ]
      .map(([x, y]) => this.screenToWorld(x, y))
      .map((p) => frame.point(p.x, p.y))
      .forEach((p, i) => c[i ? "lineTo" : "moveTo"](p.x, p.y));
    c.closePath();
    c.stroke();
    c.restore();
    const icons = IMAGES.get("items");
    const mark = (x, y, index, size) => {
      const pos = frame.point(x, y);
      c.drawImage(
        icons,
        (index % 8) * ART.iconLayout.size,
        Math.floor(index / 8) * ART.iconLayout.size,
        ART.iconLayout.size,
        ART.iconLayout.size,
        pos.x - size / 2,
        pos.y - size / 2,
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
