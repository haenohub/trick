import { NAVIGATION } from "./world-layout.js";
const stories = {
  village: [
    "분수 아래의 약속",
    "분수의 이끼 틈에는 길을 떠난 사람들이 남긴 잎 편지가 끼워져 있다. 숲길지기는 아무 편지도 버리지 않는다.",
  ],
  sprout: [
    "기울어진 씨앗 표지",
    "울타리의 표지는 밭이 아니라 작은 샛길을 가리킨다. 오래전 길지기가 어린 싹에게 햇빛을 돌려주려고 옮겨 세운 것이다.",
    "나비잠 씨앗터",
    "바람이 닿지 않는 흙주머니에 씨앗들이 잠들어 있다. 누군가 다음 봄에 쓸 물건을 잎으로 엮어 두었다.",
  ],
  acorn: [
    "빈 도토리 초소",
    "초소에는 지킬 도토리보다 세어 놓은 겨울날이 많다. 둥근 자국은 샛길 너머 오래된 쉼터까지 이어진다.",
    "접힌 가지의 쉼터",
    "부러진 가지는 치워지지 않고 작은 지붕이 되었다. 비를 피해 쉬던 여행자가 다음 사람을 위해 보급함을 남겼다.",
  ],
  brook: [
    "물소리를 듣는 돌",
    "물은 같은 돌을 두 번 같은 목소리로 지나지 않는다. 돌 옆의 흐린 발자국은 강 굽이 안쪽으로 사라진다.",
    "거꾸로 비치는 물웅덩이",
    "작은 물웅덩이에는 낮에도 별이 보인다. 물가 약초꾼이 젖지 않도록 감싼 보물함이 뿌리 사이에 놓여 있다.",
  ],
  stump: [
    "비어 있는 나이테",
    "나이테 하나가 유난히 밝다. 수호자가 숲의 어린 생명들에게 빌려준 한 해라고 전해진다.",
    "수호자의 작은 정원",
    "굵은 뿌리는 이 작은 정원을 밟지 않으려고 몸을 굽혔다. 수호자가 고요해지면 오래 지켜 온 보물함도 열린다.",
  ],
  shelltown: [
    "파도를 접는 우편함",
    "이 마을의 편지는 밀물에 늦어도 사라지지 않는다. 해안림 곳곳에 남은 잎 보물함의 소식도 이곳을 거쳐 간다.",
  ],
  saltwood: [
    "소금꽃 풍향계",
    "숲 안쪽을 향한 날에는 먼바다의 비가 온다. 나무 사이로 난 길을 따르면 바람을 피할 작은 공간이 있다.",
    "바람이 쉬어 가는 틈",
    "새 잎이 소금에 시들지 않도록 바람이 스스로 돌아가는 자리다. 해안 길지기의 보급함도 그 안에 숨었다.",
  ],
  glassbeach: [
    "달빛 없는 조개길",
    "옅은 조개빛은 햇빛을 오래 모아 밤길을 밝힌다. 빛의 줄이 모래 둔덕 뒤의 얕은 길로 이어진다.",
    "썰물의 유리 정원",
    "부서진 조각들이 파도에 닳아 서로를 해치지 않게 되었다. 정원 한쪽에 파도보다 먼저 도착한 보물함이 있다.",
  ],
  tideroot: [
    "뿌리 위의 물금",
    "나무에 남은 흰 줄은 어제의 밀물 높이다. 가장 낮은 줄을 따라가면 숨은 마른 땅에 닿는다.",
    "밀물이 비켜 가는 둥지",
    "여러 뿌리가 서로 기댄 덕분에 이 작은 땅은 젖지 않는다. 갈대에 묶인 보물함에서 약초 향이 난다.",
  ],
  seacave: [
    "수정의 숨 자국",
    "수정벽 안의 기포는 오래전 해룡의 첫 숨이다. 멈춘 듯한 빛이 옆 굴의 입구를 가리킨다.",
    "푸른숨의 기억굴",
    "바다가 숲에 빌려준 물이 한 방울씩 돌아오는 곳이다. 해룡을 진정시킨 여행자에게 마지막 보물함이 열릴 것이다.",
  ],
};
export const DISCOVERIES = Object.entries(stories).flatMap(([map, rows]) =>
  NAVIGATION[map].landmarks.map((point, i) => ({
    id: map + (i ? "-hollow" : "-trail"),
    map,
    ...point,
    name: rows[i * 2],
    lore: rows[i * 2 + 1],
    hidden: i === 1,
    radius: i ? 4 : 5,
    hint: i
      ? "표지의 흔적을 따라 본길 옆의 짧은 샛길을 찾아보세요."
      : "길가의 반짝이는 기록을 가까이에서 살펴보세요.",
    xp: map === "village" || map === "shelltown" ? 15 : 30 + (i ? 25 : 0),
  })),
);
export const CHESTS = Object.values(NAVIGATION)
  .filter((n) => n.secretPassage)
  .map((n, index) => {
    const coast = index >= 4,
      site = DISCOVERIES.find((d) => d.map === n.id && d.hidden);
    return {
      id: n.id + "-cache",
      map: n.id,
      ...n.secretPassage.finish,
      x: n.secretPassage.finish.x + 0.9,
      y: n.secretPassage.finish.y - 0.9,
      name: site.name + "의 보물함",
      site: site.id,
      boss: n.id === "stump" ? "m20" : n.id === "seacave" ? "m40" : null,
      lore: "길지기가 나뭇잎과 나무껍질로 엮어 감춘 보물함. 한 여행자에게 한 번만 내용물을 나누어 준다.",
      rewards: [
        {
          kind: "item",
          item: coast ? "seawood" : "fiber",
          count: coast ? 5 : 4,
        },
        { kind: "item", item: coast ? "mintpotion" : "salve", count: 2 },
        {
          kind: "item",
          item: coast ? "shellore" : "ironstone",
          count: coast ? 3 : 2,
        },
        { kind: "currency", count: coast ? 160 + index * 20 : 45 + index * 15 },
      ],
    };
  });
export const explorationFor = (map) => DISCOVERIES.filter((d) => d.map === map);
