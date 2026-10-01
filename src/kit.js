import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Baukasten für Gebäude: Viele einfache Formen werden pro Material zu EINEM Mesh
// zusammengefügt. So bleibt das Camp auch mit tausenden Einzelteilen flüssig.

const BASE = import.meta.env.BASE_URL;
const loader = new THREE.TextureLoader();
const texCache = {};

export function loadTex(file, { srgb = true, tile = 1 } = {}) {
  const key = file + '|' + tile;
  if (!texCache[key]) {
    const t = loader.load(BASE + 'textures/' + file);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / tile, 1 / tile);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    texCache[key] = t;
  }
  return texCache[key];
}

export function canvasTexture(w, h, draw, { srgb = true, repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function rng(seedText) {
  let s = 0;
  for (const ch of String(seedText)) s = (s * 31 + ch.charCodeAt(0)) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weißer Marmor mit grauen Adern (selbst gezeichnet)
function marbleTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng('marble');
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${200 + r() * 40},${196 + r() * 40},${190 + r() * 40},0.25)`;
      g.beginPath();
      g.arc(r() * w, r() * h, 10 + r() * 50, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 16; i++) {
      g.strokeStyle = `rgba(120,118,115,${0.15 + r() * 0.25})`;
      g.lineWidth = 0.6 + r() * 1.6;
      g.beginPath();
      let x = r() * w;
      let y = 0;
      g.moveTo(x, y);
      while (y < h) {
        x += (r() - 0.5) * 40;
        y += 10 + r() * 25;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
}

// Farbe wie mit Eimern und Fäusten draufgeklatscht (Ares)
function splashPaintTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    const r = rng('ares');
    g.fillStyle = '#d8d0cc';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i++) {
      const x = r() * w;
      const y = r() * h;
      const s = 8 + r() * 60;
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.55)' : 'rgba(120,100,100,0.35)';
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const rr = s * (0.4 + r() * 0.8);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      g.fill();
      // Tropfspuren
      if (r() < 0.3) {
        g.fillRect(x - 2, y, 4 + r() * 3, 20 + r() * 60);
      }
    }
  });
}

// Kleine Wasser-Normalmap (Rauschen), für See, Bach und Meer
export function waterNormalTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = rng('water');
  const hgt = new Float32Array(size * size);
  const waves = Array.from({ length: 14 }, () => ({
    kx: Math.round((r() - 0.5) * 16),
    ky: Math.round((r() - 0.5) * 16),
    p: r() * Math.PI * 2,
    a: 0.4 + r(),
  }));
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0;
      for (const w of waves) v += Math.sin(((x * w.kx + y * w.ky) / size) * Math.PI * 2 + w.p) * w.a;
      hgt[y * size + x] = v;
    }
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const hx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x + size - 1) % size)];
      const hy = hgt[((y + 1) % size) * size + x] - hgt[((y + size - 1) % size) * size + x];
      const n = new THREE.Vector3(-hx * 0.35, -hy * 0.35, 1).normalize();
      const i = (y * size + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// --- Materialien -----------------------------------------------------------
let MATS = null;
export function materials() {
  if (MATS) return MATS;
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, ...o });
  const tex = (f, tile, nor) => ({
    map: loadTex(f + '_diff.jpg', { tile }),
    ...(nor ? { normalMap: loadTex(f + '_nor.jpg', { tile, srgb: false }) } : {}),
  });
  const marble = marbleTexture();
  marble.repeat.set(1 / 3, 1 / 3);
  const splash = splashPaintTexture();
  splash.repeat.set(1 / 3, 1 / 3);
  const grass = loadTex('grass_diff.jpg', { tile: 1.5 });

  MATS = {
    plain: std({}),
    glossy: std({ roughness: 0.35, side: THREE.DoubleSide }), // beidseitig: Kanus sieht man auch innen
    wood: std({ ...tex('planks', 2.2, true), roughness: 0.8 }),
    worn: std({ ...tex('painted_planks', 2.4), roughness: 0.9 }),
    roof: std({ ...tex('roof', 2.5, true), roughness: 0.9 }),
    stone: std({ ...tex('rock', 2.5, true), roughness: 0.95 }),
    coral: std({ ...tex('coral_stone', 1.8, true), roughness: 0.95 }),
    tiles: std({ ...tex('marble', 3), roughness: 0.6 }),
    plaster: std({ ...tex('plaster', 3), roughness: 0.9 }),
    metal: std({ ...tex('metal', 2), metalness: 0.35, roughness: 0.55 }),
    bark: std({ ...tex('bark', 1.5), roughness: 1 }), // Farbe hell lassen, die Textur ist schon braun
    sand: std({ ...tex('sand', 3), roughness: 1 }),
    marble: std({ map: marble, roughness: 0.35 }),
    splash: std({ map: splash, roughness: 0.7 }),
    grassRoof: std({ map: grass, roughness: 1 }),
    gold: std({ metalness: 1, roughness: 0.22 }),
    bronze: std({ metalness: 0.9, roughness: 0.3 }),
    silver: std({ metalness: 0.95, roughness: 0.18, emissive: new THREE.Color('#a9c4ff'), emissiveIntensity: 0.12 }),
    glass: std({ roughness: 0.08, metalness: 0.4 }),
    fleece: std({ color: '#f2b93a', metalness: 0.7, roughness: 0.4, emissive: new THREE.Color('#8a5200'), emissiveIntensity: 0.55 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    leaf: std({ roughness: 0.9, side: THREE.DoubleSide }),
  };
  return MATS;
}

// --- Baukasten ----------------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0);
const tmpN = new THREE.Vector3();

export function mat4(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

// Diese Materialien bekommen keine Boden-Abdunklung (leuchten oder sind Glas)
const NO_AO = new Set(['glow', 'glass', 'numbers', 'fleece']);

export class Kit {
  // ao: Funktion (x, z) => Bodenhöhe. Dann werden Wände zum Boden hin dunkler,
  // wie bei echtem Licht, das unten an der Hauswand weniger hinkommt.
  constructor({ ao = null } = {}) {
    this.buckets = {};
    this.stack = [new THREE.Matrix4()];
    this.ao = ao;
  }

  get M() {
    return this.stack[this.stack.length - 1];
  }

  // Alles innerhalb von fn wird an (x,y,z) mit Drehung ry platziert
  at(x, y, z, ry, fn) {
    this.stack.push(this.M.clone().multiply(mat4(x, y, z, 0, ry)));
    fn();
    this.stack.pop();
  }

  add(geo, bucket, color, local, { keepUV = false } = {}) {
    if (!geo.index) geo.setIndex([...Array(geo.attributes.position.count).keys()]);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.normal) geo.computeVertexNormals();
    const m = local ? this.M.clone().multiply(local) : this.M;
    geo.applyMatrix4(m);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const n = pos.count;
    if (!keepUV || !geo.attributes.uv) {
      // Texturkoordinaten in Metern (Box-Projektion), damit Texturen überall gleich groß sind
      const uv = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        tmpN.fromBufferAttribute(nor, i);
        const ax = Math.abs(tmpN.x);
        const ay = Math.abs(tmpN.y);
        const az = Math.abs(tmpN.z);
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (ay >= ax && ay >= az) uv.set([x, z], i * 2);
        else if (ax >= az) uv.set([z, y], i * 2);
        else uv.set([x, y], i * 2);
      }
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    const ao = this.ao && !NO_AO.has(bucket) ? this.ao : null;
    for (let i = 0; i < n; i++) {
      let k = 1;
      if (ao) {
        const above = pos.getY(i) - ao(pos.getX(i), pos.getZ(i));
        const t = Math.min(Math.max(above / 1.3, 0), 1);
        k = 0.55 + 0.45 * t * t * (3 - 2 * t);
      }
      col.set([c.r * k, c.g * k, c.b * k], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    (this.buckets[bucket] ??= []).push(geo);
    return geo;
  }

  box(bucket, color, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), bucket, color, mat4(x, y, z, rx, ry, rz));
  }
  // Wand-Quader mit mehreren Höhenstufen, damit die Abdunklung zum Boden weich verläuft
  wall(bucket, color, w, h, d, x, y, z, ry = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d, 1, Math.max(2, Math.round(h / 0.5)), 1), bucket, color, mat4(x, y, z, 0, ry));
  }
  cyl(bucket, color, rt, rb, h, x, y, z, seg = 12, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), bucket, color, mat4(x, y, z, rx, ry, rz));
  }
  sphere(bucket, color, r, x, y, z, sx = 1, sy = sx, sz = sx, seg = 10) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(5, Math.round(seg * 0.7))), bucket, color, mat4(x, y, z, 0, 0, 0, sx, sy, sz));
  }
  cone(bucket, color, r, h, x, y, z, seg = 8, rx = 0, ry = 0, rz = 0) {
    return this.add(new THREE.ConeGeometry(r, h, seg), bucket, color, mat4(x, y, z, rx, ry, rz));
  }
  // Stab zwischen zwei Punkten
  limb(bucket, color, a, b, r, seg = 6) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = Math.max(dir.length(), 0.001);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    const m = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.CylinderGeometry(r, r, len, seg, 1), bucket, color, m);
  }
  // Satteldach: Breite w (x), Tiefe d (z), Höhe h, Überstand o
  // trim: Farbe der Zierbretter an Traufe und Giebelkante (wie bei echten Häusern)
  gable(bucket, color, w, d, h, x, y, z, o = 0.4, thick = 0.12, trim = null, trimBucket = 'plain') {
    const hw = w / 2 + o;
    const slope = Math.hypot(hw, h);
    const ang = Math.atan2(h, hw);
    const L = d + o * 2;
    for (const s of [-1, 1]) {
      this.box(bucket, color, slope, thick, L, x + (s * hw) / 2, y + h / 2, z, 0, 0, -s * ang);
      if (trim) {
        // Traufbrett unten an der Dachkante
        this.box(trimBucket, trim, 0.06, 0.22, L, x + s * (hw + 0.02), y - 0.06, z);
        // Ortgangbretter an den Giebelseiten
        for (const e of [-1, 1]) this.box(trimBucket, trim, slope + 0.08, 0.2, 0.06, x + (s * hw) / 2, y + h / 2 - 0.04, z + e * (L / 2 + 0.02), 0, 0, -s * ang);
      }
    }
    // Firstabdeckung
    const ridge = new THREE.Color(color).multiplyScalar(0.8).getStyle();
    this.box(bucket, ridge, 0.32, 0.12, L + 0.04, x, y + h + thick * 0.4, z);
  }
  // Giebeldreieck (Wandstück unter dem Dach)
  gableWall(bucket, color, w, h, x, y, z, ry = 0, depth = 0.2) {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(0, h);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.translate(0, 0, -depth / 2);
    return this.add(geo, bucket, color, mat4(x, y, z, 0, ry));
  }

  build({ castShadow = true } = {}) {
    const mats = materials();
    const group = new THREE.Group();
    for (const [name, geos] of Object.entries(this.buckets)) {
      const merged = mergeGeometries(geos);
      for (const g of geos) g.dispose();
      const mesh = new THREE.Mesh(merged, mats[name] ?? mats.plain);
      mesh.castShadow = castShadow && name !== 'glow';
      mesh.receiveShadow = true;
      mesh.name = 'kit-' + name;
      group.add(mesh);
    }
    this.buckets = {};
    return group;
  }
}
