// Quarter-view ground projection shared by painting, picking and facing.
// Map-space square cells become 2:1 diamonds; actors remain upright billboards.
export function project(x, y) {
  return { x: 32 * (x - y), y: 16 * (x + y) };
}
export function unproject(x, y) {
  return { x: x / 64 + y / 32, y: y / 32 - x / 64 };
}
export function viewAnchor(width, height, zoom) {
  return { x: width / 2, y: height / 2 + 24 * zoom };
}
// Fit the same projected world to a small UI canvas without rotating markers
// separately from the ground. The returned frame is shared by all map layers.
export function fitProjected(points, width, height, padding = 4) {
  const corners = points.map((p) => project(p.x, p.y));
  const minX = Math.min(...corners.map((p) => p.x)),
    maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y)),
    maxY = Math.max(...corners.map((p) => p.y));
  const scale = Math.min(
    (width - padding * 2) / (maxX - minX),
    (height - padding * 2) / (maxY - minY),
  );
  const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
  const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;
  return {
    scale,
    offsetX,
    offsetY,
    corners: corners.map((p) => ({
      x: offsetX + p.x * scale,
      y: offsetY + p.y * scale,
    })),
    point(x, y) {
      const p = project(x, y);
      return { x: offsetX + p.x * scale, y: offsetY + p.y * scale };
    },
  };
}
