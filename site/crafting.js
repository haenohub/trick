// The field guide, village workshop and authoritative loot tables share these
// recipes. Existing item IDs remain valid in older saves.
export const CRAFT_MATERIALS = [
  {
    id: "seedmeal",
    name: "씨앗 고운가루",
    price: 12,
    dropSpecies: [2, 6, 10, 30, 42, 44],
    lore: "씨앗을 저장하는 생물들의 자루에서 얻는 고운 가루. 마을 제빵사는 바람에 날리기 전에 도토리 껍질에 담아 둡니다.",
  },
  {
    id: "wildhoney",
    name: "숲꽃 벌꿀",
    price: 16,
    dropSpecies: [1, 3, 18, 41, 43, 49],
    lore: "꽃과 수액을 찾아다니던 작은 생물에게 묻어 온 꿀. 서로 다른 숲꽃의 향이 한 병 안에서 계절을 나눠 가집니다.",
  },
  {
    id: "springwater",
    name: "맑은 샘물",
    price: 10,
    dropSpecies: [11, 12, 15, 31, 35, 41, 47, 48],
    lore: "물가의 생물이 껍질과 잎그릇에 담아 둔 샘물. 숲의 연금술사는 가장 먼저 물의 냄새부터 확인합니다.",
  },
  {
    id: "gelagar",
    name: "바다한천",
    price: 24,
    dropSpecies: [23, 26, 28, 38, 52, 56],
    lore: "해초를 타고 다니던 생물에게서 얻는 투명한 응고질. 파도처럼 흩어지던 약효를 젤리 안에 천천히 붙잡아 둡니다.",
  },
  {
    id: "spiceberry",
    name: "햇가시 향신열매",
    price: 28,
    dropSpecies: [19, 21, 25, 30, 53, 54],
    lore: "볕 좋은 가시덤불에서 동물과 바람수피가 옮겨 온 붉은 열매. 해안의 요리사들은 짠 국물에 딱 한 알을 띄웁니다.",
  },
  {
    id: "moonyeast",
    name: "달빛 발효종",
    price: 22,
    dropSpecies: [17, 18, 20, 43, 49, 50],
    lore: "밤버섯과 오래된 나무에 자라는 보랏빛 발효종. 달이 차는 밤마다 작은 항아리의 뚜껑을 한 번씩 밀어 올립니다.",
  },
  {
    id: "prismsalt",
    name: "푸른 결정염",
    price: 44,
    dropSpecies: [36, 37, 39, 40, 59, 60],
    lore: "깊은 바다동굴의 생물들이 품은 푸른 소금 결정. 아주 적은 양만으로도 서로 밀어내던 마력 성분을 한데 묶습니다.",
  },
];

