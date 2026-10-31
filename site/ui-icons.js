// Interface chrome only. Game sprites continue to use their native pixel art.
const paths = {
  leaf: '<path d="M19 4C9 3 3 7 5 14c2 6 13 5 14-10Z"/><path d="m4 21 11-12M8 17l-1-5m4 2 5 1"/>',
  book: '<path d="M12 6C8 3 4 4 3 4v15c4-1 7 0 9 2 2-2 5-3 9-2V4c-4-1-7 0-9 2ZM12 6v15"/>',
  bag: '<path d="M7 7V6a5 5 0 0 1 10 0v1M5 7h14l2 14H3L5 7Z"/><path d="M9 12h6"/>',
  craft: '<path d="m14 3 7 7-4 4-7-7 4-4ZM12 12 3 21m0-4 4 4"/>',
  map: '<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  keyboard: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10"/>',
  settings: '<path d="m9 3-1 3-3 1-2 3 2 2-1 3 3 2 2-1 2 3h3l1-3 3-1 2-3-2-2 1-3-3-2-2 1-2-3H9Z"/><circle cx="12" cy="11" r="3"/>',
  sound: '<path d="m3 9 4 0 5-4v14l-5-4H3V9Zm13-2a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 5 2c-2 1-2 1-2 3m0 3h.01"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  external: '<path d="M13 4h7v7m0-7L10 14m0-10H4v16h16v-6"/>',
};

export function uiIcon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.leaf}</svg>`;
}

export function mountUIIcons(root = document) {
  for (const element of root.querySelectorAll('[data-ui-icon]'))
    element.innerHTML = uiIcon(element.dataset.uiIcon);
}
