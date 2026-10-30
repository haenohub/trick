// Temporary playtest bonuses; base content stays intact for a normal release.
export const TEST_BALANCE = Object.freeze({
  speed: 2.5,
  experience: 10,
  drops: 1,
});
export const CURRENCY_NAME = "리프";
export const PICKUP_RANGE = 24;
export const NEARBY_PICKUP_RANGE = 3;
export const PICKUP_DURATION = 0.6;
export const PICKUP_INTERVAL = 0.2;
export const xpReward = (amount) =>
  Math.max(0, Math.floor(Number(amount) || 0)) * TEST_BALANCE.experience;
export const dropChance = (chance) =>
  Math.min(1, Math.max(0, Number(chance) || 0) * TEST_BALANCE.drops);

export const PLAYER_DAMAGE_SCALE = 0.5;
