import { GAME } from '../constants';

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
    this.nearY = height * GAME.PLAYER_Y;
    // Cap the play column on wide screens so the road stays a centered lane
    // strip (not a full-width triangle); the sky still fills the whole canvas.
    const playW = Math.min(width, GAME.MAX_PLAY_WIDTH);
    const offsetX = (width - playW) / 2;
    // True (near) lane x positions in pixels, within the centered column.
    this.nearX = GAME.LANES_X.map((f) => offsetX + f * playW);
    this.centerX = offsetX + playW * 0.5;
  }

  get count() {
    return GAME.LANES_X.length;
  }

  /** Near-row x for a lane index (where the player sits). */
  laneX(lane) {
    return this.nearX[lane];
  }

  /** Player row y (constant). */
  get playerY() {
    return this.nearY;
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
    // At t=0 (far) lanes sit closer to center; at t=1 they're at trueX.
    return Phaser_lerp(this.centerX, trueX, t);
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
