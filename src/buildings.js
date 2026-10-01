import * as THREE from 'three';
import { Kit, mat4, rng } from './kit.js';
import { LAYOUT, heightAt, addPlatform } from './terrain.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const WHITE = '#f6f3ec';

// Umrechnung von Gebäude-Koordinaten (lx, lz) in Welt-Koordinaten
export function toWorld(base, lx, lz) {
  const c = Math.cos(base.facing);
  const s = Math.sin(base.facing);
  return { x: base.x + lx * c + lz * s, z: base.z - lx * s + lz * c };
}

// Rechteck in Gebäude-Koordinaten als begehbare Fläche eintragen
function localPlatform(base, lx0, lx1, lz0, lz1, y) {
  const a = toWorld(base, lx0, lz0);
  const b = toWorld(base, lx1, lz1);
  addPlatform(Math.min(a.x, b.x), Math.max(a.x, b.x), Math.min(a.z, b.z), Math.max(a.z, b.z), y);
}

// ---------------------------------------------------------------------------
// Big House: vierstöckiges Farmhaus, himmelblau mit weißen Kanten,
// umlaufende Veranda, Wetterfahne mit Bronzeadler.
export const BIG_HOUSE = { w: 12, d: 9, floor: 0.6, storey: 3, porch: 2.8 };

export function bigHouseSpot(lx, lz, yaw = 0) {
  const b = LAYOUT.bigHouse;
  const p = toWorld(b, lx, lz);
  return { ...p, y: heightAt(b.x, b.z) + BIG_HOUSE.floor, yaw: b.facing + yaw };
}

function window2(k, x, y, z, ry, w = 1.0, h = 1.5, shutter = '#2f5f86') {
  k.at(x, y, z, ry, () => {
    k.box('glass', '#2a3540', w, h, 0.06, 0, 0, 0);
    k.box('plain', WHITE, w + 0.2, 0.12, 0.12, 0, h / 2 + 0.06, 0.02);
    k.box('plain', WHITE, w + 0.26, 0.1, 0.18, 0, -h / 2 - 0.05, 0.04);
    k.box('plain', WHITE, 0.1, h, 0.1, -w / 2 - 0.05, 0, 0.02);
    k.box('plain', WHITE, 0.1, h, 0.1, w / 2 + 0.05, 0, 0.02);
    k.box('plain', WHITE, w, 0.06, 0.06, 0, 0, 0.03);
    k.box('plain', WHITE, 0.06, h, 0.06, 0, 0, 0.03);
    if (shutter) for (const s of [-1, 1]) k.box('wood', shutter, w * 0.45, h + 0.1, 0.05, s * (w / 2 + w * 0.3), 0, 0.02);
  });
}

