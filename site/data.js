import { NAVIGATION, NPC_POSITIONS } from "./art-layout.js";
import { TROPHIES } from "./trophies.js";
export const VERSION = "0.4.0";
export const SAVE_KEY = "leaftale:save:v1";
export const MAX_LEVEL = 80;
export const CLASSES = [
  {
    id: "warden",
    name: "수림창사",
    role: "근접 · 수호와 추격",
    weapon: "spear",
    color: "#dcad61",
    description:
      "숲길을 열고 동료를 지키는 창사. 긴 창끝으로 거리를 지배합니다.",
    skills: ["잎새 찌르기", "뿌리 버티기", "가지 휩쓸기"],
    branches: [
      {
        id: "antler",
        name: "녹각수호자",
        description: "보호 영역과 단단한 생명력으로 전선을 지킵니다.",
        skill: "녹각 방벽",
      },
      {
        id: "thorn",
        name: "가시추격자",
        description: "도약과 가시 표식으로 적의 빈틈을 추격합니다.",
        skill: "가시 도약",
      },
    ],
  },
  {
    id: "mage",
    name: "별잎술사",
    role: "마법 · 달빛과 개화",
    weapon: "staff",
    color: "#b49cdd",
    description:
      "잎맥에 고인 빛을 읽어 주문을 엮습니다. 여러 적을 다루는 마법사입니다.",
    skills: ["잎빛 탄환", "달이슬 폭발", "가지 속박"],
    branches: [
      {
        id: "moon",
        name: "월광현자",
        description: "차분히 응축한 달빛으로 먼 적을 꿰뚫습니다.",
        skill: "월륜 관통",
      },
      {
        id: "bloom",
        name: "개화술사",
        description: "별꽃을 피워 적의 움직임을 묶고 함께 터뜨립니다.",
        skill: "연쇄 개화",
      },
    ],
  },
  {
    id: "ranger",
    name: "숲그늘궁수",
    role: "원거리 · 추적과 기동",
    weapon: "bow",
    color: "#a8cb7d",
    description:
      "바람과 발자국을 읽는 궁수. 멀리서 약점을 노리고 가볍게 움직입니다.",
    skills: ["깃끝 사격", "옆구르기", "추적 표식"],
    branches: [
      {
        id: "hawk",
        name: "매눈사수",
        description: "긴 사거리와 관통 사격으로 정확한 한 발을 노립니다.",
        skill: "수관 너머의 화살",
      },
      {
        id: "mist",
        name: "안개유격수",
        description: "짧은 도약과 여러 갈래의 화살로 적을 교란합니다.",
        skill: "안개걸음",
      },
    ],
  },
  {
    id: "herbalist",
    name: "약초술사",
    role: "회복 · 꽃숨과 독향",
    weapon: "wand",
    color: "#e7a5b8",
    description:
      "작은 풀에도 살아갈 힘이 있습니다. 스스로 회복하며 적을 약화합니다.",
    skills: ["꽃숨 회복", "쓴잎 탄", "풀내음 장판"],
    branches: [
      {
        id: "flower",
        name: "꽃숨치유사",
        description: "꽃의 보호와 회복으로 긴 전투를 버팁니다.",
        skill: "봄비 정원",
      },
      {
        id: "venom",
        name: "독향술사",
        description: "쓴 향을 쌓아 적을 약화하고 독꽃 반응을 일으킵니다.",
        skill: "독꽃 반응",
      },
    ],
  },
];
export const REGIONS = [
  {
    id: "forest",
    name: "햇살잎 숲",
    subtitle: "작은 씨앗이 부르는 모험",
    level: "1–12",
    color: "#9fbf77",
    story:
      "겨울이 오지 않는데도 작은 동물들이 식량을 모으고 있습니다. 길을 막은 뿌리 너머에서 그 이유를 찾아보세요.",
  },
  {
    id: "coast",
    name: "은물결 해안림",
    subtitle: "숲과 바다가 숨을 나누는 곳",
    level: "13–27",
    color: "#83c8cb",
    story:
      "바다까지 뻗은 뿌리가 물길을 가로막았습니다. 파도 속에서 숲의 오래된 숨결이 깨어납니다.",
  },
];
export const MAPS = [
  {
    id: "village",
    name: "잎담 마을",
    region: 0,
    town: true,
    level: 1,
    biome: "village",
    description:
      "나무가 천천히 지붕으로 자라는 작은 마을. 모험가의 첫 발걸음을 기다립니다.",
  },
  {
    id: "sprout",
    name: "새싹 울타리",
    region: 0,
    level: 1,
    biome: "meadow",
    description:
      "밭과 숲이 만나는 볕 좋은 울타리. 풀잎 아래에서 작은 소동이 일어납니다.",
  },
  {
    id: "acorn",
    name: "도토리 샛길",
    region: 0,
    level: 3,
    biome: "forest",
    description:
      "도토리껍질이 흩어진 샛길. 낙엽 뒤에서 무언가 바쁘게 움직입니다.",
  },
  {
    id: "brook",
    name: "이슬개울",
    region: 0,
    level: 5,
    biome: "brook",
    description:
      "징검돌 위로 햇살이 부서지는 얕은 개울. 물가의 발자국을 따라가 보세요.",
  },
  {
    id: "stump",
    name: "오래된 그루터기",
    region: 0,
    level: 8,
    biome: "deepforest",
    description:
      "한때 숲을 내려다보던 나무. 남은 생명은 아직 작은 이웃들을 지킵니다.",
  },
  {
    id: "shelltown",
    name: "조개등 마을",
    region: 1,
    town: true,
    level: 13,
    biome: "coasttown",
    description:
      "조개 지붕과 마른 나무의 마을. 창마다 돌아오는 이를 위한 불빛이 있습니다.",
  },
  {
    id: "saltwood",
    name: "소금바람 숲",
    region: 1,
    level: 13,
    biome: "saltforest",
    description:
      "바닷바람에 잎 끝이 은빛으로 물들었습니다. 멀리서 파도 소리가 들립니다.",
  },
  {
    id: "glassbeach",
    name: "유리열매 모래밭",
    region: 1,
    level: 16,
    biome: "beach",
    description:
      "투명한 열매와 조개가 반짝이는 바다. 발밑의 작은 집게를 조심하세요.",
  },
  {
    id: "tideroot",
    name: "밀물뿌리 습지",
    region: 1,
    level: 20,
    biome: "marsh",
    description:
      "물 위로 솟은 뿌리가 길을 잇습니다. 밀물이 오기 전에 흐름을 읽어야 합니다.",
  },
  {
    id: "seacave",
    name: "푸른숨 해식동굴",
    region: 1,
    level: 24,
    biome: "cave",
    description:
      "천장의 고대 뿌리 사이로 바다가 숨 쉽니다. 가장 깊은 곳에 긴 그림자가 머뭅니다.",
  },
];
export const NPCS = [
  {
    id: "guide",
    name: "숲길지기 모아",
    role: "이야기 · 퀘스트",
    kind: "quest",
    map: "village",
    x: 11,
    y: 11,
    text: "큰 숲도 작은 발자국에서 시작하지. 울타리 밖 동물들이 왜 식량을 모으는지 알아봐 줄래?",
  },
  {
    id: "smith",
    name: "나무장이 로웬",
    role: "장비 · 제작",
    kind: "craft",
    map: "village",
    x: 16,
    y: 10,
    text: "나무는 결을 따라 다뤄야 해. 처음 만든 무기의 흠집도 버리지 마.",
  },
  {
    id: "healer",
    name: "풀향 할머니",
    role: "약초 · 연금술",
    kind: "alchemy",
    map: "village",
    x: 9,
    y: 16,
    text: "보들잎은 급하게 따면 풀이 놀란단다. 여행에는 연고를 챙기렴.",
  },
  {
    id: "merchant",
    name: "행상 피노",
    role: "상점 · 휴식",
    kind: "shop",
    map: "village",
    x: 17,
    y: 16,
    text: "숲이 준 것들을 나누는 장사야. 쉴 곳도 준비해 두었지.",
  },
  {
    id: "coastguide",
    name: "물길지기 세린",
    role: "해안 이야기",
    kind: "quest",
    map: "shelltown",
    x: 11,
    y: 11,
    text: "바다가 숲으로 밀려오는 건 파도 탓만은 아니야. 뿌리 아래 막힌 숨길을 찾아줘.",
  },
  {
    id: "coastsmith",
    name: "조개장이 누루",
    role: "해안 장비 · 제작",
    kind: "craft",
    map: "shelltown",
    x: 16,
    y: 10,
    text: "조개껍질처럼 얇은 것을 겹치면 큰 파도도 견딜 수 있어.",
  },
  {
    id: "coasthealer",
    name: "바다풀 약사 린",
    role: "해안 연금술",
    kind: "alchemy",
    map: "shelltown",
    x: 9,
    y: 16,
    text: "소금꽃도 몸에 지나치면 독이야. 배합은 늘 적당해야 하지.",
  },
  {
    id: "mentor",
    name: "은잎의 스승 이안",
    role: "레벨 25 · 2차 전직",
    kind: "class",
    map: "shelltown",
    x: 17,
    y: 16,
    text: "네 발걸음에는 이제 너만의 길이 보이는구나. 어떤 숲길을 지킬지 골라 보렴.",
  },
];
for (const npc of NPCS) Object.assign(npc, NPC_POSITIONS[npc.id] || {});
const monsterRows = [
  [
    "콩잎폴짝",
    "bug",
    "콩잎을 등에 붙인 풀벌레. 농부의 씨앗을 자기 겨울 식량으로 착각합니다.",
  ],
  [
    "솜털씨앗쥐",
    "mouse",
    "씨앗을 볼 가득 모으는 들쥐. 놀라면 먹이부터 떨어뜨립니다.",
  ],
  [
    "흙묻은 새순이",
    "sprout",
    "풀리지 않은 뿌리 때문에 흙을 끌고 다니는 어린 식물 생명체입니다.",
  ],
  [
    "밤송이등 벌레",
    "beetle",
    "빈 밤송이를 갑옷처럼 썼습니다. 웅크릴 때는 등을 두드리지 마세요.",
  ],
  [
    "리본꼬리 족제비",
    "weasel",
    "마을의 천 조각으로 꼬리를 꾸몄습니다. 화려한 꼬리보다 발을 보세요.",
  ],
  [
    "도토리투구 다람쥐",
    "squirrel",
    "지나치게 큰 도토리 투구를 썼습니다. 앞이 잘 안 보여 곧장 달립니다.",
  ],
  [
    "낙엽귀 토끼",
    "rabbit",
    "마른 잎 같은 귀로 몸을 숨깁니다. 뛰기 직전 귀가 먼저 들립니다.",
  ],
  [
    "솔방울구름 애벌레",
    "caterpillar",
    "등의 솜털로 구름처럼 보이는 애벌레. 솔방울을 굴려 길을 막습니다.",
  ],
  [
    "옹이주먹 꼬마목인",
    "treant",
    "울타리 말뚝에 깃든 목인. 아직도 자기 밭을 지킨다고 믿습니다.",
  ],
  [
    "세 도토리의 파수꾼",
    "squirrel",
    "도토리 세 알을 지키는 늙은 다람쥐. 먹이가 없어져도 자리를 떠나지 않습니다.",
  ],
  [
    "이슬배 물방개",
    "bug",
    "등의 물방울로 몸집을 부풀립니다. 방울이 터지면 잠시 작아집니다.",
  ],
  [
    "갈대발 개구리",
    "frog",
    "갈대 사이에서 다리가 길어진 개구리. 그림자가 떨어질 곳을 알려줍니다.",
  ],
  [
    "물잠자리 유충",
    "caterpillar",
    "개울 바닥에서 물줄기를 쏩니다. 젖은 흙 위에서는 느리게 움직입니다.",
  ],
  [
    "돌껍질 가재",
    "crab",
    "징검돌을 등에 붙였습니다. 집게를 높이 들면 내려찍기를 준비합니다.",
  ],
  [
    "잠꾸러기 수달 영감",
    "otter",
    "개울을 막고 자는 늙은 수달. 잠자리를 지키다 싸움 중에도 꾸벅 졸곤 합니다.",
  ],
  [
    "나무부스러기 진드기",
    "bug",
    "썩은 나무의 작은 분해자. 넘치는 먹이를 따라 그루터기 밖으로 나왔습니다.",
  ],
  [
    "버섯모자 달팽이",
    "snail",
    "등의 버섯 덕분에 늘 그늘이 있습니다. 지나간 자리에는 반짝이는 흔적이 남습니다.",
  ],
  [
    "수액방울 딱정벌레",
    "beetle",
    "수액을 나르다 등이 끈적해졌습니다. 달콤한 냄새가 길게 이어집니다.",
  ],
  [
    "뒤틀린 뿌리멧돼지",
    "boar",
    "급성장한 뿌리가 굴을 막았습니다. 성난 돌진 끝에는 큰 빈틈이 생깁니다.",
  ],
  [
    "그루터기 할아범",
    "ancient",
    "잘린 나무의 남은 생명이 이웃들을 지키는 수호자로 깨어났습니다.",
  ],
  [
    "소금털 들토끼",
    "rabbit",
    "바닷바람에 털끝이 희게 굳었습니다. 몸을 털면 소금가루가 날립니다.",
  ],
  [
    "은잎도마뱀",
    "lizard",
    "은빛 잎 아래 위장합니다. 공격하기 직전 꼬리 끝이 햇빛을 반사합니다.",
  ],
  [
    "조개집 소라게",
    "hermit",
    "숲으로 떠밀려온 조개껍질이 새집이 되었습니다. 빈 집처럼 멈춰 기다립니다.",
  ],
  [
    "바람깃 왜가리",
    "bird",
    "먹이터가 막혀 숲에 왔습니다. 긴 부리로 찌른 뒤 천천히 몸을 돌립니다.",
  ],
  [
    "소금숲 은여우",
    "fox",
    "흰 잎 사이를 순찰하는 여우. 바람 방향을 따라 적의 옆으로 돌아갑니다.",
  ],
  [
    "유리열매 딱정벌레",
    "beetle",
    "투명한 열매껍질을 먹어 등이 반짝입니다. 햇빛을 모았다가 내보냅니다.",
  ],
  [
    "모래주머니 게",
    "crab",
    "단단한 모래주머니로 상대를 밀어냅니다. 젖은 주머니는 유난히 무겁습니다.",
  ],
  [
    "파도거품 해파리",
    "jelly",
    "모래와 얕은 물 사이에 떠 있습니다. 부풀어 오른 거품은 곧 터집니다.",
  ],
  [
    "조개칼 사마귀",
    "mantis",
    "앞다리에 조개 조각을 붙였습니다. 연속 공격 후에는 날을 정리합니다.",
  ],
  [
    "열매도둑 푸른원숭이",
    "monkey",
    "숲과 해변을 오가며 열매를 훔칩니다. 자기 먹이를 빼앗기는 것은 참지 못합니다.",
  ],
  [
    "물뿌리 지렁이",
    "worm",
    "물속 뿌리 사이를 파고듭니다. 솟은 흙줄기가 이동 경로를 드러냅니다.",
  ],
  [
    "진주눈 망둑어",
    "fish",
    "얕은 물을 뛰는 물고기. 반짝이는 눈으로 바라본 뒤 물을 뿜습니다.",
  ],
  [
    "이끼등 악어붙이",
    "croc",
    "등의 이끼 때문에 떠 있는 나무처럼 보입니다. 물가에서 느긋하게 기다립니다.",
  ],
  [
    "갈대가면 목령",
    "treant",
    "버려진 갈대 인형에 숲이 깃들었습니다. 묶인 발 대신 뿌리를 뻗습니다.",
  ],
  [
    "밀물의 흰사슴",
    "deer",
    "물에 잠긴 길을 기억하는 사슴. 발밑의 물결이 오래된 길을 보여줍니다.",
  ],
  [
    "푸른등 동굴새우",
    "shrimp",
    "등의 빛으로 동료를 찾습니다. 빠르게 깜빡이면 함께 달려들 준비입니다.",
  ],
  [
    "소금결정 박쥐",
    "bat",
    "날개 끝에 소금 결정이 자랐습니다. 날갯짓할 때 작은 빛이 떨어집니다.",
  ],
  [
    "해초머리 말미잘",
    "anemone",
    "해초처럼 바위에서 흔들립니다. 먹잇감이 가까워져야 촉수를 펼칩니다.",
  ],
  [
    "산호갑각 수문게",
    "crab",
    "막힌 물길 앞에서 수백 번 탈피한 게. 한 집게로 막고 다른 집게로 땅을 가릅니다.",
  ],
  [
    "푸른숨 뿌리해룡",
    "dragon",
    "바닷속 뿌리와 자란 고대 해룡. 본래 바다와 숲의 물을 순환시키던 생명체입니다.",
  ],
];
const palettes = [
  "#a5c969",
  "#cfad81",
  "#8fba6f",
  "#ac8959",
  "#ce9d8b",
  "#bca070",
  "#baac7e",
  "#a3bba1",
  "#9f9166",
  "#cbac68",
  "#78bfc0",
  "#8abf82",
  "#a4c6b1",
  "#91a6a4",
  "#bfa88c",
  "#957d65",
  "#c99f9c",
  "#bfa24e",
  "#a48a72",
  "#8b9d64",
  "#cad2bd",
  "#9bbcb6",
  "#cfc2a0",
  "#c3c5a9",
  "#d6ded5",
  "#a7d4c2",
  "#cdb587",
  "#abdfe0",
  "#bfc8a6",
  "#79acbd",
  "#9eae9e",
  "#adc6b3",
  "#809c87",
  "#aeab75",
  "#d2ded4",
  "#81bac7",
  "#a5b8c2",
  "#92bfa2",
  "#c6938c",
  "#79bfc5",
];
export const MONSTERS = monsterRows.map(([name, shape, lore], i) => {
  const group = Math.floor(i / 5),
    rank = i % 5,
    map = MAPS.filter((m) => !m.town)[group];
  const boss = rank === 4 && [3, 7].includes(group);
  const type = boss
    ? "boss"
    : rank === 4
      ? "rare"
      : rank === 3
        ? "elite"
        : "normal";
  const level = map.level + (rank === 4 ? 3 : rank === 3 ? 2 : rank);
  const region = map.region,
    material = region ? "seawood" : "fiber",
    ore = region ? "shellore" : "ironstone";
  const gear = ["spear", "staff", "bow", "wand"][i % 4] + (region ? "2" : "1");
  return {
    id: "m" + (i + 1),
    index: i,
    spriteSize: TROPHIES[i].spriteSize,
    name,
    shape,
    lore,
    map: map.id,
    region,
    type,
    level,
    color: palettes[i],
    hp: Math.round(
      (24 + level * 13) *
        (boss ? 11 : type === "elite" ? 2.2 : type === "rare" ? 3 : 1),
    ),
    attack: Math.round(
      (4 + level * 2.1) * (boss ? 1.6 : type === "elite" ? 1.2 : 1),
    ),
    defense: Math.floor(level * 0.65),
    speed:
      shape === "snail"
        ? 0.65
        : boss
          ? 0.8
          : shape === "rabbit" || shape === "fox"
            ? 1.9
            : 1.2,
    ranged: [
      "jelly",
      "anemone",
      "bird",
      "dragon",
      "bat",
      "caterpillar",
    ].includes(shape),
    xp: Math.round(
      (18 + level * 10) *
        (boss ? 13 : type === "elite" ? 2.5 : type === "rare" ? 3 : 1),
    ),
    drops: [
      { item: TROPHIES[i].id, chance: TROPHIES[i].chance, min: 1, max: 1 },
      {
        item: material,
        chance: Math.min(
          0.85,
          0.32 + (i % 4) * 0.07 + (type === "normal" ? 0 : 0.18),
        ),
        min: 1,
        max: boss ? 8 : 2,
      },
      {
        item: ore,
        chance: 0.18 + (i % 3) * 0.06 + (boss ? 0.42 : 0),
        min: 1,
        max: boss ? 6 : 1,
      },
      {
        item: region ? "saltflower" : "softleaf",
        chance: 0.08 + (i % 5) * 0.015,
        min: 1,
        max: 1,
      },
      {
        item: gear,
        chance: boss
          ? 0.18
          : type === "rare"
            ? 0.08
            : type === "elite"
              ? 0.045
              : 0.012 + (i % 3) * 0.004,
        min: 1,
        max: 1,
      },
    ],
  };
});
export const ITEMS = {};
const item = (id, name, type, lore, props = {}) =>
  (ITEMS[id] = { id, name, type, lore, price: 10, ...props });
