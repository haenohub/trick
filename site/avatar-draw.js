// The same measured palm/grip transform is used in the field and previews.
export const HELD_WEAPON_SCALE = 0.8;
export function heldWeaponTransform(pose, left, top, scale=1) {
  const s=scale*pose.weaponScale,c=Math.cos(pose.angle),n=Math.sin(pose.angle);
  const a=s*c,b=s*n,d=s*c,e=-s*n;
  const tx=left+pose.hand[0]*scale,ty=top+pose.hand[1]*scale;
  const matrix=[a,b,e,d,tx-pose.grip[0]*a-pose.grip[1]*e,ty-pose.grip[0]*b-pose.grip[1]*d];
  return {matrix,hand:[tx,ty],point([x,y]){return[matrix[0]*x+matrix[2]*y+matrix[4],matrix[1]*x+matrix[3]*y+matrix[5]];}};
}
export function heldWeaponPose(layout, weapon, frame, dir, motion = null) {
  const binding=layout.frameRig?.frames?.[dir]?.[frame];
  if(binding && weapon.poseSets){
    const sourceDir=weapon.kind==="bow"?(motion?.skyshot?0:motion?.aimDir??dir):dir;
    const source=weapon.poseSets[sourceDir]?.[binding.pose]||weapon.poseSets[sourceDir]?.ready;
    if(!source)return null;
    return {
      hand:binding.hand,grip:source.grip,angle:source.angle,
      weaponScale:source.scale,col:source.col,row:source.row,size:source.size,
      file:source.file,tip:source.tip,depth:binding.depth,
      frame,pose:binding.pose,registered:true,
    };
  }
  const a = layout.anchors?.[dir]?.[frame] || layout.anchors?.[dir]?.[0];
  if (!a) return null;
  const sourceDir =
    weapon.kind === "bow"
      ? motion?.skyshot
        ? 0
        : (motion?.aimDir ?? dir)
      : dir;
  const grip = weapon.grips[sourceDir],
    axis =
      weapon.kind === "bow" && weapon.forwardAxes
        ? weapon.forwardAxes[sourceDir]
        : weapon.axes?.[sourceDir] || 0;
  const side = a.hand[0] < 48 ? -1 : 1,
    rest =
      weapon.kind === "bow" && weapon.forwardAxes
        ? (sourceDir * Math.PI) / 4 - axis
        : side * 0.18 - axis;
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
          ? t < 0.5
            ? 2 + t * 4
            : 4 + (t - 0.5) * 2
          : 5 + t;
  }
  const keys =
    weapon.kind === "spear"
      ? [0, -0.18, -0.38, -0.12, 0, 0.18, 0]
      : weapon.kind === "bow"
        ? [0, -0.1, -0.2, -0.05, 0, 0.08, 0]
        : weapon.kind === "staff"
          ? [0, -0.35, -0.6, -0.4, 0, 0.2, 0]
          : [0, -0.5, -0.8, -0.3, 0, 0.3, 0];
  const lo = Math.min(6, Math.floor(pose)),
    hi = Math.min(6, lo + 1),
    mix = pose - Math.floor(pose),
    flick = (keys[lo] + (keys[hi] - keys[lo]) * mix) * side;
  const active =
    phase ||
    motion?.combatReady ||
    Number.isInteger(motion?.aimDir) ||
    frame < 7 ||
    (frame >= 8 && frame < 15);
  // Measured axes are clockwise from UP, like the direction rows. A bow's
  // long axis is perpendicular to its shot; the mage casts up, not sideways.
  const aimed =
    weapon.kind === "bow"
      ? motion?.skyshot
        ? weapon.forwardAxes
          ? 0
          : -Math.PI / 2
        : ((motion?.aimDir ?? dir) * Math.PI) / 4 -
          (weapon.forwardAxes ? 0 : Math.PI / 2)
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
      HELD_WEAPON_SCALE *
      (active && ["spear", "wand"].includes(weapon.kind)
        ? 1 - 0.3 * Math.abs(Math.cos((dir * Math.PI) / 4))
        : 1),
    col: sourceDir,
    row: weapon.index,
    size: 96,
  };
}
export function heldWeaponTip(layout, weapon, frame, dir, motion = null) {
  const pose = heldWeaponPose(layout, weapon, frame, dir, motion);
  if (!pose) return null;
  if (weapon.kind === "bow") return pose.hand;
  const tip = pose.tip || weapon.tips?.[dir] || [
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
    binding=layout.frameRig?.frames?.[dir]?.[frame],
    order = (l) => l.held && binding
      ? (binding.depth==="behind"?-10:50)
      : l.orderByDirection?.[dir] ?? l.order ?? 10;
  const layers = appearance.layers.toSorted((a, b) => order(a) - order(b));
  const originX=Math.round(left),originY=Math.round(top);
  if(motion?.flipX){ctx.save();ctx.translate(2*originX+96*scale,0);ctx.scale(-1,1);}
  for (const layer of layers) {
    const registeredPose=layer.held&&binding?heldWeaponPose(layout,layer,frame,dir,motion):null;
    const image = images.get(registeredPose?.file||layer.file);
    if (!image) continue;
    if (layer.held) {
      const p = registeredPose || heldWeaponPose(layout, layer, frame, dir, motion);
      if (!p) continue;
      ctx.save();
      ctx.translate(
        binding?originX+p.hand[0]*scale:Math.round(left + p.hand[0] * scale),
        binding?originY+p.hand[1]*scale:Math.round(top + p.hand[1] * scale),
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
        originX,
        originY,
        96 * scale,
        96 * scale,
      );
  }
  if(motion?.debug && binding){
    const p=layers.find(l=>l.held),pose=p?heldWeaponPose(layout,p,frame,dir,motion):null;
    const point=(a,color,r)=>{ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=1.5;ctx.arc(originX+a[0]*scale,originY+a[1]*scale,r,0,Math.PI*2);ctx.stroke();};
    point(binding.ground,"#48e9ee",5);point(binding.hand,"#ff69d5",8);
    if(pose){
      const transformed=heldWeaponTransform(pose,originX,originY,scale);
      const actual=transformed.point(pose.grip);
      const grip=[(actual[0]-originX)/scale,(actual[1]-originY)/scale];
      point(grip,"#ffe58e",3);
    }
  }
  if(motion?.flipX)ctx.restore();
}
