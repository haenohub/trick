// Atlas rows follow screen compass headings in the isometric world.
export const DIRECTIONS = [
  { id: "N", label: "상 · 북" },
  { id: "NE", label: "북동" },
  { id: "E", label: "우 · 동" },
  { id: "SE", label: "남동" },
  { id: "S", label: "하 · 남" },
  { id: "SW", label: "남서" },
  { id: "W", label: "좌 · 서" },
  { id: "NW", label: "북서" },
];
export const SOUTH = 4;
export function direction(dx, dy, fallback = SOUTH) {
  if (Math.hypot(dx, dy) < 1e-8) return fallback;
  const screenX = dx - dy,
    screenY = (dx + dy) / 2;
  return (Math.round(Math.atan2(screenX, -screenY) / (Math.PI / 4)) + 8) % 8;
}
export function facingVector(dir) {
  const angle = (dir * Math.PI) / 4;
  const sx = Math.sin(angle),
    sy = -Math.cos(angle);
  const x = sx / 2 + sy,
    y = sy - sx / 2;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}
export function facesTarget(actor, target) {
  const forward = facingVector(actor.dir);
  return (
    forward.x * (target.x - actor.x) + forward.y * (target.y - actor.y) > 1e-8
  );
}
