import Phaser from 'phaser';

/**
 * Single shared event emitter — the ONLY bridge between React and Phaser.
 * See spec §7 for the full event contract.
 *
 * Phaser → React: 'ready', 'score-update', 'coins-update', 'game-over'
 * React → Phaser: 'pause', 'resume', 'restart'
 */
export const EventBus = new Phaser.Events.EventEmitter();
