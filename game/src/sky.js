// Sunset Keys — the sunset sky.
// Everything procedural: a canvas gradient for the dusk background, a low
// sun disc with a glow, flattened-sphere clouds, and street lamps along the
// road lines so the city reads as evening, not noon. Each lamp has a curved
// arm reaching over the road and a soft pool of light on the asphalt below
// it — the light actually lands on the street instead of floating in the air.
import * as THREE from 'three';
import { mulberry32, range } from './random.js';
import { glowTexture } from './textures.js';

/** The sunset direction: low in the south-west sky. */
export const SUN_DIR = new THREE.Vector3(-0.55, 0.32, 0.78).normalize();

/** Vertical dusk gradient, deep violet up top to gold at the horizon. */
function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0.0, '#241640');
  gradient.addColorStop(0.42, '#6e2f63');
  gradient.addColorStop(0.66, '#c65a4a');
  gradient.addColorStop(0.84, '#ff9a4d');
  gradient.addColorStop(1.0, '#ffc46b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Build the sky into `scene`: gradient background, sun disc + glow, clouds,
 * and street lamps along every road line. `roadLines` are the road centre
 * lines from the city. Returns nothing — the sky is scenery, not state.
 */
export function buildSky(scene, roadLines) {
  scene.background = makeSkyTexture();

  // Low sun in the south-west sky, the direction the warm light comes from.
  const sunDir = SUN_DIR;
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a4d, transparent: true, opacity: 0.35, fog: false }),
  );
  glow.position.copy(sunDir).multiplyScalar(520);
  glow.lookAt(0, 0, 0);
  scene.add(glow);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(24, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false }),
  );
  disc.position.copy(sunDir).multiplyScalar(500);
  disc.lookAt(0, 0, 0);
  scene.add(disc);

  // Clouds: flattened warm spheres, high up, pink in the sunset light.
  const rng = mulberry32(20261123);
  const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffb08a, transparent: true, opacity: 0.9 });
  const cloudMaterial2 = new THREE.MeshBasicMaterial({ color: 0xd98aa8, transparent: true, opacity: 0.9 });
  const puffGeometry = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 9; i += 1) {
    const cx = range(rng, -220, 220);
    const cy = range(rng, 70, 130);
    const cz = range(rng, -220, 220);
    const puffs = 2 + Math.floor(rng() * 3);
    for (let p = 0; p < puffs; p += 1) {
      const puff = new THREE.Mesh(puffGeometry, p % 2 === 0 ? cloudMaterial : cloudMaterial2);
      const s = range(rng, 10, 22);
      puff.scale.set(s, s * 0.32, s * 0.6);
      puff.position.set(cx + range(rng, -14, 14), cy + range(rng, -3, 3), cz + range(rng, -8, 8));
      scene.add(puff);
    }
  }

  // Street lamps along every road line, alternating sides. Each lamp is a
  // pole at the curb, a curved arm reaching over the road, a glowing globe
  // at the arm's end, and a soft pool of light on the asphalt below the
  // globe — so the lamps genuinely light the street.
  const half = 136;
  const positions = [];
  for (const line of roadLines) {
    for (let d = -half + 14; d < half - 10; d += 26) {
      const side = Math.floor(d / 26) % 2 === 0 ? 6.8 : -6.8;
      // Beside a vertical road line: pole at (line + side, d), arm reaching
      // toward the road in -x/+x. Beside a horizontal line: the same in z.
      positions.push({ x: line + side, z: d, arm: 'x', armSign: -Math.sign(side) });
      positions.push({ x: d, z: line + side, arm: 'z', armSign: -Math.sign(side) });
    }
  }
  const dummy = new THREE.Object3D();

  // Poles: vertical cylinders at the curb.
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.13, 4.4, 6);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, positions.length);
  // Arms: short horizontal cylinders from the pole top toward the road.
  const armGeometry = new THREE.CylinderGeometry(0.06, 0.06, 1.7, 6);
  const arms = new THREE.InstancedMesh(armGeometry, poleMaterial, positions.length);
  // Globes: glowing spheres at the arm ends.
  const globeGeometry = new THREE.SphereGeometry(0.38, 8, 6);
  const globeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const globes = new THREE.InstancedMesh(globeGeometry, globeMaterial, positions.length);
  // Light pools: soft radial gradients on the asphalt under each globe.
  // Kept small and faint: at the low chase/foot camera a ground glow is
  // seen at a grazing angle, and a big bright pool smears into a streak.
  const poolGeometry = new THREE.PlaneGeometry(5, 5);
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: glowTexture(), color: 0xffd27a, transparent: true,
    opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, positions.length);

  positions.forEach((p, i) => {
    const gx = p.arm === 'x' ? p.x + p.armSign * 1.6 : p.x; // globe x
    const gz = p.arm === 'z' ? p.z + p.armSign * 1.6 : p.z; // globe z
    dummy.position.set(p.x, 2.2, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    // The arm: horizontal, from the pole top toward the globe.
    dummy.position.set(p.x + (p.arm === 'x' ? p.armSign * 0.8 : 0), 4.35, p.z + (p.arm === 'z' ? p.armSign * 0.8 : 0));
    dummy.rotation.set(p.arm === 'x' ? 0 : Math.PI / 2, 0, p.arm === 'x' ? Math.PI / 2 : 0);
    dummy.updateMatrix();
    arms.setMatrixAt(i, dummy.matrix);
    dummy.position.set(gx, 4.3, gz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    globes.setMatrixAt(i, dummy.matrix);
    // The pool lies flat on the asphalt under the globe.
    dummy.position.set(gx, 0.05, gz);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    pools.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles);
  scene.add(arms);
  scene.add(globes);
  scene.add(pools);
}
