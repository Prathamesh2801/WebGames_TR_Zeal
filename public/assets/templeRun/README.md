# Temple Run — art assets

Drop PNG files in **this folder** to replace the generated placeholder shapes.
Each file is optional: if it's missing, the game falls back to the colored
placeholder, so things always run. The moment you add a file with the right
name, it's picked up automatically (no code change needed).

Loaded by `src/games/templeRun/game/scenes/BootScene.js`. Vite serves `/public`
at the site root, so `public/assets/templeRun/player.png` → `/assets/templeRun/player.png`.

## Files this folder expects

| File           | Used for      | Suggested size | Notes |
|----------------|---------------|----------------|-------|
| `player.png`   | The runner    | ~56 × 84 px    | Seen from **behind** (running away down the track), not side-on. |
| `obstacle.png` | Obstacle prop | ~64 × 64 px    | Rock / barrier / log, etc. |
| `coin.png`     | Collectible   | ~36 × 36 px    | A round coin. |
| `parallax.png` | Background    | **450 px wide**, tall | Sky / temple horizon. Must **tile seamlessly top↔bottom** (it scrolls vertically). Scrolls slower than the road for depth. |

`450` is `GAME.BASE_WIDTH` in `game/constants.js` — keep `parallax.png` at that
width so it lines up with the playfield.

> **No `road.png`.** The road/track is drawn procedurally with perspective
> (converging lanes + scrolling dashes) in `game/objects/Road.js`. Edit the
> colors there to re-theme it.

> **Animation is free for now.** The coin **spin** and the player **run-bob**
> are animated at runtime in code, so even a single static `coin.png` /
> `player.png` will appear to move. Drop in a real **sprite sheet** later (see
> below) to use authored frame-by-frame animation instead.

## Want animation (run cycle, spinning coin)?

Use a horizontal sprite-sheet and change the entry in `BootScene.js`'s
`ASSET_FILES` from a string to an object, e.g.:

```js
[TEXTURES.PLAYER]: { sheet: `${ASSET_BASE}/player.png`, frameWidth: 56, frameHeight: 84 },
```

Then register the animation in `BootScene.create()` and `.play()` it on the
sprite (see Player.js). The loader already supports this form.
