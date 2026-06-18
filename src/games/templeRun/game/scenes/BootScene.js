import Phaser from 'phaser';
import { GAME, TEXTURES } from '../constants';

/**
 * Where real art lives. Files go in /public, which Vite serves at the site
 * root — e.g. public/assets/templeRun/player.png → '/assets/templeRun/player.png'.
 * Drop a PNG in here and it's used automatically; anything missing falls back
 * to the generated placeholder below, so the game always runs (spec §9).
 *
 * To animate the player or coin, change its entry from a string to a
 * { sheet, frameWidth, frameHeight } object (see loadAssets()).
 */
const ASSET_BASE = '/assets/templeRun';
const ASSET_FILES = {
  [TEXTURES.PLAYER]: `${ASSET_BASE}/player.png`,
  [TEXTURES.OBSTACLE]: `${ASSET_BASE}/obstacle.png`,
  [TEXTURES.COIN]: `${ASSET_BASE}/coin.png`,
  [TEXTURES.PARALLAX]: `${ASSET_BASE}/parallax.png`,
  // Note: the road is drawn procedurally with perspective (see objects/Road.js),
  // so there is no road.png to supply.
};

/**
 * Loads real art if present, otherwise generates placeholder textures at
 * runtime so v1 runs with zero asset files (spec §9), then launches RunScene.
 * Gameplay code only ever references the TEXTURES keys, so swapping art in
 * never touches the scenes/objects.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.loadAssets();
  }

  create() {
    // For any texture that didn't load (file absent or failed), draw the
    // placeholder shape so the key always resolves.
    if (!this.textures.exists(TEXTURES.PLAYER)) this.makePlayerTexture();
    if (!this.textures.exists(TEXTURES.OBSTACLE)) this.makeObstacleTexture();
    if (!this.textures.exists(TEXTURES.COIN)) this.makeCoinTexture();
    if (!this.textures.exists(TEXTURES.PARALLAX)) this.makeParallaxTexture();

    // RunScene emits 'ready' once its setup completes (spec §6).
    this.scene.start('RunScene');
  }

  // ---- real-art loading ----------------------------------------------------

  loadAssets() {
    // A missing file 404s; we swallow the loader error and fall back in create.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {});

    for (const [key, entry] of Object.entries(ASSET_FILES)) {
      if (typeof entry === 'string') {
        this.load.image(key, entry);
      } else {
        // Sprite-sheet form: { sheet, frameWidth, frameHeight }.
        this.load.spritesheet(key, entry.sheet, {
          frameWidth: entry.frameWidth,
          frameHeight: entry.frameHeight,
        });
      }
    }
  }

  // Placeholder runner seen from behind (head, backpack, arms, legs) so the
  // forward-running perspective reads correctly. Replace with player.png.
  makePlayerTexture() {
    const w = 56;
    const h = 84;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    // Legs.
    g.fillStyle(0x3f3550, 1);
    g.fillRoundedRect(w * 0.3, h * 0.66, w * 0.16, h * 0.3, 5);
    g.fillRoundedRect(w * 0.54, h * 0.66, w * 0.16, h * 0.3, 5);
    // Shoes.
    g.fillStyle(0xe2e8f0, 1);
    g.fillRoundedRect(w * 0.29, h * 0.92, w * 0.18, h * 0.07, 3);
    g.fillRoundedRect(w * 0.53, h * 0.92, w * 0.18, h * 0.07, 3);
    // Arms.
    g.fillStyle(0xe0a93b, 1);
    g.fillRoundedRect(w * 0.08, h * 0.34, w * 0.14, h * 0.28, 6);
    g.fillRoundedRect(w * 0.78, h * 0.34, w * 0.14, h * 0.28, 6);
    // Torso.
    g.fillStyle(0xffc44d, 1);
    g.fillRoundedRect(w * 0.18, h * 0.3, w * 0.64, h * 0.42, 12);
    // Backpack.
    g.fillStyle(0xd9534f, 1);
    g.fillRoundedRect(w * 0.3, h * 0.35, w * 0.4, h * 0.3, 8);
    g.fillStyle(0xb23b38, 1);
    g.fillRoundedRect(w * 0.4, h * 0.4, w * 0.2, h * 0.18, 5);
    // Head + hair.
    g.fillStyle(0x8a5a2b, 1);
    g.fillCircle(w * 0.5, h * 0.2, w * 0.19);
    g.fillStyle(0x2f2012, 1);
    g.fillCircle(w * 0.5, h * 0.16, w * 0.18);
    g.generateTexture(TEXTURES.PLAYER, w, h);
    g.destroy();
  }

  // Placeholder stone block with shaded top + warning chevrons. Replace with
  // obstacle.png.
  makeObstacleTexture() {
    const w = 64;
    const h = 64;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xb91c1c, 1); // shadowed body
    g.fillRoundedRect(0, h * 0.18, w, h * 0.82, 10);
    g.fillStyle(0xef4444, 1); // lit top face
    g.fillRoundedRect(0, 0, w, h * 0.4, 10);
    // Warning chevrons.
    g.fillStyle(0xfde047, 1);
    for (let i = -1; i < 3; i++) {
      g.fillTriangle(
        i * 22 + 8, h * 0.95,
        i * 22 + 24, h * 0.55,
        i * 22 + 30, h * 0.55,
      );
      g.fillTriangle(
        i * 22 + 30, h * 0.55,
        i * 22 + 14, h * 0.95,
        i * 22 + 8, h * 0.95,
      );
    }
    g.generateTexture(TEXTURES.OBSTACLE, w, h);
    g.destroy();
  }

  // Placeholder gold coin with rim, inner ring and shine. The spin is animated
  // at runtime (scaleX) in RunScene. Replace with coin.png.
  makeCoinTexture() {
    const r = 18;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0xb6890b, 1); // rim
    g.fillCircle(r, r, r);
    g.fillStyle(0xffd54a, 1); // face
    g.fillCircle(r, r, r - 3);
    g.lineStyle(2, 0xe9b949, 1); // inner ring
    g.strokeCircle(r, r, r - 7);
    g.fillStyle(0xfff3c4, 0.9); // shine highlight
    g.fillCircle(r - 5, r - 5, 3);
    g.generateTexture(TEXTURES.COIN, r * 2, r * 2);
    g.destroy();
  }

  // Placeholder night sky with a faint horizon glow + stars. Tiles vertically.
  // Replace with parallax.png.
  makeParallaxTexture() {
    const w = GAME.BASE_WIDTH;
    const h = 256;
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    g.fillStyle(0x110e2e, 1);
    g.fillRect(0, 0, w, h);
    g.fillStyle(0x231a4d, 0.8);
    g.fillRect(0, h * 0.62, w, h * 0.38);
    g.fillStyle(0x3a2a6b, 0.5);
    g.fillRect(0, h * 0.82, w, h * 0.18);
    // Scattered stars.
    g.fillStyle(0xc7d2fe, 0.9);
    for (let i = 0; i < 40; i++) {
      const x = (i * 97) % w;
      const y = (i * 53) % Math.floor(h * 0.6);
      g.fillCircle(x, y, (i % 3) === 0 ? 1.6 : 1);
    }
    g.generateTexture(TEXTURES.PARALLAX, w, h);
    g.destroy();
  }
}
