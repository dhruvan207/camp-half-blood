import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundAt, LAYOUT, cabin, inFrontOf } from './terrain.js';
import { bigHouseSpot } from './buildings.js';

// Abstand vor der Hütte, an dem die Figuren stehen: vor Veranda/Stufen plus 0,9 m Platz
const FRONT = (nr) => cabin(nr).size.front + 0.9;

// Figuren aus Camp Half-Blood, selbst gebaut aus Grundformen.
// Aussehen nach den Beschreibungen im Buch „Diebe im Olymp“.
// Maßstab: Referenzfigur 1,70 m, Blick nach +z.

const UP = new THREE.Vector3(0, 1, 0);
const SKIN_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide });

function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

function rng(seedText) {
  let s = 0;
  for (const ch of seedText) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Sammelt viele Formen und fügt sie zu EINEM Mesh zusammen (wichtig für die Leistung am Handy)
class Parts {
  constructor() {
    this.geos = [];
  }
  add(geo, color, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    this.geos.push(geo);
    return geo;
  }
  sphere(r, color, x, y, z, sx = 1, sy = sx, sz = sx, seg = 14) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, Math.round(seg * 0.7))), color, mat4(x, y, z, 0, 0, 0, sx, sy, sz));
  }
  // Glied zwischen zwei Punkten (Kapsel)
  limb(a, b, r, color, seg = 10) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(dir.length(), 0.001);
    const geo = new THREE.CapsuleGeometry(r, len, 4, seg);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(geo, color, m);
  }
  cone(r, h, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.ConeGeometry(r, h, 8), color, mat4(x, y, z, rx, ry, rz));
  }
  cyl(rt, rb, h, color, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sz = 1, seg = 12) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, mat4(x, y, z, rx, ry, rz, sx, 1, sz));
  }
  box(w, h, d, color, x, y, z, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, mat4(x, y, z, rx, ry, rz));
  }
  get empty() {
    return this.geos.length === 0;
  }
  build(material) {
    const g = mergeGeometries(this.geos);
    for (const geo of this.geos) geo.dispose();
    const mesh = new THREE.Mesh(g, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
// Texturen (auf Canvas gezeichnet, keine Bilddateien nötig)

function canvasTex(w, h, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat !== 1) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  return t;
}

function blobs(g, w, h, colors, count, rMin, rMax, rand) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[i % colors.length];
    const x = rand() * w;
    const y = rand() * h;
    const r = rMin + rand() * (rMax - rMin);
    g.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.6 + rand() * 0.5);
      const px = x + Math.cos(a) * rr * 1.4;
      const py = y + Math.sin(a) * rr;
      k ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.fill();
  }
}

const PATTERNS = {
  leopard: () =>
    canvasTex(
      256,
      256,
      (g, w, h) => {
        const r = rng('leo');
        g.fillStyle = '#e0a84a';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 70; i++) {
          const x = r() * w;
          const y = r() * h;
          const s = 7 + r() * 7;
          g.fillStyle = '#8a5a22';
          g.beginPath();
          g.ellipse(x, y, s, s * 0.8, r() * 3, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#1d140c';
          g.lineWidth = 3.5;
          g.beginPath();
          g.arc(x, y, s, r() * 2, r() * 2 + 3.8);
          g.stroke();
        }
      },
      2,
    ),
  camo: () =>
    canvasTex(
      256,
      256,
      (g, w, h) => {
        const r = rng('camo');
        g.fillStyle = '#6b6a3f';
        g.fillRect(0, 0, w, h);
        blobs(g, w, h, ['#4a4a2a', '#8a7a52', '#2c2a1d', '#5b5234'], 55, 14, 30, r);
      },
      2,
    ),
  tweed: () =>
    canvasTex(
      256,
      256,
      (g, w, h) => {
        const r = rng('tweed');
        g.fillStyle = '#7a5a3c';
        g.fillRect(0, 0, w, h);
        for (let i = 0; i < 2600; i++) {
          g.fillStyle = ['#5e4229', '#8f6c49', '#6b4e33', '#9c7f5c'][i % 4];
          g.fillRect(r() * w, r() * h, 2 + r() * 3, 1.5);
        }
        g.strokeStyle = 'rgba(60,40,25,0.5)';
        g.lineWidth = 1;
        for (let x = 0; x < w; x += 32) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, h);
          g.stroke();
          g.beginPath();
          g.moveTo(0, x);
          g.lineTo(w, x);
          g.stroke();
        }
      },
      2,
    ),
};
const patternCache = {};
function patternMat(name) {
  patternCache[name] ??= new THREE.MeshStandardMaterial({ map: PATTERNS[name](), vertexColors: true, roughness: 0.85 });
  return patternCache[name];
}

let campShirtMat;
function campShirtDecalMat() {
  campShirtMat ??= new THREE.MeshStandardMaterial({
    map: canvasTex(512, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.fillStyle = '#1e1a16';
      g.textAlign = 'center';
      g.font = 'bold 84px Georgia, serif';
      g.fillText('CAMP', w / 2, 108);
      g.font = 'bold 62px Georgia, serif';
      g.fillText('HALF-BLOOD', w / 2, 196, w * 0.86);
    }),
    transparent: true,
    roughness: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  });
  return campShirtMat;
}

