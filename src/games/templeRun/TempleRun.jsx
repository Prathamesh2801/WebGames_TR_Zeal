import { useEffect, useRef, useState, useCallback } from 'react';
import Phaser from 'phaser';
import { createGameConfig } from './game/config';
import { EventBus } from './game/EventBus';
import { GAME } from './game/constants';
import { LoadingScreen } from './hud/LoadingScreen';
import { StartScreen } from './hud/StartScreen';
import { Hud } from './hud/Hud';
import { Countdown } from './hud/Countdown';
import { TutorialHints } from './hud/TutorialHints';
import { GameOverScreen } from './hud/GameOverScreen';

/**
 * Mounts the Phaser game and owns the phase state machine + EventBus wiring
 * (spec §4, §8). React owns all screens/overlays; Phaser owns the canvas.
 *
 * Phases: loading → ready → countdown → tutorial → running ⇄ paused, running → over.
 */
export default function TempleRun({ onComplete }) {
  const containerRef = useRef(null);
  const gameRef = useRef(null);
  // The control tutorial plays once per session (after the first Start), then
  // retries skip straight from the countdown into the run.
  const tutorialShownRef = useRef(false);

  const [phase, setPhase] = useState('loading');
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [finalScore, setFinalScore] = useState(0);

  // Create the Phaser game once; tear it down fully on unmount.
  useEffect(() => {
    const game = new Phaser.Game(createGameConfig(containerRef.current));
    gameRef.current = game;

    const onReady = () => setPhase('ready');
    const onProgress = (v) => setProgress(v);
    const onScore = (s) => setScore(s);
    const onCoins = (c) => setCoins(c);
    const onGameOver = (final) => {
      setFinalScore(final);
      setPhase('over');
      onComplete?.(final);
    };

    EventBus.on('ready', onReady);
    EventBus.on('load-progress', onProgress);
    EventBus.on('score-update', onScore);
    EventBus.on('coins-update', onCoins);
    EventBus.on('game-over', onGameOver);

    return () => {
      EventBus.off('ready', onReady);
      EventBus.off('load-progress', onProgress);
      EventBus.off('score-update', onScore);
      EventBus.off('coins-update', onCoins);
      EventBus.off('game-over', onGameOver);
      game.destroy(true);
      gameRef.current = null;
    };
  }, [onComplete]);

  // ---- phase actions -------------------------------------------------------

  // Start tapped: reset HUD, show the 3·2·1 overlay and tell the scene to zoom
  // in on the idling player. The run itself begins in onCountdownDone.
  const start = useCallback(() => {
    setScore(0);
    setCoins(0);
    setPhase('countdown');
    EventBus.emit('start-run');
  }, []);

  // Countdown finished. First time this session: enter the no-spawn tutorial so
  // the player can learn the controls (skipped if TUTORIAL_MS is 0). Afterwards
  // (retries), go straight into the run.
  const onCountdownDone = useCallback(() => {
    if (!tutorialShownRef.current && GAME.TUTORIAL_MS > 0) {
      tutorialShownRef.current = true;
      setPhase('tutorial');
      EventBus.emit('begin-tutorial');
    } else {
      setPhase('running');
      EventBus.emit('begin-run');
    }
  }, []);

  // Tutorial window elapsed: hide the hints and start the real run (spawns on).
  const onTutorialDone = useCallback(() => {
    setPhase('running');
    EventBus.emit('begin-run');
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

  // Retry: reset the scene to idle, then run the same countdown as a fresh start.
  const retry = useCallback(() => {
    setScore(0);
    setCoins(0);
    EventBus.emit('restart');
    setPhase('countdown');
    EventBus.emit('start-run');
  }, []);

  const restartToStart = useCallback(() => {
    // From pause → back to Start screen (scene reset, idle + animating).
    EventBus.emit('restart');
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
    // Letterbox backdrop: the game lives in a centered, max-width 9:16 column so
    // the portrait (mobile) video is shown in full — never cover-cropped — and
    // desktop plays as a centered phone column with bars on the sides.
    <div className="relative grid h-full w-full place-items-center overflow-hidden bg-black select-none">
      <div
        className="relative overflow-hidden bg-surface"
        style={{
          // Fill the screen height (no letterbox on tall phones) with a width
          // capped at 480px so desktop is a centered phone column. The video
          // cover-fills this box; lanes are pinned to the video (see Lane.js).
          height: '100%',
          width: 'min(100%, 480px)',
        }}
      >
        {/* Phaser canvas parent (canvas = this 9:16 column) */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* Loading */}
        {phase === 'loading' && <LoadingScreen progress={progress} />}

        {phase === 'ready' && <StartScreen onStart={start} />}

        {phase === 'countdown' && <Countdown onDone={onCountdownDone} />}

        {phase === 'tutorial' && <TutorialHints onDone={onTutorialDone} />}

        {(phase === 'tutorial' || phase === 'running' || phase === 'paused') && (
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
    </div>
  );
}
