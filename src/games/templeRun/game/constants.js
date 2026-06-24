/**
 * Dependency-free game constants (spec §11). Kept in their own module so the
 * config → scenes → levelConfig import chain never has to wait on config.js to
 * finish initializing (avoids a circular-import TDZ on GAME). Keep ALL magic
 * numbers here — scenes/objects read from GAME, never hardcode.
 */
export const GAME = {
  BASE_WIDTH: 650,
  BASE_HEIGHT: 800,
  // Native pixel size of the backdrop video frame (temple_run_loop.webm). Used
  // as the fallback source size for the lane cover-fit transform before the
  // video's true dimensions are known; once the first frame decodes, Lane.js
  // reads the live dimensions so its transform is byte-identical to the
  // backdrop's (see RunScene.fitBackground / Lane.setSource).
  VIDEO_SRC_W: 720,
  VIDEO_SRC_H: 1280,
  // --- Painted-road geometry ----------------------------------------------
  // The road is modeled as a trapezoid calibrated from the actual backdrop
  // frame: a single vanishing point at the horizon (the sun) and the near road
  // edges where the path meets the bottom of the frame. Lanes are spaced evenly
  // across that trapezoid and ALL converge to the vanishing point, so the guides,
  // player, obstacles and coins ride the filmed path. Every value is a fraction
  // of the SOURCE video frame (0..1) and is mapped to screen px through the same
  // cover-fit as the backdrop, so the fit holds on any screen aspect.
  // Re-calibrate by toggling DEBUG_LANES and matching the guides to the path.
  ROAD: {
    VANISH_X: 0.545, // horizon convergence column (the sun)
    VANISH_Y: 0.335, // horizon row where the path narrows to a point
    NEAR_Y: 1.0, // road meets the bottom edge of the frame
    NEAR_LEFT: 0.1, // sandy path's left edge at the bottom row
    NEAR_RIGHT: 1.0, // sandy path's right edge at the bottom row
    LANES: 3, // number of evenly-spaced lanes across the path
  },
  // Calibration overlay: bright lane guides drawn over the video so the code
  // lanes can be eyeballed against the painted road. Set false to hide them.
  DEBUG_LANES: false,
  // Debug toggle: set false to suppress the killable obstacles while tuning the
  // background/scenery (the run then can't end on a hit). Coins still spawn.
  // Flip back to true to re-enable obstacle_1/2/3.
  SPAWN_OBSTACLES: true,
  PLAYER_Y: 0.86, // player's row as a fraction of the video frame height
  // How close (0..1, relative to the player's row) an in-lane obstacle must get
  // before it counts as a hit. 1 = must be right on the player's row; lower
  // widens the kill window above/below the player. Measured against PLAYER_Y so
  // it stays correct regardless of the vanishing point / PLAYER_Y.
  COLLIDE_NEAR_T: 0.9,
  // On-screen size of an item as a fraction of its full (near) size, lerped by
  // depth t (0 = vanishing point/horizon, 1 = near/bottom row). For a flat
  // ground plane, projected size ∝ distance below the horizon, so this is ~linear
  // in t and anchored near 0 at the vanishing point — items emerge as a speck at
  // the sun and grow to full size as they reach the player, matching the road's
  // perspective. (Was 0.3, which made far items "pop in" too large.)
  SCALE_FAR: 0.04, // tiny speck at the horizon (not 0, so it's never sub-pixel)
  SCALE_NEAR: 1.0,
  // Constant cruise speed locked to the looping video backdrop (Path A). Ramp
  // is disabled so the road + obstacles stay in perfect sync with the clip.
  // CALIBRATE: nudge START_SPEED until obstacles track the video's road (a
  // dropped item should slide with the painted lane dashes, not faster/slower).
  START_SPEED: 210, // px/sec — the single cruise speed (lowered to match video)
  MAX_SPEED: 210, // == START_SPEED (no ramp)
  SPEED_RAMP: 0, // px/sec added per second — 0 keeps it constant
  BG_PLAYBACK_RATE: 1.2, // speed up the looping video to match obstacle motion
  SPAWN_INTERVAL: 950, // ms between spawns
  // After the 3·2·1 countdown the player runs for this long with NO obstacles or
  // coins while animated swipe-right / swipe-left / swipe-up hints play, so the
  // player can learn the controls. Set to 0 to skip the tutorial entirely.
  TUTORIAL_MS: 5000,
  LANE_SWITCH_MS: 150,
  // --- Jump tuning ----------------------------------------------------------
  // JUMP_HEIGHT is how far (screen px) the player rises at the apex; bump it up
  // for a floatier hop. JUMP_DURATION is the total airtime (rise + fall) in ms
  // and also paces how long the player is invulnerable to obstacles. Keep the
  // jump sheet's anim (8 frames) roughly in sync with this — see BootScene fps.
  JUMP_HEIGHT: 135,
  JUMP_DURATION: 700,
  // The jump sheet draws the figure smaller within its cell than the idle/run
  // sheets (character ≈0.73 of the frame vs ≈0.88), so normalizing by frame
  // height alone leaves the jumping player visibly shrunken. This multiplies the
  // jump's scale so the body reads the same size as the run cycle. Re-tune if
  // the jump art changes (= idle-frame fill ÷ jump-frame fill).
  PLAYER_JUMP_SCALE: 1.2,
  PLAYER_DISPLAY_H: 165, // on-screen height (px) of the standing character at
  // full (near) scale; every player sheet is scaled to this so idle/run/dead
  // read as one consistent size despite different native frame sizes.
  OBSTACLE_DISPLAY_W: 100, // near (full-scale) on-screen width; every obstacle
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
  PLAYER_JUMP: "player_jump", // 256×512 sheet, 8 frames (4×2)
  PLAYER_DEAD: "player_dead", // 341×341 sheet, 9 frames
  OBSTACLE: "obstacle", // generated placeholder + pool default
  OBSTACLE_1: "obstacle_1",
  OBSTACLE_2: "obstacle_2",
  OBSTACLE_3: "obstacle_3",
  COIN: "coin",
  PARALLAX: "parallax", // static JPEG fallback for the backdrop
  BG_VIDEO: "bgVideo", // looping webm backdrop (the environment)
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
  JUMP: "player-jump",
  DEAD: "player-dead",
  COIN: "coin-spin",
};
