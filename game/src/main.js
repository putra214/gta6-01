// Sunset Keys — bootstrap, game loop, and the rules that tie the systems
// together: walk, steal a car, drive, get wanted, lose the cops, run the
// three jobs for Dario Cruz, and bank the cash. The city is Solmar Bay, a
// sun-soaked coastal town of its own; nothing here is from a commercial game.
import * as THREE from 'three';
import { CITY, COLORS, CAR, WANTED, TRAFFIC } from './config.js';
import { buildCity } from './city.js';
import { buildSky, SUN_DIR } from './sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { AmbientHelicopter } from './helicopter.js';
import { mulberry32 } from './random.js';
import { Walker, makeWalkerMesh } from './player.js';
import { ArcadeCar, makeCarMesh } from './car.js';
import { buildTraffic } from './traffic.js';
import { Police } from './police.js';
import { ChaseCamera } from './camera.js';
import { Hud } from './hud.js';
import { GameAudio } from './audio.js';
import { createMissions } from './missions.js';
import { createInput } from './input.js';

const SEED = 20261122;
const SAVE_KEY = 'sunset-keys-save-v1';

// ---------------------------------------------------------------------------
// Scene setup
// ---------------------------------------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
// Cinematic grade: filmic tone mapping (teal-orange dusk) and soft shadows.
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.fog, 80, 300); // thicker haze for depth

// Low warm sun from the south-west, the direction the sunset comes from.
// It casts soft shadows; the shadow frustum follows the player so the
// shadows stay crisp where the camera is.
const sun = new THREE.DirectionalLight(COLORS.sun, 2.4);
sun.position.copy(SUN_DIR).multiplyScalar(220);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -110;
sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110;
sun.shadow.camera.bottom = -110;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 520;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.6;
scene.add(sun);
scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0x9a7ab0, 0x7a5540, 1.3));

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
const chase = new ChaseCamera(camera);

const city = buildCity(scene, SEED);
buildSky(scene, city.roadLines);
const heli = new AmbientHelicopter(scene);
const hud = new Hud(document);
const audio = new GameAudio();
const input = createInput(canvas);
const police = new Police(scene);
const missions = createMissions(city);
const { traffic, pedestrians } = buildTraffic(scene, city, SEED);

// The walker, Dario Cruz, starts on the sidewalk of Coral Ave near the red convertible.
const walker = new Walker(makeWalkerMesh(), 0, -72);
scene.add(walker.mesh);

// Stealable cars, parked ON roads so the approach is never blocked.
function parkStealable(color, x, z, heading, variant = 'sedan') {
  const mesh = makeCarMesh(color, 'player', variant);
  scene.add(mesh);
  const car = new ArcadeCar(mesh, x, z, heading);
  car.update(0, 0, 0, city.colliders); // sync the mesh once
  return car;
}
// The red hero car is an open-top convertible; the black sedan is closed.
const redConvertible = parkStealable(0xd23b2e, missions.spots.stealCarSpot.x, missions.spots.stealCarSpot.z, Math.PI / 2, 'convertible');
const blackSedan = parkStealable(0x1a1a1a, 78, -6, Math.PI, 'sedan');

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { cash: 0, bestCash: 0, missionsDone: 0 };
    const parsed = JSON.parse(raw);
    return { cash: 0, bestCash: parsed.bestCash || 0, missionsDone: parsed.missionsDone || 0 };
  } catch {
    return { cash: 0, bestCash: 0, missionsDone: 0 };
  }
}
function writeSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      bestCash: world.bestCash,
      missionsDone: world.missionsDone,
    }));
  } catch {
    // Blocked storage never breaks the game.
  }
}
const save = loadSave();

// ---------------------------------------------------------------------------
// World state
// ---------------------------------------------------------------------------
const world = {
  state: 'menu', // menu | play | pause | busted | win
  driving: false,
  car: null, // the ArcadeCar the player is driving, or null
  cash: 0,
  bestCash: save.bestCash,
  missionsDone: 0,
  wanted: 0,
  stolen: false,
  escaped: false,
  pickedUp: false,
  delivered: false,
  atHideout: false,
  tookSedan: false, // the black sedan was stolen (job 3's car)
  pedCooldown: 0,
  time: 0,
  carsStolen: 0, // career counters: kept across retries in one session
  escapes: 0,
  carCondition: 100, // 100 = showroom; building scrapes wear it down
  scrapeCooldown: 0,
  district: '',
  lastMissionIndex: -1,
};

