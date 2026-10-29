// The same measured palm/grip transform is used in the field and previews.
export function heldWeaponPose(layout, weapon, frame, dir, motion = null) {
  const a = layout.anchors?.[dir]?.[frame];
  if (!a) return null;
  const grip = weapon.grips[dir],
    axis = weapon.axes?.[dir] || 0;
  const side = a.hand[0] < 48 ? -1 : 1,
    rest = side * 0.18 - axis;
  const phase = ["windup", "attack", "recover"].includes(motion?.anim);
  let pose = frame < 8 ? frame : frame < 16 ? frame - 8 : 0;
  if (phase) {
    const t = Math.max(
      0,
      Math.min(1, (motion.time - motion.start) / motion.duration),
    );
    pose =
      motion.anim === "windup"
        ? t * 2
        : motion.anim === "attack"
          ? 3 + t
          : 4 + t * 2;
  }
  const keys =
    weapon.kind === "spear"
      ? [0, -0.08, -0.12, -0.03, 0, 0.04, 0]
      : weapon.kind === "bow"
        ? [0, -0.04, -0.07, -0.025, 0.025, 0.035, 0]
        : weapon.kind === "staff"
          ? [0, -0.08, -0.16, -0.1, 0.03, 0.06, 0]
          : [0, -0.1, -0.18, -0.04, 0.12, 0.05, 0];
  const lo = Math.min(6, Math.floor(pose)),
    hi = Math.min(6, lo + 1),
    mix = pose - Math.floor(pose),
    flick = (keys[lo] + (keys[hi] - keys[lo]) * mix) * side;
  const active =
    phase || motion?.combatReady || frame < 7 || (frame >= 8 && frame < 15);
  // Measured axes are clockwise from UP, like the direction rows. A bow's
  // long axis is perpendicular to its shot; the mage casts up, not sideways.
  const aimed =
    weapon.kind === "bow"
      ? motion?.skyshot
        ? -Math.PI / 2
        : (dir * Math.PI) / 4 - Math.PI / 2
      : weapon.kind === "staff"
        ? side * 0.12
        : (dir * Math.PI) / 4;
  const desired = active ? aimed - axis + flick : rest + (a.angle || 0);
  const rotation =
    rest + Math.atan2(Math.sin(desired - rest), Math.cos(desired - rest));
  return {
    hand: a.hand,
    grip,
    angle: rotation,
    weaponScale:
      active && ["spear", "wand"].includes(weapon.kind)
        ? 1 - 0.3 * Math.abs(Math.cos((dir * Math.PI) / 4))
        : 1,
    col: dir,
    row: weapon.index,
    size: 96,
  };
}
export function heldWeaponTip(layout, weapon, frame, dir, motion = null) {
  const pose = heldWeaponPose(layout, weapon, frame, dir, motion);
  if (!pose) return null;
  if (weapon.kind === "bow") return pose.hand;
  const tip = weapon.tips?.[dir] || [
    pose.grip[0] + Math.sin(weapon.axes?.[dir] || 0) * 36,
    pose.grip[1] - Math.cos(weapon.axes?.[dir] || 0) * 36,
  ];
  const dx = (tip[0] - pose.grip[0]) * pose.weaponScale,
    dy = (tip[1] - pose.grip[1]) * pose.weaponScale;
  return [
    pose.hand[0] + dx * Math.cos(pose.angle) - dy * Math.sin(pose.angle),
    pose.hand[1] + dx * Math.sin(pose.angle) + dy * Math.cos(pose.angle),
  ];
}
export function drawPaperDoll(
  ctx,
  appearance,
  images,
  frame,
  dir,
  left,
  top,
  scale = 1,
  motion = null,
) {
  const layout = appearance.layout,
    order = (l) => l.orderByDirection?.[dir] ?? l.order ?? 10;
  const layers = appearance.layers.toSorted((a, b) => order(a) - order(b));
  for (const layer of layers) {
    const image = images.get(layer.file);
    if (!image) continue;
    if (layer.held) {
      const p = heldWeaponPose(layout, layer, frame, dir, motion);
      if (!p) continue;
      ctx.save();
      ctx.translate(
        Math.round(left + p.hand[0] * scale),
        Math.round(top + p.hand[1] * scale),
      );
      ctx.rotate(p.angle);
      const span = 96 * scale * p.weaponScale;
      ctx.drawImage(
        image,
        p.col * 96,
        p.row * 96,
        96,
        96,
        -(p.grip[0] * span) / 96,
        -(p.grip[1] * span) / 96,
        span,
        span,
      );
      ctx.restore();
    } else
      ctx.drawImage(
        image,
        frame * 96,
        dir * 96,
        96,
        96,
        Math.round(left),
        Math.round(top),
        96 * scale,
        96 * scale,
      );
  }
}
