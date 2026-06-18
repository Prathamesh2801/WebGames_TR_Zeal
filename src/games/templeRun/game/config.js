import Phaser from 'phaser';
import { GAME, TEXTURES } from './constants';
import { BootScene } from './scenes/BootScene';
import { RunScene } from './scenes/RunScene';

// Re-export so existing `from '../config'` imports keep working.
export { GAME, TEXTURES };

/**
 * Build the Phaser.Game config for a given parent DOM element.
 * type AUTO (WebGL w/ Canvas fallback), RESIZE + CENTER_BOTH, arcade physics.
 */
export function createGameConfig(parent) {
  return {
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#14122b',
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: GAME.BASE_WIDTH,
      height: GAME.BASE_HEIGHT,
    },
    render: {
      powerPreference: 'high-performance',
      antialias: true,
    },
    // DPR note (spec §12): Phaser 3's RESIZE scale mode renders the canvas at
    // CSS-pixel resolution, so high-DPR phones don't over-render by default.
    // GAME.MAX_DPR documents the intended cap if manual canvas scaling is added.
    physics: {
      default: 'arcade',
      arcade: { debug: false },
    },
    scene: [BootScene, RunScene],
  };
}
