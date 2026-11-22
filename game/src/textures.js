// Sunset Keys — shared procedural canvas textures.
// Small helpers every system uses: a soft dark blob (cheap contact shadow
// under cars and walkers) and a soft white radial glow (light pools under
// street lamps and the helicopter spotlight). Both fade to transparent at
// the edge, so they read as light and shadow, never as geometry.
import * as THREE from 'three';

let blob = null;
let glow = null;

/** Dark radial gradient: opaque black centre fading to transparent. */
export function blobTexture() {
  if (blob) return blob;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.85)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  blob = new THREE.CanvasTexture(canvas);
  return blob;
}

/** White radial gradient: bright centre fading to transparent. */
export function glowTexture() {
  if (glow) return glow;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(canvas);
  return glow;
}

/**
 * A flat blob-shadow plane (dark radial gradient) sized (w, d), lying on
 * the ground at height `y`. Attach it to a moving group and it grounds the
 * object even where the real sun shadow is long and thin.
 */
export function makeBlobShadow(w, d, opacity = 0.38) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: blobTexture(), transparent: true, opacity, depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.renderOrder = 1;
  return mesh;
}

/**
 * A flat pool of warm light (radial gradient) sized (w, d) at height `y`.
 * Ground-aligned and soft-edged, so it never reads as a floating shape.
 */
export function makeLightPool(w, d, opacity = 0.28, color = 0xffe9a8) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({
      map: glowTexture(), color, transparent: true, opacity,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.05;
  mesh.renderOrder = 2;
  return mesh;
}
