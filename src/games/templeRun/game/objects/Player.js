import Phaser from 'phaser';
import { GAME, TEXTURES } from '../constants';

/**
 * The player sprite. Fixed near the bottom, always full scale.
 * Moves between lanes by tweening x over LANE_SWITCH_MS (spec §5).
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, lane) {
    const startLane = lane ?? Math.floor(scene.lane.count / 2); // center
    const x = scene.lane.laneX(startLane);
    const y = scene.lane.playerY;
    super(scene, x, y, TEXTURES.PLAYER);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.laneIndex = startLane;
    this.laneTween = null;
    this.setOrigin(0.5, 0.85); // feet near the lane row
    this.setDepth(100);
    // Tighter hitbox than the sprite for fairer collisions.
    this.body.setSize(this.width * 0.55, this.height * 0.5);
  }

  get maxLane() {
    return this.scene.lane.count - 1;
  }

  moveLeft() {
    this.switchTo(this.laneIndex - 1);
  }

  moveRight() {
    this.switchTo(this.laneIndex + 1);
  }

  switchTo(targetLane) {
    const clamped = Phaser.Math.Clamp(targetLane, 0, this.maxLane);
    if (clamped === this.laneIndex) return;
    this.laneIndex = clamped;

    if (this.laneTween) this.laneTween.stop();
    this.laneTween = this.scene.tweens.add({
      targets: this,
      x: this.scene.lane.laneX(clamped),
      duration: GAME.LANE_SWITCH_MS,
      ease: 'Quad.easeOut',
    });
  }

  /** Snap back to the center lane (used on restart). */
  reset() {
    const center = Math.floor(this.scene.lane.count / 2);
    if (this.laneTween) this.laneTween.stop();
    this.laneIndex = center;
    this.setPosition(this.scene.lane.laneX(center), this.scene.lane.playerY);
  }
}
