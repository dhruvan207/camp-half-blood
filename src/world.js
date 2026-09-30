import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createTerrain, heightAt, LAYOUT } from './terrain.js';
import { Colliders } from './colliders.js';

// Sonne: später Nachmittag, tief im Südwesten
const SUN_ELEVATION = 16; // Grad über dem Horizont
const SUN_AZIMUTH = 235; // Grad
const FOG_COLOR = new THREE.Color('#d8c9a8');

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 45, 180);

  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - SUN_ELEVATION),
    THREE.MathUtils.degToRad(SUN_AZIMUTH),
  );

  // --- Himmel ---
  const sky = new Sky();
  sky.scale.setScalar(900);
  const u = sky.material.uniforms;
  u.turbidity.value = 7;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  u.sunPosition.value.copy(sunDir);
  scene.add(sky);

  // Umgebungslicht aus dem Himmel berechnen
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(900);
  envSky.material = sky.material;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();

  // --- Sonne mit Schatten ---
  const sun = new THREE.DirectionalLight('#ffd7a3', 2.6);
  sun.position.copy(sunDir).multiplyScalar(60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const s = sun.shadow.camera;
  s.left = -48;
  s.right = 48;
  s.top = 48;
  s.bottom = -48;
  s.near = 1;
  s.far = 160;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#bcd3ff', '#5a4a2a', 0.35);
  scene.add(hemi);

  // --- Boden ---
  const ground = createTerrain();
  scene.add(ground);

  const colliders = new Colliders(LAYOUT.walkLimit);
  const obstacles = [];

  // --- Kiefer auf dem Half-Blood Hill (Startpunkt) ---
  const pine = createPine();
  const pineX = LAYOUT.hill.x + 2.5;
  const pineZ = LAYOUT.hill.z - 1.5;
  pine.position.set(pineX, heightAt(pineX, pineZ) - 0.1, pineZ);
  scene.add(pine);
  obstacles.push(pine);
  colliders.addCircle(pineX, pineZ, 0.7);

  // --- Testfelsen (werden in Etappe 2 durch Gebäude ersetzt) ---
  const rockMat = new THREE.MeshStandardMaterial({ color: '#8a8378', roughness: 0.9 });
  const rocks = [
    [-6, 2, 1.2],
    [7, 10, 0.9],
    [-10, 14, 1.5],
  ];
  for (const [x, z, r] of rocks) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMat);
    rock.position.set(x, heightAt(x, z) + r * 0.4, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = rock.receiveShadow = true;
    scene.add(rock);
    obstacles.push(rock);
    colliders.addCircle(x, z, r * 0.9);
  }

  return { scene, sun, ground, colliders, obstacles };
}

function createPine() {
  const g = new THREE.Group();
  const bark = new THREE.MeshStandardMaterial({ color: '#5b3f2a', roughness: 1 });
  const needles = new THREE.MeshStandardMaterial({ color: '#2f4a2a', roughness: 0.9 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.45, 7, 8), bark);
  trunk.position.y = 3.5;
  g.add(trunk);

  const layers = [
    [3.2, 3.4, 3.2],
    [2.6, 3.0, 5.0],
    [1.9, 2.6, 6.6],
    [1.1, 2.0, 8.0],
  ];
  for (const [r, h, y] of layers) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), needles);
    cone.position.y = y;
    g.add(cone);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}
