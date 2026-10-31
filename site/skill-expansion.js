// Additional base-profession skills. Slots 0–3 keep their saved/UI identity.
export const SKILL_SLOTS = [0, 1, 2, 3, 4, 5];
export const SKILL_LEVELS = [1, 4, 8, 25, 12, 18];
export const EXTRA_SKILLS = {
  warden: [
    {
      name: "뿌리올가미",
      mode: "ground",
      range: 6,
      radius: 3.2,
      power: 1.6,
      pull: 1.5,
      root: 0.6,
      description:
        "선택한 곳의 가까운 적 최대 5명에게 공격력 160% 피해를 주고 0.6초 묶습니다. 일반 적은 중심으로 최대 1.5거리 끌어당기며 보스는 이동시키지 않습니다.",
    },
    {
      name: "잎날 반격",
      mode: "self",
      range: 0,
      radius: 0,
      counterPower: 1.1,
      duration: 3,
      description:
        "3초간 받는 직접 피해가 25% 감소합니다. 가까운 공격자에게 공격력 110%로 최대 2회 반격합니다. 반격 간격은 0.45초이며 지속 피해에는 반응하지 않습니다.",
    },
  ],
  mage: [
    {
      name: "별씨앗 궤도",
      mode: "ground",
      range: 8,
      radius: 3.1,
      power: 0.5,
      waves: [0, 0.45, 0.9],
      description:
        "지정한 자리에 세 번의 마력 파동을 남깁니다. 파동마다 가까운 적 최대 5명에게 마력 50%, 세 번 모두 맞으면 150% 피해를 줍니다.",
    },
    {
      name: "별그늘 전이",
      mode: "ground",
      range: 4.5,
      radius: 1.2,
      mobility: true,
      shield: 0.12,
      description:
        "지형을 넘지 않고 선택한 곳으로 이동한 뒤 최대 체력 12%의 보호막을 3초간 얻습니다. 직접 피해는 없습니다.",
    },
  ],
  ranger: [
    {
      name: "관통 덩굴화살",
      mode: "ground",
      shape: "line",
      length: 9,
      range: 9,
      radius: 0.9,
      power: 1.95,
      root: 0.8,
      description:
        "선택한 방향의 9거리 직선을 관통합니다. 가까운 적 최대 5명에게 공격력 195% 피해와 0.8초 속박을 주며, 보스의 속박은 0.4초입니다.",
    },
    {
      name: "바람깃 도약",
      mode: "ground",
      range: 4.5,
      radius: 1.2,
      mobility: true,
      description:
        "선택한 곳으로 가볍게 도약하고 2초간 회피율이 10%p 증가합니다. 직접 피해는 없으며 벽을 통과할 수 없습니다.",
    },
  ],
  herbalist: [
    {
      name: "발아 반응",
      mode: "ground",
      range: 7,
      radius: 2.8,
      power: 1.15,
      toxinPower: 0.35,
      description:
        "가까운 적 최대 5명에게 마력 115% 피해를 줍니다. 자신이 쌓은 독을 소비하여 한 겹당 35%, 최대 220%까지 강해집니다.",
    },
    {
      name: "뿌리바꿔치기",
      mode: "ground",
      range: 4.5,
      radius: 1.2,
      mobility: true,
      description:
        "선택한 곳으로 이동하면서 자신의 중독을 풀고 3초 동안 초당 최대 체력 2%를 회복합니다. 직접 피해는 없으며 벽을 통과하지 않습니다.",
    },
  ],
};
export const extraSkill = (classId, slot) =>
  slot >= 4 && slot <= 5 ? EXTRA_SKILLS[classId]?.[slot - 4] : null;
export const skillUnlocked = (p, slot) =>
  Number.isInteger(slot) &&
  slot >= 0 &&
  slot < SKILL_LEVELS.length &&
  p.level >= SKILL_LEVELS[slot] &&
  (slot !== 3 || !!p.branch);
