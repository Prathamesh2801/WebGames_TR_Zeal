/**
 * Dependency-free game constants (spec §11). Kept in their own module so the
 * config → scenes → levelConfig import chain never has to wait on config.js to
 * finish initializing (avoids a circular-import TDZ on GAME). Keep ALL magic
 * numbers here — scenes/objects read from GAME, never hardcode.
 */
export const GAME = {
  BASE_WIDTH: 650,
  BASE_HEIGHT: 800,
  MAX_PLAY_WIDTH: 650, // cap the road column on wide/desktop screens
  // --- Painted-road geometry (Path A) -------------------------------------
  // These map gameplay lanes onto the road baked into parallax.jpeg. Tuned by
  // eye against the painting; tweak freely while polishing the art fit.
  // Calibration overlay: bright lane guides drawn over the video so the code
  // lanes can be eyeballed against the painted road. Set false to hide them.
  DEBUG_LANES: false,
  // Equal-width lanes spanning the painted road. With ROAD_RAIL_MARGIN 0.5 the
  // side rails sit exactly half a lane-spacing outside the outer lanes, so all
  // three lanes (and the two shoulders) come out the same width. These values
  // place the rails at the same painted dirt edges as the old [0.32,0.5,0.68] +
  // margin 2 setup, just split into three even lanes.
  LANES_X: [0.14, 0.5, 0.86], // near (bottom) lane centers, fraction of width
  PLAYER_Y: 0.86,
  ROAD_BOTTOM_Y: 1.0, // near row, fraction of height (road meets bottom edge)
  ROAD_HORIZON_SPREAD: 0.06, // how wide the lanes still are at the vanishing pt
  // How far outside the outer lanes the purple side rails sit, in multiples of
  // one near lane-spacing. 0.5 keeps all lanes equal width; increase only if you
  // want wider shoulders than lanes (which makes the lanes look uneven).
  ROAD_RAIL_MARGIN: 0.3,
  SPAWN_Y: 0.36, // far point = painted vanishing point (~40% down the image)
  // How close (0..1, relative to the player's row) an in-lane obstacle must get
  // before it counts as a hit. 1 = must be right on the player's row; lower
  // widens the kill window above/below the player. Measured against PLAYER_Y so
  // it stays correct regardless of SPAWN_Y / PLAYER_Y.
  COLLIDE_NEAR_T: 0.9,
  SCALE_FAR: 0.3, // items are this fraction of full size at the vanishing point
  SCALE_NEAR: 1.0,
  // Constant cruise speed locked to the looping video backdrop (Path A). Ramp
  // is disabled so the road + obstacles stay in perfect sync with the clip.
  // CALIBRATE: nudge START_SPEED until obstacles track the video's road (a
  // dropped item should slide with the painted lane dashes, not faster/slower).
  START_SPEED: 210, // px/sec — the single cruise speed (lowered to match video)
  MAX_SPEED: 210, // == START_SPEED (no ramp)
  SPEED_RAMP: 0, // px/sec added per second — 0 keeps it constant
  BG_PLAYBACK_RATE: 1.5, // speed up the looping video to match obstacle motion
  SPAWN_INTERVAL: 950, // ms between spawns
  LANE_SWITCH_MS: 150,
  PLAYER_DISPLAY_H: 165, // on-screen height (px) of the standing character at
  // full (near) scale; every player sheet is scaled to this so idle/run/dead
  // read as one consistent size despite different native frame sizes.
  OBSTACLE_DISPLAY_W: 150, // near (full-scale) on-screen width; every obstacle
  // sheet is normalized to this so the differently-sized art reads one size.
  COIN_DISPLAY_W: 70, // near (full-scale) on-screen width of a coin
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
  PLAYER: "player", // generated placeholder fallback (single frame)
  PLAYER_IDLE: "player_idle", // 256×512 sheet, 8 frames
  PLAYER_RUN: "player_run", // 512×682 sheet, 12 frames
  PLAYER_DEAD: "player_dead", // 341×341 sheet, 9 frames
  OBSTACLE: "obstacle", // generated placeholder + pool default
  OBSTACLE_1: "obstacle_1",
  OBSTACLE_2: "obstacle_2",
  OBSTACLE_3: "obstacle_3",
  COIN: "coin",
  ROAD: "road",
  PARALLAX: "parallax", // static JPEG fallback for the backdrop
  BG_VIDEO: "bgVideo", // looping webm backdrop (Path A primary)
};

/**
 * Obstacle art variants spawned at random (BootScene loads each; spawn picks
 * one per obstacle). Falls back to the generated placeholder if none loaded.
 */
export const OBSTACLE_VARIANTS = [
  TEXTURES.OBSTACLE_1,
  TEXTURES.OBSTACLE_2,
  TEXTURES.OBSTACLE_3,
];

/**
 * Animation keys created in BootScene from the player sheets above.
 */
export const ANIMS = {
  IDLE: "player-idle",
  RUN: "player-run",
  DEAD: "player-dead",
  COIN: "coin-spin",
};
