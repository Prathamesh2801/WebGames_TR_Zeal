import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { EventBus } from './game/EventBus';
import { StartScreen } from './hud/StartScreen';
import { Hud } from './hud/Hud';
import { GameOverScreen } from './hud/GameOverScreen';

/**
 * Mounts the Phaser game and owns the phase state machine + EventBus wiring
 * (spec §4, §8). React owns all screens/overlays; Phaser owns the canvas.
 *
 * Phases: loading → ready → running ⇄ paused, running → over.
 */
export default function TempleRun({ onComplete }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);

  const [phase, setPhase] = useState('loading');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // Create the Phaser game once; tear it down fully on unmount.
  useEffect(() => {
    const game = new Phaser.Game(createGameConfig(containerRef.current));
    gameRef.current = game;

    const onReady = () => setPhase('ready');
    const onScore = (s) => setScore(s);
    const onCoins = (c) => setCoins(c);
    const onGameOver = (final) => {
      setFinalScore(final);
      setPhase('over');
      onComplete?.(final);
    };

    EventBus.on('ready', onReady);
    EventBus.on('score-update', onScore);
    EventBus.on('coins-update', onCoins);
    EventBus.on('game-over', onGameOver);

    return () => {
      EventBus.off('ready', onReady);
      EventBus.off('score-update', onScore);
      EventBus.off('coins-update', onCoins);
      EventBus.off('game-over', onGameOver);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [onComplete]);

  // ---- phase actions -------------------------------------------------------

  const start = useCallback(() => {
    setScore(0);
    setCoins(0);
    setPhase('running');
    EventBus.emit('resume');
  }, []);

  const pause = useCallback(() => {
    setPhase((p) => {
      if (p !== 'running') return p;
      EventBus.emit('pause');
      return 'paused';
    });
  }, []);

  const resume = useCallback(() => {
    setPhase((p) => {
      if (p !== 'paused') return p;
      EventBus.emit('resume');
      return 'running';
    });
  }, []);

  const retry = useCallback(() => {
    setScore(0);
    setCoins(0);
    setPhase('running');
    EventBus.emit('restart');
  }, []);

  const restartToStart = useCallback(() => {
    // From pause → back to Start screen (scene reset but idle).
    EventBus.emit('restart');
    EventBus.emit('pause');
    setScore(0);
    setCoins(0);
    setPhase('ready');
  }, []);

  // Desktop pause keys (Esc / P) — React owns pause UI (spec §5 controls).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' && e.key !== 'p' && e.key !== 'P') return;
      setPhase((p) => {
        if (p === 'running') {
          EventBus.emit('pause');
          return 'paused';
        }
        if (p === 'paused') {
          EventBus.emit('resume');
          return 'running';
        }
        return p;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface select-none">
      {/* Phaser canvas parent */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Loading */}
      {phase === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-hud text-ink-muted">
          Loading…
        </div>
      )}

      {phase === 'ready' && <StartScreen onStart={start} />}

      {(phase === 'running' || phase === 'paused') && (
        <Hud score={score} coins={coins} onPause={pause} />
      )}

      {phase === 'paused' && (
        <GameOverScreen
          paused
          score={score + coins * 10}
          onResume={resume}
          onRestart={restartToStart}
        />
      )}

      {phase === 'over' && (
        <GameOverScreen score={finalScore} onRetry={retry} onExit={() => onComplete?.(finalScore)} />
      )}
    </div>
  );
}
