import * as THREE from 'three';
import { Kit, mat4, materials, canvasTexture, rng } from './kit.js';
import { LAYOUT, heightAt, inFrontOf, addPlatform } from './terrain.js';

// Die zwölf Hütten. Jede Hütte wird in eigenen Koordinaten gebaut:
// Tür vorne (+z), Mitte bei (0,0,0). Danach wird sie an ihren Platz gedreht.
// Aussehen nach den Beschreibungen im Buch, dazu passende Details.

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const TRIM = '#f3efe6';
const GLASS = '#2c3642';

function numbersMaterial() {
  const m = materials();
  m.numbers ??= new THREE.MeshStandardMaterial({
    map: canvasTexture(
      512,
      384,
      (g) => {
        g.clearRect(0, 0, 512, 384);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = 'bold 96px Georgia, serif';
        for (let n = 1; n <= 12; n++) {
          const col = (n - 1) % 4;
          const row = Math.floor((n - 1) / 4);
          const x = col * 128 + 64;
          const y = row * 128 + 68;
          g.lineWidth = 8;
          g.strokeStyle = '#4a3212';
          g.strokeText(String(n), x, y);
          g.fillStyle = '#e0b04c';
          g.fillText(String(n), x, y);
        }
      },
      { repeat: false },
    ),
    transparent: true,
    alphaTest: 0.35,
    metalness: 0.6,
    roughness: 0.35,
  });
}

// Hilfen für Wandflächen: face = 'front' | 'back' | 'left' | 'right'
function onFace(k, o, face, u, y, fn, out = 0.02) {
  const { w, d } = o;
  const p = {
    front: [u, d / 2 + out, 0],
    back: [-u, -d / 2 - out, Math.PI],
    left: [-w / 2 - out, -u, -Math.PI / 2],
    right: [w / 2 + out, u, Math.PI / 2],
  }[face];
  if (face === 'front' || face === 'back') k.at(p[0], y, p[1], p[2], fn);
  else k.at(p[0], y, p[1], p[2], fn);
}

function windowAt(k, o, face, u, y, { w = 0.85, h = 1.0, frame = TRIM, glass = GLASS, curtains = null, frameBucket = 'plain', box = null, shutters = null } = {}) {
  onFace(k, o, face, u, y, () => {
    // Glas leicht nach innen versetzt, damit die Fensterlaibung Tiefe bekommt
    k.box('glass', glass, w, h, 0.04, 0, 0, -0.04);
    k.box('plain', '#1c1f24', w + 0.04, h + 0.04, 0.02, 0, 0, -0.08);
    if (curtains) {
      k.box('plain', curtains, w * 0.28, h * 0.92, 0.02, -w * 0.33, 0, -0.01);
      k.box('plain', curtains, w * 0.28, h * 0.92, 0.02, w * 0.33, 0, -0.01);
    }
    const t = 0.07;
    // Fensterflügel-Rahmen mit Sprossenkreuz
    k.box(frameBucket, frame, w + t * 2, t, 0.08, 0, h / 2 + t / 2, 0);
    k.box(frameBucket, frame, t, h, 0.08, -w / 2 - t / 2, 0, 0);
    k.box(frameBucket, frame, t, h, 0.08, w / 2 + t / 2, 0, 0);
    k.box(frameBucket, frame, t * 0.55, h, 0.05, 0, 0, -0.01);
    k.box(frameBucket, frame, w, t * 0.55, 0.05, 0, 0, -0.01);
    // Verkleidung außen: breite Bretter, Sturz oben, Fensterbank unten
    const c = 0.12;
    k.box(frameBucket, frame, c, h + 0.2, 0.05, -w / 2 - t - c / 2, 0, 0.02);
    k.box(frameBucket, frame, c, h + 0.2, 0.05, w / 2 + t + c / 2, 0, 0.02);
    k.box(frameBucket, frame, w + t * 2 + c * 2 + 0.12, 0.16, 0.08, 0, h / 2 + t + 0.08, 0.03);
    k.box(frameBucket, frame, w + t * 2 + c * 2 + 0.1, 0.06, 0.2, 0, -h / 2 - 0.06, 0.07);
    if (shutters) for (const s of [-1, 1]) k.box('wood', shutters, w * 0.48, h + 0.1, 0.04, s * (w / 2 + t + c + w * 0.26), 0, 0.03);
    if (box) box(w);
  });
}

function door(k, o, { color = '#5a3b26', bucket = 'wood', w = 1.1, h = 2.15, frame = TRIM, frameBucket = 'plain', lamp = true } = {}) {
  const y = o.floor + h / 2;
  const z = o.d / 2;
  k.box(bucket, color, w, h, 0.08, 0, y, z + 0.02);
  // Kassetten (vier erhabene Felder)
  const panel = new THREE.Color(color).multiplyScalar(1.12).getStyle();
  for (const px of [-1, 1]) for (const py of [0.27, 0.7]) k.box(bucket, panel, w * 0.32, h * (py < 0.5 ? 0.36 : 0.3), 0.03, px * w * 0.2, o.floor + h * py, z + 0.07);
  // Türrahmen und Verkleidung
  k.box(frameBucket, frame, w + 0.36, 0.18, 0.12, 0, o.floor + h + 0.09, z + 0.05);
  k.box(frameBucket, frame, 0.15, h, 0.12, -w / 2 - 0.075, y, z + 0.05);
  k.box(frameBucket, frame, 0.15, h, 0.12, w / 2 + 0.075, y, z + 0.05);
  k.box('wood', '#6e5a46', w + 0.2, 0.05, 0.3, 0, o.floor + 0.02, z + 0.12); // Schwelle
  k.sphere('bronze', '#c9953f', 0.045, w * 0.36, o.floor + 1.05, z + 0.12);
  if (lamp) {
    // Wandlampe neben der Tür
    const lx = -(w / 2 + 0.28); // links neben der Tür (der Griff ist rechts)
    k.box('metal', '#2b2d30', 0.06, 0.06, 0.18, lx, o.floor + 2.0, z + 0.09);
    k.box('metal', '#2b2d30', 0.2, 0.04, 0.2, lx, o.floor + 2.1, z + 0.2);
    k.box('glow', '#ffe0a8', 0.15, 0.2, 0.15, lx, o.floor + 1.98, z + 0.2);
    k.box('metal', '#2b2d30', 0.2, 0.03, 0.2, lx, o.floor + 1.86, z + 0.2);
  }
}

// Messingnummer über der Tür
function numberPlate(k, o, nr, y) {
  numbersMaterial();
  const geo = new THREE.PlaneGeometry(0.5, 0.5);
  const col = (nr - 1) % 4;
  const row = Math.floor((nr - 1) / 4);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (col + uv.getX(i)) / 4, 1 - (row + 1) / 3 + uv.getY(i) / 3);
  k.add(geo, 'numbers', '#ffffff', mat4(0, y, o.d / 2 + 0.1), { keepUV: true });
}

// Eingang: Holzveranda mit Geländer (Standard) oder Steinstufen. Gibt zurück, wie weit er vorsteht.
function entry(k, o, { bucket = 'wood', color = '#9a7f62', width = 1.8, deck = bucket === 'wood' } = {}) {
  const z0 = o.d / 2;
  if (!deck) {
    const n = Math.max(1, Math.round(o.floor / 0.2));
    const sh = o.floor / n;
    for (let i = 0; i < n; i++) {
      const depth = (n - i) * 0.35;
      k.box(bucket, color, width, sh, depth, 0, sh * (i + 0.5), z0 + depth / 2);
    }
    return n * 0.35;
  }
  const dw = 2.8;
  const dd = 1.3;
  const f = o.floor;
  // Plattform auf Pfosten
  k.box('wood', color, dw, 0.08, dd, 0, f - 0.04, z0 + dd / 2);
  for (let i = 0; i < 9; i++) k.box('wood', new THREE.Color(color).multiplyScalar(0.85 + (i % 2) * 0.15).getStyle(), dw, 0.085, 0.02, 0, f - 0.035, z0 + 0.07 + i * 0.145);
  k.box('wood', '#5a4634', dw, f - 0.08, 0.06, 0, (f - 0.08) / 2, z0 + dd - 0.03);
  for (const s of [-1, 1]) {
    k.box('wood', '#5a4634', 0.06, f - 0.08, dd, s * (dw / 2 - 0.03), (f - 0.08) / 2, z0 + dd / 2);
    // Geländer an den Seiten und vorne neben der Treppe
    const px = s * (dw / 2 - 0.05);
    k.box('wood', '#7a644c', 0.08, 0.95, 0.08, px, f + 0.47, z0 + dd - 0.05);
    k.box('wood', '#7a644c', 0.06, 0.06, dd, px, f + 0.92, z0 + dd / 2);
    for (let t = 0.2; t < dd - 0.1; t += 0.22) k.box('wood', '#7a644c', 0.035, 0.85, 0.035, px, f + 0.45, z0 + t);
    k.box('wood', '#7a644c', dw / 2 - 0.75, 0.06, 0.06, s * (0.75 + (dw / 2 - 0.75) / 2), f + 0.92, z0 + dd - 0.05);
    for (let t = 0.85; t < dw / 2 - 0.1; t += 0.22) k.box('wood', '#7a644c', 0.035, 0.85, 0.035, s * t, f + 0.45, z0 + dd - 0.05);
  }
  // Fußmatte und Bank
  k.box('plain', '#5a4a3a', 0.9, 0.02, 0.55, 0, f + 0.01, z0 + 0.4);
  if (o.bench !== false) {
    const bx = -dw / 2 + 0.35;
    k.box('wood', '#8a6a4a', 0.42, 0.06, 0.95, bx, f + 0.45, z0 + 0.62);
    k.box('wood', '#8a6a4a', 0.06, 0.45, 0.95, bx - 0.19, f + 0.72, z0 + 0.62);
    for (const zz of [0.22, 1.02]) k.box('wood', '#6a5040', 0.36, 0.45, 0.06, bx, f + 0.22, z0 + zz);
  }
  // zwei Holzstufen
  const n = 2;
  for (let i = 0; i < n; i++) {
    const sh = f / (n + 1);
    k.box('wood', color, 1.4, 0.06, 0.3, 0, sh * (i + 1) - 0.03, z0 + dd + 0.3 * (n - i) - 0.15);
    k.box('wood', '#5a4634', 1.4, sh * (i + 1) - 0.06, 0.04, 0, (sh * (i + 1) - 0.06) / 2, z0 + dd + 0.3 * (n - i) - 0.02);
  }
  for (const s of [-1, 1]) k.box('wood', '#5a4634', 0.06, f, 0.65, s * 0.72, f / 2 - 0.05, z0 + dd + 0.3);
  return dd + 0.6;
}