export const TROPHY_CONSUMABLES = [
  {
    id: "seedcrunch",
    name: "볼주머니 씨앗강정",
    heal: 0.24,
    focus: 8,
    price: 28,
    level: 2,
    recipe: { trophy2: 1, seedmeal: 1, wildhoney: 1 },
    recipeNote: "볼주머니의 식용 씨앗을 골라 가루·벌꿀과 눌러 굳힙니다.",
    lore: "솜털씨앗쥐가 모아 둔 씨앗을 구운 작은 강정. 길 위에서 나눠 먹을 수 있도록 세 조각의 홈을 냈습니다.",
  },
  {
    id: "sproutcongee",
    name: "새순 매듭죽",
    heal: 0.28,
    regen: 0.01,
    duration: 6,
    price: 36,
    level: 3,
    recipe: { trophy3: 1, seedmeal: 1, springwater: 1 },
    recipeNote: "새순 뿌리매듭을 풀어 씻고 씨앗가루와 샘물로 푹 끓입니다.",
    lore: "흙묻은 새순이가 남긴 연한 뿌리를 달인 죽. 묘목을 돌보다 끼니를 놓친 사람에게 가장 먼저 내어 주는 음식입니다.",
  },
  {
    id: "sporesteambun",
    name: "포자편지 찐빵",
    heal: 0.42,
    focus: 30,
    price: 64,
    level: 9,
    recipe: { trophy43: 1, trophy17: 1, seedmeal: 2, moonyeast: 1 },
    recipeNote:
      "버섯 포자와 발효종으로 반죽을 부풀린 뒤 포자 편지조각으로 감쌉니다.",
    lore: "접힌편지 버섯의 이야기를 모자 주름과 함께 찐 빵. 반죽이 부풀 때 접힌 잎이 열려 작은 봉투처럼 보입니다.",
  },
  {
    id: "pinecoilcandy",
    name: "솔잎 태엽엿",
    speedBonus: 0.12,
    flatBuff: { accuracy: 10 },
    duration: 90,
    price: 62,
    level: 7,
    recipe: { trophy45: 1, trophy8: 1, wildhoney: 2 },
    recipeNote:
      "솔잎고리의 향을 꿀에 우려 고치틀에 감아 나선형 엿으로 굳힙니다.",
    lore: "되감긴 솔잎고리를 본떠 만든 나선형 엿. 서두르는 배달부도 한 바퀴씩 풀어 먹으며 호흡을 고릅니다.",
  },
  {
    id: "riverjelly",
    name: "물결 조약젤리",
    heal: 0.38,
    focus: 40,
    price: 60,
    level: 8,
    recipe: { trophy47: 1, trophy11: 1, springwater: 2, mint: 1 },
    recipeNote:
      "조약돌로 식힌 샘물과 박하즙을 이슬 등막의 천연 응고질로 굳힙니다.",
    lore: "겹물결 조약돌의 잔물결을 찍은 푸른 젤리. 다 먹은 뒤에도 물수제비의 둥근 자국을 떠올리게 합니다.",
  },
  {
    id: "amberpudding",
    name: "수액 호박푸딩",
    heal: 0.5,
    regen: 0.015,
    duration: 10,
    price: 86,
    level: 10,
    recipe: { trophy18: 1, trophy44: 1, seedmeal: 1, moonyeast: 1 },
    recipeNote:
      "굳은 수액을 녹여 발효 반죽과 섞고 찻잔손잡이를 붙인 도토리 틀에서 찝니다.",
    lore: "수액방울 딱정벌레가 모은 호박빛 단맛. 도토리 찻잔의 작은 손잡이가 있어 뜨거운 숲 간식도 천천히 들 수 있습니다.",
  },
  {
    id: "mooncapstew",
    name: "달접시 버섯스튜",
    focus: 55,
    buff: { magicPower: 0.15 },
    duration: 120,
    price: 88,
    level: 10,
    recipe: { trophy49: 1, trophy17: 1, springwater: 2 },
    recipeNote:
      "달빛 갓주름과 버섯모자 주름을 샘물에 끓여 은은한 포자 향을 냅니다.",
    lore: "숲의 밤을 밝히던 두 버섯을 함께 끓인 스튜. 견습 술사는 식기 전에 자신의 첫 주문을 한 번 더 읽습니다.",
  },
  {
    id: "ringstock",
    name: "연륜 뿌리곰탕",
    heal: 0.25,
    buff: { maxHp: 0.2, defense: 0.15 },
    duration: 150,
    price: 140,
    level: 12,
    craftOnly: true,
    recipe: { trophy50: 1, trophy20: 1, trophy3: 2, springwater: 3 },
    recipeNote: "두 나이테의 지킴 기운을 씻은 뿌리 국물에 천천히 우려 냅니다.",
    lore: "닫히지 않는 나이테와 지킴나이테를 한 솥에 우렸습니다. 오래 버티는 법을 아는 숲의 두 어른이 남긴 겨울 음식입니다.",
  },
  {
    id: "saltcrystaltaffy",
    name: "첫소금 눈꽃엿",
    heal: 0.5,
    focus: 40,
    cleanse: true,
    price: 92,
    level: 13,
    recipe: { trophy51: 1, trophy21: 1, wildhoney: 2, saltflower: 1 },
    recipeNote:
      "꽃턱과 소금털에서 식용 소금만 털어 꿀엿에 녹입니다. 털은 걸러 냅니다.",
    lore: "소금꽃 접시의 첫 결정으로 만든 하얀 엿. 먼 숲에 돌아갈 뱃사람이 바다의 첫눈이라 부르며 챙깁니다.",
  },
  {
    id: "silverleaftea",
    name: "은잎 비늘차",
    flatBuff: { evasion: 0.1 },
    buff: { magicDefense: 0.2 },
    duration: 120,
    price: 112,
    level: 14,
    recipe: { trophy22: 1, trophy52: 1, mint: 2, springwater: 1 },
    recipeNote:
      "은잎 비늘의 보호 성분을 박하차에 우려 부표매듭의 빈 주머니에 거릅니다.",
    lore: "바다를 비추던 은잎 비늘을 차로 옮겼습니다. 푸른 부표매듭을 풀면 물결에 몸을 맡기던 항해사의 향이 납니다.",
  },
  {
    id: "glassfruitjam",
    name: "유리열매 보석잼",
    flatBuff: { critChance: 0.12 },
    duration: 120,
    price: 118,
    level: 16,
    recipe: { trophy26: 2, trophy30: 1, wildhoney: 2, gelagar: 1 },
    recipeNote:
      "투명 열매껍질과 씨앗지갑의 과육을 꿀·한천으로 졸여 보석처럼 굳힙니다.",
    lore: "딱정벌레가 먹던 유리열매와 원숭이가 숨긴 씨앗의 잼. 빵 위에 올리면 작은 약점 하나까지 환하게 비춘다는 속설이 있습니다.",
  },
  {
    id: "foamparfait",
    name: "파도거품 파르페",
    heal: 0.72,
    focus: 80,
    price: 152,
    level: 18,
    recipe: { trophy28: 2, trophy23: 1, gelagar: 2, wildhoney: 1 },
    recipeNote:
      "거품 구슬을 휘저어 한천 크림으로 만들고 씻은 이사조각을 그릇으로 씁니다.",
    lore: "해파리의 거품 구슬을 층층이 쌓은 차가운 간식. 조개집을 떠난 소라게에게도 여행의 기쁨이 남도록 빈 껍질에 담았습니다.",
  },
  {
    id: "reedscrolltea",
    name: "갈대 두루마리차",
    focus: 85,
    flatBuff: { accuracy: 35 },
    buff: { magicPower: 0.25 },
    duration: 150,
    price: 185,
    level: 20,
    craftOnly: true,
    recipe: { trophy57: 1, trophy34: 1, breathgrass: 2, springwater: 2 },
    recipeNote:
      "갈대 속 잎두루마리를 푸른숨풀과 우려 웃음매듭으로 차 거름망을 묶습니다.",
    lore: "숨쉬는 갈대서가의 오래된 잎 문장을 우린 차. 끝까지 읽은 여행자에게 흔들리지 않는 눈과 또렷한 주문을 빌려 줍니다.",
  },
  {
    id: "pearldrop",
    name: "진주눈 응축약",
    heal: 0.85,
    cleanse: true,
    price: 170,
    level: 21,
    recipe: { trophy32: 2, trophy27: 1, gelagar: 1, saltflower: 2 },
    recipeNote:
      "눈물돌의 진주 성분을 녹이고 모래주머니로 걸러 남은 독기를 소금꽃으로 씻습니다.",
    lore: "진주눈 망둑어가 바다 밑에서 삼켰던 눈물의 약. 빈 병에 마지막 진주빛 한 점이 오래 남습니다.",
  },
  {
    id: "mossbarkstew",
    name: "이끼비늘 장수탕",
    buff: { defense: 0.45, magicDefense: 0.35 },
    regen: 0.01,
    duration: 120,
    price: 220,
    level: 22,
    craftOnly: true,
    recipe: { trophy33: 2, trophy58: 1, spiceberry: 2, springwater: 3 },
    recipeNote:
      "묵은 비늘의 보호질을 끓이고 수문 못의 보존 기운을 향신열매 국물에 옮깁니다.",
    lore: "늪에서 오래 살아남은 등비늘과 물길을 지킨 수문 못의 탕. 뜨거운 김이 식어도 어깨를 감싼 든든함은 남습니다.",
  },
  {
    id: "whiteantlerelixir",
    name: "흰물길 순환약",
    heal: 0.6,
    regen: 0.045,
    duration: 16,
    price: 235,
    level: 23,
    craftOnly: true,
    recipe: { trophy35: 1, trophy31: 2, breathgrass: 3, moonyeast: 1 },
    recipeNote:
      "물길뿔에서 추출한 순환 기운을 뿌리 흙고리 여과층에 통과시켜 발효합니다.",
    lore: "흰사슴의 물길처럼 몸 안의 지친 흐름을 잇는 약. 길이 끊겼던 갈대숲에서 치유사들이 처음 완성했습니다.",
  },
  {
    id: "blueshellbroth",
    name: "푸른등 해초수프",
    heal: 0.85,
    focus: 100,
    price: 210,
    level: 24,
    recipe: { trophy36: 2, trophy38: 1, prismsalt: 1, springwater: 2 },
    recipeNote:
      "푸른등껍질로 육수를 내고 씻은 말미잘 해초술과 결정염으로 마무리합니다.",
    lore: "동굴새우 껍질이 우러난 짙푸른 국물. 긴 잠수 뒤 조개등 마을로 돌아온 이들이 말없이 두 손으로 받쳐 듭니다.",
  },
  {
    id: "crystalbloomcordial",
    name: "수정꽃 맥동액",
    buff: { magicPower: 0.35 },
    flatBuff: { critDamage: 0.4 },
    duration: 150,
    price: 280,
    level: 25,
    craftOnly: true,
    recipe: { trophy59: 2, trophy37: 1, prismsalt: 2, wildhoney: 1 },
    recipeNote:
      "수정꽃 맥침과 소금별을 결정염으로 공명시키고 벌꿀에 마력을 고정합니다.",
    lore: "푸른맥 수정꽃의 고동을 한 방울에 겹쳤습니다. 병을 연 술사의 주문 끝에 잠든 별의 잔상이 잠깐 따라옵니다.",
  },
  {
    id: "coralward",
    name: "산호빗장 수호환",
    buff: { maxHp: 0.4, defense: 0.5 },
    duration: 150,
    price: 290,
    level: 26,
    craftOnly: true,
    recipe: { trophy39: 2, trophy29: 1, gelagar: 2, prismsalt: 2 },
    recipeNote:
      "산호빗장과 조개날에서 보호 성분을 추출해 한천·결정염으로 작은 환을 빚습니다.",
    lore: "바닷문을 잠그던 산호빗장의 힘을 접어 만든 약환. 돌아갈 문을 끝까지 지키는 수문게의 고집이 담겨 있습니다.",
  },
  {
    id: "starbreath",
    name: "별숨 용린비약",
    heal: 1,
    focus: 100,
    cleanse: true,
    buff: { attack: 0.4, magicPower: 0.4 },
    duration: 90,
    price: 420,
    level: 27,
    craftOnly: true,
    recipe: { trophy40: 2, trophy60: 2, prismsalt: 3, moonyeast: 2 },
    recipeNote:
      "숨비늘과 별빛 종유껍질을 함께 공명·발효합니다. 결정염이 폭주하는 힘을 묶습니다.",
    lore: "뿌리해룡의 숨과 종유심이 삼킨 별빛을 함께 깨운 비약. 깊은 동굴에서 모두를 데리고 돌아오겠다는 마지막 약속을 위해 빚습니다.",
  },
];