function resetWorld() {
  walker.pos.x = 0;
  walker.pos.z = -72;
  walker.heading = 0;
  world.driving = false;
  world.car = null;
  world.cash = 0;
  world.wanted = 0;
  world.stolen = false;
  world.escaped = false;
  world.pickedUp = false;
  world.delivered = false;
  world.atHideout = false;
  world.tookSedan = false;
  missions.index = 0;
  for (const m of missions.list) m.done = false;
  police.clear();
  // Re-park the stealable cars where the missions expect them.
  redConvertible.pos.x = missions.spots.stealCarSpot.x;
  redConvertible.pos.z = missions.spots.stealCarSpot.z;
  redConvertible.speed = 0;
  blackSedan.pos.x = 78;
  blackSedan.pos.z = -6;
  blackSedan.speed = 0;
  world.state = 'play';
  hud.showMenu(false);
  hud.showGameOver(false);
  hud.showWin(false);
  hud.showStats(false);
  world.carCondition = 100;
  world.district = '';
  updateMissionText();
}

const RADIO_TRACKS = [
  'Sunset Drive — The Palms',
  'Coral Ave Nights — DJ Marisol',
  'Getaway Groove — The Hideouts',
];

// Dialog lines, spoken when a real mission event happens. MIRA is Dario's
// fixer on the phone; DARIO answers. Nothing here invents a system — the
// lines only narrate events the game really just did.
const DIALOG = {
  jobStart: [
    ['MIRA', 'The red convertible is on Coral Ave. Take it, then lose the cops.'],
    ['MIRA', 'Package is waiting at the marina. Hotel Solmar, no detours.'],
    ['MIRA', 'Last one. Black sedan, then the hideout. Don\'t get cute.'],
  ],
  escaped: ['DARIO', 'Clean. One job down, two to go.'],
  pickedUp: ['DARIO', 'Package secured. Rolling to the hotel.'],
  delivered: ['MIRA', 'Delivered. The hotel pays on time, for once.'],
};

function collectStats() {
  return {
    missionsDone: world.missionsDone,
    cash: world.cash,
    bestCash: world.bestCash,
    carsStolen: world.carsStolen,
    escapes: world.escapes,
  };
}

function updateMissionText() {
  const mission = missions.current;
  if (!mission) {
    hud.setMissionText('All jobs done. Solmar Bay is yours.');
    return;
  }
  // The checklist is the mission's real objectives with their real state.
  let steps;
  if (mission.id === 'steal') {
    steps = [
      { label: 'Steal the red convertible', done: world.stolen },
      { label: 'Lose the cops', done: world.escaped },
    ];
  } else if (mission.id === 'delivery') {
    steps = [
      { label: 'Pick up the package at the marina', done: world.pickedUp },
      { label: 'Deliver it to the Hotel Solmar', done: world.delivered },
    ];
  } else {
    steps = [
      { label: 'Take the black sedan', done: world.tookSedan },
      { label: 'Reach the hideout', done: world.atHideout },
    ];
  }
  let text = mission.text;
  if (mission.id === 'delivery' && world.pickedUp) {
    text = 'Package collected. Deliver it to the Hotel Solmar.';
  }
  hud.setMission(missions.index + 1, missions.list.length, mission.title, text, steps, mission.reward);
  hud.setRadio(RADIO_TRACKS[missions.index] ?? RADIO_TRACKS[0]);
  // New job: the fixer calls with the briefing.
  if (missions.index !== world.lastMissionIndex) {
    world.lastMissionIndex = missions.index;
    const line = DIALOG.jobStart[missions.index];
    if (line) hud.showDialog(line[0], line[1]);
  }
}

function nearestStealable() {
  if (world.driving) return null;
  for (const car of [redConvertible, blackSedan]) {
    const dx = car.pos.x - walker.pos.x;
    const dz = car.pos.z - walker.pos.z;
    if (Math.hypot(dx, dz) < CAR.stealRadius) return car;
  }
  return null;
}

