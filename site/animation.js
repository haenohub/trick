// The authoritative hit offset and visible strike frames share this clock.
// Reference hunting clip: 30 fps. A short release/contact, followed by a
// readable planted-foot follow-through instead of snapping straight to idle.
export const STRIKE_DURATION = 4 / 30;
export const HIT_OFFSET = STRIKE_DURATION / 2;
export const RECOVERY_DURATION = 8 / 30;
export const WALK_DURATION = 1.28;
export const WINDUP_DURATION = {
  warden: 6 / 30,
  mage: 8 / 30,
  ranger: 7 / 30,
  herbalist: 7 / 30,
};
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
  const clip = layout.clips?.[anim];
  const frames =
    clip?.frames || layout.animations[anim] || layout.animations.idle;
  const age = Math.max(0, time - start);
  if (["windup", "attack", "recover", "hurt", "death"].includes(anim)) {
    const span =
      duration ||
      {
        attack: STRIKE_DURATION,
        windup: 0.24,
        recover: RECOVERY_DURATION,
        hurt: 0.3,
        death: 0.85,
      }[anim];
    return frames[
      Math.min(
        frames.length - 1,
        Math.floor((age / span) * frames.length + 1e-8),
      )
    ];
  }
  const span = clip?.duration || (anim === "walk" ? WALK_DURATION : 0.72);
  return frames[
    Math.floor((age / span) * frames.length + 1e-8) % frames.length
  ];
}

// One phase per individual actor, rather than a global clock shared by every
// creature. Changing heading preserves the footfall; starting a new movement
// starts at contact. These visual clocks never change authoritative hit times.
export class LocomotionClocks {
  constructor() {
    this.actors = new Map();
  }
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
