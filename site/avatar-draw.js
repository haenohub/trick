// The same measured palm/grip transform is used in the field and previews.
export function heldWeaponPose(layout, weapon, frame, dir) {
  const a = layout.anchors?.[dir]?.[frame];
  if (!a) return null;
  const grip = weapon.grips[dir],
    axis = weapon.axes?.[dir] || 0;
  const side = a.hand[0] < 48 ? -1 : 1,
    rest = side * 0.18 - axis;
  const strike = (dir * Math.PI) / 4 - axis;
  const weight = [0, 0.1, 0.35, 0.85, 1, 0.5, 0, 0][frame] || 0;
  const turn = Math.atan2(Math.sin(strike - rest), Math.cos(strike - rest));
  const rotation =
    weapon.kind === "spear"
      ? rest + turn * weight
      : rest + ([0, -0.12, -0.22, 0.16, 0.22, 0.1, 0, 0][frame] || 0) * side;
  return {
    hand: a.hand,
    grip,
    angle: rotation + (a.angle || 0),
    col: dir,
    row: weapon.index,
    size: 96,
  };
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
) {
  const layout = appearance.layout,
    order = (l) => l.orderByDirection?.[dir] ?? l.order ?? 10;
  const layers = appearance.layers.toSorted((a, b) => order(a) - order(b));
  for (const layer of layers) {
    const image = images.get(layer.file);
    if (!image) continue;
    if (layer.held) {
      const p = heldWeaponPose(layout, layer, frame, dir);
      if (!p) continue;
      ctx.save();
      ctx.translate(
        Math.round(left + p.hand[0] * scale),
        Math.round(top + p.hand[1] * scale),
      );
      ctx.rotate(p.angle);
      ctx.drawImage(
        image,
        p.col * 96,
        p.row * 96,
        96,
        96,
        -p.grip[0] * scale,
        -p.grip[1] * scale,
        96 * scale,
        96 * scale,
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
