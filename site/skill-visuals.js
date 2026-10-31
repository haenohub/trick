// One authored row per skill, including every second profession.
import { EXTRA_SKILLS } from "./skill-expansion.js";
const group = (cls, entries) =>
  entries.map(([key, name, mode, width, height, duration], row) => ({
    key,
    name,
    classId: cls,
    row,
    mode,
    width,
    height,
    duration,
    slot: row < 3 ? row : 3,
  }));
export const SKILL_VISUALS = Object.fromEntries(
  [
    ...group("warden", [
      ["warden-0", "잎새 찌르기", "line", 170, 65, 0.48],
      ["warden-1", "뿌리 버티기", "self", 130, 150, 0.9],
      ["warden-2", "가지 휩쓸기", "ground", 230, 145, 0.65],
      ["antler", "녹각 방벽", "ground", 230, 190, 1.3],
      ["thorn", "가시 도약", "impact", 150, 145, 0.6],
    ]),
    ...group("mage", [
      ["mage-0", "잎빛 탄환", "impact", 110, 110, 0.5],
      ["mage-1", "달이슬 폭발", "ground", 210, 180, 0.8],
      ["mage-2", "가지 속박", "ground", 210, 175, 1.1],
      ["moon", "월륜 관통", "beam", 110, 250, 0.85],
      ["bloom", "연쇄 개화", "ground", 250, 180, 1.3],
    ]),
    ...group("ranger", [
      ["ranger-0", "깃끝 사격", "line", 160, 75, 0.45],
      ["ranger-1", "화살비", "rain", 250, 260, 1.2],
      ["ranger-2", "추적 표식", "impact", 110, 110, 0.9],
      ["hawk", "수관 너머의 화살", "line", 210, 95, 0.65],
      ["mist", "안개걸음", "ground", 260, 150, 0.85],
    ]),
    ...group("herbalist", [
      ["herbalist-0", "꽃숨 회복", "ground", 180, 145, 0.95],
      ["herbalist-1", "쓴잎 탄", "impact", 110, 120, 0.6],
      ["herbalist-2", "풀내음 장판", "field", 230, 155, 7],
      ["flower", "봄비 정원", "ground", 250, 230, 1.6],
      ["venom", "독꽃 반응", "ground", 240, 200, 0.95],
    ]),
    ...Object.entries(EXTRA_SKILLS).flatMap(([classId, skills]) =>
      skills.map((s, n) => ({
        key: classId + "-" + (n + 4),
        name: s.name,
        classId,
        slot: n + 4,
        row: n,
        atlas: "expanded",
        mode:
          s.shape === "line" ? "line" : s.mode === "self" ? "self" : "ground",
        width: n === 0 ? 220 : 155,
        height: n === 0 ? 170 : 145,
        duration: n === 0 ? (classId === "mage" ? 1.5 : 1.05) : 0.85,
      })),
    ),
  ].map((v) => [v.key, v]),
);
export const skillVisual = (p, slot) =>
  SKILL_VISUALS[slot === 3 ? p.branch : p.classId + "-" + slot];
