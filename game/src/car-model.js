// Sunset Keys — the detailed car model.
// The car is the star of a GTA-style game, so it is built from layered
// primitives with a real silhouette: a stepped body (hood, cabin, trunk),
// dark glossy glass, glowing headlights and taillights, chrome grille and
// bumpers, side mirrors, and wheels with rims and spokes — never a plain
// box on black discs. The footprint stays 1.9 m wide and 4.2 m long, so the
// arcade physics, the steal radius and the parking spots never change.
// `kind` is 'player' | 'traffic' | 'police'; `variant` is 'sedan' or
// 'convertible' (the red hero car has no roof, just a windshield and seats).
import * as THREE from 'three';
import { makeBlobShadow } from './textures.js';

const BODY_COLORS = [0xd23b2e, 0x2e6fd2, 0xf2c230, 0x3fae6a, 0x8a5fd2, 0xe8e8e8, 0x222831];

/** One wheel: tyre, silver rim disc and five spokes on the outer face. */
function makeWheel(side) {
  const group = new THREE.Group();
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.92, metalness: 0.05 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.28, metalness: 0.85 });
  const spokeMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.4, metalness: 0.7 });

  const tyreGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14);
  tyreGeo.rotateZ(Math.PI / 2);
  const tyre = new THREE.Mesh(tyreGeo, tyreMat);
  tyre.castShadow = true;
  group.add(tyre);

  // Rim disc, slightly wider than the tyre so its face shows on both sides.
  const rimGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.34, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  group.add(rim);

  // Five spokes on the outer face (the side the camera sees).
  const spokeGeo = new THREE.BoxGeometry(0.04, 0.36, 0.07);
  for (let k = 0; k < 5; k += 1) {
    const spoke = new THREE.Mesh(spokeGeo, spokeMat);
    spoke.position.x = side * 0.18;
    spoke.rotation.x = (k * Math.PI * 2) / 5;
    group.add(spoke);
  }
  // Dark hub cap in the middle of the spokes.
  const hubGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, spokeMat);
  hub.position.x = side * 0.18;
  group.add(hub);
  return group;
}

/** A headlight or taillight: a small emissive lens that glows at dusk. */
function makeLamp(w, h, color, intensity) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0x222222, emissive: color, emissiveIntensity: intensity, roughness: 0.3,
    }),
  );
}

/**
 * Build a detailed car mesh. Returns the group; `group.userData.wheels`
 * holds the four wheel groups (front pair first, so steering works), and
 * `group.userData.lightBar` holds the police light bar when kind is
 * 'police'. The mesh faces +z when heading is 0.
 */
export function buildCarMesh(color, kind, variant = 'sedan') {
  const group = new THREE.Group();
  const convertible = variant === 'convertible';

  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.55, roughness: 0.32 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.6, metalness: 0.3 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.9, roughness: 0.22 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0e1a24, metalness: 0.9, roughness: 0.12,
  });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x2a2118, roughness: 0.9 });

  // Soft contact shadow under the car (cheap ambient occlusion).
  group.add(makeBlobShadow(2.7, 5.0, 0.4));

  // Lower body: the main slab, with a stepped hood and trunk deck.
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.5, 4.2), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.3, 1.15), bodyMat);
  hood.position.set(0, 0.68, 1.5);
  hood.rotation.x = -0.07;
  hood.castShadow = true;
  group.add(hood);
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.28, 0.95), bodyMat);
  trunk.position.set(0, 0.67, -1.6);
  trunk.rotation.x = 0.05;
  trunk.castShadow = true;
  group.add(trunk);

  if (convertible) {
    // Open top: a low raked windshield, two seats, and a body-colour
    // tonneau behind them — the red hero car reads as a convertible.
    const shield = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.42, 0.1), glassMat);
    shield.position.set(0, 1.02, 0.62);
    shield.rotation.x = -0.32;
    shield.castShadow = true;
    group.add(shield);
    for (const sx of [-0.42, 0.42]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.5), seatMat);
      seat.position.set(sx, 0.95, -0.35);
      group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.62, 0.14), seatMat);
      back.position.set(sx, 1.12, -0.62);
      back.rotation.x = -0.15;
      group.add(back);
    }
    const tonneau = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.14, 0.7), bodyMat);
    tonneau.position.set(0, 0.86, -1.05);
    group.add(tonneau);
  } else {
    // Closed cabin: dark glasshouse with a body-colour roof panel, so the
    // car has a real greenhouse instead of a glass box.
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.55, 1.9), glassMat);
    cabin.position.set(0, 1.05, -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.09, 1.45), bodyMat);
    roof.position.set(0, 1.36, -0.3);
    roof.castShadow = true;
    group.add(roof);
    // Glass shine: a thin bright strip across the windshield base.
    const shine = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.06, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xffe9c4 }),
    );
    shine.position.set(0, 1.12, 0.72);
    group.add(shine);
  }

  // Grille + chrome strip on the nose.
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.2, 0.06), trimMat);
  grille.position.set(0, 0.5, 2.12);
  group.add(grille);
  const chrome = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.05), chromeMat);
  chrome.position.set(0, 0.74, 2.12);
  group.add(chrome);

  // Headlights (warm, emissive) and taillights (red, emissive).
  for (const sx of [-0.62, 0.62]) {
    const head = makeLamp(0.42, 0.16, 0xffe9a8, 2.4);
    head.position.set(sx, 0.72, 2.11);
    group.add(head);
    const tail = makeLamp(0.4, 0.14, 0xff2020, 1.8);
    tail.position.set(sx, 0.72, -2.11);
    group.add(tail);
  }

  // Bumpers front and rear, slightly wider than the body.
  for (const sz of [2.14, -2.14]) {
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.22, 0.26), chromeMat);
    bumper.position.set(0, 0.32, sz);
    bumper.castShadow = true;
    group.add(bumper);
  }

  // Side mirrors.
  for (const sx of [-0.99, 0.99]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.24), trimMat);
    mirror.position.set(sx, 1.0, 0.55);
    group.add(mirror);
  }

  // Wheels with rims and spokes; front pair first (indices 0, 1 steer).
  const wheels = [];
  for (const [wx, wz] of [[-0.88, 1.35], [0.88, 1.35], [-0.88, -1.35], [0.88, -1.35]]) {
    const wheel = makeWheel(Math.sign(wx));
    wheel.position.set(wx, 0.36, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  if (kind === 'police') {
    const barMaterial = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), barMaterial);
    bar.position.set(0, 1.44, -0.25);
    group.add(bar);
    group.userData.lightBar = bar;
  }
  if (kind === 'player' && !convertible) {
    // A centre racing stripe over the hood and the trunk (never over the
    // open cabin of the convertible).
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 });
    const stripeHood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 1.1), stripeMat);
    stripeHood.position.set(0, 0.85, 1.5);
    stripeHood.rotation.x = -0.07;
    group.add(stripeHood);
    const stripeTrunk = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 0.9), stripeMat);
    stripeTrunk.position.set(0, 0.83, -1.6);
    stripeTrunk.rotation.x = 0.05;
    group.add(stripeTrunk);
  }

  group.userData.wheels = wheels;
  return group;
}

/** A random body colour for traffic cars. */
export function randomCarColor(rng) {
  return BODY_COLORS[Math.floor(rng() * BODY_COLORS.length)];
}
