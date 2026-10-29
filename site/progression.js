// Shared by authoritative combat, equipment checks and all item descriptions.
export const ATTRIBUTE_NAMES = {
  strength: "근력",
  dexterity: "민첩",
  intelligence: "지능",
  vitality: "체력",
  spirit: "정신",
  luck: "행운",
};
export const STAT_NAMES = {
  attack: "공격력",
  magicPower: "마력",
  defense: "방어력",
  magicDefense: "마법 방어력",
  accuracy: "명중",
  evasion: "회피율",
  critChance: "치명타 확률",
  critDamage: "치명타 피해",
  maxHp: "최대 체력",
};
export const PERCENT_STATS = ["evasion", "critChance", "critDamage"];
export const GROWTH = {
  warden: { base: [12, 7, 4, 12, 6, 5], perLevel: [3, 1, 1, 3, 1, 1] },
  mage: { base: [4, 6, 14, 7, 12, 5], perLevel: [1, 1, 3, 2, 3, 1] },
  ranger: { base: [8, 14, 5, 8, 6, 8], perLevel: [2, 3, 1, 2, 1, 2] },
  herbalist: { base: [5, 8, 11, 9, 13, 6], perLevel: [1, 2, 2, 2, 3, 1] },
};
const keys = Object.keys(ATTRIBUTE_NAMES),
  cap = (n, a, b) => Math.max(a, Math.min(b, n));