// Gesicht auf eine Kugel malen. Die Gesichtsmitte liegt bei u = 0,25 (zeigt nach +z).
function faceTexture(o) {
  return canvasTex(512, 256, (g) => {
    g.fillStyle = o.skin;
    g.fillRect(0, 0, 512, 256);
    const cx = 128;
    const eyeY = 116;
    const shade = (a) => `rgba(90,40,30,${a})`;

    // Wangen
    g.fillStyle = shade(0.08);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(cx + s * 34, 150, 16, 11, 0, 0, Math.PI * 2);
      g.fill();
    }

    const eyeW = o.bigEyes ? 13 : 11;
    const eyeH = o.bigEyes ? 9 : 7;
    for (const s of [-1, 1]) {
      const ex = cx + s * 24;
      g.fillStyle = o.bloodshot ? '#f3e2dc' : '#f7f4ef';
      g.beginPath();
      g.ellipse(ex, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = o.eyes;
      g.beginPath();
      g.arc(ex + s * -1, eyeY, eyeH - 1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(ex + s * -1, eyeY, 2.8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.arc(ex - 2, eyeY - 2.5, 1.6, 0, Math.PI * 2);
      g.fill();
      // Oberlid
      g.strokeStyle = 'rgba(40,25,20,0.85)';
      g.lineWidth = o.heavyLids ? 4 : 2.2;
      g.beginPath();
      g.ellipse(ex, eyeY + (o.heavyLids ? 2 : 0), eyeW + 0.5, eyeH, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      // Augenbrauen
      g.strokeStyle = o.brow;
      g.lineWidth = o.thickBrows ? 6 : 4;
      g.lineCap = 'round';
      g.beginPath();
      const inner = o.browMood === 'angry' ? 4 : o.browMood === 'up' ? -6 : 0;
      const outer = o.browMood === 'up' ? -4 : 0;
      g.moveTo(ex - s * 11, eyeY - 15 + inner);
      g.quadraticCurveTo(ex, eyeY - 21 + (inner + outer) / 2, ex + s * 12, eyeY - 16 + outer);
      g.stroke();
    }

    // Nase (Schatten)
    g.strokeStyle = shade(0.25);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(cx - 5, 142);
    g.quadraticCurveTo(cx, 146, cx + 5, 142);
    g.stroke();

    // Mund
    g.strokeStyle = '#8a4640';
    g.lineWidth = 3.2;
    g.lineCap = 'round';
    g.beginPath();
    const m = o.mouth ?? 'smile';
    if (m === 'smile') {
      g.moveTo(cx - 11, 160);
      g.quadraticCurveTo(cx, 168, cx + 11, 160);
    } else if (m === 'grin') {
      g.moveTo(cx - 13, 158);
      g.quadraticCurveTo(cx + 2, 170, cx + 14, 155);
    } else if (m === 'frown') {
      g.moveTo(cx - 10, 165);
      g.quadraticCurveTo(cx, 158, cx + 10, 165);
    } else {
      g.moveTo(cx - 10, 162);
      g.lineTo(cx + 10, 162);
    }
    g.stroke();

    o.paint?.(g, cx, eyeY);
  });
}

function paintEye(g, x, y, s = 1, iris = '#4a78b0') {
  g.fillStyle = '#f7f4ef';
  g.beginPath();
  g.ellipse(x, y, 9 * s, 5.5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = iris;
  g.beginPath();
  g.arc(x, y, 4.5 * s, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#111';
  g.beginPath();
  g.arc(x, y, 2 * s, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(40,25,20,0.8)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.ellipse(x, y, 9.5 * s, 5.5 * s, 0, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

// ---------------------------------------------------------------------------
// Frisuren (Koordinaten relativ zur Kopfmitte, Kopfradius ca. 0,115)

function hairCap(P, color, theta = 1.4, tilt = -0.3, r = 0.124) {
  const geo = new THREE.SphereGeometry(r, 24, 14, 0, Math.PI * 2, 0, theta);
  P.add(geo, color, mat4(0, 0.004, -0.004, tilt, 0, 0, 0.97, 1.1, 1.02));
}

function pointOnHead(rand, yMin, yMax, zMax = 1, r = 0.12) {
  const y = yMin + rand() * (yMax - yMin);
  const ring = Math.sqrt(Math.max(0, 1 - y * y));
  let a;
  do a = rand() * Math.PI * 2;
  while (Math.cos(a) > zMax);
  return v(Math.sin(a) * ring * r, y * r * 1.1, Math.cos(a) * ring * r);
}

const HAIR = {
  short(P, c) {
    hairCap(P, c, 1.28, -0.35, 0.121);
  },
  messy(P, c, rand) {
    hairCap(P, c, 1.45, -0.3, 0.125);
    for (let i = 0; i < 22; i++) {
      const p = pointOnHead(rand, 0.25, 0.95, 0.8, 0.125);
      const dir = p.clone().normalize();
      dir.y += 0.3;
      dir.z += 0.35;
      const geo = new THREE.ConeGeometry(0.024, 0.075, 5);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
      P.add(geo, c, new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
    }
  },
  curly(P, c, rand, n = 34, size = 0.034) {
    hairCap(P, c, 1.38, -0.3, 0.12);
    for (let i = 0; i < n; i++) {
      const p = pointOnHead(rand, 0.15, 0.95, 0.75, 0.125);
      P.sphere(size * (0.8 + rand() * 0.5), c, p.x, p.y, p.z, 1, 1, 1, 7);
    }
  },
  curlyLong(P, c, rand) {
    HAIR.curly(P, c, rand, 60, 0.026);
    // Korkenzieher-Locken über den Rücken bis auf die Schultern
    const light = new THREE.Color(c).offsetHSL(0, 0, 0.06).getStyle();
    for (let i = 0; i < 34; i++) {
      let a;
      do a = rand() * Math.PI * 2;
      while (Math.cos(a) > 0.25);
      const r0 = 0.118;
      const len = 0.2 + rand() * 0.14;
      let x = Math.sin(a) * r0;
      let z = Math.cos(a) * r0 * 0.95 - 0.01;
      let y = 0.03 + rand() * 0.04;
      for (let k = 0; k < 7; k++) {
        const t = k / 6;
        const wob = Math.sin(k * 1.9 + i) * 0.012;
        const out = 1 + t * 0.35;
        P.sphere(0.022 - t * 0.004, k % 2 ? c : light, x * out + wob, y - t * len, z * out + wob, 1, 1, 1, 6);
      }
    }
  },
  stringy(P, c, rand) {
    hairCap(P, c, 1.5, -0.25, 0.124);
    for (let i = 0; i < 26; i++) {
      let a;
      do a = rand() * Math.PI * 2;
      while (Math.cos(a) > 0.2);
      const x = Math.sin(a) * 0.12;
      const z = Math.cos(a) * 0.115;
      const len = 0.16 + rand() * 0.12;
      P.limb(v(x, 0.02, z), v(x * 1.25, -len, z * 1.2 - 0.02), 0.016, c, 5);
    }
  },
  curlyShort(P, c, rand) {
    HAIR.curly(P, c, rand, 44, 0.03);
  },
};

// ---------------------------------------------------------------------------
// Armhaltungen: Ellbogen und Handgelenk relativ zur Schulter (für die rechte Seite x spiegeln)
const ARMS = {
  down: [v(0.035, -0.27, -0.01), v(0.05, -0.52, 0.03)],
  hip: [v(0.16, -0.2, -0.05), v(-0.02, -0.4, 0.04)],
  forward: [v(0.04, -0.27, 0.05), v(-0.02, -0.3, 0.32)],
  drink: [v(0.08, -0.25, 0.1), v(-0.1, -0.02, 0.2)],
  crossed: [v(0.03, -0.26, 0.1), v(-0.26, -0.18, 0.17)],
  crossedLow: [v(0.04, -0.27, 0.12), v(-0.24, -0.24, 0.13)],
  wave: [v(0.24, -0.06, 0.02), v(0.26, 0.2, 0.05)],
  bow: [v(0.05, -0.26, 0.06), v(0.04, -0.46, 0.2)],
  pocket: [v(0.08, -0.25, -0.04), v(0.04, -0.42, 0.06)],
};

// ---------------------------------------------------------------------------
// Menschliche Figur (auch Oberkörper von Chiron und Figur mit Ziegenbeinen)

function buildHuman(o) {
  const rand = rng(o.name);
  const B = o.bulk ?? 1;
  const hipY = (o.yBase ?? 0) + (o.seated ? 0.47 : 0.9);
  const body = new Parts();
  const pat = o.pattern ? new Parts() : null;
  const shirtP = pat ?? body;
  const shirtC = pat ? '#ffffff' : o.shirt;
  const sleeveP = o.sleevePattern === false ? body : shirtP;
  const sleeveC = o.sleevePattern === false ? o.sleeveColor : shirtC;
  const skin = o.skin;
  const hands = {};

  // --- Beine ---
  for (const s of [-1, 1]) {
    const x = s * 0.1 * Math.min(B, 1.15);
    if (o.legs === 'none') break;
    if (o.legs === 'goat') {
      const fur = o.fur;
      const hip = v(x, hipY, 0);
      const knee = v(x * 1.1, 0.56, 0.1);
      const hock = v(x * 1.1, 0.27, -0.1);
      const fet = v(x * 1.1, 0.08, 0.0);
      body.limb(hip, knee, 0.085, fur);
      body.limb(knee, hock, 0.058, fur);
      body.limb(hock, fet, 0.04, fur);
      // zotteliges Fell: Büschel, die nach unten hängen
      const furDark = new THREE.Color(fur).offsetHSL(0, 0, -0.08).getStyle();
      const furLight = new THREE.Color(fur).offsetHSL(0, 0, 0.07).getStyle();
      const segs = [[hip, knee, 0.07, 30, 0.05], [knee, hock, 0.045, 18, 0.036], [hock, fet, 0.03, 8, 0.028]];
      for (const [a, b, r, n, size] of segs) {
        for (let i = 0; i < n; i++) {
          const p = a.clone().lerp(b, rand());
          const ang = rand() * Math.PI * 2;
          const col = i % 3 ? fur : i % 2 ? furDark : furLight;
          body.sphere(size * (0.8 + rand() * 0.4), col, p.x + Math.cos(ang) * r, p.y - 0.02, p.z + Math.sin(ang) * r, 1, 1.7, 1, 7);
        }
      }
      body.cyl(0.042, 0.052, 0.08, '#231c17', fet.x, 0.04, 0.02);
      continue;
    }
    const pants = o.pants;
    const hip = v(x, hipY, 0);
    const knee = o.seated ? v(x * 1.1, hipY + 0.02, 0.44) : v(x, 0.5, 0.015);
    const ankle = o.seated ? v(x * 1.1, 0.1, 0.46) : v(x, 0.1, 0);
    body.limb(hip, knee, 0.078 * Math.min(B, 1.2), pants);
    if (o.shorts) {
      body.limb(knee, ankle, 0.052, skin);
      body.limb(hip.clone().lerp(knee, 0.3), knee.clone().lerp(ankle, 0.08), 0.082 * Math.min(B, 1.2), pants);
    } else {
      body.limb(knee, ankle, 0.062, pants);
    }
    body.sphere(0.066, o.shoes, ankle.x, 0.055, ankle.z + 0.06, 1, 0.75, 1.9);
    body.cyl(0.07, 0.07, 0.025, '#e8e4dc', ankle.x, 0.015, ankle.z + 0.06, 0, 0, 0, 0.95, 1.8);
  }

  // --- Hüfte und Oberkörper ---
  if (o.legs !== 'none') body.cyl(0.148 * B, 0.155 * B, 0.2, o.legs === 'goat' ? o.fur : o.pants, 0, hipY + 0.03, 0, 0, 0, 0, 1, 0.64, 18);
  if (o.belt) body.cyl(0.162 * B, 0.162 * B, 0.035, o.belt, 0, hipY + 0.1, 0, 0, 0, 0, 1, 0.7, 16);
  const tb = hipY + 0.08;
  const th = 0.5;
  shirtP.cyl(0.188 * B, 0.158 * B, th, shirtC, 0, tb + th / 2, 0, 0, 0, 0, 1, 0.62, 18);
  if (o.belly) shirtP.sphere(0.17 * B, shirtC, 0, hipY + 0.24, 0.05, 1, 0.95, 0.85, 16);
  const shY = tb + th - 0.04;
  const shX = 0.205 * B;
  shirtP.limb(v(-shX, shY, 0), v(shX, shY, 0), 0.075, shirtC, 12);
  body.cyl(0.05, 0.056, 0.12, skin, 0, shY + 0.07, 0.005);
  if (o.collar) body.cyl(0.075, 0.08, 0.04, o.collar, 0, shY + 0.03, 0, 0, 0, 0, 1, 0.8);

  // --- Arme ---
  for (const s of [-1, 1]) {
    const pose = ARMS[(s > 0 ? o.armL : o.armR) ?? 'down'];
    const S = v(s * (shX + 0.015), shY - 0.02, 0);
    const mir = (p) => v(p.x * s, p.y, p.z);
    const E = S.clone().add(mir(pose[0]));
    const W = S.clone().add(mir(pose[1]));
    const armSkin = o.armSkin ?? skin;
    if (o.sleeves === 'long') {
      sleeveP.limb(S, E, 0.064, sleeveC);
      sleeveP.limb(E, W, 0.056, sleeveC);
    } else {
      body.limb(S, E, 0.054 * Math.min(B, 1.2), armSkin);
      body.limb(E, W, 0.046 * Math.min(B, 1.2), armSkin);
      sleeveP.limb(S, S.clone().lerp(E, 0.55), 0.068 * Math.min(B, 1.2), sleeveC);
    }
    const dir = W.clone().sub(E).normalize();
    const H = W.clone().addScaledVector(dir, 0.055);
    body.sphere(0.05, skin, H.x, H.y, H.z, 0.8, 1.15, 1);
    hands[s > 0 ? 'l' : 'r'] = H;
    o.onArm?.(body, S, E, W, s);
  }

  // --- Kopf ---
  const headPivot = new THREE.Group();
  headPivot.position.set(0, shY + 0.215, 0.01);
  const hs = o.headScale ?? 1;
  headPivot.scale.setScalar(hs);
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(o), roughness: 0.7 });
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.115, 36, 24), faceMat);
  face.scale.set(0.92, 1.1, 0.98);
  face.castShadow = true;
  headPivot.add(face);
  const head = new Parts();
  for (const s of [-1, 1]) head.sphere(0.03, skin, s * 0.104, -0.005, -0.005, 0.5, 1, 0.8, 8);
  head.sphere(o.bigNose ? 0.03 : 0.021, o.noseColor ?? skin, 0, -0.018, 0.11, 0.85, 1, 1.15, 10);
  HAIR[o.hair.style](head, o.hair.color, rand);
  o.headExtras?.(head, rand);
  headPivot.add(head.build(SKIN_MAT));

  // --- zusammenbauen ---
  const g = new THREE.Group();
  g.add(body.build(SKIN_MAT));
  if (pat) g.add(pat.build(patternMat(o.pattern)));
  if (o.campShirt) {
    const y0 = hipY + 0.28;
    const h = 0.17;
    const rAt = (y) => 0.158 * B + ((y - tb) / th) * 0.03 * B + 0.004;
    const geo = new THREE.CylinderGeometry(rAt(y0 + h), rAt(y0), h, 16, 1, true, -0.75, 1.5);
    const decal = new THREE.Mesh(geo, campShirtDecalMat());
    decal.position.set(0, y0 + h / 2, 0);
    decal.scale.set(1, 1, 0.62);
    g.add(decal);
  }
  g.add(headPivot);
  o.extras?.(g, hands);
  g.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group: g, headPivot, hands, topY: headPivot.position.y + 0.2 * hs };
}

// ---------------------------------------------------------------------------
// Einzelne Figuren

const ORANGE = '#e8742a';
const JEANS = '#3f5677';

function campShirt(o) {
  return { shirt: ORANGE, campShirt: true, ...o };
}

function beadNecklace(colors) {
  return (P, S, E, W, s) => {
    if (s < 0) return;
    const y = S.y + 0.035;
    P.add(new THREE.TorusGeometry(0.085, 0.006, 5, 24), '#3a2a1c', mat4(0, y, 0.01, Math.PI / 2 - 0.25, 0, 0, 1, 1, 0.72));
    colors.forEach((c, i) => {
      const a = (i - (colors.length - 1) / 2) * 0.35;
      P.sphere(0.013, c, Math.sin(a) * 0.08, y - 0.03 - Math.abs(Math.cos(a)) * 0.01, Math.cos(a) * 0.075 + 0.015, 1, 1, 1, 8);
    });
  };
}

const FIGURES = [
  {
    id: 'percy',
    name: 'Percy Jackson',
    height: 1.52,
    place: () => ({ ...inFrontOf(cabin(3), FRONT(3)), faceTo: LAYOUT.campfire }),
    make: () =>
      buildHuman(
        campShirt({
          name: 'Percy',
          skin: '#eac5a3',
          eyes: '#2f9a86',
          brow: '#151515',
          hair: { style: 'messy', color: '#151515' },
          pants: JEANS,
          shoes: '#3a3f4a',
          headScale: 1.07,
          armL: 'down',
          armR: 'pocket',
        }),
      ),
  },
  {
    id: 'annabeth',
    name: 'Annabeth Chase',
    height: 1.52,
    place: () => ({ ...inFrontOf(cabin(6), FRONT(6)), faceTo: LAYOUT.campfire }),
    make: () =>
      buildHuman(
        campShirt({
          name: 'Annabeth',
          skin: '#d9a57e',
          eyes: '#8b98a5',
          brow: '#b88f3e',
          hair: { style: 'curlyLong', color: '#e2bd66' },
          pants: JEANS,
          shoes: '#e7e2d6',
          belt: '#5a3e28',
          headScale: 1.07,
          armL: 'hip',
          armR: 'down',
          onArm: beadNecklace(['#c23b2b', '#2c5aa0', '#3d8a3d', '#e3b53c']),
          extras: (g) => {
            // Bronzedolch in der Scheide am Gürtel
            const P = new Parts();
            P.box(0.035, 0.2, 0.025, '#4a3322', -0.15, 0.8, 0.07, 0, 0, 0.15);
            P.cyl(0.014, 0.014, 0.07, '#b0823c', -0.165, 0.93, 0.07, 0, 0, 0.15);
            g.add(P.build(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.5, roughness: 0.45 })));
          },
        }),
      ),
  },
  {
    id: 'grover',
    name: 'Grover Underwood',
    height: 1.5,
    place: () => ({ x: 2.6, z: -24, faceTo: LAYOUT.start }),
    make: () =>
      buildHuman({
        name: 'Grover',
        skin: '#e6c09a',
        eyes: '#6b4a2b',
        brow: '#5a3f27',
        hair: { style: 'curlyShort', color: '#6a4a2e' },
        shirt: '#6f8750',
        legs: 'goat',
        fur: '#7a5c42',
        headScale: 1.08,
        armL: 'down',
        armR: 'wave',
        mouth: 'grin',
        paint: (g, cx) => {
          // ein paar Pickel
          g.fillStyle = 'rgba(200,80,70,0.7)';
          for (const [x, y] of [[-30, 140], [36, 132], [20, 175], [-18, 100]]) {
            g.beginPath();
            g.arc(cx + x, y, 2.4, 0, Math.PI * 2);
            g.fill();
          }
        },
        headExtras: (P) => {
          for (const s of [-1, 1]) P.cone(0.016, 0.055, '#e6dcc4', s * 0.045, 0.125, 0.025, -0.3, 0, -s * 0.35);
          // dünnes Ziegenbärtchen
          P.cone(0.02, 0.06, '#6a4a2e', 0, -0.13, 0.075, Math.PI + 0.35, 0, 0);
        },
      }),
  },
  {
    id: 'luke',
    name: 'Luke Castellan',
    height: 1.83,
    place: () => ({ ...inFrontOf(cabin(11), FRONT(11)), faceTo: LAYOUT.start }),
    make: () =>
      buildHuman(
        campShirt({
          name: 'Luke',
          skin: '#e0b48c',
          eyes: '#4a86c2',
          brow: '#8f7545',
          hair: { style: 'short', color: '#b89a5c' },
          pants: '#6f6a55',
          shorts: true,
          shoes: '#4b3b2c',
          bulk: 1.08,
          armL: 'down',
          armR: 'wave',
          paint: (g, cx, eyeY) => {
            // Narbe vom rechten Auge bis zum Kinn
            g.beginPath();
            g.moveTo(cx - 25, eyeY - 14);
            g.lineTo(cx - 28, eyeY + 12);
            g.lineTo(cx - 22, eyeY + 72);
            g.strokeStyle = 'rgba(150,80,70,0.55)';
            g.lineWidth = 7;
            g.stroke();
            g.strokeStyle = '#fbeee6';
            g.lineWidth = 4;
            g.stroke();
          },
        }),
      ),
  },
  {
    id: 'travis',
    name: 'Travis Stoll',
    height: 1.72,
    place: () => ({ ...inFrontOf(cabin(11), FRONT(11) + 0.3), dz: 1.5, faceTo: LAYOUT.start }),
    make: () => buildHuman(campShirt(stoll('Travis', 'down', 'pocket'))),
  },
  {
    id: 'connor',
    name: 'Connor Stoll',
    height: 1.66,
    place: () => ({ ...inFrontOf(cabin(11), FRONT(11) + 0.3), dz: -1.5, faceTo: LAYOUT.start }),
    make: () => buildHuman(campShirt(stoll('Connor', 'pocket', 'down'))),
  },
  {
    id: 'clarisse',
    name: 'Clarisse La Rue',
    height: 1.72,
    place: () => ({ ...inFrontOf(cabin(5), FRONT(5)), faceTo: LAYOUT.campfire }),
    make: () =>
      buildHuman({
        name: 'Clarisse',
        skin: '#e2b692',
        eyes: '#5a3a24',
        brow: '#4a3322',
        hair: { style: 'stringy', color: '#5a3f2b' },
        pattern: 'camo',
        sleeves: 'long',
        pants: '#374a63',
        shoes: '#2a221b',
        bulk: 1.2,
        armL: 'crossed',
        armR: 'crossedLow',
        mouth: 'frown',
        browMood: 'angry',
        thickBrows: true,
      }),
  },
  {
    id: 'argus',
    name: 'Argus',
    height: 1.95,
    place: () => ({ ...bigHouseSpot(-2.6, 10.4, 0), y: undefined }), // vor der Verandatreppe
    make: () =>
      buildHuman({
        name: 'Argus',
        skin: '#ecc7a6',
        eyes: '#4a78b0',
        brow: '#c9a760',
        hair: { style: 'short', color: '#d8bb72' },
        shirt: '#43536a',
        pants: '#2e3440',
        shoes: '#1e1e1e',
        bulk: 1.22,
        armL: 'crossed',
        armR: 'crossedLow',
        mouth: 'flat',
        paint: (g, cx) => {
          // Augen überall: Stirn, Wangen, Kinn, Seiten und Hinterkopf
          const spots = [
            [0, 92, 0.8], [-40, 150, 0.7], [40, 150, 0.7], [0, 190, 0.6], [-52, 112, 0.7], [52, 112, 0.7],
            [-100, 130, 0.9], [100, 130, 0.9], [-140, 160, 0.8], [140, 160, 0.8], [200, 130, 0.9], [240, 170, 0.8], [290, 135, 0.9],
          ];
          for (const [x, y, s] of spots) paintEye(g, cx + x, y, s);
        },
        onArm: (P, S, E, W, s) => {
          // Augen auf Armen und Händen
          for (let i = 0; i < 4; i++) {
            const t = 0.25 + i * 0.22;
            const p = i < 2 ? S.clone().lerp(E, 0.5 + i * 0.3) : E.clone().lerp(W, (i - 1) * 0.35);
            const out = v(s * 0.045, 0, 0.02 + (i % 2) * 0.02);
            P.sphere(0.02, '#f7f4ef', p.x + out.x, p.y, p.z + out.z, 1, 0.65, 0.5, 8);
            P.sphere(0.009, '#4a78b0', p.x + out.x * 1.18, p.y, p.z + out.z + 0.004 + t * 0, 1, 1, 0.6, 6);
          }
        },
      }),
  },
  {
    id: 'mrd',
    name: 'Mr. D (Dionysos)',
    height: 1.62,
    place: () => bigHouseSpot(4.3, 6.2, -Math.PI / 2), // auf der Veranda am Kartentisch
    make: () =>
      buildHuman({
        name: 'MrD',
        skin: '#f0c4ae',
        eyes: '#5a3a5c',
        brow: '#241530',
        hair: { style: 'curlyShort', color: '#2a1838' },
        pattern: 'leopard',
        pants: '#c9b99a',
        shoes: '#6a4a32',
        bulk: 1.28,
        belly: true,
        seated: true,
        bigEyes: true,
        bloodshot: true,
        heavyLids: true,
        bigNose: true,
        noseColor: '#d9636b',
        mouth: 'flat',
        armL: 'forward',
        armR: 'drink',
        paint: (g, cx) => {
          g.fillStyle = 'rgba(220,90,100,0.45)';
          g.beginPath();
          g.ellipse(cx, 138, 14, 10, 0, 0, Math.PI * 2);
          g.fill();
        },
        extras: (g, hands) => {
          const P = new Parts();
          const h = hands.r;
          // Cola-Dose
          P.cyl(0.032, 0.032, 0.12, '#c9ccd2', h.x + 0.02, h.y + 0.02, h.z + 0.02);
          P.cyl(0.0335, 0.0335, 0.03, '#b3202a', h.x + 0.02, h.y + 0.03, h.z + 0.02);
          // Spielkarten in der linken Hand
          const l = hands.l;
          for (let i = 0; i < 5; i++) P.box(0.055, 0.08, 0.002, i % 2 ? '#f4f0e6' : '#ffffff', l.x - 0.03 + i * 0.012, l.y + 0.05, l.z + 0.01, -0.5, 0, -0.3 + i * 0.15);
          g.add(P.build(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.4, roughness: 0.4 })));
        },
      }),
  },
  {
    id: 'chiron',
    name: 'Chiron',
    height: 1.0, // der Zentaur wird unten direkt in Metern gebaut
    place: () => bigHouseSpot(1.4, 6.2, Math.PI / 2), // auf der Veranda, Mr. D gegenüber
    make: buildChiron,
  },
];

