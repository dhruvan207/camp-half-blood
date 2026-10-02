import * as THREE from 'three';
import { waterNormalTexture } from './kit.js';
import { LAYOUT, baseHeight } from './terrain.js';

// Wasser: Meer (Long Island Sound), Kanusee und Bach. Die Wellen bewegen sich langsam.

export function buildWater() {
  const normal = waterNormalTexture();
  const group = new THREE.Group();
  const animated = [];

  const makeMat = (color, repeat, opacity, rough = 0.1, strength = 0.55) => {
    const n = normal.clone();
    n.needsUpdate = true;
    n.repeat.set(repeat, repeat);
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: rough,
      metalness: 0.15,
      normalMap: n,
      normalScale: new THREE.Vector2(strength, strength),
      transparent: true,
      opacity,
    });
    animated.push(n);
    return m;
  };

  // Meer
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 420), makeMat('#2d6c84', 160, 0.93, 0.1, 0.4));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, LAYOUT.seaLevel, 41 + 210);
  sea.receiveShadow = true;
  group.add(sea);

  // Brandungssaum am Strand
  const foam = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 1.2),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }),
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(0, LAYOUT.seaLevel + 0.02, 41.9);
  group.add(foam);

  // Kanusee
  const L = LAYOUT.lake;
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 64), makeMat('#3f6f66', 16, 0.92, 0.12, 0.28));
  lake.rotation.x = -Math.PI / 2;
  lake.scale.set(L.rx * 1.18, L.rz * 1.13, 1);
  lake.position.set(L.x, L.level, L.z);
  lake.receiveShadow = true;
  lake.userData.placeId = 'kanusee'; // Antippen öffnet die Infobox zum Kanusee
  group.add(lake);

  // Bach: Band entlang einer geglätteten Kurve
  const pts = LAYOUT.creek.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const N = 160;
  const width = 3.0;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = curve.getPoint(t);
    const tan = curve.getTangent(t);
    const nx = -tan.z;
    const nz = tan.x;
    const y = baseHeight(p.x, p.z) - 0.62;
    pos.push(p.x + nx * width * 0.5, y, p.z + nz * width * 0.5, p.x - nx * width * 0.5, y, p.z - nz * width * 0.5);
    uv.push(0, t * 40, 1, t * 40);
    if (i < N) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const creekMat = makeMat('#4b7f7a', 1, 0.88, 0.08);
  creekMat.side = THREE.DoubleSide;
  const creek = new THREE.Mesh(g, creekMat);
  group.add(creek);

  return {
    group,
    lake,
    update(t) {
      animated[0].offset.set(t * 0.004, t * 0.006); // Meer
      animated[1].offset.set(t * 0.01, -t * 0.006); // See
      animated[2].offset.set(0, -t * 0.25); // Bach fließt
      foam.material.opacity = 0.25 + Math.sin(t * 0.8) * 0.12;
      foam.position.z = 41.9 + Math.sin(t * 0.8) * 0.35;
    },
  };
}