function buildBigHouse(k, colliders) {
  const b = LAYOUT.bigHouse;
  const H = BIG_HOUSE;
  const { w, d, floor, storey, porch } = H;
  const y0 = heightAt(b.x, b.z);
  const wallH = storey * 3;
  const blue = '#a9dcff';
  k.at(b.x, y0, b.z, b.facing, () => {
    k.box('stone', '#8a8478', w + 0.3, floor, d + 0.3, 0, floor / 2, 0);
    k.box('wood', blue, w, wallH, d, 0, floor + wallH / 2, 0);
    // weiße Kanten: Ecken und Bänder zwischen den Stockwerken
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box('plain', WHITE, 0.22, wallH, 0.22, (x * w) / 2, floor + wallH / 2, (z * d) / 2);
    for (let f = 1; f < storey; f++) k.box('plain', WHITE, w + 0.12, 0.16, d + 0.12, 0, floor + f * 3, 0);
    k.box('plain', WHITE, w + 0.2, 0.3, d + 0.2, 0, floor + wallH - 0.1, 0);
    // Steiles Dach (Dachboden = viertes Stockwerk), First parallel zur Vorderseite
    const rh = 4.4;
    const top = floor + wallH;
    k.at(0, 0, 0, Math.PI / 2, () => k.gable('roof', '#6c7178', d, w, rh, 0, top, 0, 0.55, 0.2));
    for (const s of [-1, 1]) k.gableWall('wood', blue, d, rh, s * (w / 2 - 0.1), top, 0, Math.PI / 2, 0.2);
    // Gauben mit Fenstern im Dachboden
    for (const x of [-3, 3]) {
      const dz = d / 2 - 1.2;
      k.box('wood', blue, 1.6, 1.7, 2.0, x, top + 0.95, dz);
      k.gable('roof', '#6c7178', 1.6, 2.0, 0.8, x, top + 1.8, dz, 0.18, 0.1);
      k.gableWall('wood', blue, 1.6, 0.8, x, top + 1.8, dz + 1.0, 0, 0.1);
      window2(k, x, top + 0.95, dz + 1.03, 0, 0.8, 1.0, null);
    }
    // Giebelfenster an den Seiten
    for (const s of [-1, 1]) window2(k, s * (w / 2 + 0.02), top + 1.5, 0, (s * Math.PI) / 2, 0.8, 1.0, null);
    // Schornstein
    k.box('stone', '#8a4f3a', 0.9, 5, 0.9, w / 2 - 2.2, top + 2.8, -1.2);
    k.box('stone', '#6f3e2e', 1.05, 0.25, 1.05, w / 2 - 2.2, top + 5.3, -1.2);
    // Fenster
    for (let f = 0; f < storey; f++) {
      const y = floor + f * 3 + 1.6;
      for (const x of [-4.6, -2.3, 2.3, 4.6]) window2(k, x, y, d / 2 + 0.03, 0);
      if (f > 0) window2(k, 0, y, d / 2 + 0.03, 0);
      for (const x of [-4, -1.3, 1.3, 4]) window2(k, x, y, -d / 2 - 0.03, Math.PI);
      for (const z of [-2.6, 0, 2.6]) {
        window2(k, -w / 2 - 0.03, y, z, -Math.PI / 2);
        window2(k, w / 2 + 0.03, y, z, Math.PI / 2);
      }
    }
    // Haustür mit Oberlicht
    k.box('wood', '#2f4f6f', 1.5, 2.4, 0.1, 0, floor + 1.2, d / 2 + 0.05);
    k.box('glass', '#3a4a58', 1.5, 0.45, 0.08, 0, floor + 2.65, d / 2 + 0.05);
    k.box('plain', WHITE, 1.9, 0.16, 0.16, 0, floor + 2.95, d / 2 + 0.06);
    for (const s of [-1, 1]) k.box('plain', WHITE, 0.16, 2.9, 0.16, s * 0.87, floor + 1.45, d / 2 + 0.06);

    // Umlaufende Veranda (vorne und links)
    const pz = d / 2 + porch / 2;
    const px = -w / 2 - porch / 2;
    k.box('wood', '#b9a98f', w + porch, 0.14, porch, -porch / 2, floor - 0.07, pz);
    k.box('wood', '#b9a98f', porch, 0.14, d, px, floor - 0.07, 0);
    k.box('plain', '#ddd6c8', w + porch, floor - 0.14, 0.08, -porch / 2, (floor - 0.14) / 2, d / 2 + porch);
    k.box('plain', '#ddd6c8', 0.08, floor - 0.14, d + porch, -w / 2 - porch, (floor - 0.14) / 2, porch / 2);
    // Pfosten, Geländer, Vordach
    const postH = 3.1;
    const edgeZ = d / 2 + porch - 0.15;
    const edgeX = -w / 2 - porch + 0.15;
    const posts = [];
    for (let x = w / 2 - 0.15; x > edgeX; x -= 2.45) posts.push([x, edgeZ]);
    posts.push([edgeX, edgeZ]);
    for (let z = edgeZ - 2.45; z > -d / 2; z -= 2.45) posts.push([edgeX, z]);
    posts.push([edgeX, -d / 2 + 0.15]);
    for (const [x, z] of posts) k.box('plain', WHITE, 0.18, postH, 0.18, x, floor + postH / 2, z);
    const rail = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az);
      const ry = Math.atan2(bx - ax, bz - az);
      k.at((ax + bx) / 2, floor, (az + bz) / 2, ry, () => {
        k.box('plain', WHITE, 0.08, 0.08, len, 0, 0.95, 0);
        k.box('plain', WHITE, 0.06, 0.06, len, 0, 0.12, 0);
        for (let t = -len / 2 + 0.15; t < len / 2; t += 0.22) k.box('plain', WHITE, 0.04, 0.8, 0.04, 0, 0.53, t);
      });
    };
    rail(w / 2 - 0.15, edgeZ, 1.3, edgeZ);
    rail(-1.3, edgeZ, edgeX, edgeZ);
    rail(edgeX, edgeZ, edgeX, -d / 2 + 0.15);
    k.box('roof', '#7a7f86', w + porch + 0.4, 0.12, porch + 0.5, -porch / 2, floor + postH + 0.2, pz + 0.1, 0, 0.12);
    k.box('roof', '#7a7f86', porch + 0.5, 0.12, d + 0.2, px - 0.1, floor + postH + 0.2, -0.1, 0, 0, 0.12);
    k.box('plain', WHITE, w + porch + 0.3, 0.22, 0.12, -porch / 2, floor + postH + 0.02, edgeZ + 0.1);
    k.box('plain', WHITE, 0.12, 0.22, d + porch, edgeX - 0.1, floor + postH + 0.02, porch / 2);
    // Treppe zur Veranda
    for (let i = 0; i < 3; i++) k.box('wood', '#a8987e', 2.4, 0.2, 0.35, 0, 0.1 + i * 0.2, d / 2 + porch + 0.9 - i * 0.35);
    // Schaukelstuhl und Hängepflanzen
    k.box('wood', '#6b4a32', 0.6, 0.06, 0.6, -4.5, floor + 0.45, pz);
    k.box('wood', '#6b4a32', 0.6, 0.8, 0.06, -4.5, floor + 0.85, pz - 0.3);
    for (const x of [-3, 3]) {
      k.limb('plain', '#3a3a3a', v(x, floor + postH, edgeZ), v(x, floor + postH - 0.5, edgeZ), 0.01, 3);
      k.sphere('leaf', '#4f8f3e', 0.28, x, floor + postH - 0.65, edgeZ, 1, 0.8, 1, 8);
    }

    // Wetterfahne mit Bronzeadler auf dem First
    const ry = top + rh + 0.1;
    k.limb('bronze', '#b07a32', v(0, ry, 0), v(0, ry + 1.6, 0), 0.03);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      k.limb('bronze', '#b07a32', v(0, ry + 0.9, 0), v(Math.sin(a) * 0.5, ry + 0.9, Math.cos(a) * 0.5), 0.015, 4);
      k.cone('bronze', '#b07a32', 0.04, 0.1, Math.sin(a) * 0.55, ry + 0.9, Math.cos(a) * 0.55, 4, Math.PI / 2, a);
    }
    const ey = ry + 1.75;
    k.sphere('bronze', '#c08a3a', 0.16, 0, ey, 0, 0.8, 0.8, 1.6, 10);
    k.sphere('bronze', '#c08a3a', 0.09, 0, ey + 0.12, 0.26, 1, 1, 1.1, 8);
    k.cone('bronze', '#d9a441', 0.03, 0.1, 0, ey + 0.1, 0.38, 5, Math.PI / 2);
    for (const s of [-1, 1]) {
      k.box('bronze', '#c08a3a', 0.7, 0.03, 0.26, s * 0.42, ey + 0.12, 0, 0, 0, s * 0.35);
      k.box('bronze', '#c08a3a', 0.4, 0.03, 0.18, s * 0.82, ey + 0.32, -0.04, 0, 0, s * 0.7);
    }
    k.box('bronze', '#c08a3a', 0.18, 0.03, 0.3, 0, ey - 0.02, -0.32);
  });
  colliders.addBox(b.x, b.z, w / 2 + 0.2, d / 2 + 0.2, b.facing);
  localPlatform(b, -w / 2 - porch, w / 2, d / 2, d / 2 + porch, y0 + floor);
  localPlatform(b, -w / 2 - porch, -w / 2, -d / 2, d / 2 + porch, y0 + floor);
}

