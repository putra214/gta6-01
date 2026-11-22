// Sunset Keys — arcade car physics and the car mesh.
// One class drives the player's car, the traffic cars and the police car:
// bicycle-lite steering, speed-dependent steering lock, drag, and building
// collision that halves speed on a scrape. The mesh is built from boxes so
// no art file is ever needed.
import * as THREE from 'three';
import { CAR } from './config.js';
import { resolveCircleVsBuildings } from './city.js';
import { buildCarMesh, randomCarColor } from './car-model.js';

/** Build a detailed car mesh. `kind` is 'player' | 'traffic' | 'police'. */
export function makeCarMesh(color, kind, variant = 'sedan') {
  return buildCarMesh(color, kind, variant);
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
    const scraped = fixed.x !== before.x || fixed.z !== before.z;
    if (scraped) {
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
    // True when this frame scraped a building: the HUD reads it as damage.
    return scraped;
  }

  /** A random body colour for traffic cars. */
  static randomColor(rng) {
    return randomCarColor(rng);
  }
}
