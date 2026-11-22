// Sunset Keys — bootstrap, game loop, and the rules that tie the systems
// together: walk, steal a car, drive, get wanted, lose the cops, run the
// three jobs for Dario Cruz, and bank the cash. The city is Solmar Bay, a
// sun-soaked coastal town of its own; nothing here is from a commercial game.
import * as THREE from 'three';
import { CITY, COLORS, CAR } from './config.js';
import { buildCity } from './city.js';
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

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.fog, 90, 320);

const sun = new THREE.DirectionalLight(COLORS.sun, 1.6);
sun.position.set(80, 140, 40);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
const chase = new ChaseCamera(camera);

const city = buildCity(scene, SEED);
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
function parkStealable(color, x, z, heading) {
  const mesh = makeCarMesh(color, 'player');
  scene.add(mesh);
  const car = new ArcadeCar(mesh, x, z, heading);
  car.update(0, 0, 0, city.colliders); // sync the mesh once
  return car;
}
const redConvertible = parkStealable(0xd23b2e, missions.spots.stealCarSpot.x, missions.spots.stealCarSpot.z, Math.PI / 2);
const blackSedan = parkStealable(0x1a1a1a, 78, -6, Math.PI);

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
  pedCooldown: 0,
  time: 0,
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
  updateMissionText();
}

function updateMissionText() {
  const mission = missions.current;
  if (!mission) {
    hud.setMission('All jobs done. Solmar Bay is yours.');
    return;
  }
  let text = `${mission.title} — ${mission.text}`;
  if (mission.id === 'delivery' && world.pickedUp) {
    text = 'JOB 2 — PIER RUN — Package collected. Deliver it to the Hotel Solmar.';
  }
  hud.setMission(text);
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
// Scripted screenshot scenes (?shot=cover|chase|foot|mission)
// Each stages the real game at a fixed moment so the frame is what a short
// play session really looks like, with the same seed every time.
// ---------------------------------------------------------------------------
function stageShot(name) {
  resetWorld();
  if (name === 'foot') {
    // On foot beside the red convertible, steal prompt showing.
    walker.pos.x = 2;
    walker.pos.z = -54;
    return;
  }
  if (name === 'mission') {
    // Driving toward the marina pickup, mission 2 staged.
    missions.index = 1;
    world.stolen = true;
    world.escaped = true;
    world.driving = true;
    world.car = redConvertible;
    redConvertible.pos.x = 26;
    redConvertible.pos.z = 90;
    redConvertible.heading = 0;
    redConvertible.speed = 12;
    updateMissionText();
    return;
  }
  if (name === 'chase') {
    // Mid-chase: driving fast, wanted 2, police car right behind.
    world.driving = true;
    world.car = redConvertible;
    world.stolen = true;
    redConvertible.pos.x = 26;
    redConvertible.pos.z = 0;
    redConvertible.heading = 0;
    redConvertible.speed = 22;
    police.raise(2, walker.pos, city.colliders);
    police.car.pos.x = 26;
    police.car.pos.z = 26;
    police.car.heading = 0;
    police.car.speed = 20;
    return;
  }
  // Default: cover — driving down Coral Ave with the HUD on.
  world.driving = true;
  world.car = redConvertible;
  world.stolen = true;
  redConvertible.pos.x = -26;
  redConvertible.pos.z = -40;
  redConvertible.heading = 0;
  redConvertible.speed = 16;
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
    hud.setPrompt(world.state === 'pause' ? 'PAUSED — press P to resume' : '');
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
});
window.addEventListener('beforeunload', writeSave);

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
let lastNow = performance.now();

if (shotName) {
  // Screenshot mode: stage the scene and start playing at once.
  stageShot(shotName);
  world.state = 'play';
  hud.showMenu(false);
  updateMissionText();
} else {
  hud.setCash(0);
  hud.setMission('Press START — three jobs, one sunset, $1,300 on the line.');
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  world.time += dt;

  if (world.state === 'menu') {
    // Slow establishing orbit over the city behind the start menu.
    const angle = world.time * 0.08;
    camera.position.set(Math.sin(angle) * 90, 55, Math.cos(angle) * 90);
    camera.lookAt(0, 0, 0);
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
      world.car.update(dt, throttle, steer, city.colliders);
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
          updateMissionText();
        } else if (world.pickedUp && toHotel < 7) {
          world.delivered = true;
        }
      }
      if (mission.id === 'getaway') {
        const toHideout = Math.hypot(missions.spots.hideout.x - playerPos.x, missions.spots.hideout.z - playerPos.z);
        if (toHideout < 7 && world.driving) world.atHideout = true;
      }
      completeMissionIfReady();
    }

    // Camera follows the walker or the car.
    chase.update(dt, playerPos, world.driving && world.car ? world.car.heading : 0, world.driving, city.colliders);

    // HUD.
    hud.setStars(world.wanted);
    hud.setSpeed(playerSpeed * 3.6);
    hud.setCash(world.cash);
    const nearCar = nearestStealable();
    if (nearCar) hud.setPrompt('Press E to steal the car');
    else if (world.state === 'play' && !hud.promptEl.textContent.startsWith('PAUSED')) hud.setPrompt('');
    hud.drawMinimap({
      time: world.time,
      roadLines: city.roadLines,
      missionMarker: mission ? (mission.id === 'delivery' && world.pickedUp ? missions.spots.hotel : mission.marker) : null,
      trafficDots: traffic.map((t) => t.car.pos),
      policeDots: police.active && police.car ? [police.car.pos] : [],
      player: { x: playerPos.x, z: playerPos.z, heading: world.driving && world.car ? world.car.heading : walker.heading },
    });

    // Audio follows the drive.
    audio.setEngine(Math.abs(world.driving && world.car ? world.car.speed : 0) / 30, world.driving);
    audio.setSiren(world.wanted > 0);
  }

  renderer.render(scene, camera);
}

// Test hook: the probe scripts read the live state from here.
window.__game = { world, missions, police, walker, redConvertible, blackSedan };

renderer.setAnimationLoop(frame);