export function legacyAttributes(p) {
  const g = GROWTH[p.classId] || GROWTH.warden,
    level = cap(Math.floor(Number(p.level) || 1), 1, 80);
  const out = Object.fromEntries(
    keys.map((k, i) => [k, g.base[i] + g.perLevel[i] * (level - 1)]),
  );
  const extra = Math.max(0, level - 24),
    bonus = {
      antler: { vitality: 2 },
      thorn: { strength: 2 },
      moon: { intelligence: 2 },
      bloom: { intelligence: 1, spirit: 1 },
      hawk: { dexterity: 2 },
      mist: { dexterity: 1, luck: 1 },
      flower: { spirit: 2 },
      venom: { intelligence: 1, luck: 1 },
    }[p.branch];
  for (const [k, n] of Object.entries(bonus || {})) out[k] += extra * n;
  return out;
}
export const POINTS_PER_LEVEL = 12;
export function earnedPoints(p) {
  return (
    Math.max(0, Math.min(80, Math.floor(Number(p.level) || 1)) - 1) *
      POINTS_PER_LEVEL +
    (p.branch ? Math.max(0, Math.min(80, p.level) - 24) * 2 : 0)
  );
}
export function allocatedPoints(p) {
  return Object.fromEntries(
    keys.map((k) => [
      k,
      Number.isSafeInteger(p.allocated?.[k]) && p.allocated[k] >= 0
        ? p.allocated[k]
        : 0,
    ]),
  );
}
export function unspentPoints(p) {
  return Math.max(
    0,
    earnedPoints(p) -
      Object.values(allocatedPoints(p)).reduce((a, b) => a + b, 0),
  );
}
export function normalizeAllocation(p, raw) {
  p.allocationVersion = 1;
  if (raw.allocationVersion !== 1) {
    const old = legacyAttributes(p),
      base = (GROWTH[p.classId] || GROWTH.warden).base;
    p.allocated = Object.fromEntries(keys.map((k, i) => [k, old[k] - base[i]]));
  } else p.allocated = allocatedPoints(raw);
  if (Object.values(p.allocated).reduce((a, b) => a + b, 0) > earnedPoints(p))
    p.allocated = Object.fromEntries(keys.map((k) => [k, 0]));
}
export function attributes(p) {
  if (p.allocationVersion !== 1) return legacyAttributes(p);
  const g = GROWTH[p.classId] || GROWTH.warden,
    a = allocatedPoints(p);
  return Object.fromEntries(keys.map((k, i) => [k, g.base[i] + a[k]]));
}
export function equipmentProfile(i) {
  if (i.progressionEquipment) {
    const n = i.level / 5,
      magic = ["mage", "herbalist"].includes(i.classId),
      weapon = i.slot === "weapon",
      armor = i.slot === "armor";
    const s = {
      attack: 0,
      magicPower: 0,
      defense: 0,
      magicDefense: 0,
      accuracy: 0,
      evasion: 0,
      critChance: 0,
      critDamage: 0,
      maxHp: 0,
      requirements: {},
    };
    if (weapon) {
      s.attack = magic ? 1 + n * 2 : 2 + n * 8;
      s.magicPower = magic ? 3 + n * 10 : 0;
      s.accuracy = 1 + n * 4;
      s.critChance = n * 0.006;
      s.critDamage = n * 0.025;
    }
    if (armor) {
      s.defense = 1 + n * (magic ? 3 : 4);
      s.magicDefense = 1 + n * (magic ? 5 : 2);
      s.maxHp = n * 15;
      if (magic) s.magicPower = n * 2;
    }
    if (i.slot === "head") {
      s.defense = n * 2;
      s.magicDefense = n * 2;
      s.accuracy = n;
    }
    if (i.slot === "boots") {
      s.defense = n;
      s.evasion = n * 0.009;
      s.accuracy = n * 2;
    }
    if (i.slot === "charm") {
      s.attack = n * 2;
      s.magicPower = n * 2;
      s.critChance = n * 0.009;
      s.critDamage = n * 0.025;
    }
    if (n) {
      const key = weapon
        ? magic
          ? "intelligence"
          : i.classId === "ranger"
            ? "dexterity"
            : "strength"
        : armor
          ? magic
            ? "spirit"
            : "vitality"
          : i.slot === "boots"
            ? "dexterity"
            : i.slot === "head"
              ? "intelligence"
              : "spirit";
      const expected = legacyAttributes({
        classId: i.classId || "warden",
        level: i.level,
      });
      s.requirements = {
        [key]: Math.floor(expected[key] * (weapon ? 0.6 : 0.45)),
      };
    }
    return s;
  }
  const t = i.tier || 1,
    high = t > 1,
    magic = ["mage", "herbalist"].includes(i.classId);
  const out = {
    attack: 0,
    magicPower: 0,
    defense: 0,
    magicDefense: 0,
    accuracy: 0,
    evasion: 0,
    critChance: 0,
    critDamage: 0,
    maxHp: 0,
  };
  let requirements = {};
  if (i.slot === "weapon") {
    out.attack = magic ? [3, 8, 13][t - 1] : [8, 34, 54][t - 1];
    out.magicPower = magic ? [14, 42, 64][t - 1] : 0;
    out.accuracy = [5, 14, 24][t - 1];
    out.critChance = [0.01, 0.025, 0.045][t - 1];
    out.critDamage = [0, 0.08, 0.18][t - 1];
    const key = magic
      ? "intelligence"
      : i.classId === "ranger"
        ? "dexterity"
        : "strength";
    const expected = legacyAttributes({ classId: i.classId, level: i.level });
    requirements = { [key]: Math.floor(expected[key] * 0.75) };
    if (t > 1)
      requirements[magic ? "spirit" : "vitality"] = Math.floor(
        expected[magic ? "spirit" : "vitality"] * 0.6,
      );
  } else if (i.slot === "armor") {
    out.defense = magic ? (high ? 14 : 4) : high ? 19 : 5;
    out.magicDefense = magic ? (high ? 23 : 6) : high ? 12 : 3;
    out.maxHp = high ? 70 : 15;
    if (magic) out.magicPower = high ? 10 : 3;
    if (i.classId === "ranger") out.evasion = high ? 0.04 : 0.015;
    const expected = legacyAttributes({ classId: i.classId, level: i.level });
    requirements = {
      [magic ? "spirit" : "vitality"]: Math.floor(
        expected[magic ? "spirit" : "vitality"] * 0.7,
      ),
    };
  } else if (i.slot === "head") {
    out.defense = high ? 7 : 2;
    out.magicDefense = high ? 8 : 2;
    out.accuracy = high ? 5 : 2;
    requirements = { intelligence: high ? 10 : 3 };
  } else if (i.slot === "boots") {
    out.defense = high ? 5 : 1;
    out.evasion = high ? 0.05 : 0.02;
    out.accuracy = high ? 8 : 3;
    requirements = { dexterity: high ? 14 : 5 };
  } else if (i.slot === "charm") {
    out.attack = high ? 11 : 3;
    out.magicPower = high ? 11 : 3;
    out.critChance = high ? 0.05 : 0.025;
    out.critDamage = high ? 0.12 : 0.05;
    requirements = { spirit: high ? 12 : 4 };
  }
  const special = {
    antlerweapon: { defense: 8, maxHp: 80, critChance: 0.03 },
    thornweapon: { attack: 58, critChance: 0.08, critDamage: 0.3 },
    moonweapon: {
      magicPower: 70,
      magicDefense: 8,
      critChance: 0.05,
      critDamage: 0.25,
    },
    bloomweapon: { magicPower: 62, accuracy: 28, critDamage: 0.2 },
    hawkweapon: { attack: 58, accuracy: 32, critChance: 0.1, critDamage: 0.3 },
    mistweapon: { attack: 54, evasion: 0.07, critChance: 0.08 },
    flowerweapon: { magicPower: 60, magicDefense: 14, maxHp: 80 },
    venomweapon: { magicPower: 66, critChance: 0.1, critDamage: 0.25 },
  }[i.id];
  return { ...out, ...special, requirements };
}
export function equipRequirements(p, item) {
  const a = attributes(p),
    checks = [
      {
        label: "레벨",
        required: item.level ?? 0,
        current: p.level,
        met: p.level >= (item.level ?? 0),
      },
    ];
  if (item.classId)
    checks.push({
      label: "직업",
      required: item.classId,
      current: p.classId,
      met: item.classId === p.classId,
    });
  if (item.branch)
    checks.push({
      label: "전직",
      required: item.branch,
      current: p.branch,
      met: item.branch === p.branch,
    });
  for (const [k, n] of Object.entries(item.requirements || {}))
    checks.push({
      key: k,
      label: ATTRIBUTE_NAMES[k],
      required: n,
      current: a[k] || 0,
      met: (a[k] || 0) >= n,
    });
  return checks;
}
export function canEquip(p, item) {
  return !!item?.slot && equipRequirements(p, item).every((c) => c.met);
}
export function derivedStats(p, gear = []) {
  const a = attributes(p),
    sum = (k) => gear.reduce((s, i) => s + (Number(i[k]) || 0), 0),
    level = cap(Math.floor(Number(p.level) || 1), 1, 80);
  const out = {
    attributes: a,
    maxHp: Math.round(140 + a.vitality * 12 + level * 9 + sum("maxHp")),
    maxFocus: 100,
    attack: Math.round(
      8 + a.strength * 1.6 + a.dexterity * 0.35 + level * 1.3 + sum("attack"),
    ),
    magicPower: Math.round(
      7 +
        a.intelligence * 1.9 +
        a.spirit * 0.45 +
        level * 1.2 +
        sum("magicPower"),
    ),
    defense: Math.round(
      a.vitality * 0.55 + a.strength * 0.15 + level * 0.3 + sum("defense"),
    ),
    magicDefense: Math.round(
      a.spirit * 0.55 +
        a.intelligence * 0.2 +
        level * 0.2 +
        sum("magicDefense"),
    ),
    accuracy: Math.round(
      80 + a.dexterity * 0.8 + level * 0.6 + sum("accuracy"),
    ),
    evasion: cap(
      0.02 + a.dexterity * 0.001 + a.luck * 0.0006 + sum("evasion"),
      0.01,
      0.45,
    ),
    critChance: cap(
      0.04 + a.luck * 0.002 + a.dexterity * 0.0004 + sum("critChance"),
      0.03,
      0.65,
    ),
    critDamage: cap(1.5 + a.luck * 0.003 + sum("critDamage"), 1.5, 3.5),
  };
  out.damageType = ["mage", "herbalist"].includes(p.classId)
    ? "magic"
    : "physical";
  out.power = out.damageType === "magic" ? out.magicPower : out.attack;
  return out;
}
export function monsterStats(def) {
  return {
    accuracy: 75 + def.level * 2,
    evasion: Math.min(
      0.22,
      0.015 +
        def.level * 0.0015 +
        (["fox", "rabbit", "bird", "bat"].includes(def.shape) ? 0.04 : 0),
    ),
    magicDefense: Math.round(def.defense * 0.75 + def.level * 0.15),
  };
}
export function hitChance(attacker, defender) {
  return cap(
    0.94 + (attacker.accuracy - defender.accuracy) * 0.0025 - defender.evasion,
    0.15,
    0.99,
  );
}
export function statValue(key, value, bonus = false) {
  return (
    (bonus ? "+" : "") +
    (PERCENT_STATS.includes(key)
      ? Math.round(value * 1000) / 10 + "%"
      : Math.round(value))
  );
}
