import { motion } from 'framer-motion';

/**
 * Centered overlay used for both the paused state and game-over state
 * (same layout, different copy/actions — spec §4 phase table).
 *
 * Paused: pass `paused`, `onResume`, `onRestart`.
 * Game over: pass `onRetry`, `onExit`.
 */
export function GameOverScreen({ paused, score, onResume, onRestart, onRetry, onExit }) {
  return (
    <motion.div
      className="absolute inset-0 grid place-items-center bg-surface/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        className="glass-card rounded-card mx-6 w-full max-w-sm px-8 py-9 text-center"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ease: [0.2, 0.8, 0.2, 1], duration: 0.35 }}
      >
        <h2 className="text-hud text-3xl font-extrabold text-ink">
          {paused ? 'Paused' : 'Game Over'}
        </h2>

        <p className="text-hud mt-1 text-xs font-semibold tracking-[0.25em] text-ink-muted uppercase">
          {paused ? 'Score' : 'Final Score'}
        </p>
        <p className="text-hud text-5xl font-extrabold text-brand-300">{score}</p>

        <div className="mt-8 flex flex-col gap-3">
          {paused ? (
            <>
              <Btn primary onClick={onResume}>
                Resume
              </Btn>
              <Btn onClick={onRestart}>Restart</Btn>
            </>
          ) : (
            <>
              <Btn primary onClick={onRetry}>
                Retry
              </Btn>
              <Btn onClick={onExit}>Exit</Btn>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function Btn({ primary, onClick, children }) {
  const base =
    'text-hud w-full rounded-pill px-8 py-3 text-lg font-bold transition-transform duration-150 ease-[var(--ease-snap)] hover:scale-[1.03] active:scale-95';
  const style = primary
    ? 'bg-brand-400 text-royal-950 shadow-glow'
    : 'glass-card text-ink';
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {children}
    </button>
  );
}
