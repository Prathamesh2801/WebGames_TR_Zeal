import Phaser from 'phaser';
import { GAME, TEXTURES, OBSTACLE_VARIANTS, ANIMS } from '../constants';
import { EventBus } from '../EventBus';
import { Lane } from '../objects/Lane';
import { Road } from '../objects/Road';
import { Player } from '../objects/Player';
import { getLevel } from '../data/levelConfig';

/**
 * The single reusable lane-runner scene (spec §6). Owns the game loop,
 * spawning/pooling, collisions, scoring, and the React→scene command bridge
 * (pause/resume/restart). The environment is a looping video backdrop; the
 * player, obstacles and coins are drawn on top and tuned (via Lane.js) to ride
 * the road filmed in the clip.
 */
export class RunScene extends Phaser.Scene {
  constructor() {
    super('RunScene');
  }

  create() {
    this.level = getLevel();
    this.lane = new Lane(this);

    // Calibration overlay: bright lane guides drawn ABOVE the video so the
    // code's 3 lanes can be eyeballed against the road in the clip. Toggle with
    // GAME.DEBUG_LANES in constants.js.
    if (GAME.DEBUG_LANES) {
      this.road = new Road(this);
      this.road.draw();
    }

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

    // Obstacle art variants that actually loaded (fall back to placeholder).
    this.obstacleKeys = OBSTACLE_VARIANTS.filter((k) => this.textures.exists(k));
    if (!this.obstacleKeys.length) this.obstacleKeys = [TEXTURES.OBSTACLE];

    this.physics.add.overlap(this.player, this.obstacles, this.hitObstacle, this.shouldHit, this);
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
    this.spawnTimer.paused = true; // idle until the run actually begins

    // Keep the camera inside the world so the Start zoom can't reveal blank
    // edges (see beginCountdown/startZoom).
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setBounds(0, 0, width, height);
    this.scoreTimer = this.time.addEvent({
      delay: GAME.SCORE_TICK_MS,
      loop: true,
      callback: this.tickScore,
      callbackScope: this,
    });

    this.bindEventBus();
    this.scale.on('resize', this.handleResize, this);
    this.events.once('shutdown', this.shutdownScene, this);

    // Build the backdrop last; it emits 'ready' once the video's first frame is
    // decoded (or immediately for the image fallback) so the loading screen
    // stays up until the scene can actually render.
    this.buildBackground();
  }

  // ---- setup helpers -------------------------------------------------------

  /**
   * Looping video backdrop (sky + environment + road) shown as a cover image.
   * Lane.js is tuned to the filmed road so objects ride it, and the run speed is
   * constant so the road + obstacles stay locked to the clip. Falls back to the
   * static JPEG (then the generated placeholder) if the video is unavailable.
   */
  buildBackground() {
    this.bgIsVideo = false;
    this._bgFitted = false;
    this._booted = false;

    const url = this.registry.get('bgVideoUrl');
    if (!url) {
      this.useImageBackground();
      return;
    }

    const { width, height } = this.scale.gameSize;
    this.bg = this.add.video(width / 2, height / 2).setDepth(0);
    this.bg.setLoop(true);
    this.bg.setMute(true); // muted so it can autoplay on mobile

    // 'created' fires once the first frame + true dimensions are ready;
    // 'playing' is a belt-and-suspenders fallback for the same.
    this.bg.once('created', () => this.onVideoReady());
    this.bg.once('playing', () => this.onVideoReady());
    this.bg.once('unsupported', () => this.useImageBackground());
    this.bg.once('error', () => this.useImageBackground());
    // Safety net: never hang the loading screen if the video stalls.
    this._bgTimeout = this.time.delayedCall(8000, () => {
      if (!this.bgIsVideo) this.useImageBackground();
    });

    this.bg.loadURL(url, true); // blob: URL → browser decodes the VP9 directly
    this.bg.play(true); // decode a frame so 'created' fires; we hold it after
  }

