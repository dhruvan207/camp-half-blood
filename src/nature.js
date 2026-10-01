import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, mat4, rng, canvasTexture } from './kit.js';
import { LAYOUT, PATHS, heightAt, distToPolyline } from './terrain.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Das Goldene Vlies hängt erst ab Band 2 („Im Bann des Zyklopen“) an Thalias Kiefer.
// Auf false setzen, wenn es genau wie in Band 1 sein soll.
export const SHOW_FLEECE = true;

// --- Baumformen (werden per Instancing hundertfach gezeichnet) ----------------
function pineKit(seed) {
  const r = rng(seed);
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.16, 0.32, 6, 7), 'bark', '#c4a88c', mat4(0, 3, 0));
  const greens = ['#2f4f2b', '#36592f', '#2a4727', '#3b6034'];
  const layers = 6;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const rad = 2.4 * (1 - t * 0.82) + r() * 0.2;
    const geo = new THREE.ConeGeometry(rad, 2.2 - t * 0.6, 9, 1, true);
    // Ränder unregelmäßig machen
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      if (p.getY(j) < 0) {
        const f = 1 + (r() - 0.5) * 0.35;
        p.setX(j, p.getX(j) * f);
        p.setZ(j, p.getZ(j) * f);
        p.setY(j, p.getY(j) - r() * 0.25);
      }
    }
    geo.computeVertexNormals();
    k.add(geo, 'leaf', greens[i % 4], mat4(0, 2.2 + i * 1.15, 0, 0, r() * 3, 0));
  }
  return k.build();
}

function oakKit(seed) {
  const r = rng(seed);
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.25, 0.42, 3.4, 8), 'bark', '#bba48e', mat4(0, 1.7, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + r();
    k.limb('bark', '#bba48e', v(0, 2.8, 0), v(Math.cos(a) * 1.5, 4.3, Math.sin(a) * 1.5), 0.14, 6);
  }
  const greens = ['#4d7a33', '#5b8a3a', '#43702e', '#68953f'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    const d = i === 0 ? 0 : 1.4 + r() * 0.9;
    const geo = new THREE.IcosahedronGeometry(1.7 + r() * 0.7, 1);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const f = 1 + (r() - 0.5) * 0.25;
      p.setXYZ(j, p.getX(j) * f, p.getY(j) * f, p.getZ(j) * f);
    }
    geo.computeVertexNormals();
    k.add(geo, 'leaf', greens[i % 4], mat4(Math.cos(a) * d, 4.6 + r() * 1.4 + (i === 0 ? 0.8 : 0), Math.sin(a) * d, 0, 0, 0, 1, 0.8, 1));
  }
  return k.build();
}

function birchKit(seed) {
  const r = rng(seed);
  const k = new Kit();
  k.add(new THREE.CylinderGeometry(0.11, 0.18, 7, 7), 'plain', '#e9e6dc', mat4(0, 3.5, 0));
  for (let i = 0; i < 10; i++) k.box('plain', '#2b2824', 0.08 + r() * 0.08, 0.04, 0.05, Math.cos(i) * 0.15, 0.6 + i * 0.6, Math.sin(i) * 0.15, i);
  const greens = ['#7fa54a', '#8db356', '#6f9640'];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.IcosahedronGeometry(1.0 + r() * 0.4, 1);
    k.add(geo, 'leaf', greens[i % 3], mat4((r() - 0.5) * 1.4, 5 + i * 0.45, (r() - 0.5) * 1.4, 0, 0, 0, 1, 1.25, 1));
  }
  return k.build();
}

function instance(group, transforms, colors) {
  const out = new THREE.Group();
  for (const mesh of group.children) {
    const im = new THREE.InstancedMesh(mesh.geometry, mesh.material, transforms.length);
    transforms.forEach((m, i) => {
      im.setMatrixAt(i, m);
      if (colors && mesh.name === 'kit-leaf') im.setColorAt(i, colors[i]);
    });
    im.castShadow = true;
    im.receiveShadow = true;
    out.add(im);
  }
  return out;
}

// --- Wo darf ein Baum stehen? ---------------------------------------------------
function inRect(x, z, x0, x1, z0, z1) {
  return x > x0 && x < x1 && z > z0 && z < z1;
}