// ---------------------------------------------------------------------------
// Speisepavillon: griechisch, weiße Säulen, auf einer Anhöhe über dem Meer,
// Tische für jede Hütte, in der Mitte ein großes Bronzebecken mit Feuer.
function buildPavilion(k, colliders, fires) {
  const p = LAYOUT.pavilion;
  const y0 = heightAt(p.x, p.z);
  const fh = 0.6;
  const { w, d } = p;
  k.at(p.x, y0, p.z, 0, () => {
    k.box('marble', '#e4dfd4', w + 1.8, 1.0, d + 1.8, 0, -0.5, 0); // Fundament
    for (let i = 0; i < 3; i++) k.box('marble', '#ece8df', w + 1.8 - i * 0.6, 0.2, d + 1.8 - i * 0.6, 0, 0.1 + i * 0.2, 0);
    k.box('tiles', '#f2eee6', w, 0.02, d, 0, fh + 0.01, 0);
    // Säulen rundherum und Gebälk (oben offen)
    const colH = 4.2;
    const cols = [];
    for (let i = 0; i <= 6; i++) cols.push([-w / 2 + 0.4 + (i * (w - 0.8)) / 6, -d / 2 + 0.4], [-w / 2 + 0.4 + (i * (w - 0.8)) / 6, d / 2 - 0.4]);
    for (let i = 1; i < 4; i++) cols.push([-w / 2 + 0.4, -d / 2 + 0.4 + (i * (d - 0.8)) / 4], [w / 2 - 0.4, -d / 2 + 0.4 + (i * (d - 0.8)) / 4]);
    for (const [x, z] of cols) {
      k.box('marble', '#e8e4da', 0.7, 0.2, 0.7, x, fh + 0.1, z);
      k.cyl('marble', '#f6f3ec', 0.23, 0.27, colH - 0.4, x, fh + 0.2 + (colH - 0.4) / 2, z, 14);
      k.cyl('marble', '#e8e4da', 0.36, 0.25, 0.2, x, fh + colH - 0.1, z, 14);
      colliders.addCircle(p.x + x, p.z + z, 0.32);
    }
    for (const s of [-1, 1]) {
      k.box('marble', '#ece8df', w, 0.55, 0.6, 0, fh + colH + 0.27, s * (d / 2 - 0.4));
      k.box('marble', '#ece8df', 0.6, 0.55, d, s * (w / 2 - 0.4), fh + colH + 0.27, 0);
    }
    // Fackeln an den Säulen
    for (const [x, z] of cols.filter((_, i) => i % 3 === 0)) {
      const out = z > 0 ? 0.35 : -0.35;
      k.limb('bronze', '#9a6a2a', v(x, fh + 2.2, z + out * 0.6), v(x, fh + 2.8, z + out), 0.03, 5);
      k.cyl('bronze', '#9a6a2a', 0.09, 0.05, 0.18, x, fh + 2.85, z + out, 8);
      fires.push({ x: p.x + x, y: y0 + fh + 3.05, z: p.z + z + out, scale: 0.35, light: false });
    }
    // Tische (zwei Reihen) und Haupttisch
    const table = (x, z, len) => {
      k.box('marble', '#ddd8cc', len, 0.08, 0.9, x, fh + 0.75, z);
      k.box('plain', '#f7f5ef', len + 0.04, 0.02, 0.94, x, fh + 0.8, z);
      for (const s of [-1, 1]) {
        k.box('marble', '#cfc9bc', 0.15, 0.72, 0.6, x + s * (len / 2 - 0.3), fh + 0.38, z);
        k.box('wood', '#8a6a48', len, 0.06, 0.32, x, fh + 0.45, z + s * 0.75);
        k.box('wood', '#6e5238', len - 0.3, 0.42, 0.06, x, fh + 0.22, z + s * 0.75);
      }
      colliders.addBox(p.x + x, p.z + z, len / 2, 0.95);
    };
    for (const z of [-1.4, 1.4, 3.6]) for (const x of [-4.6, 4.6]) table(x, z, 4);
    table(0, -3.6, 5.5);
    // großes Bronzebecken für die Brandopfer
    k.add(new THREE.LatheGeometry([v(0.01, 0, 0), v(0.6, 0.05, 0), v(0.85, 0.35, 0), v(0.9, 0.55, 0), v(0.8, 0.55, 0)], 20), 'bronze', '#b8823a', mat4(0, fh + 0.9, 0.6));
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      k.limb('bronze', '#9a6a2a', v(Math.cos(a) * 0.7, fh, 0.6 + Math.sin(a) * 0.7), v(Math.cos(a) * 0.45, fh + 0.95, 0.6 + Math.sin(a) * 0.45), 0.05, 6);
    }
    fires.push({ x: p.x, y: y0 + fh + 1.4, z: p.z + 0.6, scale: 1.1, light: true, color: '#ff9a4a', intensity: 6, distance: 7 });
    colliders.addCircle(p.x, p.z + 0.6, 1.0);
  });
  addPlatform(p.x - w / 2 - 0.9, p.x + w / 2 + 0.9, p.z - d / 2 - 0.9, p.z + d / 2 + 0.9, y0 + fh);
}

