import {
  CLASSES,
  REGIONS,
  MAPS,
  MONSTERS,
  ITEMS,
  QUESTS,
  RECIPES,
  NPCS,
  SAVE_KEY,
  SLOT_NAMES,
  TYPE_NAMES,
  PORTALS,
  SKILL_COSTS,
  SKILL_COOLDOWNS,
} from "./data.js";
import {
  World,
  createPlayer,
  hydrateSave,
  serialize,
  questProgress,
  xpNeeded,
  distance,
} from "./core.js";
import {
  Renderer,
  loadArt,
  drawCharacterPreview,
  drawMonsterPreview,
} from "./renderer.js";
const $ = (id) => document.getElementById(id),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const ART_REVISION =
  document.querySelector('meta[name="leaftale-revision"]')?.content || "local";
const canvas = $("world"),
  renderer = new Renderer(canvas, $("minimap"));
let world = null,
  state = null,
  running = false,
  selectedClass = "warden",
  target = null,
  panel = null,
  filter = "all",
  iconIds = {},
  artMeta = {},
  lastSave = 0,
  lastHud = 0,
  lastFrame = performance.now(),
  toastTimer,
  pendingInteraction = null,
  socket = null,
  online = false,
  sound = false,
  audio = null,
  lastSoundEffect = 0,
  previousPanelFocus = null;
