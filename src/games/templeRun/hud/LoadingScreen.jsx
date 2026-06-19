import { motion } from 'framer-motion';

/**
 * Loading overlay shown during the `loading` phase. `progress` is 0–1 from the
 * Phaser loader (dominated by the video download); we hold here until BootScene
 * → RunScene reports `ready` (video first frame decoded), so the game never
 * flashes an un-rendered backdrop.
 */
export function LoadingScreen({ progress = 0 }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="absolute inset-0 grid place-items-center bg-surface">
      <div className="w-full max-w-xs px-10 text-center">
        <p className="text-hud text-brand-300 text-sm font-semibold tracking-[0.25em] uppercase">
          Udaipur
        </p>
        <h1 className="text-hud mt-1 font-[var(--font-display)] text-3xl font-extrabold text-ink">
          Temple Run
        </h1>

        <div className="mt-8 h-2 w-full overflow-hidden rounded-pill bg-white/10">
          <motion.div
            className="h-full rounded-pill bg-brand-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ ease: 'linear', duration: 0.2 }}
          />
        </div>
        <p className="text-hud mt-3 text-xs font-medium text-ink-muted">
          Loading… {pct}%
        </p>
      </div>
    </div>
  );
}
