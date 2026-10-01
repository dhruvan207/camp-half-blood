import * as THREE from 'three';
import { loadTex } from './kit.js';

// ============================================================================
// Lageplan von Camp Half-Blood (Meter). x = Osten, z = Süden.
// Norden (-z): Half-Blood Hill mit Thalias Kiefer. Süden (+z): Strand und Meer (Long Island Sound).
// Die 12 Hütten stehen im U um die Wiese, das U ist zum Hügel hin offen.
// Von dort aus gesehen: ungerade Nummern links (Osten), gerade rechts (Westen).
// ============================================================================

const ARM_Z = [22, 16.5, 11, 5.5, 0]; // von der Basis des U zur Öffnung
export const LAYOUT = {
  hill: { x: 0, z: -34, radius: 17, height: 8 },
  thaliaPine: { x: 1.8, z: -35 },
  start: { x: -2, z: -30.5 },
  campCenter: { x: 0, z: 12 },
  campfire: { x: 0, z: 12 },
  bigHouse: { x: -15, z: -17, facing: Math.PI / 2 }, // Vorderseite mit Veranda zeigt nach Osten
  volleyball: { x: -12, z: -2 },
  strawberries: { x: 21, z: -23, w: 18, d: 12 },
  archery: { x: 28, z: -6 },
  arena: { x: 26, z: 11, rx: 7.5, rz: 9 },
  pavilion: { x: 24, z: 33, w: 16, d: 11 },
  amphitheater: { x: -21, z: 26.5 },
  lake: { x: -31, z: 7, rx: 8, rz: 12, level: -0.35 },
  stables: { x: -31, z: -24 },
  seaLevel: -0.7,
  bounds: { minX: -44, maxX: 37, minZ: -44, maxZ: 41 },
  cabins: [
    { nr: 1, god: 'Zeus', x: 5, z: 28.5, facing: Math.PI },
    { nr: 2, god: 'Hera', x: -5, z: 28.5, facing: Math.PI },
    ...[3, 5, 7, 9, 11].map((nr, i) => ({ nr, x: 12, z: ARM_Z[i], facing: -Math.PI / 2 })),
    ...[4, 6, 8, 10, 12].map((nr, i) => ({ nr, x: -12, z: ARM_Z[i], facing: Math.PI / 2 })),
  ],
  // Bach durch den östlichen Wald (Grenze beim Flaggenspiel)
  creek: [
    [38.5, -60], [39.5, -40], [38, -26], [39.8, -12], [38.6, 2], [40, 16], [38.8, 30], [39.6, 50],
  ],
};
const GODS = { 3: 'Poseidon', 4: 'Demeter', 5: 'Ares', 6: 'Athene', 7: 'Apollo', 8: 'Artemis', 9: 'Hephaistos', 10: 'Aphrodite', 11: 'Hermes', 12: 'Dionysos' };
for (const c of LAYOUT.cabins) c.god ??= GODS[c.nr];

export function cabin(nr) {
  return LAYOUT.cabins.find((c) => c.nr === nr);
}

// Punkt vor der Tür (Abstand d)
export function inFrontOf(c, d) {
  return { x: c.x + Math.sin(c.facing) * d, z: c.z + Math.cos(c.facing) * d };
}

// Wege (Erde)
const P = LAYOUT;
export const PATHS = [
  [[-2, -30.5], [-0.5, -27], [0.5, -22], [0, -12], [0, -2], [0, 3]],
  [[0.3, -17.5], [-6, -17], [-9.5, -17]],
  [[0, -8], [8, -12], [14, -18], [20, -22]],
  [[0, -2], [10, -4], [19, -5], [24, -6]],
  [[10, -4], [16, 2], [20, 8]],
  [[0, 3], [-6, 4.5], [-16, 6.5], [-22.5, 7]],
  [[-19, -17], [-25, -20], [-28, -22]],
  // Weg vor den Hütten entlang (ein U)
  [[8, 0], [8, 24.5], [-8, 24.5], [-8, 0]],
  [[0, 3], [8, 0]],
  [[0, 3], [-8, 0]],
  [[8, 24.5], [14, 28], [19, 31]],
  [[-8, 24.5], [-12, 25.5], [-17.5, 25.5]],
];

// --- Hilfsfunktionen ---------------------------------------------------------
function smoothstep(t) {
  t = Math.min(Math.max(t, 0), 1);
  return t * t * (3 - 2 * t);
}

function distToSeg(px, pz, ax, az, bx, bz) {
  const vx = bx - ax;
  const vz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / (vx * vx + vz * vz)));
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}

