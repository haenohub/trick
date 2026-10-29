// The normal equipment ladder. Old IDs remain valid in existing saves.
export const EQUIPMENT_LEVELS = [0, 5, 10, 15, 20, 25, 30];
const titles = [
  "기운 풀잎",
  "새순 매듭",
  "호박 도토리",
  "조개빛",
  "밀물뿌리",
  "은달잎",
  "별결정",
];
const stories = [
  "떠나는 견습생에게 창고의 남은 재료로 쥐여준 물건. 닳은 모서리와 서툰 매듭이 첫 여행을 기다립니다.",
  "울타리의 새순을 다치지 않게 묶던 매듭에서 시작되었습니다. 작은 손질이 첫 장비를 한결 믿음직하게 바꿉니다.",
  "도토리 저장터의 호박빛 수액으로 결을 굳혔습니다. 가을 숲을 지킨 이들의 인내가 재료 사이에 남습니다.",
  "해안 장인이 조개의 얇은 층을 겹쳤습니다. 숲을 떠나 처음 마주한 파도의 힘을 흘려보냅니다.",
  "밀물에도 흙을 놓지 않는 뿌리의 결을 따랐습니다. 흔들리는 길 위에서 중심을 지키라는 뜻입니다.",
  "밤길을 건넌 여행자들이 모은 은빛 잎맥을 이었습니다. 어둠 속에서도 동료의 발걸음을 알아봅니다.",
  "푸른숨 동굴 깊은 곳에서 자란 별결정을 세공했습니다. 긴 숲길과 바다를 건너온 흔적이 단단한 빛으로 모입니다.",
];
export function tierItemId(cls, slot, level) {
  const root =
    slot === "weapon"
      ? cls.weapon
      : slot === "armor"
        ? cls.id + "armor"
        : { head: "hood", boots: "boots", charm: "charm" }[slot];
  return root + (level === 0 ? "1" : level === 15 ? "2" : "lv" + level);
}
export function addEquipmentTiers(items, classes) {
  for (const cls of classes)
    for (const slot of ["weapon", "armor", "head", "boots", "charm"]) {
      if (!["weapon", "armor"].includes(slot) && cls !== classes[0]) continue;
      const noun =
        slot === "weapon"
          ? { spear: "창", staff: "지팡이", bow: "활", wand: "약초봉" }[
              cls.weapon
            ]
          : slot === "armor"
            ? {
                warden: "호위 조끼",
                mage: "법의",
                ranger: "사냥복",
                herbalist: "약초 외투",
              }[cls.id]
            : { head: "두건", boots: "장화", charm: "목걸이" }[slot];
      for (const [stage, level] of EQUIPMENT_LEVELS.entries()) {
        const id = tierItemId(cls, slot, level),
          old = items[id],
          local = level < 15;
        items[id] = {
          ...old,
          id,
          name: stage === 0 ? "해진 " + noun : titles[stage] + " " + noun,
          type: "equipment",
          slot,
          ...(slot === "weapon" || slot === "armor" ? { classId: cls.id } : {}),
          ...(slot === "weapon" ? { weapon: cls.weapon } : {}),
          lore:
            stories[stage] +
            " " +
            noun +
            "에 남은 손질은 다음 여행을 위한 약속입니다.",
          level,
          tier: stage,
          progressionEquipment: true,
          price: stage === 0 ? 8 : 50 + stage * stage * 38,
          color: cls.color,
          recipe:
            stage === 0
              ? { fiber: 1 }
              : {
                  [local ? "fiber" : "seawood"]: 3 + stage * 2,
                  [local ? "ironstone" : "shellore"]: 1 + stage,
                  ...(stage >= 4 ? { saltflower: stage - 2 } : {}),
                },
        };
      }
    }
}
