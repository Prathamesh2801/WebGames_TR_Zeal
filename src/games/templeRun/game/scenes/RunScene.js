import Phaser from 'phaser';
import { GAME, TEXTURES, OBSTACLE_VARIANTS, SIDE_PROPS, ANIMS } from '../constants';
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

    // Calibration overlay: bright lane guides drawn ABOVE the video (under the
    // obstacles) so the code's 3 lanes can be eyeballed against the road
    // painted into the backdrop. Toggle with GAME.DEBUG_LANES in constants.js.
    if (GAME.DEBUG_LANES) {
      this.road = new Road(this, { overlay: true });
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

    // Scenery gateway arch — a non-colliding prop (plain image pool, no physics)
    // that recedes from the vanishing point and scales up so the player runs
    // *through* it. Spawned ONCE per run as a grand entrance (see beginRun); it
    // is a landmark, not endlessly repeating scenery.
    this.archPool = [];

    // Receding side scenery — havelis lining the road, streaming down the side
    // edges (same plain-image pool pattern as arches). One sprite, mirrored in
    // code, spawned alternating left/right on its own timer (see spawnSide).
    this.sidePool = [];
    this._sideToggle = -1; // -1 left, +1 right; flips each spawn
    this.sideTimer = this.time.addEvent({
      delay: GAME.SIDE_INTERVAL,
      loop: true,
      callback: this.spawnSide,
      callbackScope: this,
    });
    this.sideTimer.paused = true; // idle until the run begins

    // Obstacle art variants that actually loaded (fall back to placeholder).
    this.obstacleKeys = OBSTACLE_VARIANTS.filter((k) => this.textures.exists(k));
    if (!this.obstacleKeys.length) this.obstacleKeys = [TEXTURES.OBSTACLE];

    // Side-scenery props (havelis + terrain) that actually loaded.
    this.sideProps = SIDE_PROPS.filter((p) => this.textures.exists(p.key));

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

    // Pre-populate the street so the start screen shows a built environment.
    this.seedScenery();
  }

  // ---- setup helpers -------------------------------------------------------

  buildBackground() {
    // Path A: a looping video (sky + forest + road incl. lane lines) shown as a
    // cover backdrop. No procedural road is drawn — Lane.js is tuned to the
    // painted road so objects ride it, and the run speed is constant so the
    // road + obstacles stay locked to the clip. Falls back to the static JPEG
    // (then the generated placeholder) if the video is unavailable.
    this.bgIsVideo = false;
    this._bgFitted = false;
    this._booted = false;

    // Path B: code-drawn warm sky + procedural road (the Udaipur pixel look).
    if (!GAME.USE_VIDEO_BG) {
      this.useProceduralBackground();
      return;
    }

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

  /**
   * Path B backdrop: a code-drawn warm golden-hour sky plus the procedural
   * Road as the real ground. No video, no decode wait — and it shares the
   * pixel art language with the player/obstacles/arches.
   */
  useProceduralBackground() {
    this.bgIsVideo = false;
    this._bgFitted = true; // nothing to fit; the sky is drawn to canvas size
    const { width, height } = this.scale.gameSize;
    this.sky = this.add.graphics().setDepth(-10);
    // Distant city backdrop (its own hazy sky) sitting at the horizon. Static =
    // correct parallax for something that far. Falls back to a code-drawn
    // skyline in drawSky if the texture is missing.
    if (this.textures.exists(TEXTURES.SKYLINE)) {
      this.skyline = this.add.image(0, 0, TEXTURES.SKYLINE).setOrigin(0.5, 1).setDepth(-9);
    }
    // Static 3/4-perspective city walls lining each side (mid-ground). Behind
    // the moving props (so trees/havelis pass in front), ahead of the skyline.
    // The right wall uses its own art if provided, else a mirrored left wall.
    if (this.textures.exists(TEXTURES.WING_L)) {
      // Origin = the wall's far/vanishing corner, pinned at the road's vanishing
      // point in fitWings so it recedes down the side and fills the triangle.
      this.wingL = this.add.image(0, 0, TEXTURES.WING_L).setOrigin(1, 0).setDepth(-5);
      const hasR = this.textures.exists(TEXTURES.WING_R);
      this.wingR = this.add
        .image(0, 0, hasR ? TEXTURES.WING_R : TEXTURES.WING_L)
        .setOrigin(0, 0)
        .setFlipX(!hasR)
        .setDepth(-5);
    }
    this.drawSky(width, height);
    this.fitSkyline();
    this.fitWings();
    // Promote the procedural road to the visible ground (opaque, depth 1).
    this.road = new Road(this, { overlay: false });
    this.road.draw();
    this.finishBoot();
  }

  /**
   * Afternoon backdrop: blue sky above the horizon, warm sand ground below it,
   * and a hazy distant skyline sitting on the horizon so the upper sides aren't
   * empty. The ground plane means scenery beside the road sits on ground.
   */
  drawSky(width, height) {
    const g = this.sky;
    g.clear();
    const horizon = height * GAME.SPAWN_Y; // = the road's vanishing-point row
    // Sky: clear afternoon blue at the top → pale haze toward the horizon.
    g.fillGradientStyle(0x5fa6d8, 0x5fa6d8, 0xc7e2f2, 0xc7e2f2, 1);
    g.fillRect(0, 0, width, horizon);
    // Ground: light sand at the horizon → warmer dust toward the camera.
    // Lighter than the road (0x9c8763) so the road still reads as a path.
    g.fillGradientStyle(0xdcc59a, 0xdcc59a, 0xc6a877, 0xc6a877, 1);
    g.fillRect(0, horizon, width, height - horizon);
    // Code-drawn skyline only when the skyline.png backdrop isn't available.
    if (!this.skyline) this.drawSkyline(width, horizon);
  }

  /** Cover the sky region with the skyline backdrop, base aligned to horizon. */
  fitSkyline() {
    if (!this.skyline) return;
    const { width, height } = this.scale.gameSize;
    const horizon = height * GAME.SPAWN_Y;
    const scale = Math.max(width / this.skyline.width, horizon / this.skyline.height);
    this.skyline.setScale(scale).setPosition(width / 2, horizon + 1);
  }

  /**
   * Place the static side walls: each wall's far corner is pinned at the road's
   * vanishing point, so it recedes down the side and fills the whole side
   * triangle (the opaque road masks the inner diagonal → it hugs the road).
   * Height is a fraction of the SCREEN HEIGHT (GAME.WING_SCALE) → responsive.
   */
  fitWings() {
    if (!this.wingL) return;
    const { height } = this.scale.gameSize;
    const farY = height * GAME.SPAWN_Y;
    const cx = this.lane.centerX;
    const y = farY + GAME.WING_Y;
    const sL = (height * GAME.WING_SCALE) / this.wingL.height;
    const sR = (height * GAME.WING_SCALE) / this.wingR.height;
    this.wingL.setScale(sL).setPosition(cx - GAME.WING_X, y);
    this.wingR.setScale(sR).setPosition(cx + GAME.WING_X, y);
  }

  /**
   * A low band of hazy, desaturated domed buildings sitting on the horizon —
   * atmospheric-perspective city silhouette that fills the far sides (which
   * individual props can't, being tiny near the vanishing point). Deterministic
   * so it stays put across redraws/resizes.
   */
  drawSkyline(width, horizon) {
    const g = this.sky;
    const step = 52;
    const n = Math.ceil(width / step) + 1;
    for (let i = 0; i < n; i++) {
      const x = i * step;
      const h = 18 + ((i * 37) % 30); // pseudo-random 18..47px tall
      const bw = step * 0.82;
      const cx = x + bw / 2;
      const topY = horizon - h;
      g.fillStyle(0xb9bfb0, 0.55); // pale haze (reads as distant)
      g.fillRect(x, topY, bw, h + 2); // building body
      g.fillCircle(cx, topY, bw * 0.4); // dome
      g.fillRect(cx - 1.5, topY - bw * 0.4 - 6, 3, 7); // finial
    }
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
  }

  /** Play/pause the video backdrop so scenery freezes exactly with gameplay. */
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
    this._onStartRun = () => this.beginCountdown();
    this._onBeginRun = () => this.beginRun();
    this._onPause = () => this.pauseRun();
    this._onResume = () => this.resumeRun();
    this._onRestart = () => this.resetToIdle();
    EventBus.on('start-run', this._onStartRun); // Start tapped → zoom + 3,2,1
    EventBus.on('begin-run', this._onBeginRun); // countdown done → run begins
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

    // Scroll + redraw the calibration overlay so the lane dashes track motion.
    if (this.road) {
      this.road.scroll(move);
      this.road.draw();
    }

    // Path A: the scenery is a static backdrop, so nothing to scroll here —
    // motion reads from the approaching/scaling obstacles and coins below.
    this.advanceSides(move); // scenery first → behind obstacles/coins
    this.advanceGroup(this.obstacles, move);
    this.advanceGroup(this.coins, move);
    this.advanceArches(move);

    // Subtle running bob so the player feels alive.
    this.player.y = this.lane.playerY + Math.sin(time * 0.02) * 3;

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

  // ---- scenery arches ------------------------------------------------------

  /** Place (or reuse) the gateway arch at depth t (0 far → 1 near), centered. */
  placeArch(t = 0) {
    if (!this.textures.exists(TEXTURES.ARCH)) return;
    let arch = this.archPool.find((a) => !a.active);
    if (!arch) {
      if (this.archPool.length >= GAME.POOL_ARCHES) return; // pool exhausted
      // Origin at bottom-center so the base sits on the road and it grows up.
      arch = this.add.image(0, 0, TEXTURES.ARCH).setOrigin(0.5, 1).setDepth(5);
      arch.setData('baseScale', GAME.ARCH_DISPLAY_W / arch.width);
      this.archPool.push(arch);
    }
    arch.x = this.lane.centerX;
    arch.y = this.lane.yAt(t);
    const s =
      (GAME.ARCH_SCALE_FAR + (1 - GAME.ARCH_SCALE_FAR) * t) *
      arch.getData('baseScale');
    arch.setScale(s);
    arch.setActive(true).setVisible(true);
  }

  /** Move arches toward the camera and scale them with depth (no collisions). */
  advanceArches(move) {
    const bottom = this.lane.nearY + 80;
    for (let i = 0; i < this.archPool.length; i++) {
      const arch = this.archPool[i];
      if (!arch.active) continue;
      arch.y += move;
      const t = Phaser.Math.Clamp(this.lane.depthAt(arch.y), 0, 1);
      arch.x = this.lane.centerX;
      // Custom far→near scale (a big arch should start much smaller than the
      // shared obstacle SCALE_FAR allows) folded into the art-size baseScale.
      const s =
        (GAME.ARCH_SCALE_FAR + (1 - GAME.ARCH_SCALE_FAR) * t) *
        arch.getData('baseScale');
      arch.setScale(s);
      if (arch.y > bottom) arch.setActive(false).setVisible(false);
    }
  }

  /** Hide all arches (used on restart/reset). */
  clearArches() {
    for (const arch of this.archPool) arch.setActive(false).setVisible(false);
  }

  // ---- side scenery (havelis) ----------------------------------------------

  /**
   * Place (or reuse) a haveli on `side` (-1 left, +1 right) at depth t. The
   * inner-bottom corner anchors to the road shoulder so the building grows up
   * and outward into the side triangle. The right side reuses the same art,
   * flipped, so both sides match from one sprite. A random variant is picked and
   * normalized to one on-screen width (variants have different native sizes).
   */
  placeSide(side, t = 0) {
    if (!this.sideProps.length) return;
    let prop = this.sidePool.find((p) => !p.active);
    if (!prop) {
      if (this.sidePool.length >= GAME.POOL_HAVELIS) return; // pool exhausted
      prop = this.add.image(0, 0, TEXTURES.HAVELI);
      this.sidePool.push(prop);
    }
    const variant = Phaser.Utils.Array.GetRandom(this.sideProps);
    prop.setTexture(variant.key);
    prop.setData('baseScale', variant.w / prop.width); // per-prop on-screen width
    prop.setOrigin(side < 0 ? 1 : 0, 1).setFlipX(side > 0);
    prop.setData('side', side);
    prop.y = this.lane.yAt(t);
    prop.x = this.lane.sideX(side, t);
    const s =
      (GAME.HAVELI_SCALE_FAR + (1 - GAME.HAVELI_SCALE_FAR) * t) *
      prop.getData('baseScale');
    prop.setScale(s);
    prop.setDepth(3 + t);
    prop.setActive(true).setVisible(true);
  }

  /** Spawn a haveli at the far point on the next side (alternates L/R). */
  spawnSide() {
    if (!this.running) return;
    const side = (this._sideToggle = -this._sideToggle);
    this.placeSide(side, 0);
  }

  /**
   * Pre-populate the street so the environment is already built when the game
   * opens (idle/start screen) instead of an empty road. Props sit static until
   * the run begins, then stream toward the camera. Re-run on reset.
   */
  seedScenery() {
    // Video backdrop provides the whole environment → no procedural scenery.
    if (GAME.USE_VIDEO_BG) return;
    this.clearArches();
    this.clearSides();
    this._sideToggle = -1;
    for (const t of [0.15, 0.27, 0.39, 0.51, 0.63, 0.75, 0.87]) {
      this.placeSide(-1, t);
      this.placeSide(1, Math.min(0.95, t + 0.06)); // stagger R so it's not mirrored
    }
    this.placeArch(0.14); // the entrance gateway waiting just ahead at idle
  }

  /** Move havelis toward the camera, scaling + spreading them with depth. */
  advanceSides(move) {
    const bottom = this.lane.nearY + 120;
    for (let i = 0; i < this.sidePool.length; i++) {
      const prop = this.sidePool[i];
      if (!prop.active) continue;
      prop.y += move;
      const t = Phaser.Math.Clamp(this.lane.depthAt(prop.y), 0, 1);
      prop.x = this.lane.sideX(prop.getData('side'), t);
      const s =
        (GAME.HAVELI_SCALE_FAR + (1 - GAME.HAVELI_SCALE_FAR) * t) *
        prop.getData('baseScale');
      prop.setScale(s);
      prop.setDepth(3 + t); // nearer havelis draw over farther ones, below arches
      if (prop.y > bottom) prop.setActive(false).setVisible(false);
    }
  }

  /** Hide all havelis (used on restart/reset). */
  clearSides() {
    for (const prop of this.sidePool) prop.setActive(false).setVisible(false);
  }

  // ---- spawning ------------------------------------------------------------

  spawn() {
    if (!this.running) return;
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

  /**
   * Process callback gating obstacle collisions. Bodies are wide (scaled art),
   * and lanes converge near the far point, so raw body overlap fires across
   * lanes. Only count a hit when the obstacle is in the player's lane AND has
   * arrived in the near collision zone — fair, art-size-independent.
   */
  shouldHit(player, obstacle) {
    if (!obstacle.active) return false;
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
    this.sideTimer.paused = true;
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

  /** Countdown finished (React phase → 'running'): zoom out and run. */
  beginRun() {
    if (this.isOver) return;
    this.endZoom();
    this.setBgPlaying(true); // road starts scrolling exactly when the run does
    this.player.setAnimState('run');
    this.speed = this.level.startSpeed;
    this.running = true;
    this.spawnTimer.paused = false;
    // Side scenery only streams in procedural mode; the video supplies it otherwise.
    if (!GAME.USE_VIDEO_BG) this.sideTimer.paused = false;
    // (In procedural mode the street + entrance arch were seeded at idle.)
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
    this.seedScenery(); // rebuild the idle street (clears + repopulates scenery)
    this.scene.resume(); // game-over pauses the scene; revive it for the anims
    this.setBgPlaying(false); // back to a still idle road until the next run
    this.cameras.main.setZoom(1);
    const { width, height } = this.scale.gameSize;
    this.cameras.main.centerOn(width / 2, height / 2);
    this.player.reset(); // back to center lane + idle
    this.resetRunState();
    this.spawnTimer.paused = true; // stays idle until the next countdown
    this.sideTimer.paused = true;
    EventBus.emit('score-update', 0);
    EventBus.emit('coins-update', 0);
  }

  // ---- lifecycle -----------------------------------------------------------

  handleResize() {
    this.lane.recompute();
    if (this.road) this.road.draw();
    const { width, height } = this.scale.gameSize;
    if (this.sky) this.drawSky(width, height);
    this.fitSkyline();
    this.fitWings();
    this.cameras.main.setBounds(0, 0, width, height);
    this.fitBackground();
    if (this.player && !this.isOver) {
      this.player.setPosition(this.lane.playerX(this.player.laneIndex), this.lane.playerY);
    }
    if (!this.running && !this.isOver) this.seedScenery(); // re-place idle street
  }

  shutdownScene() {
    if (this.bgIsVideo && this.bg?.stop) this.bg.stop(); // stop decoding
    const url = this.registry.get('bgVideoUrl');
    if (url) {
      URL.revokeObjectURL(url);
      this.registry.remove('bgVideoUrl');
    }
    EventBus.off('start-run', this._onStartRun);
    EventBus.off('begin-run', this._onBeginRun);
    EventBus.off('pause', this._onPause);
    EventBus.off('resume', this._onResume);
    EventBus.off('restart', this._onRestart);
    this.scale.off('resize', this.handleResize, this);
  }
}
