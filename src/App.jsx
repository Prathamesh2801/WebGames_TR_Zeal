import { lazy, Suspense } from 'react'
import { Toaster } from 'react-hot-toast'

// Code-split: Phaser (~1MB) only loads when the game screen mounts (spec §3, §12).
const TempleRun = lazy(() => import('@/games/templeRun/TempleRun'))

export default function App() {
  return (
    <div className="h-dvh w-screen bg-surface">
      <Suspense
        fallback={
          <div className="grid h-full place-items-center text-hud text-ink-muted">
            Loading…
          </div>
        }
      >
        <TempleRun onComplete={(score) => console.log('final score', score)} />
      </Suspense>
      <Toaster position="bottom-center" />
    </div>
  )
}
