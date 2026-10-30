// Technical isolation, palm-marker measurement and registration of image_gen art.
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { decode, rgba, blit, png, sampleNearest } from "./pack-pixel-art.mjs";
import { directionalRects } from "./locomotion-grid.mjs";
const json = async (p) => JSON.parse(await readFile(p, "utf8"));
const art = await json("site/assets/manifest.json"),
  records = await json("art/generated-assets.json"),
  plan = await json("art/dynamic-motion-v24.json");
const marker = (r, g, b, a) => a >= 220 && r > 210 && b > 170 && g < 100;
const median = (a) => a.toSorted((a, b) => a - b)[Math.floor(a.length / 2)];
const crop = (im, x, y, w, h) => {
  const o = rgba(w, h);
  for (let yy = 0; yy < h; yy++)
    im.data.copy(
      o.data,
      yy * w * 4,
      ((y + yy) * im.width + x) * 4,
      ((y + yy) * im.width + x + w) * 4,
    );
  return o;
};
function bounds(im) {
  let x0 = im.width,
    y0 = im.height,
    x1 = 0,
    y1 = 0;
  for (let y = 0; y < im.height; y++)
    for (let x = 0; x < im.width; x++)
      if (im.data[(y * im.width + x) * 4 + 3]) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  return { x0, y0, x1, y1, height: y1 - y0 + 1 };
}
async function register(file, im, source) {
  const target = "site/assets/" + file + ".png";
  await png(im, target);
  const rec = records.assets.find((a) => a.id === file);
  rec.additionalSources = [
    ...new Set([rec.source, ...(rec.additionalSources || [])]),
  ].filter((s) => s !== source);
  rec.source = source;
  rec.sha256 = createHash("sha256")
    .update(await readFile(target))
    .digest("hex");
  rec.huntingMotionVersion = 1;
  rec.dynamicMotionVersion = 1;
  const job = plan.sources.find((j) => j.source === source);
  rec.additionalSources = [
    ...new Set([...rec.additionalSources, ...(job?.additionalSources || [])]),
  ];
}
for (const job of plan.sources) {
  const src = decode(job.packedSource),
    markers = [];
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++) {
      const a = (y * src.width + x) * 4,
        [r, g, b, alpha] = src.data.subarray(a, a + 4);
      if (marker(r, g, b, alpha)) markers.push({ x, y });
      else if (
        alpha < 220 ||
        (r > 210 && g < 65 && b < 120) ||
        (b > 220 && r < 35 && g < 40)
      )
        src.data[a + 3] = 0;
    }
  // Fill registration ink only with neighboring authored glove/skin pixels.
  const original = Buffer.from(src.data);
  for (const p of markers) {
    let chosen = null;
    for (let dy = -7; dy <= 7; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const x = p.x + dx,
          y = p.y + dy;
        if (x < 0 || y < 0 || x >= src.width || y >= src.height) continue;
        const a = (y * src.width + x) * 4,
          [r, g, b, alpha] = original.subarray(a, a + 4);
        if (!alpha || marker(r, g, b, alpha)) continue;
        const skin =
          r > 145 && g > 95 && g > r * 0.56 && b < 210 && r > b * 1.05;
        const score = Math.hypot(dx, dy) + (skin ? 0 : 12);
        if (!chosen || score < chosen.score) chosen = { a, score };
      }
    if (!chosen) {
      src.data[(p.y * src.width + p.x) * 4 + 3] = 0;
      p.invalid = true;
    } else
      original.copy(
        src.data,
        (p.y * src.width + p.x) * 4,
        chosen.a,
        chosen.a + 4,
      );
  }
  const pending = new Map(
      markers.filter((p) => !p.invalid).map((p) => [p.x + "," + p.y, p]),
    ),
    groups = [];
  while (pending.size) {
    const first = pending.values().next().value,
      group = [first];
    pending.delete(first.x + "," + first.y);
    for (let i = 0; i < group.length; i++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const key = group[i].x + dx + "," + (group[i].y + dy),
            p = pending.get(key);
          if (p) {
            pending.delete(key);
            group.push(p);
          }
        }
    const x0 = Math.min(...group.map((p) => p.x)),
      x1 = Math.max(...group.map((p) => p.x)),
      y0 = Math.min(...group.map((p) => p.y)),
      y1 = Math.max(...group.map((p) => p.y));
    const density = group.length / ((x1 - x0 + 1) * (y1 - y0 + 1));
    if (group.length >= 3 && density > 0.45)
      groups.push({
        points: group,
        x0,
        x1,
        y0,
        y1,
        score: group.length * density,
      });
  }
  const grid = directionalRects(src, 8, 8, { minArea: 0.025 }),
    base = art.appearance.bases[job.id],
    body = decode("site/assets/" + base.file + ".png");
  const oldHeight = median(
    Array.from(
      { length: 8 },
      (_, d) => bounds(crop(body, 24 * 96, d * 96, 96, 96)).height,
    ),
  );
  const scale = Math.min(
    oldHeight / median(grid.flat().map((r) => r.sh)),
    ...grid.flat().map((r) => 88 / Math.max(r.sw, r.sh)),
  );
  let measured = 0;
  job.visiblePalmCalibrations = [];
  job.correctedHandSwitches = [];
  const contact = rgba(768, 768),
    readyFrames = [];
  for (let dir = 0; dir < 8; dir++)
    for (let col = 0; col < 8; col++) {
      const r = grid[dir][col],
        cut = rgba(r.sw, r.sh);
      for (const part of r.components)
        for (let y = part.minY; y <= part.maxY; y++)
          for (let x = part.minX; x <= part.maxX; x++)
            src.data.copy(
              cut.data,
              ((y - r.sy) * r.sw + x - r.sx) * 4,
              (y * src.width + x) * 4,
              (y * src.width + x + 1) * 4,
            );
      const group = groups
        .filter(
          (g) =>
            g.x0 >= r.sx &&
            g.x1 < r.sx + r.sw &&
            g.y0 >= r.sy + r.sh * 0.3 &&
            g.y1 < r.sy + r.sh,
        )
        .sort((a, b) => b.score - a.score)[0];
      const marks = group ? [...group.points] : [];
      const marked = marks.length > 0;
      if (!marked) {
        const side = dir <= 3 ? 1 : -1,
          candidates = [];
        for (let y = Math.floor(r.sh * 0.42); y < r.sh * 0.8; y++)
          for (let x = 0; x < r.sw; x++) {
            const [red, g, b, a] = cut.data.subarray(
              (y * r.sw + x) * 4,
              (y * r.sw + x) * 4 + 4,
            );
            if (
              a &&
              red > 150 &&
              g > 105 &&
              g > red * 0.65 &&
              b > 65 &&
              b < 205 &&
              red > b * 1.18 &&
              side * (x - r.sw / 2) > r.sw * 0.12
            )
              candidates.push({ x, y });
          }
        if (!candidates.length)
          throw Error(job.id + " palm requires inspection " + dir + ":" + col);
        const edge =
          side > 0
            ? Math.max(...candidates.map((p) => p.x))
            : Math.min(...candidates.map((p) => p.x));
        let palm = candidates.filter((p) => Math.abs(p.x - edge) < 5);
        if (job.id === "herbalist" || (job.id === "mage" && dir === 7)) {
          const gx = r.sw * (dir === 4 ? 0.38 : side > 0 ? 0.75 : 0.25),
            gy = r.sh * 0.73;
          candidates.sort(
            (a, b) =>
              Math.hypot(a.x - gx, a.y - gy) - Math.hypot(b.x - gx, b.y - gy),
          );
          palm = candidates.slice(0, 5);
        }
        marks.push({
          x: r.sx + median(palm.map((p) => p.x)),
          y: r.sy + median(palm.map((p) => p.y)),
        });
        job.visiblePalmCalibrations.push({ dir, col, sourcePalm: marks[0] });
      }
      const w = Math.round(r.sw * scale),
        h = Math.round(r.sh * scale),
        frame = rgba(96, 96),
        small = sampleNearest(cut, { sx: 0, sy: 0, sw: r.sw, sh: r.sh }, w, h);
      const feet = [];
      for (let y = r.sh - 6; y < r.sh; y++)
        for (let x = 0; x < r.sw; x++)
          if (cut.data[(y * r.sw + x) * 4 + 3]) feet.push(x);
      const left = Math.max(
          4,
          Math.min(
            92 - w,
            Math.round(
              48 -
                (feet.length
                  ? feet.reduce((a, b) => a + b, 0) / feet.length
                  : r.sw / 2) *
                  scale,
            ),
          ),
        ),
        top = 92 - h;
      blit(small, frame, left, top);
      const hand = [
        Math.round(
          left +
            ((median(marks.map((p) => p.x)) - r.sx + 0.5) * w) / r.sw -
            0.5,
        ),
        Math.round(
          top + ((median(marks.map((p) => p.y)) - r.sy + 0.5) * h) / r.sh - 0.5,
        ),
      ];
      let nearest = null;
      for (let y = hand[1] - 3; y <= hand[1] + 3; y++)
        for (let x = hand[0] - 3; x <= hand[0] + 3; x++) {
          if (
            x < 4 ||
            y < 4 ||
            x >= 92 ||
            y >= 92 ||
            !frame.data[(y * 96 + x) * 4 + 3]
          )
            continue;
          const d = Math.hypot(x - hand[0], y - hand[1]);
          if (!nearest || d < nearest.d) nearest = { x, y, d };
        }
      if (!nearest) throw Error("Unregistered palm");
      hand[0] = nearest.x;
      hand[1] = nearest.y;
      if (col > 0 && col < 6) {
        const previous = base.anchors[dir][col - 1].hand;
        if (
          (hand[0] - 48) * (previous[0] - 48) < 0 &&
          Math.abs(hand[0] - previous[0]) > 24
        ) {
          const side = previous[0] < 48 ? -1 : 1,
            b = bounds(frame),
            palms = [];
          for (let y = Math.ceil(b.y0 + b.height * 0.43); y < b.y1 - 12; y++)
            for (let x = 4; x < 92; x++) {
              const [red, g, blue, a] = frame.data.subarray(
                (y * 96 + x) * 4,
                (y * 96 + x) * 4 + 4,
              );
              if (
                a &&
                red > 150 &&
                g > 105 &&
                g > red * 0.65 &&
                blue > 65 &&
                blue < 205 &&
                red > blue * 1.18 &&
                side * (x - 48) > 8
              )
                palms.push({ x, y });
            }
          if (!palms.length)
            throw Error(
              job.id + " switching hand needs inspection " + dir + ":" + col,
            );
          const edge =
              side > 0
                ? Math.max(...palms.map((p) => p.x))
                : Math.min(...palms.map((p) => p.x)),
            fist = palms.filter((p) => Math.abs(p.x - edge) < 3);
          const center = [
            median(fist.map((p) => p.x)),
            median(fist.map((p) => p.y)),
          ];
          fist.sort(
            (a, b) =>
              Math.hypot(a.x - center[0], a.y - center[1]) -
              Math.hypot(b.x - center[0], b.y - center[1]),
          );
          hand[0] = fist[0].x;
          hand[1] = fist[0].y;
          job.correctedHandSwitches.push({ dir, col, hand: [...hand] });
        }
      }
      const b = bounds(frame);
      let anchor = {
        hand,
        angle: 0,
        head: [48, b.y0 + 22],
        torso: [48, Math.round(b.y0 + b.height * 0.65)],
        feet: [48, 88],
        measured: true,
        calibration: marked ? "authored-palm-marker" : "visible-palm",
      };
      if (col === 0)
        readyFrames[dir] = {
          frame: crop(frame, 0, 0, 96, 96),
          anchor: structuredClone(anchor),
        };
      if (col === 6) {
        readyFrames[dir].frame.data.copy(frame.data);
        anchor = structuredClone(readyFrames[dir].anchor);
      }
      for (const c of [col, col + 8]) {
        for (let y = 0; y < 96; y++)
          body.data.fill(
            0,
            ((dir * 96 + y) * body.width + c * 96) * 4,
            ((dir * 96 + y) * body.width + (c + 1) * 96) * 4,
          );
        blit(frame, body, c * 96, dir * 96);
        base.anchors[dir][c] = structuredClone(anchor);
      }
      blit(frame, contact, col * 96, dir * 96);
      measured++;
    }
  // Idle and walk grips stay near the belt/actual palm, never at a hat or hair.
  for (let dir = 0; dir < 8; dir++)
    for (let col = 16; col < 32; col++) {
      const f = crop(body, col * 96, dir * 96, 96, 96),
        b = bounds(f),
        side = dir >= 3 && dir <= 6 ? -1 : 1;
      const goal = {
        x: 48 + side * (job.id === "warden" ? 17 : 14),
        y: b.y0 + b.height * 0.73,
      };
      let best = null;
      for (let y = Math.ceil(b.y0 + b.height * 0.57); y <= b.y1 - 10; y++)
        for (let x = 4; x < 92; x++) {
          const a = (y * 96 + x) * 4,
            [r, g, blue, alpha] = f.data.subarray(a, a + 4);
          if (
            !alpha ||
            r < 155 ||
            g < 100 ||
            g < r * 0.6 ||
            blue > 210 ||
            r < blue * 1.07
          )
            continue;
          const d = Math.hypot(x - goal.x, y - goal.y);
          if (!best || d < best.d) best = { x, y, d };
        }
      if (best) base.anchors[dir][col].hand = [best.x, best.y];
    }
  const hands = rgba(3072, 768);
  for (let d = 0; d < 8; d++)
    for (let c = 0; c < 32; c++) {
      const [hx, hy] = base.anchors[d][c].hand;
      for (let y = hy - 2; y <= hy + 2; y++)
        for (let x = hx - 2; x <= hx + 2; x++)
          if (
            x >= 4 &&
            y >= 4 &&
            x < 92 &&
            y < 92 &&
            Math.hypot(x - hx, y - hy) <= 2.25
          ) {
            const a = ((d * 96 + y) * body.width + c * 96 + x) * 4;
            body.data.copy(hands.data, a, a, a + 4);
          }
    }
  await register(base.file, body, job.source);
  await register(base.handFile, hands, job.source);
  await register("combat/" + job.id, contact, job.source);
  base.combatGripVersion = 1;
  base.dynamicMotionVersion = 1;
  job.measuredCombatPalms = measured;
  console.log(
    "Registered " +
      job.id +
      ": " +
      measured +
      " individually authored palm positions",
  );
}
plan.status = "complete";
await writeFile(
  "art/dynamic-motion-v24.json",
  JSON.stringify(plan, null, 2) + "\n",
);
await writeFile(
  "site/assets/manifest.json",
  JSON.stringify(art, null, 2) + "\n",
);
await writeFile(
  "art/generated-assets.json",
  JSON.stringify(records, null, 2) + "\n",
);
