// Sunset Keys — the procedural city of Solmar Bay.
// A 5x5 grid of blocks separated by roads, with a beach and the sea along
// the south edge. Everything is built from one seed, so the same seed always
// gives the same city. Buildings register AABB colliders that walkers and
// cars resolve against; traffic reads the road centre lines.
//
// Variety is the point of this file: five facade variants (window grid,
// tall windows, glass strips, brick, windows with people silhouettes),
// three height tiers, balconies, AC units, fire escapes, roof tanks and
// antennas, glowing shop signs, wall posters, scattered trash, steam
// rising from the gutters, and layered palm trees that sway in the wind.
// The facade textures darken toward the base — cheap contact occlusion
// where each wall meets the street.
import * as THREE from 'three';
import { CITY, COLORS } from './config.js';
import { mulberry32, range, intRange, pick } from './random.js';
import { glowTexture } from './textures.js';

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

// ---------------------------------------------------------------------------
// Facades: five variants, each a colour texture plus an emissive partner
// (black except the lit windows, so only the windows glow at dusk).
// ---------------------------------------------------------------------------
function drawWindow(ctx, x, y, w, h, lit, glowCtx) {
  ctx.fillStyle = lit ? '#ffb347' : '#3a4a5a';
  ctx.fillRect(x, y, w, h);
  if (glowCtx) {
    if (lit) {
      glowCtx.fillStyle = '#ffb347';
      glowCtx.fillRect(x, y, w, h);
    }
  }
}

function drawSilhouette(ctx, x, y, w, h, glowCtx) {
  // A lit window with a person standing in it: orange glass, dark head
  // and shoulders. On the glow map the person stays black.
  drawWindow(ctx, x, y, w, h, true, glowCtx);
  const cx = x + w / 2;
  ctx.fillStyle = '#1c1410';
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.32, w * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, y + h * 0.95, w * 0.42, Math.PI, 0);
  ctx.fill();
  if (glowCtx) {
    glowCtx.fillStyle = '#000000';
    glowCtx.beginPath();
    glowCtx.arc(cx, y + h * 0.32, w * 0.22, 0, Math.PI * 2);
    glowCtx.fill();
    glowCtx.beginPath();
    glowCtx.arc(cx, y + h * 0.95, w * 0.42, Math.PI, 0);
    glowCtx.fill();
  }
}

/** One facade variant: { map, glow }. Variants: 0 grid, 1 tall, 2 strip, 3 brick, 4 silhouettes. */
function makeFacadePair(variant) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 128;
  glowCanvas.height = 256;
  const gtx = glowCanvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 256);
  gtx.fillStyle = '#000000';
  gtx.fillRect(0, 0, 128, 256);

  if (variant === 0) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const lit = ((row * 4 + col) % 5) !== 0;
        drawWindow(ctx, 12 + col * 28, 14 + row * 30, 18, 20, lit, gtx);
      }
    }
  } else if (variant === 1) {
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const lit = ((row * 3 + col) % 4) !== 0;
        drawWindow(ctx, 12 + col * 38, 16 + row * 40, 26, 30, lit, gtx);
      }
    }
  } else if (variant === 2) {
    // Glass strips: continuous lit bands with mullion gaps.
    for (let row = 0; row < 8; row += 1) {
      const lit = (row % 4) !== 3;
      for (let col = 0; col < 4; col += 1) {
        drawWindow(ctx, 8 + col * 29, 14 + row * 30, 25, 13, lit, gtx);
      }
    }
  } else if (variant === 3) {
    // Brick: many small windows, fewer lit.
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const lit = ((row * 5 + col) % 7) < 3;
        drawWindow(ctx, 8 + col * 23, 12 + row * 24, 14, 14, lit, gtx);
      }
    }
  } else {
    // Silhouettes: a normal grid, but two windows hold a person.
    const spots = [[1, 2], [2, 5]];
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        const x = 12 + col * 28;
        const y = 14 + row * 30;
        if (spots.some(([sr, sc]) => sr === row && sc === col)) {
          drawSilhouette(ctx, x, y, 18, 20, gtx);
        } else {
          const lit = ((row * 4 + col) % 5) !== 0;
          drawWindow(ctx, x, y, 18, 20, lit, gtx);
        }
      }
    }
  }

  // Contact occlusion: darken the base of the wall where it meets the
  // street, baked into the texture so it costs no extra geometry.
  const baseGrad = ctx.createLinearGradient(0, 226, 0, 256);
  baseGrad.addColorStop(0, 'rgba(0,0,0,0)');
  baseGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 226, 128, 30);

  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const glow = new THREE.CanvasTexture(glowCanvas);
  glow.colorSpace = THREE.SRGBColorSpace;
  return { map, glow };
}