// Regenrinnen an beiden Traufen und Fallrohre an den vorderen Ecken
function gutters(k, o, eaveY, overhang) {
  const { w, d } = o;
  for (const s of [-1, 1]) {
    k.cyl('metal', '#8d9296', 0.06, 0.06, d + overhang * 2, s * (w / 2 + overhang + 0.03), eaveY - 0.08, 0, 8, Math.PI / 2);
    k.cyl('metal', '#8d9296', 0.04, 0.04, eaveY - 0.1, s * (w / 2 + 0.12), (eaveY - 0.1) / 2, d / 2 - 0.25, 6);
    k.limb('metal', '#8d9296', v(s * (w / 2 + 0.12), eaveY - 0.1, d / 2 - 0.25), v(s * (w / 2 + overhang), eaveY - 0.08, d / 2 - 0.25), 0.04, 6);
  }
}

// Standard-Holzhütte mit Satteldach
function shell(k, o) {
  const { w, d, h, floor } = o;
  if (o.piers === false) {
    // durchgehender Sockel (Steinhütte, Goldhütte)
    k.box(o.baseBucket ?? 'stone', o.baseColor ?? '#d6cfc2', w + 0.25, floor, d + 0.25, 0, floor / 2, 0);
  } else {
    // wie bei echten Camp-Hütten: Hütte steht auf Steinpfeilern, darunter ein dunkler Spalt
    k.box('plain', '#24211e', w - 0.2, floor, d - 0.2, 0, floor / 2, 0);
    const nx = Math.max(2, Math.round(w / 1.6));
    const nz = Math.max(2, Math.round(d / 1.7));
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= nz; j++) {
        if (i !== 0 && i !== nx && j !== 0 && j !== nz) continue;
        k.box(o.baseBucket ?? 'stone', o.baseColor ?? '#d6cfc2', 0.42, floor, 0.42, -w / 2 + 0.15 + (i * (w - 0.3)) / nx, floor / 2, -d / 2 + 0.15 + (j * (d - 0.3)) / nz);
      }
    }
    k.box('wood', '#6a5644', w + 0.12, 0.14, d + 0.12, 0, floor - 0.07, 0); // Schwelle / Rahmen
  }
  k.wall(o.wall, o.wallColor, w, h, d, 0, floor + h / 2, 0);
  const trimB = o.trimBucket ?? 'plain';
  const trimC = o.trim ?? TRIM;
  // Eckbretter und Sockelbrett
  if (o.corners !== false) {
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(trimB, trimC, 0.16, h, 0.16, (x * w) / 2, floor + h / 2, (z * d) / 2);
    k.box(trimB, trimC, w + 0.08, 0.2, d + 0.08, 0, floor + 0.1, 0);
  }
  const rh = o.roofH ?? 1.7;
  const over = o.overhang ?? 0.45;
  if (o.roof !== 'none') {
    k.gableWall(o.gableBucket ?? o.wall, o.gableColor ?? o.wallColor, w, rh, 0, floor + h, d / 2 - 0.1, 0, 0.2);
    k.gableWall(o.gableBucket ?? o.wall, o.gableColor ?? o.wallColor, w, rh, 0, floor + h, -d / 2 + 0.1, 0, 0.2);
    k.gable(o.roofBucket ?? 'roof', o.roofColor ?? '#8a8580', w, d, rh, 0, floor + h, 0, over, o.roofThick ?? 0.14, o.fascia === false ? null : o.fascia ?? trimC, trimB);
    if (o.gutters !== false) gutters(k, o, floor + h, over);
    if (o.stovepipe) {
      const sx = w * 0.24;
      const y = floor + h + rh * (1 - (sx + 0.1) / (w / 2 + over)) - 0.15;
      k.cyl('metal', '#2e3033', 0.11, 0.11, 1.4, sx, y + 0.7, -d * 0.25, 10);
      k.cone('metal', '#2e3033', 0.22, 0.18, sx, y + 1.5, -d * 0.25, 10);
    }
  }
  o.frontExtra = o.steps === false ? 0 : entry(k, o, o.stepStyle);
  door(k, o, o.door ?? {});
  numberPlate(k, o, o.nr, floor + 2.55);
  for (const side of ['left', 'right']) {
    for (const u of [-d * 0.22, d * 0.22]) windowAt(k, o, side, u, floor + 1.55, o.win ?? {});
  }
  windowAt(k, o, 'front', -w * 0.31, floor + 1.55, { ...(o.win ?? {}), w: 0.7 });
  windowAt(k, o, 'front', w * 0.31, floor + 1.55, { ...(o.win ?? {}), w: 0.7 });
  windowAt(k, o, 'back', 0, floor + 1.55, o.win ?? {});
}

// Griechischer Tempel (Zeus, Hera)
function temple(k, o) {
  const { w, d, h } = o;
  const podium = 0.9;
  const portico = 2.4;
  const cellaD = d - portico;
  k.box('marble', '#e4dfd4', w + 1.4, 1.2, d + 1.4, 0, -0.6, 0); // Fundament (am Strand fällt der Boden leicht ab)
  for (let i = 0; i < 3; i++) {
    const inset = i * 0.35;
    k.box('marble', '#f1eee6', w + 1.4 - inset * 2, 0.3, d + 1.4 - inset * 2, 0, 0.15 + i * 0.3, 0);
  }
  const top = podium;
  const cz = -d / 2 + cellaD / 2;
  k.box('marble', '#f4f1ea', w - 2.2, h, cellaD, 0, top + h / 2, cz);
  // Säulen
  const colZ = d / 2 - 0.5;
  const n = o.columns ?? 6;
  const colR = o.colR ?? 0.3;
  const colXs = [];
  for (let i = 0; i < n; i++) colXs.push(-w / 2 + 0.45 + (i * (w - 0.9)) / (n - 1));
  const sideZs = [colZ - 1.9, colZ - 3.8, colZ - 5.7].filter((z) => z > -d / 2 + 0.3);
  const cols = [...colXs.map((x) => [x, colZ]), ...sideZs.flatMap((z) => [[-w / 2 + 0.45, z], [w / 2 - 0.45, z]])];
  for (const [x, z] of cols) {
    k.box('marble', '#ece8df', colR * 2.7, 0.22, colR * 2.7, x, top + 0.11, z);
    k.cyl('marble', '#f6f3ec', colR * 0.88, colR, h - 0.5, x, top + 0.22 + (h - 0.5) / 2, z, 16);
    // Kanneluren andeuten
    for (let f = 0; f < 8; f++) {
      const a = (f / 8) * Math.PI * 2;
      k.box('marble', '#e2ddd2', 0.03, h - 0.7, 0.03, x + Math.cos(a) * colR * 0.95, top + 0.22 + (h - 0.5) / 2, z + Math.sin(a) * colR * 0.95);
    }
    k.cyl('marble', '#ece8df', colR * 1.35, colR * 0.9, 0.18, x, top + h - 0.19, z, 16);
    k.box('marble', '#ece8df', colR * 2.8, 0.14, colR * 2.8, x, top + h - 0.05, z);
  }
  // Gebälk, Giebel, Dach
  k.box('marble', '#ebe7de', w + 0.3, 0.75, d + 0.2, 0, top + h + 0.37, 0);
  k.box('marble', '#ddd8cc', w + 0.45, 0.14, d + 0.35, 0, top + h + 0.78, 0);
  const rh = 1.5;
  k.gableWall('marble', '#f1eee6', w + 0.3, rh, 0, top + h + 0.85, d / 2 + 0.05, 0, 0.3);
  k.gableWall('marble', '#f1eee6', w + 0.3, rh, 0, top + h + 0.85, -d / 2 - 0.05, 0, 0.3);
  k.gable('marble', o.roofColor ?? '#d9d3c7', w + 0.3, d + 0.2, rh, 0, top + h + 0.85, 0, 0.25, 0.16);
  // Tür in der Cella
  const doorZ = cz + cellaD / 2 + 0.05;
  const dw = 2.2;
  const dh = 3.5;
  k.box(o.doorBucket ?? 'bronze', o.doorColor ?? '#c7923e', dw, dh, 0.12, 0, top + dh / 2, doorZ);
  k.box('marble', '#e6e1d6', dw + 0.5, 0.35, 0.3, 0, top + dh + 0.18, doorZ);
  numbersMaterial();
  numberPlate(k, { d: (doorZ + 0.05) * 2 }, o.nr, top + dh + 0.65);
  return { top, doorZ, dw, dh, colXs, colZ };
}

