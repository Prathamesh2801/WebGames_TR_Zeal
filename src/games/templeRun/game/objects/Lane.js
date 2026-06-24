import { GAME } from "../constants";

/**
 * Lane geometry + perspective helpers.
 *
 * Depth is a normalized value t: 0 = far (vanishing point, top) → 1 = near
 * (player row, bottom). As items approach (t: 0→1) they move down the screen,
 * spread out toward their true lane x, and scale up — faking 2.5D depth.
 */
export class Lane {
  constructor(scene) {
    this.scene = scene;
    this.recompute();
  }

  /** Recompute cached pixel positions; call on resize. */
  recompute() {
    const { width, height } = this.scene.scale.gameSize;
    this.width = width;
    this.height = height;
    this.farY = height * GAME.SPAWN_Y;
    this.playerYPos = height * GAME.PLAYER_Y;
    this.nearY = height * GAME.ROAD_BOTTOM_Y;
    // Cap the play column on wide screens so the road stays a centered lane
    // strip (not a full-width triangle); the sky still fills the whole canvas.
    const playW = Math.min(width, GAME.MAX_PLAY_WIDTH);
    this.playW = playW;
    const offsetX = (width - playW) / 2;
    // True (near) lane x positions in pixels, within the centered column.
    this.nearX = GAME.LANES_X.map((f) => offsetX + f * playW);
    this.centerX = offsetX + playW * 0.5;
  }

  get count() {
    return GAME.LANES_X.length;
  }

  /** Near-row (screen-bottom, t=1) x for a lane index. */
  laneX(lane) {
    return this.nearX[lane];
  }

  /** Player row y (constant). */
  get playerY() {
    return this.playerYPos;
  }

  /** Depth t at the player's (constant) row. */
  get playerDepth() {
    return this.depthAt(this.playerYPos);
  }

  /**
   * Perspective x for a lane AT the player's row. The player stands above the
   * screen bottom (PLAYER_Y < ROAD_BOTTOM_Y), so it must ride the lane where the
   * line actually is at that height — not the fully-spread near-row x. Obstacles
   * already do this per-frame via xAt(lane, depthAt(y)); this matches them.
   */
  playerX(lane) {
    return this.xAt(lane, this.playerDepth);
  }

  /** y position on screen for a given depth t (0 far → 1 near). */
  yAt(t) {
    return Phaser_lerp(this.farY, this.nearY, t);
  }

  /** Normalized depth t for a given screen y. */
  depthAt(y) {
    return (y - this.farY) / (this.nearY - this.farY);
  }

  /** Perspective x for a lane at depth t: converges toward center when far. */
  xAt(lane, t) {
    const trueX = this.nearX[lane];

    const farSpread = GAME.ROAD_HORIZON_SPREAD;

    const farX = this.centerX + (trueX - this.centerX) * farSpread;

    return Phaser_lerp(farX, trueX, t);
  }

  /**
   * Perspective x for a road-side prop (haveli) at depth t. side: -1 left, +1
   * right. The prop's inner edge rides the road's diagonal shoulder — converging
   * to the vanishing point when far, spreading to the road edge when near — so
   * buildings fill the empty triangles beside the road as they stream past.
   */
  sideX(side, t) {
    const nearX = this.centerX + side * this.playW * GAME.HAVELI_INNER_X;
    const farX = this.centerX + (nearX - this.centerX) * GAME.ROAD_HORIZON_SPREAD;
    return Phaser_lerp(farX, nearX, t);
  }

  /** Scale for an item at depth t (SCALE_FAR → SCALE_NEAR). */
  scaleAt(t) {
    return Phaser_lerp(GAME.SCALE_FAR, GAME.SCALE_NEAR, t);
  }
}

// Small local lerp to avoid pulling Phaser.Math just for this.
function Phaser_lerp(a, b, t) {
  return a + (b - a) * t;
}