function stealCar(car) {
  world.driving = true;
  world.car = car;
  world.stolen = true;
  world.carsStolen += 1;
  world.carCondition = 100; // a fresh car is in showroom condition
  if (car === blackSedan) world.tookSedan = true;
  world.wanted = Math.max(world.wanted, 1);
  police.raise(1, walker.pos, city.colliders);
  audio.blip();
}

function exitCar() {
  if (!world.car) return;
  const car = world.car;
  const side = { x: car.pos.x + Math.cos(car.heading) * 2.5, z: car.pos.z - Math.sin(car.heading) * 2.5 };
  walker.pos.x = side.x;
  walker.pos.z = side.z;
  world.driving = false;
  world.car = null;
}

function completeMissionIfReady() {
  const mission = missions.current;
  if (!mission) return;
  if (mission.check(world)) {
    const reward = missions.advance();
    world.cash += reward;
    world.missionsDone += 1;
    world.bestCash = Math.max(world.bestCash, world.cash);
    audio.blip();
    writeSave();
    if (missions.finished) {
      world.state = 'win';
      hud.showWin(true, world.cash);
      return;
    }
    // Reset per-mission flags for the next job.
    world.escaped = false;
    world.pickedUp = false;
    world.delivered = false;
    world.atHideout = false;
    updateMissionText();
  }
}

// ---------------------------------------------------------------------------
// Scripted screenshot scenes (?shot=title|chase|foot|stats)
// Each stages the real game at a fixed moment so the frame is what a short
// play session really looks like, with the same seed every time. Returns the
// state the shot runs in: 'menu' (title screen), 'pause' (career stats) or
// 'play' (a live scene).
// ---------------------------------------------------------------------------
function stageCrowd(cx, cz, seed) {
  // Fill the frame with the life the city already has: traffic cars on the
  // roads near (cx, cz) and pedestrians on the sidewalks nearby. Deterministic
  // per shot, so retakes look the same.
  const rng = mulberry32(seed);
  for (let i = 0; i < 5 && i < traffic.length; i += 1) {
    const p = city.roadPointNear(cx, cz, 55);
    const car = traffic[i].car;
    car.pos.x = p.x;
    car.pos.z = p.z;
    car.heading = p.along === 'x' ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    car.speed = TRAFFIC.carSpeed;
    car.update(0, 0, 0, city.colliders); // sync the mesh once
  }
  for (let i = 0; i < 7 && i < pedestrians.length; i += 1) {
    const p = city.sidewalkPointNear(cx, cz, 34);
    const ped = pedestrians[i];
    ped.pos.x = p.x;
    ped.pos.z = p.z;
    ped.target = city.sidewalkPointNear(cx, cz, 34);
  }
}

function stageShot(name) {
  resetWorld();
  if (name === 'title') {
    // Title screen: the menu overlay over a slow sunset panorama. The state
    // stays 'menu' so the orbit camera runs; the HUD is hidden by CSS.
    document.body.classList.add('shot-title');
    // resetWorld() already showed the opening dialog (inline display beats
    // the CSS hide), so hide it outright.
    hud.hideDialog();
    return 'menu';
  }
  if (name === 'stats') {
    // Career stats over a high three-quarter view of the sunset city.
    document.body.classList.add('shot-stats');
    hud.hideDialog();
    missions.index = 1;
    world.cash = 400;
    world.bestCash = 400;
    world.missionsDone = 1;
    world.carsStolen = 1;
    world.escapes = 1;
    world.driving = true;
    world.car = redConvertible;
    redConvertible.pos.x = -26;
    redConvertible.pos.z = -40;
    redConvertible.heading = 0;
    redConvertible.speed = 0;
    stageCrowd(0, 0, 41);
    camera.position.set(-60, 48, -120);
    camera.lookAt(0, 0, 10);
    return 'pause';
  }
  if (name === 'foot') {
    // On foot on Coral Ave at sunset, beside the red convertible, with
    // pedestrians on the sidewalk and traffic passing on the road. The
    // walker stands 4 m from the car so the "Press E to steal" prompt is
    // on screen, and the camera snaps straight behind him (no slow travel
    // through the buildings while it gets there).
    walker.pos.x = 2;
    walker.pos.z = -77;
    stageCrowd(0, -78, 17);
    heli.placeNear(0, -78, 2.2);
    chase.snapTo(walker.pos, 0, false, city.colliders);
    updateMissionText();
    return 'play';
  }
  // Default: chase — mid-pursuit at sunset, wanted 2, the police car right
  // behind, traffic ahead and pedestrians on the sidewalks.
  world.driving = true;
  world.car = redConvertible;
  world.stolen = true;
  redConvertible.pos.x = 26;
  redConvertible.pos.z = 0;
  redConvertible.heading = 0;
  redConvertible.speed = 22;
  police.raise(2, walker.pos, city.colliders);
  // Same direction as the player, a little faster, staying ahead in the
  // frame: a cop behind the player would sit behind the chase camera and
  // never be seen, and an oncoming cop closes too fast to frame reliably.
  // (The dispatch panel still reports the real distance.)
  police.car.pos.x = 26;
  police.car.pos.z = 50;
  police.car.heading = 0;
  police.car.speed = 20;
  stageCrowd(26, 0, 7);
  // Cars ahead on the same road and one crossing the junction ahead, so
  // the street reads as traffic instead of an empty runway. They are
  // placed close (the shot is taken ~1 s after staging, before the scene
  // has played far enough for anything to move much) and offset into the
  // lanes, so they sit beside the district card instead of behind it:
  // at 30–50 m a car on the centre line is only a speck behind the card.
  placeTraffic(0, 30, 20, 0); // right lane
  placeTraffic(1, 22, 34, 0); // left lane, clear of the police at z=45
  placeTraffic(2, -26, 78, 0);
  // Low and close over the road ahead, so the helicopter and its
  // spotlight pool are actually in frame instead of above it.
  heli.placeNear(26, 0, 1.35, 32, 30);
  chase.snapTo(redConvertible.pos, 0, true, city.colliders);
  updateMissionText();
  return 'play';
}