  /** Video first frame is ready: size it, hold it still, and finish booting. */
  onVideoReady() {
    if (this.bgIsVideo) return;
    if (this._bgTimeout) this._bgTimeout.remove();
    this.bgIsVideo = true;
    this.applyBgRate();
    this.fitBackground();
    this.setBgPlaying(false); // hold a still frame on the idle/start screen
    this.finishBoot();
  }

  /** Use the static JPEG (then generated placeholder) when no video is usable. */
  useImageBackground() {
    if (this.bgIsVideo || this._booted) return;
    if (this._bgTimeout) this._bgTimeout.remove();
    if (this.bg) this.bg.destroy(); // drop the failed video object
    const { width, height } = this.scale.gameSize;
    this.bgIsVideo = false;
    this.bg = this.add.image(width / 2, height / 2, TEXTURES.PARALLAX).setDepth(0);
    this.fitBackground();
    this.finishBoot();
  }

  /** Emit 'ready' exactly once, after the backdrop can render (spec §6). */
  finishBoot() {
    if (this._booted) return;
    this._booted = true;
    EventBus.emit('ready');
  }

  /**
   * Scale the backdrop to cover the canvas, centered. Video dimensions aren't
   * known until the first frame decodes, so this no-ops until they're ready and
   * update() keeps retrying via _bgFitted.
   */
  fitBackground() {
    if (!this.bg) return;
    const { width, height } = this.scale.gameSize;
    let srcW;
    let srcH;
    if (this.bgIsVideo) {
      srcW = this.bg.width || this.bg.video?.videoWidth || 0;
      srcH = this.bg.height || this.bg.video?.videoHeight || 0;
    } else {
      const img = this.bg.texture.getSourceImage();
      srcW = img.width;
      srcH = img.height;
    }
    if (!srcW || !srcH) return; // not ready yet
    const scale = Math.max(width / srcW, height / srcH);
    this.bg.setPosition(width / 2, height / 2).setScale(scale);
    this._bgFitted = true;
    // Lock the lane geometry to the SAME cover-fit transform: feed it the live
    // source size so vidToScreen maps onto the exact pixels we just drew. When
    // the source size first becomes known (or changes), re-place the guides and
    // the idle player so they snap onto the filmed road.
    if (this.lane.setSource(srcW, srcH)) {
      if (this.road) this.road.draw();
      if (this.player && !this.isOver) {
        this.player.setPosition(this.lane.playerX(this.player.laneIndex), this.lane.playerY);
      }
    }
  }

  /** Play/pause the video backdrop so the scenery freezes exactly with gameplay. */
  setBgPlaying(play) {
    if (!this.bgIsVideo || !this.bg) return;
    if (typeof this.bg.setPaused === 'function') {
      this.bg.setPaused(!play);
    } else if (this.bg.video) {
      play ? this.bg.video.play() : this.bg.video.pause();
    }
  }

  /** Apply the tuned playback rate so the road speed matches obstacle motion. */
  applyBgRate() {
    if (!this.bgIsVideo || !this.bg) return;
    if (typeof this.bg.setPlaybackRate === 'function') {
      this.bg.setPlaybackRate(GAME.BG_PLAYBACK_RATE);
    } else if (this.bg.video) {
      this.bg.video.playbackRate = GAME.BG_PLAYBACK_RATE;
    }
  }

