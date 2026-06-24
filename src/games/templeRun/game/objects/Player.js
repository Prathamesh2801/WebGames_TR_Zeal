import Phaser from 'phaser';
import { GAME, TEXTURES, ANIMS } from '../constants';

// state → [animation key, texture key, scaleMul] used by setAnimState. scaleMul
// corrects sheets whose figure is drawn smaller within the frame than the rest
// (see GAME.PLAYER_JUMP_SCALE); it defaults to 1 for sheets that fill the frame.
const STATE_MAP = {
  idle: [ANIMS.IDLE, TEXTURES.PLAYER_IDLE, 1],
  run: [ANIMS.RUN, TEXTURES.PLAYER_RUN, 1],
  jump: [ANIMS.JUMP, TEXTURES.PLAYER_JUMP, GAME.PLAYER_JUMP_SCALE],
  dead: [ANIMS.DEAD, TEXTURES.PLAYER_DEAD, 1],
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
    // Jump state. jumpRise is the live screen-px the player is lifted above the
    // lane row (0 = grounded); RunScene reads it each frame to position us and
    // skips the run-bob while airborne. isJumping also gates obstacle hits, so
    // an airborne player clears ground obstacles (see RunScene.shouldHit).
    this.isJumping = false;
    this.jumpRise = 0;
    this.jumpTween = null;
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

    const [animKey, , scaleMul = 1] = STATE_MAP[state];
    if (this.scene.anims.exists(animKey)) {
      // ignoreIfPlaying=false so 'dead' always restarts from frame 0.
      this.play(animKey, false);
    } else {
      this.setTexture(TEXTURES.PLAYER); // generated placeholder fallback
    }

    // this.width/height now reflect the current frame's source size. scaleMul
    // compensates sheets that draw the figure smaller within the frame.
    this.setScale((GAME.PLAYER_DISPLAY_H / this.height) * scaleMul);
    this.setOrigin(0.5, 0.92); // feet near the lane row
    // Tighter, torso-centered hitbox (source px; auto-scales with the sprite).
    if (this.body) this.body.setSize(this.width * 0.42, this.height * 0.5);
  }

  /**
   * Hop up and over a ground obstacle. No-op if already airborne or dead, so
   * jumps can't be queued/stacked. Plays the jump anim once and tweens jumpRise
   * up to GAME.JUMP_HEIGHT and back over GAME.JUMP_DURATION (yoyo = symmetric
   * rise/fall). While isJumping is true the player is invulnerable to obstacles
   * (RunScene.shouldHit), which is what actually clears the obstacle.
   */
  jump() {
    if (this.isJumping || this.animState === 'dead') return;
    this.isJumping = true;
    this.setAnimState('jump');

    if (this.jumpTween) this.jumpTween.stop();
    this.jumpRise = 0;
    this.jumpTween = this.scene.tweens.add({
      targets: this,
      jumpRise: GAME.JUMP_HEIGHT,
      duration: GAME.JUMP_DURATION / 2, // half up...
      ease: 'Sine.easeOut',
      yoyo: true, // ...then mirrored back down for the fall
      onComplete: () => {
        this.isJumping = false;
        this.jumpRise = 0;
        this.jumpTween = null;
        // Resume running unless the run ended (death/pause) mid-air.
        if (this.animState !== 'dead') this.setAnimState('run');
      },
    });
  }

  /** Play the death animation once, then invoke onComplete (game-over hook). */
  die(onComplete) {
    if (this.jumpTween) this.jumpTween.stop(); // cancel any in-flight hop
    this.isJumping = false;
    this.jumpRise = 0;
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
    if (this.jumpTween) this.jumpTween.stop();
    this.isJumping = false;
    this.jumpRise = 0;
    this.jumpTween = null;
    this.laneIndex = center;
    this.setPosition(this.scene.lane.playerX(center), this.scene.lane.playerY);
    this.setAnimState('idle');
  }
}
