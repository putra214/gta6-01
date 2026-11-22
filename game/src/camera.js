// Sunset Keys — the chase camera.
// On foot the camera sits behind the walker at a FIXED yaw (the walker
// never steers the camera, so input cannot spiral). In a car the camera
// trails behind the car's heading. Before placing the camera, the code
// lifts it above any building its line of sight would clip through, so the
// view never passes through a wall.
import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // fixed on-foot yaw: looking north (-z is up the map)
    this.pitch = 0.32;
    this.distance = 10;
    this.height = 4.5;
    this.smooth = new THREE.Vector3(0, 6, 14);
  }

  /** Mouse drag orbits the camera around the player (on foot only). */
  orbit(dx, dy) {
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(0.1, Math.min(0.9, this.pitch + dy * 0.003));
  }

  /**
   * Follow `target` (a {x, z} position) with `heading` (the car's heading
   * when driving, the camera's own yaw when on foot). `colliders` lift the
   * camera above buildings in the way.
   */
  update(dt, target, heading, driving, colliders) {
    const followYaw = driving ? heading + Math.PI : this.yaw;
    const dist = driving ? 11 : this.distance;
    const height = driving ? 5 : this.height;
    const desired = new THREE.Vector3(
      target.x + Math.sin(followYaw) * dist,
      height,
      target.z + Math.cos(followYaw) * dist,
    );
    // Camera collision: if the desired spot is inside a building, rise above it.
    for (const c of colliders) {
      if (desired.x > c.minX - 1 && desired.x < c.maxX + 1 && desired.z > c.minZ - 1 && desired.z < c.maxZ + 1) {
        desired.y = Math.max(desired.y, 46);
      }
    }
    const k = 1 - Math.exp(-6 * dt);
    this.smooth.lerp(desired, k);
    this.camera.position.copy(this.smooth);
    this.camera.lookAt(target.x, 1.5, target.z);
  }
}
