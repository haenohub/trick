import { combatAim } from "./targeting.js";
import { NAVIGATION } from "./world-layout.js";
import { PickupHold } from "./pickup-hold.js";
import {
  ATTRIBUTE_NAMES,
  STAT_NAMES,
  unspentPoints,
  POINTS_PER_LEVEL,
  canEquip,
  equipRequirements,
  statValue,
} from "./progression.js";
import { speciesForMap, mapsForSpecies } from "./ecology.js";
import {
  CONTROL_ACTIONS,
  DEFAULT_BINDINGS,
  CONTROLS_KEY,
  KEYBOARD_ROWS,
  keyLabel,
  restoreBindings,
  rebind,
  actionForEvent,
} from "./controls.js";
import { CLASS_TACTICS } from "./combat.js";
import { consumableLines } from "./consumables.js";
import {
  FULLSCREEN_KEY,
  fullscreenSupported,
  setFullscreen,
} from "./display-mode.js";
import { DISCOVERIES, CHESTS } from "./exploration.js";
import { CombatAudio } from "./audio.js";
import {
  xpReward,
  dropChance,
  PICKUP_RANGE,
  NEARBY_PICKUP_RANGE,
} from "./balance.js";
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
  worldArtReady,
  prepareWorldArt,
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
  previousPanelFocus = null,
  codexMode = "monsters",
  rebindAction = null,
  bindingMessage = "",
  tooltipItem = null,
  tooltipTimer = null,
  inventorySignature = "";
let bindings;
const pickupHold = new PickupHold();
try {
  bindings = restoreBindings(JSON.parse(localStorage.getItem(CONTROLS_KEY)));
} catch {
  bindings = { ...DEFAULT_BINDINGS };
}
const bindingLabel = (id) => keyLabel(bindings[id]);
let preferFullscreen = readSetting(FULLSCREEN_KEY) === "true";
$("start-fullscreen").checked = preferFullscreen;
$("start-fullscreen").disabled = !fullscreenSupported(
  document,
  $("game-shell"),
);
$("start-fullscreen").onchange = (e) => {
  preferFullscreen = e.target.checked;
  writeSetting(FULLSCREEN_KEY, String(preferFullscreen));
};
function chooseDisplayMode(enabled) {
  preferFullscreen = enabled;
  writeSetting(FULLSCREEN_KEY, String(enabled));
  return setFullscreen(enabled, $("game-shell")).catch((error) => {
    preferFullscreen = false;
    writeSetting(FULLSCREEN_KEY, "false");
    $("start-fullscreen").checked = false;
    if (panel === "settings") renderPanel();
    toast(
      error.message ||
        "전체화면으로 전환하지 못했습니다. 설정에서 다시 선택해 주세요.",
    );
  });
}
document.addEventListener("fullscreenchange", () => {
  const active = !!document.fullscreenElement;
  preferFullscreen = active;
  writeSetting(FULLSCREEN_KEY, String(active));
  $("start-fullscreen").checked = active;
  if (running && !active && panel !== "settings") openPanel("settings");
  else if (panel === "settings") renderPanel();
});
function persistBindings() {
  pickupHold.cancel();
  writeSetting(CONTROLS_KEY, JSON.stringify(bindings));
  refreshBindingLabels();
  buildSkillbar();
}
function refreshBindingLabels() {
  for (const node of document.querySelectorAll("[data-keybind]"))
    node.textContent = bindingLabel(node.dataset.keybind);
  for (const button of document.querySelectorAll("[data-panel]"))
    if (bindings[button.dataset.panel])
      button.title =
        CONTROL_ACTIONS.find((a) => a.id === button.dataset.panel).label +
        " [" +
        bindingLabel(button.dataset.panel) +
        "]";
}
function keyboardPanel() {
  const selected = CONTROL_ACTIONS.find((a) => a.id === rebindAction);
  return `<p class="panel-intro">키에 표시된 기능을 누른 뒤 원하는 새 키를 누르세요. P는 이 창 열기·닫기, Esc는 게임 설정 열기·닫기입니다. Shift + ${bindingLabel("interact")}로 약초 포기를 수확합니다.</p><p id="binding-status" class="binding-status" role="status">${esc(bindingMessage || (selected ? selected.label + "의 새 키를 누르세요. Esc로 취소합니다." : "변경한 단축키는 이 브라우저에 저장됩니다."))}</p><div class="keyboard-scroll"><div class="keyboard-layout">${KEYBOARD_ROWS.map(
    (row) =>
      `<div class="keyboard-row">${row
        .map((code) => {
          const action = CONTROL_ACTIONS.find((a) => bindings[a.id] === code),
            fixed =
              code === "KeyJ" &&
              bindings.attack === "Space" &&
              !Object.values(bindings).includes("KeyJ")
                ? "공격 보조"
                : code === "KeyP"
                  ? "단축키 설정"
                  : code === "Escape"
                    ? "설정 / 닫기"
                    : code === "Enter"
                      ? "채팅"
                      : "";
          return `<button class="keycap ${code === "Space" ? "key-space" : ""} ${action ? "assigned" : ""} ${action?.id === rebindAction ? "listening" : ""}" ${action ? `data-rebind="${action.id}" aria-label="${action.label} 단축키 변경"` : "disabled"}><b>${keyLabel(code)}</b><small>${esc(action?.label || fixed)}</small></button>`;
        })
        .join("")}</div>`,
  ).join(
    "",
  )}</div></div><div class="binding-list">${CONTROL_ACTIONS.map((a) => `<button data-rebind="${a.id}" class="binding-row"><span>${a.label}</span><kbd>${bindingLabel(a.id)}</kbd></button>`).join("")}</div><button data-reset-bindings>기본 단축키로 복원</button>`;
}
function hideItemTooltip() {
  clearTimeout(tooltipTimer);
  tooltipItem = null;
  $("item-tooltip").hidden = true;
}
function showItemTooltip(slot) {
  const id = slot.dataset.inventoryItem;
  if (!state?.player.inventory[id]) return;
  clearTimeout(tooltipTimer);
  if (tooltipItem === id && !$("item-tooltip").hidden) return;
  tooltipItem = id;
  const tip = $("item-tooltip");
  tip.innerHTML = itemCard(ITEMS[id], state.player);
  tip.hidden = false;
  const r = slot.getBoundingClientRect(),
    w = tip.getBoundingClientRect().width,
    h = tip.getBoundingClientRect().height;
  const panelRect = $("menu-panel").getBoundingClientRect();
  const left =
    panelRect.left - w - 8 >= 8
      ? panelRect.left - w - 8
      : panelRect.right + w + 8 <= innerWidth
        ? panelRect.right + 8
        : r.right + w + 12 <= innerWidth
          ? r.right + 8
          : Math.max(8, r.left - w - 8);
  tip.style.left = Math.min(left, innerWidth - w - 8) + "px";
  tip.style.top = Math.max(8, Math.min(r.top, innerHeight - h - 8)) + "px";
}
function inventorySlot(item, p) {
  const equipped = Object.values(p.equipment).includes(item.id);
  return `<button class="inventory-slot ${equipped ? "is-equipped" : ""}" data-inventory-item="${item.id}" aria-label="${esc(item.name)} · ${p.inventory[item.id]}개${equipped ? " · 장착 중" : ""}" aria-describedby="item-tooltip">${itemIcon(item.id)}<span class="slot-count">${p.inventory[item.id]}</span>${equipped ? '<span class="slot-equipped" aria-hidden="true">◆</span>' : ""}</button>`;
}
function codexItemCard(item) {
  const sources = MONSTERS.filter((m) =>
    m.drops.some((d) => d.item === item.id),
  );
  return `<article class="content-card item-entry" data-guide-entry="${item.id}"><div class="item-heading">${itemIcon(item.id)}<h3>${item.name}</h3></div><p>${item.lore}</p><small>${item.slot ? SLOT_NAMES[item.slot] + " · Lv." + item.level : item.type === "trophy" ? "고유 전리품" : item.type === "consumable" ? "소비 아이템" : "제작 재료"}</small>${equipmentStats(item)}${state?.player ? equipmentRequirements(item, state.player) : ""}<p>${sources.length ? "드롭: " + sources.map((m) => m.name).join(", ") : item.recipe ? "제작 · 연금술로 획득" : item.type === "consumable" ? "마을 상점 · 시작 보급품" : "채집 · 시작 보급품"}</p>${
    item.recipe
      ? `<p>제작 재료: ${Object.entries(item.recipe)
          .map(([id, n]) => ITEMS[id].name + " ×" + n)
          .join(" · ")}</p>`
      : ""
  }</article>`;
}
function craftGuideCard(item, p) {
  const entries = Object.entries(item.recipe),
    town = MAPS.find((m) => m.id === p.map).town;
  const can =
    town &&
    p.level >= item.level &&
    p.gold >= 2 &&
    entries.every(([id, n]) => (p.inventory[id] || 0) >= n);
  const node = (id, count, result = false) =>
    `<button class="recipe-node ${result ? "recipe-result" : (p.inventory[id] || 0) < count ? "recipe-missing" : ""}" data-guide-item="${id}" title="${esc(ITEMS[id].name)} · 보유 ${p.inventory[id] || 0}">${itemIcon(id, 64)}<span class="recipe-name">${esc(ITEMS[id].name)}</span><span class="recipe-quantity">×${count}${result ? " 완성" : ` · 보유 ${p.inventory[id] || 0}`}</span></button>`;
  const sources = entries
    .map(
      ([id]) =>
        `<li><b>${ITEMS[id].name}</b>: ${MONSTERS.filter((m) =>
          m.drops.some((d) => d.item === id),
        )
          .map(
            (m) =>
              `${m.name} Lv.${m.level} (${mapsForSpecies(m.id)
                .map((a) => a.name)
                .join(" / ")})`,
          )
          .join(" · ")}</li>`,
    )
    .join("");
  return `<article class="content-card craft-guide-card" data-recipe-id="${item.id}"><h3>${item.name}</h3><small>제작 Lv.${item.level} · ${item.craftOnly ? "제작 전용 · 드롭/상점 없음" : "제작 · 완제품 드롭 5%"}</small><div class="craft-flow">${entries.map(([id, n], at) => `<span class="recipe-step">${at ? '<span class="recipe-operator">+</span>' : ""}${node(id, n)}</span>`).join("")}<span class="recipe-step"><span class="recipe-operator">→</span>${node(item.id, 1, true)}</span></div><details class="craft-details"><summary><span class="details-closed">상세정보 보기</span><span class="details-open">상세정보 접기</span></summary><div class="craft-details-body"><p>${item.recipeNote}</p>${equipmentStats(item)}<p>${item.lore}</p><p>마을 제작 · 제작 레벨 ${item.level} · 비용 2리프 · 결과 1개</p><section class="craft-sources"><h4>재료 획득처</h4><ul>${sources}</ul></section></div></details><div class="actions"><button data-action="craft" data-item="${item.id}" ${can ? "" : "disabled"}>${can ? "2리프로 1개 제작" : !town ? "마을에서 제작" : p.level < item.level ? "제작 레벨 부족" : "재료 또는 리프 부족"}</button></div></article>`;
}
const skillDescriptions = {
  warden: [
    "앞의 적과 뒤쪽 적을 관통해 210% 피해를 줍니다. 반격 1회마다 35%가 추가됩니다.",
    "최대 체력의 28% 보호막을 얻어 7초 동안 몸을 지킵니다.",
    "지정한 지역으로 도약해 착지 시 190% 피해를 주고 일반 몬스터의 공격 준비를 끊습니다.",
  ],
  mage: [
    "220% 피해를 주고 달씨앗을 하나 얻습니다. 최대 3개까지 모읍니다.",
    "210% 범위 피해. 달씨앗 하나마다 45% 피해와 범위를 더하고 씨앗을 소모합니다.",
    "목표 주변에 135% 피해를 주고 3초 동안 발을 묶습니다.",
  ],
  ranger: [
    "긴 사거리에서 220% 피해를 줍니다.",
    "하늘로 화살을 쏘아 지정한 범위에 세 차례 화살비를 내립니다. 각 타격은 80% 피해입니다.",
    "120% 피해와 9초 표식. 표식 대상이 받는 피해를 30% 늘리고 사거리·시야 안에서 이동 중에도 자동으로 화살을 발사합니다.",
  ],
  herbalist: [
    "지정한 범위에 있는 아군의 체력을 최대 체력의 32%만큼 회복합니다.",
    "140% 피해와 독 2겹을 남깁니다. 독은 최대 3겹이며 중첩에 따라 주기 피해가 커집니다.",
    "지정한 위치에 120% 범위 피해와 7초 정원. 안에 있는 아군을 회복하고 독에 물든 적을 주기적으로 공격합니다.",
  ],
};
let aimedAction = null,
  aimPointer = null;
