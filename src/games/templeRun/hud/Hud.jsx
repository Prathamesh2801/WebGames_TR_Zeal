/**
 * Top HUD overlay: score + coin count + pause button.
 * pointer-events-none everywhere except the pause button so taps/swipes
 * still reach the canvas (spec §8).
 */
export function Hud({ score, coins, onPause }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4">
      <div className="flex gap-3">
        <Pill label="Score" value={score} />
        <Pill label="Coins" value={coins} accent />
      </div>

      <button
        type="button"
        onClick={onPause}
        aria-label="Pause"
        className="text-hud pointer-events-auto glass-card grid h-11 w-11 place-items-center rounded-pill text-ink transition-transform duration-150 ease-[var(--ease-snap)] active:scale-90"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <rect x="3" y="2" width="3.5" height="12" rx="1" />
          <rect x="9.5" y="2" width="3.5" height="12" rx="1" />
        </svg>
      </button>
    </div>
  );
}

function Pill({ label, value, accent }) {
  return (
    <div className="glass-card rounded-pill px-4 py-2">
      <span className="text-hud text-[10px] font-semibold tracking-widest text-ink-muted uppercase">
        {label}
      </span>
      <div className={`text-hud text-xl font-bold ${accent ? 'text-brand-300' : 'text-ink'}`}>
        {accent ? '🪙 ' : ''}
        {value}
      </div>
    </div>
  );
}