// Existing twenty recipes, re-authored around the species' actual trophies.
const revisions = {
  dewjelly: [
    1,
    { trophy41: 1, wildhoney: 1, softleaf: 1 },
    "이슬잔 잎받침에 고인 이슬과 벌꿀을 잎의 응고질로 굳힙니다.",
  ],
  acornbread: [
    3,
    { trophy6: 1, seedmeal: 2, wildhoney: 1 },
    "금 간 도토리투구를 깨끗이 씻어 빵틀로 쓰고, 씨앗가루·꿀 반죽을 채워 굽습니다.",
  ],
  brooktea: [
    8,
    { trophy15: 1, trophy12: 1, mint: 2, springwater: 1 },
    "잠돌로 차를 식히고 갈대발 고리에 박하 찻잎을 묶어 샘물에 우립니다.",
  ],
  moonnectar: [
    10,
    { trophy42: 1, trophy49: 1, wildhoney: 2 },
    "씨앗 종추 안의 남은 씨앗과 달빛 갓주름을 꿀물에 우립니다.",
  ],
  rootbroth: [
    3,
    { trophy3: 2, springwater: 2, softleaf: 1 },
    "흙을 턴 뿌리매듭을 보들잎과 푹 고아 부드러운 수프를 만듭니다.",
  ],
  saltmousse: [
    13,
    { trophy51: 1, trophy21: 1, saltflower: 2 },
    "꽃턱과 소금털에서 털을 걸러 소금만 모으고, 소금꽃 점액을 휘핑합니다.",
  ],
  breathdrop: [
    24,
    { trophy36: 1, trophy13: 1, breathgrass: 3, prismsalt: 1 },
    "푸른등껍질의 기운을 푸른숨풀에 녹여 빈 허물의 여과층을 통과시킵니다.",
  ],
  leafcompress: [
    4,
    { trophy1: 2, trophy5: 1, trophy7: 1, softleaf: 3 },
    "잎맥을 약잎에 덧대고 솜털을 깐 뒤 해진 꼬리리본으로 묶어 습포로 만듭니다.",
  ],
  tideelixir: [
    23,
    { trophy28: 1, trophy35: 1, breathgrass: 3, gelagar: 1 },
    "물길뿔의 순환 기운과 거품 구슬을 푸른숨풀 농축액에 고정합니다.",
    true,
  ],
  springphial: [
    27,
    { trophy20: 1, trophy40: 1, trophy60: 1, softleaf: 4 },
    "숲의 나이테·바다의 숨비늘·별빛 껍질을 보들잎 정수에 합쳐 첫봄을 재현합니다.",
    true,
  ],
  barktonic: [
    10,
    { trophy9: 1, trophy18: 2, spiceberry: 1 },
    "옹이단추의 붉은 수피와 수액을 향신열매와 발효해 힘을 깨웁니다.",
  ],
  starcordial: [
    10,
    { trophy49: 2, trophy43: 1, wildhoney: 1 },
    "달빛 갓주름과 포자 편지조각에서 빛나는 성분을 꿀에 농축합니다.",
  ],
  stonebiscuit: [
    6,
    { trophy4: 1, trophy10: 1, seedmeal: 2 },
    "속 빈 가시로 도토리 반죽에 방패 홈을 내고 단단하게 두 번 굽습니다.",
  ],
  shellsyrup: [
    21,
    { trophy23: 1, trophy32: 1, wildhoney: 2 },
    "조개 안쪽 막과 진주눈 눈물돌에서 보호 성분을 우려 꿀에 졸입니다.",
  ],
  hawkseed: [
    6,
    { trophy2: 1, trophy46: 1, mint: 2 },
    "씨앗차를 화살돌로 눌러 향을 내고 박하로 눈을 맑게 합니다.",
  ],
  mistlozenge: [
    7,
    { trophy13: 1, trophy11: 1, mint: 3 },
    "빈 허물의 가벼운 기운을 박하에 옮기고 등막의 응고질로 얇게 굳힙니다.",
  ],
  thornjam: [
    10,
    { trophy19: 1, spiceberry: 2, wildhoney: 1 },
    "엄니에 감긴 식용 뿌리의 가시 성분만 추출해 붉은 열매·꿀과 졸입니다.",
  ],
  sunpepper: [
    25,
    { trophy54: 1, trophy37: 1, spiceberry: 3, saltflower: 1 },
    "노을 모래의 온기를 열매에 옮기고 소금별·소금꽃으로 강하게 절입니다.",
  ],
  windnectar: [
    16,
    { trophy24: 1, trophy53: 1, trophy25: 1, wildhoney: 2 },
    "바람깃·바람수피·길잡이 수염의 바람 기운을 꿀에 우린 뒤 모두 거릅니다.",
  ],
  heartroot: [
    20,
    { trophy20: 1, trophy31: 2, moonyeast: 1, softleaf: 3 },
    "지킴나이테에서 얻은 생명력과 뿌리 흙고리로 거른 잎즙을 천천히 발효합니다.",
    true,
  ],
};

