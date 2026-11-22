// Sunset Keys — the wanted system and the police.
// Stealing a car (or ramming a pedestrian) raises wanted stars and spawns
// two police cars that pursue by steering toward the player at slightly
// less than the player's top speed, light bars flashing. Staying more than
// 150 m from every cop for 15 s loses them, then the cops despawn. A cop
// that touches a slow player for two seconds busts them.
import * as THREE from 'three';
import { WANTED, CAR, CITY } from './config.js';
import { ArcadeCar, makeCarMesh } from './car.js';

/** Road centre lines, same formula as buildCity: -half + roadWidth/2 + k*pitch. */
const LINES = (() => {
  const lines = [];
  for (let k = 0; k <= CITY.blocks; k += 1) {
    lines.push(-CITY.size / 2 + CITY.roadWidth / 2 + k * CITY.pitch);
  }
  return lines;
})();

function nearestLine(v) {
  let best = LINES[0];
  for (const line of LINES) if (Math.abs(line - v) < Math.abs(best - v)) best = line;
  return best;
}

/** True when the straight segment between two points crosses a building. */
function segmentBlocked(ax, az, bx, bz, colliders) {
  const dx = bx - ax;
  const dz = bz - az;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 2));
  for (let i = 1; i < steps; i += 1) {
    const x = ax + (dx * i) / steps;
    const z = az + (dz * i) / steps;
    for (let j = 0; j < colliders.length; j += 1) {
      const c = colliders[j];
      if (x > c.minX - CAR.radius && x < c.maxX + CAR.radius && z > c.minZ - CAR.radius && z < c.maxZ + CAR.radius) return true;
    }
  }
  return false;
}

/**
 * Road-grid waypoints around the block: first the nearest intersection to
 * the car (gets it onto a road), then along the grid to the intersection
 * nearest the player. Every leg runs on roads, so the car can always
 * follow it without pushing into a building.
 */
