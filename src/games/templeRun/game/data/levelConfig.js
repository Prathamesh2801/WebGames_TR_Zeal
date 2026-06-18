import { GAME } from '../constants';

/**
 * Data-driven level settings. v1 ships a single level; later levels are
 * added as objects here and selected by id (clean extension point — spec §6).
 * Any field omitted falls back to the GAME defaults in config.js.
 */
export const LEVELS = {
  udaipur: {
    id: 'udaipur',
    name: 'City Palace Run',
    themeColor: 0x1e1b3a, // road base tint
    accentColor: 0xffc44d, // lane lines / accents
    startSpeed: GAME.START_SPEED,
    maxSpeed: GAME.MAX_SPEED,
    speedRamp: GAME.SPEED_RAMP,
    spawnInterval: GAME.SPAWN_INTERVAL,
    coinChance: 0.55, // probability a spawned row is a coin vs obstacle
  },
};

export const DEFAULT_LEVEL = 'udaipur';

export function getLevel(id = DEFAULT_LEVEL) {
  return LEVELS[id] ?? LEVELS[DEFAULT_LEVEL];
}
