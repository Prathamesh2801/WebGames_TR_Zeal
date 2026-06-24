/**
 * Calibration overlay: bright lane center-lines drawn over the video backdrop so
 * the code's 3 lanes (Lane.js) can be eyeballed against the road in the clip.
 * Only created when GAME.DEBUG_LANES is true; tune the GAME.ROAD trapezoid
 * (VANISH_X/Y, NEAR_LEFT/RIGHT) until these guides track the filmed road.
 */
export class Road {
  constructor(scene) {
    this.scene = scene;
    this.lane = scene.lane;
    this.g = scene.add.graphics().setDepth(40); // above the video, under obstacles
  }

  draw() {
    const lane = this.lane;
    const g = this.g;
    g.clear();
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
}