function keepClear(x, z, colliders, r = 1.2) {
  const L = LAYOUT;
  if (colliders.onPlatform?.(x, z)) return true;
  if (z > 33.5) return true; // Strand
  for (const p of PATHS) if (distToPolyline(x, z, p) < r + 1.4) return true;
  if (distToPolyline(x, z, L.creek) < r + 2.2) return true;
  const e = ((x - L.lake.x) / (L.lake.rx + 2)) ** 2 + ((z - L.lake.z) / (L.lake.rz + 2)) ** 2;
  if (e < 1) return true;
  if (inRect(x, z, -20, 20, -6, 36)) return true; // Hütten und Wiese
  if (Math.hypot(x - L.hill.x, z - L.hill.z) < 11) return true; // freier Blick vom Hügel
  if (inRect(x, z, -10, 10, -34, -5)) return true; // Weg vom Hügel ins Camp, Blick frei halten
  if (inRect(x, z, -27, -6, -28, -6)) return true; // Big House
  if (inRect(x, z, 0, 20, -20, -8)) return true; // Volleyball
  if (inRect(x, z, 10, 33, -34, -17)) return true; // Erdbeerfelder
  if (inRect(x, z, 19, 37, -14, 1)) return true; // Bogenschießen
  if (((x - L.arena.x) / (L.arena.rx + 5)) ** 2 + ((z - L.arena.z) / (L.arena.rz + 5)) ** 2 < 1) return true;
  if (inRect(x, z, 13, 35, 24, 42)) return true; // Pavillon
  if (Math.hypot(x - L.amphitheater.x, z - L.amphitheater.z) < 13) return true;
  if (inRect(x, z, -38, -24, -29, -8)) return true; // Ställe, Koppel
  if (colliders.hits(x, z, r)) return true;
  return false;
}

// ---------------------------------------------------------------------------
export function buildNature(colliders) {
  const group = new THREE.Group();
  const r = rng('forest');
  const B = LAYOUT.bounds;

  const kinds = [
    { kit: pineKit('p1'), list: [], cols: [], share: 0.32 },
    { kit: pineKit('p2'), list: [], cols: [], share: 0.25 },
    { kit: oakKit('o1'), list: [], cols: [], share: 0.18 },
    { kit: oakKit('o2'), list: [], cols: [], share: 0.13 },
    { kit: birchKit('b1'), list: [], cols: [], share: 0.12 },
  ];
  const pick = () => {
    let x = r();
    for (const k of kinds) if ((x -= k.share) < 0) return k;
    return kinds[0];
  };
  const placeTree = (x, z, inside) => {
    const kind = pick();
    const s = 0.8 + r() * 0.55;
    const y = heightAt(x, z) - 0.1;
    kind.list.push(mat4(x, y, z, (r() - 0.5) * 0.08, r() * Math.PI * 2, (r() - 0.5) * 0.08, s, s * (0.9 + r() * 0.25), s));
    kind.cols.push(new THREE.Color().setHSL(0.25 + (r() - 0.5) * 0.06, 0.15 + r() * 0.15, 0.85 + r() * 0.15).lerp(new THREE.Color('#ffffff'), 0.4));
    if (inside) colliders.addCircle(x, z, 0.45 * s);
  };

  // dichter Wald außerhalb der begehbaren Fläche
  for (let i = 0; i < 9000; i++) {
    const x = -130 + r() * 250;
    const z = -140 + r() * 172;
    const insideX = x > B.minX - 1 && x < B.maxX + 4;
    const insideZ = z > B.minZ - 1;
    if (insideX && insideZ) continue;
    if (z > 33) continue;
    const dist = Math.max(B.minX - x, x - B.maxX, B.minZ - z, 0);
    const p = dist < 25 ? 0.12 : dist > 60 ? 0.03 : 0.07;
    if (r() > p) continue;
    if (distToPolyline(x, z, LAYOUT.creek) < 2.6) continue;
    placeTree(x, z, false);
  }
  // lockerer Wald im Camp (vor allem im Osten am Bach und um den See)
  for (let i = 0; i < 6000; i++) {
    const x = B.minX + 1 + r() * (B.maxX - B.minX - 1);
    const z = B.minZ + 1 + r() * (34 - B.minZ);
    const east = x > 27 ? 0.05 : 0;
    const west = x < -36 ? 0.035 : 0;
    const north = z < -38 ? 0.04 : 0;
    const p = 0.004 + east + west + north;
    if (r() > p) continue;
    if (keepClear(x, z, colliders)) continue;
    placeTree(x, z, true);
  }
  for (const k of kinds) if (k.list.length) group.add(instance(k.kit, k.list, k.cols));

  // --- Thalias Kiefer auf dem Half-Blood Hill ---
  group.add(buildThaliaPine(colliders));

  // --- Erdbeerfelder ---
  group.add(buildStrawberries());

  // --- Felsen ---
  group.add(buildRocks(colliders));

  // --- Grasbüschel und Blumen ---
  group.add(buildGrass(colliders));

  return group;
}