// ---------------------------------------------------------------------------
// Arena: ovale Steinmauer mit zwei Toren, Holztribüne, Übungspuppen und Waffenständer
function buildArena(k, colliders) {
  const a = LAYOUT.arena;
  const y0 = heightAt(a.x, a.z);
  const N = 40;
  const pt = (i, r = 0) => {
    const t = (i / N) * Math.PI * 2;
    return [a.x + Math.cos(t) * (a.rx + r), a.z + Math.sin(t) * (a.rz + r)];
  };
  const gate = (i) => i === 20 || i === 21 || i === 9 || i === 10 || i === 30 || i === 31;
  for (let i = 0; i < N; i++) {
    if (gate(i)) continue;
    const [x0, z0] = pt(i);
    const [x1, z1] = pt(i + 1);
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ry = Math.atan2(x1 - x0, z1 - z0);
    k.at((x0 + x1) / 2, y0, (z0 + z1) / 2, ry, () => {
      k.box('stone', '#a49a8a', 0.55, 1.4, len + 0.08, 0, 0.7, 0);
      k.box('stone', '#8f8678', 0.7, 0.12, len + 0.1, 0, 1.45, 0);
    });
    colliders.addSegment(x0, z0, x1, z1, 0.35);
  }
  // Torpfosten
  for (const i of [20, 22, 9, 11, 30, 32]) {
    const [x, z] = pt(i);
    k.box('stone', '#8f8678', 0.8, 2.2, 0.8, x, y0 + 1.1, z);
    k.cone('bronze', '#b07a32', 0.12, 0.3, x, y0 + 2.35, z, 6);
  }
  // Holztribüne außen auf der Ostseite
  for (let i = 34; i < N + 6; i++) {
    const t0 = (i / N) * Math.PI * 2;
    const t1 = ((i + 1) / N) * Math.PI * 2;
    for (let row = 0; row < 3; row++) {
      const r = 0.9 + row * 0.9;
      const x0 = a.x + Math.cos(t0) * (a.rx + r);
      const z0 = a.z + Math.sin(t0) * (a.rz + r);
      const x1 = a.x + Math.cos(t1) * (a.rx + r);
      const z1 = a.z + Math.sin(t1) * (a.rz + r);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(x1 - x0, z1 - z0);
      k.at((x0 + x1) / 2, y0, (z0 + z1) / 2, ry, () => {
        k.box('wood', '#9a7a58', 0.75, 0.08, len + 0.05, 0, 0.6 + row * 0.55, 0);
        k.box('wood', '#6e5238', 0.1, 0.6 + row * 0.55, 0.1, 0, (0.6 + row * 0.55) / 2, 0);
      });
    }
  }
  const [bx0, bz0] = pt(34, 2);
  const [bx1, bz1] = pt(N + 6, 2);
  colliders.addSegment(bx0, bz0, (bx0 + bx1) / 2 + 3, (bz0 + bz1) / 2, 1.5);
  colliders.addSegment((bx0 + bx1) / 2 + 3, (bz0 + bz1) / 2, bx1, bz1, 1.5);
  // Übungspuppen aus Stroh mit griechischem Helm
  for (const [dx, dz] of [[-2.5, -3], [2.5, -3.5], [0, 3.5]]) {
    const x = a.x + dx;
    const z = a.z + dz;
    k.limb('wood', '#6a4a30', v(x, y0, z), v(x, y0 + 1.7, z), 0.06);
    k.limb('wood', '#6a4a30', v(x - 0.55, y0 + 1.35, z), v(x + 0.55, y0 + 1.35, z), 0.04);
    k.cyl('plain', '#d6b56a', 0.22, 0.2, 0.75, x, y0 + 1.2, z, 10);
    k.box('bronze', '#b88a3e', 0.48, 0.5, 0.3, x, y0 + 1.25, z + 0.06);
    k.sphere('plain', '#d6b56a', 0.15, x, y0 + 1.8, z, 1, 1.1, 1, 10);
    k.sphere('bronze', '#c49040', 0.17, x, y0 + 1.86, z, 1, 1, 1, 12);
    k.box('plain', '#b3261e', 0.06, 0.18, 0.4, x, y0 + 2.05, z);
    colliders.addCircle(x, z, 0.4);
  }
  // Waffenständer mit Schwertern und Schilden
  const rx = a.x + 4.5;
  const rz = a.z;
  k.at(rx, y0, rz, -Math.PI / 2, () => {
    k.box('wood', '#6a4a30', 2.2, 0.1, 0.4, 0, 0.3, 0);
    k.box('wood', '#6a4a30', 2.2, 0.1, 0.1, 0, 1.1, -0.1);
    for (const s of [-1, 1]) k.box('wood', '#6a4a30', 0.1, 1.3, 0.4, s * 1.05, 0.65, 0);
    for (let i = 0; i < 6; i++) {
      const x = -0.85 + i * 0.34;
      k.box('bronze', '#c9a05a', 0.06, 0.75, 0.015, x, 0.75, -0.05, 0.12);
      k.box('plain', '#3a2a1a', 0.18, 0.04, 0.05, x, 1.15, -0.1);
      k.box('plain', '#3a2a1a', 0.04, 0.22, 0.04, x, 1.27, -0.1);
    }
    for (const s of [-1, 1]) k.cyl('bronze', '#b88a3e', 0.42, 0.42, 0.06, s * 1.6, 0.6, 0.15, 18, Math.PI / 2 - 0.2);
  });
  colliders.addBox(rx, rz, 0.3, 1.7);
}

