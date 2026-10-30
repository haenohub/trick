// Recover individual authored frames from uneven source gutters, register their
// local origins, then pack. This does not draw or synthesize any artwork.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, png } from "./pack-pixel-art.mjs";
const art = JSON.parse(await readFile("site/assets/manifest.json", "utf8")),
  records = JSON.parse(await readFile("art/generated-assets.json", "utf8")),
  plan = JSON.parse(await readFile("art/v24-art.json", "utf8"));
const thorn = JSON.parse(await readFile("art/thorn-effect-v25.json", "utf8"));
const calibration = JSON.parse(
  await readFile("art/skill-frame-centers-v25.json", "utf8"),
).centers;
const bases = {
  warden: [false, true, true, true, false],
  mage: [false, false, true, true, true],
  ranger: [false, true, false, false, true],
  herbalist: [true, false, true, true, true],
};
function cuts(hist, count) {
  const step = hist.length / count,
    out = [0];
  for (let i = 1; i < count; i++) {
    const nominal = i * step;
    let best = 0,
      cost = Infinity;
    for (
      let x = Math.ceil(nominal - step * 0.35);
      x <= Math.floor(nominal + step * 0.35);
      x++
    ) {
      const c =
        (hist[x - 1] + hist[x] + hist[x + 1]) * 4 +
        Math.abs(x - nominal) * 0.025;
      if (c < cost) {
        cost = c;
        best = x;
      }
    }
    out.push(best);
  }
  out.push(hist.length);
  return out;
}
function isolate(src, x0, y0, x1, y1) {
  const w = x1 - x0,
    h = y1 - y0,
    seen = new Uint8Array(w * h),
    parts = [];
  const filled = (x, y) =>
    src.data[((y + y0) * src.width + x + x0) * 4 + 3] >= 220;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (seen[y * w + x] || !filled(x, y)) continue;
      const queue = [y * w + x],
        pixels = [];
      seen[y * w + x] = 1;
      let minX = w,
        minY = h,
        maxX = 0,
        maxY = 0;
      for (let i = 0; i < queue.length; i++) {
        const at = queue[i],
          px = at % w,
          py = Math.floor(at / w);
        pixels.push([px + x0, py + y0]);
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);
        for (const [nx, ny] of [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ])
          if (
            nx >= 0 &&
            ny >= 0 &&
            nx < w &&
            ny < h &&
            !seen[ny * w + nx] &&
            filled(nx, ny)
          ) {
            seen[ny * w + nx] = 1;
            queue.push(ny * w + nx);
          }
      }
      parts.push({ pixels, area: pixels.length, minX, maxX, minY, maxY });
    }
  parts.sort((a, b) => b.area - a.area);
  if (!parts.length)
    return {
      pixels: [],
      minX: (x0 + x1) / 2,
      maxX: (x0 + x1) / 2,
      minY: (y0 + y1) / 2,
      maxY: (y0 + y1) / 2,
      source: [x0, y0, x1 - x0, y1 - y0],
      discardedFragments: 0,
      mainTouchesCut: false,
      empty: true,
    };
  const main = parts[0],
    keep = parts.filter(
      (p) =>
        p.area >= Math.max(2, main.area * 0.006) &&
        (!(p.minX < 2 || p.maxX > w - 3) || p.area >= main.area * 0.35),
    );
  const pixels = keep.flatMap((p) => p.pixels),
    xs = pixels.map((p) => p[0]),
    ys = pixels.map((p) => p[1]);
  return {
    pixels,
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    source: [x0, y0, x1 - x0, y1 - y0],
    discardedFragments: parts.length - keep.length,
    mainTouchesCut: main.minX < 1 || main.maxX >= w - 1,
  };
}
const audit = {
  version: 1,
  status: "complete",
  method:
    "per-row transparent gutters, component isolation, common-scale local-origin registration",
  sheets: [],
};
for (const job of plan.sources.filter((j) => ["fx", "hit"].includes(j.kind))) {
  const id = job.id.replace("fx-", ""),
    file = job.kind === "hit" ? "combat-impacts-v24" : "skills/" + id,
    layout = job.kind === "hit" ? art.attackImpacts : art.skillEffects[id],
    src = decode(job.source),
    cols = layout.cols,
    rows = layout.rows,
    size = 128;
  for (let i = 0; i < src.data.length; i += 4) {
    const [r, g, b, a] = src.data.subarray(i, i + 4);
    if (
      a < 220 ||
      (r > 220 && g < 40 && b < 85) ||
      (b > 230 && r < 30 && g < 30)
    )
      src.data[i + 3] = 0;
  }
  const hy = new Uint32Array(src.height);
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (src.data[(y * src.width + x) * 4 + 3] >= 220) hy[y]++;
  const ys = cuts(hy, rows),
    out = rgba(cols * size, rows * size),
    rowRecords = [];
  for (let row = 0; row < rows; row++) {
    const hx = new Uint32Array(src.width);
    for (let y = ys[row]; y < ys[row + 1]; y++)
      for (let x = 0; x < src.width; x++)
        if (src.data[(y * src.width + x) * 4 + 3] >= 220) hx[x]++;
    const centers = calibration[job.kind === "hit" ? "hit" : id][row],
      count = centers.length;
    let activeSrc = src;
    const xs = [0];
    for (let i = 1; i < count; i++) {
      const mid = (centers[i - 1] + centers[i]) / 2,
        span = (centers[i] - centers[i - 1]) * 0.11;
      let best = Math.round(mid),
        cost = Infinity;
      for (let at = Math.ceil(mid - span); at <= Math.floor(mid + span); at++) {
        const score =
          (hx[at - 1] + hx[at] + hx[at + 1]) * 10000 +
          Math.abs(at - mid) * 0.05;
        if (score < cost) {
          cost = score;
          best = at;
        }
      }
      xs.push(best);
    }
    xs.push(src.width);
    let frames = Array.from({ length: count }, (_, f) =>
      isolate(src, xs[f], ys[row], xs[f + 1], ys[row + 1]),
    );
    if (id === "warden" && row === 4) {
      activeSrc = decode(thorn.source);
      for (let i = 3; i < activeSrc.data.length; i += 4)
        if (activeSrc.data[i] < 220) activeSrc.data[i] = 0;
      frames = Array.from({ length: 12 }, (_, f) =>
        isolate(
          activeSrc,
          Math.round(((f % 4) * activeSrc.width) / 4),
          Math.round((Math.floor(f / 4) * activeSrc.height) / 3),
          Math.round((((f % 4) + 1) * activeSrc.width) / 4),
          Math.round(((Math.floor(f / 4) + 1) * activeSrc.height) / 3),
        ),
      );
    }
    const ground = job.kind === "hit" ? false : bases[id][row];
    for (const f of frames) {
      f.ax = (f.minX + f.maxX) / 2;
      f.ay = ground ? f.maxY : (f.minY + f.maxY) / 2;
      if (!ground) {
        let weight = 0,
          sx = 0,
          sy = 0;
        for (const [x, y] of f.pixels) {
          const [r, g, b] = activeSrc.data.subarray(
              (y * activeSrc.width + x) * 4,
              (y * activeSrc.width + x) * 4 + 3,
            ),
            k = Math.max(0, r + g + b - 650) ** 2;
          if (k) {
            weight += k;
            sx += x * k;
            sy += y * k;
          }
        }
        if (weight) {
          f.ax = sx / weight;
          f.ay = sy / weight;
        }
      }
    }
    if (!(id === "warden" && row === 4)) {
      const early = frames
        .slice(0, 3)
        .map((f) => (f.minY + f.maxY) / 2)
        .sort((a, b) => a - b);
      for (let col = 0; col < frames.length; col++) {
        frames[col].ax = centers[col];
        if (!ground) frames[col].ay = early[1];
      }
    }
    const scale = Math.min(
      ...frames.map((f) =>
        Math.min(
          59 / Math.max(f.ax - f.minX, f.maxX - f.ax, 0.5),
          (ground ? 114 : 59) / Math.max(f.ay - f.minY, f.maxY - f.ay, 0.5),
        ),
      ),
    );
    const pivot = [64, ground ? 120 : 64],
      details = [];
    for (let col = 0; col < frames.length; col++) {
      const f = frames[col],
        mask = new Set(f.pixels.map(([x, y]) => y * activeSrc.width + x));
      const b = { minX: 128, minY: 128, maxX: 0, maxY: 0 };
      for (let y = 4; y < 124; y++)
        for (let x = 4; x < 124; x++) {
          const sx = Math.round(f.ax + (x - pivot[0]) / scale),
            sy = Math.round(f.ay + (y - pivot[1]) / scale),
            from = sy * activeSrc.width + sx;
          if (!mask.has(from)) continue;
          const to = ((row * 128 + y) * out.width + col * 128 + x) * 4;
          activeSrc.data.copy(out.data, to, from * 4, from * 4 + 4);
          out.data[to + 3] = 255;
          b.minX = Math.min(b.minX, x);
          b.maxX = Math.max(b.maxX, x);
          b.minY = Math.min(b.minY, y);
          b.maxY = Math.max(b.maxY, y);
        }
      details.push({
        source: f.source,
        sourceAnchor: [f.ax, f.ay],
        bounds: b,
        discardedFragments: f.discardedFragments,
        mainTouchesCut: f.mainTouchesCut,
      });
    }
    rowRecords.push({
      row,
      pivot,
      ground,
      scale,
      source: id === "warden" && row === 4 ? thorn.source : job.source,
      frames: details,
    });
  }
  // Use the existing shared palette while retaining the registered transparent
  // gutters. sampleNearest performs the palette conversion without geometry.
  const { sampleNearest } = await import("./pack-pixel-art.mjs");
  const target = "site/assets/" + file + ".png";
  await png(
    sampleNearest(
      out,
      { sx: 0, sy: 0, sw: out.width, sh: out.height },
      out.width,
      out.height,
    ),
    target,
  );
  layout.registration = rowRecords;
  layout.rowFrames = rowRecords.map((r) => r.frames.length);
  layout.fxReviewVersion = 1;
  const rec = records.assets.find((a) => a.id === file);
  rec.sha256 = createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
  rec.fxReviewVersion = 1;
  rec.registration = rowRecords;
  if (id === "warden")
    rec.additionalSources = [
      ...new Set([...(rec.additionalSources || []), thorn.source]),
    ];
  audit.sheets.push({
    file,
    source: job.source,
    cols,
    rows,
    rowsReview: rowRecords,
  });
  console.log(
    file,
    "isolated",
    cols * rows,
    "frames; cut warnings",
    rowRecords
      .flatMap((r) => r.frames.map((f, col) => ({ ...f, row: r.row, col })))
      .filter((f) => f.mainTouchesCut)
      .map((f) => [f.row, f.col, f.source]),
  );
}
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
await writeFile(
  "art/skill-frame-review-v25.json",
  JSON.stringify(audit, null, 2) + "\n",
);
