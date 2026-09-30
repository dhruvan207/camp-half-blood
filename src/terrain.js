import * as THREE from 'three';

// Lageplan des Camps (Meter). Norden = -z (Hügel), Süden = +z.
// Die 12 Hütten stehen im U um die Wiese: Götter links (ungerade Nummern),
// Göttinnen rechts (gerade Nummern), Zeus und Hera am Kopfende. Das U ist zum Hügel hin offen.
const ARM_Z = [12, 6.5, 1, -4.5, -10];
export const LAYOUT = {
  hill: { x: 0, z: -31, radius: 15, height: 7 },
  start: { x: 0, z: -27 },
  campCenter: { x: 0, z: 3 },
  campfire: { x: 0, z: 2 },
  bigHouse: { x: -19, z: -15, facing: Math.PI / 2 }, // Veranda zeigt nach Osten
  arena: { x: 25, z: -13 },
  walkLimit: 36,
  cabins: [
    { nr: 1, god: 'Zeus', x: -4.5, z: 18.5, facing: Math.PI },
    { nr: 2, god: 'Hera', x: 4.5, z: 18.5, facing: Math.PI },
    ...[3, 5, 7, 9, 11].map((nr, i) => ({ nr, x: -13, z: ARM_Z[i], facing: Math.PI / 2 })),
    ...[4, 6, 8, 10, 12].map((nr, i) => ({ nr, x: 13, z: ARM_Z[i], facing: -Math.PI / 2 })),
  ],
};
const GODS = { 3: 'Poseidon', 4: 'Demeter', 5: 'Ares', 6: 'Athene', 7: 'Apollo', 8: 'Artemis', 9: 'Hephaistos', 10: 'Aphrodite', 11: 'Hermes', 12: 'Dionysos' };
for (const c of LAYOUT.cabins) c.god ??= GODS[c.nr];

export function cabin(nr) {
  return LAYOUT.cabins.find((c) => c.nr === nr);
}

// Punkt vor der Tür einer Hütte (Abstand d)
export function inFrontOf(c, d) {
  return { x: c.x + Math.sin(c.facing) * d, z: c.z + Math.cos(c.facing) * d };
}

function smoothstep(t) {
  t = Math.min(Math.max(t, 0), 1);
  return t * t * (3 - 2 * t);
}

// Höhe des Bodens an Stelle (x, z)
export function heightAt(x, z) {
  const { hill } = LAYOUT;
  const d = Math.hypot(x - hill.x, z - hill.z);
  let h = hill.height * smoothstep(1 - d / hill.radius);

  // leichte Wellen außerhalb des Camps, die Mitte bleibt flach
  const c = Math.hypot(x - LAYOUT.campCenter.x, (z - LAYOUT.campCenter.z) * 0.9);
  const wobble = smoothstep((c - 24) / 8);
  h += wobble * (Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.35 + Math.sin(x * 0.07 + z * 0.11) * 0.4);

  // Gelände steigt hinter dem Rand an (Waldkante)
  const edge = Math.min(Math.max(Math.abs(x), Math.abs(z)) - 38, 14);
  if (edge > 0) h += edge * edge * 0.03;

  return h;
}

export function createTerrain() {
  const size = 200;
  const seg = 180;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const lush = new THREE.Color('#d6e6b0');
  const warm = new THREE.Color('#fff2c4');
  const dry = new THREE.Color('#e8d59a');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));

    // großflächige Farbvariation, damit sich die Textur nicht sichtbar wiederholt
    const n = Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2.2) * 0.5 + 0.5;
    const n2 = Math.sin(z * 0.21 - x * 0.05) * 0.5 + 0.5;
    tmp.copy(lush).lerp(warm, n * 0.7).multiplyScalar(0.85 + n2 * 0.2);
    const slope = Math.abs(heightAt(x + 0.5, z) - heightAt(x - 0.5, z)) + Math.abs(heightAt(x, z + 0.5) - heightAt(x, z - 0.5));
    tmp.lerp(dry, Math.min(slope * 0.5, 0.45));
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const base = import.meta.env.BASE_URL;
  const loader = new THREE.TextureLoader();
  const repeat = size / 3.5; // eine Kachel = 3,5 m
  const setup = (t, srgb) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const map = setup(loader.load(base + 'textures/grass_diff.jpg'), true);
  const normalMap = setup(loader.load(base + 'textures/grass_nor.jpg'), false);

  const mat = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}