/** Park a traffic car at an exact spot for a staged shot. */
function placeTraffic(i, x, z, heading) {
  if (i >= traffic.length) return;
  const car = traffic[i].car;
  car.pos.x = x;
  car.pos.z = z;
  car.heading = heading;
  car.speed = TRAFFIC.carSpeed;
  car.update(0, 0, 0, city.colliders); // sync the mesh once
  // Straight run up and down this road line: without this, the car's own
  // waypoint rectangle would steer it off the road and back past the
  // camera before the shot is taken.
  traffic[i].waypoints = [{ x, z: 130 }, { x, z: -130 }];
  traffic[i].next = 0;
}

// ---------------------------------------------------------------------------
// Input edges (E, P, R, M, Enter) — handled on keydown, not held state.
// ---------------------------------------------------------------------------
let pressedE = false;
window.addEventListener('keydown', (event) => {
  if (event.code === 'KeyE') pressedE = true;
  if (event.code === 'KeyM') {
    const muted = audio.toggleMute();
    hud.setPrompt(muted ? 'Sound muted (M to unmute)' : '');
  }
  if (event.code === 'Enter' && world.state === 'menu') {
    audio.ensure();
    resetWorld();
  }
  if (event.code === 'KeyP' && (world.state === 'play' || world.state === 'pause')) {
    world.state = world.state === 'play' ? 'pause' : 'play';
    hud.showStats(world.state === 'pause', collectStats());
    hud.setPrompt(world.state === 'pause' ? '' : '');
  }
  if (event.code === 'KeyR' && world.state === 'busted') resetWorld();
});
document.getElementById('start-btn').addEventListener('click', () => {
  audio.ensure();
  resetWorld();
});
document.getElementById('retry-btn').addEventListener('click', () => resetWorld());
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('beforeunload', writeSave);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let lastNow = performance.now();

if (shotName) {
  // Screenshot mode: stage the scene; the shot decides its own state.
  const shotState = stageShot(shotName);
  world.state = shotState;
  if (shotState === 'menu') {
    hud.showMenu(true);
  } else if (shotState === 'pause') {
    hud.showMenu(false);
    hud.showStats(true, collectStats());
    updateMissionText();
  } else {
    hud.showMenu(false);
    updateMissionText();
  }
} else {
  hud.setCash(0);
  hud.setMissionText('Press START — three jobs, one sunset, $1,300 on the line.');
  hud.setRadio(RADIO_TRACKS[0]);
}

