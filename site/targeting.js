// One shared targeting contract for cursor previews and authoritative placement.
export function combatAim(p, slot = null) {
  const range =
    p.stats?.range ||
    { warden: 1.9, ranger: 7.5, mage: 6, herbalist: 6 }[p.classId] ||
    6;
  if (slot === null) return { mode: "enemy", range, radius: 0 };
  if (p.classId === "warden" && slot === 0)
    return {
      mode: "ground",
      shape: "line",
      length: 3.6,
      range: 3.6,
      radius: 0.75,
    };
  if (p.classId === "warden" && slot === 1)
    return { mode: "self", range: 0, radius: 0 };
  if (p.classId === "warden" && slot === 2)
    return { mode: "ground", range: 6, radius: 3 };
  if (p.classId === "mage" && slot === 1)
    return {
      mode: "ground",
      range: 8,
      radius: 2.5 + (p.spellCharge || 0) * 0.3,
    };
  if (p.classId === "mage" && slot === 2)
    return { mode: "ground", range: 8, radius: 3 };
  if (p.classId === "ranger" && slot === 1)
    return { mode: "ground", shape: "line", length: 3, range: 5, radius: 0.4 };
  if (p.classId === "herbalist" && slot === 0)
    return { mode: "ground", range: 6, radius: 4 };
  if (p.classId === "herbalist" && slot === 2)
    return { mode: "ground", range: 8, radius: 3 };
  if (slot === 3) {
    const r = { antler: 3, bloom: 4, mist: 5, flower: 4, venom: 3.5 }[p.branch];
    if (r) return { mode: "ground", range: 8, radius: r };
  }
  return {
    mode: "enemy",
    range: slot === 3 && p.branch === "hawk" ? 11 : range + 2,
    radius: 0,
  };
}
