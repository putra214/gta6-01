// Sunset Keys — the sunset sky.
// Everything procedural: a canvas gradient for the dusk background, a low
// sun disc with a glow, flattened-sphere clouds, and instanced street lamps
// along the road lines so the city reads as evening, not noon.
import * as THREE from 'three';
import { mulberry32, range } from './random.js';

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
  const sunDir = new THREE.Vector3(-0.55, 0.26, 0.78).normalize();
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

  // Street lamps: one instanced pole + one instanced glowing globe per lamp,
  // along every road line, alternating sides, so the streets glow at dusk.
  const half = 136;
  const positions = [];
  for (const line of roadLines) {
    for (let d = -half + 14; d < half - 10; d += 26) {
      const side = Math.floor(d / 26) % 2 === 0 ? 6.8 : -6.8;
      positions.push({ x: line + side, z: d });
      positions.push({ x: d, z: line + side });
    }
  }
  const poleGeometry = new THREE.CylinderGeometry(0.09, 0.13, 4.4, 6);
  const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const poles = new THREE.InstancedMesh(poleGeometry, poleMaterial, positions.length);
  const globeGeometry = new THREE.SphereGeometry(0.38, 8, 6);
  const globeMaterial = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const globes = new THREE.InstancedMesh(globeGeometry, globeMaterial, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach((p, i) => {
    dummy.position.set(p.x, 2.2, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(p.x, 4.5, p.z);
    dummy.updateMatrix();
    globes.setMatrixAt(i, dummy.matrix);
  });
  scene.add(poles);
  scene.add(globes);
}