export function distToPolyline(x, z, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSeg(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

function lakeE(x, z) {
  const L = P.lake;
  return ((x - L.x) / L.rx) ** 2 + ((z - L.z) / L.rz) ** 2;
}

// Höhe ohne Bachbett (für die Wasseroberfläche des Bachs)
export function baseHeight(x, z) {
  const { hill } = P;
  const d = Math.hypot(x - hill.x, (z - hill.z) * 1.1);
  let h = hill.height * smoothstep(1 - d / hill.radius);

  // flache Anhöhe mit dem Speisepavillon, Blick aufs Meer
  const pv = P.pavilion;
  const pd = Math.hypot((x - pv.x) / 1.2, z - pv.z);
  h += 1.6 * smoothstep(1 - (pd - 7) / 6);

  // Strand fällt zum Meer ab
  h -= 1.0 * smoothstep((z - 36) / 9);
  if (z > 45) h -= (z - 45) * 0.25;

  // Wellen im Wald (die Camp-Mitte bleibt flach)
  const forest = Math.max(smoothstep((Math.abs(x + 3) - 36) / 6), smoothstep((-z - 44) / 6));
  h += forest * (Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.5 + Math.sin(x * 0.07 + z * 0.11) * 0.8);

  // Gelände steigt außerhalb an (Waldkante / Hügel am Horizont)
  const edge = Math.min(Math.max(Math.abs(x + 3) - 50, -z - 55), 20);
  if (edge > 0) h += edge * edge * 0.04;
  return h;
}

export function heightAt(x, z) {
  let h = baseHeight(x, z);
  // Mulde für den Kanusee
  const e = lakeE(x, z);
  if (e < 1.3) h -= 2.4 * smoothstep((1.12 - e) / 0.6);
  // Bachbett
  const dc = distToPolyline(x, z, P.creek);
  if (dc < 3.2) h -= 1.1 * smoothstep(1 - dc / 3.2);
  return h;
}

// Begehbare Flächen über dem Boden (Veranda, Pavillon, Steg …)
export const PLATFORMS = [];
export function addPlatform(minX, maxX, minZ, maxZ, y) {
  PLATFORMS.push({ minX, maxX, minZ, maxZ, y });
}
export function groundAt(x, z) {
  let h = heightAt(x, z);
  for (const p of PLATFORMS) if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ) h = Math.max(h, p.y);
  return h;
}

// Anteil Erde (x) und Sand (y) an einer Stelle
function splatAt(x, z) {
  let dirt = 0;
  for (const path of PATHS) {
    const d = distToPolyline(x, z, path);
    dirt = Math.max(dirt, 1 - smoothstep((d - 0.9) / 0.9));
  }
  // Ring um das Lagerfeuer
  const fc = Math.hypot(x - P.campfire.x, z - P.campfire.z);
  dirt = Math.max(dirt, 1 - smoothstep((fc - 4.2) / 0.8));
  // Arena-Boden
  const ae = ((x - P.arena.x) / P.arena.rx) ** 2 + ((z - P.arena.z) / P.arena.rz) ** 2;
  let sand = 1 - smoothstep((ae - 0.9) / 0.15);
  // Volleyballfeld
  const vb = P.volleyball;
  if (Math.abs(x - vb.x) < 9 && Math.abs(z - vb.z) < 5) sand = Math.max(sand, 1 - smoothstep((Math.max(Math.abs(x - vb.x) - 8, Math.abs(z - vb.z) - 4.5) + 0.5) / 0.6));
  // Strand
  sand = Math.max(sand, smoothstep((z - 34.5) / 2.5));
  // Seeufer
  const e = lakeE(x, z);
  sand = Math.max(sand, (1 - smoothstep((e - 1.1) / 0.25)) * 0.9);
  // Bachufer
  const dc = distToPolyline(x, z, P.creek);
  dirt = Math.max(dirt, 1 - smoothstep((dc - 1.5) / 2));
  // Erdbeerfelder
  const sf = P.strawberries;
  if (Math.abs(x - sf.x) < sf.w / 2 + 0.5 && Math.abs(z - sf.z) < sf.d / 2 + 0.5) dirt = Math.max(dirt, 0.75);
  // Amphitheater-Bühne
  if (Math.hypot(x - P.amphitheater.x, z - P.amphitheater.z) < 3.5) dirt = Math.max(dirt, 0.8);
  // Hügelkuppe etwas trockener
  return [dirt, sand];
}

// --- Gelände-Mesh --------------------------------------------------------------
// Innen fein (0,6 m Raster), außen grob. Beides mit Gras, Erde und Sand gemischt.
function gridGeometry(size, seg, cx, cz, skip) {
  const pos = [];
  const idx = [];
  const n = seg + 1;
  const step = size / seg;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      pos.push(cx - size / 2 + i * step, 0, cz - size / 2 + j * step);
    }
  for (let j = 0; j < seg; j++)
    for (let i = 0; i < seg; i++) {
      const a = j * n + i;
      const x0 = pos[a * 3];
      const z0 = pos[a * 3 + 2];
      if (skip && skip(x0, z0, x0 + step, z0 + step)) continue;
      idx.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

let terrainMaterial;
function getTerrainMaterial() {
  if (terrainMaterial) return terrainMaterial;
  const tile = 3.2;
  const map = loadTex('grass_diff.jpg', { tile });
  const normalMap = loadTex('grass_nor.jpg', { tile, srgb: false });
  const dirtMap = loadTex('dirt_diff.jpg', { tile: 2.6 });
  const sandMap = loadTex('sand_diff.jpg', { tile: 3 });
  const mat = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(0.8, 0.8), vertexColors: true, roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.dirtMap = { value: dirtMap };
    shader.uniforms.sandMap = { value: sandMap };
    shader.uniforms.dirtScale = { value: tile / 2.6 };
    shader.uniforms.sandScale = { value: tile / 3 };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 splat;\nvarying vec2 vSplat;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvSplat = splat;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D dirtMap;\nuniform sampler2D sandMap;\nuniform float dirtScale;\nuniform float sandScale;\nvarying vec2 vSplat;')
      .replace(
        '#include <map_fragment>',
        `vec4 grassC = texture2D(map, vMapUv);
        vec4 dirtC = texture2D(dirtMap, vMapUv * dirtScale);
        vec4 sandC = texture2D(sandMap, vMapUv * sandScale) * vec4(1.18, 1.05, 0.82, 1.0);
        // Übergänge mit etwas Rauschen aus der Grastextur, damit sie natürlich ausfransen
        float n = grassC.g * 1.4 - 0.4;
        float d = smoothstep(0.35, 0.65, vSplat.x + (n - 0.3) * 0.5);
        float s = smoothstep(0.35, 0.65, vSplat.y + (n - 0.3) * 0.4);
        vec4 c = mix(grassC, dirtC, d);
        c = mix(c, sandC, s);
        diffuseColor *= c;`,
      );
  };
  terrainMaterial = mat;
  return mat;
}

function finishTerrain(geo) {
  const pos = geo.attributes.position;
  const n = pos.count;
  const colors = new Float32Array(n * 3);
  const splat = new Float32Array(n * 2);
  const uv = new Float32Array(n * 2);
  const lush = new THREE.Color('#d9ebb2');
  const warm = new THREE.Color('#fff0c0');
  const dry = new THREE.Color('#ead79c');
  const white = new THREE.Color('#ffffff');
  const tmp = new THREE.Color();
  for (let i = 0; i < n; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    uv.set([x, z], i * 2);
    const [dirt, sand] = splatAt(x, z);
    splat.set([dirt, sand], i * 2);
    const nA = Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2.2) * 0.5 + 0.5;
    const nB = Math.sin(z * 0.21 - x * 0.05) * 0.5 + 0.5;
    tmp.copy(lush).lerp(warm, nA * 0.7).multiplyScalar(0.86 + nB * 0.18);
    const slope = Math.abs(heightAt(x + 0.5, z) - heightAt(x - 0.5, z)) + Math.abs(heightAt(x, z + 0.5) - heightAt(x, z - 0.5));
    tmp.lerp(dry, Math.min(slope * 0.4, 0.4));
    // unter Wasser dunkler
    if (h < -0.3) tmp.multiplyScalar(0.75);
    tmp.lerp(white, Math.max(dirt, sand) * 0.8);
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('splat', new THREE.BufferAttribute(splat, 2));
  // Welt-UV in Kacheln
  const tile = 3.2;
  for (let i = 0; i < uv.length; i++) uv[i] /= tile;
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, getTerrainMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

export function createTerrain() {
  const INNER = 110;
  const cx = -3;
  const cz = -1;
  const inner = finishTerrain(gridGeometry(INNER, 184, cx, cz));
  inner.name = 'ground';
  const half = INNER / 2 - 0.6;
  const outerGeo = gridGeometry(550, 100, cx, cz, (x0, z0, x1, z1) => x0 > cx - half && x1 < cx + half && z0 > cz - half && z1 < cz + half);
  const outer = finishTerrain(outerGeo);
  outer.position.y = -0.08; // liegt knapp unter dem feinen Gelände, keine Lücken
  outer.receiveShadow = true;
  const group = new THREE.Group();
  group.add(inner, outer);
  return { group, ground: inner };
}
