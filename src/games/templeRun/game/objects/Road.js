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
  constructor(scene) {
    this.scene = scene;
    this.lane = scene.lane;
    this.g = scene.add.graphics().setDepth(1);
    this.phase = 0; // 0..1 scroll position of the dashes
  }

  /** Advance the dash scroll by `movePx` of near-row motion. */
  scroll(movePx) {
    const span = this.lane.nearY - this.lane.farY;
    this.phase = (this.phase + movePx / span) % 1;
  }

  /** x of an edge/divider whose near-row position is `nearX`, at depth t. */
  edgeX(nearX, t) {
    return this.lane.centerX + (nearX - this.lane.centerX) * t;
  }

  draw() {
    const lane = this.lane;
    const g = this.g;
    g.clear();

    const spacing = lane.nearX[1] - lane.nearX[0]; // near lane spacing
    const leftNear = lane.nearX[0] - spacing / 2;
    const rightNear = lane.nearX[lane.nearX.length - 1] + spacing / 2;
    const yFar = lane.yAt(0);
    const yNear = lane.yAt(1);

    // Ground trapezoid.
    g.fillStyle(0x241f47, 1);
    g.beginPath();
    g.moveTo(this.edgeX(leftNear, 0), yFar);
    g.lineTo(this.edgeX(rightNear, 0), yFar);
    g.lineTo(this.edgeX(rightNear, 1), yNear);
    g.lineTo(this.edgeX(leftNear, 1), yNear);
    g.closePath();
    g.fillPath();

    // Side rails (converging to the vanishing point).
    g.lineStyle(6, 0x4338ca, 0.9);
    g.lineBetween(this.edgeX(leftNear, 0), yFar, this.edgeX(leftNear, 1), yNear);
    g.lineBetween(this.edgeX(rightNear, 0), yFar, this.edgeX(rightNear, 1), yNear);

    // Dashed lane dividers between each pair of lanes.
    const dividers = [];
    for (let i = 0; i < lane.nearX.length - 1; i++) {
      dividers.push((lane.nearX[i] + lane.nearX[i + 1]) / 2);
    }
    const DASHES = 8;
    for (const nx of dividers) {
      for (let i = 0; i < DASHES; i++) {
        const t = ((i / DASHES) + this.phase) % 1; // 0 far → 1 near
        const t2 = Math.min(1, t + 0.55 / DASHES);
        // Far dashes are thin + faint; near dashes thick + bright (depth cue).
        g.lineStyle(2 + 6 * t, 0xffc44d, 0.15 + 0.55 * t);
        g.lineBetween(this.edgeX(nx, t), lane.yAt(t), this.edgeX(nx, t2), lane.yAt(t2));
      }
    }
  }
}