const resources = [
  [
    "softleaf",
    "보들잎",
    "다친 새끼 짐승이 몸을 비비는 풀. 마을의 첫 약은 이 잎에서 시작됩니다.",
    "#97c578",
  ],
  [
    "mint",
    "이슬박하",
    "새벽에 따면 차가운 향이 오래 남습니다. 밤새 길을 지킨 이들에게 차로 내주었습니다.",
    "#87c9c2",
  ],
  [
    "fiber",
    "버들섬유",
    "어린 가지에서 얻은 유연한 섬유. 서툰 손으로 엮어도 쉽게 끊어지지 않습니다.",
    "#c5b182",
  ],
  [
    "ironstone",
    "개울철석",
    "물에 오래 씻겨 모서리가 둥급니다. 견습 장인이 처음 다루는 돌입니다.",
    "#97a4a0",
  ],
  [
    "saltflower",
    "소금꽃",
    "바닷물을 머금고 피는 작은 꽃. 먼 여행을 기다리는 창가에 놓입니다.",
    "#e3b9c7",
  ],
  [
    "breathgrass",
    "푸른숨풀",
    "파도가 물러난 바위틈에서 자랍니다. 잎을 찢으면 시원한 향이 퍼집니다.",
    "#79bdcf",
  ],
  [
    "seawood",
    "해풍목",
    "바람에 비틀리며 자란 단단한 목재. 곧지 않아도 쉽게 꺾이지 않습니다.",
    "#9fbaac",
  ],
  [
    "shellore",
    "조개광석",
    "조개층 사이에서 굳은 광물. 얇은 판을 여러 겹 만드는 데 알맞습니다.",
    "#d3ccc0",
  ],
];
resources.forEach(([id, name, lore, color]) =>
  item(id, name, "material", lore, { color, price: 6 }),
);
item(
  "salve",
  "보들잎 연고",
  "consumable",
  "마을의 첫 여행에는 누구나 이 작은 연고를 하나씩 받습니다.",
  { color: "#a9d491", price: 20, heal: 0.4, recipe: { softleaf: 2, fiber: 1 } },
);
item(
  "mintpotion",
  "이슬박하 물약",
  "consumable",
  "밤샘 경비를 마친 이들이 마시던 음료에서 시작되었습니다.",
  { color: "#8acfd0", price: 24, focus: 65, recipe: { mint: 2 } },
);
item(
  "antidote",
  "소금꽃 해독제",
  "consumable",
  "낯선 바다 생물에게 쏘였을 때 쓰던 해안 주민들의 약입니다.",
  {
    color: "#e7c3ce",
    price: 38,
    cleanse: true,
    heal: 0.15,
    recipe: { saltflower: 2, softleaf: 1 },
  },
);
item(
  "bluepotion",
  "푸른숨 정수",
  "consumable",
  "거친 파도 속에서도 호흡을 잃지 않기를 바라는 마음으로 이름 붙였습니다.",
  {
    color: "#78b9dc",
    price: 52,
    focus: 100,
    heal: 0.12,
    recipe: { breathgrass: 2, mint: 1 },
  },
);
const weaponNames = {
  spear: ["연습용 버들창", "조개날 물푸레창"],
  staff: ["말린잎 지팡이", "은물결 가지봉"],
  bow: ["묶은가지 사냥활", "소금바람 굽이활"],
  wand: ["새순 가지봉", "해풍꽃 약초봉"],
};
const weaponLore = {
  spear: [
    "휘어지는 창대 덕분에 잘 부러지지 않습니다. 첫 흠집은 숲길 견습생이 자랐다는 표시입니다.",
    "해안 경비대가 조개의 층 구조를 본떠 만들었습니다. 가벼운 날이 힘을 고르게 받습니다.",
  ],
  staff: [
    "삐뚤게 새긴 잎맥에는 작은 빛을 모으던 견습생의 시간이 남아 있습니다.",
    "바다 바람을 견딘 가지는 마력의 흔들림도 잘 버팁니다. 소금빛은 지워지지 않습니다.",
  ],
  bow: [
    "가는 가지를 끈으로 묶었습니다. 당기는 힘보다 놓는 순간의 자세를 가르칩니다.",
    "바다를 향해 휜 나무로 만들었습니다. 습한 날에도 탄성이 일정합니다.",
  ],
  wand: [
    "손잡이의 작은 잎은 주인이 쉬지 않으면 함께 시들어 휴식을 재촉합니다.",
    "소금기에도 향을 잃지 않는 꽃을 감쌌습니다. 돌아온 이에게 먼저 쥐여주던 도구입니다.",
  ],
};
const armorNames = [
  ["덧댄 숲길 조끼", "해안수비 흉갑"],
  ["잎맥 견습 로브", "은물결 법의"],
  ["풀그늘 사냥복", "갈대바람 경갑"],
  ["약초주머니 겉옷", "해풍꽃 외투"],
];
const armorLore = [
  [
    "다치기 쉬운 어깨와 가슴에만 천을 덧댔습니다. 덧댄 자리가 점점 단단해집니다.",
    "나무판을 겹쳐 파도와 타격을 흘립니다. 바닷가 경비들의 오랜 지혜입니다.",
  ],
  [
    "번진 잉크 자국 위에 첫 주문을 수놓았습니다. 실수도 배움으로 남았습니다.",
    "바닷빛 안감이 마법의 잔열을 고르게 퍼뜨립니다. 밤바다처럼 잔잔합니다.",
  ],
  [
    "풀 사이에서 덜 보이도록 여러 초록 천을 이었습니다.",
    "숙이고 달릴 때 갈대처럼 부드럽게 접힙니다. 바람을 막지 않고 함께 흐릅니다.",
  ],
  [
    "작은 주머니마다 다른 풀 냄새가 배었습니다. 빈 주머니에도 오래 향이 남습니다.",
    "젖은 이의 몸을 감싸주던 외투를 고쳤습니다. 따뜻한 손길이 남아 있습니다.",
  ],
];
CLASSES.forEach((c, ci) =>
  [1, 2].forEach((t) => {
    const mat = t === 1 ? "fiber" : "seawood",
      ore = t === 1 ? "ironstone" : "shellore";
    item(
      c.weapon + t,
      weaponNames[c.weapon][t - 1],
      "equipment",
      weaponLore[c.weapon][t - 1],
      {
        slot: "weapon",
        classId: c.id,
        weapon: c.weapon,
        tier: t,
        level: t === 1 ? 1 : 15,
        attack: t === 1 ? 8 : 34,
        color: c.color,
        price: t === 1 ? 55 : 260,
        recipe: { [mat]: t === 1 ? 5 : 9, [ore]: t === 1 ? 2 : 5 },
      },
    );
    item(
      c.id + "armor" + t,
      armorNames[ci][t - 1],
      "equipment",
      armorLore[ci][t - 1],
      {
        slot: "armor",
        classId: c.id,
        tier: t,
        level: t === 1 ? 1 : 15,
        defense: t === 1 ? 5 : 19,
        color: c.color,
        price: t === 1 ? 45 : 210,
        recipe: { [mat]: t === 1 ? 4 : 8, [ore]: t === 1 ? 2 : 4 },
      },
    );
  }),
);
[
  [
    "hood1",
    "接은잎 두건",
    "head",
    1,
    "비를 잠깐 피하려고 접은 잎이 견습생의 상징이 되었습니다.",
  ],
  [
    "hood2",
    "조개빛 이마띠",
    "head",
    2,
    "작은 빛이 안개 속 귀환길을 알려준다고 해안 사람들은 믿습니다.",
  ],
  [
    "boots1",
    "기운 천신",
    "boots",
    1,
    "밑창에 덧댄 천 조각마다 짧은 여행이 하나씩 남았습니다.",
  ],
  [
    "boots2",
    "소금길 장화",
    "boots",
    2,
    "얕은 바다를 건너도 발이 무겁게 젖지 않게 만들었습니다.",
  ],
  [
    "charm1",
    "도토리 약속목걸이",
    "charm",
    1,
    "떠나는 친구와 도토리를 반씩 나누어 가진 풍습에서 시작되었습니다.",
  ],
  [
    "charm2",
    "은물결 조개반지",
    "charm",
    2,
    "멀리 간 가족이 돌아오면 함께 바다에 비추어 보는 반지입니다.",
  ],
].forEach(([id, name, slot, tier, lore]) =>
  item(id, name.replace("接", "접"), "equipment", lore, {
    slot,
    tier,
    level: tier === 1 ? 1 : 15,
    defense: slot === "charm" ? 0 : tier === 1 ? 2 : 7,
    attack: slot === "charm" ? (tier === 1 ? 3 : 11) : 0,
    color: tier === 1 ? "#c5c58b" : "#acced0",
    price: tier === 1 ? 32 : 150,
    recipe: {
      [tier === 1 ? "fiber" : "seawood"]: tier === 1 ? 3 : 6,
      [tier === 1 ? "ironstone" : "shellore"]: tier === 1 ? 1 : 3,
    },
  }),
);
const branchNames = [
  "녹각 새싹창",
  "갈고리 가시창",
  "달고리 가지장",
  "별꽃 파종장",
  "흰깃 매눈궁",
  "안개잎 단궁",
  "꽃숨 순환봉",
  "쓴향 가시봉",
];
const branchLore = [
  "처음 세운 방벽을 기억하는 창. 보호하려는 방향으로 어린 가지가 돋습니다.",
  "돌아오지 않은 이를 찾던 추적자의 방식으로 깎았습니다. 날을 뒤로 당길 때 가시가 열립니다.",
  "해안의 둥근 달을 담은 고리. 고요히 기다린 빛에 힘을 더합니다.",
  "피지 못한 봉오리를 버리지 않고 품었습니다. 제때 피어날 순간을 기다립니다.",
  "가장 먼 잎의 흔들림을 보던 사수의 활. 먼 표적에 대한 집중을 돕습니다.",
  "막힌 길 대신 바람 사이의 길을 택한 궁수의 활입니다.",
  "오늘 낫지 않은 상처를 내일까지 돌보겠다는 약속을 새겼습니다.",
  "약과 독이 같은 뿌리에서 나온다는 가르침을 새겼습니다.",
];
CLASSES.forEach((c, ci) =>
  c.branches.forEach((b, bi) =>
    item(
      b.id + "weapon",
      branchNames[ci * 2 + bi],
      "equipment",
      branchLore[ci * 2 + bi],
      {
        slot: "weapon",
        classId: c.id,
        branch: b.id,
        weapon: c.weapon,
        tier: 3,
        level: 25,
        attack: 54,
        color: c.color,
        price: 520,
        recipe: { seawood: 16, shellore: 10, saltflower: 4 },
      },
    ),
  ),
);
for (const trophy of TROPHIES) {
  const monster = MONSTERS.find((m) => m.id === trophy.monster);
  item(trophy.id, trophy.name, "trophy", trophy.lore, {
    monster: trophy.monster,
    price: 8 + monster.level * 4 + (monster.type === "boss" ? 140 : 0),
    color: monster.color,
  });
}
export const RECIPES = Object.values(ITEMS).filter((i) => i.recipe);
export const QUESTS = [
  {
    id: "q0",
    title: "울타리 밖의 작은 소동",
    text: "씨앗을 모으는 생물들이 밭을 어지럽힙니다. 새싹 울타리에서 3마리를 진정시켜 주세요.",
    kind: "kill",
    map: "sprout",
    count: 3,
  },
  {
    id: "q1",
    title: "작은 상처를 돌보는 법",
    text: "새싹 울타리의 약초 군락에서 보들잎을 3개 채집해 주세요.",
    kind: "gather",
    item: "softleaf",
    count: 3,
  },
  {
    id: "q2",
    title: "여행자의 첫 연고",
    text: "마을의 제작대에서 보들잎 연고를 1개 만들어 보세요. 재료는 보들잎 2개와 버들섬유 1개입니다.",
    kind: "craft",
    item: "salve",
    count: 1,
  },
  {
    id: "q3",
    title: "사라진 씨앗의 발자국",
    text: "도토리 샛길에서 5마리를 진정시키고 식량을 숨기는 이유를 알아보세요.",
    kind: "kill",
    map: "acorn",
    count: 5,
  },
  {
    id: "q4",
    title: "개울이 보내온 소식",
    text: "이슬개울에서 5마리를 진정시켜 막힌 길을 조사하세요.",
    kind: "kill",
    map: "brook",
    count: 5,
  },
  {
    id: "q5",
    title: "그루터기의 오래된 약속",
    text: "오래된 그루터기의 할아범을 진정시키세요. 붉은 공격 예고에서 벗어나는 것이 중요합니다.",
    kind: "boss",
    monster: "m20",
    count: 1,
  },
  {
    id: "q6",
    title: "숲 너머의 소금바람",
    text: "그루터기 너머의 길을 따라 조개등 마을에 도착하세요.",
    kind: "travel",
    map: "shelltown",
    count: 1,
  },
  {
    id: "q7",
    title: "바다가 올라오는 숲",
    text: "소금바람 숲에서 6마리를 진정시키고 바다 생물의 발자국을 조사하세요.",
    kind: "kill",
    map: "saltwood",
    count: 6,
  },
  {
    id: "q8",
    title: "파도에도 피는 꽃",
    text: "해안 지역에서 소금꽃 3개를 채집하세요. 흰빛과 분홍빛 꽃잎을 찾아보세요.",
    kind: "gather",
    item: "saltflower",
    count: 3,
  },
  {
    id: "q9",
    title: "해안 약사의 배합",
    text: "마을에서 소금꽃 해독제 1개를 만들어 보세요. 소금꽃 2개와 보들잎 1개가 필요합니다.",
    kind: "craft",
    item: "antidote",
    count: 1,
  },
  {
    id: "q10",
    title: "유리열매의 빛",
    text: "유리열매 모래밭에서 6마리를 진정시키세요. 빛나는 등과 움직이는 모래를 조심하세요.",
    kind: "kill",
    map: "glassbeach",
    count: 6,
  },
  {
    id: "q11",
    title: "물에 잠긴 뿌리길",
    text: "밀물뿌리 습지에서 6마리를 진정시키고 동굴로 이어지는 길을 찾으세요.",
    kind: "kill",
    map: "tideroot",
    count: 6,
  },
  {
    id: "q12",
    title: "푸른숨을 되돌려줘",
    text: "해식동굴의 뿌리해룡을 진정시키고 숲과 바다의 숨길을 다시 열어 주세요.",
    kind: "boss",
    monster: "m40",
    count: 1,
  },
].map((q, i) => ({ ...q, xp: 250 + i * 120, gold: 60 + i * 30 }));
export const SKILL_COOLDOWNS = [3.2, 7, 10, 16];
export const SKILL_COSTS = [12, 20, 25, 35];
export const SLOT_NAMES = {
  weapon: "무기",
  armor: "방어구",
  head: "머리",
  boots: "신발",
  charm: "장신구",
};
export const TYPE_NAMES = {
  normal: "일반",
  elite: "정예",
  rare: "희귀",
  boss: "지역 보스",
};
export const PORTALS = (mapId) => {
  const index = MAPS.findIndex((m) => m.id === mapId);
  const exits = [];
  if (index > 0)
    exits.push({
      ...NAVIGATION[mapId].west,
      to: MAPS[index - 1].id,
      label: MAPS[index - 1].name,
    });
  if (index < MAPS.length - 1)
    exits.push({
      ...NAVIGATION[mapId].east,
      to: MAPS[index + 1].id,
      label: MAPS[index + 1].name,
    });
  return exits;
};