// ---------------------------------------------------------------------------
// Amphitheater: halbrunde Sitzstufen aus Stein, Bühne mit Feuerstelle
function buildAmphitheater(k, colliders) {
  const a = LAYOUT.amphitheater;
  const y0 = heightAt(a.x, a.z);
  const rows = 5;
  const segs = 18;
  for (let r = 0; r < rows; r++) {
    const rad = 5 + r * 1.1;
    const hgt = 0.45 * (r + 1);
    for (let i = 0; i < segs; i++) {
      const t0 = (i / segs) * Math.PI;
      const t1 = ((i + 1) / segs) * Math.PI;
      const x0 = a.x + Math.cos(t0) * rad;
      const z0 = a.z + Math.sin(t0) * rad;
      const x1 = a.x + Math.cos(t1) * rad;
      const z1 = a.z + Math.sin(t1) * rad;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(x1 - x0, z1 - z0);
      k.at((x0 + x1) / 2, y0, (z0 + z1) / 2, ry, () => k.box('tiles', '#ddd6c8', 1.12, hgt + 0.6, len + 0.06, 0, hgt / 2 - 0.3, 0));
    }
  }
  // Sitzbereich ist nicht begehbar (Stufen), Bühne schon
  const mid = [];
  for (let i = 0; i <= 12; i++) {
    const t = (i / 12) * Math.PI;
    mid.push([a.x + Math.cos(t) * 7.2, a.z + Math.sin(t) * 7.2]);
  }
  colliders.addPolyline(mid, 2.4);
  k.cyl('tiles', '#e6e0d4', 3.2, 3.3, 0.3, a.x, y0 + 0.1, a.z - 0.5, 28);
  addPlatform(a.x - 2.2, a.x + 2.2, a.z - 2.7, a.z + 1.7, y0 + 0.25);
  // Feuerstelle (aus)
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2;
    k.add(new THREE.DodecahedronGeometry(0.22, 0), 'stone', '#77736c', mat4(a.x + Math.cos(t) * 0.8, y0 + 0.35, a.z - 0.5 + Math.sin(t) * 0.8, t, t, 0));
  }
  k.cyl('plain', '#2b2622', 0.65, 0.65, 0.04, a.x, y0 + 0.27, a.z - 0.5, 16);
  colliders.addCircle(a.x, a.z - 0.5, 1.0);
}

