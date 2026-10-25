// Quarter-view ground projection shared by painting, picking and facing.
// Map-space square cells become 2:1 diamonds; actors remain upright billboards.
export function project(x, y) {
  return { x: 16 * x - 48 * y, y: 24 * x - 8 * y };
}
export function unproject(x, y) {
  return { x: -x / 128 + (3 * y) / 64, y: (-3 * x) / 128 + y / 64 };
}
export function viewAnchor(width, height, zoom) {
  return { x: width / 2, y: height / 2 + 24 * zoom };
}