export function addCraftingContent(items, monsters) {
  for (const entry of CRAFT_MATERIALS)
    items[entry.id] = {
      type: "material",
      color: "#a8d59d",
      ...entry,
      dropSpecies: entry.dropSpecies.map((n) => `m${n}`),
    };
  for (const entry of TROPHY_CONSUMABLES)
    items[entry.id] = { type: "consumable", color: "#a8d59d", ...entry };
  for (const [
    id,
    [level, recipe, recipeNote, craftOnly = false],
  ] of Object.entries(revisions))
    Object.assign(items[id], { level, recipe, recipeNote, craftOnly });
  Object.assign(items.brooktea, { focus: 70, heal: 0.1 });
  Object.assign(items.moonnectar, { heal: 0.35, focus: 70 });
  Object.assign(items.tideelixir, {
    heal: 0.85,
    focus: 100,
    regen: 0.025,
    duration: 10,
  });
  for (const id of [
    ...Object.keys(revisions),
    ...TROPHY_CONSUMABLES.map((i) => i.id),
  ]) {
    const i = items[id];
    i.craftGuide = true;
    i.craftCategory =
      i.buff || i.flatBuff || i.speedBonus ? "enhancement" : "recovery";
    const sources = Object.keys(i.recipe)
      .filter((id) => items[id].type === "trophy")
      .map((id) => items[id].monster);
    // When a recipe uses several species, its highest-level trophy sets the
    // unlock. Lower-level creatures never drop the stronger completed potion.
    i.level = Math.max(
      i.level,
      ...sources.map((id) => monsters.find((m) => m.id === id).level),
    );
    i.dropSpecies = sources.filter(
      (id) => monsters.find((m) => m.id === id).level >= i.level,
    );
  }
  // Basic four are retained as introductory, save-compatible remedies.
  // They also gain a small, readily obtainable trophy ingredient.
  for (const [id, trophy] of Object.entries({
    salve: "trophy1",
    mintpotion: "trophy41",
    antidote: "trophy51",
    bluepotion: "trophy28",
  })) {
    items[id].recipe = { ...items[id].recipe, [trophy]: 1 };
    items[id].level = id === "antidote" ? 13 : id === "bluepotion" ? 18 : 1;
  }
}