function stoll(name, armL, armR) {
  return {
    name,
    skin: '#e3b894',
    eyes: '#5b3d26',
    brow: '#4a3120',
    hair: { style: 'curlyShort', color: '#5b3b24' },
    pants: JEANS,
    shoes: '#8a2f2a',
    armL,
    armR,
    mouth: 'grin',
    browMood: 'up',
  };
}

function buildChiron() {
  const WHITE = '#f1ebdf';
  const hoofC = '#6b6660';
  const S = 1.12; // Chiron ist groß
  const upper = buildHuman({
    name: 'Chiron',
    skin: '#e1b894',
    eyes: '#5a3a24',
    brow: '#4a321f',
    hair: { style: 'curlyShort', color: '#6b4a2d' },
    pattern: 'tweed',
    sleeves: 'long',
    legs: 'none',
    yBase: 0.52,
    collar: '#f0ece2',
    armL: 'bow',
    armR: 'down',
    headExtras: (P, rand) => {
      // struppiger brauner Bart
      for (let i = 0; i < 40; i++) {
        const a = (rand() - 0.5) * 2.4;
        const y = -0.03 - rand() * 0.1;
        const r = 0.108 + rand() * 0.01;
        P.sphere(0.024, '#6b4a2d', Math.sin(a) * r * 0.95, y, Math.cos(a) * r - 0.005, 1, 1, 1, 6);
      }
      P.sphere(0.05, '#6b4a2d', 0, -0.12, 0.07, 1, 0.8, 0.8, 8);
    },
    extras: (g, hands) => {
      const P = new Parts();
      // Köcher mit Pfeilen auf dem Rücken
      P.cyl(0.06, 0.055, 0.55, '#6a4326', 0.08, 1.95, -0.2, 0, 0, -0.45);
      for (let i = 0; i < 6; i++) {
        const x = 0.2 + (i % 3) * 0.025;
        const y = 2.22 + Math.floor(i / 3) * 0.02;
        P.cyl(0.005, 0.005, 0.18, '#c9b28a', x, y, -0.2 + (i % 2) * 0.02, 0, 0, -0.45);
        P.cone(0.014, 0.05, i % 2 ? '#c23b2b' : '#f2efe8', x + 0.04, y + 0.08, -0.2 + (i % 2) * 0.02, 0, 0, -0.45);
      }
      // Bogen in der linken Hand
      const h = hands.l;
      const bow = new THREE.TorusGeometry(0.62, 0.016, 6, 28, Math.PI);
      bow.rotateZ(-Math.PI / 2);
      bow.rotateY(-Math.PI / 2);
      bow.scale(1, 1, 0.32);
      bow.translate(h.x, h.y, h.z - 0.2);
      P.add(bow, '#5a3a22');
      P.cyl(0.003, 0.003, 1.24, '#e8e2d2', h.x, h.y, h.z - 0.2);
      g.add(P.build(SKIN_MAT));
    },
  });
  upper.group.position.z = 0.42;

  const horse = new Parts();
  horse.add(new THREE.CapsuleGeometry(0.36, 0.95, 6, 16), WHITE, mat4(0, 1.2, -0.2, Math.PI / 2, 0, 0, 0.88, 1, 1));
  horse.sphere(0.38, WHITE, 0, 1.24, 0.32, 0.88, 1.02, 0.9, 18); // Brust
  horse.sphere(0.38, WHITE, 0, 1.24, -0.78, 0.92, 1, 0.95, 18); // Hinterteil
  horse.limb(v(0, 1.28, 0.42), v(0, 1.52, 0.42), 0.2, WHITE, 14); // Übergang zum Oberkörper
  for (const s of [-1, 1]) {
    const x = s * 0.18;
    // Vorderbeine
    horse.limb(v(x, 1.1, 0.34), v(x, 0.62, 0.4), 0.11, WHITE);
    horse.sphere(0.07, WHITE, x, 0.6, 0.41); // Knie
    horse.limb(v(x, 0.6, 0.4), v(x, 0.13, 0.41), 0.058, WHITE);
    horse.sphere(0.065, WHITE, x, 0.14, 0.42); // Fessel
    horse.cyl(0.058, 0.068, 0.1, hoofC, x, 0.05, 0.43);
    // Hinterbeine mit Sprunggelenk
    horse.limb(v(x, 1.12, -0.76), v(x, 0.68, -0.9), 0.14, WHITE);
    horse.limb(v(x, 0.68, -0.9), v(x, 0.45, -0.97), 0.075, WHITE);
    horse.sphere(0.07, WHITE, x, 0.45, -0.97);
    horse.limb(v(x, 0.45, -0.97), v(x, 0.13, -0.9), 0.056, WHITE);
    horse.sphere(0.065, WHITE, x, 0.14, -0.89);
    horse.cyl(0.058, 0.068, 0.1, hoofC, x, 0.05, -0.9);
  }
  const tail = new Parts();
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.05;
    tail.limb(v(0, 0, 0), v(a, -0.25, -0.2), 0.04, '#e3ddd2', 6);
    tail.limb(v(a, -0.25, -0.2), v(a * 1.8, -0.8, -0.28), 0.03, '#e3ddd2', 6);
  }
  const tailMesh = tail.build(SKIN_MAT);
  tailMesh.position.set(0, 1.42, -1.1);

  const g = new THREE.Group();
  const upperScale = new THREE.Group();
  upperScale.add(upper.group);
  upperScale.scale.setScalar(S);
  upperScale.position.y = -0.2;
  g.add(horse.build(SKIN_MAT), upperScale, tailMesh);
  g.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return { group: g, headPivot: upper.headPivot, tail: tailMesh, topY: (upper.topY) * S - 0.2 };
}

