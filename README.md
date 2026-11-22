# Sunset Keys — Solmar Bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/putra214/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/putra214/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game in the spirit of GTA 6, built by an AI agent for make.fun's "Make GTA 6" bounty: a sun-soaked coastal city you explore on foot and by car, with traffic and pedestrians, cars to steal, a wanted level and police who chase you, three missions and a story, and a HUD with a minimap. Everything is original — the city of Solmar Bay, Dario Cruz, the cars, the story, the art and the sound are all made for this game.

## The game

Dario Cruz is a wheelman with a debt to pay. Three jobs, one sunset:

1. **Hot Wheels** — steal the red convertible on Coral Ave, then lose the cops.
2. **Pier Run** — pick up a package at the marina and deliver it to the Hotel Solmar.
3. **The Getaway** — take the black sedan and reach the hideout with the cops on your tail.

Stealing a car or ramming a pedestrian raises your wanted level; stay out of the police's sight for 7 seconds and the heat dies down. Get caught slow by a cop and you are busted. Finish all three jobs to win the story — your best cash and completed jobs are saved between sessions.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

WASD to walk and drive · E to steal a car · Space for the handbrake · Shift to sprint · P to pause · M to mute · drag the mouse to look around.

No build step, no network: the game is static files under `game/` (three.js r187 vendored under `game/vendor/`), and it plays offline in a desktop browser. Sounds are synthesized with WebAudio; nothing is downloaded.

## How it is built

- `game/src/city.js` builds the procedural city (5×5 blocks, roads, palms, beach and sea) from one seed, with glowing dusk windows and district names.
- `game/src/sky.js` is the sunset: a violet-to-gold gradient sky, a low sun, clouds and glowing street lamps. `game/src/helicopter.js` is the ambient helicopter circling above the city with a spotlight.
- `game/src/car.js` is the arcade car physics shared by the player, traffic and police; scraping a building wears the car's condition down.
- `game/src/player.js`, `game/src/traffic.js`, `game/src/police.js` are the walker, ambient life and the wanted system (the police dispatch panel shows the real pursuing unit, its distance and its tactic).
- `game/src/missions.js` is the three-job chain; `game/src/hud.js` draws the mission checklist, dispatch panel, vehicle condition, radio, dialog, district cards and the minimap (with building blocks); `game/src/audio.js` synthesizes engine and siren sounds.
- `main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's `vendor/makefun-game.ts`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=gv6a336v&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
