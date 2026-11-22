// Sunset Keys — a working gta6-01 entry (Node 22, standard library only).
// The game is this directory's game/ folder: a three.js open-world crime
// game set in Solmar Bay at sunset, plain static files a desktop browser
// loads offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/, no network request). The program hands it in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. The sunset polish (2026-11-23) reworked the sky, the
// lighting, the HUD and the cameras in-session; the screenshots below were
// retaken from the polished game, all four of them staged live in ?shot=
// scenes: the title screen, a police chase, Dario on foot, and the career
// stats screen. Polish 3 (2026-11-23) rebuilt the visuals again in-session:
// detailed car models (glass, lamps, rims, bumpers), segmented walkers with
// a walk cycle, five facade variants with signs, posters and roof props,
// soft shadows, asphalt and sidewalk textures, layered swaying palms,
// curved street lamps with real light pools, gutter steam, scattered trash,
// a procedural city ambience loop, and an optional UnrealBloomPass
// (?bloom=1, vendored under game/vendor/addons/).
// Play it: walk Coral Ave as Dario Cruz, steal the red convertible (E),
// lose the cops, run the pier delivery, take the black sedan to the hideout.
// Screenshots are real frames of the game (see shots.json for the scenes).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