// Bloom (UnrealBloomPass, vendored under game/vendor/addons/) is on by
// default: it makes the headlights, lit windows and the sun glow, so the
// game looks the way the submitted screenshots do. It costs extra render
// passes; pass ?bloom=0 to turn it off.
const bloomOn = params.get('bloom') !== '0';
let composer = null;
if (bloomOn) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.55, 0.9,
  ));
  composer.addPass(new OutputPass());
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  world.time += dt;

  // The sun's shadow frustum follows the player so shadows stay crisp
  // where the camera is, and the light always comes from the sunset.
  const anchor = world.driving && world.car ? world.car.pos : walker.pos;
  sun.position.set(anchor.x + SUN_DIR.x * 220, SUN_DIR.y * 220, anchor.z + SUN_DIR.z * 220);
  sun.target.position.set(anchor.x, 0, anchor.z);
  sun.target.updateMatrixWorld();
  // Palm canopies sway in the evening wind; gutter steam rises and fades.
  for (const t of city.trees) {
    const s = Math.sin(world.time * 0.8 + t.phase) * 0.05;
    t.mesh.rotation.z = t.baseRot + s;
    t.mesh.position.x = t.baseX + s * 0.6;
  }
  for (const st of city.steam) {
    const tt = (world.time * 0.22 + st.phase) % 1;
    st.mesh.position.y = 0.4 + tt * 2.0;
    const sc = 0.7 + tt * 1.1;
    st.mesh.scale.set(sc, 0.9 + tt * 1.3, 1);
    st.mesh.material.opacity = 0.22 * (1 - tt);
  }

  if (world.state === 'menu') {
    // Slow establishing orbit over the city behind the start menu.
    const angle = world.time * 0.08;
    camera.position.set(Math.sin(angle) * 90, 55, Math.cos(angle) * 90);
    camera.lookAt(0, 0, 0);
    heli.update(dt, walker.pos);
  }

  if (world.state === 'play') {
    // Camera orbit from mouse drag (on foot only).
    if (input.dragX !== 0 || input.dragY !== 0) {
      if (!world.driving) chase.orbit(input.dragX, input.dragY);
      input.dragX = 0;
      input.dragY = 0;
    }

    // Steal / exit with E.
    if (pressedE) {
      pressedE = false;
      if (world.driving) exitCar();
      else {
        const car = nearestStealable();
        if (car) stealCar(car);
      }
    }

    const playerPos = world.driving && world.car ? world.car.pos : walker.pos;
    const playerSpeed = world.driving && world.car ? Math.abs(world.car.speed) : walker.speed;

    if (world.driving && world.car) {
      const throttle = input.down('KeyW', 'ArrowUp') ? 1 : input.down('KeyS', 'ArrowDown') ? -1 : 0;
      const steer = input.down('KeyA', 'ArrowLeft') ? -1 : input.down('KeyD', 'ArrowRight') ? 1 : 0;
      const handbrake = input.down('Space');
      const scraped = world.car.update(dt, throttle, steer, city.colliders);
      // A scrape wears the car's condition down (shown in the HUD panel).
      if (world.scrapeCooldown > 0) world.scrapeCooldown -= dt;
      if (scraped && world.scrapeCooldown <= 0) {
        world.scrapeCooldown = 0.5;
        world.carCondition = Math.max(15, world.carCondition - 8);
      }
      if (handbrake) world.car.speed *= Math.max(0, 1 - 3 * dt);
      // Ramming a pedestrian raises the wanted level.
      if (world.pedCooldown > 0) world.pedCooldown -= dt;
      for (const ped of pedestrians) {
        const dx = ped.pos.x - world.car.pos.x;
        const dz = ped.pos.z - world.car.pos.z;
        if (world.pedCooldown <= 0 && Math.abs(world.car.speed) > 5 && Math.hypot(dx, dz) < 1.8) {
          world.pedCooldown = 3;
          world.wanted = Math.min(5, world.wanted + 1);
          police.raise(world.wanted, playerPos, city.colliders);
          const p = city.roadPoint();
          ped.pos.x = p.x;
          ped.pos.z = p.z;
        }
      }
    } else {
      const forward = (input.down('KeyW', 'ArrowUp') ? 1 : 0) - (input.down('KeyS', 'ArrowDown') ? 1 : 0);
      const strafe = (input.down('KeyD', 'ArrowRight') ? 1 : 0) - (input.down('KeyA', 'ArrowLeft') ? 1 : 0);
      walker.update(dt, forward, strafe, chase.yaw, input.down('ShiftLeft', 'ShiftRight'), city.colliders);
    }

    // Traffic and pedestrians always move.
    for (const t of traffic) t.update(dt, city.colliders, playerPos);
    for (const ped of pedestrians) ped.update(dt, city, city.colliders);

    // Police pursuit, escape and bust.
    const policeResult = police.update(dt, playerPos, world.driving && world.car ? world.car.speed : walker.speed, city.colliders);
    if (policeResult === 'busted') {
      world.state = 'busted';
      writeSave();
      hud.showGameOver(true, 'BUSTED — the Solmar Bay PD caught Dario. Press R to try again.');
    } else if (policeResult === 'escaped') {
      world.escaped = true;
      world.wanted = 0;
      world.escapes += 1;
      if (missions.current && missions.current.id === 'steal') hud.showDialog(...DIALOG.escaped);
    }
    world.wanted = police.stars;

    // Mission progress: markers and proximity checks.
    const mission = missions.current;
    if (mission) {
      if (mission.id === 'delivery') {
        const toMarina = Math.hypot(missions.spots.marina.x - playerPos.x, missions.spots.marina.z - playerPos.z);
        const toHotel = Math.hypot(missions.spots.hotel.x - playerPos.x, missions.spots.hotel.z - playerPos.z);
        if (!world.pickedUp && toMarina < 7) {
          world.pickedUp = true;
          audio.blip();
          hud.showDialog(...DIALOG.pickedUp);
          updateMissionText();
        } else if (world.pickedUp && !world.delivered && toHotel < 7) {
          world.delivered = true;
          hud.showDialog(...DIALOG.delivered);
        }
      }
      if (mission.id === 'getaway') {
        const toHideout = Math.hypot(missions.spots.hideout.x - playerPos.x, missions.spots.hideout.z - playerPos.z);
        if (toHideout < 7 && world.driving) world.atHideout = true;
      }
      completeMissionIfReady();
    }

    // Camera follows the walker or the car; the helicopter circles above.
    // The car's speed goes to the camera so the FOV widens as it rushes.
    chase.update(dt, playerPos, world.driving && world.car ? world.car.heading : 0, world.driving, city.colliders, world.driving && world.car ? world.car.speed : walker.speed);
    heli.update(dt, playerPos);

    // HUD.
    hud.setStars(world.wanted);
    hud.setSpeed(playerSpeed * 3.6);
    hud.setCash(world.cash);
    hud.setDispatch(world.wanted > 0, {
      unit: 'UNIT 7',
      dist: police.dist,
      tactic: police.tactic(),
      stars: world.wanted,
      heatFrac: police.heatFrac,
    });
    hud.setVehicle(
      world.driving && world.car === redConvertible ? 'RED CONVERTIBLE'
        : world.driving && world.car === blackSedan ? 'BLACK SEDAN' : 'ON FOOT — DARIO CRUZ',
      world.driving ? world.carCondition : 100,
    );
    const district = city.districtAt(playerPos.x, playerPos.z);
    hud.showDistrict(district.name, district.sub);
    const nearCar = nearestStealable();
    if (nearCar) hud.setPrompt('Press E to steal the car');
    else if (world.state === 'play' && !hud.promptEl.textContent.startsWith('PAUSED')) hud.setPrompt('');
    hud.drawMinimap({
      time: world.time,
      roadLines: city.roadLines,
      colliders: city.colliders,
      missionMarker: mission ? (mission.id === 'delivery' && world.pickedUp ? missions.spots.hotel : mission.marker) : null,
      trafficDots: traffic.map((t) => t.car.pos),
      policeDots: police.active && police.car ? [police.car.pos] : [],
      player: { x: playerPos.x, z: playerPos.z, heading: world.driving && world.car ? world.car.heading : walker.heading },
    });

    // Audio follows the drive.
    audio.setEngine(Math.abs(world.driving && world.car ? world.car.speed : 0) / 30, world.driving);
    audio.setSiren(world.wanted > 0);
  }

  // One render path: the composer when bloom is on, the plain renderer
  // otherwise (never both — that would draw the scene twice).
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

// Test hook: the probe scripts read the live state from here.
window.__game = { world, missions, police, walker, redConvertible, blackSedan, traffic, pedestrians, heli, camera: chase.camera };

renderer.setAnimationLoop(frame);
