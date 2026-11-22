// Sunset Keys — segmented humanoids with a walk cycle.
// A full skinned rig is too heavy for a procedural game, so each person is
// a segmented figure: head with hair and a simple face (eyes, nose, mouth),
// torso in a shirt, arms and legs that pivot at the shoulder and hip and
// swing with the walk, shoes on the feet. The swing — not the polygon count
// — is what makes a walker read as alive. Dario keeps his flat cap; every
// pedestrian gets a random shirt, pants, skin tone and hairstyle.
import * as THREE from 'three';
import { makeBlobShadow } from './textures.js';

const SKINS = [0xe8b88a, 0xd8a077, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const HAIRS = [0x2a1a12, 0x4a2e18, 0x1a1a1a, 0x8a8a8a, 0x6b3a1a, 0xd8b25a];

/** A limb that pivots at its top: box + end piece, swung by rotation.x. */
function makeLimb(mat, w, len, endMat, endSize) {
  const pivot = new THREE.Group();
  const seg = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
  seg.position.y = -len / 2;
  seg.castShadow = true;
  pivot.add(seg);
  if (endMat) {
    const end = new THREE.Mesh(new THREE.BoxGeometry(endSize, endSize * 0.55, endSize * 1.5), endMat);
    end.position.y = -len - endSize * 0.2;
    end.position.z = endSize * 0.25;
    pivot.add(end);
  }
  return pivot;
}

/**
 * Build a humanoid. `opts`: shirt, pants, skin, hair, hairStyle
 * ('hair' | 'cap' | 'bun' | 'none'), and a `scale` for height variety.
 * Returns the group; `group.userData.humanoid` holds the four limb pivots
 * that `animateHumanoid` swings.
 */
export function makeHumanoid(opts) {
  const shirt = new THREE.MeshStandardMaterial({ color: opts.shirt, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: opts.pants, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: opts.skin, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: opts.hair, roughness: 0.95 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });

  const group = new THREE.Group();
  group.add(makeBlobShadow(1.1, 1.1, 0.32));

  // Legs pivot at the hips (y 0.85); shoes ride at the ends.
  const legL = makeLimb(pants, 0.2, 0.78, shoeMat, 0.2);
  legL.position.set(-0.15, 0.85, 0);
  group.add(legL);
  const legR = makeLimb(pants, 0.2, 0.78, shoeMat, 0.2);
  legR.position.set(0.15, 0.85, 0);
  group.add(legR);

  // Torso: shirt with a darker belt band.
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), shirt);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.08, 0.36), pants);
  belt.position.y = 0.9;
  group.add(belt);

  // Arms pivot at the shoulders; hands are small skin spheres.
  const armL = makeLimb(shirt, 0.16, 0.6, null);
  armL.position.set(-0.39, 1.46, 0);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
  handL.position.y = -0.66;
  armL.add(handL);
  group.add(armL);
  const armR = makeLimb(shirt, 0.16, 0.6, null);
  armR.position.set(0.39, 1.46, 0);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skin);
  handR.position.y = -0.66;
  armR.add(handR);
  group.add(armR);

  // Head with a simple face: two eyes, a nose, a mouth. The face looks
  // along +z, the direction the mesh faces when heading is 0.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.82;
  head.castShadow = true;
  group.add(head);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.4 });
  for (const ex of [-0.09, 0.09]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
    eye.position.set(ex, 1.86, 0.21);
    group.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.06), skin);
  nose.position.set(0, 1.79, 0.235);
  group.add(nose);
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), eyeMat);
  mouth.position.set(0, 1.71, 0.225);
  group.add(mouth);

  // Hair or headwear.
  if (opts.hairStyle === 'cap') {
    const capMat = new THREE.MeshStandardMaterial({ color: 0x2e4a6b, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.27, 0.12, 10), capMat);
    cap.position.y = 2.0;
    group.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.05, 0.22), capMat);
    brim.position.set(0, 1.96, 0.27);
    group.add(brim);
  } else if (opts.hairStyle === 'bun') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.86;
    group.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hairMat);
    bun.position.set(0, 2.06, -0.14);
    group.add(bun);
  } else if (opts.hairStyle !== 'none') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    hair.position.y = 1.86;
    group.add(hair);
  }

  group.userData.humanoid = { armL, armR, legL, legR };
  return group;
}

/** Dario Cruz: orange shirt, navy pants, flat cap. */
export function makeDario() {
  return makeHumanoid({
    shirt: 0xff8c42, pants: 0x2e4a6b, skin: 0xe8b88a, hair: 0x2a1a12, hairStyle: 'cap',
  });
}

/** A random pedestrian: varied shirt, pants, skin, hair and hairstyle. */
export function makePedestrian(rng) {
  const shirts = [0x4a90d9, 0xe05a7a, 0x7ac74f, 0xf2a541, 0x9b59b6, 0x1abc9c, 0xe8e8e8, 0xd23b2e];
  const pantsList = [0x333a44, 0x2e4a6b, 0x5a4632, 0x222222, 0x6b4a5a];
  const styles = ['hair', 'hair', 'hair', 'bun', 'none'];
  return makeHumanoid({
    shirt: shirts[Math.floor(rng() * shirts.length)],
    pants: pantsList[Math.floor(rng() * pantsList.length)],
    skin: SKINS[Math.floor(rng() * SKINS.length)],
    hair: HAIRS[Math.floor(rng() * HAIRS.length)],
    hairStyle: styles[Math.floor(rng() * styles.length)],
  });
}

/**
 * Swing the limbs for a walk cycle. `phase` advances with distance walked;
 * `amount` is 0 when standing still and 1 at a full stride. Arms swing
 * opposite to the legs, as in a real walk.
 */
export function animateHumanoid(group, phase, amount) {
  const h = group.userData.humanoid;
  if (!h) return;
  const swing = Math.sin(phase) * 0.55 * amount;
  h.legL.rotation.x = swing;
  h.legR.rotation.x = -swing;
  h.armL.rotation.x = -swing * 0.8;
  h.armR.rotation.x = swing * 0.8;
}