const skillDescriptions = {
  warden: [
    "앞의 적을 찔러 210% 피해를 줍니다.",
    "최대 체력의 28% 보호막을 얻어 7초 동안 몸을 지킵니다.",
    "창을 크게 휘둘러 근처 적에게 190% 범위 피해를 줍니다.",
  ],
  mage: [
    "발사한 빛으로 적 하나에게 220% 피해를 줍니다.",
    "목표 주변에 달이슬을 터뜨려 210% 범위 피해를 줍니다.",
    "목표 주변에 135% 피해를 주고 3초 동안 발을 묶습니다.",
  ],
  ranger: [
    "긴 사거리에서 220% 피해를 줍니다.",
    "위협의 반대 방향으로 빠르게 구릅니다.",
    "9초 동안 적이 받는 피해를 30% 늘리고 120% 피해를 줍니다.",
  ],
  herbalist: [
    "자신과 가까운 동료의 체력을 최대 체력의 32%만큼 회복합니다.",
    "140% 피해를 주고 8초 동안 매초 32%의 독 피해를 줍니다.",
    "가까운 적에게 120% 피해를 주고 7초 동안 자신을 회복합니다.",
  ],
};
function toast(text) {
  $("toast").textContent = text;
  $("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").hidden = true), 3200);
}
function readSave() {
  try {
    return hydrateSave(JSON.parse(localStorage.getItem(SAVE_KEY)));
  } catch {
    return null;
  }
}
function save(manual = false) {
  if (!running || online || !world) return;
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(serialize(world.players.get("local"))),
    );
    $("save-status").textContent = "방금 저장됨";
    if (manual) toast("이 브라우저에 모험을 저장했습니다.");
  } catch {
    $("save-status").textContent = "저장 불가 · 설정에서 파일 내보내기";
    if (manual) toast("저장 공간을 확인하거나 저장 파일을 내보내 주세요.");
  }
}
function tone(freq = 440) {
  if (!sound) return;
  try {
    audio ??= new AudioContext();
    audio.resume();
    const o = audio.createOscillator(),
      g = audio.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      freq * 0.75,
      audio.currentTime + 0.1,
    );
    g.gain.setValueAtTime(0.025, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.15);
    o.connect(g);
    g.connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + 0.16);
  } catch {}
}
function start(saved = null) {
  if (socket) {
    socket.close();
    socket = null;
  }
  online = false;
  world = new World({ seed: Date.now() });
  world.addPlayer(
    saved || createPlayer(selectedClass, $("adventurer-name").value),
    "local",
  );
  state = world.snapshot("local");
  running = true;
  $("lobby").hidden = true;
  $("hud").hidden = false;
  target = null;
  buildSkillbar();
  closePanel();
  hud();
  canvas.focus();
  save();
  if (!saved)
    toast("바닥 클릭 이동 · 몬스터 클릭 공격 · E 상호작용 · H 도움말");
}
function send(action, quiet = false) {
  if (!running) return false;
  if (online) {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "action", action }));
      return true;
    }
    return false;
  }
  const ok = world.act("local", action);
  state = world.snapshot("local");
  if (
    !ok &&
    !quiet &&
    ["craft", "equip", "buy", "sell", "subclass", "travel", "potion"].includes(
      action.type,
    )
  )
    toast(
      action.type === "craft"
        ? "마을에서 재료·골드·레벨을 확인해 주세요."
        : action.type === "travel"
          ? "이동 지점에 가까이 가거나, 방문한 마을을 선택해 주세요."
          : "지금은 사용할 수 없습니다. 조건을 확인해 주세요.",
    );
  if (ok) {
    hud();
    if (
      [
        "craft",
        "equip",
        "buy",
        "sell",
        "subclass",
        "claimQuest",
        "dismantle",
        "plant",
        "harvest",
      ].includes(action.type)
    ) {
      save();
      if (panel) renderPanel();
    }
    if (action.type === "subclass") buildSkillbar();
  }
  return ok;
}
function cls() {
  return CLASSES.find((c) => c.id === (state?.player.classId || selectedClass));
}
function displayClass() {
  const c = cls();
  return c.branches.find((b) => b.id === state?.player.branch)?.name || c.name;
}
function atlasIcon(file, cols, rows, index) {
  return `<span class="item-icon" style="background-image:url('./assets/${file}.png?v=${ART_REVISION}');background-size:${cols * 32}px ${rows * 32}px;background-position:-${(index % cols) * 32}px -${Math.floor(index / cols) * 32}px" aria-hidden="true"></span>`;
}
function itemIcon(id) {
  const special = artMeta.itemOverrides?.[id];
  return special
    ? atlasIcon(special.file, special.cols, special.rows, special.index)
    : atlasIcon("items", 8, 8, iconIds[id] || 0);
}
function abilityIcon(index) {
  return index >= 58
    ? atlasIcon("items", 6, 8, 42 + index - 58)
    : atlasIcon("items", 8, 8, index);
}
function skillName(slot) {
  return slot === 3
    ? cls().branches.find((b) => b.id === state?.player.branch)?.skill ||
        "전직 스킬"
    : cls().skills[slot];
}
function buildSkillbar() {
  if (!state) return;
  $("skillbar").innerHTML =
    `<button class="skill basic" data-action="attack" title="기본 공격 [Space / J]"><kbd>SPC</kbd><span class="glyph">${abilityIcon(58)}</span><span class="skill-name">기본 공격</span></button>` +
    [0, 1, 2, 3]
      .map(
        (n) =>
          `<button class="skill" data-action="skill" data-slot="${n}" title="${skillName(n)} [${n + 1}]"><kbd>${n + 1}</kbd><span class="glyph">${abilityIcon(artMeta.skillIcons[cls().id][n])}</span><span class="skill-name">${skillName(n)}</span><span class="cooldown" id="cooldown-${n}" hidden></span></button>`,
      )
      .join("") +
    `<button class="skill potion" data-action="potion" title="보들잎 연고 [Q]"><kbd>Q</kbd><span class="glyph">${abilityIcon(59)}</span><span class="skill-name">연고</span><span class="count" id="salve-count"></span><span class="cooldown" id="potion-cooldown" hidden></span></button>`;
}
function hud() {
  if (!state) return;
  const p = state.player,
    map = MAPS.find((m) => m.id === p.map),
    q = QUESTS[p.quest.index],
    s = p.stats;
  $("player-name").textContent = p.name;
  $("player-level").textContent = `Lv.${p.level}`;
  $("player-class").textContent = displayClass();
  drawCharacterPreview($("portrait"), p.classId, true);
  $("hp-fill").style.width = `${(p.hp / s.maxHp) * 100}%`;
  $("hp-text").textContent = `${Math.ceil(p.hp)} / ${s.maxHp}`;
  $("focus-fill").style.width = `${p.focus}%`;
  $("focus-text").textContent = `${Math.floor(p.focus)} / 100`;
  $("region-name").textContent =
    `${REGIONS[map.region].name} · CHAPTER 0${map.region + 1}`;
  $("map-name").textContent = map.name;
  $("map-level").textContent = map.town
    ? "안전한 마을"
    : `권장 Lv.${map.level}–${map.level + 3}`;
  $("map-coords").textContent = `${Math.floor(p.x)}, ${Math.floor(p.y)}`;
  $("quest-title").textContent = q ? q.title : "숲과 바다가 다시 숨 쉽니다";
  $("quest-summary").textContent = q
    ? q.text
    : "두 지역의 이야기를 마쳤습니다. 도감을 채우거나 새로운 직업의 길을 걸어보세요.";
  $("quest-progress").textContent = q
    ? `${questProgress(p)} / ${q.count}`
    : "지역 2 이야기 완료";
  $("quest-claim").hidden = !q || questProgress(p) < q.count;
  $("xp-fill").style.width = `${(p.xp / xpNeeded(p.level)) * 100}%`;
  $("xp-text").textContent =
    `Lv.${p.level} · ${p.xp} / ${xpNeeded(p.level)} EXP`;
  $("salve-count").textContent = p.inventory.salve || 0;
  for (let i = 0; i < 4; i++) {
    const e = $("cooldown-" + i),
      locked =
        (i === 1 && p.level < 4) ||
        (i === 2 && p.level < 8) ||
        (i === 3 && !p.branch);
    e.parentElement.classList.toggle("is-locked", locked);
    e.hidden = !locked && p.cooldowns[i] <= 0;
    e.textContent = locked
      ? i === 3
        ? "전직"
        : `Lv.${i === 1 ? 4 : 8}`
      : Math.ceil(p.cooldowns[i]);
  }
  $("potion-cooldown").hidden = p.potionCooldown <= 0;
  $("potion-cooldown").textContent = Math.ceil(p.potionCooldown);
  const mob = state.mobs.find((m) => m.uid === target && m.hp > 0);
  $("target-card").hidden = !mob;
  if (mob) {
    const d = MONSTERS.find((d) => d.id === mob.def);
    $("target-name").textContent = d.name;
    $("target-rank").textContent = `Lv.${d.level} · ${TYPE_NAMES[d.type]}`;
    $("target-fill").style.width = `${(mob.hp / mob.maxHp) * 100}%`;
  }
  const events = p.logs.slice(-4);
  $("event-log").innerHTML = events
    .map((e) => `<div class="${esc(e.type)}">${esc(e.text)}</div>`)
    .join("");
  const nearNpc = NPCS.find((n) => n.map === p.map && distance(n, p) < 2.6),
    nearPortal = PORTALS(p.map).find((a) => distance(a, p) < 2.5),
    nearHerb = state.herbs.find((a) => a.ready && distance(a, p) < 2);
  const prompt = nearNpc
    ? `[E] ${nearNpc.name}와 이야기`
    : nearPortal
      ? `[E] ${nearPortal.label} 이동`
      : nearHerb
        ? `[E] ${ITEMS[nearHerb.item].name} 잎 따기 · [Shift+E] 포기 수확`
        : null;
  $("interact-prompt").hidden = !prompt;
  if (prompt) $("interact-prompt").textContent = prompt;
  $("connection-label").textContent = online
    ? `함께하는 모험 · 접속자 ${state.peers.length + 1}명`
    : "나의 모험 · 브라우저 저장";
  for (const e of state.effects)
    if (
      e.id > lastSoundEffect &&
      ["hit", "burst", "level", "heal"].includes(e.kind)
    ) {
      tone(e.kind === "level" ? 880 : e.kind === "heal" ? 660 : 330);
      lastSoundEffect = e.id;
    }
}
function interact(whole = false) {
  if (!state) return;
  const p = state.player,
    n = NPCS.find((n) => n.map === p.map && distance(n, p) < 2.6);
  if (n) {
    openPanel("npc:" + n.id);
    return;
  }
  const port = PORTALS(p.map).find((a) => distance(a, p) < 2.5);
  if (port) {
    send({ type: "travel", map: port.to });
    return;
  }
  if (!send({ type: "interact", harvest: whole ? "whole" : "leaf" }, true))
    toast("사람, 약초 또는 이동 지점 가까이 다가가 보세요.");
}
function openPanel(name) {
  if (panel === name) {
    closePanel();
    return;
  }
  previousPanelFocus = document.activeElement;
  panel = name;
  filter = name === "codex" ? "0" : name === "craft" ? "equipment" : "all";
  if (running) send({ type: "move", x: 0, y: 0 }, true);
  $("panel-backdrop").hidden = false;
  $("menu-panel").hidden = false;
  renderPanel();
  $("close-panel").focus();
}
function closePanel() {
  panel = null;
  $("menu-panel").hidden = true;
  $("panel-backdrop").hidden = true;
  if (
    previousPanelFocus instanceof HTMLElement &&
    previousPanelFocus.isConnected
  )
    previousPanelFocus.focus();
}
function itemCard(i, p) {
  const n = p.inventory[i.id] || 0,
    equipped = Object.values(p.equipment).includes(i.id),
    usable =
      i.slot &&
      (!i.classId || i.classId === p.classId) &&
      i.level <= p.level &&
      (!i.branch || i.branch === p.branch);
  return `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name} ${equipped ? '<span class="equipped">장착 중</span>' : ""}</h3><small>${i.slot ? `${SLOT_NAMES[i.slot]} · Lv.${i.level}` : i.type === "consumable" ? "소비 아이템" : "제작 재료"} · 보유 ${n}</small></div></div><p>${i.lore}</p>${i.attack || i.defense ? `<div class="item-stats">${i.attack ? "공격 +" + i.attack : ""} ${i.defense ? "방어 +" + i.defense : ""}</div>` : ""}<div class="actions">${i.slot ? `<button data-action="equip" data-item="${i.id}" ${!usable || equipped ? "disabled" : ""}>${equipped ? "장착됨" : usable ? "장착" : "조건 미충족"}</button>` : ""}${i.type === "consumable" ? `<button data-action="potion" data-item="${i.id}">사용</button>` : ""}${i.slot && MAPS.find((m) => m.id === p.map).town ? `<button data-action="dismantle" data-item="${i.id}" ${equipped && n < 2 ? "disabled" : ""}>분해</button>` : ""}${MAPS.find((m) => m.id === p.map).town ? `<button data-action="sell" data-item="${i.id}" ${equipped && n < 2 ? "disabled" : ""}>판매 +${Math.max(1, Math.floor(i.price * 0.25))} G</button>` : ""}</div></article>`;
}
function tabs(names) {
  return `<div class="tabs">${names.map(([id, label]) => `<button data-filter="${id}" class="${filter === id ? "active" : ""}">${label}</button>`).join("")}</div>`;
}
function renderPanel() {
  const p = state?.player,
    c = cls(),
    body = $("panel-body");
  let title = "",
    html = "";
  if (panel === "help") {
    title = "숲길 안내서";
    html = `<p class="panel-intro">작은 발걸음으로 숲을 탐험하세요. 마을의 숲길지기에게 이야기를 듣고, 길 끝의 빛나는 표식으로 다음 맵에 갈 수 있습니다.</p><div class="help-grid">${[
      ["바닥 클릭 / 터치", "목적지로 이동"],
      ["이동 표식 클릭", "다음 맵으로 이동"],
      ["몬스터 클릭 / Space / J", "기본 공격"],
      ["1 · 2 · 3 · 4", "직업 스킬"],
      ["E / Shift + E", "대화 · 이동 · 잎 따기 / 포기 수확"],
      ["Q", "보들잎 연고"],
      ["Tab", "가까운 적 선택"],
      ["I · B · M · C", "가방 · 제작 · 지도 · 직업"],
      ["L · K · H", "이야기 · 도감 · 도움말"],
      ["Esc", "창 닫기"],
    ]
      .map(
        ([a, b]) =>
          `<div class="help-row"><span>${b}</span><kbd>${a}</kbd></div>`,
      )
      .join(
        "",
      )}</div><h3 class="panel-section">첫 번째 모험</h3><p class="panel-intro">마을 오른쪽의 새싹 울타리 표식에서 E → 몬스터 3마리 진정시키기 → 이야기 보상 받기 → 반짝이는 약초 채집 → 마을에서 연고 제작. 보스의 붉은 공격 범위는 발을 옮겨 피하세요.</p><h3 class="panel-section">함께 걷기와 저장</h3><p class="panel-intro">기본 모험은 이 브라우저에 자동 저장됩니다. 설정에서 파일로 내보내 보관할 수 있습니다. 실시간 동행은 별도 게임 서버 연결이 필요하며 설정에서 연결할 수 있습니다. 이 사이트 자체는 GitHub Pages에서 실행됩니다.</p><h3 class="panel-section">재료와 전직</h3><p class="panel-intro">모든 직업이 채집·제작·연금술을 이용합니다. 마을에서 기운을 무료로 회복할 수 있습니다. 레벨 25에는 조개등 마을의 은잎의 스승에게 2차 전직을 선택하세요.</p>`;
  } else if (!p) {
    title = "잠시만요";
    html = '<p class="panel-intro">모험을 시작한 뒤 이용할 수 있습니다.</p>';
  } else if (panel === "inventory") {
    title = "여행자의 가방";
    html = `<div class="panel-meta"><span class="tag">${p.gold.toLocaleString()} 골드</span><span class="tag">${Object.values(p.inventory).filter((n) => n > 0).length}종 보유</span></div>${tabs(
      [
        ["all", "전체"],
        ["equipment", "장비"],
        ["consumable", "소비"],
        ["material", "재료"],
      ],
    )}<div class="card-grid">${
      Object.entries(p.inventory)
        .filter(
          ([id, n]) => n > 0 && (filter === "all" || ITEMS[id].type === filter),
        )
        .map(([id]) => itemCard(ITEMS[id], p))
        .join("") || '<p class="panel-intro">아직 가방이 비어 있습니다.</p>'
    }</div>`;
  } else if (panel === "craft") {
    title = "숲의 작업대";
    const town = MAPS.find((m) => m.id === p.map).town;
    html = `<p class="panel-intro">${town ? "나무와 풀의 성질을 따라 장비와 약을 만듭니다. 기본 제작은 실패하지 않습니다." : "제작은 마을에서 이용할 수 있습니다. 지금은 제작법과 필요한 재료를 살펴보세요."}</p><div class="panel-meta"><span class="tag">장인 숙련 ${Math.floor(p.craftXp / 50) + 1}</span><span class="tag">${p.gold} 골드</span></div>${tabs(
      [
        ["equipment", "장비 제작"],
        ["alchemy", "연금술"],
        ["garden", "작은 화단"],
      ],
    )}<div class="card-grid">${RECIPES.filter((i) =>
      filter === "garden"
        ? false
        : filter === "alchemy"
          ? i.type === "consumable"
          : i.type === "equipment" && (!i.classId || i.classId === p.classId),
    )
      .map((i) => {
        const cost = i.type === "consumable" ? 2 : 5 * (i.tier || 1),
          can =
            town &&
            p.gold >= cost &&
            (i.level || 1) <= p.level &&
            (!i.branch || i.branch === p.branch) &&
            Object.entries(i.recipe).every(
              ([id, n]) => (p.inventory[id] || 0) >= n,
            );
        return `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name}</h3><small>${i.level ? "Lv." + i.level + " · " : ""}${i.branch ? "전직 전용" : i.type === "consumable" ? "연금술" : "장비 제작"}</small></div></div><p>${i.lore}</p>${Object.entries(
          i.recipe,
        )
          .map(
            ([id, n]) =>
              `<div class="recipe-line ${(p.inventory[id] || 0) < n ? "missing" : ""}"><span>${ITEMS[id].name}</span><span>${p.inventory[id] || 0} / ${n}</span></div>`,
          )
          .join(
            "",
          )}<div class="recipe-line"><span>제작 비용</span><span>${cost} 골드</span></div><div class="actions"><button data-action="craft" data-item="${i.id}" ${can ? "" : "disabled"}>${can ? "제작하기" : !town ? "마을에서 제작" : (i.level || 1) > p.level ? "레벨 부족" : i.branch && i.branch !== p.branch ? "전직 필요" : "재료 또는 골드 부족"}</button></div></article>`;
      })
      .join("")}</div>`;
  } else if (panel === "map") {
    title = "잎새 너머의 지도";
    html =
      '<p class="panel-intro">길 끝의 빛나는 표식에서 E를 눌러 다음 맵으로 이동합니다. 방문한 마을에는 전투가 끝난 뒤 빠르게 돌아갈 수 있습니다.</p>' +
      REGIONS.map(
        (r, ri) =>
          `<section class="map-region"><h3>0${ri + 1}. ${r.name}</h3><p class="panel-intro">${r.story}</p><div class="map-list">${MAPS.filter(
            (m) => m.region === ri,
          )
            .map(
              (m) =>
                `<button class="map-row ${p.map === m.id ? "current" : ""}" data-action="travel" data-map="${m.id}" data-fast="${m.town ? "true" : "false"}" ${p.map === m.id ? "disabled" : ""}><div><h4>${m.town ? "⌂" : "◇"} ${m.name} ${p.map === m.id ? "· 현재 위치" : ""}</h4><p>${m.description}</p></div><small>${m.town ? (p.visited.includes(m.id) ? "마을 귀환" : "미방문") : `Lv.${m.level}–${m.level + 3}`}</small></button>`,
            )
            .join("")}</div></section>`,
      ).join("") +
      '<p class="panel-intro">다음 여정: 유리버섯 수림 · 서리뿔 고원 · 월관의 고대숲. 이번 버전은 은물결 해안림까지 플레이할 수 있습니다.</p>';
  } else if (panel === "journal") {
    title = "숲이 남긴 이야기";
    html = `<p class="panel-intro">숲은 겨울을 두려워하고 있습니다. 작은 이웃들의 사정을 따라, 숲과 바다의 물길을 되돌려 주세요.</p>${QUESTS.map(
      (q, i) => {
        const done = i < p.quest.index,
          active = i === p.quest.index,
          progress = p.quest.counts[q.id] || 0;
        return `<article class="content-card quest-card-list ${done ? "completed" : ""}"><div class="quest-index">${done ? "✓ 마친 이야기" : active ? "❧ 지금의 이야기" : "이어지는 이야기"} · ${String(i + 1).padStart(2, "0")}</div><h3>${q.title}</h3><p>${q.text}</p>${active ? `<div class="progress-track"><span style="width:${(progress / q.count) * 100}%"></span></div><div class="recipe-line"><span>진행 ${progress} / ${q.count}</span><span>${q.xp} 경험치 · ${q.gold} 골드</span></div><div class="actions"><button data-action="claimQuest" ${progress >= q.count ? "" : "disabled"}>이야기 보상 받기</button></div>` : ""}</article>`;
      },
    ).join("")}`;
  } else if (panel === "codex") {
    title = "숲의 생명 도감";
    html = `<p class="panel-intro">모든 생명에게는 이곳에 머무는 이유가 있습니다. 각 아이템의 드롭은 독립적으로 추첨되므로 확률의 합이 100%일 필요는 없습니다. 골드와 경험치는 처치 시 확정 지급됩니다.</p><p class="panel-intro"><a class="small-button" href="./bestiary.html" target="_blank" rel="noopener">검색 가능한 전체 HTML 도감 열기 ↗</a></p><div class="panel-meta"><span class="tag">만난 생명 ${p.discovered.length} / 40</span><span class="tag">진정시킨 횟수 ${p.kills}</span></div>${tabs(
      [
        ["0", "햇살잎 숲 · 20종"],
        ["1", "은물결 해안림 · 20종"],
      ],
    )}<div class="card-grid">${MONSTERS.filter(
      (m) => m.region === Number(filter),
    )
      .map(
        (m) =>
          `<article class="content-card"><canvas class="monster-preview" data-monster-preview="${m.id}" width="72" height="64" aria-hidden="true"></canvas><small class="equipped">${TYPE_NAMES[m.type]} · Lv.${m.level}</small><h3>${m.name}</h3><p>${m.lore}</p><small class="equipped">${MAPS.find((a) => a.id === m.map).name} · HP ${m.hp}</small><details><summary class="small-button">드롭 테이블 보기</summary><p>확정 ${m.xp} 경험치 · ${Math.round(m.level * (m.type === "boss" ? 15 : 1.8) + 5)} 골드</p>${m.drops.map((d) => `<div class="drop-row"><span>${ITEMS[d.item].name} ×${d.min}${d.min !== d.max ? "–" + d.max : ""}</span><b>${Math.round(d.chance * 1000) / 10}%</b></div>`).join("")}</details></article>`,
      )
      .join("")}</div>`;
  } else if (panel === "skills") {
    title = displayClass();
    html = `<p class="panel-intro">${c.description}</p><div class="panel-meta"><span class="tag">Lv.${p.level}</span><span class="tag">공격 ${Math.floor(p.stats.attack)}</span><span class="tag">방어 ${Math.floor(p.stats.defense)}</span><span class="tag">약초 숙련 ${Math.floor(p.herbXp / 40) + 1}</span></div><h3 class="panel-section">전투 기술</h3>${[0, 1, 2, 3].map((n) => `<div class="skill-row"><span class="skill-glyph">${abilityIcon(artMeta.skillIcons[c.id][n])}</span><div><h3>${n + 1}. ${skillName(n)}</h3><p>${n < 3 ? skillDescriptions[c.id][n] : c.branches.find((b) => b.id === p.branch)?.description || "레벨 25에 전직하면 각자의 길을 대표하는 기술을 배웁니다."}</p><small>집중 ${SKILL_COSTS[n]} · 재사용 ${SKILL_COOLDOWNS[n]}초 · ${n === 0 ? "처음부터 사용" : n === 3 ? "2차 전직 후 사용" : `레벨 ${n === 1 ? 4 : 8} 해금`}</small></div></div>`).join("")}<h3 class="panel-section">두 번째 숲길 · 2차 전직</h3><p class="panel-intro">레벨 25에 조개등 마을에서 선택합니다. 선택한 길은 되돌릴 수 없으니 천천히 살펴보세요.</p><div class="card-grid">${c.branches.map((b) => `<article class="content-card branch-card ${p.branch === b.id ? "chosen" : ""}"><h3>${b.name}</h3><p>${b.description}</p><small class="equipped">전용 기술 · ${b.skill}</small><div class="actions"><button data-action="subclass" data-branch="${b.id}" ${p.branch || p.level < 25 || p.map !== "shelltown" ? "disabled" : ""}>${p.branch === b.id ? "선택한 길" : p.branch ? "다른 길" : p.level < 25 ? "레벨 25 필요" : p.map !== "shelltown" ? "조개등 마을에서 선택" : "이 길을 선택"}</button></div></article>`).join("")}</div>`;
  } else if (panel?.startsWith("npc:")) {
    const n = NPCS.find((n) => n.id === panel.split(":")[1]);
    title = n.name;
    html = `<p class="npc-dialog">“${n.text}”</p><div class="actions"><button data-open="journal">이야기 보기</button><button data-open="craft">제작 · 연금술</button><button data-open="skills">직업과 전직</button><button data-action="rest">기운 회복 · 무료</button></div><h3 class="panel-section">여행을 위한 작은 준비</h3><div class="card-grid">${Object.values(
      ITEMS,
    )
      .filter((i) => i.type === "consumable")
      .map(
        (i) =>
          `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name}</h3><small>${i.price} 골드 · 보유 ${p.inventory[i.id] || 0}</small></div></div><p>${i.lore}</p><div class="actions"><button data-action="buy" data-item="${i.id}" ${p.gold < i.price ? "disabled" : ""}>구입</button></div></article>`,
      )
      .join("")}</div>`;
  } else if (panel === "settings") {
    title = "모험의 작은 설정";
    html = `<section class="setting-row"><h3>이 브라우저의 모험</h3><p>기본 모험은 5초마다 자동 저장됩니다. 브라우저 데이터를 지우면 저장도 없어지므로 파일로 보관하세요.</p><div class="actions"><button data-special="save">지금 저장</button><button data-special="export">저장 파일 내보내기</button><button data-special="import">저장 파일 가져오기</button></div><input type="file" id="import-file" accept="application/json,.json" hidden></section><section class="setting-row"><h3>함께 걷는 숲 · 실시간 서버</h3><p>GitHub Pages는 게임 화면을 제공합니다. 실시간 동행과 서버 저장에는 별도 배포한 리프테일 서버가 필요합니다. 연결 전의 모험과 서버의 모험은 별도로 저장됩니다.</p><label for="server-url" class="panel-intro">게임 서버 주소</label><input id="server-url" placeholder="wss://게임서버주소/ws" value="${esc(readSetting("leaftale:server") || "")}"><div class="actions"><button data-special="connect">서버에 연결</button><button data-special="disconnect" ${online ? "" : "disabled"}>나의 모험으로 돌아오기</button></div><p>${online ? "실시간 서버에 연결되어 있습니다." : "현재는 브라우저에서 혼자 모험하고 있습니다."}</p></section><section class="setting-row"><h3>숲의 소리</h3><p>직접 합성한 가벼운 전투 효과음을 켜거나 끕니다.</p><button data-special="sound">효과음 ${sound ? "끄기" : "켜기"}</button></section><section class="setting-row"><h3>첫 화면</h3><p>지금 모험을 저장하고 처음 화면으로 돌아갑니다.</p><button data-special="title">모험 저장 후 첫 화면</button></section>`;
  }
  if (panel === "craft" && filter === "garden") {
    html =
      tabs([
        ["equipment", "장비 제작"],
        ["alchemy", "연금술"],
        ["garden", "작은 화단"],
      ]) +
      `<p class="panel-intro">마을에 맡겨 둔 작은 개인 화단입니다. 약초 하나를 심으면 2분 뒤 세 개를 수확합니다. 자리를 비워도 시들지 않습니다. 현재 ${p.herbXp} 약초 경험치.</p><div class="card-grid">${p.garden.map((g, n) => `<article class="content-card"><h3>작은 화단 ${n + 1}</h3>${g ? `<p>${ITEMS[g.item].name} · ${g.readyAt <= Date.now() ? "수확할 수 있어요." : Math.ceil((g.readyAt - Date.now()) / 1000) + "초 뒤에 다 자랍니다."}</p><div class="actions"><button data-action="harvest" data-slot="${n}" ${g.readyAt > Date.now() || !MAPS.find((m) => m.id === p.map).town ? "disabled" : ""}>수확하기</button><button data-filter="garden">성장 확인</button></div>` : `<p>약초가 자랄 작은 자리가 비어 있습니다.</p><div class="actions">${["softleaf", "mint", "saltflower", "breathgrass"].map((id) => `<button data-action="plant" data-item="${id}" data-slot="${n}" ${!p.inventory[id] || !MAPS.find((m) => m.id === p.map).town ? "disabled" : ""}>${ITEMS[id].name} 심기</button>`).join("")}</div>`}</article>`).join("")}</div>`;
  }
  $("panel-title").textContent = title;
  body.innerHTML = html;
  for (const node of body.querySelectorAll("[data-monster-preview]"))
    drawMonsterPreview(node, node.dataset.monsterPreview);
  const importer = $("import-file");
  if (importer) importer.addEventListener("change", importSave);
}
function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}
async function importSave(event) {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 2e6) throw Error();
    const raw = JSON.parse(await file.text()),
      p = hydrateSave(raw.player || raw);
    if (!p) throw Error();
    if (!confirm("지금 브라우저의 모험을 가져온 저장으로 바꿀까요?")) return;
    start(p);
    toast("저장 파일의 모험을 불러왔습니다.");
  } catch {
    toast("올바른 리프테일 저장 파일인지 확인해 주세요.");
  }
}
function connect(url) {
  try {
    const u = new URL(url);
    if (
      u.protocol !== "wss:" &&
      !(u.protocol === "ws:" && ["localhost", "127.0.0.1"].includes(u.hostname))
    )
      throw Error();
    if (u.username || u.password) throw Error();
    save();
    if (socket) socket.close();
    const ws = new WebSocket(u);
    socket = ws;
    writeSetting("leaftale:server", u.href);
    toast("동행 서버에 연결하고 있습니다…");
    const timer = setTimeout(() => {
      if (ws.readyState !== WebSocket.OPEN) {
        ws.close();
        toast("서버에 연결할 수 없습니다. 주소와 서버 상태를 확인해 주세요.");
      }
    }, 8000);
    ws.onopen = () => {
      clearTimeout(timer);
      ws.send(
        JSON.stringify({
          type: "join",
          token: readSetting("leaftale:token:" + u.href),
          name: state.player.name,
          classId: state.player.classId,
        }),
      );
    };
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "welcome") {
          writeSetting("leaftale:token:" + u.href, msg.token);
          online = true;
          running = true;
          closePanel();
          toast("함께 걷는 숲에 도착했습니다.");
        } else if (msg.type === "state") {
          state = msg.state;
          buildSkillbarIfNeeded();
          hud();
        } else if (msg.type === "chat") addChat(msg.name, msg.text);
        else if (msg.type === "error") toast(msg.message);
      } catch {}
    };
    ws.onerror = () =>
      toast(
        "서버 연결을 확인해 주세요. HTTPS 페이지에서는 WSS 서버가 필요합니다.",
      );
    ws.onclose = () => {
      clearTimeout(timer);
      if (socket !== ws) return;
      socket = null;
      if (online) {
        online = false;
        start(readSave() || createPlayer(selectedClass));
        toast("동행 연결이 종료되어 브라우저의 모험으로 돌아왔습니다.");
      }
    };
  } catch {
    toast("wss:// 형식의 서버 주소를 입력해 주세요.");
  }
}
let lastSkillKey = "";
function buildSkillbarIfNeeded() {
  const key = state.player.classId + state.player.branch;
  if (key !== lastSkillKey) {
    lastSkillKey = key;
    buildSkillbar();
  }
}
function addChat(name, text) {
  const d = document.createElement("div");
  d.textContent = `${name}: ${text}`;
  $("chat-lines").append(d);
  while ($("chat-lines").children.length > 40)
    $("chat-lines").firstChild.remove();
  $("chat-lines").scrollTop = 1e5;
}
function special(action) {
  if (action === "save") save(true);
  if (action === "export") {
    const data = online ? state.player : serialize(world.players.get("local")),
      blob = new Blob(
        [
          JSON.stringify(
            { game: "리프테일", version: 1, player: data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "리프테일-모험저장.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  if (action === "import") $("import-file").click();
  if (action === "connect") connect($("server-url").value.trim());
  if (action === "disconnect") {
    if (socket) {
      const old = socket;
      socket = null;
      old.close();
    }
    online = false;
    start(readSave() || createPlayer());
  }
  if (action === "sound") {
    $("sound-toggle").click();
    renderPanel();
  }
  if (action === "title") {
    save();
    if (socket) {
      const old = socket;
      socket = null;
      old.close();
    }
    online = false;
    running = false;
    closePanel();
    $("hud").hidden = true;
    showLobby();
  }
}
$("panel-body").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.filter) {
    filter = b.dataset.filter;
    renderPanel();
    return;
  }
  if (b.dataset.open) {
    openPanel(b.dataset.open);
    return;
  }
  if (b.dataset.special) {
    special(b.dataset.special);
    return;
  }
  if (
    b.dataset.action === "subclass" &&
    !confirm("이 길을 선택하면 바꿀 수 없습니다. 전직할까요?")
  )
    return;
  if (b.dataset.action)
    send({
      type: b.dataset.action,
      item: b.dataset.item,
      slot: Number(b.dataset.slot),
      map: b.dataset.map,
      fast: b.dataset.fast === "true",
      branch: b.dataset.branch,
    });
});
$("skillbar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b)
    send(
      {
        type: b.dataset.action,
        slot: Number(b.dataset.slot),
        target,
        item: "salve",
      },
      true,
    );
});
for (const b of document.querySelectorAll("[data-panel]"))
  b.addEventListener("click", () => openPanel(b.dataset.panel));
$("quest-claim").onclick = () => send({ type: "claimQuest" });
$("close-panel").onclick = closePanel;
$("panel-backdrop").onclick = closePanel;
$("lobby-help").onclick = () => openPanel("help");
$("sound-toggle").onclick = () => {
  sound = !sound;
  $("sound-toggle").textContent = sound ? "♫" : "♪";
  $("sound-toggle").setAttribute(
    "aria-label",
    sound ? "소리 끄기" : "소리 켜기",
  );
  tone(660);
  toast(sound ? "숲의 효과음을 켰습니다." : "효과음을 껐습니다.");
};
$("chat-toggle").onclick = () => {
  $("chat-box").hidden = !$("chat-box").hidden;
  if (!$("chat-box").hidden) $("chat-input").focus();
};
$("chat-form").onsubmit = (e) => {
  e.preventDefault();
  const input = $("chat-input"),
    text = input.value.trim();
  if (!text) return;
  if (online && socket?.readyState === 1)
    socket.send(JSON.stringify({ type: "chat", text }));
  else addChat(state.player.name, text);
  input.value = "";
};
function showLobby() {
  const saved = readSave();
  $("lobby").hidden = false;
  $("continue-game").hidden = !saved;
  if (saved)
    $("continue-game").textContent =
      `${saved.name} · Lv.${saved.level} 이어서 →`;
  $("class-select").innerHTML = CLASSES.map(
    (c) =>
      `<button class="class-choice" data-class="${c.id}" aria-pressed="${c.id === selectedClass}"><canvas class="class-preview" data-class-preview="${c.id}" width="64" height="106" aria-hidden="true"></canvas><strong>${c.name}</strong><small>${c.role}</small></button>`,
  ).join("");
  for (const node of $("class-select").querySelectorAll("[data-class-preview]"))
    drawCharacterPreview(node, node.dataset.classPreview);
  $("class-description").textContent = CLASSES.find(
    (c) => c.id === selectedClass,
  ).description;
}
$("class-select").onclick = (e) => {
  const b = e.target.closest("[data-class]");
  if (!b) return;
  selectedClass = b.dataset.class;
  showLobby();
};
$("start-game").onclick = () => {
  if (
    readSave() &&
    !confirm(
      "이 브라우저에는 기존 모험이 있습니다. 새로 시작하면 기존 자동 저장이 바뀝니다. 계속할까요?",
    )
  )
    return;
  start();
};
$("continue-game").onclick = () => {
  const p = readSave();
  if (p) start(p);
};
canvas.addEventListener("pointerdown", (e) => {
  if (!running || panel || (e.pointerType === "mouse" && e.button !== 0))
    return;
  const r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top,
    hit = renderer.hit(x, y);
  canvas.focus();
  if (hit?.kind === "portal") {
    const portal = PORTALS(state.player.map).find((p) => p.to === hit.id);
    if (distance(portal, state.player) < 2.5)
      send({ type: "travel", map: portal.to });
    else {
      pendingInteraction = { kind: "portal", id: portal.to };
      send({ type: "moveTo", x: portal.x, y: portal.y }, true);
    }
  } else if (hit?.kind === "monster") {
    target = hit.id;
    send({ type: "attack", target }, true);
  } else if (hit?.kind === "npc") {
    const n = NPCS.find((n) => n.id === hit.id);
    if (distance(n, state.player) < 2.6) openPanel("npc:" + n.id);
    else {
      pendingInteraction = { kind: "npc", id: n.id };
      send({ type: "moveTo", x: n.x - 1, y: n.y + 1 }, true);
    }
  } else if (hit?.kind === "herb") {
    const h = state.herbs.find((h) => h.id === hit.id);
    if (distance(h, state.player) < 2)
      send(
        {
          type: "interact",
          herb: h.id,
          harvest: e.shiftKey ? "whole" : "leaf",
        },
        true,
      );
    else {
      pendingInteraction = { kind: "herb", id: h.id };
      send({ type: "moveTo", x: h.x, y: h.y }, true);
    }
  } else {
    pendingInteraction = null;
    const pos = renderer.screenToWorld(x, y);
    if (send({ type: "moveTo", ...pos }, true))
      renderer.destination = { ...pos, at: state.time };
  }
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (panel) {
      closePanel();
      e.preventDefault();
    } else {
      $("chat-box").hidden = true;
      canvas.focus();
    }
    return;
  }
  if (panel && e.key === "Tab") {
    const focusable = [
      ...$("menu-panel").querySelectorAll(
        "button:not(:disabled), input:not([hidden]), select, summary, a[href]",
      ),
    ];
    if (focusable.length) {
      const i = focusable.indexOf(document.activeElement),
        next = e.shiftKey
          ? i <= 0
            ? focusable.length - 1
            : i - 1
          : (i + 1) % focusable.length;
      focusable[next].focus();
      e.preventDefault();
    }
    return;
  }
  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName) || !running)
    return;
  const k = e.key.toLowerCase();
  if ([" ", "tab"].includes(k)) e.preventDefault();
  if (panel) return;
  if (e.repeat) return;
  if (k === " " || k === "j") send({ type: "attack", target }, true);
  if (["1", "2", "3", "4"].includes(k))
    send({ type: "skill", slot: Number(k) - 1, target }, true);
  if (k === "q") send({ type: "potion", item: "salve" });
  if (k === "e") interact(e.shiftKey);
  const panels = {
    i: "inventory",
    b: "craft",
    m: "map",
    c: "skills",
    l: "journal",
    k: "codex",
    h: "help",
  };
  if (panels[k]) openPanel(panels[k]);
  if (k === "tab") {
    const mobs = state.mobs
      .filter((m) => m.hp > 0 && distance(m, state.player) < 12)
      .sort((a, b) => distance(a, state.player) - distance(b, state.player));
    if (mobs.length)
      target =
        mobs[(mobs.findIndex((m) => m.uid === target) + 1) % mobs.length].uid;
  }
  if (k === "enter") $("chat-toggle").click();
});
window.addEventListener("blur", () => {
  if (running) send({ type: "move", x: 0, y: 0 }, true);
});
window.addEventListener("pagehide", () => save());
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (running && state) {
    if (!online) {
      world.step(dt);
      state = world.snapshot("local");
    }
    if (pendingInteraction && !panel) {
      const n =
        pendingInteraction.kind === "npc"
          ? NPCS.find((n) => n.id === pendingInteraction.id)
          : pendingInteraction.kind === "portal"
            ? PORTALS(state.player.map).find(
                (p) => p.to === pendingInteraction.id,
              )
            : state.herbs.find((h) => h.id === pendingInteraction.id);
      if (n && distance(n, state.player) < 1.9) {
        if (pendingInteraction.kind === "npc") openPanel("npc:" + n.id);
        else if (pendingInteraction.kind === "portal")
          send({ type: "travel", map: n.to });
        else send({ type: "interact", herb: n.id }, true);
        pendingInteraction = null;
      }
    }
    renderer.render(state, target, dt);
    if (now - lastHud > 130) {
      hud();
      lastHud = now;
    }
    if (now - lastSave > 5000) {
      save();
      lastSave = now;
    }
  }
  requestAnimationFrame(frame);
}
window.__leaftale = {
  snapshot: () => (state ? structuredClone(state) : null),
  version: "0.3.0",
};
try {
  const response = await fetch("./assets/manifest.json");
  if (!response.ok) throw Error("asset manifest");
  artMeta = await response.json();
  iconIds = artMeta.items;
  for (const [panelName, index] of Object.entries({
    inventory: 2,
    craft: 3,
    map: 61,
    skills: 44,
  })) {
    const node = document.querySelector(
      `.dock-side [data-panel="${panelName}"] > span`,
    );
    if (node) node.innerHTML = abilityIcon(index);
  }
  await loadArt((p) => {
    $("loading-progress").style.width = `${Math.round(p * 100)}%`;
    $("loading-text").textContent =
      `숲의 작은 생명을 깨우는 중… ${Math.round(p * 100)}%`;
  });
  $("loading").hidden = true;
  showLobby();
  requestAnimationFrame(frame);
} catch (error) {
  $("loading-text").textContent =
    "숲을 불러오지 못했습니다. 새로고침해 주세요.";
  console.error(error);
}
