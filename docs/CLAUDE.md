# CLAUDE.md

Project conventions and guardrails for Claude Code. Read this before making changes.

## What we're building

A 2.5D lane-runner web game ("Udaipur Temple Run") for the CIB engagement app, built with **Phaser 3 mounted inside a single React component**. Right now we are building **v1 only** — a playable proof-of-concept with placeholder graphics.

**Authoritative spec:** see the game flow & build spec (`Udaipur_Temple_Run_GameFlow_Spec.md`). If this file and the spec ever conflict, ask before proceeding.

## Tech stack (do not change without asking)

- React + Vite + **JSX** (not TypeScript — keep `.jsx`)
- TailwindCSS v4 (via `@tailwindcss/vite`)
- Framer Motion (UI transitions)
- react-hot-toast (notifications)
- Phaser 3 — the **only** new dependency for this work

Do not introduce TypeScript, CSS-in-JS, Redux, or other state libraries. Do not add heavyweight dependencies without asking first.

## Design system conventions

- Use the project's existing design tokens (CSS custom properties in `index.css`: color scale, semantic tokens, spacing / radius / shadow / easing). **Do not hardcode colors or magic spacing values** — use the tokens / Tailwind utilities that map to them.
- Typography: Sora for display/headings, DM Sans for body. Use the existing font setup.
- Reuse existing utility classes (e.g. `.glass-card`) and patterns rather than inventing new ones.
- All React UI is styled with Tailwind. Keep HUD text legible over the canvas (text shadow or a semi-opaque pill behind it).

## React ↔ Phaser boundary (critical)

- **Phaser code lives only under `src/games/templeRun/game/`.** Never import Phaser outside that folder. The rest of the app must not know Phaser exists.
- **React owns:** routing, start/pause/game-over screens, the HUD overlay, and the final-score callback.
- **Phaser owns:** only what's inside the `<canvas>` — the game loop, sprites, physics.
- They communicate **only** through the shared `EventBus` (see spec §7). No direct cross-calls.
- **Lazy-load / code-split** the game so Phaser (~1MB) loads only on this screen.
- **Clean teardown:** on component unmount, destroy the Phaser game (`game.destroy(true)`) and remove all EventBus listeners. Removing listeners on scene `shutdown` too.
- **Never call React `setState` per frame.** Only update React via the throttled EventBus events defined in the spec.

## Performance rules (bake in from the start)

- Object pooling for obstacles and coins — reuse, never create/destroy mid-run.
- Delta-time for all movement and scrolling (device-independent speed).
- `type: Phaser.AUTO` (WebGL with Canvas fallback); arcade physics only (no Matter.js).
- Cap device pixel ratio to ~2 on the canvas.
- Pull all tunables from the `GAME` constants in `game/config.js` — no magic numbers in scenes.

## Assets (v1)

- Generate placeholder textures at runtime in `BootScene` (colored shapes). **No asset downloads in v1.**
- Mark each placeholder with `// TODO: replace with atlas frame` so real free (CC0) sprites can be swapped in later without touching gameplay code.

## Scope guardrails (don't over-build)

Build **only** what v1 requires. Do **not** add, unless explicitly asked:
- Jump / slide (v1 dodges by lane-switching only)
- Multiple levels / the 6-level structure
- Quiz pop-ups, hidden-object stages, scroll-fragment assembly
- Real art, audio, particle polish
- Team scoring, leaderboard, or backend submission (stub the `onComplete(score)` callback)

Leave clean extension points (e.g. `levelConfig`) but don't implement future features early.

## Code style

- Functional components + hooks only. Keep components small and single-purpose.
- Match the existing project's file naming and import-alias conventions (e.g. `@/`).
- Prefer clear, readable code over cleverness. Comment only non-obvious game-loop math.
- Don't reformat or refactor unrelated existing files.

## Workflow

- Follow the build order in spec §14, and verify against the §13 acceptance criteria before calling a step done.
- Get the React mount/unmount + teardown lifecycle working **first** (before gameplay) to avoid leaks.
- When unsure about scope or a stack choice, ask rather than assume.
