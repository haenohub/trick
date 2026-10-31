// Technical marker isolation and physical grip registration of generated bows.
// Existing non-bow artwork is not repainted; its solid handle pixels are
// remeasured so a registration gap cannot be used as the hand contact point.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json"),
  plan = await json("art/bow-directions-v28.json");
const magenta = (r, g, b, a) => a >= 220 && r > 225 && b > 190 && g < 70;
const red = (r, g, b, a) => a >= 220 && r > 230 && g < 75 && b < 75;
function cell(src, cols, rows, col, row) {
  const x0 = Math.round((col * src.width) / cols),
    y0 = Math.round((row * src.height) / rows),
    x1 = Math.round(((col + 1) * src.width) / cols),
    y1 = Math.round(((row + 1) * src.height) / rows),
    im = rgba(x1 - x0, y1 - y0);
  for (let y = 0; y < im.height; y++)
    src.data.copy(
      im.data,
      y * im.width * 4,
      ((y0 + y) * src.width + x0) * 4,
      ((y0 + y) * src.width + x1) * 4,
    );
  return im;
}
function markers(im, fn) {
  let x = 0,
    y = 0,
    n = 0;
  for (let yy = 0; yy < im.height; yy++)
    for (let xx = 0; xx < im.width; xx++) {
      const at = (yy * im.width + xx) * 4;
      if (fn(...im.data.subarray(at, at + 4))) {
        x += xx;
        y += yy;
        n++;
      }
    }
  return n ? { x: x / n, y: y / n, n } : null;
}
function cleaned(im) {
  const original = Buffer.from(im.data);
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++) {
      const at = (y * im.width + x) * 4,
        p = original.subarray(at, at + 4);
      if (p[3] < 220 || red(...p)) {
        im.data[at + 3] = 0;
        continue;
      }
      if (!magenta(...p)) continue;
      let best = null;
      for (let d = 1; d <= 40 && !best; d++)
        for (let dy = -d; dy <= d; dy++)
          for (let dx = -d; dx <= d; dx++) {
            if (Math.abs(dx) !== d && Math.abs(dy) !== d) continue;
            const xx = x + dx,
              yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= im.width || yy >= im.height) continue;
            const from = (yy * im.width + xx) * 4,
              q = original.subarray(from, from + 4);
            if (q[3] >= 220 && !magenta(...q) && !red(...q)) {
              const score = dx * dx + dy * dy;
              if (!best || score < best.score) best = { from, score };
            }
          }
      if (best) original.copy(im.data, at, best.from, best.from + 4);
      else im.data[at + 3] = 0;
    }
  return im;
}
const output = rgba(768, 864),
  frames = [],
  northJob = plan.sources.find((j) => j.id === "north"),
  north = northJob && decode(northJob.source);
