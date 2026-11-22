// Sunset Keys — arcade car physics and the car mesh.
// One class drives the player's car, the traffic cars and the police car:
// bicycle-lite steering, speed-dependent steering lock, drag, and building
// collision that halves speed on a scrape. The mesh is built from boxes so
// no art file is ever needed.
import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircleVsBuildings } from './city.js';

const BODY_COLORS = [0xd23b2e, 0x2e6fd2, 0xf2c230, 0x3fae6a, 0x8a5fd2, 0xe8e8e8, 0x222831];

/** Build a low-poly car mesh. `kind` is 'player' | 'traffic' | 'police'. */
export function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const bodyMaterial = new THREE.MeshLambertMaterial({ color });
  const darkMaterial = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const glassMaterial = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
  const wheelMaterial = new THREE.MeshLambertMaterial({ color: 0x141414 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), bodyMaterial);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.1), glassMaterial);
  cabin.position.set(0, 1.05, -0.2);
  group.add(cabin);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.25, 0.3), darkMaterial);
  bumper.position.set(0, 0.35, 2.1);
  group.add(bumper);

  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeometry.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  if (kind === 'police') {
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.4), barMaterial);
    bar.position.set(0, 1.42, -0.2);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (kind === 'player') {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.1, 4.22), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.72;
    group.add(stripe);
  }

  group.userData.wheels = wheels;
  return group;
}

/** Arcade car: position, heading, speed, steer — shared by all drivers. */
export class ArcadeCar {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.pos = { x, z };
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
  }

  /** Drive with throttle in [-1, 1] (negative = brake/reverse) and steer in [-1, 1]. */
  update(dt, throttle, steerInput, colliders) {
    const maxSteer = 0.55 * (1 - Math.min(Math.abs(this.speed) / CAR.maxSpeed, 0.7) * 0.6);
    const targetSteer = steerInput * maxSteer;
    this.steer += (targetSteer - this.steer) * Math.min(1, 8 * dt);

    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) this.speed += CAR.brake * throttle * dt;
    this.speed -= this.speed * CAR.drag * dt;
    if (this.speed > CAR.maxSpeed) this.speed = CAR.maxSpeed;
    if (this.speed < -CAR.maxReverse) this.speed = -CAR.maxReverse;
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;

    this.heading += (this.speed / CAR.wheelBase) * Math.tan(this.steer) * dt;

    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let nx = this.pos.x + fx * this.speed * dt;
    let nz = this.pos.z + fz * this.speed * dt;
    const half = 152; // city half-size plus margin; keep cars inside the map.
    // 152, not 136: the marina pickup sits at z=148 on the beach, and the
    // car must be able to reach it (pickup radius 7 m). The sea starts
    // well past 156, so 152 still keeps cars out of the water.
    nx = Math.max(-half, Math.min(half, nx));
    nz = Math.max(-half, Math.min(half, nz));

    const before = { x: nx, z: nz };
    const fixed = resolveCircleVsBuildings(nx, nz, CAR.radius, colliders);
    if (fixed.x !== before.x || fixed.z !== before.z) {
      this.speed *= 0.5; // scrape: lose half the speed, keep going
    }
    this.pos.x = fixed.x;
    this.pos.z = fixed.z;

    // Sync the mesh: position, heading, spinning wheels, steering front wheels.
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels;
    if (wheels) {
      const spin = (this.speed * dt) / 0.36;
      wheels[0].rotation.x += spin;
      wheels[1].rotation.x += spin;
      wheels[2].rotation.x += spin;
      wheels[3].rotation.x += spin;
      wheels[0].rotation.y = this.steer;
      wheels[1].rotation.y = this.steer;
    }
  }

  /** A random body colour for traffic cars. */
  static randomColor(rng) {
    return BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
  }
}
