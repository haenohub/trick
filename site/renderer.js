import { MAPS, MONSTERS, NPCS, CLASSES, PORTALS } from "./data.js";
import { decorations, hash, seeded } from "./core.js";
const IMAGES = new Map();
const ART_REVISION =
  document.querySelector('meta[name="leaftale-revision"]')?.content || "local";
const load = (name) =>
  new Promise((resolve) => {
    const i = new Image();
    i.onload = () => {
      IMAGES.set(name, i);
      resolve();
    };
    i.onerror = () => resolve();
    i.src = `./assets/${name}.png?v=${ART_REVISION}`;
  });
export async function loadArt(progress = () => {}) {
  const names = [
    ...MONSTERS.map((m) => m.id),
    ...CLASSES.map((c) => c.id),
    "items",
    ...["tree", "palm", "house", "bush", "rock", "crystal"].flatMap((k) =>
      [0, 1, 2].map((v) => k + v),
    ),
  ];
  let done = 0;
  await Promise.all(
    names.map(async (n) => {
      await load(n);
      progress(++done / names.length);
    }),
  );
}
export const project = (x, y) => ({ x: (x - y) * 32, y: (x + y) * 16 });
export class Renderer {
  constructor(canvas, minimap) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false });
    this.minimap = minimap;
    this.camera = { x: 0, y: 448 };
    this.mapCache = new Map();
    this.hitboxes = [];
    this.mouse = { x: 0, y: 0 };
    this.size = { width: 1000, height: 700 };
  }
  resize() {
    const r = this.canvas.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 2);
    if (
      this.canvas.width !== Math.round(r.width * dpr) ||
      this.canvas.height !== Math.round(r.height * dpr)
    ) {
      this.canvas.width = Math.round(r.width * dpr);
      this.canvas.height = Math.round(r.height * dpr);
    }
    this.dpr = dpr;
    this.size = { width: r.width, height: r.height };
  }
  worldToScreen(x, y) {
    const p = project(x, y);
    return {
      x: p.x - this.camera.x + this.size.width / 2,
      y: p.y - this.camera.y + this.size.height * 0.53,
    };
  }
  screenToWorld(x, y) {
    const xx = x + this.camera.x - this.size.width / 2,
      yy = y + this.camera.y - this.size.height * 0.53;
    return { x: xx / 64 + yy / 32, y: yy / 32 - xx / 64 };
  }
  ground(map) {
    if (this.mapCache.has(map.id)) return this.mapCache.get(map.id);
    const c = document.createElement("canvas");
    c.width = 2048;
    c.height = 1152;
    const d = c.getContext("2d");
    d.imageSmoothingEnabled = false;
    const rng = seeded(hash(map.id)),
      water = [],
      grass = map.region
        ? ["#849d76", "#8ba47e", "#819873"]
        : ["#739469", "#78996b", "#7e9f71"],
      sand = ["#c1b78c", "#c9bf97", "#c6bc91"];
    for (let x = 0; x < 30; x++)
      for (let y = 0; y < 30; y++) {
        const p = project(x, y);
        p.x += 1024;
        p.y += 96;
        const path =
          Math.abs(y - 14) < 1.1 ||
          Math.abs(x - 14) < 1.1 ||
          (map.town && Math.hypot(x - 14, y - 14) < 5.5);
        let wet =
          map.biome === "brook" &&
          Math.abs(x - y - 5 - Math.sin(y * 0.4) * 2) < 1.8;
        if (["beach", "coasttown", "saltforest"].includes(map.biome))
          wet = x > 23 + Math.sin(y * 0.4) * 1.2;
        if (map.biome === "marsh") wet = !path && (x + y) % 6 < 3;
        if (map.biome === "cave") wet = x > 22 || y > 25;
        let color = grass[Math.floor(rng() * 3)];
        if (
          map.region &&
          (["beach", "coasttown"].includes(map.biome) || x > 20)
        )
          color = sand[Math.floor(rng() * 3)];
        if (map.biome === "cave")
          color = ["#647c79", "#6c827e", "#708681"][Math.floor(rng() * 3)];
        if (map.biome === "deepforest")
          color = ["#64805d", "#6b8860", "#708c65"][Math.floor(rng() * 3)];
        if (wet)
          color = ["#6caaa9", "#75b3b0", "#7fbbb6"][Math.floor(rng() * 3)];
        if (path)
          color = wet
            ? "#b09970"
            : map.town
              ? "#b2b190"
              : ["#aaac80", "#b0b386", "#a7ab7c"][Math.floor(rng() * 3)];
        d.fillStyle = color;
        d.beginPath();
        d.moveTo(p.x, p.y - 16);
        d.lineTo(p.x + 32, p.y);
        d.lineTo(p.x, p.y + 16);
        d.lineTo(p.x - 32, p.y);
        d.closePath();
        d.fill();
        for (let n = 0; n < 3; n++) {
          const xx = p.x + (rng() - 0.5) * 35,
            yy = p.y + (rng() - 0.5) * 13;
          d.fillStyle = wet
            ? "#97ccc0"
            : path
              ? "#989d75"
              : rng() > 0.88
                ? "#e0dbad"
                : "#91ad79";
          d.fillRect(Math.round(xx), Math.round(yy), wet ? 8 : 2, wet ? 1 : 2);
          if (!path && !wet && rng() > 0.75) {
            d.fillStyle = "#587f54";
            d.fillRect(Math.round(xx), Math.round(yy) - 2, 1, 3);
          }
        }
        if (wet && !path) water.push({ x, y });
      }
    const value = { canvas: c, water };
    this.mapCache.set(map.id, value);
    return value;
  }
  text(text, x, y, color = "#f6f0d8", size = 12, align = "center") {
    const c = this.ctx;
    c.font = `${size <= 11 ? "500" : "600"} ${size}px system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = "middle";
    c.lineWidth = 3;
    c.strokeStyle = "#253c32dd";
    c.strokeText(text, Math.round(x), Math.round(y));
    c.fillStyle = color;
    c.fillText(text, Math.round(x), Math.round(y));
  }
  ellipse(x, y, rx, ry, fill, stroke = null) {
    const c = this.ctx;
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 2;
      c.stroke();
    }
  }
  sprite(name, x, y, anim = "idle", dir = 0, time = 0, start = 0, size = 80) {
    const image = IMAGES.get(name);
    if (!image) return;
    let frame = 0;
    if (anim === "walk") frame = 4 + (Math.floor(time * 10) % 6);
    else if (anim === "attack")
      frame = 10 + Math.min(5, Math.floor(Math.max(0, time - start) * 13));
    else if (anim === "hurt")
      frame = 16 + Math.min(1, Math.floor(Math.max(0, time - start) * 8));
    else if (anim === "death")
      frame = 18 + Math.min(5, Math.floor(Math.max(0, time - start) * 8));
    else frame = Math.floor(time * 4) % 4;
    this.ctx.drawImage(
      image,
      frame * 64,
      (dir || 0) * 64,
      64,
      64,
      Math.round(x - size / 2),
      Math.round(y - size * 0.87),
      size,
      size,
    );
  }
  render(state, target, dt = 1 / 60) {
    this.resize();
    const c = this.ctx,
      { width: w, height: h } = this.size;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.imageSmoothingEnabled = false;
    const map = MAPS.find((m) => m.id === state.player.map),
      p = state.player,
      cam = project(p.x, p.y),
      ground = this.ground(map),
      time = state.time;
    if (this.lastMap !== map.id) {
      this.camera = { ...cam };
      this.lastMap = map.id;
    } else {
      const t = 1 - Math.exp(-dt * 7);
      this.camera.x += (cam.x - this.camera.x) * t;
      this.camera.y += (cam.y - this.camera.y) * t;
    }
    c.fillStyle = map.region ? "#78948a" : "#526e52";
    c.fillRect(0, 0, w, h);
    const zero = this.worldToScreen(0, 0);
    c.drawImage(
      ground.canvas,
      Math.round(zero.x - 1024),
      Math.round(zero.y - 96),
    );
    for (let i = 0; i < ground.water.length; i += 3) {
      const a = ground.water[i],
        s = this.worldToScreen(a.x, a.y);
      c.fillStyle = "#c2e2d337";
      c.fillRect(s.x + Math.sin(time * 1.2 + i) * 8 - 8, s.y, 14, 1);
    }
    this.hitboxes = [];
    for (const portal of PORTALS(map.id)) {
      const s = this.worldToScreen(portal.x, portal.y);
      this.hitboxes.push({
        kind: "portal",
        id: portal.to,
        x: s.x,
        y: s.y - 22,
        r: 32,
      });
      this.ellipse(
        s.x,
        s.y,
        29 + Math.sin(time * 2) * 2,
        13,
        "#d6dca448",
        "#f4e1a38a",
      );
      this.text(
        portal.to === MAPS[MAPS.indexOf(map) + 1]?.id ? "↗" : "↙",
        s.x,
        s.y - 20,
        "#ffecb1",
        24,
      );
      this.text(portal.label, s.x, s.y - 46, "#fff1cc", 11);
      if (Math.hypot(p.x - portal.x, p.y - portal.y) < 2.5)
        this.text("[E] 이동", s.x, s.y + 22, "#fff4c8", 11);
    }
    for (const m of state.mobs) {
      if (!m.windup || m.hp <= 0) continue;
      const a = m.windup,
        s = this.worldToScreen(a.x, a.y),
        progress = Math.min(1, (time - a.start) / (a.at - a.start));
      if (a.style === "line") {
        const end = this.worldToScreen(a.tx, a.ty);
        c.strokeStyle = "#ad5b454d";
        c.lineWidth = 42;
        c.beginPath();
        c.moveTo(s.x, s.y);
        c.lineTo(end.x, end.y);
        c.stroke();
        c.strokeStyle = "#e9b18c";
        c.lineWidth = 2;
        c.stroke();
      } else {
        this.ellipse(
          s.x,
          s.y,
          a.radius * 32,
          a.radius * 16,
          "#bd654537",
          "#ecab7cbb",
        );
        this.ellipse(
          s.x,
          s.y,
          a.radius * 32 * progress,
          a.radius * 16 * progress,
          "#edb77b33",
        );
        if (a.style === "ring")
          this.ellipse(s.x, s.y, 40, 20, "#acd6a5bb", "#d0e6bc");
      }
    }
    for (const e of state.effects.filter((e) =>
      ["garden", "vine", "shield", "magic", "poison", "slash", "slow"].includes(
        e.kind,
      ),
    )) {
      const s = this.worldToScreen(e.x, e.y),
        r = (e.radius || 2) * 28;
      this.ellipse(
        s.x,
        s.y,
        r,
        r * 0.5,
        e.kind === "slow"
          ? "#d0e5cf4d"
          : e.kind === "poison"
            ? "#af9ac93d"
            : e.kind === "magic"
              ? "#d9bbdf44"
              : "#b2dca144",
        "#d4e4b78c",
      );
    }
    const objects = [];
    for (const d of decorations(map.id))
      objects.push({ ...d, scenery: d.kind, kind: "decor", depth: d.x + d.y });
    for (const herb of state.herbs)
      objects.push({ kind: "herb", ...herb, depth: herb.x + herb.y });
    for (const n of NPCS.filter((n) => n.map === map.id))
      objects.push({ ...n, npcKind: n.kind, kind: "npc", depth: n.x + n.y });
    for (const m of state.mobs)
      if (m.hp > 0 || time - m.animAt < 0.8)
        objects.push({ kind: "monster", ...m, depth: m.x + m.y });
    for (const drop of state.drops)
      objects.push({ kind: "drop", ...drop, depth: drop.x + drop.y });
    for (const peer of state.peers)
      objects.push({ kind: "peer", ...peer, depth: peer.x + peer.y });
    objects.push({ kind: "player", ...p, depth: p.x + p.y });
    objects.sort((a, b) => a.depth - b.depth);
    for (const o of objects) {
      const s = this.worldToScreen(o.x, o.y);
      if (s.x < -160 || s.x > w + 160 || s.y < -80 || s.y > h + 180) continue;
      if (o.kind === "decor") {
        const art = IMAGES.get((o.scenery || "tree") + (o.variant || 0));
        const playerScreen = this.worldToScreen(p.x, p.y),
          occlude =
            s.y > playerScreen.y &&
            s.y - playerScreen.y < 130 &&
            Math.abs(s.x - playerScreen.x) < 54;
        c.globalAlpha = occlude ? 0.4 : 1;
        if (art)
          c.drawImage(
            art,
            Math.round(s.x - 64),
            Math.round(s.y - 146),
            128,
            160,
          );
        c.globalAlpha = 1;
      } else if (o.kind === "herb") {
        const ready = o.ready;
        this.ellipse(s.x, s.y, 12, 5, "#3e69433a");
        c.globalAlpha = ready ? 1 : 0.35;
        c.fillStyle =
          o.item === "mint" || o.item === "breathgrass" ? "#8ed4c5" : "#a7c578";
        for (let k = 0; k < 4; k++) {
          c.fillRect(s.x - 7 + k * 4, s.y - 12 - (k % 2) * 5, 3, 12);
          c.fillStyle = k % 2 ? "#dce5aa" : "#8daf6b";
        }
        if (o.item === "saltflower") {
          c.fillStyle = "#f4cbcf";
          c.fillRect(s.x - 4, s.y - 19, 10, 5);
        }
        if (ready) {
          c.fillStyle = "#e7edb7";
          c.fillRect(
            s.x + Math.sin(time * 2 + o.x) * 5,
            s.y - 24 + Math.sin(time * 3) * 2,
            2,
            2,
          );
        }
        c.globalAlpha = 1;
        this.hitboxes.push({
          kind: "herb",
          id: o.id,
          x: s.x,
          y: s.y - 12,
          r: 20,
        });
      } else if (o.kind === "drop") {
        this.ellipse(s.x, s.y, 10, 4, "#e9cc7e45");
        c.fillStyle = "#f1d68b";
        c.fillRect(s.x - 3, s.y - 9 + Math.sin(time * 4) * 2, 6, 6);
      } else {
        const monster = o.kind === "monster",
          def = monster ? MONSTERS.find((m) => m.id === o.def) : null,
          boss = def?.type === "boss";
        let image = monster
          ? o.def
          : o.classId ||
            {
              quest: "warden",
              craft: "warden",
              alchemy: "herbalist",
              shop: "ranger",
              class: "mage",
            }[o.kind === "npc" ? o.kind : ""] ||
            "herbalist";
        if (o.kind === "npc")
          image = {
            guide: "ranger",
            smith: "warden",
            healer: "herbalist",
            merchant: "ranger",
            coastguide: "mage",
            coastsmith: "warden",
            coasthealer: "herbalist",
            mentor: "mage",
          }[o.id];
        const size = boss
          ? 152
          : def?.type === "elite"
            ? 100
            : def?.type === "rare"
              ? 104
              : monster
                ? 76
                : 86;
        this.ellipse(
          s.x,
          s.y,
          monster ? (boss ? 45 : 21) : 18,
          monster ? (boss ? 19 : 9) : 8,
          "#26453532",
        );
        if (monster && o.uid === target)
          this.ellipse(
            s.x,
            s.y,
            boss ? 45 : 24,
            boss ? 20 : 11,
            null,
            "#f1deb1",
          );
        if (monster && o.markedUntil > time)
          this.text("⌖", s.x, s.y - size * 0.85, "#ffdf9f", 20);
        const jump = o.windup?.jump
          ? Math.sin(
              Math.min(
                1,
                (time - o.windup.start) / (o.windup.at - o.windup.start),
              ) * Math.PI,
            ) * 24
          : 0;
        this.sprite(
          image,
          s.x,
          s.y - jump,
          o.anim || "idle",
          o.dir || 0,
          time,
          o.animAt || 0,
          size,
        );
        if (o.kind === "player" && o.shield > 0)
          this.ellipse(s.x, s.y - 30, 32, 43, null, "#d9e8bb99");
        if (monster) {
          if (o.hp > 0) {
            this.hitboxes.push({
              kind: "monster",
              id: o.uid,
              x: s.x,
              y: s.y - size * 0.4,
              r: boss ? 62 : 30,
            });
            if (o.hp < o.maxHp || o.uid === target || boss) {
              const bw = boss ? 96 : 50;
              c.fillStyle = "#243c32";
              c.fillRect(s.x - bw / 2, s.y - size * 0.82, bw, 5);
              c.fillStyle = boss ? "#d7a977" : "#d2bd8a";
              c.fillRect(
                s.x - bw / 2 + 1,
                s.y - size * 0.82 + 1,
                ((bw - 2) * o.hp) / o.maxHp,
                3,
              );
            }
            if (o.uid === target || boss)
              this.text(
                def.name,
                s.x,
                s.y - size * 0.82 - 12,
                boss ? "#f6dbac" : "#f1ebd4",
                boss ? 12 : 10,
              );
          }
        } else if (o.kind === "npc") {
          this.text(o.name, s.x, s.y - 69, "#f6e4ae", 11);
          this.text(o.role, s.x, s.y - 83, "#d6e5bc", 9);
          this.hitboxes.push({
            kind: "npc",
            id: o.id,
            x: s.x,
            y: s.y - 30,
            r: 30,
          });
          if (Math.hypot(p.x - o.x, p.y - o.y) < 2.6)
            this.text("[E] 이야기", s.x, s.y + 19, "#fff0b8", 11);
        } else
          this.text(
            o.name,
            s.x,
            s.y - 72,
            o.kind === "player" ? "#fff4cf" : "#c9e1d5",
            11,
          );
      }
    }
    for (const e of state.effects) {
      const s = this.worldToScreen(e.x, e.y),
        age = e.until - time;
      if (e.text)
        this.text(
          e.text,
          s.x,
          s.y - 45 - (1 - age) * 22,
          e.color || "#f7e6af",
          e.crit ? 21 : e.kind === "level" ? 23 : 16,
        );
      if (["projectile", "beam"].includes(e.kind)) {
        const end = this.worldToScreen(e.tx, e.ty);
        c.strokeStyle = e.color || "#f3e6b8";
        c.lineWidth = e.kind === "beam" ? 4 : 2;
        c.beginPath();
        c.moveTo(s.x, s.y - 30);
        c.lineTo(end.x, end.y - 30);
        c.stroke();
      }
    }
    // Warm drifting motes are deterministic and never obscure attack tells.
    for (let i = 0; i < 24; i++) {
      const x = (i * 149 + Math.sin(time * 0.2 + i) * 26 + w) % w,
        y = (i * 87 - time * (3 + (i % 3)) + h * 4) % h;
      c.fillStyle = i % 3 ? "#edf0b12a" : "#f6e5a45c";
      c.fillRect(x, y, 2, 2);
    }
    this.drawMinimap(state);
  }
  drawMinimap(state) {
    const c = this.minimap.getContext("2d"),
      w = this.minimap.width,
      h = this.minimap.height;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#193629";
    c.fillRect(0, 0, w, h);
    const pt = (x, y) => ({
      x: 8 + (x / 30) * (w - 16),
      y: 8 + (y / 30) * (h - 16),
    });
    c.strokeStyle = "#647a51";
    c.lineWidth = 7;
    const a = pt(1, 14),
      b = pt(29, 14);
    c.beginPath();
    c.moveTo(a.x, a.y);
    c.lineTo(b.x, b.y);
    c.stroke();
    for (const m of state.mobs.filter((m) => m.hp > 0)) {
      const p = pt(m.x, m.y);
      c.fillStyle =
        MONSTERS.find((d) => d.id === m.def).type === "boss"
          ? "#e8b681"
          : "#a79770";
      c.fillRect(p.x - 1, p.y - 1, 3, 3);
    }
    for (const n of NPCS.filter((n) => n.map === state.player.map)) {
      const p = pt(n.x, n.y);
      c.fillStyle = "#dfcf9c";
      c.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    for (const port of PORTALS(state.player.map)) {
      const p = pt(port.x, port.y);
      c.strokeStyle = "#f5d890";
      c.strokeRect(p.x - 3, p.y - 3, 6, 6);
    }
    const p = pt(state.player.x, state.player.y);
    c.fillStyle = "#e8f1cf";
    c.beginPath();
    c.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    c.fill();
  }
  hit(x, y) {
    return this.hitboxes
      .filter((h) => Math.hypot(h.x - x, h.y - y) < h.r)
      .sort(
        (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
      )[0];
  }
}
