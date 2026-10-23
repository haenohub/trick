// Coordinates are measured against the image-generated map backgrounds.
// They are navigation data, never drawn as replacement artwork.
export const worldToImage = (x, y) => ({
  u: 0.5 + (x - y) / 60,
  v: 0.125 + (x + y) / 80,
});
export const imageToWorld = (u, v) => ({
  x: 30 * (u - 0.5) + 40 * (v - 0.125),
  y: -30 * (u - 0.5) + 40 * (v - 0.125),
});
const field = [
  [0.2, 0.36],
  [0.37, 0.25],
  [0.68, 0.27],
  [0.81, 0.4],
  [0.82, 0.56],
  [0.66, 0.74],
  [0.35, 0.74],
  [0.19, 0.56],
];
const town = [
  [0.22, 0.37],
  [0.38, 0.25],
  [0.7, 0.27],
  [0.8, 0.4],
  [0.82, 0.52],
  [0.67, 0.7],
  [0.43, 0.76],
  [0.25, 0.61],
];
export const NAVIGATION = Object.fromEntries(
  [
    "village",
    "sprout",
    "acorn",
    "brook",
    "stump",
    "shelltown",
    "saltwood",
    "glassbeach",
    "tideroot",
    "seacave",
  ].map((id) => [
    id,
    {
      polygon: ["village", "shelltown"].includes(id) ? town : field,
      obstacles:
        id === "village" ? [{ u: 0.525, v: 0.245, rx: 0.11, ry: 0.09 }] : [],
      west: imageToWorld(0.28, 0.5),
      east: imageToWorld(0.72, 0.5),
    },
  ]),
);
// Traced against the finished backgrounds: rivers, roofs and dense roots stay outside.
const floors = {
  shelltown: [
    [0.23, 0.43],
    [0.4, 0.3],
    [0.65, 0.31],
    [0.79, 0.42],
    [0.79, 0.55],
    [0.67, 0.66],
    [0.4, 0.68],
    [0.24, 0.56],
  ],
  tideroot: [
    [0.22, 0.44],
    [0.39, 0.32],
    [0.66, 0.32],
    [0.79, 0.44],
    [0.78, 0.56],
    [0.64, 0.65],
    [0.38, 0.65],
    [0.23, 0.55],
  ],
  sprout: [
    [0.22, 0.38],
    [0.38, 0.29],
    [0.67, 0.29],
    [0.79, 0.4],
    [0.8, 0.55],
    [0.64, 0.68],
    [0.37, 0.66],
    [0.23, 0.56],
  ],
  acorn: [
    [0.23, 0.41],
    [0.37, 0.29],
    [0.65, 0.3],
    [0.78, 0.42],
    [0.78, 0.55],
    [0.64, 0.65],
    [0.44, 0.65],
    [0.29, 0.56],
  ],
  brook: [
    [0.23, 0.46],
    [0.38, 0.34],
    [0.66, 0.34],
    [0.79, 0.44],
    [0.78, 0.56],
    [0.65, 0.65],
    [0.37, 0.62],
  ],
  stump: [
    [0.22, 0.45],
    [0.38, 0.38],
    [0.68, 0.38],
    [0.8, 0.46],
    [0.78, 0.58],
    [0.66, 0.72],
    [0.38, 0.72],
    [0.23, 0.57],
  ],
  saltwood: [
    [0.22, 0.44],
    [0.39, 0.3],
    [0.65, 0.3],
    [0.8, 0.43],
    [0.79, 0.55],
    [0.66, 0.68],
    [0.42, 0.67],
    [0.24, 0.55],
  ],
  glassbeach: [
    [0.25, 0.45],
    [0.38, 0.36],
    [0.64, 0.36],
    [0.77, 0.46],
    [0.75, 0.56],
    [0.64, 0.66],
    [0.38, 0.64],
    [0.26, 0.56],
  ],
  seacave: [
    [0.24, 0.44],
    [0.41, 0.34],
    [0.65, 0.34],
    [0.78, 0.44],
    [0.78, 0.56],
    [0.66, 0.7],
    [0.45, 0.64],
    [0.27, 0.54],
  ],
};
for (const [id, polygon] of Object.entries(floors))
  NAVIGATION[id].polygon = polygon;
NAVIGATION.stump.boss = imageToWorld(0.57, 0.57);
NAVIGATION.seacave.boss = imageToWorld(0.58, 0.56);
export function isWalkable(map, x, y) {
  const nav = NAVIGATION[map];
  if (!nav) return false;
  const { u, v } = worldToImage(x, y),
    polygon = nav.polygon;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i],
      [xj, yj] = polygon[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return (
    inside &&
    !nav.obstacles.some(
      (o) => ((u - o.u) / o.rx) ** 2 + ((v - o.v) / o.ry) ** 2 < 1,
    )
  );
}
export const NPC_POSITIONS = Object.fromEntries(
  [
    ["guide", 0.43, 0.42],
    ["smith", 0.65, 0.39],
    ["healer", 0.36, 0.6],
    ["merchant", 0.65, 0.57],
    ["coastguide", 0.43, 0.42],
    ["coastsmith", 0.65, 0.39],
    ["coasthealer", 0.36, 0.6],
    ["mentor", 0.65, 0.57],
  ].map(([id, u, v]) => [id, imageToWorld(u, v)]),
);
