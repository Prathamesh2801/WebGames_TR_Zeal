import Phaser from 'phaser';
import { GAME, TEXTURES, ANIMS } from '../constants';

// state → [animation key, texture key] used by setAnimState.
const STATE_MAP = {
  idle: [ANIMS.IDLE, TEXTURES.PLAYER_IDLE],
  run: [ANIMS.RUN, TEXTURES.PLAYER_RUN],
  dead: [ANIMS.DEAD, TEXTURES.PLAYER_DEAD],
};

/**
 * The player sprite. Fixed near the bottom, always full scale.
 * Moves between lanes by tweening x over LANE_SWITCH_MS (spec §5).
 * Drives the idle/run/dead animation states (setAnimState/die).
 */
export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, lane) {
    const startLane = lane ?? Math.floor(scene.lane.count / 2); // center
    const x = scene.lane.playerX(startLane);
    const y = scene.lane.playerY;
    super(scene, x, y, TEXTURES.PLAYER);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.laneIndex = startLane;
    this.laneTween = null;
    this.animState = null;
    this.setDepth(100);
    this.setAnimState('idle'); // start idle on the Start screen
  }

  /**
   * Switch animation state and normalize on-screen size. Every sheet has a
   * different native frame size, so we scale each to a constant display height
   * (GAME.PLAYER_DISPLAY_H) and re-anchor the feet + hitbox to the new frame.
   * Falls back to the static placeholder texture when an anim is unavailable.
   */
  setAnimState(state) {
    if (this.animState === state) return;
    this.animState = state;

    const [animKey] = STATE_MAP[state];
    if (this.scene.anims.exists(animKey)) {
      // ignoreIfPlaying=false so 'dead' always restarts from frame 0.
      this.play(animKey, false);
    } else {
      this.setTexture(TEXTURES.PLAYER); // generated placeholder fallback
    }

    // this.width/height now reflect the current frame's source size.
    this.setScale(GAME.PLAYER_DISPLAY_H / this.height);
    this.setOrigin(0.5, 0.92); // feet near the lane row
    // Tighter, torso-centered hitbox (source px; auto-scales with the sprite).
    if (this.body) this.body.setSize(this.width * 0.42, this.height * 0.5);
  }

  /** Play the death animation once, then invoke onComplete (game-over hook). */
  die(onComplete) {
    this.setAnimState('dead');
    if (this.scene.anims.exists(ANIMS.DEAD)) {
      this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, onComplete);
    } else {
      // No dead sheet: brief beat so the game-over screen isn't instant.
      this.scene.time.delayedCall(300, onComplete);
    }
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
      x: this.scene.lane.playerX(clamped),
      duration: GAME.LANE_SWITCH_MS,
      ease: 'Quad.easeOut',
    });
  }

  /** Snap back to the center lane and idle (used on restart). */
  reset() {
    const center = Math.floor(this.scene.lane.count / 2);
    if (this.laneTween) this.laneTween.stop();
    this.laneIndex = center;
    this.setPosition(this.scene.lane.playerX(center), this.scene.lane.playerY);
    this.setAnimState('idle');
  }
}