// Kartentisch auf der Veranda des Big House (Mr. D und Chiron spielen Pinochle)
function buildCardTable() {
  const P = new Parts();
  const wood = '#6a4a30';
  P.box(0.95, 0.04, 0.8, '#2f5a3a', 0, 0.74, 0);
  for (const [x, z] of [[-0.42, -0.35], [0.42, -0.35], [-0.42, 0.35], [0.42, 0.35]]) P.box(0.04, 0.72, 0.04, wood, x, 0.36, z);
  const r = rng('cards');
  for (let i = 0; i < 9; i++) P.box(0.07, 0.003, 0.1, '#fbf8f0', (r() - 0.5) * 0.4, 0.765, (r() - 0.5) * 0.3, 0, r() * 3, 0);
  P.cyl(0.032, 0.032, 0.12, '#c9ccd2', 0.33, 0.82, -0.25);
  // Stuhl von Mr. D
  P.box(0.5, 0.05, 0.5, wood, 0, 0.45, -0.72);
  P.box(0.5, 0.55, 0.05, wood, 0, 0.72, -0.96);
  for (const [x, z] of [[-0.22, -0.5], [0.22, -0.5], [-0.22, -0.94], [0.22, -0.94]]) P.box(0.04, 0.45, 0.04, wood, x, 0.22, z);
  return P.build(SKIN_MAT);
}

