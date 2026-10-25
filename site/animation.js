// The authoritative hit offset and visible strike frames share this clock.
export const STRIKE_DURATION = 0.14;
export const HIT_OFFSET = STRIKE_DURATION / 2;
export const RECOVERY_DURATION = 0.18;
export const WINDUP_DURATION = {
  warden: 0.22,
  mage: 0.26,
  ranger: 0.18,
  herbalist: 0.24,
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
  const frames = layout.animations[anim] || layout.animations.idle;
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
  return frames[
    Math.floor(time * (anim === "walk" ? frames.length / 0.5 : 1.5)) %
      frames.length
  ];
}
