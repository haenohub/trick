// Pure placement contract shared by renderer and animation audits.
import { IMPACT_DURATION } from "./animation.js";
export const HIT_FRAMES = {
  warden: [2, 3, 4],
  mage: [1, 2, 3],
  ranger: [1, 2, 3],
  herbalist: [2, 3, 4],
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export function impactFrame(classId, age) {
  if (age < 0 || age >= IMPACT_DURATION) return null;
  const frames = HIT_FRAMES[classId] || HIT_FRAMES.warden;
  return frames[clamp(Math.floor(age * 30 + 1e-8), 0, frames.length - 1)];
}
export function skillPlacement(
  application,
  visual,
  effect,
  state,
  project,
  zoom,
) {
  const age = state.time - effect.started,
    duration = effect.until - effect.started;
  if (age < 0 || age >= duration) return null;
  const a = application,
    frames = a.anchors.length;
  let frame = Math.min(frames - 1, Math.floor((age / duration) * frames));
  if (a.hold && age >= 0.6 && age < duration - 0.25)
    frame = a.hold[Math.floor((age - 0.6) / 0.18) % a.hold.length];
  else if (a.hold && age < 0.6)
    frame = Math.min(5, Math.floor((age / 0.6) * 6));
  else if (a.hold)
    frame = Math.min(
      frames - 1,
      8 + Math.floor(((age - duration + 0.25) / 0.25) * (frames - 8)),
    );
  const end = project(effect.tx ?? effect.x, effect.ty ?? effect.y);
  const actor =
    effect.owner === state.player?.id
      ? state.player
      : state.peers?.find((p) => p.id === effect.owner);
  const origin =
    a.kind === "self" && actor
      ? project(actor.x, actor.y)
      : project(effect.fromX ?? effect.x, effect.fromY ?? effect.y);
  let x = end.x,
    y = end.y,
    angle = 0;
  let scale = a.scale || 1;
  if (a.kind === "ground") {
    // A compact inner flourish; the targeting outline retains the real radius.
    const diameter = Math.max(1, effect.radius || 1.2) * 64 * Math.SQRT2;
    scale = Math.min(a.maxScale, (diameter * 0.72) / a.footprint);
  }
  if (["impact", "body"].includes(a.kind)) y -= 28 * zoom;
  if (a.kind === "self") {
    x = origin.x;
    y = origin.y - 36 * zoom;
  }
  if (a.kind === "line") {
    const dx = end.x - origin.x,
      dy = end.y - origin.y;
    const t = clamp(age / a.travel, 0, 1);
    x = origin.x + dx * t;
    y = origin.y + dy * t - 30 * zoom;
    angle = Math.atan2(dy, dx);
  }
  // One aspect-preserving size for the entire clip. No per-frame bbox scaling.
  const pixelScale = Math.max(0.5, Math.floor(scale * zoom * 2 + 1e-8) / 2);
  const size = a.size * pixelScale;
  const fade = a.hold ? 0.2 : Math.min(0.18, duration * 0.2);
  return {
    frame,
    x: Math.round(x),
    y: Math.round(y),
    angle,
    size,
    pivot: a.anchors[frame],
    alpha: clamp((duration - age) / fade, 0, 1),
  };
}