  setupInput() {
    // Lane switching + jump. Pause keys are owned by React.
    this.input.keyboard.on('keydown-LEFT', this.onLeft, this);
    this.input.keyboard.on('keydown-A', this.onLeft, this);
    this.input.keyboard.on('keydown-RIGHT', this.onRight, this);
    this.input.keyboard.on('keydown-D', this.onRight, this);
    this.input.keyboard.on('keydown-UP', this.onJump, this);
    this.input.keyboard.on('keydown-W', this.onJump, this);
    this.input.keyboard.on('keydown-SPACE', this.onJump, this);

    // Swipe detection (horizontal → lane switch, upward → jump).
    this.input.on('pointerdown', (p) => {
      this._swipeX = p.x;
      this._swipeY = p.y;
    });
    this.input.on('pointerup', (p) => {
      if (this._swipeX == null) return;
      const dx = p.x - this._swipeX;
      const dy = p.y - this._swipeY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (Math.abs(dx) > GAME.SWIPE_THRESHOLD) dx < 0 ? this.onLeft() : this.onRight();
      } else if (dy < -GAME.SWIPE_THRESHOLD) {
        this.onJump(); // upward swipe
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

  onJump() {
    if (this.running) this.player.jump();
  }

  bindEventBus() {
    // React → scene commands. Stored so we can unsubscribe on shutdown.
    this._onStartRun = () => this.beginCountdown();
    this._onBeginTutorial = () => this.beginTutorial();
    this._onBeginRun = () => this.beginRun();
    this._onPause = () => this.pauseRun();
    this._onResume = () => this.resumeRun();
    this._onRestart = () => this.resetToIdle();
    EventBus.on('start-run', this._onStartRun); // Start tapped → zoom + 3,2,1
    EventBus.on('begin-tutorial', this._onBeginTutorial); // countdown done → practice
    EventBus.on('begin-run', this._onBeginRun); // tutorial done → spawns begin
    EventBus.on('pause', this._onPause);
    EventBus.on('resume', this._onResume);
    EventBus.on('restart', this._onRestart);
  }

  resetRunState() {
    this.score = 0;
    this.coinCount = 0;
    this.speed = this.level.startSpeed;
    this.running = false; // idle until React emits 'resume' (Start tapped)
    this.inTutorial = false; // practice window: running, but no spawns/scoring
    this.isOver = false;
    this._lastLane = -1;
  }

  // ---- main loop -----------------------------------------------------------

  update(time, delta) {
    // Video size isn't known until the first frame decodes — keep fitting until
    // it covers the canvas (runs on the idle/start screen too). Once we have a
    // frame, freeze it while idle so the road doesn't scroll under a standing
    // player; it resumes in beginRun.
    if (this.bgIsVideo && !this._bgFitted) {
      this.fitBackground();
      if (this._bgFitted) {
        this.applyBgRate();
        if (!this.running) this.setBgPlaying(false);
      }
    }

    if (!this.running) return;
    const dt = delta / 1000;
    const move = this.speed * dt;

    // The video is the scenery, so nothing to scroll here — motion reads from
    // the approaching/scaling obstacles and coins below.
    this.advanceGroup(this.obstacles, move);
    this.advanceGroup(this.coins, move);

    // Position the player on its lane row: a subtle running bob while grounded,
    // or lifted by the jump arc while airborne (jumpRise, set by Player.jump).
    const bob = this.player.isJumping ? 0 : Math.sin(time * 0.02) * 3;
    this.player.y = this.lane.playerY + bob - this.player.jumpRise;

    // Ramp speed toward MAX_SPEED.
    this.speed = Math.min(this.level.maxSpeed, this.speed + this.level.speedRamp * dt);
  }

  advanceGroup(group, move) {
    const bottom = this.lane.height + 60;
    const children = group.getChildren();
    for (let i = 0; i < children.length; i++) {
      const item = children[i];
      if (!item.active) continue;
      item.y += move;
      const t = Phaser.Math.Clamp(this.lane.depthAt(item.y), 0, 1);
      item.x = this.lane.xAt(item.getData('lane'), t);
      // Depth-scale uniformly; coins spin via their own sprite-sheet animation.
      item.setScale(this.lane.scaleAt(t) * (item.getData('baseScale') || 1));
      if (item.y > bottom) this.recycle(group, item);
    }
  }

  recycle(group, item) {
    group.killAndHide(item);
    if (item.body) item.body.enable = false;
  }

  // ---- spawning ------------------------------------------------------------

  spawn() {
    if (!this.running || this.inTutorial) return; // no spawns during practice
    // Fairness (spec §5): one item per row → at least one lane always passable.
    let lane = Phaser.Math.Between(0, this.lane.count - 1);
    if (lane === this._lastLane) lane = (lane + 1) % this.lane.count;
    this._lastLane = lane;

    const isCoin = Math.random() < this.level.coinChance;
    if (!isCoin && !GAME.SPAWN_OBSTACLES) return; // obstacles disabled (debug)
    const group = isCoin ? this.coins : this.obstacles;
    const t = 0; // far point
    const x = this.lane.xAt(lane, t);
    const y = this.lane.yAt(t);

    const item = group.get(x, y);
    if (!item) return; // pool exhausted — skip this row

    // Normalize the source art to one on-screen size (obstacle art is
    // 1024–2048px, the coin sheet is 480px/frame). baseScale folds that
    // normalization into the per-frame depth scaling in advanceGroup.
    let baseScale;
    if (!isCoin) {
      const key = Phaser.Utils.Array.GetRandom(this.obstacleKeys);
      item.setTexture(key);
      baseScale = GAME.OBSTACLE_DISPLAY_W / item.width;
      if (item.body) item.body.setSize(item.width * 0.6, item.height * 0.6);
    } else {
      baseScale = GAME.COIN_DISPLAY_W / item.width;
      if (item.body) item.body.setSize(item.width * 0.7, item.height * 0.7);
      if (this.anims.exists(ANIMS.COIN)) item.play(ANIMS.COIN); // looping spin
    }

    item.setData('lane', lane);
    item.setData('baseScale', baseScale);
    item.setActive(true).setVisible(true);
    item.setScale(this.lane.scaleAt(t) * baseScale);
    item.setDepth(50);
    if (item.body) {
      item.body.enable = true;
      item.body.reset(x, y);
    }
  }

  // ---- collisions + scoring ------------------------------------------------

  tickScore() {
    if (!this.running || this.inTutorial) return;
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

  /**
   * Process callback gating obstacle collisions. Bodies are wide (scaled art),
   * and lanes converge near the far point, so raw body overlap fires across
   * lanes. Only count a hit when the obstacle is in the player's lane AND has
   * arrived in the near collision zone — fair, art-size-independent.
   */
  shouldHit(player, obstacle) {
    if (!obstacle.active) return false;
    if (player.isJumping) return false; // airborne → clears ground obstacles
    if (obstacle.getData('lane') !== player.laneIndex) return false;
    // Gate on nearness to the player's ROW, not an absolute depth — the player
    // sits at depthAt(PLAYER_Y) (~0.78), so an absolute 0.9 threshold could
    // never be reached while the bodies actually overlap. COLLIDE_NEAR_T → the
    // allowed depth gap above/below the player (1 = must be right on the row).
    const gap = Math.abs(this.lane.depthAt(obstacle.y) - this.lane.depthAt(player.y));
    return gap <= 1 - GAME.COLLIDE_NEAR_T;
  }

  hitObstacle() {
    if (this.isOver) return;
    this.isOver = true;
    this.running = false; // freezes the world; only the death anim plays on
    this.spawnTimer.paused = true;
    this.setBgPlaying(false); // freeze the scenery on impact
    this.cameras.main.shake(220, 0.012);
    // Play the death animation, THEN hand off to the React game-over screen so
    // the transition reads as one continuous beat.
    this.player.die(() => {
      EventBus.emit('game-over', this.finalScore);
      this.scene.pause();
    });
  }

  // ---- start sequence (zoom + countdown) ----------------------------------

  /**
   * Start tapped (React phase → 'countdown'). The world stays still and the
   * player keeps idling while the camera zooms in for the 3,2,1 overlay.
   */
  beginCountdown() {
    if (this.isOver) return;
    this.scene.resume(); // in case we came from a paused/idle state
    this.setBgPlaying(false); // road stays still through the 3·2·1 zoom
    this.player.setAnimState('idle');
    this.startZoom();
  }

  /**
   * Countdown finished (React phase → 'tutorial'): zoom out and start running so
   * the player can practice the controls, but keep the spawn timer paused and
   * scoring frozen for the tutorial window — no obstacles or coins yet.
   */
  beginTutorial() {
    if (this.isOver) return;
    this.endZoom();
    this.setBgPlaying(true); // road scrolls so movement feels real
    this.player.setAnimState('run');
    this.speed = this.level.startSpeed;
    this.inTutorial = true;
    this.running = true; // controls (lane switch + jump) are live to practice
    this.spawnTimer.paused = true; // ...but nothing spawns yet
  }

  /**
   * Tutorial finished (React phase → 'running'): the real run begins — start
   * spawning and scoring. Also handles the direct path (retry skips the tutorial)
   * by setting up the run state itself, so it's correct whether or not
   * beginTutorial ran first.
   */
  beginRun() {
    if (this.isOver) return;
    this.endZoom();
    this.setBgPlaying(true); // road starts scrolling exactly when the run does
    this.player.setAnimState('run');
    this.speed = this.level.startSpeed;
    this.inTutorial = false;
    this.running = true;
    this.spawnTimer.paused = false;
  }

  startZoom() {
    const cam = this.cameras.main;
    cam.zoomTo(1.6, 650, 'Sine.easeInOut');
    cam.pan(this.player.x, this.player.y - 30, 650, 'Sine.easeInOut');
  }

  endZoom() {
    const cam = this.cameras.main;
    const { width, height } = this.scale.gameSize;
    cam.zoomTo(1, 450, 'Sine.easeInOut');
    cam.pan(width / 2, height / 2, 450, 'Sine.easeInOut');
  }

  // ---- React-driven controls ----------------------------------------------

  pauseRun() {
    if (this.isOver) return;
    this.running = false;
    this.setBgPlaying(false);
    this.scene.pause();
  }

  resumeRun() {
    if (this.isOver) return;
    this.scene.resume();
    this.setBgPlaying(true);
    this.running = true;
  }

  /** Reset everything back to the idle Start state (used by restart/retry). */
  resetToIdle() {
    this.obstacles.getChildren().forEach((o) => this.recycle(this.obstacles, o));
    this.coins.getChildren().forEach((c) => this.recycle(this.coins, c));
    this.scene.resume(); // game-over pauses the scene; revive it for the anims
    this.setBgPlaying(false); // back to a still idle road until the next run
    this.cameras.main.setZoom(1);
    const { width, height } = this.scale.gameSize;
    this.cameras.main.centerOn(width / 2, height / 2);
    this.player.reset(); // back to center lane + idle
    this.resetRunState();
    this.spawnTimer.paused = true; // stays idle until the next countdown
    EventBus.emit('score-update', 0);
    EventBus.emit('coins-update', 0);
  }

  // ---- lifecycle -----------------------------------------------------------

  handleResize() {
    this.lane.recompute();
    if (this.road) this.road.draw();
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setBounds(0, 0, width, height);
    this.fitBackground();
    if (this.player && !this.isOver) {
      this.player.setPosition(this.lane.playerX(this.player.laneIndex), this.lane.playerY);
    }
  }

  shutdownScene() {
    if (this.bgIsVideo && this.bg?.stop) this.bg.stop(); // stop decoding
    const url = this.registry.get('bgVideoUrl');
    if (url) {
      URL.revokeObjectURL(url);
      this.registry.remove('bgVideoUrl');
    }
    EventBus.off('start-run', this._onStartRun);
    EventBus.off('begin-tutorial', this._onBeginTutorial);
    EventBus.off('begin-run', this._onBeginRun);
    EventBus.off('pause', this._onPause);
    EventBus.off('resume', this._onResume);
    EventBus.off('restart', this._onRestart);
    this.scale.off('resize', this.handleResize, this);
  }
}