// ---------------------------------------------------------------------------
function buildVolleyball(k, colliders) {
  const p = LAYOUT.volleyball;
  const y0 = heightAt(p.x, p.z);
  // Linien
  const line = (w, d, x, z) => k.box('plain', '#ffffff', w, 0.02, d, p.x + x, y0 + 0.01, p.z + z);
  line(16, 0.06, 0, -4);
  line(16, 0.06, 0, 4);
  line(0.06, 8, -8, 0);
  line(0.06, 8, 8, 0);
  // Pfosten und Netz
  for (const s of [-1, 1]) {
    k.cyl('metal', '#cfd3d6', 0.06, 0.06, 2.6, p.x, y0 + 1.3, p.z + s * 4.6, 8);
    colliders.addCircle(p.x, p.z + s * 4.6, 0.15);
  }
  k.box('plain', '#f2f2f2', 0.03, 0.07, 9.2, p.x, y0 + 2.42, p.z);
  for (let i = 0; i < 5; i++) k.box('plain', '#2a2a2a', 0.01, 0.01, 9.2, p.x, y0 + 1.6 + i * 0.2, p.z);
  for (let z = -4.5; z <= 4.5; z += 0.2) k.box('plain', '#2a2a2a', 0.01, 0.8, 0.01, p.x, y0 + 2.0, p.z + z);
  k.sphere('glossy', '#f4e9c8', 0.12, p.x + 3, y0 + 0.12, p.z + 1.5, 1, 1, 1, 12);
}

// ---------------------------------------------------------------------------
// Bogenschießplatz: Zielscheiben auf Strohballen, Bank mit Bögen an der Schusslinie
function buildArchery(k, colliders) {
  const a = LAYOUT.archery;
  for (let i = 0; i < 5; i++) {
    const x = a.x + 6.5;
    const z = a.z - 6 + i * 3;
    const y = heightAt(x, z);
    k.at(x, y, z, -Math.PI / 2, () => {
      for (const s of [-1, 1]) k.limb('wood', '#6a4a30', v(s * 0.55, 0, -0.4), v(s * 0.4, 1.7, 0.05), 0.05);
      k.cyl('plain', '#d9b867', 0.62, 0.62, 0.25, 0, 1.2, 0.08, 20, Math.PI / 2 - 0.15);
      const rings = ['#f4f1e8', '#1f1f1f', '#2d6fc2', '#d32f2f', '#f2c230'];
      rings.forEach((c, j) => k.cyl('plain', c, 0.55 - j * 0.11, 0.55 - j * 0.11, 0.02, 0, 1.2 + j * 0.002, 0.22 + j * 0.004, 20, Math.PI / 2 - 0.15));
      // ein paar Pfeile stecken schon
      for (let p = 0; p < 2 + (i % 2); p++) {
        const ox = (rng('arrow' + i + p)() - 0.5) * 0.4;
        k.limb('plain', '#c9b28a', v(ox, 1.2 + p * 0.08, 0.2), v(ox + 0.05, 1.22 + p * 0.08, 0.85), 0.008, 3);
        k.cone('plain', '#c23b2b', 0.03, 0.08, ox + 0.05, 1.22 + p * 0.08, 0.85, 4, Math.PI / 2);
      }
    });
    colliders.addCircle(x, z, 0.8);
  }
  // Schusslinie
  const lx = a.x - 3;
  k.box('plain', '#ffffff', 0.08, 0.02, 14, lx, heightAt(lx, a.z) + 0.01, a.z);
  const by = heightAt(lx - 1.5, a.z);
  k.at(lx - 1.5, by, a.z, Math.PI / 2, () => {
    k.box('wood', '#7a5a3c', 3, 0.08, 0.5, 0, 0.5, 0);
    for (const s of [-1, 1]) k.box('wood', '#5a4030', 0.1, 0.5, 0.45, s * 1.3, 0.25, 0);
    for (let i = 0; i < 3; i++) {
      k.add(new THREE.TorusGeometry(0.6, 0.02, 5, 16, Math.PI * 0.9), 'wood', '#5a3a22', mat4(-0.8 + i * 0.8, 0.58, 0, Math.PI / 2, 0, 0));
    }
    k.cyl('wood', '#6a4326', 0.1, 0.09, 0.6, 1.3, 0.85, -0.1, 8, 0.2);
  });
  colliders.addBox(lx - 1.5, a.z, 0.4, 1.6);
}

