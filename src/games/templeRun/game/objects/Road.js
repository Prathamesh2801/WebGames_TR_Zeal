import { GAME } from "../constants";

/**
 * Code-drawn perspective road (replaces the old flat vertical-divider tile).
 *
 * The ground is a trapezoid: narrow at the far vanishing point (top) and wide
 * at the player row (bottom). Lane dividers and side rails converge to the
 * vanishing point, and dashed center lines scroll toward the camera to convey
 * speed. This matches the object convergence/scaling in Lane.js, so the scene
 * reads as 2.5D instead of top-down.
 */
export class Road {
  /**
   * @param {Phaser.Scene} scene
   * @param {object} [opts]
   * @param {boolean} [opts.overlay=false] Calibration mode: skip the opaque
   *   ground fill and render bright lane guides ABOVE the video (depth 40, just
   *   under the obstacles at 50) so the code lanes can be eyeballed against the
   *   road painted into the backdrop.
   */
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.lane = scene.lane;
    this.overlay = !!opts.overlay;
    this.g = scene.add.graphics().setDepth(this.overlay ? 40 : 1);
    this.phase = 0; // 0..1 scroll position of the dashes
  }

  /** Advance the dash scroll by `movePx` of near-row motion. */
  scroll(movePx) {
    const span = this.lane.nearY - this.lane.farY;
    this.phase = (this.phase + movePx / span) % 1;
  }

  /** x of an edge/divider whose near-row position is `nearX`, at depth t. */
  edgeX(nearX, t) {
    const farX =
      this.lane.centerX +
      (nearX - this.lane.centerX) * GAME.ROAD_HORIZON_SPREAD;

    return farX + (nearX - farX) * t;
  }

  /** Fill a perspective trapezoid strip between two near-row x edges. */
  fillBand(nearXL, nearXR, color, alpha = 1) {
    const g = this.g;
    const yFar = this.lane.yAt(0);
    const yNear = this.lane.yAt(1);
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(this.edgeX(nearXL, 0), yFar);
    g.lineTo(this.edgeX(nearXR, 0), yFar);
    g.lineTo(this.edgeX(nearXR, 1), yNear);
    g.lineTo(this.edgeX(nearXL, 1), yNear);
    g.closePath();
    g.fillPath();
  }

  /** A little clump of dry-grass blades at (x,y), sized by scale s. */
  drawTuft(x, y, s) {
    const g = this.g;
    const h = 11 * s;
    const w = 2.6 * s;
    g.fillStyle(0x6f7a3a, 1); // shadowed blades
    g.fillTriangle(x - 3 * w, y, x - 4.4 * w, y - h * 0.7, x - w, y);
    g.fillTriangle(x + 3 * w, y, x + 4.4 * w, y - h * 0.7, x + w, y);
    g.fillStyle(0x8c9a48, 1); // lit center blades
    g.fillTriangle(x, y, x - w, y - h, x + w, y);
    g.fillTriangle(x - 2 * w, y, x - 3 * w, y - h * 0.85, x, y);
    g.fillTriangle(x + 2 * w, y, x + 3 * w, y - h * 0.85, x, y);
  }

  draw() {
    const lane = this.lane;
    const g = this.g;
    g.clear();

    const spacing = lane.nearX[1] - lane.nearX[0]; // near lane spacing
    const margin = spacing * GAME.ROAD_RAIL_MARGIN; // rail offset past outer lanes
    const leftNear = lane.nearX[0] - margin;
    const rightNear = lane.nearX[lane.nearX.length - 1] + margin;

    // Calibration mode: skip the ground fill and draw bright lane guides ABOVE
    // the video so the code lanes can be eyeballed against the painted road.
    if (this.overlay) {
      const colors = [0x00e5ff, 0x39ff14, 0xff2d95]; // L / center / R
      const STEPS = 24;
      for (let li = 0; li < lane.nearX.length; li++) {
        g.lineStyle(2, colors[li % colors.length], 0.9);
        g.beginPath();
        g.moveTo(lane.xAt(li, 0), lane.yAt(0));
        for (let i = 1; i <= STEPS; i++) {
          const t = i / STEPS;
          g.lineTo(lane.xAt(li, t), lane.yAt(t));
        }
        g.strokePath();
      }
      return;
    }

    // Dry-grass verges flanking the path, then the worn-earth path on top.
    const vergeW = spacing * 0.7;
    this.fillBand(leftNear - vergeW, leftNear, 0x83904a); // left grass
    this.fillBand(rightNear, rightNear + vergeW, 0x83904a); // right grass
    this.fillBand(leftNear, rightNear, 0x9c8763); // worn-earth path

    // Natural lane dividers: two lines of dry-grass tufts marching toward the
    // camera (also the speed cue — they grow + speed up with depth).
    const dividers = [];
    for (let i = 0; i < lane.nearX.length - 1; i++) {
      dividers.push((lane.nearX[i] + lane.nearX[i + 1]) / 2);
    }
    const TUFTS = 7;
    for (const nx of dividers) {
      for (let i = 0; i < TUFTS; i++) {
        const t = (i / TUFTS + this.phase) % 1; // 0 far → 1 near
        this.drawTuft(this.edgeX(nx, t), lane.yAt(t), 0.5 + 2.3 * t);
      }
    }
  }
}
