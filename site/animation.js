// The authoritative hit offset and visible strike frames share this clock.
// Reference hunting clip: 30 fps. A short release/contact, followed by a
// readable planted-foot follow-through instead of snapping straight to idle.
export const STRIKE_DURATION = 4 / 30;
export const RECOVERY_DURATION = 8 / 30;
export const WALK_DURATION = 1.28;
export const MONSTER_HIT_DURATION = 0.1;
export const IMPACT_DURATION = 3 / 30;
export const WINDUP_DURATION = {
  warden: 6 / 30,
  mage: 8 / 30,
  ranger: 7 / 30,
  herbalist: 7 / 30,
};
// Millisecond exposure sheets. Runtime durations may stretch a phase, but the
// relative exposure of each drawing and the explicit strike marker stay intact.
export const FRAME_EXPOSURES = Object.freeze({
  windup: [90, 80, 50],
  attack: [40, 40],
  recover: [60, 90, 110],
  walk: [110, 70, 60, 80, 110, 70, 60, 80],
  idle: [160, 140, 120, 140, 160, 140, 120, 140],
});
export const PLAYER_HIT_MARKER = Object.freeze({ animation: "attack", index: 1 });
export const HIT_OFFSET = STRIKE_DURATION *
  FRAME_EXPOSURES.attack.slice(0,PLAYER_HIT_MARKER.index).reduce((a,b)=>a+b,0) /
  FRAME_EXPOSURES.attack.reduce((a,b)=>a+b,0);
export function attackTimeline(now, classId) {
  const strikeAt = now + (WINDUP_DURATION[classId] || 0.22);
  return {
    start: now,
    strikeAt,
    hitAt: strikeAt + HIT_OFFSET,
    strikeEnd: strikeAt + STRIKE_DURATION,
    endAt: strikeAt + STRIKE_DURATION + RECOVERY_DURATION,
  };
}
export function animationFrame(layout, anim, time, start, duration) {
  return animationSample(layout, anim, time, start, duration).frame;
}
export function animationSample(layout, anim, time, start = 0, duration = null) {
  const clip = layout.clips?.[anim];
  const frames =
    clip?.frames || layout.animations[anim] || layout.animations.idle;
  const age = Math.max(0, time - start);
  const once = clip?.loop===false || ["windup", "attack", "recover", "hurt", "death"].includes(anim);
  const span = once
    ?
      duration ||
      {
        attack: STRIKE_DURATION,
        windup: 0.24,
        recover: RECOVERY_DURATION,
        hurt: MONSTER_HIT_DURATION,
        death: 0.85,
      }[anim] || clip?.duration || (clip?.durationsMs?.reduce((a,b)=>a+b,0)||720)/1000
    : duration || clip?.duration || (anim === "walk" ? WALK_DURATION : 0.72);
  const weights = clip?.durationsMs?.length === frames.length
    ? clip.durationsMs
    : frames.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const durations = weights.map((ms) => ms / total * span);
  const at = once ? Math.min(age, span) : age - Math.floor((age + 1e-9) / span) * span;
  let index = 0, boundary = durations[0];
  while (index < frames.length - 1 && at + 1e-9 >= boundary)
    boundary += durations[++index];
  return {
    frame: frames[index], index, animation: anim,
    durationMs: durations[index] * 1000,
    frameStart: boundary - durations[index],
    elapsed: Math.max(0, at - boundary + durations[index]),
    span, events: clip?.events?.[index] || [],
  };
}

// One phase per individual actor, rather than a global clock shared by every
// creature. Changing heading preserves the footfall; starting a new movement
// starts at contact. These visual clocks never change authoritative hit times.
export class LocomotionClocks {
  constructor() {
    this.actors = new Map();
    this.distances = new Map();
  }
  // World-space displacement, not screen/camera displacement. Heading changes
  // preserve phase, warps reset it, and standing still never pedals in place.
  walkTime(key, now, position, stridePx = 48, duration = WALK_DURATION) {
    if (!position) return null;
    let state = this.distances.get(key);
    const dx = state ? position.x - state.x : 0;
    const dy = state ? position.y - state.y : 0;
    const distance = Math.hypot(32 * (dx - dy), 16 * (dx + dy));
    const reset = !state || state.map !== position.map || now < state.time ||
      now - state.time > .3 || distance > 128;
    if (reset) state = { phase: 0 };
    else state.phase += distance / Math.max(1, stridePx);
    Object.assign(state, position, { time: now });
    this.distances.set(key, state);
    if (this.distances.size > 1200)
      for (const [id, old] of this.distances)
        if (now - old.time > 10) this.distances.delete(id);
    return state.phase * duration;
  }
  stopWalk(key) { this.distances.delete(key); }
  start(key, anim, now) {
    let state = this.actors.get(key);
    if (!state || now < state.seen || now - state.seen > 2) {
      let seed = 0;
      for (const c of key) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
      seed = Math.imul(seed ^ (seed >>> 16), 0x7feb352d);
      seed = Math.imul(seed ^ (seed >>> 15), 0x846ca68b);
      seed = (seed ^ (seed >>> 16)) >>> 0;
      state = {
        anim,
        start: now - (anim === "idle" ? (seed % 720) / 1000 : 0),
        seen: now,
      };
    } else if (state.anim !== anim) {
      state = { anim, start: now, seen: now };
    }
    state.seen = now;
    this.actors.set(key, state);
    if (this.actors.size > 1200)
      for (const [id, old] of this.actors)
        if (now - old.seen > 10) this.actors.delete(id);
    return state.start;
  }
}
