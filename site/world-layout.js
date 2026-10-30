import { ISOMETRIC_LAYOUTS } from "./isometric-layouts.js";
// Shared terrain layout: all visible cells use image-generated terrain textures.
export const TILE = 112;
export const LAYOUT_VERSION = 4;
// Show 20% more world in each dimension without scaling any HTML text.
export const WORLD_ZOOM = 1.21 / 1.2;
const baseline = {
  village: 130496,
  sprout: 114464,
  acorn: 95392,
  brook: 80960,
  stump: 98480,
  shelltown: 103728,
  saltwood: 105024,
  glassbeach: 75712,
  tideroot: 94352,
  seacave: 85456,
};
const specs = {
  village: {
    cols: 21,
    rows: 12,
    shape: "분수 광장과 네 갈래 생활길",
    route: [
      [2, 6],
      [7, 6],
      [17, 6],
    ],
    branches: [
      [
        [7, 6],
        [10, 3],
      ],
      [
        [7, 6],
        [7, 9],
      ],
      [
        [10, 3],
        [14, 3],
        [14, 6],
      ],
    ],
    rooms: [
      [7, 6, 2.1],
      [14, 6, 1.4],
      [7, 9, 1],
    ],
    spawn: [5, 6],
    fountain: [7, 5],
    npcs: { guide: [4, 6], smith: [10, 3], healer: [7, 9], merchant: [14, 6] },
  },
  sprout: {
    cols: 30,
    rows: 10,
    shape: "길게 뻗은 밭둑길과 세 쉼터",
    route: [
      [2, 5],
      [8, 5],
      [13, 3],
      [19, 3],
      [23, 6],
      [27, 6],
    ],
    rooms: [
      [7, 5, 1],
      [16, 3, 1],
      [24, 6, 1.2],
    ],
    habitats: [
      [6, 5],
      [10, 4],
      [15, 3],
      [21, 4],
      [25, 6],
    ],
    props: [
      [2, 1, 4],
      [3, 15, 1],
    ],
  },
  acorn: {
    cols: 18,
    rows: 20,
    shape: "남북으로 이어지는 계단형 샛길",
    route: [
      [3, 17],
      [3, 12],
      [12, 12],
      [12, 6],
      [7, 6],
      [7, 2],
      [14, 2],
    ],
    rooms: [
      [3, 14, 1],
      [12, 9, 1],
      [7, 4, 1],
    ],
    habitats: [
      [3, 15],
      [6, 12],
      [12, 10],
      [9, 6],
      [13, 2],
    ],
    props: [
      [11, 13, 1],
      [15, 3, 17],
    ],
  },
  brook: {
    cols: 26,
    rows: 14,
    shape: "징검다리 세 곳을 잇는 지그재그 강변길",
    route: [
      [2, 11],
      [8, 11],
      [8, 3],
      [17, 3],
      [17, 10],
      [23, 10],
    ],
    rooms: [
      [8, 11, 0.8],
      [12, 3, 0.8],
      [20, 10, 0.8],
    ],
    habitats: [
      [5, 11],
      [8, 7],
      [12, 3],
      [17, 7],
      [22, 10],
    ],
    bridges: [
      [5, 11],
      [12, 3],
      [20, 10],
    ],
  },
  stump: {
    cols: 18,
    rows: 18,
    shape: "뿌리 고리길과 안쪽 수호자 터",
    route: [
      [2, 9],
      [5, 9],
      [5, 4],
      [12, 4],
      [14, 8],
      [12, 13],
      [5, 13],
      [5, 9],
      [9, 9],
      [15, 9],
    ],
    rooms: [[9, 9, 1.7]],
    habitats: [
      [5, 10],
      [5, 5],
      [11, 4],
      [12, 12],
      [9, 9],
    ],
    boss: [9, 9],
    props: [
      [9, 9, 6],
      [15, 2, 8],
    ],
  },
  shelltown: {
    cols: 22,
    rows: 12,
    shape: "조개 광장과 반달형 선착장 길",
    route: [
      [3, 8],
      [7, 8],
      [7, 4],
      [14, 4],
      [17, 7],
      [19, 7],
    ],
    branches: [
      [
        [10, 4],
        [10, 8],
        [17, 8],
        [17, 7],
      ],
      [
        [14, 4],
        [15, 3],
      ],
    ],
    rooms: [
      [7, 7, 1.8],
      [16, 7, 1.2],
      [15, 3, 0.9],
    ],
    spawn: [6, 8],
    npcs: {
      coastguide: [6, 8],
      coastsmith: [7, 3],
      coasthealer: [11, 8],
      mentor: [15, 3],
    },
    props: [[13, 19, 7, true]],
  },
  saltwood: {
    cols: 28,
    rows: 12,
    shape: "바람을 가르는 두 갈래 순환길",
    route: [
      [2, 7],
      [8, 7],
      [13, 4],
      [20, 4],
      [25, 7],
    ],
    branches: [
      [
        [8, 7],
        [8, 2],
        [16, 2],
        [16, 4],
      ],
      [
        [20, 4],
        [20, 9],
        [25, 9],
        [25, 7],
      ],
    ],
    rooms: [],
    habitats: [
      [6, 7],
      [9, 2],
      [15, 4],
      [21, 9],
      [25, 7],
    ],
    props: [
      [14, 12, 1],
      [15, 2, 6],
    ],
  },
  glassbeach: {
    cols: 30,
    rows: 10,
    shape: "만을 따라 휘어진 모래 해변",
    route: [
      [2, 7],
      [7, 7],
      [11, 3],
      [18, 3],
      [23, 6],
      [27, 6],
    ],
    branches: [
      [
        [18, 3],
        [18, 7],
      ],
    ],
    rooms: [
      [7, 7, 0.9],
      [13, 3, 1],
      [25, 6, 1.1],
    ],
    habitats: [
      [6, 7],
      [11, 3],
      [16, 3],
      [21, 5],
      [26, 6],
    ],
    props: [
      [13, 18, 7, true],
      [14, 12, 1],
    ],
  },
  tideroot: {
    cols: 24,
    rows: 15,
    shape: "섬 다섯 곳을 잇는 굽은 나무길",
    route: [
      [2, 12],
      [7, 12],
      [7, 5],
      [12, 5],
      [12, 10],
      [17, 10],
      [17, 3],
      [21, 3],
    ],
    rooms: [
      [7, 11, 0.9],
      [12, 6, 0.9],
      [17, 9, 0.9],
      [20, 3, 1],
    ],
    habitats: [
      [6, 12],
      [8, 5],
      [12, 9],
      [17, 8],
      [20, 3],
    ],
    bridges: [
      [4, 12],
      [10, 5],
      [15, 10],
      [19, 3],
    ],
  },
  seacave: {
    cols: 22,
    rows: 16,
    shape: "수정 굴방과 깊은 해룡의 방",
    route: [
      [2, 13],
      [2, 8],
      [6, 8],
      [6, 4],
      [13, 4],
      [13, 10],
      [18, 10],
      [18, 5],
      [20, 5],
    ],
    branches: [
      [
        [6, 8],
        [9, 8],
        [9, 11],
      ],
    ],
    rooms: [
      [18, 5, 1.4],
      [9, 10, 0.7],
    ],
    habitats: [
      [2, 11],
      [6, 6],
      [10, 4],
      [15, 10],
      [18, 5],
    ],
    boss: [18, 5],
    props: [
      [10, 19, 2],
      [14, 9, 10],
    ],
  },
};
// Deliberately different forks, reconnecting loops and gathering clearings.
const dynamicRoutes = {
  sprout: {
    branches: [
      [
        [8, 5],
        [8, 7],
        [16, 7],
        [20, 6],
        [23, 6],
      ],
      [
        [13, 3],
        [16, 5],
        [16, 7],
      ],
    ],
    rooms: [
      [16, 7, 1.5],
      [19, 3, 1.3],
    ],
  },
  acorn: {
    branches: [
      [
        [3, 12],
        [7, 12],
        [7, 6],
      ],
      [
        [7, 9],
        [12, 9],
      ],
    ],
    rooms: [
      [9, 9, 1.7],
      [7, 12, 1.2],
    ],
  },
  brook: {
    branches: [
      [
        [8, 11],
        [12, 11],
        [12, 7],
        [17, 7],
      ],
      [
        [8, 7],
        [12, 7],
      ],
    ],
    rooms: [
      [12, 7, 1.4],
      [17, 10, 1.1],
    ],
    bridges: [[12, 7]],
  },
  stump: {
    branches: [
      [
        [5, 4],
        [9, 4],
        [9, 9],
      ],
      [
        [12, 13],
        [9, 13],
        [9, 9],
      ],
    ],
    rooms: [
      [9, 9, 2],
      [9, 13, 1],
    ],
  },
  saltwood: {
    branches: [
      [
        [8, 7],
        [13, 7],
        [20, 7],
        [20, 4],
      ],
    ],
    rooms: [
      [13, 7, 1.6],
      [20, 7, 1.1],
    ],
  },
  glassbeach: {
    branches: [
      [
        [7, 7],
        [7, 3],
        [11, 3],
      ],
      [
        [18, 7],
        [23, 7],
        [23, 6],
      ],
    ],
    rooms: [
      [18, 7, 1.4],
      [7, 3, 0.9],
    ],
  },
  tideroot: {
    branches: [
      [
        [7, 12],
        [12, 12],
        [17, 12],
        [17, 10],
      ],
      [
        [7, 5],
        [7, 3],
        [12, 3],
        [17, 3],
      ],
      [
        [12, 5],
        [17, 5],
        [17, 10],
      ],
    ],
    rooms: [
      [12, 10, 1.4],
      [17, 5, 1.3],
    ],
  },
  seacave: {
    branches: [
      [
        [6, 8],
        [13, 8],
        [13, 10],
      ],
      [
        [13, 4],
        [18, 4],
        [18, 5],
      ],
      [
        [9, 11],
        [13, 11],
        [13, 10],
      ],
    ],
    rooms: [
      [9, 8, 1.3],
      [13, 10, 1.6],
    ],
  },
};
for (const [id, additions] of Object.entries(dynamicRoutes)) {
  const spec = specs[id];
  for (const field of ["branches", "rooms", "bridges"])
    spec[field] = [...(spec[field] || []), ...(additions[field] || [])];
  spec.shape += " · 갈림길·합류터·숨은 굽이";
}
// Remap ecological anchors into the new two-dimensional layouts, then snap
// them to connected floor after carving. Services use explicit plaza positions.
const oldDimensions = Object.fromEntries(
  Object.entries(specs).map(([id, s]) => [id, [s.cols, s.rows]]),
);
for (const [id, layout] of Object.entries(ISOMETRIC_LAYOUTS)) {
  const spec = specs[id],
    [ow, oh] = oldDimensions[id],
    scale = ([x, y]) => [
      Math.round((x / (ow - 1)) * (layout.cols - 1)),
      Math.round((y / (oh - 1)) * (layout.rows - 1)),
    ];
  spec.habitats = (spec.habitats || []).map(scale);
  spec.props = (spec.props || []).map(([index, x, y, walkThrough]) => [
    index,
    ...scale([x, y]),
    walkThrough,
  ]);
  Object.assign(spec, layout);
}
const gathering = {
  sprout: [
    ["클로버 밭둑", "softleaf", 8, 7],
    ["그늘진 묘목터", "softleaf", 16, 7],
    ["이슬 고인 흙길", "mint", 19, 3],
  ],
  acorn: [
    ["참나무 그늘", "softleaf", 3, 14],
    ["나이테 쉼터", "softleaf", 9, 9],
    ["축축한 낙엽틈", "mint", 7, 4],
  ],
  brook: [
    ["징검돌 물가", "mint", 8, 7],
    ["개울 합류 웅덩이", "mint", 12, 7],
    ["물가 잎무더기", "softleaf", 20, 10],
  ],
  stump: [
    ["고목 뿌리 정원", "mint", 9, 13],
    ["수관 아래", "softleaf", 5, 5],
    ["뿌리 사이 그늘", "softleaf", 12, 12],
  ],
  saltwood: [
    ["햇볕 드는 소금밭", "saltflower", 13, 7],
    ["바닷바람 꽃터", "saltflower", 21, 9],
    ["바람막이 이끼틈", "breathgrass", 9, 2],
  ],
  glassbeach: [
    ["조개 둔덕", "saltflower", 7, 3],
    ["썰물 꽃밭", "saltflower", 18, 7],
    ["젖은 모래 그늘", "breathgrass", 23, 6],
  ],
  tideroot: [
    ["물금 아래 뿌리", "breathgrass", 7, 11],
    ["밀물이 쉬는 섬", "breathgrass", 17, 5],
    ["마른 섬의 소금꽃", "saltflower", 20, 3],
  ],
  seacave: [
    ["푸른숨 습지", "breathgrass", 9, 11],
    ["수정벽 이슬터", "breathgrass", 13, 10],
    ["굴 입구 소금꽃", "saltflower", 2, 11],
  ],
};
function gridLine(a, b) {
  const path = [a],
    [x0, y0] = a,
    [x1, y1] = b;
  let x = x0,
    y = y0;
  while (x !== x1 || y !== y1) {
    const tx =
      x === x1 ? Infinity : (Math.abs(x - x0) + 0.5) / (Math.abs(x1 - x0) || 1);
    const ty =
      y === y1 ? Infinity : (Math.abs(y - y0) + 0.5) / (Math.abs(y1 - y0) || 1);
    if (tx <= ty) x += Math.sign(x1 - x0);
    else y += Math.sign(y1 - y0);
    path.push([x, y]);
  }
  return path;
}
function carve(spec, width) {
  const floor = Array.from({ length: spec.rows }, () =>
    Array(spec.cols).fill(false),
  );
  const disk = (cx, cy, radius) => {
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++)
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++)
        if (
          x > 0 &&
          y > 0 &&
          x < spec.cols - 1 &&
          y < spec.rows - 1 &&
          Math.hypot(x - cx, y - cy) <= radius
        )
          floor[y][x] = true;
  };
  for (const route of [spec.route, ...(spec.branches || [])])
    for (let i = 1; i < route.length; i++)
      for (const [x, y] of gridLine(route[i - 1], route[i]))
        disk(x, y, width / 2);
  for (const [x, y, r] of spec.rooms || []) disk(x, y, r);
  if (spec.fountain) {
    const [x, y] = spec.fountain;
    floor[y][x] = false;
  }
  return floor;
}
function nearestCell(nav, c, r, northEdge = false) {
  let best = null,
    distance = Infinity;
  for (let y = 1; y < nav.rows - 1; y++)
    for (let x = 1; x < nav.cols - 1; x++)
      if (nav.floor[y][x] && (!northEdge || !nav.floor[y - 1][x])) {
        const d = Math.hypot(x - c, y - r);
        if (d < distance) {
          distance = d;
          best = [x, y];
        }
      }
  return best;
}
const pixelWorld = (px, py, width) => ({
  x: (px - width / 2) / 16,
  y: py / 16,
});
export const NAVIGATION = {};
export const NPC_POSITIONS = {};
const additionalHabitats = {
  sprout: [
    [8, 5],
    [18, 3],
    [23, 6],
  ],
  acorn: [
    [3, 12],
    [12, 6],
    [7, 2],
  ],
  brook: [
    [8, 3],
    [17, 10],
  ],
  stump: [
    [5, 4],
    [12, 13],
  ],
  saltwood: [
    [8, 7],
    [13, 4],
    [20, 4],
  ],
  glassbeach: [
    [7, 3],
    [15, 2],
    [23, 4],
  ],
  tideroot: [
    [7, 7],
    [16, 7],
  ],
  seacave: [
    [8, 5],
    [16, 9],
  ],
};
const npcProps = {
  guide: 0,
  smith: 1,
  healer: 2,
  merchant: 3,
  coastguide: 5,
  coastsmith: 6,
  coasthealer: 7,
  mentor: 8,
};
for (const [id, spec] of Object.entries(specs)) {
  let floor,
    best = Infinity;
  for (let width = 0.8; width <= 2.81; width += 0.2) {
    const candidate = carve(spec, width),
      area = candidate.flat().filter(Boolean).length * TILE * TILE,
      score = Math.abs(area / baseline[id] - 7);
    if (score < best) {
      best = score;
      floor = candidate;
    }
  }
  // Short side passages extend the existing connected floor without moving
  // services or main routes. All new cells reuse the authored terrain atlas.
  let secretPassage = null;
  if (spec.habitats?.length) {
    const anchors = {
      sprout: [16, 5],
      acorn: [9, 9],
      brook: [12, 8],
      stump: [9, 14],
      saltwood: [16, 7],
      glassbeach: [15, 6],
      tideroot: [14, 12],
      seacave: [7, 12],
    };
    const [ax, ay] = anchors[id];
    const candidates = [];
    for (let r = 2; r < spec.rows - 2; r++)
      for (let c = 2; c < spec.cols - 2; c++)
        if (floor[r][c]) {
          for (const [dx, dy] of [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1],
          ]) {
            for (const length of [2, 1])
              for (const side of [-1, 1]) {
                const px = -dy * side,
                  py = dx * side;
                const steps = [
                  ...Array.from({ length }, () => [dx, dy]),
                  [px, py],
                  [px, py],
                  [dx, dy],
                ];
                let x = c,
                  y = r;
                const cells = steps.map(([sx, sy]) => [(x += sx), (y += sy)]);
                if (
                  cells.some(
                    ([x, y], i) =>
                      x < 1 ||
                      y < 1 ||
                      x >= spec.cols - 1 ||
                      y >= spec.rows - 1 ||
                      floor[y][x] ||
                      (i > 0 &&
                        [
                          [1, 0],
                          [-1, 0],
                          [0, 1],
                          [0, -1],
                        ].some(([sx, sy]) => floor[y + sy]?.[x + sx])),
                  )
                )
                  continue;
                const [ex, ey] = cells.at(-1);
                if (
                  (spec.props || []).some(
                    ([, x, y]) => Math.hypot(x - ex, y - ey) < 2,
                  )
                )
                  continue;
                if (
                  spec.boss &&
                  Math.hypot(spec.boss[0] - ex, spec.boss[1] - ey) < 3
                )
                  continue;
                candidates.push({
                  entrance: [c, r],
                  cells,
                  score: Math.hypot(ex - ax, ey - ay) - length * 0.4,
                });
              }
          }
        }
    secretPassage = candidates.sort(
      (a, b) => b.cells.length - a.cells.length || a.score - b.score,
    )[0];
    if (!secretPassage) throw Error("No connected side passage: " + id);
    for (const [x, y] of secretPassage.cells) floor[y][x] = true;
  }
  const nav = {
    ...spec,
    id,
    floor,
    width: spec.cols * TILE,
    height: spec.rows * TILE,
    tileSize: TILE,
    props: [],
    landmarks: [],
    baseline: baseline[id],
  };
  const at = (c, r) =>
    pixelWorld((c + 0.5) * TILE, (r + 0.5) * TILE, nav.width);
  nav.worldAt = at;
  nav.secretPassage = secretPassage
    ? {
        ...secretPassage,
        entrance: at(...secretPassage.entrance),
        finish: at(...secretPassage.cells.at(-1)),
      }
    : null;
  const clueCell = nearestCell(
    nav,
    ...spec.route[Math.min(1, spec.route.length - 1)],
  );
  nav.landmarks = [
    at(...clueCell),
    ...(nav.secretPassage ? [nav.secretPassage.finish] : []),
  ];
  nav.west = at(...spec.route[0]);
  nav.east = at(...spec.route.at(-1));
  const landing = (end, toward) => {
    const a = at(...end),
      b = at(...toward),
      len = Math.hypot(b.x - a.x, b.y - a.y);
    return {
      x: a.x + ((b.x - a.x) * 3.8) / len,
      y: a.y + ((b.y - a.y) * 3.8) / len,
    };
  };
  nav.westLanding = landing(spec.route[0], spec.route[1]);
  nav.eastLanding = landing(spec.route.at(-1), spec.route.at(-2));
  nav.spawn = spec.spawn
    ? at(...nearestCell(nav, ...spec.spawn))
    : nav.westLanding;
  nav.boss = spec.boss ? at(...spec.boss) : null;
  nav.habitats = [
    ...(spec.habitats || []),
    ...(additionalHabitats[id] || []).map(([x, y]) => [
      Math.round((x / (oldDimensions[id][0] - 1)) * (nav.cols - 1)),
      Math.round((y / (oldDimensions[id][1] - 1)) * (nav.rows - 1)),
    ]),
  ].map(([c, r]) => at(...nearestCell(nav, c, r)));
  const prop = (index, c, r, walkThrough = false, footY = (r + 1) * TILE) => {
    const px = (c + 0.5) * TILE,
      py = footY;
    nav.props.push({
      id: id + "-prop-" + nav.props.length,
      index,
      x: pixelWorld(px, py, nav.width).x,
      y: pixelWorld(px, py, nav.width).y,
      px,
      py,
      walkThrough,
    });
  };
  for (const [index, c, r, walkThrough] of spec.props || [])
    prop(index, c, r, walkThrough);
  for (const [c, r] of spec.bridges || [])
    prop(12, c, r, true, (r + 0.5) * TILE);
  if (spec.fountain) {
    const [c, r] = spec.fountain;
    prop(4, c, r, false, (r + 1) * TILE);
  }
  for (const [npc, anchor] of Object.entries(spec.npcs || {})) {
    const [c, r] = nearestCell(nav, ...anchor, true),
      px = (c + 0.5) * TILE,
      py = (r + 0.27) * TILE;
    NPC_POSITIONS[npc] = pixelWorld(px, py, nav.width);
    prop(npcProps[npc], c, r - 1, false, r * TILE - 4);
  }
  nav.gatherSites = (gathering[id] || []).map(([name, item, c, r], index) => ({
    id: id + "-grove-" + index,
    name,
    item,
    ...at(
      ...nearestCell(
        nav,
        Math.round((c / (oldDimensions[id][0] - 1)) * (nav.cols - 1)),
        Math.round((r / (oldDimensions[id][1] - 1)) * (nav.rows - 1)),
      ),
    ),
  }));
  nav.encounterZones = [
    ...nav.habitats,
    ...(spec.rooms || []).map(([c, r]) => at(...nearestCell(nav, c, r))),
    ...(spec.branches || []).map((path) =>
      at(...nearestCell(nav, ...path[Math.floor(path.length / 2)])),
    ),
  ];
  nav.routeCount = 1 + (spec.branches || []).length;
  nav.walkablePixels = floor.flat().filter(Boolean).length * TILE * TILE;
  nav.areaScale = (nav.width * nav.height) / (960 * 640);
  nav.walkableScale = nav.walkablePixels / nav.baseline;
  // Floor cells connect to the same images used by both collision and rendering.
  nav.tiles = floor.map((row, r) =>
    row.map((open, c) => {
      if (!open) {
        if (id === "brook" || id === "tideroot")
          return (c + r) % 6 === 0 ? 13 : 14;
        if (id === "glassbeach" || id === "shelltown") return r < 3 ? 13 : 14;
        if (id === "seacave") return (r + c) % 7 === 0 ? 14 : 15;
        if (id === "saltwood" && r > nav.rows - 3) return 14;
        return (c * 7 + r * 3) % 4 === 0 ? 15 : 13;
      }
      const n = floor[r - 1]?.[c],
        e = floor[r]?.[c + 1],
        s = floor[r + 1]?.[c],
        w = floor[r]?.[c - 1],
        count = [n, e, s, w].filter(Boolean).length;
      if (count === 4) return (c * 3 + r) % 5 === 0 ? 2 : 0;
      if (n && s && !e && !w) return 4;
      if (e && w && !n && !s) return 5;
      if (n && e && !s && !w) return 6;
      if (e && s && !n && !w) return 7;
      if (s && w && !n && !e) return 8;
      if (w && n && !e && !s) return 9;
      if (n && e && w) return 10;
      if (s && e && w) return 11;
      return count > 2 ? 12 : (c + r) % 3;
    }),
  );
  // Dual grid: each image encodes the materials at four shared corners.
  nav.transitions = Array.from({ length: nav.rows + 1 }, (_, r) =>
    Array.from(
      { length: nav.cols + 1 },
      (_, c) =>
        (floor[r - 1]?.[c - 1] ? 1 : 0) |
        (floor[r - 1]?.[c] ? 2 : 0) |
        (floor[r]?.[c] ? 4 : 0) |
        (floor[r]?.[c - 1] ? 8 : 0),
    ),
  );
  const border = [];
  for (let r = 1; r < nav.rows - 1; r++)
    for (let c = 1; c < nav.cols - 1; c++)
      if (
        !floor[r][c] &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => floor[r + dy]?.[c + dx])
      )
        border.push([c, r]);
  const existing = () =>
    nav.props.map((p) => [p.px / TILE - 0.5, p.py / TILE - 0.5]);
  const addScenery = (index, c, r, size = 384) => {
    prop(index, c, r, false, (r + 0.5) * TILE);
    Object.assign(nav.props.at(-1), {
      size,
      anchor: 1 - 8 / 384,
      scenery: true,
    });
  };
  for (const [i, feature] of [4, 10, 11, 9].entries()) {
    if (feature === 4 && spec.fountain) continue;
    const room =
      (spec.rooms || [])[i % (spec.rooms?.length || 1)] ||
      spec.route[Math.min(i + 1, spec.route.length - 1)];
    const spot = border
      .filter(([x, y]) =>
        existing().every(([a, b]) => Math.hypot(x - a, y - b) > 1.3),
      )
      .sort(
        (a, b) =>
          Math.hypot(a[0] - room[0], a[1] - room[1]) -
          Math.hypot(b[0] - room[0], b[1] - room[1]),
      )[0];
    if (spot) addScenery(feature, ...spot, feature === 10 ? 512 : 384);
  }
  let placed = 0;
  for (const [c, r] of border) {
    const seed = (c * 31 + r * 17 + id.length * 13) % 19;
    if (
      seed % 3 ||
      existing().some(([x, y]) => Math.hypot(c - x, r - y) < 1.15)
    )
      continue;
    addScenery([9, 15, 13, 15][seed % 4], c, r, seed % 4 === 0 ? 256 : 320);
    if (++placed >= 34) break;
  }
  for (let r = 2; r < nav.rows - 2; r += 3)
    for (let c = 2; c < nav.cols - 2; c += 3) {
      if (
        !floor[r][c] &&
        existing().every(([x, y]) => Math.hypot(c - x, r - y) > 1.3)
      )
        addScenery(
          [9, 13, 15, 9][(c + r) % 4],
          c,
          r,
          (c + r) % 4 === 2 ? 352 : 288,
        );
    }
  let plants = 0;
  for (let r = 2; r < nav.rows - 2; r++)
    for (let c = 2; c < nav.cols - 2; c++) {
      if (
        floor[r][c] &&
        (c * 11 + r * 7) % 17 === 0 &&
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => !floor[r + dy]?.[c + dx]) &&
        plants++ < 16
      ) {
        prop(14, c, r, true, (r + 0.5) * TILE);
        Object.assign(nav.props.at(-1), {
          size: 112,
          anchor: 0.92,
          scenery: true,
        });
      }
    }
  for (const p of nav.props) {
    p.size ??= p.index === 14 ? 112 : 384;
    p.anchor ??= p.index === 12 ? 0.82 : 1 - 8 / 384;
  }
  NAVIGATION[id] = nav;
}
export function worldToImage(x, y, map = "village") {
  const nav = NAVIGATION[map];
  return {
    u: (x * 16 + nav.width / 2) / nav.width,
    v: (y * 16) / nav.height,
  };
}
export function imageToWorld(u, v, map = "village") {
  const nav = NAVIGATION[map];
  return pixelWorld(u * nav.width, v * nav.height, nav.width);
}
export function floorValue(map, x, y) {
  const nav = NAVIGATION[map];
  if (!nav || !Number.isFinite(x) || !Number.isFinite(y)) return 0;
  const u = (x * 16 + nav.width / 2) / TILE - 0.5,
    v = (y * 16) / TILE - 0.5,
    c = Math.floor(u),
    r = Math.floor(v),
    tx = u - c,
    ty = v - r;
  const at = (cx, cy) => (nav.floor[cy]?.[cx] ? 1 : 0);
  return (
    at(c, r) * (1 - tx) * (1 - ty) +
    at(c + 1, r) * tx * (1 - ty) +
    at(c, r + 1) * (1 - tx) * ty +
    at(c + 1, r + 1) * tx * ty
  );
}
export function habitatPoint(map, kind, index, rng) {
  const nav = NAVIGATION[map],
    center = nav.habitats[kind] || nav.spawn;
  for (let trial = 0; trial < 40; trial++) {
    const x = center.x + (rng() - 0.5) * 5.5 + (index % 2 ? 2 : -2),
      y = center.y + (rng() - 0.5) * 5.5;
    if (isWalkable(map, x, y)) return { x, y };
  }
  return { ...center };
}
export function herbPoints(map) {
  const nav = NAVIGATION[map],
    points = [];
  for (const site of nav.gatherSites)
    for (let i = 0; i < 4; i++) {
      const offsets = [
        [0, 0],
        [1.2, 0.5],
        [-1.1, 0.8],
        [0.3, -1.3],
      ];
      const [dx, dy] = offsets[i],
        x = site.x + dx,
        y = site.y + dy;
      points.push({
        ...site,
        site: site.id,
        x: isWalkable(map, x, y) ? x : site.x,
        y: isWalkable(map, x, y) ? y : site.y,
        patch: i,
      });
    }
  return points;
}

export function isWalkable(map, x, y) {
  return floorValue(map, x, y) >= 0.5;
}