// ---------------------------------------------------------------------------
function buildThaliaPine(colliders) {
  const { x, z } = LAYOUT.thaliaPine;
  const y = heightAt(x, z) - 0.2;
  const r = rng('thalia');
  const k = new Kit();
  // Blickrichtung zum Camp (Süden), dorthin zeigt auch das Vlies
  k.at(x, y, z, 0, () => {
    k.add(new THREE.CylinderGeometry(0.3, 0.7, 14, 10), 'bark', '#c9ad92', mat4(0, 7, 0));
    // Wurzeln
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      k.add(new THREE.CylinderGeometry(0.05, 0.28, 1.7, 6), 'bark', '#b89c80', mat4(Math.cos(a) * 0.6, 0.15, Math.sin(a) * 0.6, 0, -a, Math.PI / 2 - 0.35));
    }
    // Nadelkleid in vielen unregelmäßigen Etagen (wie bei einer alten Kiefer)
    const greens = ['#2c4828', '#33552e', '#284226', '#3a5f34'];
    const layers = 9;
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const rad = 4.3 * (1 - t * 0.85) + r() * 0.3;
      const geo = new THREE.ConeGeometry(rad, 2.6 - t * 0.9, 14, 1, true);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        if (p.getY(j) < 0) {
          const f = 1 + (r() - 0.5) * 0.45;
          p.setX(j, p.getX(j) * f);
          p.setZ(j, p.getZ(j) * f);
          p.setY(j, p.getY(j) - r() * 0.45);
        }
      }
      geo.computeVertexNormals();
      k.add(geo, 'leaf', greens[i % 4], mat4((r() - 0.5) * 0.3, 4.2 + i * 1.25, (r() - 0.5) * 0.3, 0, r() * 3, 0));
    }
    // ein kräftiger unterer Ast nach Süden, über dem das Vlies hängt
    const bx = 0.4;
    const bz = 2.6;
    k.limb('bark', '#b89c80', v(0, 4.2, 0), v(bx, 3.75, bz + 0.6), 0.13, 6);
    if (SHOW_FLEECE) {
      // Goldenes Vlies: ein Schaffell, über den Ast geworfen, dicht mit goldenen Wolllocken
      const W = 1.2;
      const H = 1.5;
      // Form des Fells: oben über den Ast gefaltet, unten hängend, Ränder wellig
      const surf = (u, w) => {
        const px = (u - 0.5) * W;
        const py = (w - 0.5) * H;
        const over = Math.max(0, py - 0.35);
        const y = py > 0.35 ? 0.35 + Math.sin(over * 2.6) * 0.22 : py;
        const z = -over * 0.7 + Math.cos(Math.min(py, 0.35) * 1.6) * 0.1 + Math.sin(px * 8 + py * 5) * 0.03;
        const narrow = 1 - Math.max(0, -py) * 0.2;
        return v(px * narrow, y, z);
      };
      const geo = new THREE.PlaneGeometry(1, 1, 12, 16);
      const p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) {
        const q = surf(p.getX(j) + 0.5, p.getY(j) + 0.5);
        p.setXYZ(j, q.x, q.y, q.z);
      }
      geo.computeVertexNormals();
      const fx = bx;
      const fy = 3.4;
      const fz = bz + 0.6;
      k.add(geo, 'fleece', '#ffffff', mat4(fx, fy, fz));
      // Wolllocken auf der Vorderseite
      for (let i = 0; i < 150; i++) {
        const u = r();
        const w = r() * 0.8;
        const q = surf(u, w);
        k.sphere('fleece', i % 4 ? '#ffffff' : '#ffe9a8', 0.05 + r() * 0.03, fx + q.x, fy + q.y, fz + q.z + 0.04, 1, 1, 0.7, 6);
      }
      // Beine des Fells als hängende Zipfel
      for (const s of [-1, 1]) {
        const a = surf(s > 0 ? 0.92 : 0.08, 0.02);
        k.add(new THREE.ConeGeometry(0.1, 0.45, 6), 'fleece', '#ffffff', mat4(fx + a.x, fy + a.y - 0.18, fz + a.z, Math.PI, 0, s * 0.15));
      }
    }
  });
  colliders.addCircle(x, z, 1.1);
  return k.build();
}

