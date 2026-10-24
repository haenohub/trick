// Shared combat geometry: damage checks and visible warnings use the same zones.
export function segmentDistance(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export const attackZones = (attack) => attack.zones || [attack];
export function zoneHits(p, zone) {
  if (zone.style === "line")
    return (
      segmentDistance(p, zone, { x: zone.tx, y: zone.ty }) <=
      (zone.width || 0.9)
    );
  const d = Math.hypot(p.x - zone.x, p.y - zone.y);
  return (
    d <= zone.radius &&
    (zone.style !== "ring" || d >= (zone.innerRadius || 1.25))
  );
}
export function zoneOutline(zone, inner = false) {
  if (zone.style === "line") {
    const dx = zone.tx - zone.x,
      dy = zone.ty - zone.y,
      n = Math.hypot(dx, dy) || 1,
      w = zone.width || 0.9;
    return Array.from({ length: 16 }, (_, i) => {
      const side = i < 8 ? 1 : -1,
        t = (i % 8) / 7;
      return {
        x: zone.x + dx * t - (dy / n) * w * side,
        y: zone.y + dy * t + (dx / n) * w * side,
      };
    });
  }
  const radius = inner ? zone.innerRadius || 1.25 : zone.radius;
  return Array.from({ length: 24 }, (_, i) => ({
    x: zone.x + Math.cos((i * Math.PI) / 12) * radius,
    y: zone.y + Math.sin((i * Math.PI) / 12) * radius,
  }));
}
export function clearSight(map, a, b, walkable) {
  const count = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 5);
  for (let i = 0; i <= count; i++)
    if (
      !walkable(
        map,
        a.x + ((b.x - a.x) * i) / (count || 1),
        a.y + ((b.y - a.y) * i) / (count || 1),
      )
    )
      return false;
  return true;
}
export const bossPhase = (m) =>
  m.hp / m.maxHp <= 0.34 ? 3 : m.hp / m.maxHp <= 0.67 ? 2 : 1;
export function bossAttack(m, target, now) {
  const phase = bossPhase(m),
    pattern = (m.pattern || 0) % 3,
    forest = m.def === "m20";
  const aim = { x: target.x, y: target.y },
    origin = { x: m.x, y: m.y };
  const dx = target.x - m.x,
    dy = target.y - m.y,
    len = Math.hypot(dx, dy) || 1;
  const line = (x, y) => ({
    ...origin,
    tx: m.x + x,
    ty: m.y + y,
    style: "line",
    width: 0.85,
  });
  let zones, name;
  if (forest) {
    if (pattern === 0) {
      name = "잠에서 깬 뿌리";
      zones = [{ ...aim, style: "circle", radius: 2.1 }];
      if (phase >= 2)
        zones.push(
          {
            x: aim.x - (dy / len) * 3.6,
            y: aim.y + (dx / len) * 3.6,
            style: "circle",
            radius: 1.8,
          },
          {
            x: aim.x + (dy / len) * 3.6,
            y: aim.y - (dx / len) * 3.6,
            style: "circle",
            radius: 1.8,
          },
        );
    }
    if (pattern === 1) {
      name = "엇갈리는 뿌리";
      zones = [
        line((dx / len) * 9, (dy / len) * 9),
        line((-dy / len) * 8, (dx / len) * 8),
      ];
    }
    if (pattern === 2) {
      name = "수관의 파문 · 안쪽 안전";
      zones = [{ ...origin, style: "ring", radius: 5.2, innerRadius: 1.7 }];
    }
  } else {
    if (pattern === 0) {
      name = "푸른숨 물대포";
      zones = [line((dx / len) * 11, (dy / len) * 11)];
      if (phase === 3)
        zones.push(
          line(
            (dx / len) * 9 - (dy / len) * 3,
            (dy / len) * 9 + (dx / len) * 3,
          ),
          line(
            (dx / len) * 9 + (dy / len) * 3,
            (dy / len) * 9 - (dx / len) * 3,
          ),
        );
    }
    if (pattern === 1) {
      name = "밀려드는 해일 · 안쪽 안전";
      zones = [{ ...origin, style: "ring", radius: 6, innerRadius: 2.3 }];
    }
    if (pattern === 2) {
      name = "솟구치는 물기둥";
      zones = [-1, 0, 1].map((k) => ({
        x: aim.x - (dy / len) * k * 3.8,
        y: aim.y + (dx / len) * k * 3.8,
        style: "circle",
        radius: phase >= 2 ? 2 : 1.6,
      }));
    }
  }
  return {
    ...zones[0],
    zones,
    name,
    phase,
    start: now,
    at: now + (forest ? 1.35 : 1.5) - (phase - 1) * 0.18,
    damageScale: 1 + (phase - 1) * 0.15,
    slow: forest && pattern === 0,
  };
}
export const CLASS_TACTICS = {
  warden: {
    name: "버들 반격",
    text: "방패로 피해를 흡수하면 반격이 최대 3회 충전됩니다. 잎새 찌르기는 뒤쪽 적도 관통하며, 가지 휩쓸기는 일반 몬스터의 공격 준비를 끊습니다.",
  },
  mage: {
    name: "달씨앗 공명",
    text: "기본 공격과 잎빛 탄환으로 달씨앗을 최대 3개 모읍니다. 달이슬 폭발과 월륜 관통은 씨앗을 소모해 강해집니다.",
  },
  ranger: {
    name: "바람결 정조준",
    text: "옆구르기는 0.45초 동안 적의 공격을 회피합니다. 구른 뒤 4초 안에 가하는 다음 공격이 강화되며, 표식 대상의 약점을 노릴 수 있습니다.",
  },
  herbalist: {
    name: "쓴향 순환",
    text: "기본 공격과 쓴잎 탄은 독을 최대 3겹 쌓습니다. 풀내음 장판은 머무는 아군을 회복하고 독에 물든 적을 주기적으로 약화합니다.",
  },
};
