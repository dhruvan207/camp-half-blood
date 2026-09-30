import * as THREE from 'three';

// Wichtige Orte im Camp (Meter). Norden = -z, Süden = +z.
export const LAYOUT = {
  hill: { x: 0, z: -31, radius: 15, height: 7 }, // Half-Blood Hill
  campCenter: { x: 0, z: 6 }, // Lagerfeuer / Mitte der Hütten-Wiese
  walkLimit: 36, // begehbare Fläche: -36 … +36 in x und z
};

function smoothstep(t) {
  t = Math.min(Math.max(t, 0), 1);
  return t * t * (3 - 2 * t);
}

// Höhe des Bodens an Stelle (x, z)
export function heightAt(x, z) {
  const { hill } = LAYOUT;
  const d = Math.hypot(x - hill.x, z - hill.z);
  let h = hill.height * smoothstep(1 - d / hill.radius);

  // leichte Wellen außerhalb der Camp-Mitte
  const c = Math.hypot(x - LAYOUT.campCenter.x, z - LAYOUT.campCenter.z);
  const wobble = smoothstep((c - 18) / 10);
  h += wobble * (Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.35 + Math.sin(x * 0.07 + z * 0.11) * 0.4);

  // Gelände steigt hinter dem Rand an (Waldkante)
  const edge = Math.min(Math.max(Math.abs(x), Math.abs(z)) - 38, 14);
  if (edge > 0) h += edge * edge * 0.03;

  return h;
}

export function createTerrain() {
  const size = 200;
  const seg = 160;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const grassA = new THREE.Color('#5d7a34');
  const grassB = new THREE.Color('#7c8f3e');
  const dry = new THREE.Color('#9a8a52');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));

    const n = Math.sin(x * 0.35 + Math.cos(z * 0.23) * 2) * 0.5 + 0.5;
    tmp.copy(grassA).lerp(grassB, n);
    const slope = Math.abs(heightAt(x + 0.5, z) - heightAt(x - 0.5, z)) + Math.abs(heightAt(x, z + 0.5) - heightAt(x, z - 0.5));
    tmp.lerp(dry, Math.min(slope * 0.6, 0.5));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