function makeLabel(text) {
  const tex = canvasTex(512, 128, (g, w, h) => {
    g.font = 'bold 54px Georgia, serif';
    const tw = g.measureText(text).width;
    const bw = Math.min(w - 8, tw + 56);
    g.fillStyle = 'rgba(27,20,16,0.78)';
    g.beginPath();
    g.roundRect((w - bw) / 2, 18, bw, 88, 44);
    g.fill();
    g.fillStyle = '#f3c865';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, 64);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 }));
  s.scale.set(1.2, 0.3, 1);
  s.renderOrder = 10;
  return s;
}

// ---------------------------------------------------------------------------

export function addCharacters(scene, colliders, obstacles) {
  const list = [];
  for (const f of FIGURES) {
    const built = f.make();
    const p = f.place();
    const x = p.x + (p.dx ?? 0);
    const z = p.z + (p.dz ?? 0);
    const root = new THREE.Group();
    root.add(built.group);
    if (f.height !== 1) built.group.scale.setScalar(f.height / 1.7);
    root.position.set(x, p.y ?? groundAt(x, z), z);
    root.rotation.y = p.faceTo ? Math.atan2(p.faceTo.x - x, p.faceTo.z - z) : p.yaw;
    root.userData.figureId = f.id;
    scene.add(root);

    const label = makeLabel(f.name);
    const scale = f.height !== 1 ? f.height / 1.7 : 1;
    label.position.set(0, built.topY * scale + 0.35, 0);
    root.add(label);

    colliders.addCircle(x, z, f.id === 'chiron' ? 0.9 : 0.35);
    if (f.id === 'chiron') colliders.addCircle(x + Math.sin(root.rotation.y) * -0.8, z + Math.cos(root.rotation.y) * -0.8, 0.6);
    obstacles.push(root);

    list.push({ ...f, root, head: built.headPivot, tail: built.tail, body: built.group, label, phase: Math.random() * 6, headYaw: 0 });
  }

  // Kartentisch zwischen Mr. D und Chiron
  // Tisch steht vor Mr. D, in seiner Blickrichtung
  const mrd = list.find((c) => c.id === 'mrd').root;
  const yaw = mrd.rotation.y;
  const table = buildCardTable();
  table.position.set(mrd.position.x + Math.sin(yaw) * 0.72, mrd.position.y, mrd.position.z + Math.cos(yaw) * 0.72);
  table.rotation.y = yaw;
  scene.add(table);
  obstacles.push(table);
  colliders.addBox(mrd.position.x + Math.sin(yaw) * 0.42, mrd.position.z + Math.cos(yaw) * 0.42, 0.55, 0.85, yaw);

  return new CharacterSet(list);
}

class CharacterSet {
  constructor(list) {
    this.list = list;
    this.tmp = new THREE.Vector3();
  }

  update(t, dt, camera) {
    for (const c of this.list) {
      // Atmen
      c.body.position.y = Math.sin(t * 1.8 + c.phase) * 0.004;
      // Kopf dreht sich zum Besucher, wenn er in der Nähe ist
      const local = c.root.worldToLocal(this.tmp.copy(camera.position));
      const dist = Math.hypot(local.x, local.z);
      let target = Math.sin(t * 0.3 + c.phase) * 0.25;
      if (dist < 9) target = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1);
      c.headYaw += (target - c.headYaw) * Math.min(1, dt * 3);
      c.head.rotation.y = c.headYaw;
      if (c.tail) {
        c.tail.rotation.z = Math.sin(t * 1.3 + c.phase) * 0.18;
        c.tail.rotation.x = 0.15 + Math.sin(t * 0.7) * 0.05;
      }
      // Namensschild nur in der Nähe zeigen
      const want = dist > 2.8 && dist < 12 ? 1 : 0;
      const m = c.label.material;
      m.opacity += (want - m.opacity) * Math.min(1, dt * 4);
      c.label.visible = m.opacity > 0.02;
    }
  }
}