// ---------------------------------------------------------------------------
// Ground textures: asphalt with cracks, patches and tyre marks; pavement
// slabs with joints and a dark curb edge.
// ---------------------------------------------------------------------------
function makeAsphaltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4b5058';
  ctx.fillRect(0, 0, 512, 512);
  // Speckle noise.
  for (let i = 0; i < 2600; i += 1) {
    const v = 62 + Math.random() * 42;
    ctx.fillStyle = `rgba(${v},${v + 4},${v + 10},${0.25 + Math.random() * 0.3})`;
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 1.6, 1.6);
  }
  // Dark patches (repairs).
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = 'rgba(38,40,46,0.55)';
    const x = Math.random() * 440;
    const y = Math.random() * 440;
    ctx.fillRect(x, y, 40 + Math.random() * 50, 30 + Math.random() * 40);
  }
  // Cracks: wandering dark polylines.
  ctx.strokeStyle = 'rgba(30,32,36,0.8)';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 10; i += 1) {
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 7; s += 1) {
      x += (Math.random() - 0.5) * 70;
      y += (Math.random() - 0.5) * 70;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Tyre marks: long faint dark bands along one direction.
  for (let i = 0; i < 5; i += 1) {
    ctx.strokeStyle = 'rgba(28,30,34,0.35)';
    ctx.lineWidth = 7 + Math.random() * 5;
    const y = Math.random() * 512;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 14, 340, y - 14, 512, y + 6);
    ctx.stroke();
  }
  // Worn paint flecks.
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = 'rgba(245,215,110,0.25)';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

function makeSidewalkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#9aa0a3';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i += 1) {
    const v = 130 + Math.random() * 40;
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
  }
  // Pavement joints.
  ctx.strokeStyle = 'rgba(90,96,100,0.7)';
  ctx.lineWidth = 3;
  for (let k = 0; k <= 4; k += 1) {
    ctx.beginPath(); ctx.moveTo(k * 64, 0); ctx.lineTo(k * 64, 256); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, k * 64); ctx.lineTo(256, k * 64); ctx.stroke();
  }
  // Dark curb edge — the border reads as the gutter shadow.
  ctx.strokeStyle = 'rgba(60,64,68,0.85)';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// Shop signs and wall posters (canvas textures, unlit so they read at dusk).
