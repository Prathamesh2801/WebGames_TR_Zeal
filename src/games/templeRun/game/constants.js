/**
 * Dependency-free game constants (spec §11). Kept in their own module so the
 * config → scenes → levelConfig import chain never has to wait on config.js to
 * finish initializing (avoids a circular-import TDZ on GAME). Keep ALL magic
 * numbers here — scenes/objects read from GAME, never hardcode.
 */
export const GAME = {
  BASE_WIDTH: 450,
  BASE_HEIGHT: 800,
  MAX_PLAY_WIDTH: 520, // cap the road column on wide/desktop screens
  LANES_X: [0.25, 0.5, 0.75], // fraction of the play column (near edge)
  PLAYER_Y: 0.8, // fraction of height
  SPAWN_Y: 0.1, // far point (fraction of height)
  SCALE_FAR: 0.5,
  SCALE_NEAR: 1.0,
  START_SPEED: 320, // px/sec at start
  MAX_SPEED: 620,
  SPEED_RAMP: 6, // px/sec added per second of play
  SPAWN_INTERVAL: 950, // ms between spawns
  LANE_SWITCH_MS: 150,
  COIN_POINTS: 10,
  POOL_OBSTACLES: 12,
  POOL_COINS: 16,
  SCORE_TICK_MS: 100, // throttled score timer
  MAX_DPR: 2, // cap device pixel ratio
  SWIPE_THRESHOLD: 30, // px before a horizontal swipe registers
};

/**
 * Texture keys generated at runtime in BootScene (spec §9).
 */
export const TEXTURES = {
  PLAYER: 'player',
  OBSTACLE: 'obstacle',
  COIN: 'coin',
  ROAD: 'road',
  PARALLAX: 'parallax',
};
