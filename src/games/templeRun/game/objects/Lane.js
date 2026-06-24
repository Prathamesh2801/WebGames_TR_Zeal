import { GAME } from "../constants";

/**
 * Lane geometry + perspective helpers.
 *
 * The road is a trapezoid calibrated from the backdrop frame (GAME.ROAD): a
 * single vanishing point at the horizon and the near road edges at the bottom.
 * All values are fractions of the SOURCE video frame and are mapped to screen
 * pixels through the EXACT same cover-fit the backdrop uses (same source
 * dimensions, same max() scale, centered) — so the lanes, player, obstacles and
 * coins stay locked to the filmed path on any screen aspect.
 *
 * Depth is a normalized value t: 0 = far (vanishing point, top) → 1 = near
 * (player/bottom row). As items approach (t: 0→1) they move down the screen,
 * fan out from the vanishing column toward their true lane x, and scale up.
 */
export class Lane {
  constructor(scene) {
    this.scene = scene;
    // Source frame size for the cover-fit. Defaults to the known video size;
    // RunScene calls setSource() with the live video/image dimensions once they
    // decode so this transform matches the rendered backdrop byte-for-byte.
    this.srcW = GAME.VIDEO_SRC_W;
    this.srcH = GAME.VIDEO_SRC_H;
    this.recompute();
  }

  /**
   * Update the cover-fit source size to the live backdrop's. Returns true and
   * recomputes if the size actually changed (so callers can skip redundant
   * redraws). Falls back to the known video size when given nothing.
   */
  setSource(w, h) {
    const nw = w || GAME.VIDEO_SRC_W;
    const nh = h || GAME.VIDEO_SRC_H;
    if (nw === this.srcW && nh === this.srcH) return false;
    this.srcW = nw;
    this.srcH = nh;
    this.recompute();
    return true;
  }

  /** Recompute cached pixel positions; call on resize. */
  recompute() {
    const { width, height } = this.scene.scale.gameSize;
    this.width = width;
    this.height = height;
    // Cover-fit: scale the source frame to fill the canvas, centered, overflow
    // cropped — identical to RunScene.fitBackground. dispW/dispH are its
    // on-screen size; video fractions map through this so they track the frame.
    const scale = Math.max(width / this.srcW, height / this.srcH);
    this.dispW = this.srcW * scale;
    this.dispH = this.srcH * scale;

    const R = GAME.ROAD;
    // Vanishing point + near road edges, in screen pixels.
    this.vanishX = this.vidToScreenX(R.VANISH_X);
    this.farY = this.vidToScreenY(R.VANISH_Y); // far row = the vanishing row
    this.nearY = this.vidToScreenY(R.NEAR_Y);
    this.playerYPos = this.vidToScreenY(GAME.PLAYER_Y);
    // Near-row lane centers, evenly spaced across the road width.
    const nearL = this.vidToScreenX(R.NEAR_LEFT);
    const nearR = this.vidToScreenX(R.NEAR_RIGHT);
    const n = R.LANES;
    this.nearX = [];
    for (let i = 0; i < n; i++) {
      this.nearX.push(nearL + ((i + 0.5) / n) * (nearR - nearL));
    }
    this.centerX = this.vanishX; // the road's vanishing-point column
  }

  /** Map a video-width fraction (0..1) to a screen x under the cover-fit. */
  vidToScreenX(fx) {
    return this.width / 2 + (fx - 0.5) * this.dispW;
  }

  /** Map a video-height fraction (0..1) to a screen y under the cover-fit. */
  vidToScreenY(fy) {
    return this.height / 2 + (fy - 0.5) * this.dispH;
  }

  get count() {
    return GAME.ROAD.LANES;
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
   * screen bottom (PLAYER_Y < NEAR_Y), so it must ride the lane where the line
   * actually is at that height — not the fully-spread near-row x. Obstacles
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

  /**
   * Perspective x for a lane at depth t. Every lane lerps from the shared
   * vanishing column (t=0) out to its near-row center (t=1), so the lanes form
   * the road's trapezoid and converge to a single point at the horizon.
   */
  xAt(lane, t) {
    return Phaser_lerp(this.vanishX, this.nearX[lane], t);
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
