// Percentages are fractions of the unbuffed combat stat; equipment requirements
// always use allocated attributes, never temporary bonuses.
export const NEW_CONSUMABLES = [
  {
    id: "dewjelly",
    name: "새벽이슬 젤리",
    heal: 0.2,
    price: 18,
    recipe: { softleaf: 1, mint: 1 },
    lore: "새벽 잎끝의 이슬을 굳힌 투명한 젤리. 넘어져 울던 묘목지기의 아이에게 나눠 주던 간식입니다.",
  },
  {
    id: "acornbread",
    name: "도토리 속빵",
    heal: 0.3,
    focus: 15,
    price: 35,
    recipe: { softleaf: 2, fiber: 1 },
    lore: "속을 비운 도토리 껍질에서 천천히 구웠습니다. 돌아오는 길을 잃지 말라는 작은 잎 표식이 찍혀 있습니다.",
  },
  {
    id: "brooktea",
    name: "개울돌 냉차",
    focus: 40,
    price: 20,
    recipe: { mint: 1 },
    lore: "차가운 개울돌 곁에서 하룻밤 식힌 박하차. 잠들지 못하는 별잎 견습생들의 책상에 놓이던 병입니다.",
  },
  {
    id: "moonnectar",
    name: "달씨앗 꿀물",
    heal: 0.15,
    focus: 50,
    price: 40,
    recipe: { mint: 2, softleaf: 1 },
    lore: "달빛 아래에서만 단맛을 내는 씨앗을 우렸습니다. 쓰디쓴 주문 암기를 마친 밤에 조금씩 마십니다.",
  },
  {
    id: "rootbroth",
    name: "따뜻한 뿌리수프",
    regen: 0.025,
    duration: 16,
    price: 38,
    recipe: { softleaf: 3 },
    lore: "잘린 뿌리 대신 스스로 떨어진 잔뿌리만 고아 냅니다. 숲의 치유사들은 빨리 낫는 것보다 오래 돌보기를 배웠습니다.",
  },
  {
    id: "saltmousse",
    name: "소금꽃 무스",
    heal: 0.45,
    cleanse: true,
    price: 60,
    recipe: { saltflower: 2, softleaf: 1 },
    lore: "독한 해초를 만진 뱃사람에게 건네던 부드러운 약. 혀끝에 남는 짠맛이 무사히 돌아왔다는 신호입니다.",
  },
  {
    id: "breathdrop",
    name: "푸른숨 방울약",
    focus: 100,
    heal: 0.2,
    price: 75,
    recipe: { breathgrass: 2, mint: 2 },
    lore: "파도가 잠시 멎는 순간에 뚜껑을 닫는 약입니다. 깊은 동굴에서 숨이 가빠질 때 해안의 바람을 떠올리게 합니다.",
  },
  {
    id: "leafcompress",
    name: "온실잎 습포",
    heal: 0.12,
    regen: 0.04,
    duration: 8,
    price: 42,
    recipe: { softleaf: 3, mint: 1 },
    lore: "온실의 가장 두꺼운 잎으로 상처를 감쌉니다. 잎이 서서히 마를 때까지 온기가 상처 곁을 지킵니다.",
  },
  {
    id: "tideelixir",
    name: "밀물빛 비약",
    heal: 0.65,
    focus: 70,
    price: 115,
    recipe: { breathgrass: 3, saltflower: 2 },
    lore: "밀물과 썰물이 바뀌는 짧은 틈에만 섞이는 약. 멈추지 않고 되돌아오는 파도의 힘을 빌렸습니다.",
  },
  {
    id: "springphial",
    name: "첫봄 유리병",
    heal: 1,
    focus: 100,
    cleanse: true,
    price: 190,
    recipe: { softleaf: 4, breathgrass: 4, saltflower: 3 },
    lore: "긴 겨울 뒤 첫 꽃이 피던 날의 향을 담았습니다. 모두가 돌아와야 열기로 약속했던 마을의 마지막 비상약입니다.",
  },
  {
    id: "barktonic",
    name: "붉은수피 강장제",
    buff: { attack: 0.2 },
    duration: 90,
    price: 80,
    recipe: { fiber: 3, softleaf: 2 },
    lore: "바람에 버틴 나무껍질의 붉은 즙. 창사들이 첫 보초를 서기 전, 손이 떨리지 않기를 바라며 나눠 마십니다.",
  },
  {
    id: "starcordial",
    name: "별꽃 농축액",
    buff: { magicPower: 0.2 },
    duration: 90,
    price: 80,
    recipe: { mint: 3, saltflower: 1 },
    lore: "밤에 모은 꽃가루를 한 방울로 줄였습니다. 작은 별 하나라도 끝까지 밝히라는 스승의 말이 병목에 새겨져 있습니다.",
  },
  {
    id: "stonebiscuit",
    name: "돌밤 방패과자",
    buff: { defense: 0.3 },
    duration: 120,
    price: 75,
    recipe: { fiber: 2, softleaf: 2 },
    lore: "돌처럼 단단한 밤을 여러 번 쪄서 만든 과자. 겁 많은 경비에게 마을 아이들이 방패 모양으로 구워 주었습니다.",
  },
  {
    id: "shellsyrup",
    name: "진주막 시럽",
    buff: { magicDefense: 0.3 },
    duration: 120,
    price: 75,
    recipe: { shellore: 1, breathgrass: 2 },
    lore: "조개가 상처를 감싸는 얇은 막에서 배운 시럽. 보이지 않는 바다의 찬 기운을 부드럽게 흘려보냅니다.",
  },
  {
    id: "hawkseed",
    name: "매눈 씨앗차",
    flatBuff: { accuracy: 25 },
    duration: 90,
    price: 70,
    recipe: { mint: 3 },
    lore: "작은 씨앗을 셀 수 있을 만큼 정신이 맑아지는 차. 숲그늘궁수의 첫 수업은 과녁보다 바람을 바라보는 일이었습니다.",
  },
  {
    id: "mistlozenge",
    name: "안개박하 사탕",
    flatBuff: { evasion: 0.08 },
    duration: 60,
    price: 85,
    recipe: { mint: 3, breathgrass: 1 },
    lore: "입안에서 녹는 동안 몸에 힘을 빼게 하는 사탕. 갈대 사이로 소리 없이 빠져나가는 정찰병들의 주머니에 들어 있습니다.",
  },
  {
    id: "thornjam",
    name: "가시딸기 잼",
    flatBuff: { critChance: 0.1 },
    duration: 60,
    price: 95,
    recipe: { saltflower: 2, softleaf: 2 },
    lore: "가시에 찔리지 않고 딴 열매만 담습니다. 아주 짧은 빈틈을 기다리던 추격자들이 아끼는 붉은 잼입니다.",
  },
  {
    id: "sunpepper",
    name: "햇살고추 절임",
    flatBuff: { critDamage: 0.35 },
    duration: 60,
    price: 95,
    recipe: { saltflower: 3, mint: 1 },
    lore: "한 입 깨물면 졸린 숲도 눈을 뜬다는 절임. 마지막 한 번의 힘이 필요한 이에게 작은 조각만 건네줍니다.",
  },
  {
    id: "windnectar",
    name: "바람결 꽃청",
    speedBonus: 0.2,
    duration: 60,
    price: 65,
    recipe: { breathgrass: 2, mint: 2 },
    lore: "줄기가 휘어도 떨어지지 않는 꽃의 꿀. 먼 길의 배달부가 숨을 고르고 다시 걷기 전에 마시는 한 모금입니다.",
  },
  {
    id: "heartroot",
    name: "심장뿌리 진액",
    buff: { maxHp: 0.25 },
    duration: 120,
    heal: 0.2,
    price: 100,
    recipe: { softleaf: 4, breathgrass: 2 },
    lore: "속이 빈 고목의 새 뿌리에서 얻은 진액. 오래된 몸에도 새 계절을 버틸 자리가 남아 있다는 약속입니다.",
  },
];
const labels = {
  attack: "공격력",
  magicPower: "마력",
  defense: "방어력",
  magicDefense: "마법 방어력",
  accuracy: "명중",
  evasion: "회피율",
  critChance: "치명타 확률",
  critDamage: "치명타 피해",
  maxHp: "최대 체력",
};
export function consumableLines(i) {
  if (i.type !== "consumable") return [];
  const lines = [];
  if (i.heal) lines.push(`체력 ${Math.round(i.heal * 100)}% 즉시 회복`);
  if (i.focus) lines.push(`집중력 ${i.focus} 회복`);
  if (i.cleanse) lines.push("중독 해제");
  if (i.regen)
    lines.push(`${i.duration}초 동안 초당 체력 ${i.regen * 100}% 회복`);
  for (const [k, n] of Object.entries(i.buff || {}))
    lines.push(`${i.duration}초 동안 ${labels[k]} +${Math.round(n * 100)}%`);
  for (const [k, n] of Object.entries(i.flatBuff || {}))
    lines.push(
      `${i.duration}초 동안 ${labels[k]} +${k === "accuracy" ? n : Math.round(n * 100) + "%p"}`,
    );
  if (i.speedBonus)
    lines.push(`${i.duration}초 동안 이동속도 +${i.speedBonus * 100}%`);
  lines.push("소비 아이템 공용 재사용 대기시간 3초");
  if (i.duration) lines.push("같은 효과는 중첩되지 않고 지속시간 갱신");
  return lines;
}
export function addConsumables(items) {
  for (const entry of NEW_CONSUMABLES)
    items[entry.id] = { type: "consumable", color: "#a8d59d", ...entry };
}
export function applyConsumableStats(p, s) {
  const base = { ...s };
  for (const b of p.buffs || []) {
    for (const [k, n] of Object.entries(b.buff || {})) s[k] += base[k] * n;
    for (const [k, n] of Object.entries(b.flatBuff || {})) s[k] += n;
    if (b.speedBonus) s.speed += base.speed * b.speedBonus;
  }
  for (const k of [
    "maxHp",
    "attack",
    "magicPower",
    "defense",
    "magicDefense",
    "accuracy",
  ])
    s[k] = Math.round(s[k]);
  s.evasion = Math.min(0.55, s.evasion);
  s.critChance = Math.min(0.75, s.critChance);
  s.critDamage = Math.min(4, s.critDamage);
  s.power = s.damageType === "magic" ? s.magicPower : s.attack;
  return s;
}