function buildRoute(car, playerPos) {
  const ix = nearestLine(car.pos.x);
  const iz = nearestLine(car.pos.z);
  const px = nearestLine(playerPos.x);
  const pz = nearestLine(playerPos.z);
  const route = [{ x: ix, z: iz }];
  if (px !== ix) route.push({ x: px, z: iz });
  if (pz !== iz) route.push({ x: px, z: pz });
  return route;
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.cars = [];
    this.heatTimer = 0;
    this.bustTimer = 0;
    this.flashTimer = 0;
    this.stars = 0;
    this.dist = Infinity; // metres from the pursuit car to the player
  }

  /** What the pursuit car is doing, for the dispatch panel. */
  tactic() {
    if (!this.active || !this.cars.length) return '';
    if (this.bustTimer > 0) return 'CLOSING IN';
    if (this.dist > WANTED.policeSight) return 'SEARCHING';
    return 'IN PURSUIT';
  }

  /** Heat built so far, as a 0..1 fraction of the escape time. */
  get heatFrac() {
    return Math.max(0, Math.min(1, this.heatTimer / WANTED.escapeSeconds));
  }

  /** Raise the wanted level and spawn two pursuit cars if none are active. */
  raise(stars, playerPos, colliders) {
    this.stars = Math.min(WANTED.maxStars, Math.max(this.stars, stars));
    this.heatTimer = 0;
    if (!this.active) {
      // Two cars, one on each side of the player, both heading at them.
      for (const [ox, oz] of [[30, -20], [-25, 35]]) {
        const mesh = makeCarMesh(0x2456c8, 'police');
        // White doors so the blue-and-white reads as a police car.
        const door = new THREE.Mesh(
          new THREE.BoxGeometry(1.92, 0.3, 1.6),
          new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
        );
        door.position.set(0, 0.6, 0.1);
        mesh.add(door);
        this.scene.add(mesh);
        const spawnX = playerPos.x + ox;
        const spawnZ = playerPos.z + oz;
        this.cars.push(new ArcadeCar(mesh, spawnX, spawnZ, Math.atan2(playerPos.x - spawnX, playerPos.z - spawnZ)));
      }
      this.active = true;
    }
  }

  clear() {
    this.stars = 0;
    this.heatTimer = 0;
    this.bustTimer = 0;
    this.dist = Infinity;
    for (const car of this.cars) this.scene.remove(car.mesh);
    this.cars = [];
    this.active = false;
  }

  /**
   * Pursue the player. Returns 'busted' when a cop catches a slow player,
   * 'escaped' when the player stayed beyond escape distance from every cop
   * for the full escape time, otherwise null.
   */
  update(dt, playerPos, playerSpeed, colliders) {
    if (!this.active || !this.cars.length) return null;
    let minDist = Infinity;
    let touching = false;
    for (const car of this.cars) {
      // Per-car corner-escape state, created lazily.
      if (car._route === undefined) {
        car._route = null;
        car._lx = car.pos.x;
        car._lz = car.pos.z;
        car._lt = 0;
      }
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      minDist = Math.min(minDist, dist);

      // Stuck in a corner: the car has barely moved for a second while the
      // player is far away (near the player, slow movement is a bust about
      // to happen, not a stuck car). Route it around the block on the road
      // grid instead of pushing into the same building face forever.
      car._lt += dt;
      if (car._lt >= 1) {
        const moved = Math.hypot(car.pos.x - car._lx, car.pos.z - car._lz);
        if (moved < 0.75 && dist > 10) car._route = buildRoute(car, playerPos);
        car._lx = car.pos.x;
        car._lz = car.pos.z;
        car._lt = 0;
      }

      // Chase target: the player, or the next road-grid waypoint while
      // routing around a block. A clear line of sight ends the detour early
      // so the cop still cuts corners whenever it can.
      let tx = playerPos.x;
      let tz = playerPos.z;
      if (car._route && car._route.length) {
        if (!segmentBlocked(car.pos.x, car.pos.z, playerPos.x, playerPos.z, colliders)) {
          car._route = null;
        } else {
          const wp = car._route[0];
          if (Math.hypot(wp.x - car.pos.x, wp.z - car.pos.z) < 4) car._route.shift();
          if (car._route.length) {
            tx = car._route[0].x;
            tz = car._route[0].z;
          } else {
            car._route = null;
          }
        }
      }

      // Chase: steer toward the target, full throttle, capped below top speed.
      const wantHeading = Math.atan2(tx - car.pos.x, tz - car.pos.z);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.5));
      car.update(dt, 1, steer, colliders);
      if (car.speed > WANTED.policeSpeed) car.speed = WANTED.policeSpeed;

      // Busted: a cop touches a slow player for two seconds.
      if (dist < CAR.radius + 1.2 && Math.abs(playerSpeed) < 5) touching = true;
    }

    // Flashing light bars: alternate red and blue twice a second.
    this.flashTimer += dt;
    for (const car of this.cars) {
      const bar = car.mesh.userData.lightBar;
      if (bar) {
        bar.material.color.setHex(Math.floor(this.flashTimer * 2) % 2 === 0 ? 0xff2020 : 0x2040ff);
      }
    }
    this.dist = minDist;

    if (touching) {
      this.bustTimer += dt;
      if (this.bustTimer >= WANTED.bustSeconds) return 'busted';
    } else {
      this.bustTimer = 0;
    }

    // Heat: builds while the player stays beyond escape distance from
    // every cop, and drains (never instantly resets) when any cop closes
    // in, so a chase that keeps breaking away still ends in an escape.
    if (minDist > WANTED.escapeDistance) {
      this.heatTimer += dt;
      if (this.heatTimer >= WANTED.escapeSeconds) {
        this.clear();
        return 'escaped';
      }
    } else {
      this.heatTimer = Math.max(0, this.heatTimer - dt * 2);
    }
    return null;
  }
}