// ---------------------------------------------------------------------------
// Ställe mit Koppel und einem Pegasus
function buildStables(k, colliders) {
  const s = LAYOUT.stables;
  const y0 = heightAt(s.x, s.z);
  const w = 9;
  const d = 6;
  k.at(s.x, y0, s.z, 0, () => {
    k.box('stone', '#7d776d', w + 0.2, 0.3, d + 0.2, 0, 0.15, 0);
    k.box('wood', '#9b5a3a', w, 3.4, d, 0, 0.3 + 1.7, 0);
    k.gable('roof', '#5f646a', w, d, 2.2, 0, 3.7, 0, 0.5, 0.15);
    for (const z of [-1, 1]) k.gableWall('wood', '#9b5a3a', w, 2.2, 0, 3.7, z * (d / 2 - 0.1), 0, 0.2);
    // großes Tor mit weißem Kreuz
    k.box('wood', '#7a4028', 2.6, 2.8, 0.08, 0, 0.3 + 1.4, d / 2 + 0.04);
    k.limb('plain', WHITE, v(-1.25, 0.4, d / 2 + 0.1), v(1.25, 3.0, d / 2 + 0.1), 0.06, 4);
    k.limb('plain', WHITE, v(1.25, 0.4, d / 2 + 0.1), v(-1.25, 3.0, d / 2 + 0.1), 0.06, 4);
    k.box('plain', WHITE, 2.8, 0.12, 0.12, 0, 3.15, d / 2 + 0.08);
    for (const x of [-3, 3]) window2(k, x, 2.4, d / 2 + 0.03, 0, 0.8, 0.8, null);
    // Heuballen
    for (const [x, z] of [[-3.8, 3.8], [-3, 4.1], [-3.4, 3.9]]) k.box('plain', '#d9be6a', 0.9, 0.5, 0.6, x, 0.25 + (x === -3.4 ? 0.5 : 0), z);
  });
  colliders.addBox(s.x, s.z, w / 2 + 0.3, d / 2 + 0.3);
  colliders.addBox(s.x - 3.4, s.z + 3.9, 1.0, 0.5);
  // Koppel
  const px = s.x;
  const pz = s.z + 11;
  const fw = 10;
  const fd = 7;
  const corners = [[px - fw / 2, pz - fd / 2], [px + fw / 2, pz - fd / 2], [px + fw / 2, pz + fd / 2], [px - fw / 2, pz + fd / 2], [px - fw / 2, pz - fd / 2]];
  for (let i = 0; i < 4; i++) {
    const [x0, z0] = corners[i];
    const [x1, z1] = corners[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.round(len / 2);
    for (let j = 0; j <= n; j++) {
      const x = x0 + ((x1 - x0) * j) / n;
      const z = z0 + ((z1 - z0) * j) / n;
      k.box('wood', '#e9e4d8', 0.12, 1.3, 0.12, x, heightAt(x, z) + 0.65, z);
    }
    for (const hgt of [0.6, 1.15]) {
      const mx = (x0 + x1) / 2;
      const mz = (z0 + z1) / 2;
      k.at(mx, heightAt(mx, mz) + hgt, mz, Math.atan2(x1 - x0, z1 - z0), () => k.box('wood', '#e9e4d8', 0.06, 0.12, len, 0, 0, 0));
    }
    colliders.addSegment(x0, z0, x1, z1, 0.15);
  }
  // Pegasus: weißes Pferd mit Flügeln
  const hx = px + 1;
  const hz = pz;
  const hy = heightAt(hx, hz);
  k.at(hx, hy, hz, 0.6, () => {
    const W = '#f3efe7';
    k.add(new THREE.CapsuleGeometry(0.33, 0.9, 6, 14), 'plain', W, mat4(0, 1.2, 0, Math.PI / 2, 0, 0, 0.85, 1, 1));
    for (const [x, z] of [[-0.17, 0.5], [0.17, 0.5], [-0.17, -0.55], [0.17, -0.55]]) {
      k.limb('plain', W, v(x, 1.1, z), v(x, 0.55, z + 0.03), 0.09, 8);
      k.limb('plain', W, v(x, 0.55, z + 0.03), v(x, 0.1, z), 0.05, 8);
      k.cyl('plain', '#7a746c', 0.06, 0.07, 0.1, x, 0.05, z + 0.01, 8);
    }
    k.limb('plain', W, v(0, 1.35, 0.55), v(0, 1.95, 0.85), 0.17, 10);
    k.add(new THREE.CapsuleGeometry(0.13, 0.45, 4, 10), 'plain', W, mat4(0, 1.95, 1.05, Math.PI / 2 + 0.6, 0, 0));
    for (const sx of [-1, 1]) {
      k.cone('plain', W, 0.04, 0.14, sx * 0.08, 2.18, 0.9, 5);
      k.sphere('plain', '#1a1a1a', 0.025, sx * 0.11, 2.0, 1.1, 1, 1, 1, 5);
    }
    for (let i = 0; i < 8; i++) k.sphere('plain', '#e6e0d4', 0.06, 0, 1.45 + i * 0.07, 0.48 + i * 0.05, 0.6, 1.2, 1, 5);
    k.limb('plain', '#e6e0d4', v(0, 1.25, -0.75), v(0, 0.6, -1.0), 0.06, 6);
    // Flügel aus Federreihen
    for (const sx of [-1, 1]) {
      for (let r = 0; r < 3; r++) {
        for (let f = 0; f < 7; f++) {
          const len = 0.9 - r * 0.2 + f * 0.05;
          k.box('plain', r === 0 ? '#ffffff' : '#f2f0ea', len, 0.03, 0.18, sx * (0.3 + len / 2 + r * 0.05), 1.45 + f * 0.09 - r * 0.05, 0.25 - f * 0.12, 0, 0, sx * (0.5 + f * 0.04));
        }
      }
    }
  });
  colliders.addCircle(hx, hz, 1.2);
}

// ---------------------------------------------------------------------------
// Kanusee: Steg und Kanus
function canoe(k, color, x, y, z, ry, flipped = false) {
  const geo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  k.add(geo, 'glossy', color, mat4(x, y, z, flipped ? Math.PI : 0, ry, 0, 0.42, 0.32, 2.1));
  if (!flipped) {
    k.add(new THREE.TorusGeometry(1, 0.03, 4, 24), 'wood', '#6a4a30', mat4(x, y, z, Math.PI / 2, ry, 0, 0.42, 2.1, 1));
    k.at(x, y, z, ry, () => {
      for (const t of [-0.8, 0, 0.8]) k.box('wood', '#8a6a48', 0.78, 0.04, 0.12, 0, -0.06, t);
    });
  }
}

function buildDock(k, colliders) {
  const L = LAYOUT.lake;
  const dy = L.level + 0.45;
  const x0 = L.x + L.rx - 0.8;
  const x1 = x0 - 6.5;
  const z = L.z;
  k.box('wood', '#9a7f60', x0 - x1 + 1.5, 0.12, 2.2, (x0 + x1) / 2 + 0.75, dy, z);
  for (let x = x1; x <= x0 + 1; x += 1.6) for (const s of [-1, 1]) k.cyl('wood', '#6a5040', 0.1, 0.1, 2.2, x, dy - 1.0, z + s * 1.0, 8);
  for (let x = x1; x <= x0 + 1.5; x += 0.3) k.box('wood', '#8a6f52', 0.02, 0.13, 2.2, x, dy + 0.005, z);
  addPlatform(x1 - 0.2, x0 + 1.6, z - 1.1, z + 1.1, dy + 0.06);
  canoe(k, '#c0392b', x1 + 2, L.level + 0.22, z - 2.1, Math.PI / 2 + 0.1);
  canoe(k, '#2e7d4f', x1 + 1.5, L.level + 0.22, z + 2.2, Math.PI / 2 - 0.15);
  canoe(k, '#d9a12b', x1 - 3, L.level + 0.22, z - 4, 0.5);
  // zwei Kanus kopfüber am Ufer
  const sx = L.x + L.rx + 2.2;
  canoe(k, '#2c5f9a', sx, heightAt(sx, z - 4) + 0.3, z - 4, 0.1, true);
  canoe(k, '#c0392b', sx + 1.1, heightAt(sx + 1.1, z - 4.2) + 0.3, z - 4.2, 0.05, true);
  colliders.addBox(sx + 0.55, z - 4.1, 1.1, 2.2);
  // Paddel
  for (let i = 0; i < 3; i++) {
    const px = sx + 2.4;
    const pz = z - 5 + i * 0.5;
    k.limb('wood', '#a07a50', v(px, heightAt(px, pz) + 0.05, pz), v(px + 0.2, heightAt(px, pz) + 1.4, pz - 0.2), 0.025, 5);
    k.box('wood', '#a07a50', 0.16, 0.45, 0.03, px, heightAt(px, pz) + 0.25, pz);
  }
}

// ---------------------------------------------------------------------------
// Lagerfeuer in der Mitte der Hüttenwiese
function buildCampfire(k, colliders, fires) {
  const c = LAYOUT.campfire;
  const y0 = heightAt(c.x, c.z);
  const r = rng('fire');
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2;
    k.add(new THREE.DodecahedronGeometry(0.28 + r() * 0.08, 0), 'stone', '#7a756d', mat4(c.x + Math.cos(t) * 1.35, y0 + 0.15, c.z + Math.sin(t) * 1.35, r() * 3, r() * 3, 0, 1, 0.7, 1));
  }
  k.cyl('plain', '#26201b', 1.15, 1.15, 0.05, c.x, y0 + 0.03, c.z, 20);
  for (let i = 0; i < 7; i++) {
    const t = (i / 7) * Math.PI * 2;
    k.limb('bark', '#4a3626', v(c.x + Math.cos(t) * 0.75, y0 + 0.05, c.z + Math.sin(t) * 0.75), v(c.x + Math.cos(t) * 0.08, y0 + 1.0, c.z + Math.sin(t) * 0.08), 0.08, 6);
  }
  // Glut
  for (let i = 0; i < 18; i++) {
    const a = r() * Math.PI * 2;
    const d = r() * 0.7;
    k.sphere('glow', i % 3 ? '#ff5a1a' : '#ffb03a', 0.05 + r() * 0.05, c.x + Math.cos(a) * d, y0 + 0.07, c.z + Math.sin(a) * d, 1, 0.5, 1, 6);
  }
  fires.push({ x: c.x, y: y0 + 0.35, z: c.z, scale: 1.5, light: true, color: '#ff8a3a', intensity: 9, distance: 7, embers: true });
  colliders.addCircle(c.x, c.z, 1.6);
  // Baumstämme zum Sitzen
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2 + 0.3;
    const x = c.x + Math.cos(t) * 3.2;
    const z = c.z + Math.sin(t) * 3.2;
    // quer zum Feuer liegend (tangential)
    const ry = -t - Math.PI / 2;
    k.add(new THREE.CylinderGeometry(0.25, 0.25, 1.8, 10), 'bark', '#6a5040', mat4(x, y0 + 0.25, z, 0, ry, Math.PI / 2));
    colliders.addBox(x, z, 0.9, 0.3, ry);
  }
}

// ---------------------------------------------------------------------------
export function buildCamp(colliders) {
  const k = new Kit();
  const fires = [];
  buildBigHouse(k, colliders);
  buildPavilion(k, colliders, fires);
  buildArena(k, colliders);
  buildAmphitheater(k, colliders);
  buildVolleyball(k, colliders);
  buildArchery(k, colliders);
  buildStables(k, colliders);
  buildDock(k, colliders);
  buildCampfire(k, colliders, fires);
  return { group: k.build(), fires };
}
