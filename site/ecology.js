import { MAPS, MONSTERS } from "./data.js";
import { NAVIGATION, isWalkable } from "./world-layout.js";
const guests = {
  sprout: ["m6"],
  acorn: ["m2", "m11"],
  brook: ["m6", "m41"],
  stump: ["m6", "m12"],
  saltwood: ["m26"],
  glassbeach: ["m21", "m31"],
  tideroot: ["m27", "m36"],
  seacave: ["m32", "m34"],
};
export function speciesForMap(map) {
  const primary = MONSTERS.filter((m) => m.map === map);
  const highest = Math.max(0, ...primary.map((m) => m.level));
  return [
    ...primary.map((def, habitat) => ({ def, habitat, guest: false })),
    ...(guests[map] || [])
      .map((id) => MONSTERS.find((m) => m.id === id))
      .filter(
        (m) =>
          m && m.type === "normal" && m.map !== map && m.level <= highest + 2,
      )
      .map((def, index) => ({ def, habitat: index + 2, guest: true })),
  ];
}
export const mapsForSpecies = (id) =>
  MAPS.filter(
    (map) => !map.town && speciesForMap(map.id).some((a) => a.def.id === id),
  );
export function encounterPoint(map, habitat, index, rng) {
  const nav = NAVIGATION[map],
    safe = [nav.west, nav.east, nav.spawn];
  const sites = nav.encounterZones.filter((p) =>
    safe.every((a) => Math.hypot(a.x - p.x, a.y - p.y) > 7),
  );
  const distinct = sites.filter(
    (p, i) =>
      sites.findIndex((q) => Math.hypot(p.x - q.x, p.y - q.y) < 2) === i,
  );
  const list = distinct.length ? distinct : nav.habitats;
  const center =
    list[(habitat + Math.floor(index / 2)) % list.length] || nav.spawn;
  for (let trial = 0; trial < 80; trial++) {
    const x = center.x + (rng() - 0.5) * 8,
      y = center.y + (rng() - 0.5) * 8;
    if (
      isWalkable(map, x, y) &&
      safe.every((a) => Math.hypot(a.x - x, a.y - y) > 5)
    )
      return { x, y };
  }
  return { ...center };
}
