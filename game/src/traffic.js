// Sunset Keys — ambient life: traffic cars and pedestrians.
// Traffic cars loop rectangles of road lines, steering toward the next
// waypoint and slowing when the player is ahead. Pedestrians wander between
// random points snapped near road lines. Both keep the city alive in every
// screenshot.
import * as THREE from 'three';
import { TRAFFIC, CAR } from './config.js';
import { ArcadeCar, makeCarMesh } from './car.js';
import { resolveCircleVsBuildings } from './city.js';
import { makePedestrian, animateHumanoid } from './people.js';
import { mulberry32, range, pick } from './random.js';

/** A traffic car that loops a rectangle of four road lines. */
export class TrafficCar {
  constructor(car, waypoints) {
    this.car = car;
    this.waypoints = waypoints;
    this.next = 0;
  }

  update(dt, colliders, playerPos) {
    const target = this.waypoints[this.next];
    const dx = target.x - this.car.pos.x;
    const dz = target.z - this.car.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 6) {
      this.next = (this.next + 1) % this.waypoints.length;
      return;
    }
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - this.car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2));
    // Slow down when the player is right ahead.
    let throttle = 0.55;
    if (playerPos) {
      const pdx = playerPos.x - this.car.pos.x;
      const pdz = playerPos.z - this.car.pos.z;
      const ahead = pdx * Math.sin(this.car.heading) + pdz * Math.cos(this.car.heading);
      const side = Math.abs(pdx * Math.cos(this.car.heading) - pdz * Math.sin(this.car.heading));
      if (ahead > 0 && ahead < 12 && side < 3) throttle = 0;
    }
    this.car.speed = Math.min(this.car.speed, TRAFFIC.carSpeed + 2);
    this.car.update(dt, throttle, steer, colliders);
  }
}

/** A pedestrian wandering between random points near the roads. */
export class Pedestrian {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.pos = { x, z };
    this.target = { x, z };
    this.phase = Math.random() * 6;
  }

  update(dt, city, colliders) {
    const dx = this.target.x - this.pos.x;
    const dz = this.target.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      // Next target: another sidewalk point, so pedestrians live on the
      // sidewalks and only cross roads on the way there.
      this.target = city.sidewalkPoint();
      return;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    const fixed = resolveCircleVsBuildings(
      this.pos.x + nx * TRAFFIC.pedSpeed * dt,
      this.pos.z + nz * TRAFFIC.pedSpeed * dt,
      0.4,
      colliders,
    );
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;
    this.phase += dt * 6;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = Math.atan2(nx, nz);
    this.mesh.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
    animateHumanoid(this.mesh, this.phase, 1);
  }
}

/**
 * Spawn the traffic cars and pedestrians into the scene. Returns them plus
 * the list of all cars the minimap and the steal prompt read.
 */
export function buildTraffic(scene, city, seed) {
  const rng = mulberry32(seed + 77);
  const traffic = [];
  const pedestrians = [];

  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const xLine = city.roadLineAt(i);
    const zLine = city.roadLineAt((i + 2) % 6);
    const half = 136;
    const waypoints = [
      { x: xLine, z: -half + 10 },
      { x: xLine, z: half - 10 },
      { x: zLine, z: half - 10 },
      { x: zLine, z: -half + 10 },
    ];
    const start = waypoints[i % 4];
    const mesh = makeCarMesh(ArcadeCar.randomColor(rng), 'traffic');
    scene.add(mesh);
    const car = new ArcadeCar(mesh, start.x, start.z, i % 2 === 0 ? 0 : Math.PI);
    traffic.push(new TrafficCar(car, waypoints));
  }

  for (let i = 0; i < TRAFFIC.pedestrians; i += 1) {
    const p = city.roadPoint();
    const mesh = makePedestrian(rng);
    scene.add(mesh);
    pedestrians.push(new Pedestrian(mesh, p.x, p.z));
  }

  return { traffic, pedestrians };
}
