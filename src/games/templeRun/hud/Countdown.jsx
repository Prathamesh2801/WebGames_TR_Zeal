import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SEQUENCE = ['3', '2', '1', 'GO!'];
const STEP_MS = 650; // keep in step with the camera zoom in RunScene.startZoom

/**
 * Full-screen 3·2·1·GO! overlay shown in the `countdown` phase while the Phaser
 * camera zooms in on the idling player. Calls onDone after the last step, which
 * flips the phase to `running` and tells the scene to begin the run.
 *
 * pointer-events-none so swipes/taps still reach the canvas underneath.
 */
export function Countdown({ onDone }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= SEQUENCE.length) {
      onDone();
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [step, onDone]);

  if (step >= SEQUENCE.length) return null;

  const isGo = SEQUENCE[step] === 'GO!';

  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <AnimatePresence mode="popLayout">
        <motion.span
          key={step}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.7, opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
          className={`text-hud font-[var(--font-display)] font-extrabold drop-shadow-[0_6px_28px_rgba(0,0,0,0.65)] ${
            isGo ? 'text-7xl text-brand-300' : 'text-9xl text-ink'
          }`}
        >
          {SEQUENCE[step]}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
