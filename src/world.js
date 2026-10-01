import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createTerrain, LAYOUT, PLATFORMS } from './terrain.js';
import { Colliders } from './colliders.js';
import { addCharacters } from './characters.js';
import { buildCamp } from './buildings.js';
import { buildCabins } from './cabins.js';
import { buildNature } from './nature.js';
import { buildWater } from './water.js';
import { Fire, Smoke } from './fire.js';
import { materials } from './kit.js';

// Sonne: später Nachmittag, tief im Südwesten (über dem Meer)
const SUN_ELEVATION = 20; // Grad über dem Horizont
const SUN_AZIMUTH = 215; // Grad
const FOG_COLOR = new THREE.Color('#e3d6b8');

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 80, 260);

  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - SUN_ELEVATION),
    THREE.MathUtils.degToRad(SUN_AZIMUTH),
  );

  // --- Himmel ---
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = 5;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // Umgebungslicht aus dem Himmel berechnen (Spiegelungen auf Gold, Silber, Wasser)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(900);
  envSky.material = sky.material;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
  scene.environmentIntensity = 0.85;
  pmrem.dispose();

  // --- Sonne mit Schatten über dem ganzen Camp ---
  const center = new THREE.Vector3(-3, 0, -1);
  const sun = new THREE.DirectionalLight('#ffe0b5', 3.2);
  sun.position.copy(sunDir).multiplyScalar(90).add(center);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -56;
  s.right = 56;
  s.top = 56;
  s.bottom = -56;
  s.near = 1;
  s.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  scene.add(new THREE.HemisphereLight('#c4d8ff', '#7a6a4a', 0.55));

  // --- Boden, Wasser ---
  const terrain = createTerrain();
  scene.add(terrain.group);
  const water = buildWater();
  scene.add(water.group);

  // --- Kollisionen ---
  const onPlatform = (x, z) => PLATFORMS.some((p) => x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ);
  const colliders = new Colliders(LAYOUT.bounds, onPlatform);
  const L = LAYOUT.lake;
  colliders.addWater(L.x, L.z, L.rx * 0.98, L.rz * 0.96);
  colliders.addPolyline(LAYOUT.creek, 1.3);

  // --- Gebäude und Hütten ---
  const camp = buildCamp(colliders);
  scene.add(camp.group);
  const cabins = buildCabins(colliders);
  scene.add(cabins.group);
  const obstacles = [camp.group, cabins.group];

  // --- Natur (nach den Gebäuden, damit keine Bäume in Häusern wachsen) ---
  const nature = buildNature(colliders);
  scene.add(nature);

  // --- Feuer, Rauch, Wildschweinkopf ---
  const animated = [];
  for (const f of camp.fires) {
    const fire = new Fire(f);
    scene.add(fire.object);
    animated.push(fire);
  }
  let boar = null;
  let holo = null;
  for (const e of cabins.extras) {
    const pos = new THREE.Vector3().setFromMatrixPosition(e.matrix);
    if (e.type === 'smoke') {
      const smoke = new Smoke(pos);
      scene.add(smoke.object);
      animated.push(smoke);
    } else if (e.type === 'hologram') {
      // Tür-Mitte und Blickrichtung der Tür merken
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(e.matrix);
      holo = { pos, normal, mat: materials().hologram };
    } else if (e.type === 'boar') {
      // Halter mit Ausrichtung der Hütte, darin dreht sich der Kopf
      const holder = new THREE.Group();
      holder.applyMatrix4(e.matrix);
      holder.add(e.object);
      scene.add(holder);
      boar = e.object;
    }
  }

  // --- Figuren ---
  const characters = addCharacters(scene, colliders, obstacles);

  const tmp = new THREE.Vector3();
  function update(t, dt, camera) {
    water.update(t);
    for (const a of animated) a.update(t, dt);
    characters.update(t, dt, camera);
    if (holo) {
      // Blitze zucken über die Bronzetür, je nachdem, aus welchem Winkel man schaut
      tmp.copy(camera.position).sub(holo.pos);
      const dist = tmp.length();
      const side = Math.atan2(tmp.x * holo.normal.z - tmp.z * holo.normal.x, tmp.x * holo.normal.x + tmp.z * holo.normal.z);
      const flash = Math.pow(Math.abs(Math.sin(side * 7 + t * 0.6)), 6);
      const flicker = 0.75 + 0.25 * Math.sin(t * 23) * Math.sin(t * 7.3);
      holo.mat.opacity = (0.12 + 0.88 * flash) * flicker * (dist < 40 ? 1 : 0.4);
    }
    if (boar) {
      // die Augen des Wildschweins folgen dir
      const local = boar.parent.worldToLocal(tmp.copy(camera.position));
      const target = local.z > 0 && local.length() < 25 ? THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.7, 0.7) : 0;
      boar.rotation.y += (target - boar.rotation.y) * Math.min(1, dt * 2);
    }
  }

  return { scene, sun, ground: terrain.group, colliders, obstacles, characters, update };
}