let rowOut = 0;
for (const job of plan.sources.filter((j) => j.id !== "north")) {
  const src = decode(job.source);
  for (const [local, id] of job.items.entries()) {
    const grips = [],
      axes = [],
      tips = [],
      forwardAxes = [];
    for (let d = 0; d < 8; d++) {
      const raw =
        d === 0 && northJob?.items.includes(id)
          ? cell(
              north,
              northJob.cols,
              northJob.rows,
              northJob.items.indexOf(id),
              0,
            )
          : cell(src, job.cols, job.rows, d, local);
      let grip = markers(raw, magenta),
        tip = markers(raw, red);
      let method = "authored-markers";
      if (!grip) {
        const cx = raw.width / 2,
          cy = raw.height / 2;
        let best = null;
        for (
          let y = Math.floor(cy - raw.height * 0.12);
          y <= Math.ceil(cy + raw.height * 0.12);
          y++
        )
          for (
            let x = Math.floor(cx - raw.width * 0.12);
            x <= Math.ceil(cx + raw.width * 0.12);
            x++
          ) {
            const at = (y * raw.width + x) * 4,
              q = raw.data.subarray(at, at + 4);
            if (q[3] < 220 || red(...q)) continue;
            const score = Math.hypot(x - cx, y - cy);
            if (!best || score < best.score) best = { x, y, score };
          }
        if (!best) throw Error(`Missing solid central grip ${id}:${d}`);
        grip = { x: best.x, y: best.y, n: 0 };
        method = "visible-central-grip";
      }
      if (!tip) {
        const angle = (d * Math.PI) / 4;
        tip = {
          x: grip.x + Math.sin(angle) * raw.width * 0.3,
          y: grip.y - Math.cos(angle) * raw.height * 0.3,
          n: 0,
        };
        method += "/direction-calibration";
      }
      const clean = cleaned(raw);
      let extent = 1;
      for (let y = 0; y < clean.height; y++)
        for (let x = 0; x < clean.width; x++)
          if (clean.data[(y * clean.width + x) * 4 + 3] >= 220)
            extent = Math.max(
              extent,
              Math.abs(x - grip.x),
              Math.abs(y - grip.y),
            );
      const s = 40 / extent,
        w = Math.max(1, Math.round(clean.width * s)),
        h = Math.max(1, Math.round(clean.height * s)),
        sample = sampleNearest(
          clean,
          { sx: 0, sy: 0, sw: clean.width, sh: clean.height },
          w,
          h,
        ),
        ox = Math.round(48 - grip.x * s),
        oy = Math.round(48 - grip.y * s);
      // The original empty canvas may extend outside the destination, but all
      // opaque material stays within the measured 40px radius around the grip.
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const xx = ox + x,
            yy = oy + y;
          if (xx < 4 || yy < 4 || xx >= 92 || yy >= 92) continue;
          const at = (y * w + x) * 4;
          if (sample.data[at + 3])
            sample.data.copy(
              output.data,
              ((rowOut * 96 + yy) * output.width + d * 96 + xx) * 4,
              at,
              at + 4,
            );
        }
      const g = [48, 48],
        t = [48 + (tip.x - grip.x) * s, 48 + (tip.y - grip.y) * s],
        forward = Math.atan2(t[0] - 48, -(t[1] - 48));
      grips.push(g);
      tips.push(t);
      forwardAxes.push(forward);
      axes.push(forward - Math.PI / 2);
      frames.push({
        item: id,
        direction: d,
        grip: g,
        forward: t,
        source:
          d === 0 && northJob?.items.includes(id)
            ? northJob.source
            : job.source,
        marker: { grip, tip },
        method,
        scale: s,
      });
    }
    art.appearance.weapons[id] = {
      ...art.appearance.weapons[id],
      file: "appearance/tier-bow-v28",
      index: rowOut,
      grips,
      axes,
      forwardAxes,
      tips,
      measured: Array(8).fill(true),
      cols: 8,
      rows: 9,
      size: 96,
      directionVersion: 28,
    };
    rowOut++;
  }
}
const file = "appearance/tier-bow-v28",
  target = `site/assets/${file}.png`;
await png(output, target);
records.assets = records.assets.filter((a) => a.id !== file);
records.assets.push({
  id: file,
  target,
  source: plan.sources[0].source,
  additionalSources: plan.sources.slice(1).map((j) => j.source),
  tool: "image_gen",
  width: output.width,
  height: output.height,
  sha256: createHash("sha256")
    .update(await readFile(target))
    .digest("hex"),
  size: 96,
  cols: 8,
  rows: 9,
  directionVersion: 28,
});
if (!art.files.includes(file)) art.files.push(file);
const cache = new Map(),
  contacts = [];
for (const [id, w] of Object.entries(art.appearance.weapons).filter(
  ([id, w]) => w.kind !== "bow",
)) {
  if (!cache.has(w.file))
    cache.set(w.file, decode(`site/assets/${w.file}.png`));
  const im = cache.get(w.file);
  for (let d = 0; d < 8; d++) {
    const old = w.grips[d],
      valid = (x, y) => {
        if (x < 4 || x >= 92 || y < 4 || y >= 92) return false;
        const at = ((w.index * 96 + y) * im.width + d * 96 + x) * 4,
          p = im.data.subarray(at, at + 4);
        return p[3] >= 220 && !magenta(...p) && !red(...p);
      };
    let best = null;
    for (let y = old[1] - 10; y <= old[1] + 10; y++)
      for (let x = old[0] - 10; x <= old[0] + 10; x++)
        if (valid(x, y)) {
          let support = 0;
          for (let yy = -1; yy <= 1; yy++)
            for (let xx = -1; xx <= 1; xx++)
              if (valid(x + xx, y + yy)) support++;
          const score =
            Math.hypot(x - old[0], y - old[1]) + (9 - support) * 0.14;
          if (!best || score < best.score) best = { x, y, score };
        }
    if (!best) throw Error(`No solid handle ${id}:${d}`);
    const grip = [best.x, best.y];
    w.grips[d] = grip;
    const tip = w.tips[d];
    w.axes[d] = Math.atan2(tip[0] - grip[0], -(tip[1] - grip[1]));
    contacts.push({ item: id, direction: d, previous: old, handGrip: grip });
  }
  w.contactVersion = 28;
}
art.appearance.weaponScale = 0.8;
plan.status = "complete";
await writeFile(
  "art/bow-directions-v28.json",
  JSON.stringify(plan, null, 2) + "\n",
);
await writeFile(
  "art/weapon-contact-v28.json",
  JSON.stringify(
    { version: 28, scale: 0.8, bowFrames: frames, contacts },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
