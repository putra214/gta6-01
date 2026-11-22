// Sunset Keys — the on-foot walker, Dario Cruz.
// Camera-relative WASD movement with a FIXED camera yaw: the camera never
// follows the walker's heading, so input and camera cannot feed back and
// make the walker spiral. The walker is a small capsule figure with a
// walk-cycle leg swing.
import * as THREE from 'three';
import { PLAYER } from './config.js';
import { resolveCircleVsBuildings } from './city.js';

/** Build the walker's mesh: body, head, and two swinging legs. */
export function makeWalkerMesh() {
  const group = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xff8c42 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e4a6b });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), shirt);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.85;
  group.add(head);
  const legGeometry = new THREE.BoxGeometry(0.22, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeometry, pants);
  legL.position.set(-0.16, 0.35, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeometry, pants);
  legR.position.set(0.16, 0.35, 0);
  group.add(legR);
  group.userData.legL = legL;
  group.userData.legR = legR;
  return group;
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
    const swing = this.speed > 0 ? Math.sin(this.walkPhase) * 0.5 : 0;
    this.mesh.userData.legL.rotation.x = swing;
    this.mesh.userData.legR.rotation.x = -swing;
  }
}
