// Stable species-specific shuffled tables: a reload never rerolls the codex.
export const DROP_RATES = Object.freeze({
  material: 0.1,
  trophy: 0.6,
  equipment: 0.4,
  consumable: 0.05,
});
export function assignDropTables(monsters, items) {
  const gear = Object.values(items).filter((i) => i.progressionEquipment),
    potions = Object.values(items).filter((i) => i.type === "consumable");
  for (const m of monsters) {
    let seed = 7919 + m.index * 104729;
    const rng = () =>
      (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const rank = Math.min(30, Math.floor(m.level / 5) * 5),
      pool = gear.filter(
        (i) => i.level === rank || i.level === Math.min(30, rank + 5),
      );
    for (let n = pool.length - 1; n > 0; n--) {
      const j = Math.floor(rng() * (n + 1));
      [pool[n], pool[j]] = [pool[j], pool[n]];
    }
    const existing = m.drops.filter((d) =>
      ["trophy", "material"].includes(items[d.item]?.type),
    );
    const selected = [
      ...existing,
      ...pool
        .slice(0, 4 + (m.index % 3))
        .map((i) => ({ item: i.id, min: 1, max: 1 })),
      ...[0, 1].map((n) => ({
        item: potions[(m.index * 7 + n * 5) % potions.length].id,
        min: 1,
        max: 1,
      })),
    ];
    m.drops = selected.map((d) => ({
      ...d,
      chance: DROP_RATES[items[d.item].type],
    }));
  }
}
