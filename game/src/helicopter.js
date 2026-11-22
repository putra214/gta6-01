// Sunset Keys — the ambient helicopter.
// A police-style helicopter that circles high above the city with a visible
// spotlight cone and a pool of light on the ground below it. It is scenery
// only: it never chases, shoots or talks to the player, and no HUD element
// claims otherwise. It exists so the sky has life in every wide shot.
import * as THREE from 'three';
import { makeLightPool } from './textures.js';

export class AmbientHelicopter {
  constructor(scene) {
    this.scene = scene;
    this.angle = 0.6;
    this.center = new THREE.Vector3(0, 0, 0);
    this.group = new THREE.Group();

    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4a5568 });
    const glassMaterial = new THREE.MeshLambertMaterial({ color: 0x9fd8e8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 4.4), bodyMaterial);
    this.group.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.2), glassMaterial);
    nose.position.set(0, 0.1, 2.4);
    this.group.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4.2), bodyMaterial);
    tail.position.set(0, 0.3, -4.0);
    this.group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.4, 0.9), bodyMaterial);
    fin.position.set(0, 1.0, -5.8);
    this.group.add(fin);
    const skidMaterial = new THREE.MeshLambertMaterial({ color: 0x141414 });
    for (const sx of [-1.0, 1.0]) {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 3.4), skidMaterial);
      skid.position.set(sx, -0.95, 0.4);
      this.group.add(skid);
    }
    // Rotor: a thin disc that spins fast, plus a small tail rotor.
    this.rotor = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.08, 0.7),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    this.rotor.position.y = 1.0;
    this.group.add(this.rotor);
    // Red/white navigation strobe under the tail.
    const strobe = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 6, 5),
      new THREE.MeshBasicMaterial({ color: 0xff2020 }),
    );
    strobe.position.set(0, -0.8, -5.6);
    this.group.add(strobe);

    // Spotlight cone, pointing straight down, and its pool of light on the
    // ground. The pool is a soft radial gradient lying flat on the asphalt
    // (ground-aligned, fading to transparent at the edge), so it never
    // reads as a floating yellow shape — the old hard-edged circle did.
    const coneMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.1,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    this.cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 55, 12, 1, true), coneMaterial);
    this.cone.rotation.x = Math.PI; // apex up at the helicopter
    this.cone.position.y = -27.5;
    this.group.add(this.cone);
    this.pool = makeLightPool(7, 7, 0.15);
    scene.add(this.pool);

    this.height = 55; // high enough to clear the tallest roofs
    this.group.position.set(0, this.height, 0);
    scene.add(this.group);
  }

  /** Circle above the city, drifting its centre toward the player. */
  update(dt, playerPos) {
    this.angle += dt * 0.12;
    this.center.x += (playerPos.x - this.center.x) * Math.min(1, 0.15 * dt);
    this.center.z += (playerPos.z - this.center.z) * Math.min(1, 0.15 * dt);
    const x = this.center.x + Math.cos(this.angle) * 55;
    const z = this.center.z + Math.sin(this.angle) * 55;
    this.group.position.set(x, this.height, z);
    this.group.rotation.y = -this.angle;
    this.rotor.rotation.y += dt * 22;
    this.pool.position.set(x, 0.06, z);
  }

  /** Put the helicopter at a fixed bearing from a point, for staged shots. */
  placeNear(x, z, bearing = 0.8, height = 55, radius = 55) {
    this.angle = bearing;
    this.center.set(x, 0, z);
    // The staged height sticks: update() flies at this.height, so a low
    // staged helicopter would otherwise pop back up on the first frame.
    this.height = height;
    const px = x + Math.cos(bearing) * radius;
    const pz = z + Math.sin(bearing) * radius;
    this.group.position.set(px, height, pz);
    this.pool.position.set(px, 0.06, pz);
  }
}
