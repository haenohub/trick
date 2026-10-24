// Physical key codes also work while a Korean keyboard layout is selected.
export const CONTROL_ACTIONS = [
  ["skill0", "스킬 1", "KeyQ"],
  ["skill1", "스킬 2", "KeyW"],
  ["skill2", "스킬 3", "KeyE"],
  ["skill3", "스킬 4", "KeyR"],
  ["pickup", "전리품 하나 줍기", "KeyA"],
  ["attack", "기본 공격", "Space"],
  ["interact", "대화 · 채집 · 이동", "KeyF"],
  ["potion", "연고 사용", "KeyT"],
  ["target", "다음 적 선택", "Tab"],
  ["inventory", "인벤토리", "KeyI"],
  ["skills", "직업 · 스킬", "KeyC"],
  ["craft", "제작 · 연금술", "KeyB"],
  ["map", "지도 · 발견 기록", "KeyM"],
  ["journal", "이야기", "KeyL"],
  ["codex", "리프테일 도감", "KeyK"],
  ["help", "도움말", "KeyH"],
  ["settings", "게임 설정", "KeyO"],
].map(([id, label, code]) => ({ id, label, code }));
export const DEFAULT_BINDINGS = Object.freeze(
  Object.fromEntries(CONTROL_ACTIONS.map((a) => [a.id, a.code])),
);
export const CONTROLS_KEY = "leaftale:controls:v1";
export const KEYBOARD_ROWS = [
  [
    "Escape",
    "F1",
    "F2",
    "F3",
    "F4",
    "F5",
    "F6",
    "F7",
    "F8",
    "F9",
    "F10",
    "F11",
    "F12",
  ],
  [
    "Backquote",
    "Digit1",
    "Digit2",
    "Digit3",
    "Digit4",
    "Digit5",
    "Digit6",
    "Digit7",
    "Digit8",
    "Digit9",
    "Digit0",
    "Minus",
    "Equal",
    "Backspace",
  ],
  [
    "Tab",
    "KeyQ",
    "KeyW",
    "KeyE",
    "KeyR",
    "KeyT",
    "KeyY",
    "KeyU",
    "KeyI",
    "KeyO",
    "KeyP",
    "BracketLeft",
    "BracketRight",
    "Backslash",
  ],
  [
    "CapsLock",
    "KeyA",
    "KeyS",
    "KeyD",
    "KeyF",
    "KeyG",
    "KeyH",
    "KeyJ",
    "KeyK",
    "KeyL",
    "Semicolon",
    "Quote",
    "Enter",
  ],
  [
    "ShiftLeft",
    "KeyZ",
    "KeyX",
    "KeyC",
    "KeyV",
    "KeyB",
    "KeyN",
    "KeyM",
    "Comma",
    "Period",
    "Slash",
    "ShiftRight",
  ],
  [
    "ControlLeft",
    "MetaLeft",
    "AltLeft",
    "Space",
    "AltRight",
    "ContextMenu",
    "ControlRight",
  ],
];
const assignable = new Set(
  KEYBOARD_ROWS.flat().filter(
    (c) =>
      /^(Key[A-Z]|Digit\d)$/.test(c) ||
      [
        "Space",
        "Tab",
        "Backquote",
        "Minus",
        "Equal",
        "BracketLeft",
        "BracketRight",
        "Backslash",
        "Semicolon",
        "Quote",
        "Comma",
        "Period",
        "Slash",
      ].includes(c),
  ),
);
assignable.delete("KeyP");
export const isAssignable = (code) => assignable.has(code);
export function keyLabel(code) {
  const labels = {
    Space: "Space",
    Escape: "Esc",
    Backquote: "`",
    Minus: "−",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backspace: "⌫",
    CapsLock: "Caps",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    MetaLeft: "Win",
    AltLeft: "Alt",
    AltRight: "Alt",
    ContextMenu: "메뉴",
  };
  return labels[code] || code?.replace(/^(Key|Digit)/, "") || "";
}
export function restoreBindings(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BINDINGS };
  const values = CONTROL_ACTIONS.map((a) => raw[a.id]);
  return values.every(isAssignable) && new Set(values).size === values.length
    ? Object.fromEntries(CONTROL_ACTIONS.map((a) => [a.id, raw[a.id]]))
    : { ...DEFAULT_BINDINGS };
}
export function rebind(bindings, action, code) {
  if (!Object.hasOwn(DEFAULT_BINDINGS, action) || !isAssignable(code))
    return {
      ok: false,
      message:
        "이 키는 브라우저 또는 고정 조작에 사용합니다. 다른 키를 골라 주세요.",
    };
  const conflict = CONTROL_ACTIONS.find(
    (a) => a.id !== action && bindings[a.id] === code,
  );
  if (conflict)
    return {
      ok: false,
      message: keyLabel(code) + " 키는 " + conflict.label + "에 사용 중입니다.",
    };
  return { ok: true, bindings: { ...bindings, [action]: code } };
}
export function actionForEvent(event, bindings) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const code =
    event.code ||
    (/^[a-z]$/i.test(event.key)
      ? "Key" + event.key.toUpperCase()
      : event.key === " "
        ? "Space"
        : event.key);
  if (code === "KeyP") return "bindings";
  const action = CONTROL_ACTIONS.find((a) => bindings[a.id] === code)?.id;
  return (
    action || (code === "KeyJ" && bindings.attack === "Space" ? "attack" : null)
  );
}
