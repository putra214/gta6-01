// Sunset Keys — the on-foot walker, Dario Cruz.
// Camera-relative WASD movement with a FIXED camera yaw: the camera never
// follows the walker's heading, so input and camera cannot feed back and
// make the walker spiral. Dario is a segmented humanoid (head with a face
// and flat cap, shirt, arms and legs) whose limbs swing with the walk.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleVsBuildings } from './city.js';
import { makeDario, animateHumanoid } from './people.js';

/** Build Dario's mesh: the segmented humanoid from people.js. */
export function makeWalkerMesh() {
  return makeDario();
}

export class Walker {
  constructor(mesh, x, z) {
    this.mesh = mesh;
    this.pos = { x, z };
    this.heading = 0;
    this.speed = 0;
    this.walkPhase = 0;
  }

  /**
   * Move with camera-relative input. `forward`/`strafe` are -1..1, `yaw` is
   * the camera's own yaw (never the walker's heading), `sprint` doubles pace.
   */
  update(dt, forward, strafe, yaw, sprint, colliders) {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Camera-relative: forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw).
    let mx = sin * forward + -cos * strafe;
    let mz = cos * forward + sin * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      this.speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
      this.heading = Math.atan2(mx, mz);
      const fixed = resolveCircleVsBuildings(
        this.pos.x + mx * this.speed * dt,
        this.pos.z + mz * this.speed * dt,
        PLAYER.radius,
        colliders,
      );
      this.pos.x = fixed.x;
      this.pos.z = fixed.z;
      this.walkPhase += dt * this.speed * 1.6;
    } else {
      this.speed = 0;
    }

    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    animateHumanoid(this.mesh, this.walkPhase, this.speed > 0 ? 1 : 0);
    // A small bob on each step, so the walk reads even at a distance.
    this.mesh.position.y = this.speed > 0 ? Math.abs(Math.sin(this.walkPhase)) * 0.05 : 0;
  }
}
