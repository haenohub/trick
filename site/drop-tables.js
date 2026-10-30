// Stable species-specific shuffled tables: a reload never rerolls the codex.
export const DROP_RATES = Object.freeze({
  material: 0.1,
  trophy: 0.6,
  equipment: 0.4,
  consumable: 0.05,
});
export function assignDropTables(monsters, items) {
  const gear = Object.values(items).filter((i) => i.progressionEquipment),
    potions = Object.values(items).filter(
      (i) => i.type === "consumable" && !i.craftOnly,
    ),
    materials = Object.values(items).filter(
      (i) => i.type === "material" && i.dropSpecies,
    ),
    coverage = new Map(potions.map((i) => [i.id, 0]));
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
    const existing = m.drops.filter(
      (d) =>
        items[d.item]?.type === "trophy" ||
        (items[d.item]?.type === "material" && !items[d.item].dropSpecies),
    );
    const eligible = potions.filter((i) => (i.level || 1) <= m.level);
    eligible.sort(
      (a, b) =>
        Number(b.dropSpecies?.includes(m.id) || false) -
          Number(a.dropSpecies?.includes(m.id) || false) ||
        coverage.get(a.id) - coverage.get(b.id) ||
        Math.abs(m.level - (a.level || 1)) -
          Math.abs(m.level - (b.level || 1)) ||
        a.id.localeCompare(b.id),
    );
    const chosen = eligible.slice(0, 2);
    for (const i of chosen) coverage.set(i.id, coverage.get(i.id) + 1);
    const selected = [
      ...existing,
      ...materials
        .filter((i) => i.dropSpecies.includes(m.id))
        .map((i) => ({ item: i.id, min: 1, max: 1 })),
      ...pool
        .slice(0, 4 + (m.index % 3))
        .map((i) => ({ item: i.id, min: 1, max: 1 })),
      ...chosen.map((i) => ({
        item: i.id,
        min: 1,
        max: 1,
      })),
    ];
    m.drops = selected.map((d) => ({
      ...d,
      chance: DROP_RATES[items[d.item].type],
    }));
  }
  // Keep every ordinary recipe reward obtainable, even where three recipes
  // share the same highest-level species. Preserve two consumable slots.
  for (const i of potions.filter((i) => !coverage.get(i.id))) {
    const host = monsters.find(
      (m) =>
        (i.level || 1) <= m.level &&
        (!i.dropSpecies?.length || i.dropSpecies.includes(m.id)) &&
        m.drops.some((d) => coverage.get(d.item) > 1),
    );
    if (!host) throw Error(`No level-appropriate loot slot for ${i.id}`);
    const slot = host.drops.find((d) => coverage.get(d.item) > 1);
    coverage.set(slot.item, coverage.get(slot.item) - 1);
    slot.item = i.id;
    coverage.set(i.id, 1);
  }
}
