// Sunset Keys — the procedural city of Solmar Bay.
// A 5x5 grid of blocks separated by roads, with a beach and the sea along
// the south edge. Everything is built from one seed, so the same seed always
// gives the same city. Buildings register AABB colliders that walkers and
// cars resolve against; traffic reads the road centre lines.
import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { mulberry32, range, intRange, pick } from './random.js';

const PALETTE = [0xf2e3c6, 0xe8a87c, 0xf0d060, 0xa8c8d8, 0xe07856, 0x9fc98f, 0xd8b8d0, 0xf5f0e1];

/** Push a circle (x, z, radius r) out of every building AABB it overlaps. */
export function resolveCircleVsBuildings(x, z, r, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const nearestX = Math.max(c.minX, Math.min(x, c.maxX));
    const nearestZ = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - nearestX;
    const dz = z - nearestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= r * r) continue;
    if (distSq > 0.0001) {
      const dist = Math.sqrt(distSq);
      const push = (r - dist) / dist;
      x += dx * push;
      z += dz * push;
    } else {
      // Centre is inside the box: push out along the smallest penetration.
      const left = x - c.minX + r;
      const right = c.maxX - x + r;
      const top = z - c.minZ + r;
      const bottom = c.maxZ - z + r;
      const min = Math.min(left, right, top, bottom);
      if (min === left) x = c.minX - r;
      else if (min === right) x = c.maxX + r;
      else if (min === top) z = c.minZ - r;
      else z = c.maxZ + r;
    }
  }
  return { x, z };
}

/** A lit-window facade texture, shared by every building. */
function makeFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const lit = ((row * 4 + col) % 5) !== 0;
      ctx.fillStyle = lit ? '#ffe9a8' : '#5a6a7a';
      ctx.fillRect(12 + col * 28, 14 + row * 30, 18, 20);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Build the city into `scene` from `seed`. Returns the colliders, the road
 * centre lines, and helpers for spawning things on roads.
 */
export function buildCity(scene, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);

  const half = CITY.size / 2;
  const colliders = [];
  const roadLines = [];
  for (let k = 0; k <= CITY.blocks; k += 1) {
    roadLines.push(-half + CITY.roadWidth / 2 + k * CITY.pitch);
  }

  // Ground: asphalt everywhere; sidewalk slabs sit on top of each block.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, CITY.size + 60),
    new THREE.MeshLambertMaterial({ color: COLORS.road }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  group.add(ground);

  // Beach and sea along the south edge (positive z).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, 26),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + 13);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, 120),
    new THREE.MeshLambertMaterial({ color: COLORS.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.3, half + 26 + 60);
  group.add(sea);

  const facade = makeFacadeTexture();
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  boxGeometry.translate(0, 0.5, 0); // origin at the base
  const materials = PALETTE.map(
    (color) => new THREE.MeshLambertMaterial({ color, map: facade }),
  );
  const slabMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const umbrellaMaterial = new THREE.MeshLambertMaterial({ color: 0xff7f50 });

  const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.25, 3.4, 6);
  const leafGeometry = new THREE.SphereGeometry(1.6, 8, 6);
  const umbrellaGeometry = new THREE.ConeGeometry(1.8, 0.9, 8);

  // Road dashes: one InstancedMesh for every centre line.
  const dashGeometry = new THREE.BoxGeometry(0.5, 0.02, 3);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  const dashPositions = [];
  for (const line of roadLines) {
    for (let d = -half + 6; d < half - 4; d += 8) {
      dashPositions.push({ x: line, z: d, rotY: 0 });
      dashPositions.push({ x: d, z: line, rotY: Math.PI / 2 });
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeometry, dashMaterial, dashPositions.length);
  const dummy = new THREE.Object3D();
  dashPositions.forEach((p, i) => {
    dummy.position.set(p.x, 0.03, p.z);
    dummy.rotation.set(0, p.rotY, 0);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  group.add(dashes);

  // Blocks: sidewalk slab, 1-4 buildings, palm trees on the corners.
  for (let bx = 0; bx < CITY.blocks; bx += 1) {
    for (let bz = 0; bz < CITY.blocks; bz += 1) {
      const blockX = -half + CITY.roadWidth + bx * CITY.pitch;
      const blockZ = -half + CITY.roadWidth + bz * CITY.pitch;
      const slab = new THREE.Mesh(
        new THREE.BoxGeometry(CITY.blockSize, 0.3, CITY.blockSize),
        slabMaterial,
      );
      slab.position.set(blockX + CITY.blockSize / 2, 0.15, blockZ + CITY.blockSize / 2);
      group.add(slab);

      const count = intRange(rng, 1, 4);
      for (let b = 0; b < count; b += 1) {
        const w = range(rng, 10, 18);
        const d = range(rng, 10, 18);
        const h = range(rng, 8, 42);
        const x = blockX + range(rng, 2 + w / 2, CITY.blockSize - 2 - w / 2);
        const z = blockZ + range(rng, 2 + d / 2, CITY.blockSize - 2 - d / 2);
        const mesh = new THREE.Mesh(boxGeometry, pick(rng, materials));
        mesh.scale.set(w, h, d);
        mesh.position.set(x, 0.3, z);
        group.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }

      // Palm trees on two corners of the block, clear of buildings.
      for (const [cx, cz] of [[3, 3], [CITY.blockSize - 3, CITY.blockSize - 3]]) {
        const tx = blockX + cx;
        const tz = blockZ + cz;
        let clear = true;
        for (const c of colliders) {
          if (tx > c.minX - 1 && tx < c.maxX + 1 && tz > c.minZ - 1 && tz < c.maxZ + 1) clear = false;
        }
        if (!clear) continue;
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(tx, 0.3 + 1.7, tz);
        group.add(trunk);
        const leaves = new THREE.Mesh(leafGeometry, leafMaterial);
        leaves.scale.set(1, 0.6, 1);
        leaves.position.set(tx, 0.3 + 3.6, tz);
        group.add(leaves);
      }
    }
  }

  // Beach umbrellas for the coastal look.
  for (let i = 0; i < 5; i += 1) {
    const ux = -half + 20 + i * 52 + range(rng, -8, 8);
    const uz = half + range(rng, 6, 18);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6), trunkMaterial);
    pole.position.set(ux, 1.1, uz);
    group.add(pole);
    const top = new THREE.Mesh(umbrellaGeometry, umbrellaMaterial);
    top.position.set(ux, 2.4, uz);
    group.add(top);
  }

  return {
    colliders,
    roadLines,
    /** A random point on a road (centre of a road line, random along it). */
    roadPoint() {
      const line = pick(rng, roadLines);
      const along = range(rng, -half + 8, half - 8);
      return rng() < 0.5 ? { x: line, z: along } : { x: along, z: line };
    },
    /** A random point on a block's sidewalk, clear of the road. */
    sidewalkPoint() {
      const bx = Math.floor(rng() * CITY.blocks);
      const bz = Math.floor(rng() * CITY.blocks);
      const blockX = -half + CITY.roadWidth + bx * CITY.pitch;
      const blockZ = -half + CITY.roadWidth + bz * CITY.pitch;
      return {
        x: blockX + range(rng, 3, CITY.blockSize - 3),
        z: blockZ + range(rng, 3, CITY.blockSize - 3),
      };
    },
    /** The centre of a road line, used for traffic waypoints. */
    roadLineAt(index) {
      return roadLines[index % roadLines.length];
    },
  };
}
