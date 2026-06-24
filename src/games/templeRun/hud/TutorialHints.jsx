import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GAME } from '../game/constants';

/**
 * Tutorial overlay shown in the `tutorial` phase (the practice window right
 * after the countdown). Cycles through animated swipe hints — right, left, then
 * up/jump — over GAME.TUTORIAL_MS while the scene runs with no obstacles/coins,
 * so the player can try each control. Calls onDone when the window elapses.
 *
 * pointer-events-none so the swipes/taps still reach the canvas underneath and
 * the player can actually practice.
 */
const STEPS = [
  { id: 'right', label: 'Swipe right', sub: 'Move a lane right', arrow: '→', dx: 64, dy: 0 },
  { id: 'left', label: 'Swipe left', sub: 'Move a lane left', arrow: '←', dx: -64, dy: 0 },
  { id: 'up', label: 'Swipe up', sub: 'Jump over obstacles', arrow: '↑', dx: 0, dy: -64 },
];

export function TutorialHints({ onDone }) {
  const [i, setI] = useState(0);
  const stepMs = Math.max(1, Math.round(GAME.TUTORIAL_MS / STEPS.length));

  useEffect(() => {
    if (i >= STEPS.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setI((n) => n + 1), stepMs);
    return () => clearTimeout(t);
  }, [i, stepMs, onDone]);

  if (i >= STEPS.length) return null;
  const step = STEPS[i];

  return (
    <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          className="flex flex-col items-center gap-5"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          {/* The "swipe puck": a directional arrow that slides in the gesture
              direction on a loop to mime the finger swipe. */}
          <motion.div
            className="grid h-20 w-20 place-items-center rounded-full bg-brand-400/90 text-4xl font-black text-royal-950 shadow-glow"
            animate={{ x: [0, step.dx, 0], y: [0, step.dy, 0], opacity: [0.55, 1, 0.55] }}
            transition={{ duration: 1.05, repeat: Infinity, ease: 'easeInOut' }}
          >
            {step.arrow}
          </motion.div>
          <div className="glass-card rounded-pill px-6 py-3 text-center">
            <p className="text-hud text-xl font-bold text-ink">{step.label}</p>
            <p className="text-hud mt-0.5 text-xs text-ink-muted">{step.sub}</p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
