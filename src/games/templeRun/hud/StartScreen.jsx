import { motion } from 'framer-motion';

/**
 * Intro overlay shown in the `ready` phase. On Start → run begins.
 */
export function StartScreen({ onStart }) {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-surface/60 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="glass-card rounded-card mx-6 max-w-sm px-8 py-10 text-center"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.4 }}
      >
        <p className="text-hud text-brand-300 text-sm font-semibold tracking-[0.25em] uppercase">
          Udaipur
        </p>
        <h1 className="text-hud mt-2 font-[var(--font-display)] text-4xl font-extrabold text-ink">
          Temple Run
        </h1>
        <p className="mt-4 text-sm text-ink-muted">
          Swipe left / right (or ← → / A D) to switch lanes. Swipe up (or ↑ / W /
          Space) to jump over obstacles. Grab coins, dodge everything else.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="text-hud mt-8 w-full rounded-pill bg-brand-400 px-8 py-3 text-lg font-bold text-royal-950 shadow-glow transition-transform duration-150 ease-[var(--ease-snap)] hover:scale-[1.03] active:scale-95"
        >
          Start
        </button>
      </motion.div>
    </motion.div>
  );
}
