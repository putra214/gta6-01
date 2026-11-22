// Sunset Keys — ambient life: traffic cars and pedestrians.
// Traffic cars loop rectangles of road lines, steering toward the next
// waypoint and slowing when the player is ahead. Pedestrians wander between
// random points snapped near road lines. Both keep the city alive in every
// screenshot.
import * as THREE from 'three';
import { TRAFFIC, CAR } from './config.js';
import { ArcadeCar, makeCarMesh } from './car.js';
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
      const p = city.roadPoint();
      this.target = { x: p.x + range(Math.random, -4, 4), z: p.z + range(Math.random, -4, 4) };
      return;
    }
    const nx = dx / dist;
    const nz = dz / dist;
    this.pos.x += nx * TRAFFIC.pedSpeed * dt;
    this.pos.z += nz * TRAFFIC.pedSpeed * dt;
    this.phase += dt * 6;
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = Math.atan2(nx, nz);
    this.mesh.position.y = Math.abs(Math.sin(this.phase)) * 0.06;
  }
}

function makePedestrianMesh(shirtColor) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: shirtColor });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd8a077 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x333a44 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.6, 4, 8), shirt);
  body.position.y = 0.95;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skin);
  head.position.y = 1.65;
  group.add(head);
  const legGeometry = new THREE.BoxGeometry(0.18, 0.6, 0.18);
  const legL = new THREE.Mesh(legGeometry, pants);
  legL.position.set(-0.13, 0.3, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeometry, pants);
  legR.position.set(0.13, 0.3, 0);
  group.add(legR);
  return group;
}

/**
 * Spawn the traffic cars and pedestrians into the scene. Returns them plus
 * the list of all cars the minimap and the steal prompt read.
 */
export function buildTraffic(scene, city, seed) {
  const rng = mulberry32(seed + 77);
  const traffic = [];
  const pedestrians = [];
  const pedShirts = [0x4a90d9, 0xe05a7a, 0x7ac74f, 0xf2a541, 0x9b59b6, 0x1abc9c];

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
    const mesh = makePedestrianMesh(pick(rng, pedShirts));
    scene.add(mesh);
    pedestrians.push(new Pedestrian(mesh, p.x, p.z));
  }

  return { traffic, pedestrians };
}
