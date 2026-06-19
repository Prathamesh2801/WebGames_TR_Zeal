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

  draw() {
    const lane = this.lane;
    const g = this.g;
    g.clear();

    const spacing = lane.nearX[1] - lane.nearX[0]; // near lane spacing
    const margin = spacing * GAME.ROAD_RAIL_MARGIN; // rail offset past outer lanes
    const leftNear = lane.nearX[0] - margin;
    const rightNear = lane.nearX[lane.nearX.length - 1] + margin;
    const yFar = lane.yAt(0);
    const yNear = lane.yAt(1);

    // Ground trapezoid. In overlay (calibration) mode this is skipped so the
    // road painted into the video shows through for comparison.
    if (!this.overlay) {
      g.fillStyle(0x241f47, 1);
      g.beginPath();
      g.moveTo(this.edgeX(leftNear, 0), yFar);
      g.lineTo(this.edgeX(rightNear, 0), yFar);
      g.lineTo(this.edgeX(rightNear, 1), yNear);
      g.lineTo(this.edgeX(leftNear, 1), yNear);
      g.closePath();
      g.fillPath();
    } else {
      // Calibration guides: a solid bright center line per lane from the far
      // vanishing point to the player row, so the 3 code lanes are visible
      // against the video's painted road. Edit GAME.LANES_X / SPAWN_Y /
      // ROAD_HORIZON_SPREAD until these track the painted lanes.
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
    }

    // Side rails (converging to the vanishing point).
    g.lineStyle(6, 0x4338ca, this.overlay ? 0.7 : 0.9);
    g.lineBetween(
      this.edgeX(leftNear, 0),
      yFar,
      this.edgeX(leftNear, 1),
      yNear,
    );
    g.lineBetween(
      this.edgeX(rightNear, 0),
      yFar,
      this.edgeX(rightNear, 1),
      yNear,
    );

    // Dashed lane dividers between each pair of lanes.
    const dividers = [];
    for (let i = 0; i < lane.nearX.length - 1; i++) {
      dividers.push((lane.nearX[i] + lane.nearX[i + 1]) / 2);
    }
    const DASHES = 8;
    for (const nx of dividers) {
      for (let i = 0; i < DASHES; i++) {
        const t = (i / DASHES + this.phase) % 1; // 0 far → 1 near
        const t2 = Math.min(1, t + 0.55 / DASHES);
        // Far dashes are thin + faint; near dashes thick + bright (depth cue).
        g.lineStyle(2 + 6 * t, 0xffc44d, 0.15 + 0.55 * t);
        g.lineBetween(
          this.edgeX(nx, t),
          lane.yAt(t),
          this.edgeX(nx, t2),
          lane.yAt(t2),
        );
      }
    }
  }
}
