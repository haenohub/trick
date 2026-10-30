export const FULLSCREEN_KEY = "leaftale:fullscreen";
export function fullscreenSupported(
  doc = document,
  element = doc.documentElement,
) {
  return !!element.requestFullscreen && doc.fullscreenEnabled !== false;
}
export async function setFullscreen(enabled, element, doc = document) {
  if (enabled) {
    if (doc.fullscreenElement === element) return true;
    if (!fullscreenSupported(doc, element))
      throw new Error("전체화면을 지원하지 않는 브라우저입니다.");
    await element.requestFullscreen();
  } else if (doc.fullscreenElement) await doc.exitFullscreen();
  return !!doc.fullscreenElement;
}