// ---------------------------------------------------------------------------
function makeSignTexture(name, sub, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = fg;
  ctx.font = 'bold 26px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(name, 128, 32);
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillText(sub, 128, 52);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePosterTexture(title, line, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 176;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 128, 176);
  ctx.fillStyle = fg;
  ctx.font = 'bold 19px Verdana, sans-serif';
  ctx.textAlign = 'center';
  const words = title.split(' ');
  words.forEach((w, i) => ctx.fillText(w, 64, 52 + i * 24));
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillText(line, 64, 140);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 3;
  ctx.strokeRect(5, 5, 118, 166);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHOPS = [
  ['HOTEL SOLMAR', 'ROOMS · BAR · POOL', '#2a1a3a', '#ffd27a'],
  ['CAFÉ LUNA', 'OPEN LATE · COFFEE', '#3a1a1a', '#ffb347'],
  ['TACOS EL SOL', 'AL PASTOR · 24 HRS', '#1a3a2a', '#7dff9a'],
  ['PIER MARKET', 'FRESH CATCH DAILY', '#1a2a3a', '#9fd8e8'],
  ['BAR VELVET', 'LIVE MUSIC · DANCING', '#3a1a2a', '#ff8080'],
  ['NEON MOTEL', 'VACANCY · $49/NIGHT', '#241640', '#ff9a4d'],
];
const POSTERS = [
  ['SOLMAR', 'NIGHTS', 'LIVE AT THE PIER', '#241640', '#ffd27a'],
  ['PIER', 'FESTIVAL', 'SAT 21 NOV', '#0f3a3a', '#7dff9a'],
  ['CAFÉ', 'LUNA', 'OPEN LATE', '#3a2410', '#ffb347'],
];

// ---------------------------------------------------------------------------
// The city itself.
// ---------------------------------------------------------------------------
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

  // Ground: asphalt with cracks, patches and tyre marks.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, CITY.size + 60),
    new THREE.MeshLambertMaterial({ map: makeAsphaltTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, 0);
  ground.receiveShadow = true;
  group.add(ground);

  // Beach and sea along the south edge (positive z).
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, 26),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, half + 13);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.size + 60, 120),
    new THREE.MeshLambertMaterial({ color: COLORS.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.3, half + 26 + 60);
  group.add(sea);

  // Facade materials: five variants, three tints each.
  const variantTints = [
    [0xf2e3c6, 0xe8a87c, 0xf0d060],
    [0xa8c8d8, 0xd8b8d0, 0xf5f0e1],
    [0x6a8aaa, 0x54749a, 0x8aaac8],
    [0xb0705a, 0x9a5a48, 0xc08060],
    [0xe07856, 0x9fc98f, 0xe8a87c],
  ];
  const variantMaterials = variantTints.map((tints, v) => {
    const { map, glow } = makeFacadePair(v);
    return tints.map((color, i) => new THREE.MeshLambertMaterial({
      color, map, emissive: 0xff8c2e, emissiveMap: glow,
      emissiveIntensity: 0.45 + i * 0.1,
    }));
  });
  const slabMaterial = new THREE.MeshLambertMaterial({ map: makeSidewalkTexture() });
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8a6b4a });
  const leafMaterials = [0x3f8f4f, 0x4a9a58, 0x357a44].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  const umbrellaMaterial = new THREE.MeshLambertMaterial({ color: 0xff7f50 });
  const darkMetal = new THREE.MeshLambertMaterial({ color: 0x2a2f36 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x6a7076 });
  const tankMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });

  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  boxGeometry.translate(0, 0.5, 0); // origin at the base
  const trunkGeometry = new THREE.CylinderGeometry(0.18, 0.25, 3.4, 6);
  const leafGeometry = new THREE.SphereGeometry(1.6, 8, 6);
  const umbrellaGeometry = new THREE.ConeGeometry(1.8, 0.9, 8);
  const tankGeometry = new THREE.CylinderGeometry(0.9, 0.9, 1.6, 10);
  const tankTopGeometry = new THREE.ConeGeometry(0.95, 0.6, 10);
  const antennaGeometry = new THREE.CylinderGeometry(0.06, 0.06, 3.6, 5);

  // Road dashes: flat planes (never boxes — a thin box edge at a grazing
  // angle reads as a floating yellow bar), one InstancedMesh per line.
  const dashGeometry = new THREE.PlaneGeometry(0.35, 1.4);
  const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xc9a94e });
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
    dummy.rotation.set(-Math.PI / 2, 0, p.rotY);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  group.add(dashes);

  // Shop signs and posters, shared textures.
  const signMaterials = SHOPS.map(
    ([name, sub, bg, fg]) => new THREE.MeshBasicMaterial({ map: makeSignTexture(name, sub, bg, fg) }),
  );
  const posterMaterials = POSTERS.map(
    ([a, b, line, bg, fg]) => new THREE.MeshBasicMaterial({ map: makePosterTexture(`${a} ${b}`, line, bg, fg) }),
  );
  const signGeometry = new THREE.PlaneGeometry(6.4, 1.6);
  const posterGeometry = new THREE.PlaneGeometry(1.5, 2.0);
  const shopBandGeometry = new THREE.BoxGeometry(6.0, 1.1, 0.12);
  const shopBandMaterial = new THREE.MeshBasicMaterial({ color: 0xffc46b });
  const balconyGeometry = new THREE.BoxGeometry(1.8, 0.12, 0.8);
  const railGeometry = new THREE.BoxGeometry(1.8, 0.45, 0.05);
  const acGeometry = new THREE.BoxGeometry(0.7, 0.5, 0.35);
  const acMaterial = new THREE.MeshLambertMaterial({ color: 0x9aa0a3 });
  const escapeGeometry = new THREE.BoxGeometry(2.6, 0.1, 1.0);

  // Place a flat object against a building face: face is '+x' | '-x' |
  // '+z' | '-z' (the outward direction from the block centre).
  function placeOnFace(mesh, face, bx, bz, bw, bd, y, out) {
    if (face === '+x') {
      mesh.rotation.y = Math.PI / 2;
      mesh.position.set(bx + bw / 2 + out, y, bz);
    } else if (face === '-x') {
      mesh.rotation.y = -Math.PI / 2;
      mesh.position.set(bx - bw / 2 - out, y, bz);
    } else if (face === '+z') {
      mesh.rotation.y = 0;
      mesh.position.set(bx, y, bz + bd / 2 + out);
    } else {
      mesh.rotation.y = Math.PI;
      mesh.position.set(bx, y, bz - bd / 2 - out);
    }
    group.add(mesh);
  }

  const trees = []; // swaying canopies, animated in main.js
  const steam = []; // gutter steam, animated in main.js

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
      slab.receiveShadow = true;
      group.add(slab);

      const count = intRange(rng, 1, 4);
      for (let b = 0; b < count; b += 1) {
        const w = range(rng, 10, 18);
        const d = range(rng, 10, 18);
        // Height tiers: mostly low, some mid, a few towers.
        const hr = rng();
        const h = hr < 0.55 ? range(rng, 8, 20) : hr < 0.88 ? range(rng, 20, 36) : range(rng, 36, 48);
        const x = blockX + range(rng, 2 + w / 2, CITY.blockSize - 2 - w / 2);
        const z = blockZ + range(rng, 2 + d / 2, CITY.blockSize - 2 - d / 2);
        // Facade variant, weighted so the grid is common but never alone.
        const vr = rng();
        const variant = vr < 0.3 ? 0 : vr < 0.5 ? 1 : vr < 0.65 ? 2 : vr < 0.85 ? 3 : 4;
        const mat = pick(rng, variantMaterials[variant]);
        const mesh = new THREE.Mesh(boxGeometry, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, 0.3, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });

        // The outward face (toward the nearest road) for signs, posters,
        // balconies and fire escapes.
        const cx = blockX + CITY.blockSize / 2;
        const cz = blockZ + CITY.blockSize / 2;
        const face = Math.abs(x - cx) > Math.abs(z - cz)
          ? (x > cx ? '+x' : '-x') : (z > cz ? '+z' : '-z');

        // Roof props: water tank, antenna, roof AC unit.
        const topY = 0.3 + h;
        if (rng() < 0.55) {
          const tank = new THREE.Mesh(tankGeometry, tankMat);
          tank.position.set(x + range(rng, -w / 4, w / 4), topY + 0.8, z + range(rng, -d / 4, d / 4));
          tank.castShadow = true;
          group.add(tank);
          const top = new THREE.Mesh(tankTopGeometry, tankMat);
          top.position.copy(tank.position);
          top.position.y += 1.1;
          group.add(top);
        }
        if (rng() < 0.3) {
          const ant = new THREE.Mesh(antennaGeometry, darkMetal);
          ant.position.set(x + range(rng, -w / 3, w / 3), topY + 1.8, z + range(rng, -d / 3, d / 3));
          group.add(ant);
        }
        if (rng() < 0.25) {
          const roofAc = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 1.2), acMaterial);
          roofAc.position.set(x + range(rng, -w / 4, w / 4), topY + 0.35, z + range(rng, -d / 4, d / 4));
          group.add(roofAc);
        }

        // Balconies on taller buildings (slab + railing).
        if (h >= 16 && rng() < 0.5) {
          const floors = Math.min(2, Math.floor(h / 14));
          for (let f = 0; f < floors; f += 1) {
            const by = 4 + f * 9 + rng() * 3;
            if (by > h - 3) break;
            const slabB = new THREE.Mesh(balconyGeometry, roofMat);
            const rail = new THREE.Mesh(railGeometry, darkMetal);
            if (face === '+x' || face === '-x') {
              slabB.rotation.y = Math.PI / 2;
              rail.rotation.y = Math.PI / 2;
              const sx = face === '+x' ? x + w / 2 + 0.4 : x - w / 2 - 0.4;
              slabB.position.set(sx, by, z + range(rng, -d / 4, d / 4));
              rail.position.set(sx + (face === '+x' ? 0.38 : -0.38), by + 0.28, slabB.position.z);
            } else {
              const sz = face === '+z' ? z + d / 2 + 0.4 : z - d / 2 - 0.4;
              slabB.position.set(x + range(rng, -w / 4, w / 4), by, sz);
              rail.position.set(slabB.position.x, by + 0.28, sz + (face === '+z' ? 0.38 : -0.38));
            }
            slabB.castShadow = true;
            group.add(slabB);
            group.add(rail);
          }
        }

        // AC units on the wall.
        if (rng() < 0.4) {
          const ac = new THREE.Mesh(acGeometry, acMaterial);
          const ay = range(rng, 3, Math.max(4, h - 4));
          placeOnFace(ac, face, x, z, w, d, ay, 0.22);
          group.add(ac);
        }

        // Fire escape on tall buildings: two platforms + a diagonal stair.
        if (h >= 24 && rng() < 0.25) {
          for (const fy of [h * 0.35, h * 0.65]) {
            const plat = new THREE.Mesh(escapeGeometry, darkMetal);
            placeOnFace(plat, face, x, z, w, d, fy, 0.55);
            group.add(plat);
          }
          const stair = new THREE.Mesh(new THREE.BoxGeometry(0.5, h * 0.34, 0.12), darkMetal);
          // The stair runs diagonally along the wall face: on a ±z face
          // the diagonal is in the X-Y plane (rotation.z); on a ±x face
          // it is in the Z-Y plane (rotation.x).
          if (face === '+z' || face === '-z') stair.rotation.z = 0.6;
          else stair.rotation.x = 0.6;
          const sy = h * 0.5;
          if (face === '+x') stair.position.set(x + w / 2 + 0.55, sy, z);
          else if (face === '-x') stair.position.set(x - w / 2 - 0.55, sy, z);
          else if (face === '+z') stair.position.set(x, sy, z + d / 2 + 0.55);
          else stair.position.set(x, sy, z - d / 2 - 0.55);
          group.add(stair);
        }

        // Shop sign + lit shopfront band on the ground floor.
        if (rng() < 0.22) {
          const sign = new THREE.Mesh(signGeometry, pick(rng, signMaterials));
          placeOnFace(sign, face, x, z, w, d, 3.6, 0.08);
          const band = new THREE.Mesh(shopBandGeometry, shopBandMaterial);
          placeOnFace(band, face, x, z, w, d, 1.3, 0.1);
        }

        // Wall posters, low on the facade where a walker passes.
        if (rng() < 0.3) {
          const poster = new THREE.Mesh(posterGeometry, pick(rng, posterMaterials));
          placeOnFace(poster, face, x, z, w, d, 1.9, 0.07);
        }
      }

      // Palm trees on two corners of the block, clear of buildings.
      // Layered canopies (three spheres, varied greens) that sway.
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
        trunk.castShadow = true;
        group.add(trunk);
        const canopyOffsets = [
          [0, 3.9, 0, 1.7], [0.8, 3.3, 0.35, 1.2], [-0.7, 3.4, -0.3, 1.0],
        ];
        for (let ci = 0; ci < canopyOffsets.length; ci += 1) {
          const [ox, oy, oz, s] = canopyOffsets[ci];
          const leaves = new THREE.Mesh(leafGeometry, leafMaterials[ci % leafMaterials.length]);
          leaves.scale.set(s, s * 0.6, s);
          leaves.position.set(tx + ox, 0.3 + oy, tz + oz);
          leaves.castShadow = true;
          group.add(leaves);
          trees.push({
            mesh: leaves, baseX: tx + ox, baseZ: tz + oz,
            baseRot: rng() * Math.PI * 2, phase: rng() * Math.PI * 2,
          });
        }
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

  // Scattered trash: one InstancedMesh of small boxes and cans on the
  // sidewalks near the curbs — one draw call for the whole city.
  const trashGeometry = new THREE.BoxGeometry(0.22, 0.12, 0.16);
  const trashMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trash = new THREE.InstancedMesh(trashGeometry, trashMaterial, 42);
  const trashColors = [0x8a8f96, 0x6a6f76, 0xb03030, 0x3a7a3a, 0xc8a030, 0x4a4a4a];
  for (let i = 0; i < 42; i += 1) {
    const bx = Math.floor(rng() * CITY.blocks);
    const bz = Math.floor(rng() * CITY.blocks);
    const blockX = -half + CITY.roadWidth + bx * CITY.pitch;
    const blockZ = -half + CITY.roadWidth + bz * CITY.pitch;
    const edge = rng() < 0.5;
    const tx = edge
      ? blockX + (rng() < 0.5 ? 1.5 + rng() * 2 : CITY.blockSize - 3.5 + rng() * 2)
      : blockX + range(rng, 2, CITY.blockSize - 2);
    const tz = edge
      ? blockZ + range(rng, 2, CITY.blockSize - 2)
      : blockZ + (rng() < 0.5 ? 1.5 + rng() * 2 : CITY.blockSize - 3.5 + rng() * 2);
    dummy.position.set(tx, 0.36, tz);
    dummy.rotation.set(0, rng() * Math.PI, 0);
    dummy.updateMatrix();
    trash.setMatrixAt(i, dummy.matrix);
    trash.setColorAt(i, new THREE.Color(pick(rng, trashColors)));
  }
  trash.instanceMatrix.needsUpdate = true;
  if (trash.instanceColor) trash.instanceColor.needsUpdate = true;
  group.add(trash);

  // Gutter steam: crossed soft planes that rise and fade, animated in
  // main.js. Six spots at road edges near intersections.
  const steamMat = () => new THREE.MeshBasicMaterial({
    map: glowTexture(), color: 0xcfd8e0, transparent: true, opacity: 0.2, depthWrite: false,
  });
  const steamGeo = new THREE.PlaneGeometry(1.4, 2.2);
  for (let i = 0; i < 6; i += 1) {
    const line = pick(rng, roadLines);
    const along = range(rng, -half + 20, half - 20);
    // On the gutter edge of a road: either beside a vertical road line or
    // beside a horizontal one, never in the middle of a block.
    const vertical = rng() < 0.5;
    const px = vertical ? line + 5.4 : along;
    const pz = vertical ? along : line + 5.4;
    const yaw = rng() * Math.PI;
    for (const rot of [yaw, yaw + Math.PI / 2]) {
      const puff = new THREE.Mesh(steamGeo, steamMat());
      puff.rotation.y = rot;
      puff.position.set(px, 0.8, pz);
      group.add(puff);
      steam.push({ mesh: puff, phase: rng(), x: px, z: pz });
    }
  }

  return {
    colliders,
    roadLines,
    trees,
    steam,
    /** A random point on a road (centre of a road line, random along it). */
    roadPoint() {
      const line = pick(rng, roadLines);
      const along = range(rng, -half + 8, half - 8);
      return rng() < 0.5 ? { x: line, z: along } : { x: along, z: line };
    },
    /** A road point within `r` metres of (x, z), with its road direction. */
    roadPointNear(x, z, r) {
      for (let tries = 0; tries < 24; tries += 1) {
        const p = this.roadPoint();
        if (Math.hypot(p.x - x, p.z - z) > r) continue;
        const onXLine = roadLines.includes(p.x);
        return { x: p.x, z: p.z, along: onXLine ? 'x' : 'z' };
      }
      const p = this.roadPoint();
      const onXLine = roadLines.includes(p.x);
      return { x: p.x, z: p.z, along: onXLine ? 'x' : 'z' };
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
    /** A sidewalk point within `r` metres of (x, z). */
    sidewalkPointNear(x, z, r) {
      for (let tries = 0; tries < 24; tries += 1) {
        const p = this.sidewalkPoint();
        if (Math.hypot(p.x - x, p.z - z) <= r) return p;
      }
      return this.sidewalkPoint();
    },
    /** The centre of a road line, used for traffic waypoints. */
    roadLineAt(index) {
      return roadLines[index % roadLines.length];
    },
    /**
     * The district at (x, z): the nearest named place, else the quadrant.
     * The names are the ones on the mission beacons and the district cards.
     */
    districtAt(x, z) {
      const places = [
        { name: 'CORAL AVE', sub: 'SOLMAR BAY', x: 6, z: -78 },
        { name: 'MARINA ROW', sub: 'THE PIER · SOLMAR BAY', x: 58, z: 148 },
        { name: 'HOTEL ROW', sub: 'NORTHSIDE · SOLMAR BAY', x: -26, z: -110 },
        { name: 'THE HIDEOUT', sub: 'WEST END · SOLMAR BAY', x: -78, z: 58 },
      ];
      let best = null;
      let bestDist = Infinity;
      for (const p of places) {
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bestDist) {
          bestDist = d;
          best = p;
        }
      }
      if (bestDist < 55) return { name: best.name, sub: best.sub };
      if (z > 128) return { name: 'THE STRAND', sub: 'THE BEACH · SOLMAR BAY' };
      if (x < -80 && z < -80) return { name: 'OLD TOWN', sub: 'NORTHWEST · SOLMAR BAY' };
      if (x > 80 && z < -80) return { name: 'EASTSIDE', sub: 'NORTHEAST · SOLMAR BAY' };
      if (x < -80) return { name: 'WEST END', sub: 'SOLMAR BAY' };
      if (x > 80) return { name: 'EASTSIDE', sub: 'SOLMAR BAY' };
      if (z < -80) return { name: 'NORTHSIDE', sub: 'SOLMAR BAY' };
      return { name: 'DOWNTOWN', sub: 'SOLMAR BAY' };
    },
  };
}
