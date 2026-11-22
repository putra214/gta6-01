// Sunset Keys — the chase camera.
// On foot the camera sits behind the walker at shoulder height and a FIXED
// yaw (the walker never steers the camera, so input cannot spiral). In a
// car the camera trails close behind the car's heading, low enough that the
// car fills the frame. Before placing the camera, the code walks the line
// from the player outward and takes the farthest spot that is clear of
// buildings, so the view stays low and close instead of jumping above the
// roofs whenever a wall gets in the way. `snapTo` jumps straight to the
// spot (used when a scene is staged, so the first frame is already right
// instead of the camera travelling through the city to get there).
import * as THREE from 'three';

export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.yaw = Math.PI; // fixed on-foot yaw: looking north (-z is up the map)
    this.pitch = 0.32;
    this.distance = 8; // on foot: close, shoulder height
    this.height = 3.6;
    this.smooth = new THREE.Vector3(0, 6, 14);
  }

  /** Mouse drag orbits the camera around the player (on foot only). */
  orbit(dx, dy) {
    this.yaw -= dx * 0.004;
    this.pitch = Math.max(0.1, Math.min(0.9, this.pitch + dy * 0.003));
  }

  /** True when a point is clear of every building (1 m margin). */
  static clearOfBuildings(x, z, colliders) {
    for (const c of colliders) {
      if (x > c.minX - 1 && x < c.maxX + 1 && z > c.minZ - 1 && z < c.maxZ + 1) return false;
    }
    return true;
  }

  /** The spot the camera wants: farthest clear point on its line. */
  desiredPosition(target, heading, driving, colliders) {
    const followYaw = driving ? heading + Math.PI : this.yaw;
    const dist = driving ? 7.5 : this.distance;
    const height = driving ? 3.5 : this.height;
    const dirX = Math.sin(followYaw);
    const dirZ = Math.cos(followYaw);
    for (const frac of [1, 0.8, 0.65, 0.5, 0.38]) {
      const px = target.x + dirX * dist * frac;
      const pz = target.z + dirZ * dist * frac;
      if (ChaseCamera.clearOfBuildings(px, pz, colliders)) {
        return new THREE.Vector3(px, height, pz);
      }
    }
    // No clear spot on the line: rise above the roofs as a last resort.
    return new THREE.Vector3(target.x + dirX * dist, 46, target.z + dirZ * dist);
  }

  /** Jump straight to the desired spot (staged scenes). */
  snapTo(target, heading, driving, colliders) {
    const desired = this.desiredPosition(target, heading, driving, colliders);
    this.smooth.copy(desired);
    this.camera.position.copy(desired);
    this.camera.lookAt(target.x, driving ? 1.4 : 1.3, target.z);
  }

  /**
   * Follow `target` (a {x, z} position) with `heading` (the car's heading
   * when driving, the camera's own yaw when on foot). `colliders` pull the
   * camera in along its own line instead of lifting it over the roofs.
   * `speed` (m/s) widens the field of view as the car goes faster — the
   * cheap, honest version of motion blur: the world rushes past instead
   * of smearing. A real velocity-buffer blur is too heavy for the
   * software-rendered headless runs this game is tested in.
   */
  update(dt, target, heading, driving, colliders, speed = 0) {
    const desired = this.desiredPosition(target, heading, driving, colliders);
    const k = 1 - Math.exp(-6 * dt);
    this.smooth.lerp(desired, k);
    this.camera.position.copy(this.smooth);
    this.camera.lookAt(target.x, driving ? 1.4 : 1.3, target.z);
    const targetFov = driving ? 62 + Math.min(Math.abs(speed) / 30, 1) * 8 : 62;
    if (Math.abs(this.camera.fov - targetFov) > 0.1) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
  }
}