function buildStrawberries() {
  const sf = LAYOUT.strawberries;
  const k = new Kit();
  // Büsche mit roten Beeren
  const bush = new Kit();
  bush.add(new THREE.IcosahedronGeometry(0.32, 1), 'leaf', '#3f7a2e', mat4(0, 0.15, 0, 0, 0, 0, 1, 0.55, 1));
  const r = rng('berries');
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    bush.sphere('glossy', '#d42a2a', 0.045, Math.cos(a) * 0.26, 0.12 + r() * 0.08, Math.sin(a) * 0.26, 1, 1.15, 1, 6);
  }
  const bushGroup = bush.build();
  const mats = [];
  for (let row = 0; row < 10; row++) {
    const z = sf.z - sf.d / 2 + 0.6 + row * 1.2;
    for (let i = 0; i < 26; i++) {
      const x = sf.x - sf.w / 2 + 0.4 + i * 0.68 + (r() - 0.5) * 0.15;
      const s = 0.8 + r() * 0.4;
      mats.push(mat4(x, heightAt(x, z), z, 0, r() * 6, 0, s, s, s));
    }
    // Erdwall der Reihe, in Stücken, damit er dem Hang folgt
    for (let sgm = 0; sgm < 9; sgm++) {
      const x = sf.x - sf.w / 2 + (sgm + 0.5) * (sf.w / 9);
      k.box('plain', '#6a4a30', sf.w / 9 + 0.05, 0.14, 0.5, x, heightAt(x, z) + 0.02, z);
    }
  }
  const g = new THREE.Group();
  g.add(k.build(), instance(bushGroup, mats));
  // Holzzaun und Schild ohne Text
  return g;
}

function buildRocks(colliders) {
  const r = rng('rocks');
  const k = new Kit();
  const spots = [];
  // am Strand, am Bach, im Wald
  for (let i = 0; i < 14; i++) spots.push([-40 + r() * 75, 35.5 + r() * 5, 0.4 + r() * 0.6]);
  for (let i = 0; i < 18; i++) {
    const p = LAYOUT.creek[1 + Math.floor(r() * 5)];
    spots.push([p[0] + (r() - 0.5) * 4, p[1] + (r() - 0.5) * 10, 0.3 + r() * 0.5]);
  }
  for (let i = 0; i < 20; i++) spots.push([-60 + r() * 120, -48 - r() * 30, 0.6 + r() * 1.2]);
  for (const [x, z, s] of spots) {
    if (Math.abs(x - LAYOUT.campfire.x) < 20 && z < 33 && z > -5) continue;
    const geo = new THREE.DodecahedronGeometry(s, 1);
    const p = geo.attributes.position;
    for (let j = 0; j < p.count; j++) p.setXYZ(j, p.getX(j) * (1 + (r() - 0.5) * 0.3), p.getY(j) * (0.6 + r() * 0.2), p.getZ(j) * (1 + (r() - 0.5) * 0.3));
    geo.computeVertexNormals();
    k.add(geo, 'stone', '#9b958a', mat4(x, heightAt(x, z) + s * 0.15, z, 0, r() * 6, 0));
    if (s > 0.5) colliders.addCircle(x, z, s * 0.9);
  }
  // Treibholz am Strand
  for (let i = 0; i < 5; i++) {
    const x = -30 + i * 14 + r() * 5;
    const z = 37 + r() * 3;
    const y = heightAt(x, z);
    k.limb('bark', '#a8988a', v(x - 1, y + 0.1, z), v(x + 1.2, y + 0.15, z + (r() - 0.5)), 0.12, 6);
  }
  return k.build();
}

