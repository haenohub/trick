import { MAPS } from "./data.js";
import { NAVIGATION, imageToWorld } from "./world-layout.js";
import { project } from "./view-projection.js";
import { floorTileCode } from "./isometric-layouts.js";
const features = {
  village: ["잎 지붕 공방", "황금잎 분수", "이중 고리 생활길"],
  sprout: ["묘목 온실", "콩 덩굴 울타리", "관개 정원"],
  acorn: ["도토리 저장고", "참나무 통로", "낙엽 골짜기"],
  brook: ["징검돌 섬", "물레방아 정자", "버드나무 수로"],
  stump: ["고목 성소", "방사형 뿌리길", "호박 수액 정원"],
  shelltown: ["조개 시계 광장", "산호 유리 공방", "초승달 선착장"],
  saltwood: ["은빛 해송", "소금꽃 테라스", "바람막이 정원"],
  glassbeach: ["유리열매 군락", "조개 둔덕", "산호 아치"],
  tideroot: ["맹그로브 뿌리섬", "물금 관측소", "침수 성소"],
  seacave: ["수정 성당", "조개 화석실", "고대 수문"],
};
const REV = new URL(import.meta.url).searchParams.get("v") || "local";
const $ = (id) => document.getElementById(id),
  canvas = $("map"),
  ctx = canvas.getContext("2d"),
  art = await (await fetch("./assets/manifest.json?v=" + REV)).json();
let selected = null,
  images = [],
  scale = 1,
  baseScale = 1,
  pan = { x: 0, y: 0 },
  center = { x: 0, y: 0 },
  ticket = 0,
  drag = null;
const cache = new Map();
async function load(file) {
  if (!cache.has(file))
    cache.set(
      file,
      new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () =>
          reject(Error("풍경을 불러오지 못했습니다. 새로고침해 주세요."));
        i.src = "./assets/" + file + ".png?v=" + REV;
      }),
    );
  return cache.get(file);
}
for (const map of MAPS) {
  const b = document.createElement("button");
  b.dataset.map = map.id;
  b.setAttribute("aria-pressed", "false");
  b.innerHTML = `<img src="./assets/maps/${map.id}.png?v=${REV}" alt="" loading="lazy"><span>${map.name}</span>`;
  b.onclick = () => choose(map.id);
  $("regions").append(b);
}
function fit() {
  const nav = NAVIGATION[selected],
    corners = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ].map(([u, v]) => {
      const p = imageToWorld(u, v, selected);
      return project(p.x, p.y);
    });
  const minX = Math.min(...corners.map((p) => p.x)) - 224,
    maxX = Math.max(...corners.map((p) => p.x)) + 224,
    minY = Math.min(...corners.map((p) => p.y)) - 512,
    maxY = Math.max(...corners.map((p) => p.y)) + 224;
  center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  baseScale =
    Math.min(
      canvas.clientWidth / (maxX - minX),
      canvas.clientHeight / (maxY - minY),
    ) * 0.95;
  scale = baseScale;
  pan = { x: 0, y: 0 };
  paint();
}
function paint() {
  if (!selected || images.length !== 2) return;
  const dpr = Math.min(devicePixelRatio || 1, 2),
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = scale < 0.45;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, w, h);
  const nav = NAVIGATION[selected],
    scene = art.world.isometric.maps[selected],
    point = (p) => {
      const s = project(p.x, p.y);
      return {
        x: w / 2 + pan.x + (s.x - center.x) * scale,
        y: h / 2 + pan.y + (s.y - center.y) * scale,
      };
    };
  for (let r = 0; r <= nav.rows; r++)
    for (let c = 0; c <= nav.cols; c++) {
      const tile = floorTileCode(nav, c, r),
        p = point(imageToWorld(c / nav.cols, r / nav.rows, selected)),
        fw = scene.floor.width,
        fh = scene.floor.height;
      ctx.drawImage(
        images[0],
        (tile % 8) * fw,
        Math.floor(tile / 8) * fh,
        fw,
        fh,
        Math.round(p.x - (fw * scale) / 2),
        Math.round(p.y - (fh * scale) / 2),
        Math.ceil(fw * scale) + 1,
        Math.ceil(fh * scale) + 1,
      );
    }
  for (const o of nav.props.toSorted(
    (a, b) => project(a.x, a.y).y - project(b.x, b.y).y,
  )) {
    const p = point(o),
      size = (o.size || 384) * scale;
    ctx.drawImage(
      images[1],
      (o.index % 4) * 384,
      Math.floor(o.index / 4) * 384,
      384,
      384,
      p.x - size / 2,
      p.y - size * (scene.props.anchors?.[o.index] ?? o.anchor ?? 0.98),
      size,
      size,
    );
  }
}
async function choose(id) {
  const mine = ++ticket;
  selected = id;
  images = [];
  const map = MAPS.find((m) => m.id === id);
  $("name").textContent = map.name;
  $("description").textContent = NAVIGATION[id].shape;
  $("features").innerHTML = features[id]
    .map((x) => `<span>${x}</span>`)
    .join("");
  for (const b of $("regions").children)
    b.setAttribute("aria-pressed", String(b.dataset.map === id));
  $("status").textContent = "지역 풍경을 불러옵니다…";
  try {
    const scene = art.world.isometric.maps[id],
      loaded = await Promise.all([
        load(scene.floor.file),
        load(scene.props.file),
      ]);
    if (mine !== ticket) return;
    images = loaded;
    const keep = new Set([scene.floor.file, scene.props.file]);
    while (cache.size > 6) {
      const key = [...cache.keys()].find((k) => !keep.has(k));
      if (!key) break;
      cache.delete(key);
    }
    fit();
    $("status").textContent = "게임에서 사용하는 지형과 풍경입니다.";
  } catch (e) {
    $("status").textContent = e.message;
  }
}
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    scale = Math.max(
      baseScale * 0.7,
      Math.min(baseScale * 12, scale * Math.exp(-e.deltaY * 0.0015)),
    );
    paint();
  },
  { passive: false },
);
canvas.onpointerdown = (e) => {
  drag = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
};
canvas.onpointermove = (e) => {
  if (!drag) return;
  pan.x += e.clientX - drag.x;
  pan.y += e.clientY - drag.y;
  drag = { x: e.clientX, y: e.clientY };
  paint();
};
canvas.onpointerup = canvas.onpointercancel = () => {
  drag = null;
};
$("in").onclick = () => {
  scale = Math.min(baseScale * 12, scale * 1.4);
  paint();
};
$("out").onclick = () => {
  scale = Math.max(baseScale * 0.7, scale / 1.4);
  paint();
};
$("fit").onclick = fit;
addEventListener("resize", fit);
choose(MAPS[0].id);