function clearAim() {
  const wasArmed = !!aimedAction;
  aimedAction = null;
  renderer.aim = null;
  canvas.classList.remove("aiming");
  if (wasArmed) {
    clearTimeout(toastTimer);
    $("toast").hidden = true;
  }
}
function armCombat(type, slot = null) {
  if (!running || panel) return;
  pendingInteraction = null;
  aimedAction = {
    type,
    slot,
    map: state.player.map,
    rule: combatAim(state.player, slot),
  };
  canvas.classList.add("aiming");
  canvas.focus();
  toast(
    aimedAction.rule.mode === "enemy"
      ? type === "attack"
        ? "적 클릭: 연속 기본공격 · 바닥 클릭: 공격 중단"
        : "공격할 적을 클릭하세요 · Esc/우클릭 취소"
      : aimedAction.rule.mode === "self"
        ? "클릭해서 발동하세요 · Esc/우클릭 취소"
        : "발동할 위치를 클릭하세요 · Esc/우클릭 취소",
  );
}
canvas.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  aimPointer = { x: e.clientX - r.left, y: e.clientY - r.top };
});
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
function start(saved = null) {
  lastSoundEffect = 0;
  renderer.impactSeen = 0;
  renderer.impactUntil = 0;
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
  document.body.classList.add("in-game");
  $("lobby").hidden = true;
  $("hud").hidden = false;
  target = null;
  buildSkillbar();
  closePanel();
  hud();
  canvas.focus();
  save();
  if (!saved)
    toast(
      `바닥 클릭 이동 · 공격/스킬키 → 대상 클릭 · ${bindingLabel("interact")} 상호작용 · ${bindingLabel("pickup")} 줍기 · P 단축키`,
    );
}
function send(action, quiet = false) {
  if (!running || (state && !worldArtReady(state.player.map))) return false;
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
        ? "마을에서 재료·리프·레벨을 확인해 주세요."
        : action.type === "travel"
          ? "월드맵에서 이동할 지역을 선택해 주세요."
          : "지금은 사용할 수 없습니다. 조건을 확인해 주세요.",
    );
  if (ok) {
    hud();
    if (
      [
        "allocateStat",
        "craft",
        "equip",
        "potion",
        "travel",
        "buy",
        "sell",
        "subclass",
        "claimQuest",
        "dismantle",
        "plant",
        "harvest",
        "openChest",
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
function atlasIcon(file, cols, rows, index, displaySize = 32) {
  return `<span class="item-icon" style="--icon-size:${displaySize}px;background-image:url('./assets/${file}.png?v=${ART_REVISION}');background-size:${cols * displaySize}px ${rows * displaySize}px;background-position:-${(index % cols) * displaySize}px -${Math.floor(index / cols) * displaySize}px" aria-hidden="true"></span>`;
}
function itemIcon(id, displaySize = 32) {
  const special = artMeta.itemOverrides?.[id];
  return special
    ? atlasIcon(
        special.file,
        special.cols,
        special.rows,
        special.index,
        displaySize,
      )
    : atlasIcon("items", 8, 8, iconIds[id] || 0, displaySize);
}
function abilityIcon(index) {
  return atlasIcon("items", 8, 8, index);
}
function skillIcon(slot) {
  return cls().id === "ranger" && slot === 1
    ? itemIcon("bow2")
    : abilityIcon(artMeta.skillIcons[cls().id][slot]);
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
    `<button class="skill basic" data-action="attack" title="기본 공격 대상 지정 [${bindingLabel("attack")}]"><kbd>${bindingLabel("attack")}</kbd><span class="glyph">${abilityIcon(58)}</span><span class="skill-name">기본 공격</span></button>` +
    [0, 1, 2, 3]
      .map(
        (n) =>
          `<button class="skill" data-action="skill" data-slot="${n}" title="${skillName(n)} [${bindingLabel("skill" + n)}]"><kbd>${bindingLabel("skill" + n)}</kbd><span class="glyph">${skillIcon(n)}</span><span class="skill-name">${skillName(n)}</span><span class="cooldown" id="cooldown-${n}" hidden></span></button>`,
      )
      .join("") +
    `<button class="skill potion" data-action="potion" title="보들잎 연고 [${bindingLabel("potion")}]"><kbd>${bindingLabel("potion")}</kbd><span class="glyph">${abilityIcon(59)}</span><span class="skill-name">연고</span><span class="count" id="salve-count"></span><span class="cooldown" id="potion-cooldown" hidden></span></button>`;
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
  const traits = {
    warden: `반격 ${p.guardPower || 0}/3`,
    mage: `달씨앗 ${p.spellCharge || 0}/3`,
    ranger:
      p.trackingRemaining > 0
        ? `추적 이동 사격 · ${Math.ceil(p.trackingRemaining)}초`
        : "화살비 · 사거리 +50%",
    herbalist: "독 중첩 · 정원 회복",
  };
  $("combat-trait").textContent = traits[p.classId];
  const boss = state.mobs.find(
    (m) =>
      m.hp > 0 &&
      MONSTERS.find((d) => d.id === m.def).type === "boss" &&
      distance(m, p) < 18,
  );
  $("boss-banner").hidden = !boss;
  if (boss) {
    $("boss-name").textContent =
      MONSTERS.find((d) => d.id === boss.def).name +
      " · " +
      (boss.phase || 1) +
      "단계";
    $("boss-hp").style.width = (boss.hp / boss.maxHp) * 100 + "%";
    $("boss-action").textContent = boss.windup
      ? boss.windup.name +
        " · " +
        Math.max(0, boss.windup.at - state.time).toFixed(1) +
        "초"
      : boss.recoverUntil > state.time
        ? "공격 후 빈틈 · 지금 반격하세요"
        : "수호자가 다음 공격을 고릅니다";
  }
  $("exploration-progress").textContent =
    `흔적 ${(state.discoveries || []).filter((d) => d.discovered).length}/${(state.discoveries || []).length} · 보물함 ${p.exploration.opened.filter((id) => CHESTS.find((c) => c.id === id)?.map === p.map).length}/${CHESTS.filter((c) => c.map === p.map).length}`;
  drawCharacterPreview($("portrait"), p.classId, true, p.equipment);
  $("hp-fill").style.width = `${(p.hp / s.maxHp) * 100}%`;
  $("hp-text").textContent = `${Math.ceil(p.hp)} / ${s.maxHp}`;
  $("focus-fill").style.width = `${p.focus}%`;
  $("focus-text").textContent = `${Math.floor(p.focus)} / 100`;
  $("pocket-leaf").textContent = `리프 ${p.gold.toLocaleString()}`;
  $("region-name").textContent =
    `${REGIONS[map.region].name} · CHAPTER 0${map.region + 1}`;
  $("map-name").textContent = map.name;
  if ($("world-phase") && state.ambience)
    $("world-phase").textContent =
      state.ambience.label +
      (map.town ? "" : ` · ${state.ambience.remaining}초`);
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
  const buffs = p.consumableBuffs || [],
    buffKey = buffs.map((b) => b.item + ":" + Math.ceil(b.remaining)).join(",");
  if ($("consumable-buffs").dataset.key !== buffKey) {
    $("consumable-buffs").dataset.key = buffKey;
    $("consumable-buffs").innerHTML = buffs
      .map(
        (b) =>
          `<span class="active-consumable" title="${esc(ITEMS[b.item].name + " · " + consumableLines(ITEMS[b.item]).join(" / "))}">${itemIcon(b.item)}<b>${Math.ceil(b.remaining)}s</b></span>`,
      )
      .join("");
  }
  const mob = state.mobs.find((m) => m.uid === target && m.hp > 0);
  $("target-card").hidden = !mob || !!boss;
  if (mob) {
    const d = MONSTERS.find((d) => d.id === mob.def);
    $("target-name").textContent = d.name;
    $("target-rank").textContent = `Lv.${d.level} · ${TYPE_NAMES[d.type]}`;
    $("target-fill").style.width = `${(mob.hp / mob.maxHp) * 100}%`;
  }
  $("leaf-wallet").textContent = `${p.gold.toLocaleString()} 리프`;
  const receipts = (p.lootNotices || [])
      .filter((n) => state.time - n.at < 7)
      .slice(-4),
    receiptKey = receipts.map((n) => n.id).join(",");
  if ($("loot-lines").dataset.receipts !== receiptKey) {
    $("loot-lines").dataset.receipts = receiptKey;
    $("loot-lines").innerHTML = receipts
      .map(
        (n) =>
          `<div class="loot-receipt" data-receipt="${n.id}">${n.kind === "currency" ? (artMeta.currency ? atlasIcon(artMeta.currency.file, artMeta.currency.cols, artMeta.currency.rows, 0) : itemIcon("fiber")) : itemIcon(n.item)}<span>${n.kind === "currency" ? "리프" : ITEMS[n.item].name}</span><b>+${n.count.toLocaleString()}</b></div>`,
      )
      .join("");
  }
  const events = p.logs.filter((e) => e.type !== "pickup").slice(-4);
  $("event-log").innerHTML = events
    .map((e) => `<div class="${esc(e.type)}">${esc(e.text)}</div>`)
    .join("");
  if (
    panel === "inventory" &&
    inventorySignature !== JSON.stringify([p.inventory, p.equipment])
  )
    renderPanel();
  const nearDrop = state.drops.find(
    (d) => !d.pickupEnds && distance(d, p) <= NEARBY_PICKUP_RANGE,
  );
  const nearChest = (state.chests || []).find(
    (c) => !c.opened && distance(c, p) < 2.6,
  );
  const nearNpc = NPCS.find((n) => n.map === p.map && distance(n, p) < 2.6),
    nearPortal = PORTALS(p.map).find((a) => distance(a, p) < 2.5),
    nearHerb = state.herbs.find((a) => a.ready && distance(a, p) < 2);
  const prompt = nearDrop
    ? `[${bindingLabel("pickup")}] 가까운 전리품 하나 줍기`
    : nearNpc
      ? `[${bindingLabel("interact")}] ${nearNpc.name}와 이야기`
      : nearChest
        ? nearChest.locked
          ? "수호자를 진정시키면 보물함이 열립니다."
          : `[${bindingLabel("interact")}] 숨은 보물함 열기`
        : nearPortal
          ? `[${bindingLabel("interact")}] ${nearPortal.label} 이동`
          : nearHerb
            ? `[${bindingLabel("interact")}] ${ITEMS[nearHerb.item].name} 잎 따기 · [Shift+${bindingLabel("interact")}] 포기 수확`
            : null;
  $("interact-prompt").hidden = !prompt;
  if (prompt) $("interact-prompt").textContent = prompt;
  $("connection-label").textContent = online
    ? `함께하는 모험 · 접속자 ${state.peers.length + 1}명`
    : "나의 모험 · 브라우저 저장";
  let soundBudget = 4;
  for (const e of state.effects)
    if (e.id > lastSoundEffect) {
      if (
        sound &&
        soundBudget > 0 &&
        (!e.owner || e.owner === p.id) &&
        distance(e, p) < 20
      ) {
        const cue =
          e.cue || (["heal", "level"].includes(e.kind) ? e.kind : null);
        if (cue) {
          audio ??= new CombatAudio();
          audio.play(cue);
          soundBudget--;
        }
      }
      lastSoundEffect = Math.max(lastSoundEffect, e.id);
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
  const chest = (state.chests || []).find(
    (c) => !c.opened && distance(c, p) < 2.6,
  );
  if (chest) {
    if (chest.locked) toast("이 지역의 수호자를 진정시키면 열립니다.");
    else send({ type: "openChest", chest: chest.id });
    return;
  }
  const port = PORTALS(p.map).find((a) => distance(a, p) < 2.5);
  if (port) {
    send({ type: "travel", map: port.to });
    return;
  }
  if (!send({ type: "interact", harvest: whole ? "whole" : "leaf" }, true))
    toast("사람, 보물함, 약초 또는 이동 지점 가까이 다가가 보세요.");
}
function openPanel(name) {
  clearAim();
  pickupHold.cancel();
  clearTimeout(toastTimer);
  $("toast").hidden = true;
  if (panel === name) {
    closePanel();
    return;
  }
  hideItemTooltip();
  rebindAction = null;
  bindingMessage = "";
  previousPanelFocus = document.activeElement;
  panel = name;
  $("menu-panel").dataset.panel = name;
  filter =
    name === "codex"
      ? codexMode !== "monsters"
        ? "all"
        : "0"
      : name === "craft"
        ? "equipment"
        : "all";
  if (running) send({ type: "move", x: 0, y: 0 }, true);
  $("panel-backdrop").hidden = false;
  $("menu-panel").hidden = false;
  renderPanel();
  $("close-panel").focus();
}
function closePanel() {
  hideItemTooltip();
  rebindAction = null;
  panel = null;
  $("menu-panel").hidden = true;
  $("panel-backdrop").hidden = true;
  if (
    previousPanelFocus instanceof HTMLElement &&
    previousPanelFocus.isConnected
  )
    previousPanelFocus.focus();
}
function equipmentStats(i) {
  if (i.type === "consumable")
    return (
      '<div class="item-stat-grid">' +
      consumableLines(i)
        .map((s) => "<span>" + esc(s) + "</span>")
        .join("") +
      "</div>"
    );
  if (!i.slot) return "";
  return (
    '<div class="item-stat-grid">' +
    Object.entries(STAT_NAMES)
      .filter(([key]) => i[key])
      .map(
        ([key, label]) =>
          `<span>${label} <b>${statValue(key, i[key], true)}</b></span>`,
      )
      .join("") +
    "</div>"
  );
}
function equipmentRequirements(i, p) {
  if (!i.slot) return "";
  const name = (v) =>
    CLASSES.find((c) => c.id === v)?.name ||
    CLASSES.flatMap((c) => c.branches).find((b) => b.id === v)?.name ||
    v ||
    "미전직";
  return (
    '<div class="equipment-requirements"><strong>장착 조건 · 기본 성장 스탯 기준</strong>' +
    equipRequirements(p, i)
      .map(
        (c) =>
          `<span class="${c.met ? "met" : "missing"}">${c.label} ${name(c.required)} <small>(현재 ${name(c.current)})</small></span>`,
      )
      .join("") +
    "</div>"
  );
}
function playerStats(p) {
  const points = unspentPoints(p);
  return (
    '<section data-player-stats><h3 class="panel-section">레벨 성장 능력치</h3><p class="panel-intro">레벨마다 12포인트를 직접 배분합니다. +1 또는 수량을 입력해 적용하세요. 장착 조건은 장비 보너스를 제외한 수치로 검사합니다.</p><p class="stat-points">남은 포인트 <b data-unspent>' +
    points +
    '</b></p><div class="player-stat-grid">' +
    Object.entries(ATTRIBUTE_NAMES)
      .map(
        ([key, label]) =>
          `<div><span>${label}</span><b data-attribute="${key}">${p.stats.attributes[key]}</b><div class="stat-allocate"><button data-action="allocateStat" data-attribute="${key}" data-amount="1" ${points < 1 ? "disabled" : ""}>+1</button><input aria-label="${label} 배분 수량" data-stat-amount="${key}" type="number" min="1" max="${points}" step="1" value="1" ${points < 1 ? "disabled" : ""}><button data-action="allocateStat" data-attribute="${key}" ${points < 1 ? "disabled" : ""}>적용</button></div></div>`,
      )
      .join("") +
    '</div><h3 class="panel-section">장비를 포함한 전투 능력치</h3><div class="player-stat-grid">' +
    Object.entries(STAT_NAMES)
      .map(
        ([key, label]) =>
          `<div><span>${label}</span><b data-stat="${key}">${statValue(key, p.stats[key])}</b></div>`,
      )
      .join("") +
    "</div></section>"
  );
}
function itemCard(i, p) {
  const n = p.inventory[i.id] || 0,
    equipped = Object.values(p.equipment).includes(i.id),
    usable = canEquip(p, i);
  return `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name} ${equipped ? '<span class="equipped">장착 중</span>' : ""}</h3><small>${i.slot ? `${SLOT_NAMES[i.slot]} · Lv.${i.level}` : i.type === "consumable" ? "소비 아이템" : i.type === "trophy" ? "기타 전리품" : "제작 재료"} · 보유 ${n}</small></div></div><p>${i.lore}</p>${equipmentStats(i)}${equipmentRequirements(i, p)}<div class="actions">${i.slot ? `<button data-action="equip" data-item="${i.id}" ${!usable || equipped ? "disabled" : ""}>${equipped ? "장착됨" : usable ? "장착" : "조건 미충족"}</button>` : ""}${i.type === "consumable" ? `<button data-action="potion" data-item="${i.id}">사용</button>` : ""}${i.slot && MAPS.find((m) => m.id === p.map).town ? `<button data-action="dismantle" data-item="${i.id}" ${equipped && n < 2 ? "disabled" : ""}>분해</button>` : ""}${MAPS.find((m) => m.id === p.map).town ? `<button data-action="sell" data-item="${i.id}" ${equipped && n < 2 ? "disabled" : ""}>판매 +${Math.max(1, Math.floor(i.price * 0.25))} 리프</button>` : ""}</div></article>`;
}
function tabs(names) {
  return `<div class="tabs">${names.map(([id, label]) => `<button data-filter="${id}" class="${filter === id ? "active" : ""}">${label}</button>`).join("")}</div>`;
}
function renderPanel() {
  const p = state?.player,
    c = cls(),
    body = $("panel-body");
  hideItemTooltip();
  let title = "",
    html = "";
  if (panel === "bindings") {
    title = "단축키 설정";
    html = keyboardPanel();
  } else if (panel === "help") {
    title = "숲길 안내서";
    html = `<p class="panel-intro">작은 발걸음으로 숲을 탐험하세요. 마을의 숲길지기에게 이야기를 듣고, 길 끝의 빛나는 표식으로 다음 맵에 갈 수 있습니다.</p><div class="help-grid">${[
      ["바닥 클릭 / 터치", "목적지로 이동"],
      ["이동 표식 클릭", "다음 맵으로 이동"],
      [bindingLabel("attack") + " → 몬스터 클릭", "대상에게 연속 기본공격"],
      [bindingLabel("attack") + " → 바닥 클릭", "공격·추적·시전 예약 중단"],
      [
        [0, 1, 2, 3].map((n) => bindingLabel("skill" + n)).join(" · "),
        "직업 스킬",
      ],
      [
        bindingLabel("interact") + " / Shift + " + bindingLabel("interact"),
        "대화 · 보물함 · 이동 · 잎 따기 / 포기 수확",
      ],
      [bindingLabel("potion"), "보들잎 연고"],
      [bindingLabel("pickup"), "하나 줍기 · 길게 누르면 차례로 줍기"],
      ["P", "전체 단축키 확인 · 변경"],
      [bindingLabel("target"), "가까운 적 선택"],
      [
        ["inventory", "craft", "map", "skills"].map(bindingLabel).join(" · "),
        "가방 · 제작 · 지도 · 직업",
      ],
      [
        ["journal", "codex", "help"].map(bindingLabel).join(" · "),
        "이야기 · 도감 · 도움말",
      ],
      ["Esc", "설정 열기 · 닫기"],
    ]
      .map(
        ([a, b]) =>
          `<div class="help-row"><span>${b}</span><kbd>${a}</kbd></div>`,
      )
      .join(
        "",
      )}</div><h3 class="panel-section">첫 번째 모험</h3><p class="panel-intro">마을 오른쪽의 새싹 울타리 표식에서 ${bindingLabel("interact")} → 몬스터 3마리 진정시키기 → 이야기 보상 받기 → 반짝이는 약초 채집 → 마을에서 연고 제작. 보스의 붉은 공격 범위는 발을 옮겨 피하세요.</p><h3 class="panel-section">숨은 숲길</h3><p class="panel-intro">길가의 반짝이는 기록을 조사하면 샛길의 단서를 얻습니다. 보물함은 클릭하거나 가까이에서 ${bindingLabel("interact")}로 열고, 떨어진 보물을 클릭해 가져가세요. 지도(M)에 발견 기록이 남습니다. 보스 맵의 보물함은 수호자를 진정시킨 뒤 열립니다.</p><h3 class="panel-section">함께 걷기와 저장</h3><p class="panel-intro">기본 모험은 이 브라우저에 자동 저장됩니다. 설정에서 파일로 내보내 보관할 수 있습니다. 실시간 동행은 별도 게임 서버 연결이 필요하며 설정에서 연결할 수 있습니다. 이 사이트 자체는 GitHub Pages에서 실행됩니다.</p><h3 class="panel-section">재료와 전직</h3><p class="panel-intro">모든 직업이 채집·제작·연금술을 이용합니다. 마을에서 기운을 무료로 회복할 수 있습니다. 레벨 25에는 조개등 마을의 은잎의 스승에게 2차 전직을 선택하세요.</p>`;
  } else if (!p) {
    title = "잠시만요";
    html = '<p class="panel-intro">모험을 시작한 뒤 이용할 수 있습니다.</p>';
  } else if (panel === "inventory") {
    title = "여행자의 가방";
    html = `<p class="panel-intro">아이콘에 마우스를 올리면 정보를 보고, 장비를 더블 클릭하면 장착합니다.</p><div class="panel-meta"><span class="tag">${p.gold.toLocaleString()} 리프</span><span class="tag">${Object.values(p.inventory).filter((n) => n > 0).length}종 보유</span></div>${tabs(
      [
        ["all", "전체"],
        ["equipment", "장비"],
        ["consumable", "소비"],
        ["material", "재료"],
        ["trophy", "전리품"],
      ],
    )}<div class="inventory-grid">${
      Object.entries(p.inventory)
        .filter(
          ([id, n]) => n > 0 && (filter === "all" || ITEMS[id].type === filter),
        )
        .map(([id]) => inventorySlot(ITEMS[id], p))
        .join("") || '<p class="panel-intro">아직 가방이 비어 있습니다.</p>'
    }</div>`;
  } else if (panel === "character") {
    title = "캐릭터 상태";
    html = `<p class="panel-intro">${esc(p.name)} · Lv.${p.level} · ${esc(displayClass())}</p><div class="equipment-body"><div class="equipment-avatar"><canvas id="equipment-avatar" width="192" height="192" aria-label="현재 장비를 든 캐릭터"></canvas></div>${Object.entries(
      SLOT_NAMES,
    )
      .map(([slot, label]) => {
        const item = ITEMS[p.equipment[slot]];
        return `<button class="equipped-slot slot-${slot}" data-equipment-slot="${slot}" ${item ? `data-inventory-item="${item.id}"` : ""}><strong>${label}</strong>${item ? itemIcon(item.id) + "<span>" + esc(item.name) + "</span><small>Lv." + item.level + "</small>" : "<span>미장착</span>"}</button>`;
      })
      .join("")}</div>${playerStats(p)}`;
  } else if (panel === "craft") {
    title = "숲의 작업대";
    const town = MAPS.find((m) => m.id === p.map).town;
    html = `<p class="panel-intro">${town ? "나무와 풀의 성질을 따라 장비와 약을 만듭니다. 기본 제작은 실패하지 않습니다." : "제작은 마을에서 이용할 수 있습니다. 지금은 제작법과 필요한 재료를 살펴보세요."}</p><div class="panel-meta"><span class="tag">장인 숙련 ${Math.floor(p.craftXp / 50) + 1}</span><span class="tag">${p.gold} 리프</span></div>${tabs(
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
        return `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name}</h3><small>${i.level ? "Lv." + i.level + " · " : ""}${i.branch ? "전직 전용" : i.type === "consumable" ? "연금술" : "장비 제작"}</small></div></div><p>${i.lore}</p>${equipmentStats(i)}${Object.entries(
          i.recipe,
        )
          .map(
            ([id, n]) =>
              `<div class="recipe-line ${(p.inventory[id] || 0) < n ? "missing" : ""}"><span>${ITEMS[id].name}</span><span>${p.inventory[id] || 0} / ${n}</span></div>`,
          )
          .join(
            "",
          )}<div class="recipe-line"><span>제작 비용</span><span>${cost} 리프</span></div><div class="actions"><button data-action="craft" data-item="${i.id}" ${can ? "" : "disabled"}>${can ? "제작하기" : !town ? "마을에서 제작" : (i.level || 1) > p.level ? "레벨 부족" : i.branch && i.branch !== p.branch ? "전직 필요" : "재료 또는 리프 부족"}</button></div></article>`;
      })
      .join("")}</div>`;
  } else if (panel === "map") {
    // All regions share the game’s native isometric scenery atlas.
    title = "잎새 너머의 지도";
    html =
      `<p class="panel-intro">테스트 서버: 아래의 맵을 누르면 방문·레벨·보스 처치 여부와 관계없이 즉시 이동합니다. 길 끝의 포탈도 이용할 수 있습니다.</p>` +
      `<article class="content-card"><h3>현재 지역 · ${NAVIGATION[p.map].shape}</h3><p>${NAVIGATION[p.map].routeCount}갈래 동선을 따라 합류터와 굽은 샛길을 탐험하세요.</p>${
        NAVIGATION[p.map].gatherSites.length
          ? "<h4>채집 군락</h4><p>" +
            NAVIGATION[p.map].gatherSites
              .map((a) => a.name + " · " + ITEMS[a.item].name)
              .join("<br>") +
            "</p><h4>함께 서식하는 생물</h4><p>" +
            speciesForMap(p.map)
              .map((a) => a.def.name)
              .join(" · ") +
            "</p>"
          : ""
      }</article>` +
      REGIONS.map(
        (r, ri) =>
          `<section class="map-region"><h3>0${ri + 1}. ${r.name}</h3><p class="panel-intro">${r.story}</p><div class="map-list">${MAPS.filter(
            (m) => m.region === ri,
          )
            .map(
              (m) =>
                `<button class="map-row ${p.map === m.id ? "current" : ""}" data-action="travel" data-map="${m.id}" data-fast="true" ${p.map === m.id ? "disabled" : ""}><div><h4>${m.town ? "⌂" : "◇"} ${m.name} ${p.map === m.id ? "· 현재 위치" : ""}</h4><p>${m.description}</p><small>${m.shape}</small></div><small>즉시 이동 · Lv.${m.level}</small></button>`,
            )
            .join("")}</div></section>`,
      ).join("") +
      `<h3 class="panel-section">발견한 숲길 · ${p.exploration.discovered.length}/${DISCOVERIES.length}</h3><p class="panel-intro">길가의 기록을 따라 본길 옆 샛길을 찾아보세요. 미니맵에는 조사한 장소와 발견한 보물함이 표시됩니다. 보물함 ${p.exploration.opened.length}/${CHESTS.length}개를 열었습니다.</p><div class="card-grid">${DISCOVERIES.filter(
        (d) => d.map === p.map || p.exploration.discovered.includes(d.id),
      )
        .map(
          (d) =>
            `<article class="content-card exploration-entry"><h3>${p.exploration.discovered.includes(d.id) ? esc(d.name) : "아직 읽지 못한 흔적"}</h3><p>${esc(p.exploration.discovered.includes(d.id) ? d.lore : d.hint)}</p><small>${MAPS.find((m) => m.id === d.map).name}</small></article>`,
        )
        .join("")}</div>` +
      '<p class="panel-intro">다음 여정: 유리버섯 수림 · 서리뿔 고원 · 월관의 고대숲. 이번 버전은 은물결 해안림까지 플레이할 수 있습니다.</p>';
  } else if (panel === "journal") {
    title = "숲이 남긴 이야기";
    html = `<p class="panel-intro">숲은 겨울을 두려워하고 있습니다. 작은 이웃들의 사정을 따라, 숲과 바다의 물길을 되돌려 주세요.</p>${QUESTS.map(
      (q, i) => {
        const done = i < p.quest.index,
          active = i === p.quest.index,
          progress = p.quest.counts[q.id] || 0;
        return `<article class="content-card quest-card-list ${done ? "completed" : ""}"><div class="quest-index">${done ? "✓ 마친 이야기" : active ? "❧ 지금의 이야기" : "이어지는 이야기"} · ${String(i + 1).padStart(2, "0")}</div><h3>${q.title}</h3><p>${q.text}</p>${active ? `<div class="progress-track"><span style="width:${(progress / q.count) * 100}%"></span></div><div class="recipe-line"><span>진행 ${progress} / ${q.count}</span><span>${xpReward(q.xp)} 경험치 · ${q.gold} 리프</span></div><div class="actions"><button data-action="claimQuest" ${progress >= q.count ? "" : "disabled"}>이야기 보상 받기</button></div>` : ""}</article>`;
      },
    ).join("")}`;
  } else if (panel === "codex") {
    title = "리프테일 도감";
    const catalogueTabs = `<div class="tabs catalogue-tabs"><button data-catalogue="monsters" aria-pressed="${codexMode === "monsters"}">몬스터 ${MONSTERS.length}</button><button data-catalogue="items" aria-pressed="${codexMode === "items"}">아이템 ${Object.keys(ITEMS).length}</button><button data-catalogue="crafting" aria-pressed="${codexMode === "crafting"}">제작 도감 40</button></div>`;
    if (codexMode === "crafting") {
      html =
        catalogueTabs +
        `<p class="panel-intro">재료 아이콘 아래의 수량을 모아 마을에서 제작하세요. 아이콘을 누르면 아이템 도감에서 획득처를 볼 수 있습니다. 기본 보급약 4종은 아이템 도감에서 따로 확인할 수 있습니다. <a href="./bestiary.html?v=${ART_REVISION}#crafting" target="_blank" rel="noopener">제작 도감 전체 보기 ↗</a></p>` +
        tabs([
          ["all", "전체 40종"],
          ["recovery", "회복 · 해독"],
          ["enhancement", "능력 강화"],
          ["only", "제작 전용"],
        ]) +
        `<div class="craft-guide-list">${Object.values(ITEMS)
          .filter(
            (i) =>
              i.craftGuide &&
              (filter === "all" ||
                (filter === "only" ? i.craftOnly : i.craftCategory === filter)),
          )
          .sort((a, b) => a.level - b.level)
          .map((i) => craftGuideCard(i, p))
          .join("")}</div>`;
    } else if (codexMode === "items") {
      html =
        catalogueTabs +
        `<p class="panel-intro"><a href="./bestiary.html?v=${ART_REVISION}#items" target="_blank" rel="noopener">리프테일 아이템 도감 전체 보기 ↗</a></p>` +
        tabs([
          ["all", "전체"],
          ["equipment", "장비"],
          ["consumable", "소비"],
          ["material", "재료"],
          ["trophy", "전리품"],
        ]) +
        `<div class="card-grid">${Object.values(ITEMS)
          .filter((i) => filter === "all" || i.type === filter)
          .map(codexItemCard)
          .join("")}</div>`;
    } else
      html =
        catalogueTabs +
        `<p class="panel-intro">모든 생명에게는 이곳에 머무는 이유가 있습니다. 재료 10% · 고유 전리품 60% · 장비 40% · 소비 아이템 5%. 각 아이템을 독립 추첨하므로 장비가 여러 개 나올 수 있습니다. 경험치는 처치 시 획득하며, 리프와 아이템은 바닥에 떨어집니다. 클릭하면 플레이어에게 날아와 획득됩니다.</p><p class="panel-intro"><a class="small-button" href="./bestiary.html?v=${ART_REVISION}" target="_blank" rel="noopener">리프테일 도감 전체 보기 ↗</a></p><div class="panel-meta"><span class="tag">만난 생명 ${p.discovered.length} / ${MONSTERS.length}</span><span class="tag">진정시킨 횟수 ${p.kills}</span></div>${tabs(
          [
            ["0", "햇살잎 숲 · 30종"],
            ["1", "은물결 해안림 · 30종"],
          ],
        )}<div class="card-grid codex-grid">${MONSTERS.filter(
          (m) => m.region === Number(filter),
        )
          .map(
            (m) =>
              `<article class="content-card"><canvas class="monster-preview" data-monster-preview="${m.id}" width="72" height="64" aria-hidden="true"></canvas><small class="equipped">${TYPE_NAMES[m.type]} · Lv.${m.level}</small><h3>${m.name}</h3><p>${m.lore}</p><small class="equipped">${mapsForSpecies(
                m.id,
              )
                .map((a) => a.name)
                .join(
                  " · ",
                )} · HP ${m.hp}</small><details><summary class="small-button">드롭 테이블 보기</summary><p>확정 ${xpReward(m.xp)} 경험치 · ${Math.round(m.level * (m.type === "boss" ? 15 : 1.8) + 5)} 리프</p>${m.drops.map((d) => `<div class="drop-row"><span>${itemIcon(d.item)}${ITEMS[d.item].name} ×${d.min}${d.min !== d.max ? "–" + d.max : ""}</span><b>${Math.round(dropChance(d.chance) * 1000) / 10}%</b></div>`).join("")}</details></article>`,
          )
          .join("")}</div>`;
  } else if (panel === "skills") {
    title = displayClass();
    html = `<p class="panel-intro">${c.description}</p><h3 class="panel-section">${CLASS_TACTICS[c.id].name}</h3><p class="panel-intro">${CLASS_TACTICS[c.id].text}</p><div class="panel-meta"><span class="tag">Lv.${p.level}</span><span class="tag">공격 ${Math.floor(p.stats.attack)}</span><span class="tag">방어 ${Math.floor(p.stats.defense)}</span><span class="tag">약초 숙련 ${Math.floor(p.herbXp / 40) + 1}</span></div>${playerStats(p)}<h3 class="panel-section">전투 기술</h3>${[0, 1, 2, 3].map((n) => `<div class="skill-row"><span class="skill-glyph">${skillIcon(n)}</span><div><h3>${n + 1}. ${skillName(n)}</h3><p>${n < 3 ? skillDescriptions[c.id][n] : c.branches.find((b) => b.id === p.branch)?.description || "레벨 25에 전직하면 각자의 길을 대표하는 기술을 배웁니다."}</p><small>집중 ${SKILL_COSTS[n]} · 재사용 ${SKILL_COOLDOWNS[n]}초 · ${n === 0 ? "처음부터 사용" : n === 3 ? "2차 전직 후 사용" : `레벨 ${n === 1 ? 4 : 8} 해금`}</small></div></div>`).join("")}<h3 class="panel-section">두 번째 숲길 · 2차 전직</h3><p class="panel-intro">레벨 25에 조개등 마을에서 선택합니다. 선택한 길은 되돌릴 수 없으니 천천히 살펴보세요.</p><div class="card-grid">${c.branches.map((b) => `<article class="content-card branch-card ${p.branch === b.id ? "chosen" : ""}"><h3>${b.name}</h3><p>${b.description}</p><small class="equipped">전용 기술 · ${b.skill}</small><div class="actions"><button data-action="subclass" data-branch="${b.id}" ${p.branch || p.level < 25 || p.map !== "shelltown" ? "disabled" : ""}>${p.branch === b.id ? "선택한 길" : p.branch ? "다른 길" : p.level < 25 ? "레벨 25 필요" : p.map !== "shelltown" ? "조개등 마을에서 선택" : "이 길을 선택"}</button></div></article>`).join("")}</div>`;
  } else if (panel?.startsWith("npc:")) {
    const n = NPCS.find((n) => n.id === panel.split(":")[1]);
    title = n.name;
    html = `<p class="npc-dialog">“${n.text}”</p><div class="actions"><button data-open="journal">이야기 보기</button><button data-open="craft">제작 · 연금술</button><button data-open="skills">직업과 전직</button><button data-action="rest">기운 회복 · 무료</button></div><h3 class="panel-section">여행을 위한 작은 준비</h3><div class="card-grid">${Object.values(
      ITEMS,
    )
      .filter((i) => i.type === "consumable" && !i.craftOnly)
      .map(
        (i) =>
          `<article class="item-card"><div class="item-heading">${itemIcon(i.id)}<div><h3>${i.name}</h3><small>${i.price} 리프 · 보유 ${p.inventory[i.id] || 0}</small></div></div><p>${i.lore}</p>${equipmentStats(i)}<div class="actions"><button data-action="buy" data-item="${i.id}" ${p.gold < i.price ? "disabled" : ""}>구입</button></div></article>`,
      )
      .join("")}</div>`;
  } else if (panel === "settings") {
    title = "모험의 작은 설정";
    html = `<section class="setting-row"><h3>화면 모드</h3><label class="fullscreen-choice"><input type="checkbox" data-fullscreen ${document.fullscreenElement ? "checked" : ""} ${fullscreenSupported(document, $("game-shell")) ? "" : "disabled"}> 전체화면으로 플레이</label><p>창 모드와 전체화면을 즉시 전환합니다. Esc는 설정을 열거나 닫습니다.</p></section><section class="setting-row"><h3>단축키</h3><p>P 키로 전체 조작을 확인하고 원하는 키로 바꿀 수 있습니다.</p><button data-open="bindings">키보드 단축키 설정</button></section><section class="setting-row"><h3>이 브라우저의 모험</h3><p>기본 모험은 5초마다 자동 저장됩니다. 브라우저 데이터를 지우면 저장도 없어지므로 파일로 보관하세요.</p><div class="actions"><button data-special="save">지금 저장</button><button data-special="export">저장 파일 내보내기</button><button data-special="import">저장 파일 가져오기</button></div><input type="file" id="import-file" accept="application/json,.json" hidden></section><section class="setting-row"><h3>함께 걷는 숲 · 실시간 서버</h3><p>GitHub Pages는 게임 화면을 제공합니다. 실시간 동행과 서버 저장에는 별도 배포한 리프테일 서버가 필요합니다. 연결 전의 모험과 서버의 모험은 별도로 저장됩니다.</p><label for="server-url" class="panel-intro">게임 서버 주소</label><input id="server-url" placeholder="wss://게임서버주소/ws" value="${esc(readSetting("leaftale:server") || "")}"><div class="actions"><button data-special="connect">서버에 연결</button><button data-special="disconnect" ${online ? "" : "disabled"}>나의 모험으로 돌아오기</button></div><p>${online ? "실시간 서버에 연결되어 있습니다." : "현재는 브라우저에서 혼자 모험하고 있습니다."}</p></section><section class="setting-row"><h3>숲의 소리</h3><p>직접 합성한 가벼운 전투 효과음을 켜거나 끕니다.</p><button data-special="sound">효과음 ${sound ? "끄기" : "켜기"}</button></section><section class="setting-row"><h3>첫 화면</h3><p>지금 모험을 저장하고 처음 화면으로 돌아갑니다.</p><button data-special="title">모험 저장 후 첫 화면</button></section>`;
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
  if (panel === "inventory")
    inventorySignature = JSON.stringify([p.inventory, p.equipment]);
  $("panel-title").textContent = title;
  if (panel === "map")
    html =
      '<p><a href="./maps.html" target="_blank" rel="noopener">지역 풍경 둘러보기 ↗</a></p>' +
      html;
  body.innerHTML = html;
  if (panel === "character")
    drawCharacterPreview($("equipment-avatar"), p.classId, false, p.equipment);
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
          const beforeStats = state?.player?.allocated;
          state = msg.state;
          buildSkillbarIfNeeded();
          hud();
          if (
            panel === "skills" &&
            JSON.stringify(beforeStats) !==
              JSON.stringify(state.player.allocated)
          ) {
            const top = $("panel-body").scrollTop;
            renderPanel();
            $("panel-body").scrollTop = top;
          }
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
function panelClick(e) {
  const keyButton = e.target.closest("[data-rebind]");
  if (keyButton) {
    rebindAction = keyButton.dataset.rebind;
    bindingMessage = "";
    renderPanel();
    return;
  }
  if (e.target.closest("[data-reset-bindings]")) {
    bindings = { ...DEFAULT_BINDINGS };
    rebindAction = null;
    bindingMessage = "기본 단축키로 복원했습니다.";
    persistBindings();
    renderPanel();
    return;
  }
  const catalogue = e.target.closest("[data-catalogue]");
  if (catalogue) {
    codexMode = catalogue.dataset.catalogue;
    filter = codexMode === "monsters" ? "0" : "all";
    renderPanel();
    return;
  }
  const guideItem = e.target.closest("[data-guide-item]");
  if (guideItem) {
    const id = guideItem.dataset.guideItem;
    codexMode = "items";
    filter = ITEMS[id].type;
    renderPanel();
    $("panel-body")
      .querySelector(`[data-guide-entry="${id}"]`)
      ?.scrollIntoView({ block: "start" });
    return;
  }
  const slot = e.target.closest("[data-inventory-item]");
  if (slot) {
    showItemTooltip(slot);
    return;
  }

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
  if (b.dataset.action === "allocateStat") {
    const amount = Number(
      b.dataset.amount ??
        document.querySelector(`[data-stat-amount="${b.dataset.attribute}"]`)
          ?.value,
    );
    if (
      !Number.isSafeInteger(amount) ||
      amount < 1 ||
      amount > unspentPoints(state.player)
    ) {
      toast("남은 포인트 안에서 1 이상의 정수를 입력해 주세요.");
      return;
    }
    const top = $("panel-body").scrollTop;
    send({ type: "allocateStat", attribute: b.dataset.attribute, amount });
    $("panel-body").scrollTop = top;
    return;
  }
  if (b.dataset.action)
    send({
      type: b.dataset.action,
      attribute: b.dataset.attribute,
      amount: Number(
        b.dataset.amount ??
          document.querySelector(`[data-stat-amount="${b.dataset.attribute}"]`)
            ?.value,
      ),
      item: b.dataset.item,
      slot: Number(b.dataset.slot),
      map: b.dataset.map,
      fast: b.dataset.fast === "true",
      branch: b.dataset.branch,
    });
}
$("panel-body").addEventListener("click", panelClick);
$("panel-body").addEventListener("dblclick", (e) => {
  const slot = e.target.closest("[data-inventory-item]"),
    id = slot?.dataset.inventoryItem,
    item = ITEMS[id];
  if (item?.slot && state.player.equipment[item.slot] !== id) {
    e.preventDefault();
    send({ type: "equip", item: id });
  }
});
$("panel-body").addEventListener("change", (e) => {
  if (e.target.matches("[data-fullscreen]"))
    chooseDisplayMode(e.target.checked);
});
$("item-tooltip").addEventListener("click", panelClick);

$("skillbar").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (["attack", "skill"].includes(b.dataset.action))
    armCombat(
      b.dataset.action,
      b.dataset.action === "skill" ? Number(b.dataset.slot) : null,
    );
  else send({ type: b.dataset.action, item: "salve" }, true);
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
  if (sound) {
    audio ??= new CombatAudio();
    audio.unlock();
    audio.play("heal");
  }
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
  pickupHold.cancel();
  document.body.classList.remove("in-game");
  const saved = readSave();
  $("lobby").hidden = false;
  $("continue-game").hidden = !saved;
  if (saved)
    $("continue-game").textContent =
      `${saved.name} · Lv.${saved.level} 이어서 →`;
  $("class-select").innerHTML = CLASSES.map(
    (c) =>
      `<button class="class-choice" data-class="${c.id}" aria-pressed="${c.id === selectedClass}"><canvas class="class-preview" data-class-preview="${c.id}" width="48" height="48" aria-hidden="true"></canvas><strong>${c.name}</strong><small>${c.role}</small></button>`,
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
  chooseDisplayMode($("start-fullscreen").checked);
  start();
};
$("continue-game").onclick = () => {
  const p = readSave();
  if (p) {
    chooseDisplayMode($("start-fullscreen").checked);
    start(p);
  }
};
canvas.addEventListener("pointerdown", (e) => {
  if (!running || panel || (e.pointerType === "mouse" && e.button !== 0))
    return;
  const r = canvas.getBoundingClientRect(),
    x = e.clientX - r.left,
    y = e.clientY - r.top,
    hit = renderer.hit(x, y);
  canvas.focus();
  if (aimedAction) {
    const a = aimedAction,
      pos = renderer.screenToWorld(x, y);
    if (a.rule.mode === "enemy" && hit?.kind !== "monster") {
      if (a.type === "attack") {
        send({ type: "cancelCombat" }, true);
        target = null;
        clearAim();
        toast("공격을 중단했습니다.");
        return;
      }
      toast("공격할 적을 클릭해 주세요.");
      return;
    }
    const action = { type: a.type, slot: a.slot };
    if (a.rule.mode === "enemy") {
      action.target = hit.id;
      target = hit.id;
    }
    if (a.rule.mode === "ground") action.point = pos;
    if (send(action)) {
      clearAim();
      if (a.type === "skill" && state.player.queuedSkill)
        toast("사거리까지 이동한 뒤 스킬을 사용합니다.");
    } else toast("사거리·시야·집중·재사용 시간을 확인해 주세요.");
    return;
  }
  if (hit?.kind === "portal") {
    const portal = PORTALS(state.player.map).find((p) => p.to === hit.id);
    if (distance(portal, state.player) < 2.5)
      send({ type: "travel", map: portal.to });
    else {
      pendingInteraction = { kind: "portal", id: portal.to };
      send({ type: "moveTo", x: portal.x, y: portal.y }, true);
    }
  } else if (hit?.kind === "chest") {
    const chest = state.chests.find((c) => c.id === hit.id);
    if (!chest) return;
    if (chest.locked) {
      toast("이 지역의 수호자를 진정시키면 열립니다.");
      return;
    }
    pendingInteraction = null;
    if (distance(chest, state.player) < 2.6)
      send({ type: "openChest", chest: chest.id });
    else {
      pendingInteraction = { kind: "chest", id: chest.id };
      send({ type: "moveTo", x: chest.x, y: chest.y }, true);
    }
  } else if (hit?.kind === "discovery") {
    const site = state.discoveries.find((d) => d.id === hit.id);
    if (site) {
      pendingInteraction = null;
      send({ type: "moveTo", x: site.x, y: site.y }, true);
    }
  } else if (hit?.kind === "drop") {
    pendingInteraction = null;
    const drop = state.drops.find((d) => d.id === hit.id);
    if (drop && distance(drop, state.player) <= PICKUP_RANGE)
      send({ type: "pickup", drop: drop.id }, true);
    else if (drop) {
      pendingInteraction = { kind: "drop", id: drop.id };
      send({ type: "moveTo", x: drop.x, y: drop.y }, true);
    }
  } else if (hit?.kind === "monster") {
    target = hit.id;
    // Clicking an unarmed enemy selects it without attacking.
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
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  clearAim();
});
window.addEventListener("keydown", (e) => {
  const typing = e.target.closest?.(
    'input,textarea,select,[contenteditable="true"]',
  );
  if (rebindAction && panel === "bindings") {
    e.preventDefault();
    if (e.repeat) return;
    if (e.code === "Escape") {
      rebindAction = null;
      bindingMessage = "키 변경을 취소했습니다.";
      renderPanel();
      return;
    }
    const result = rebind(bindings, rebindAction, e.code);
    if (result.ok) {
      bindings = result.bindings;
      bindingMessage =
        CONTROL_ACTIONS.find((a) => a.id === rebindAction).label +
        " → " +
        keyLabel(e.code);
      rebindAction = null;
      persistBindings();
    } else bindingMessage = result.message;
    renderPanel();
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    if (e.repeat) return;
    clearAim();
    if (running) openPanel("settings");
    else if (panel) closePanel();
    return;
  }
  if (typing) return;
  const action = actionForEvent(e, bindings);
  const panelActions = [
    "character",
    "inventory",
    "craft",
    "map",
    "skills",
    "journal",
    "codex",
    "help",
    "settings",
    "bindings",
  ];
  if (panelActions.includes(action) && (running || action === "bindings")) {
    e.preventDefault();
    if (!e.repeat) openPanel(action);
    return;
  }
  if (panel) {
    if (e.key === "Tab") {
      const nodes = [
        ...$("menu-panel").querySelectorAll(
          "button:not(:disabled),input:not([hidden]),select,summary,a[href]",
        ),
        ...(!$("item-tooltip").hidden
          ? $("item-tooltip").querySelectorAll("button:not(:disabled)")
          : []),
      ].filter((n) => n.getClientRects().length);
      if (nodes.length) {
        const i = nodes.indexOf(document.activeElement),
          j = e.shiftKey
            ? i <= 0
              ? nodes.length - 1
              : i - 1
            : (i + 1) % nodes.length;
        nodes[j].focus();
        e.preventDefault();
      }
    }
    return;
  }
  if (action === "pickup" && running) {
    e.preventDefault();
    if (
      !e.repeat &&
      state.player.hp > 0 &&
      pickupHold.press(e.code, performance.now()) &&
      pickupHold.take(performance.now())
    )
      if (!send({ type: "pickupNearest" }, true))
        toast("가까운 바닥 전리품이 없습니다.");
    return;
  }
  if (!running || e.repeat) return;
  if (action) e.preventDefault();
  if (action?.startsWith("skill")) armCombat("skill", Number(action.slice(5)));
  if (action === "attack") armCombat("attack");
  if (action === "potion") send({ type: "potion", item: "salve" });
  if (action === "interact") interact(e.shiftKey);
  if (action === "target") {
    const mobs = state.mobs
      .filter((m) => m.hp > 0 && distance(m, state.player) < 12)
      .sort((a, b) => distance(a, state.player) - distance(b, state.player));
    if (mobs.length)
      target =
        mobs[(mobs.findIndex((m) => m.uid === target) + 1) % mobs.length].uid;
  }
  if (e.code === "Enter" && !$("chat-toggle").hidden) $("chat-toggle").click();
});
$("panel-body").addEventListener("pointerover", (e) => {
  const slot = e.target.closest("[data-inventory-item]");
  if (slot) showItemTooltip(slot);
});
$("panel-body").addEventListener("focusin", (e) => {
  const slot = e.target.closest("[data-inventory-item]");
  if (slot) showItemTooltip(slot);
});
$("panel-body").addEventListener("pointerout", (e) => {
  if (
    e.target.closest("[data-inventory-item]") &&
    !e.relatedTarget?.closest?.("#item-tooltip,[data-inventory-item]")
  )
    tooltipTimer = setTimeout(hideItemTooltip, 180);
});
$("item-tooltip").addEventListener("pointerenter", () =>
  clearTimeout(tooltipTimer),
);
$("item-tooltip").addEventListener("pointerleave", () => {
  tooltipTimer = setTimeout(hideItemTooltip, 180);
});
// Description pixels pass through to the real item below. Keep the popup open
// while crossing its non-interactive text to reach its explicit action buttons.
window.addEventListener("pointermove", (e) => {
  if (panel !== "inventory" || $("item-tooltip").hidden) return;
  const r = $("item-tooltip").getBoundingClientRect();
  if (
    e.clientX >= r.left &&
    e.clientX <= r.right &&
    e.clientY >= r.top &&
    e.clientY <= r.bottom
  )
    clearTimeout(tooltipTimer);
  else if (
    !e.target.closest?.("[data-inventory-item]") &&
    !$("item-tooltip").contains(e.target)
  ) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(hideItemTooltip, 180);
  }
});
$("panel-body").addEventListener("scroll", hideItemTooltip);
$("panel-body").addEventListener("focusout", (e) => {
  if (
    e.target.closest("[data-inventory-item]") &&
    !e.relatedTarget?.closest?.("#item-tooltip,[data-inventory-item]")
  )
    tooltipTimer = setTimeout(hideItemTooltip, 180);
});
window.addEventListener("resize", hideItemTooltip);
window.addEventListener("blur", () => {
  pickupHold.cancel();
  clearAim();
  if (running) send({ type: "move", x: 0, y: 0 }, true);
});
window.addEventListener("keyup", (e) => pickupHold.release(e.code));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pickupHold.cancel();
});
window.addEventListener("pagehide", () => {
  pickupHold.cancel();
  save();
});
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (running && state) {
    if (!online && worldArtReady(state.player.map)) {
      world.step(dt);
      state = world.snapshot("local");
    }
    if (panel || state.player.hp <= 0) pickupHold.cancel();
    else if (pickupHold.take(now)) send({ type: "pickupNearest" }, true);
    if (pendingInteraction && !panel) {
      const n =
        pendingInteraction.kind === "npc"
          ? NPCS.find((n) => n.id === pendingInteraction.id)
          : pendingInteraction.kind === "portal"
            ? PORTALS(state.player.map).find(
                (p) => p.to === pendingInteraction.id,
              )
            : pendingInteraction.kind === "chest"
              ? state.chests.find((c) => c.id === pendingInteraction.id)
              : pendingInteraction.kind === "drop"
                ? state.drops.find((d) => d.id === pendingInteraction.id)
                : state.herbs.find((h) => h.id === pendingInteraction.id);
      if (
        n &&
        distance(n, state.player) <
          (pendingInteraction.kind === "drop" ? PICKUP_RANGE : 1.9)
      ) {
        if (pendingInteraction.kind === "chest")
          send({ type: "openChest", chest: n.id }, true);
        else if (pendingInteraction.kind === "npc") openPanel("npc:" + n.id);
        else if (pendingInteraction.kind === "portal")
          send({ type: "travel", map: n.to });
        else if (pendingInteraction.kind === "drop")
          send({ type: "pickup", drop: n.id }, true);
        else send({ type: "interact", herb: n.id }, true);
        pendingInteraction = null;
      }
    }
    if (aimedAction && aimedAction.map !== state.player.map) clearAim();
    if (aimedAction) {
      aimedAction.rule = combatAim(state.player, aimedAction.slot);
      const point = aimPointer
        ? renderer.screenToWorld(aimPointer.x, aimPointer.y)
        : state.player;
      renderer.aim = { ...aimedAction.rule, point, origin: state.player };
    } else if (state.player.queuedSkill?.point) {
      renderer.aim = {
        ...combatAim(state.player, state.player.queuedSkill.slot),
        point: state.player.queuedSkill.point,
        origin: state.player,
        queued: true,
      };
    } else renderer.aim = null;
    if (renderer.prefetchedRegion !== state.player.map) {
      renderer.prefetchedRegion = state.player.map;
      for (const portal of PORTALS(state.player.map))
        prepareWorldArt(portal.to).catch(() => {});
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
  version: "0.27.0",
  view: () => ({
    zoom: renderer.zoom,
    camera: { ...renderer.camera },
    size: { ...renderer.size },
  }),
  worldToScreen: (x, y) => renderer.worldToScreen(x, y),
  screenToWorld: (x, y) => renderer.screenToWorld(x, y),
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
  refreshBindingLabels();
  requestAnimationFrame(frame);
} catch (error) {
  $("loading-text").textContent =
    "숲을 불러오지 못했습니다. 새로고침해 주세요.";
  console.error(error);
}
