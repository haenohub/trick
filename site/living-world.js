// A shared clock keeps visible events and authoritative rewards in sync.
export function worldPulse(map, time) {
  let hash = 0;
  for (const c of map.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const phase = (Math.max(0, time) + (hash % 60)) % 180,
    active = !map.town && phase >= 90 && phase < 120;
  return {
    active,
    kind: map.region === 0 ? "bloom" : "tide",
    label: active
      ? map.region === 0
        ? "꽃비 · 약초 채집 +1"
        : "밀물의 선물 · 리프 +25%"
      : map.region === 0
        ? "숲바람"
        : "잔잔한 물결",
    remaining: Math.ceil(
      active ? 120 - phase : phase < 90 ? 90 - phase : 270 - phase,
    ),
  };
}