// Blitz als flache Zickzack-Form
function boltShape(s = 1) {
  const sh = new THREE.Shape();
  const pts = [[0.1, 1], [-0.25, 0.1], [0.02, 0.12], [-0.2, -1], [0.3, 0.05], [0.04, 0.04], [0.35, 1]];
  sh.moveTo(pts[0][0] * s, pts[0][1] * s);
  for (const [x, y] of pts.slice(1)) sh.lineTo(x * s, y * s);
  sh.closePath();
  return sh;
}
function bolt(k, bucket, color, s, x, y, z, rz = 0, depth = 0.04) {
  const geo = new THREE.ExtrudeGeometry(boltShape(s), { depth, bevelEnabled: false });
  k.add(geo, bucket, color, mat4(x, y, z, 0, 0, rz));
}

// Ranken (Tomaten, Wein, Rosen) an einer Wand hochwachsen lassen
function vine(k, rand, from, height, { leaf = '#3f7a2e', stem = '#4d6b2a', fruit = null, fruitR = 0.05, cluster = 1, dir = v(0, 0, 1), spread = 0.35 } = {}) {
  const pts = [];
  const n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(v(from.x + Math.sin(t * 6 + rand() * 3) * spread * (dir.z !== 0 ? 1 : 0), from.y + t * height, from.z + Math.sin(t * 6 + rand() * 3) * spread * (dir.x !== 0 ? 1 : 0)));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  k.add(new THREE.TubeGeometry(curve, 16, 0.025, 4, false), 'plain', stem);
  for (let i = 0; i < 14; i++) {
    const p = curve.getPoint(rand());
    k.sphere('leaf', i % 3 ? leaf : new THREE.Color(leaf).offsetHSL(0, 0, 0.08).getStyle(), 0.1, p.x + dir.x * 0.05 + (rand() - 0.5) * 0.15, p.y, p.z + dir.z * 0.05 + (rand() - 0.5) * 0.15, dir.x ? 0.35 : 1, 0.75, dir.z ? 0.35 : 1, 6);
  }
  if (fruit) {
    for (let i = 0; i < 6; i++) {
      const p = curve.getPoint(0.1 + rand() * 0.85);
      for (let c = 0; c < cluster; c++) {
        const cy = cluster > 1 ? -c * fruitR * 0.9 : 0;
        const cx = cluster > 1 ? (rand() - 0.5) * fruitR * (cluster - c) * 0.5 : 0;
        k.sphere('glossy', fruit, fruitR, p.x + dir.x * 0.12 + cx, p.y + cy - 0.05, p.z + dir.z * 0.12 + cx, 1, 1, 1, 7);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Hütte 3 – Poseidon (Percys Hütte), begehbar.
// Nach dem Buch: niedrig, lang und massiv; raue graue Steinwände mit Muschelstücken und Korallen,
// als wären die Steinplatten direkt vom Meeresboden gehauen. Innen: sechs leere Betten mit
// aufgeschlagener Seidenbettwäsche, die Wände schimmern wie Perlmutt.

const STONE_GRAYS = ['#e9eff1', '#d5dde0', '#f3f5f3', '#c2ccd0', '#e3e7e4', '#b8c3c7', '#d3dedb', '#cad6d4'];

// Bricht einen Bereich [a, b] an den Kanten der Öffnungen und in zufällige Stücke
function courseBreaks(height, openings, rand) {
  const forced = new Set([0, height]);
  for (const o of openings) {
    if (o.y0 > 0.01) forced.add(o.y0);
    if (o.y1 < height - 0.01) forced.add(o.y1);
  }
  const fixed = [...forced].sort((a, b) => a - b);
  const out = [0];
  for (let i = 0; i < fixed.length - 1; i++) {
    let y = fixed[i];
    const end = fixed[i + 1];
    while (end - y > 0.75) {
      y += 0.38 + rand() * 0.22;
      if (end - y < 0.3) break;
      out.push(y);
    }
    out.push(end);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

// Steinplatten-Wand in eigenen Koordinaten: u entlang der Wand, y nach oben, außen = +z
function slabWall(k, rand, len, height, thick, openings) {
  const ys = courseBreaks(height, openings, rand);
  for (let c = 0; c < ys.length - 1; c++) {
    const y0 = ys[c];
    const y1 = ys[c + 1];
    const ym = (y0 + y1) / 2;
    // Stücke dieser Reihe, Öffnungen ausgespart
    let segs = [[-len / 2, len / 2]];
    for (const o of openings) {
      if (ym < o.y0 || ym > o.y1) continue;
      segs = segs.flatMap(([a, b]) => {
        if (o.u1 <= a || o.u0 >= b) return [[a, b]];
        const r = [];
        if (o.u0 > a) r.push([a, o.u0]);
        if (o.u1 < b) r.push([o.u1, b]);
        return r;
      });
    }
    const gap = 0.035; // Fuge zwischen den Platten
    const gy0 = y0 > 0.001 ? gap / 2 : 0;
    const gy1 = y1 < height - 0.001 ? gap / 2 : 0;
    for (const [a, b] of segs) {
      let u = a + (c % 2 ? -rand() * 0.3 : 0);
      u = Math.max(a, u);
      while (u < b - 0.01) {
        const l = Math.min(b - u, 0.5 + rand() * 0.7);
        const rest = b - (u + l);
        const L = rest < 0.25 ? b - u : l; // keine winzigen Reststücke
        const extra = rand() * 0.07;
        // Fugen nur zwischen zwei Platten, nicht an Ecken und Öffnungen
        const g0 = u > a + 0.001 ? gap / 2 : 0;
        const g1 = u + L < b - 0.001 ? gap / 2 : 0;
        const geo = k.box('seastone', STONE_GRAYS[Math.floor(rand() * STONE_GRAYS.length)], L - g0 - g1, y1 - y0 - gy0 - gy1, thick + extra, u + g0 + (L - g0 - g1) / 2, y0 + gy0 + (y1 - y0 - gy0 - gy1) / 2, extra / 2);
        // jede Platte bekommt einen eigenen Ausschnitt der Steintextur
        const uv = geo.attributes.uv;
        const ou = rand() * 5;
        const ov = rand() * 5;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + ou, uv.getY(i) + ov);
        u += L;
      }
    }
  }
}

// Innenverkleidung mit Löchern für Tür und Fenster
function lining(k, bucket, color, len, height, openings, z, depth = 0.03) {
  const us = new Set([-len / 2, len / 2]);
  for (const o of openings) {
    us.add(o.u0);
    us.add(o.u1);
  }
  const cols = [...us].sort((a, b) => a - b);
  for (let i = 0; i < cols.length - 1; i++) {
    const a = cols[i];
    const b = cols[i + 1];
    const m = (a + b) / 2;
    const o = openings.find((op) => m > op.u0 && m < op.u1);
    const parts = o ? [[0, o.y0], [o.y1, height]] : [[0, height]];
    for (const [y0, y1] of parts) if (y1 - y0 > 0.01) k.box(bucket, color, b - a, y1 - y0, depth, m, (y0 + y1) / 2, z);
  }
}

function scallop(k, color, x, y, z, s, rot) {
  const geo = new THREE.CircleGeometry(0.09 * s, 9, Math.PI * 0.1, Math.PI * 0.8);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getY(i)) / (0.09 * s);
    const ang = Math.atan2(p.getY(i), p.getX(i));
    p.setZ(i, (1 - r * r) * 0.025 * s + Math.abs(Math.sin(ang * 9)) * 0.006 * s); // Rippen
  }
  geo.computeVertexNormals();
  k.add(geo, 'glossy', color, mat4(x, y, z, 0, 0, rot));
}

function poseidonCabin(k, rand) {
  const w = 5.0;
  const d = 10.5;
  const F = 0.3; // Fußboden
  const H = 2.5; // niedrig
  const T = 0.45; // dicke, massive Steinwände
  const iw = w - 2 * T;
  const id = d - 2 * T;
  const openings = {
    front: [{ u0: -0.6, u1: 0.6, y0: 0, y1: 2.1 }],
    back: [],
    // Im Buch zeigen alle Fenster zum Meer. Die rechte Seite (+x der Hütte) liegt zum Strand hin.
    left: [],
    right: [3.6, 1.2, -1.2].map((u) => ({ u0: u - 0.45, u1: u + 0.45, y0: 1.1, y1: 1.8 })),
  };
  const walls = {
    front: { x: 0, z: d / 2 - T / 2, ry: 0, len: w },
    back: { x: 0, z: -d / 2 + T / 2, ry: Math.PI, len: w },
    left: { x: -w / 2 + T / 2, z: 0, ry: -Math.PI / 2, len: id },
    right: { x: w / 2 - T / 2, z: 0, ry: Math.PI / 2, len: id },
  };

  // Sockel und Fußboden
  k.box('seastone', '#c2cacd', w + 0.2, F, d + 0.2, 0, F / 2, 0);
  k.noAO(() => k.box('wood', '#f2e6cf', iw, 0.04, id, 0, F + 0.02, 0));
  // eine breite Steinstufe
  k.box('seastone', '#d6dde0', 1.8, F * 0.5, 0.45, 0, F * 0.25, d / 2 + 0.25);

  const shellCols = ['#f4e9dc', '#f0cfc4', '#fbf6ee', '#e9d6b4', '#f6dfe6'];
  const coralCols = ['#e86e55', '#f08f72', '#d9506a', '#f4a58f'];
  for (const [name, wl] of Object.entries(walls)) {
    const ops = openings[name];
    k.at(wl.x, F, wl.z, wl.ry, () => {
      slabWall(k, rand, wl.len, H, T, ops);
      // dunkler Mörtel hinter den Platten (sichtbar in den Fugen)
      lining(k, 'plain', '#3b4245', wl.len, H, ops, 0, T - 0.04);
      // Innen: schimmernd wie Perlmutt
      k.noAO(() => lining(k, 'abalone', '#ffffff', wl.len - 0.02, H - 0.02, ops, -T / 2 - 0.016));
      // Fenster: Glas mittig in der dicken Wand, schmaler Holzrahmen
      for (const o of ops) {
        if (o.y0 === 0) continue;
        const cu = (o.u0 + o.u1) / 2;
        const cy = (o.y0 + o.y1) / 2;
        const ow = o.u1 - o.u0;
        const oh = o.y1 - o.y0;
        k.box('glass', '#2c3a44', ow, oh, 0.03, cu, cy, 0);
        k.box('wood', '#6f7f7a', ow, 0.05, 0.08, cu, cy, 0.01);
        k.box('wood', '#6f7f7a', 0.05, oh, 0.08, cu, cy, 0.01);
        k.box('seastone', '#c7cdcc', ow + 0.12, 0.07, T + 0.12, cu, o.y0 - 0.035, 0.03); // Fensterbank aus Stein
      }
      // Muschelstücke und Korallen, in die Steine eingelassen
      const outZ = T / 2 + 0.04;
      const free = (u, y) => !ops.some((o) => u > o.u0 - 0.2 && u < o.u1 + 0.2 && y > o.y0 - 0.2 && y < o.y1 + 0.2);
      const n = Math.round(wl.len * 9);
      for (let i = 0; i < n; i++) {
        const u = (rand() - 0.5) * (wl.len - 0.3);
        const y = 0.12 + rand() * (H - 0.25);
        if (!free(u, y)) continue;
        const r = rand();
        if (r < 0.45) scallop(k, shellCols[i % 5], u, y, outZ, 1.0 + rand() * 0.9, rand() * Math.PI * 2);
        else if (r < 0.6) k.cone('glossy', shellCols[(i + 2) % 5], 0.035, 0.13, u, y, outZ, 7, 0, 0, rand() * 6); // Schneckenhaus
        else if (r < 0.72) k.sphere('glossy', '#1f2a3a', 0.05, u, y, outZ - 0.01, 1.7, 0.75, 0.4, 7); // Miesmuschel
        else if (r < 0.86) {
          // Korallenstück, flach in der Wand
          const col = coralCols[i % 4];
          const base = v(u, y, outZ);
          for (let b = 0; b < 3; b++) {
            const sp = (b - 1) * 0.6 + (rand() - 0.5) * 0.3; // Äste fächern nach oben auf
            const len = 0.09 + rand() * 0.06;
            const tip = v(u + Math.sin(sp) * len, y + Math.cos(sp) * len, outZ);
            k.limb('glossy', col, base, tip, 0.012, 4);
            k.sphere('glossy', col, 0.016, tip.x, tip.y, tip.z, 1, 1, 1, 5);
          }
        } else {
          for (let b = 0; b < 4; b++) k.cone('plain', '#e9e6dc', 0.02, 0.03, u + (b % 2) * 0.05, y + Math.floor(b / 2) * 0.05, outZ - 0.01, 6, Math.PI / 2, 0, 0); // Seepocken
        }
      }
    });
  }

  // Tür: schwere Holztür, offen nach innen geklappt
  k.box('wood', '#3f6b67', 0.07, 2.05, 1.12, -0.6 - 0.04, F + 1.03, d / 2 - T - 0.6);
  k.sphere('bronze', '#c9953f', 0.04, -0.52, F + 1.0, d / 2 - T - 1.05);
  // Messingnummer über der Tür
  numberPlate(k, { d: d + 0.02 }, 3, F + 2.28);
  // Dreizack als Steinrelief links neben der Tür (Infopunkt laut Projektauftrag)
  const tz = d / 2 + 0.07;
  const tx = -1.55;
  const rel = '#d5dbd9';
  k.box('seastone', rel, 0.07, 1.25, 0.06, tx, F + 1.05, tz);
  k.box('seastone', rel, 0.5, 0.07, 0.06, tx, F + 1.68, tz);
  for (const s of [-1, 0, 1]) {
    k.box('seastone', rel, 0.06, 0.32, 0.06, tx + s * 0.22, F + 1.86, tz);
    k.cone('seastone', rel, 0.055, 0.14, tx + s * 0.22, F + 2.08, tz, 4);
  }

  // Niedriges Dach aus Steinplatten, innen Holzbalken
  const roofH = 0.55;
  k.gableWall('seastone', '#dfe5e7', w, roofH, 0, F + H, d / 2 - T / 2, 0, T);
  k.gableWall('seastone', '#dfe5e7', w, roofH, 0, F + H, -d / 2 + T / 2, 0, T);
  k.gable('seastone', '#aeb7ba', w, d, roofH, 0, F + H, 0, 0.3, 0.24);
  k.box('wood', '#6e6152', iw, 0.06, id, 0, F + H - 0.03, 0);
  for (let z = -id / 2 + 0.6; z < id / 2; z += 1.2) k.box('wood', '#5a4c3e', iw, 0.14, 0.14, 0, F + H - 0.1, z);

  // Sechs leere Betten mit aufgeschlagener Seidenbettwäsche
  const beds = [];
  k.noAO(() => {
  for (const sx of [-1, 1]) {
    for (const bz of [-3.6, -1.2, 1.2]) {
      const bx = sx * (iw / 2 - 0.5);
      beds.push([bx, bz]);
      k.box('wood', '#5d4b3a', 0.95, 0.3, 2.05, bx, F + 0.3, bz); // Bettgestell
      for (const [lx, lz] of [[-0.42, -0.97], [0.42, -0.97], [-0.42, 0.97], [0.42, 0.97]]) k.box('wood', '#4c3c2e', 0.07, 0.3, 0.07, bx + lx, F + 0.15, bz + lz);
      k.box('wood', '#5d4b3a', 0.95, 0.6, 0.07, bx, F + 0.6, bz - 1.0); // Kopfteil
      k.box('plain', '#f3f1ea', 0.85, 0.14, 1.95, bx, F + 0.52, bz); // Matratze
      k.box('silk', '#3f88a8', 0.88, 0.05, 1.45, bx, F + 0.615, bz + 0.25); // Seidendecke
      k.box('silk', '#cfe9f2', 0.88, 0.035, 0.3, bx, F + 0.655, bz - 0.36); // umgeschlagene Kante
      k.box('silk', '#f7fbfc', 0.6, 0.12, 0.32, bx, F + 0.65, bz - 0.78); // Kissen
    }
  }
  });
  // ein paar Muscheln auf den Fensterbänken innen
  for (let i = 0; i < 3; i++) scallop(k, shellCols[i % 5], iw / 2 - 0.05, F + 1.07, -3.6 + i * 2.4, 0.8, Math.PI / 2);

  // Kollisionen (in Hüttenkoordinaten): Wände mit Türöffnung, Betten
  const local = [
    { x: 0, z: -d / 2 + T / 2, hw: w / 2, hd: T / 2 },
    { x: -w / 2 + T / 2, z: 0, hw: T / 2, hd: d / 2 },
    { x: w / 2 - T / 2, z: 0, hw: T / 2, hd: d / 2 },
    { x: -(w / 2 + 0.6) / 2, z: d / 2 - T / 2, hw: (w / 2 - 0.6) / 2, hd: T / 2 },
    { x: (w / 2 + 0.6) / 2, z: d / 2 - T / 2, hw: (w / 2 - 0.6) / 2, hd: T / 2 },
    ...beds.map(([x, z]) => ({ x, z, hw: 0.48, hd: 1.05 })),
  ];
  return {
    w,
    d,
    frontExtra: 0.45,
    localColliders: local,
    platforms: [{ x0: -iw / 2, x1: iw / 2, z0: -id / 2, z1: d / 2 + 0.1, y: F + 0.04 }],
  };
}

const DEFAULT = { w: 4.8, d: 7.2, h: 3, floor: 0.45, overhang: 0.35 };

const BUILDERS = {
  // Zeus: wie ein weißes Marmor-Bankgebäude mit großen Säulen, polierte Bronzetüren mit Blitzen
  1(k, rand, extras) {
    const o = { w: 7.5, d: 9.5, h: 5.2, nr: 1 };
    const t = temple(k, o);
    // Blitze auf den Bronzetüren (leuchtend)
    // Blitze, die je nach Blickwinkel über die Bronzetüren zucken (wie im Buch: „wie ein Hologramm“)
    for (const [bx, by, rz, s] of [[-0.55, 0.5, 0.2, 0.62], [0.45, 0.5, -0.15, 0.62], [-0.3, 0.78, -0.4, 0.35], [0.55, 0.25, 0.5, 0.3], [-0.65, 0.22, -0.2, 0.28]]) {
      bolt(k, 'hologram', '#fff1a8', s, bx, t.top + t.dh * by, t.doorZ + 0.08, rz, 0.01);
    }
    for (const sx of [-0.3, 0.3]) k.cyl('bronze', '#e0b25a', 0.05, 0.05, 0.5, sx, t.top + 1.3, t.doorZ + 0.12, 8);
    extras.push({ type: 'hologram', local: mat4(0, t.top + t.dh / 2, t.doorZ) });
    k.box('bronze', '#8a5c22', 0.04, t.dh, 0.14, 0, t.top + t.dh / 2, t.doorZ + 0.02);
    // Bronzeblitz im Giebel
    bolt(k, 'bronze', '#d9a441', 0.55, 0, t.top + o.h + 1.45, o.d / 2 + 0.22, Math.PI / 2 - 0.2);
    // Adler-Akroterion oben auf dem Giebel
    k.sphere('bronze', '#b8873a', 0.2, 0, t.top + o.h + 2.5, o.d / 2 + 0.1, 1, 0.8, 1.4);
    for (const s of [-1, 1]) k.box('bronze', '#b8873a', 0.8, 0.05, 0.3, s * 0.45, t.top + o.h + 2.6, o.d / 2 + 0.1, 0, 0, s * 0.35);
    return { w: o.w + 1.4, d: o.d + 1.4, frontExtra: 0 };
  },

  // Hera: anmutiger, schlankere Säulen mit Granatäpfeln und Blumen, Pfauen in den Wänden
  2(k, rand) {
    const o = { w: 7.2, d: 8.8, h: 4.6, nr: 2, columns: 6, colR: 0.2, doorBucket: 'wood', doorColor: '#6b4a34', roofColor: '#e2dccf' };
    const t = temple(k, o);
    // Girlanden zwischen den Säulen
    for (let i = 0; i < t.colXs.length - 1; i++) {
      const a = t.colXs[i];
      const b = t.colXs[i + 1];
      const pts = [];
      for (let s = 0; s <= 8; s++) {
        const u = s / 8;
        pts.push(v(a + (b - a) * u, t.top + o.h - 0.55 - Math.sin(u * Math.PI) * 0.55, t.colZ + 0.28));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      k.add(new THREE.TubeGeometry(curve, 12, 0.06, 5, false), 'leaf', '#4f7f3a');
      for (let s = 0; s < 7; s++) {
        const p = curve.getPoint((s + 0.5) / 7);
        if (s % 2) k.sphere('glossy', '#b3202e', 0.085, p.x, p.y - 0.06, p.z + 0.05, 1, 1, 1, 8); // Granatapfel
        else k.sphere('plain', rand() < 0.5 ? '#f7c6d6' : '#fff3f6', 0.07, p.x, p.y, p.z + 0.06, 1, 0.6, 1, 7); // Blume
      }
    }
    // Pfauen als Relief in den Wänden (seitlich und vorne neben der Tür)
    const peacock = (x, y, z, ry, s = 1) =>
      k.at(x, y, z, ry, () => {
        for (let f = 0; f < 11; f++) {
          const a = -Math.PI * 0.45 + (f / 10) * Math.PI * 0.9;
          const len = 0.95 * s;
          k.box('marble', '#6fa7a0', 0.07 * s, len, 0.04, Math.sin(a) * len * 0.5, Math.cos(a) * len * 0.5, 0, 0, 0, -a);
          k.cyl('plain', '#2d5f8a', 0.075 * s, 0.075 * s, 0.05, Math.sin(a) * len * 0.95, Math.cos(a) * len * 0.95, 0.02, 10, Math.PI / 2);
          k.cyl('plain', '#d9b54a', 0.035 * s, 0.035 * s, 0.06, Math.sin(a) * len * 0.95, Math.cos(a) * len * 0.95, 0.03, 8, Math.PI / 2);
        }
        k.sphere('plain', '#2a5fa8', 0.2 * s, 0, 0.05, 0.05, 0.75, 1, 0.4);
        k.limb('plain', '#2a6fb0', v(0, 0.15 * s, 0.06), v(0.08 * s, 0.5 * s, 0.06), 0.05 * s);
        k.sphere('plain', '#2a6fb0', 0.07 * s, 0.1 * s, 0.55 * s, 0.06, 1, 1, 0.6);
        k.cone('bronze', '#d9a441', 0.02, 0.08, 0.14 * s, 0.63 * s, 0.06, 4);
      });
    const cellaFront = t.doorZ + 0.03;
    peacock(-2.2, t.top + 2.2, cellaFront, 0, 1);
    peacock(2.2, t.top + 2.2, cellaFront, 0, 1);
    peacock(-(o.w - 2.2) / 2 - 0.03, t.top + 2.4, -1.2, -Math.PI / 2, 1.1);
    peacock((o.w - 2.2) / 2 + 0.03, t.top + 2.4, -1.2, Math.PI / 2, 1.1);
    return { w: o.w + 1.4, d: o.d + 1.4, frontExtra: 0 };
  },

  // Poseidon (Percys Hütte): eigener, begehbarer Bau, siehe poseidonCabin()
  3(k, rand) {
    return poseidonCabin(k, rand);
  },

  // Demeter: Tomatenranken an den Wänden, Dach aus echtem Gras
  4(k, rand) {
    const o = { ...DEFAULT, nr: 4, wall: 'wood', wallColor: '#d8c39b', roofBucket: 'grassRoof', roofColor: '#b8e07a', roofThick: 0.35, door: { color: '#6a8f3a' }, win: { frame: '#f6f1e3', curtains: '#f2e2b8', shutters: '#6a8f3a' }, stovepipe: true };
    shell(k, o);
    // Grasbüschel am Dachrand
    for (let i = 0; i < 40; i++) {
      const s = i % 2 ? 1 : -1;
      const z = (rand() - 0.5) * (o.d + 0.6);
      k.cone('leaf', '#8fbf4f', 0.08, 0.3, s * (o.w / 2 + 0.35), o.floor + o.h + 0.05, z, 5, 0, 0, s * 0.8);
    }
    // Tomatenranken
    for (const face of ['front', 'left', 'right']) {
      const len = face === 'front' ? o.w : o.d;
      for (const u of [-len * 0.42, -len * 0.12, len * 0.12, len * 0.42]) {
        if (face === 'front' && Math.abs(u) < 0.9) continue;
        onFace(k, o, face, u, 0, () => vine(k, rand, v(0, 0.2, 0.08), o.floor + o.h - 0.2, { fruit: '#d8322a', fruitR: 0.055, spread: 0.18 }), 0);
      }
    }
    // Weizengarbe über der Tür
    const y = o.floor + 3.05;
    const z = o.d / 2 + 0.12;
    for (let i = 0; i < 9; i++) {
      const a = (i - 4) * 0.07;
      k.limb('plain', '#d9b45a', v(0, y - 0.35, z), v(Math.sin(a) * 0.6, y + 0.3, z), 0.012, 4);
      k.sphere('plain', '#e3bf5c', 0.035, Math.sin(a) * 0.62, y + 0.34, z, 0.7, 2, 0.7, 5);
    }
    k.cyl('plain', '#8a5c2e', 0.07, 0.07, 0.06, 0, y - 0.1, z, 8, Math.PI / 2);
    // Gemüsebeete vor der Hütte
    for (const s of [-1, 1]) {
      k.box('wood', '#6b4a2e', 0.9, 0.25, 1.2, s * 2.2, 0.12, o.d / 2 + 0.7);
      for (let i = 0; i < 6; i++) k.sphere('leaf', '#5c9a34', 0.14, s * 2.2 + ((i % 2) - 0.5) * 0.35, 0.32, o.d / 2 + 0.25 + Math.floor(i / 2) * 0.4, 1, 0.7, 1, 6);
    }
    return o;
  },

  // Ares: knallrot, wie mit Eimern und Fäusten draufgeklatscht, Stacheldraht auf dem Dach, Wildschweinkopf über der Tür
  5(k, rand, extras) {
    const o = { ...DEFAULT, nr: 5, wall: 'splash', wallColor: '#c9231c', gableBucket: 'splash', gableColor: '#b81f19', roofBucket: 'plain', roofColor: '#3a1a16', trim: '#2a1a16', door: { color: '#2b2b2b', bucket: 'metal', frame: '#2a1a16' }, win: { frame: '#2a1a16', glass: '#1d1d1d' } };
    shell(k, o);
    // Stacheldraht an beiden Traufen und am First
    const rh = 1.7;
    const lines = [
      [-(o.w / 2 + 0.3), o.floor + o.h + 0.25],
      [o.w / 2 + 0.3, o.floor + o.h + 0.25],
      [0, o.floor + o.h + rh + 0.2],
    ];
    for (const [x, y] of lines) {
      const pts = [];
      const L = o.d + 0.9;
      for (let i = 0; i <= 140; i++) {
        const t = i / 140;
        const a = t * 48 * Math.PI;
        pts.push(v(x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12, -L / 2 + t * L));
      }
      k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.01, 3, false), 'metal', '#7d7f82');
      for (let z = -L / 2; z < L / 2; z += 0.3) {
        k.limb('metal', '#8a8c8f', v(x - 0.08, y, z), v(x + 0.08, y + 0.05, z), 0.006, 3);
      }
      for (let z = -L / 2 + 0.2; z < L / 2; z += 1.6) k.limb('metal', '#55575a', v(x, y - 0.25, z), v(x, y + 0.12, z), 0.02, 4);
    }
    // Wildschweinkopf (eigenes Objekt: seine Augen folgen dir)
    const boar = new Kit();
    const fur = '#4a3526';
    boar.sphere('plain', fur, 0.32, 0, 0, 0, 1, 0.9, 1.1, 12);
    boar.cyl('plain', fur, 0.17, 0.24, 0.4, 0, -0.07, 0.35, 10, Math.PI / 2);
    boar.cyl('plain', '#6a4a3a', 0.16, 0.16, 0.05, 0, -0.07, 0.56, 10, Math.PI / 2);
    for (const s of [-1, 1]) {
      boar.sphere('plain', '#1a1010', 0.02, s * 0.06, -0.07, 0.585, 1, 1.4, 0.5, 5);
      boar.cone('plain', '#efe6d2', 0.035, 0.22, s * 0.16, -0.05, 0.42, 6, -0.4, 0, s * 0.6);
      boar.cone('plain', fur, 0.09, 0.2, s * 0.2, 0.28, -0.05, 6, -0.3, 0, -s * 0.5);
      boar.sphere('glow', '#ff3b2a', 0.035, s * 0.14, 0.1, 0.24, 1, 1, 1, 6);
    }
    for (let i = 0; i < 9; i++) boar.cone('plain', '#2f2219', 0.03, 0.18, (i - 4) * 0.04, 0.3, -0.05 - Math.abs(i - 4) * 0.03, 4, -0.5);
    boar.box('wood', '#5a3a26', 0.8, 0.6, 0.06, 0, 0, -0.33);
    const head = boar.build();
    extras.push({ type: 'boar', object: head, local: mat4(0, o.floor + 2.95, o.d / 2 + 0.38) });
    return o;
  },

  // Athene: grau, mit einer geschnitzten Eule über der Tür
  6(k) {
    const o = { ...DEFAULT, nr: 6, wall: 'plaster', wallColor: '#b3b5b3', gableBucket: 'plaster', gableColor: '#a9aba9', roofColor: '#5f646a', door: { color: '#48505a' }, win: { frame: '#f0f0ec', curtains: '#f6f6f2', shutters: '#5c636b' } };
    shell(k, o);
    const y = o.floor + 3.1;
    const z = o.d / 2 + 0.2;
    const st = '#d5d6d2';
    k.sphere('plaster', st, 0.28, 0, y, z, 0.85, 1.1, 0.5, 12);
    k.sphere('plaster', st, 0.2, 0, y + 0.38, z + 0.02, 1.1, 0.95, 0.6, 12);
    for (const s of [-1, 1]) {
      k.cone('plaster', st, 0.06, 0.16, s * 0.15, y + 0.58, z, 5, 0, 0, -s * 0.3);
      k.cyl('plain', '#f4f2ea', 0.075, 0.075, 0.04, s * 0.085, y + 0.4, z + 0.12, 12, Math.PI / 2);
      k.cyl('plain', '#d9a52c', 0.04, 0.04, 0.05, s * 0.085, y + 0.4, z + 0.13, 10, Math.PI / 2);
      k.cyl('plain', '#1a1a1a', 0.02, 0.02, 0.06, s * 0.085, y + 0.4, z + 0.14, 8, Math.PI / 2);
      k.sphere('plaster', '#c4c5c1', 0.16, s * 0.2, y - 0.02, z - 0.02, 0.45, 1.2, 0.5, 8);
    }
    k.cone('plaster', '#a58a4a', 0.03, 0.08, 0, y + 0.32, z + 0.14, 5, Math.PI / 2 + 0.3);
    k.box('plaster', '#9fa19e', 0.8, 0.08, 0.2, 0, y - 0.33, z - 0.05);
    // Olivenbäumchen in Kübeln
    for (const s of [-1, 1]) {
      k.cyl('stone', '#8d8a84', 0.28, 0.22, 0.45, s * 2.1, 0.22, o.d / 2 + 0.8, 10);
      k.limb('bark', '#6d5a44', v(s * 2.1, 0.4, o.d / 2 + 0.8), v(s * 2.1, 1.3, o.d / 2 + 0.8), 0.04);
      k.sphere('leaf', '#7d8f5c', 0.42, s * 2.1, 1.55, o.d / 2 + 0.8, 1, 0.8, 1, 8);
    }
    return o;
  },

  // Apollo: aus massivem Gold, das in der Sonne fast blendet
  7(k) {
    const o = { ...DEFAULT, nr: 7, wall: 'gold', wallColor: '#f0c24a', gableBucket: 'gold', gableColor: '#f3c850', roofBucket: 'gold', roofColor: '#e0a83a', trimBucket: 'gold', trim: '#ffd970', baseBucket: 'gold', baseColor: '#d9a53a', door: { color: '#c9922e', bucket: 'gold', frameBucket: 'gold', frame: '#ffd970' }, win: { frameBucket: 'gold', frame: '#ffd970', glass: '#5a4a2a' }, stepStyle: { bucket: 'gold', color: '#d9a53a' }, gutters: false, piers: false };
    shell(k, o);
    // Sonne über der Tür
    const y = o.floor + 3.2;
    const z = o.d / 2 + 0.15;
    k.cyl('glow', '#fff1b0', 0.26, 0.26, 0.06, 0, y, z, 20, Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.cone('gold', '#ffd35c', 0.06, 0.28, Math.cos(a) * 0.42, y + Math.sin(a) * 0.42, z, 5, 0, 0, a - Math.PI / 2);
    }
    // Leier neben der Tür
    // zwei Leiern im Giebel links und rechts der Sonne
    for (const s of [-1, 1]) {
      const x = s * 1.0;
      const ly = o.floor + 3.05;
      k.add(new THREE.TorusGeometry(0.16, 0.022, 6, 16, Math.PI), 'gold', '#ffd35c', mat4(x, ly, z, 0, 0, Math.PI));
      for (const t of [-1, 1]) k.limb('gold', '#ffd35c', v(x + t * 0.16, ly, z), v(x + t * 0.14, ly + 0.36, z), 0.02, 5);
      k.box('gold', '#ffd35c', 0.36, 0.035, 0.035, x, ly + 0.36, z);
      for (const t of [-0.06, 0, 0.06]) k.limb('plain', '#fff4d0', v(x + t, ly - 0.12, z + 0.02), v(x + t, ly + 0.36, z + 0.02), 0.004, 3);
    }
    return o;
  },

  // Artemis: silbern, schimmert wie Mondlicht
  8(k, rand) {
    const o = { ...DEFAULT, nr: 8, wall: 'silver', wallColor: '#dfe5ee', gableBucket: 'silver', gableColor: '#e6ebf2', roofBucket: 'silver', roofColor: '#b9c3d0', trimBucket: 'silver', trim: '#f4f7fb', door: { color: '#a9b4c2', bucket: 'silver', frameBucket: 'silver', frame: '#f4f7fb' }, win: { frameBucket: 'silver', frame: '#f4f7fb', glass: '#39445a' }, gutters: false, stepStyle: { bucket: 'silver', color: '#c9d1dc' } };
    shell(k, o);
    // Mondsichel
    const y = o.floor + 3.2;
    const z = o.d / 2 + 0.15;
    k.add(new THREE.TorusGeometry(0.32, 0.075, 8, 24, Math.PI * 1.25), 'glow', '#eef4ff', mat4(0, y, z, 0, 0, Math.PI * 0.12));
    // Sterne
    for (let i = 0; i < 7; i++) k.sphere('glow', '#f5f8ff', 0.035, (rand() - 0.5) * 1.8, y + (rand() - 0.3) * 0.7, z, 1, 1, 0.4, 5);
    // Geweih über den Fenstern
    for (const s of [-1, 1]) {
      const x = s * o.w * 0.3;
      for (const t of [-1, 1]) {
        k.limb('silver', '#f0f3f8', v(x, o.floor + 2.25, z), v(x + t * 0.25, o.floor + 2.6, z), 0.02, 4);
        k.limb('silver', '#f0f3f8', v(x + t * 0.14, o.floor + 2.45, z), v(x + t * 0.05, o.floor + 2.62, z), 0.015, 4);
      }
    }
    return o;
  },

  // Hephaistos: Metallwände mit Nieten, Schornsteine wie eine kleine Fabrik
  9(k, rand, extras) {
    const o = { ...DEFAULT, nr: 9, wall: 'metal', wallColor: '#9aa0a6', gableBucket: 'metal', gableColor: '#8d9399', roofBucket: 'metal', roofColor: '#5d6268', trimBucket: 'metal', trim: '#6c7177', roofH: 1.2, door: { color: '#4a4e53', bucket: 'metal', frameBucket: 'metal', frame: '#3a3d41' }, win: { frameBucket: 'metal', frame: '#3a3d41', glass: '#3a2d24' }, stepStyle: { bucket: 'metal', color: '#55595e' } };
    shell(k, o);
    // Nieten
    for (const face of ['front', 'left', 'right']) {
      const len = face === 'front' ? o.w : o.d;
      for (let u = -len / 2 + 0.2; u < len / 2; u += 0.45) for (const y of [o.floor + 0.15, o.floor + o.h - 0.15]) onFace(k, o, face, u, y, () => k.sphere('metal', '#bfc4c9', 0.035, 0, 0, 0, 1, 1, 0.6, 5));
    }
    // Schornsteine
    for (const [x, z] of [[-1.3, -1.5], [1.2, 1.2]]) {
      k.cyl('metal', '#4b4f54', 0.3, 0.36, 3.2, x, o.floor + o.h + 1.4, z, 12);
      k.cyl('metal', '#35383c', 0.4, 0.4, 0.2, x, o.floor + o.h + 3.05, z, 12);
      extras.push({ type: 'smoke', local: mat4(x, o.floor + o.h + 3.2, z) });
    }
    // Zahnräder an der Wand
    const gear = (x, y, r, t) => {
      k.add(new THREE.TorusGeometry(r, r * 0.22, 6, 18), 'bronze', '#b07a3a', mat4(x, y, o.d / 2 + 0.06));
      for (let i = 0; i < t; i++) {
        const a = (i / t) * Math.PI * 2;
        k.box('bronze', '#b07a3a', r * 0.25, r * 0.3, 0.08, x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2, o.d / 2 + 0.06, 0, 0, a);
      }
      k.cyl('bronze', '#8a5c2a', r * 0.3, r * 0.3, 0.1, x, y, o.d / 2 + 0.08, 8, Math.PI / 2);
    };
    gear(-1.5, o.floor + 2.62, 0.22, 10);
    gear(-1.05, o.floor + 2.75, 0.14, 8);
    // Hammer und Amboss über der Tür
    const y = o.floor + 3.05;
    const z = o.d / 2 + 0.15;
    k.box('metal', '#2e3135', 0.55, 0.14, 0.14, 0, y, z);
    k.box('metal', '#2e3135', 0.3, 0.1, 0.12, 0, y - 0.12, z);
    k.box('metal', '#2e3135', 0.42, 0.08, 0.14, 0, y - 0.2, z);
    k.limb('wood', '#6a4a2e', v(-0.35, y + 0.15, z + 0.05), v(0.05, y + 0.55, z + 0.05), 0.025);
    k.box('metal', '#55595e', 0.2, 0.12, 0.12, -0.36, y + 0.13, z + 0.05, 0, 0, 0.8);
    // Amboss vor der Hütte
    k.box('metal', '#2e3135', 0.7, 0.25, 0.35, 2.1, 0.55, o.d / 2 + 1.2);
    k.box('metal', '#2e3135', 0.35, 0.4, 0.3, 2.1, 0.22, o.d / 2 + 1.2);
    return o;
  },

  // Aphrodite: rosa, Blumenkästen, Spitzenvorhänge
  10(k, rand) {
    const o = { ...DEFAULT, nr: 10, wall: 'wood', wallColor: '#f4b2c8', gableColor: '#f7bfd2', roofColor: '#c98aa0', trim: '#fff7fa', door: { color: '#e48aa9' }, win: { frame: '#ffffff', curtains: '#fde3ee', box: (w) => flowerBox(k, rand, w) } };
    shell(k, o);
    // Rosen an der Tür
    for (const s of [-1, 1]) onFace(k, o, 'front', s * 0.95, 0, () => vine(k, rand, v(0, 0.2, 0.08), 2.6, { fruit: s > 0 ? '#e0344f' : '#f38bb0', fruitR: 0.06, spread: 0.12, leaf: '#3f7a3e' }), 0);
    // Taube über der Tür
    const y = o.floor + 3.1;
    const z = o.d / 2 + 0.2;
    k.sphere('plain', '#ffffff', 0.18, 0, y, z, 1.5, 0.85, 0.8);
    k.sphere('plain', '#ffffff', 0.1, 0.25, y + 0.1, z, 1, 1, 1);
    k.cone('plain', '#f0a0a0', 0.025, 0.08, 0.36, y + 0.09, z, 5, 0, 0, -Math.PI / 2);
    for (const s of [-1, 1]) k.box('plain', '#fbfbfb', 0.4, 0.03, 0.2, -0.05, y + 0.18, z + s * 0.12, 0, s * 0.2, 0.5);
    k.cone('plain', '#f4f4f4', 0.1, 0.28, -0.35, y - 0.02, z, 6, 0, 0, Math.PI / 2);
    // Herz
    const heart = new THREE.Shape();
    heart.moveTo(0, -0.18);
    heart.bezierCurveTo(-0.3, 0.02, -0.18, 0.25, 0, 0.1);
    heart.bezierCurveTo(0.18, 0.25, 0.3, 0.02, 0, -0.18);
    k.add(new THREE.ExtrudeGeometry(heart, { depth: 0.05, bevelEnabled: false }), 'glossy', '#e2446b', mat4(0, y + 0.55, z - 0.05));
    return o;
  },

  // Hermes: ganz normale alte Sommerlager-Hütte, abgewetzte Schwelle, abblätternde braune Farbe, Äskulapstab über der Tür, völlig überfüllt
  11(k, rand) {
    const o = { ...DEFAULT, w: 5.4, d: 8, nr: 11, wall: 'worn', wallColor: '#8b6547', gableBucket: 'worn', gableColor: '#7e5b40', roofColor: '#6a625a', trim: '#b8a58a', door: { color: '#6b4a32', bucket: 'worn' }, stepStyle: { bucket: 'wood', color: '#7a6048' }, win: { frame: '#b8a58a', curtains: '#c9b48c', shutters: '#5a4030' }, stovepipe: true, bench: false };
    shell(k, o);
    // abblätternde braune Farbe: helle, verwitterte Holzstellen
    for (let i = 0; i < 46; i++) {
      const face = ['front', 'left', 'right'][i % 3];
      const len = face === 'front' ? o.w : o.d;
      const u = (rand() - 0.5) * (len - 0.5);
      const y = o.floor + 0.3 + rand() * (o.h - 0.5);
      onFace(k, o, face, u, y, () => k.box('wood', rand() < 0.5 ? '#a99883' : '#9c8a74', 0.12 + rand() * 0.45, 0.06 + rand() * 0.2, 0.012, 0, 0, 0.005, 0, 0, (rand() - 0.5) * 0.3), 0);
    }
    // abgewetzte, durchgetretene Schwelle
    k.box('wood', '#9a8568', 1.3, 0.05, 0.3, 0, o.floor + 0.01, o.d / 2 + 0.12);
    // Hermesstab mit zwei Schlangen und Flügeln
    const y = o.floor + 2.8;
    const z = o.d / 2 + 0.16;
    k.limb('gold', '#d8a94a', v(0, y, z), v(0, y + 0.95, z), 0.025);
    k.sphere('gold', '#d8a94a', 0.055, 0, y + 0.98, z);
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const a = t * Math.PI * 3 + (s > 0 ? 0 : Math.PI);
        pts.push(v(Math.sin(a) * 0.1 * (1 - t * 0.3), y + 0.05 + t * 0.7, z + Math.cos(a) * 0.05));
      }
      k.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.018, 4, false), 'glossy', '#3f8a52');
      const hp = pts[pts.length - 1];
      k.sphere('glossy', '#3f8a52', 0.035, hp.x + s * 0.03, hp.y + 0.02, hp.z, 1.3, 0.8, 1);
      for (let f = 0; f < 4; f++) k.box('plain', '#fafafa', 0.26 - f * 0.04, 0.035, 0.02, s * (0.15 + f * 0.02), y + 0.88 - f * 0.045, z, 0, 0, s * (0.35 + f * 0.05));
    }
    // überfüllt: Schlafsäcke, Taschen und Kisten vor der Tür
    const cols = ['#2f5f9a', '#b73a2e', '#3f7a3e', '#d8a13a', '#6b4a8a'];
    for (let i = 0; i < 5; i++) {
      const x = -2.6 + i * 0.5 + (i > 2 ? 3.2 : 0);
      // Schlafsäcke liegen auf der Veranda, so voll ist es drinnen
      k.add(new THREE.CapsuleGeometry(0.17, 0.6, 4, 8), 'plain', cols[i], mat4(i < 3 ? -1.0 + i * 0.36 : 0.75 + (i - 3) * 0.36, o.floor + 0.17, o.d / 2 + 0.55 + (i % 2) * 0.15, Math.PI / 2, 0.1 * i, 0));
    }
    k.box('wood', '#8a6a44', 0.6, 0.45, 0.45, -2.3, 0.23, o.d / 2 + 1.3, 0.3);
    k.box('wood', '#7a5a3a', 0.5, 0.35, 0.4, -2.2, 0.62, o.d / 2 + 1.3, -0.2);
    k.add(new THREE.CapsuleGeometry(0.22, 0.45, 4, 8), 'plain', '#4a5a3a', mat4(2.3, 0.25, o.d / 2 + 0.9, 0, 0, Math.PI / 2));
    // Wäscheleine
    k.limb('wood', '#6a5040', v(-o.w / 2 - 0.6, 0, o.d / 2 - 1), v(-o.w / 2 - 0.6, 2, o.d / 2 - 1), 0.04);
    k.limb('wood', '#6a5040', v(-o.w / 2 - 0.6, 0, -o.d / 2 + 1), v(-o.w / 2 - 0.6, 2, -o.d / 2 + 1), 0.04);
    k.limb('plain', '#e8e2d2', v(-o.w / 2 - 0.6, 1.95, o.d / 2 - 1), v(-o.w / 2 - 0.6, 1.95, -o.d / 2 + 1), 0.008, 3);
    for (let i = 0; i < 5; i++) k.box('plain', i % 2 ? '#e8742a' : '#f0ece2', 0.04, 0.55, 0.5, -o.w / 2 - 0.6, 1.66, o.d / 2 - 1.8 - i * 0.9);
    return o;
  },

  // Dionysos: Weinranken und Trauben, Pergola vor der Tür
  12(k, rand) {
    const o = { ...DEFAULT, nr: 12, wall: 'wood', wallColor: '#b88d6c', gableColor: '#a97f60', roofColor: '#6d4a64', trim: '#6b2e6b', door: { color: '#5a2a55', frame: '#6b2e6b' }, win: { frame: '#6b2e6b' }, stovepipe: true };
    shell(k, o);
    for (const face of ['left', 'right', 'back']) {
      for (const u of [-2.4, -0.8, 0.8, 2.4]) onFace(k, o, face, u, 0, () => vine(k, rand, v(0, 0.2, 0.08), o.floor + o.h, { fruit: '#5b2a6e', fruitR: 0.045, cluster: 4, leaf: '#4f7f34', spread: 0.25 }), 0);
    }
    // Pergola mit Weinreben vor der Tür
    const z0 = o.d / 2 + 0.3;
    for (const [x, z] of [[-1.7, z0 + 1.8], [1.7, z0 + 1.8], [-1.7, z0], [1.7, z0]]) k.box('wood', '#7a5236', 0.14, 2.5, 0.14, x, 1.25, z);
    for (const x of [-1.7, 1.7]) k.box('wood', '#6e4a30', 0.14, 0.14, 2.3, x, 2.55, z0 + 0.9);
    for (let i = 0; i < 5; i++) k.box('wood', '#6e4a30', 3.8, 0.1, 0.1, 0, 2.66, z0 + i * 0.45);
    for (let i = 0; i < 40; i++) k.sphere('leaf', i % 2 ? '#4f7f34' : '#5f9140', 0.22, (rand() - 0.5) * 3.6, 2.78, z0 + rand() * 1.8, 1, 0.4, 1, 6);
    for (let c = 0; c < 8; c++) {
      const cx = (rand() - 0.5) * 2.4;
      const cz = z0 + rand() * 1.8;
      for (let i = 0; i < 10; i++) {
        const row = Math.floor(i / 3);
        k.sphere('glossy', '#5b2a6e', 0.05, cx + ((i % 3) - 1) * 0.07 * (1 - row * 0.2), 2.55 - row * 0.08, cz + (rand() - 0.5) * 0.05, 1, 1, 1, 6);
      }
    }
    // Weinkelch über der Tür
    const y = o.floor + 3.05;
    const z = o.d / 2 + 0.15;
    k.add(new THREE.LatheGeometry([v(0, 0, 0), v(0.18, 0, 0), v(0.05, 0.05, 0), v(0.04, 0.25, 0), v(0.22, 0.35, 0), v(0.25, 0.6, 0)], 14), 'gold', '#d4a043', mat4(0, y - 0.3, z));
    for (const s of [-1, 1]) k.add(new THREE.TorusGeometry(0.1, 0.02, 5, 10, Math.PI), 'gold', '#d4a043', mat4(s * 0.25, y + 0.15, z, 0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2));
    return o;
  },
};