function buildGrass(colliders) {
  const tex = canvasTexture(
    128,
    128,
    (g, w, h) => {
      g.clearRect(0, 0, w, h);
      const r = rng('blades');
      for (let i = 0; i < 26; i++) {
        const x = 10 + r() * (w - 20);
        const lean = (r() - 0.5) * 30;
        const top = 10 + r() * 40;
        g.strokeStyle = `hsl(${78 + r() * 25},${40 + r() * 20}%,${28 + r() * 22}%)`;
        g.lineWidth = 2 + r() * 2.5;
        g.beginPath();
        g.moveTo(x, h);
        g.quadraticCurveTo(x + lean * 0.3, h * 0.5, x + lean, top);
        g.stroke();
      }
    },
    { repeat: false },
  );
  const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 });
  // zwei gekreuzte Flächen pro Büschel
  const a = new THREE.PlaneGeometry(0.6, 0.36);
  a.translate(0, 0.17, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const geo = mergeGeometries([a, b]);

  const r = rng('grass');
  const B = LAYOUT.bounds;
  const mats = [];
  const cols = [];
  const flowers = [];
  for (let i = 0; i < 40000 && mats.length < 5000; i++) {
    const x = B.minX + r() * (B.maxX - B.minX);
    const z = B.minZ + r() * (34 - B.minZ);
    if (keepGrassClear(x, z, colliders)) continue;
    const s = 0.5 + r() * 0.5;
    mats.push(mat4(x, heightAt(x, z) - 0.02, z, 0, r() * 3, 0, s, s * (0.8 + r() * 0.6), s));
    cols.push(new THREE.Color().setHSL(0.2 + r() * 0.06, 0.2, 0.5 + r() * 0.22));
    if (r() < 0.12) flowers.push([x + (r() - 0.5) * 0.4, z + (r() - 0.5) * 0.4, s]);
  }
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((m, i) => {
    im.setMatrixAt(i, m);
    im.setColorAt(i, cols[i]);
  });
  im.receiveShadow = true;

  // Wildblumen
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshStandardMaterial({ roughness: 0.8 }), flowers.length);
  const fcols = ['#ffffff', '#f7d84a', '#c48ae0', '#f29ab8', '#ffffff'];
  flowers.forEach(([x, z, s], i) => {
    fl.setMatrixAt(i, mat4(x, heightAt(x, z) + 0.32 * s, z));
    fl.setColorAt(i, new THREE.Color(fcols[i % fcols.length]));
  });
  const g = new THREE.Group();
  g.add(im, fl);
  return g;
}

function keepGrassClear(x, z, colliders) {
  const L = LAYOUT;
  if (colliders.onPlatform?.(x, z)) return true; // kein Gras in Hütten, auf Veranden und Stegen
  for (const p of PATHS) if (distToPolyline(x, z, p) < 1.9) return true;
  if (Math.hypot(x - L.campfire.x, z - L.campfire.z) < 5.4) return true;
  const e = ((x - L.lake.x) / (L.lake.rx + 1.5)) ** 2 + ((z - L.lake.z) / (L.lake.rz + 1.5)) ** 2;
  if (e < 1) return true;
  if (distToPolyline(x, z, L.creek) < 2.8) return true;
  if (((x - L.arena.x) / L.arena.rx) ** 2 + ((z - L.arena.z) / L.arena.rz) ** 2 < 1.1) return true;
  const vbAlongZ = L.volleyball.along === 'z';
  if (Math.abs(x - L.volleyball.x) < (vbAlongZ ? 5 : 9) && Math.abs(z - L.volleyball.z) < (vbAlongZ ? 9 : 5)) return true;
  const sf = L.strawberries;
  if (Math.abs(x - sf.x) < sf.w / 2 + 1 && Math.abs(z - sf.z) < sf.d / 2 + 1) return true;
  if (Math.hypot(x - L.amphitheater.x, z - L.amphitheater.z) < 11) return true;
  return colliders.hits(x, z, 0.5);
}
