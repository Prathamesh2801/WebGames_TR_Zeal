import Phaser from 'phaser';
import { GAME, TEXTURES } from '../constants';
import { EventBus } from '../EventBus';
import { Lane } from '../objects/Lane';
import { Road } from '../objects/Road';
import { Player } from '../objects/Player';
import { getLevel } from '../data/levelConfig';

/**
 * The single reusable lane-runner scene (spec §6). Later parameterized per
 * level via levelConfig. Owns the game loop, spawning/pooling, collisions,
 * scoring, and the React→scene command bridge (pause/resume/restart).
 */
export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  create() {
    this.level = getLevel();
    this.lane = new Lane(this);

    this.buildBackground();
    this.player = new Player(this);

    // Pooled groups — reuse, never destroy mid-run (spec §12).
    this.obstacles = this.physics.add.group({
      defaultKey: TEXTURES.OBSTACLE,
      maxSize: GAME.POOL_OBSTACLES,
    });
    this.coins = this.physics.add.group({
      defaultKey: TEXTURES.COIN,
      maxSize: GAME.POOL_COINS,
    });
    this.obstacles.createMultiple({
      key: TEXTURES.OBSTACLE,
      quantity: GAME.POOL_OBSTACLES,
      active: false,
      visible: false,
    });
    this.coins.createMultiple({
      key: TEXTURES.COIN,
      quantity: GAME.POOL_COINS,
      active: false,
      visible: false,
    });

    this.physics.add.overlap(this.player, this.obstacles, this.hitObstacle, null, this);
    this.physics.add.overlap(this.player, this.coins, this.collectCoin, null, this);

    this.setupInput();
    this.resetRunState();

    // Spawn + throttled score timers.
    this.spawnTimer = this.time.addEvent({
      delay: this.level.spawnInterval,
      loop: true,
      callback: this.spawn,
      callbackScope: this,
    });
    this.scoreTimer = this.time.addEvent({
      delay: GAME.SCORE_TICK_MS,
      loop: true,
      callback: this.tickScore,
      callbackScope: this,
    });

    this.bindEventBus();
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.shutdownScene, this);

    EventBus.emit('ready');
  }

  // ---- setup helpers -------------------------------------------------------

  buildBackground() {
    const { width, height } = this.scale.gameSize;
    // Parallax sky behind the road for depth feel.
    this.parallax = this.add
      .tileSprite(0, 0, width, height, TEXTURES.PARALLAX)
      .setOrigin(0, 0)
      .setDepth(0);
    // Perspective ground (converging lanes + scrolling dashes).
    this.road = new Road(this);
    this.road.draw(); // draw once so the Start screen shows the track
  }

  setupInput() {
    // Lane switching only (no jump/slide in v1). Pause keys are owned by React.
    this.input.keyboard.on('keydown-LEFT', this.onLeft, this);
    this.input.keyboard.on('keydown-A', this.onLeft, this);
    this.input.keyboard.on('keydown-RIGHT', this.onRight, this);
    this.input.keyboard.on('keydown-D', this.onRight, this);

    // Swipe detection.
    this.input.on('pointerdown', (p) => {
      this._swipeX = p.x;
      this._swipeY = p.y;
    });
    this.input.on('pointerup', (p) => {
      if (this._swipeX == null) return;
      const dx = p.x - this._swipeX;
      const dy = p.y - this._swipeY;
      if (Math.abs(dx) > GAME.SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        dx < 0 ? this.onLeft() : this.onRight();
      }
      this._swipeX = null;
    });
  }

  onLeft() {
    if (this.running) this.player.moveLeft();
  }

  onRight() {
    if (this.running) this.player.moveRight();
  }

  bindEventBus() {
    // React → scene commands. Stored so we can unsubscribe on shutdown.
    this._onPause = () => this.pauseRun();
    this._onResume = () => this.resumeRun();
    this._onRestart = () => this.restartRun();
    EventBus.on('pause', this._onPause);
    EventBus.on('resume', this._onResume);
    EventBus.on('restart', this._onRestart);
  }

  resetRunState() {
    this.score = 0;
    this.coinCount = 0;
    this.speed = this.level.startSpeed;
    this.running = false; // idle until React emits 'resume' (Start tapped)
    this.isOver = false;
    this._lastLane = -1;
  }

  // ---- main loop -----------------------------------------------------------

  update(time, delta) {
    if (!this.running) return;
    const dt = delta / 1000;
    const move = this.speed * dt;

    // Scroll the perspective road + parallax (parallax slower for depth).
    this.road.scroll(move);
    this.road.draw();
    this.parallax.tilePositionY -= move * 0.35;

    this.advanceGroup(this.obstacles, move, time, false);
    this.advanceGroup(this.coins, move, time, true);

    // Subtle running bob so the player feels alive.
    this.player.y = this.lane.playerY + Math.sin(time * 0.02) * 3;

    // Ramp speed toward MAX_SPEED.
    this.speed = Math.min(this.level.maxSpeed, this.speed + this.level.speedRamp * dt);
  }

  advanceGroup(group, move, time, spin) {
    const bottom = this.lane.height + 60;
    const children = group.getChildren();
    for (let i = 0; i < children.length; i++) {
      const item = children[i];
      if (!item.active) continue;
      item.y += move;
      const t = Phaser.Math.Clamp(this.lane.depthAt(item.y), 0, 1);
      item.x = this.lane.xAt(item.getData('lane'), t);
      const s = this.lane.scaleAt(t);
      if (spin) {
        // Coins: keep perspective scale on Y, flip X over time to fake a spin.
        item.scaleY = s;
        item.scaleX = s * Math.max(0.12, Math.abs(Math.cos(time * 0.012 + item.getData('phase'))));
      } else {
        item.setScale(s);
      }
      if (item.y > bottom) this.recycle(group, item);
    }
  }

  recycle(group, item) {
    group.killAndHide(item);
    if (item.body) item.body.enable = false;
  }

  // ---- spawning ------------------------------------------------------------

  spawn() {
    if (!this.running) return;
    // Fairness (spec §5): one item per row → at least one lane always passable.
    let lane = Phaser.Math.Between(0, this.lane.count - 1);
    if (lane === this._lastLane) lane = (lane + 1) % this.lane.count;
    this._lastLane = lane;

    const isCoin = Math.random() < this.level.coinChance;
    const group = isCoin ? this.coins : this.obstacles;
    const t = 0; // far point
    const x = this.lane.xAt(lane, t);
    const y = this.lane.yAt(t);

    const item = group.get(x, y);
    if (!item) return; // pool exhausted — skip this row

    item.setData('lane', lane);
    item.setData('phase', Math.random() * Math.PI * 2); // desync coin spins
    item.setActive(true).setVisible(true);
    item.setScale(this.lane.scaleAt(t));
    item.setDepth(50);
    if (item.body) {
      item.body.enable = true;
      item.body.reset(x, y);
    }
  }

  // ---- collisions + scoring ------------------------------------------------

  tickScore() {
    if (!this.running) return;
    this.score += 1;
    EventBus.emit('score-update', this.score);
  }

  get finalScore() {
    return this.score + this.coinCount * GAME.COIN_POINTS;
  }

  collectCoin(_player, coin) {
    if (!coin.active) return;
    this.recycle(this.coins, coin);
    this.coinCount += 1;
    EventBus.emit('coins-update', this.coinCount);
  }

  hitObstacle() {
    if (this.isOver) return;
    this.isOver = true;
    this.running = false;
    this.spawnTimer.paused = true;
    EventBus.emit('game-over', this.finalScore);
    this.scene.pause();
  }

  // ---- React-driven controls ----------------------------------------------

  pauseRun() {
    if (this.isOver) return;
    this.running = false;
    this.scene.pause();
  }

  resumeRun() {
    if (this.isOver) return;
    this.scene.resume();
    this.running = true;
  }

  restartRun() {
    // Recycle everything back into the pools, reset state + player.
    this.obstacles.getChildren().forEach((o) => this.recycle(this.obstacles, o));
    this.coins.getChildren().forEach((c) => this.recycle(this.coins, c));
    this.player.reset();
    this.resetRunState();
    this.running = true; // Retry goes straight into the run
    this.spawnTimer.paused = false;
    this.scene.resume();
    EventBus.emit('score-update', 0);
    EventBus.emit('coins-update', 0);
  }

  // ---- lifecycle -----------------------------------------------------------

  handleResize() {
    this.lane.recompute();
    const { width, height } = this.scale.gameSize;
    if (this.road) this.road.draw();
    if (this.parallax) this.parallax.setSize(width, height);
    if (this.player && !this.isOver) {
      this.player.setPosition(this.lane.laneX(this.player.laneIndex), this.lane.playerY);
    }
  }

  shutdownScene() {
    EventBus.off('pause', this._onPause);
    EventBus.off('resume', this._onResume);
    EventBus.off('restart', this._onRestart);
    this.scale.off('resize', this.handleResize, this);
  }
}