function flowerBox(k, rand, w) {
  k.box('wood', '#fdf7fa', w + 0.2, 0.22, 0.28, 0, -0.68, 0.14);
  const cols = ['#e2446b', '#f7a1c0', '#ffffff', '#f5d04a', '#b86ad8'];
  for (let i = 0; i < 10; i++) k.sphere('plain', cols[i % 5], 0.07, -w / 2 + (i + 0.5) * (w / 10), -0.5 + rand() * 0.06, 0.16 + (rand() - 0.5) * 0.1, 1, 0.8, 1, 6);
  for (let i = 0; i < 8; i++) k.sphere('leaf', '#4f8f3e', 0.08, -w / 2 + (i + 0.5) * (w / 8), -0.55, 0.14, 1, 0.6, 1, 5);
}

// ---------------------------------------------------------------------------
export function buildCabins(colliders) {
  const k = new Kit({ ao: heightAt });
  const extras = [];
  for (const c of LAYOUT.cabins) {
    const rand = rng('cabin' + c.nr);
    const y = heightAt(c.x, c.z) - 0.05;
    const local = [];
    let size;
    k.at(c.x, y, c.z, c.facing, () => {
      size = BUILDERS[c.nr](k, rand, local);
      for (const e of local) extras.push({ ...e, matrix: k.M.clone().multiply(e.local), cabin: c.nr });
    });
    // Größe merken: so weit steht die Hütte samt Veranda/Stufen vor
    const extra = size.frontExtra ?? 0;
    c.size = { w: size.w, d: size.d, front: size.d / 2 + extra };
    if (size.localColliders) {
      // begehbare Hütte: einzelne Wände statt eines großen Blocks
      const cs = Math.cos(c.facing);
      const sn = Math.sin(c.facing);
      const W = (lx, lz) => ({ x: c.x + lx * cs + lz * sn, z: c.z - lx * sn + lz * cs });
      for (const b of size.localColliders) {
        const p = W(b.x, b.z);
        colliders.addBox(p.x, p.z, b.hw, b.hd, c.facing);
      }
      for (const pl of size.platforms ?? []) {
        const a = W(pl.x0, pl.z0);
        const e = W(pl.x1, pl.z1);
        addPlatform(Math.min(a.x, e.x), Math.max(a.x, e.x), Math.min(a.z, e.z), Math.max(a.z, e.z), y + 0.05 + pl.y);
      }
    } else {
      const mid = inFrontOf(c, extra / 2);
      colliders.addBox(mid.x, mid.z, size.w / 2 + 0.1, size.d / 2 + extra / 2 + 0.1, c.facing);
    }
  }
  const group = k.build();
  return { group, extras };
}
