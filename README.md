# neon-bay-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Arcazero/neon-bay-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Arcazero/neon-bay-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Neon Bay** — an open-world crime game in the spirit of GTA 6, built for make.fun's "Make GTA 6" bounty. A sun-soaked coastal city on the fictional island of Costa Luna, explored on foot and by car, with traffic and pedestrians, cars to steal and drive, a five-star wanted level with police who chase and ram, five story missions for Rio Vega, combat, a HUD with a live minimap, a start screen, and saves.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step, no network — every file the game loads sits under `game/`.

## How to play

- **WASD / arrows** — move on foot, drive in a car
- **E** — steal / enter a car, get out again
- **Mouse** — aim, **click** — shoot, **F** — punch, **Shift** — sprint
- **Space** — handbrake while driving
- **M** — start the next story mission, **P** — pause, **H** — mute

Finish all five missions — First Wheels, The Package, Hot Pursuit, Getaway Driver, The Big Score — to pay off Rio's debt to Marisol Kane. Progress saves automatically in your browser.

## Layout

- `game/` — the whole game, plain static files (`index.html` + ES modules under `src/`)
- `screenshots/` — 3–4 screenshots of the game itself
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`
- `serve.ts` — local static server for play-testing
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=ackjrmv3&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
