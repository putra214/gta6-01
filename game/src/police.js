// Sunset Keys — the wanted system and the police.
// Stealing a car (or ramming a pedestrian) raises wanted stars and spawns a
// police car that pursues by steering toward the player at slightly less
// than the player's top speed, light bar flashing. Heat decays after the
// player stays out of the police's sight, then the cop despawns. A cop that
// touches a slow player for two seconds busts them.
import * as THREE from 'three';
import { WANTED, CAR } from './config.js';
import { ArcadeCar, makeCarMesh } from './car.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.car = null;
    this.heatTimer = 0;
    this.bustTimer = 0;
    this.flashTimer = 0;
    this.stars = 0;
  }

  /** Raise the wanted level and spawn a pursuit car if none is active. */
  raise(stars, playerPos, colliders) {
    this.stars = Math.min(WANTED.maxStars, Math.max(this.stars, stars));
    this.heatTimer = 0;
    if (!this.active) {
      const mesh = makeCarMesh(0x1a1a1a, 'police');
      // White doors so the black-and-white reads as a police car.
      const door = new THREE.Mesh(
        new THREE.BoxGeometry(1.92, 0.3, 1.6),
        new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
      );
      door.position.set(0, 0.6, 0.1);
      mesh.add(door);
      this.scene.add(mesh);
      const spawnX = playerPos.x + 30;
      const spawnZ = playerPos.z - 20;
      this.car = new ArcadeCar(mesh, spawnX, spawnZ, Math.atan2(playerPos.x - spawnX, playerPos.z - spawnZ));
      this.active = true;
    }
  }

  clear() {
    this.stars = 0;
    this.heatTimer = 0;
    this.bustTimer = 0;
    if (this.car) {
      this.scene.remove(this.car.mesh);
      this.car = null;
    }
    this.active = false;
  }

  /**
   * Pursue the player. Returns 'busted' when the cop catches a slow player,
   * 'escaped' when the heat decayed away, otherwise null.
   */
  update(dt, playerPos, playerSpeed, colliders) {
    if (!this.active || !this.car) return null;
    const dx = playerPos.x - this.car.pos.x;
    const dz = playerPos.z - this.car.pos.z;
    const dist = Math.hypot(dx, dz);

    // Chase: steer toward the player, full throttle, capped below top speed.
    const wantHeading = Math.atan2(dx, dz);
    let diff = wantHeading - this.car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.5));
    this.car.update(dt, 1, steer, colliders);
    if (this.car.speed > WANTED.policeSpeed) this.car.speed = WANTED.policeSpeed;

    // Flashing light bar: alternate red and blue twice a second.
    this.flashTimer += dt;
    const bar = this.car.mesh.userData.lightBar;
    if (bar) {
      bar.material.color.setHex(Math.floor(this.flashTimer * 2) % 2 === 0 ? 0xff2020 : 0x2040ff);
    }

    // Busted: the cop touches a slow player for two seconds.
    if (dist < CAR.radius + 1.2 && Math.abs(playerSpeed) < 5) {
      this.bustTimer += dt;
      if (this.bustTimer >= WANTED.bustSeconds) return 'busted';
    } else {
      this.bustTimer = 0;
    }

    // Heat: builds while the player is out of the police's sight, and
    // drains (never instantly resets) when the police sees them again, so
    // a chase that keeps breaking line of sight still ends in an escape.
    if (dist > WANTED.policeSight) {
      this.heatTimer += dt;
      if (this.heatTimer >= WANTED.heatDecaySeconds) {
        this.clear();
        return 'escaped';
      }
    } else {
      this.heatTimer = Math.max(0, this.heatTimer - dt * 2);
    }
    return null;
  }
}
