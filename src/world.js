import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createTerrain, heightAt, LAYOUT } from './terrain.js';
import { Colliders } from './colliders.js';
import { addCharacters } from './characters.js';

// Sonne: später Nachmittag, tief im Südwesten
const SUN_ELEVATION = 20; // Grad über dem Horizont
const SUN_AZIMUTH = 235; // Grad
const FOG_COLOR = new THREE.Color('#e3d6b8');

export function buildWorld(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG_COLOR, 70, 230);

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

  // Umgebungslicht aus dem Himmel berechnen
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(900);
  envSky.material = sky.material;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  // --- Sonne mit Schatten ---
  const sun = new THREE.DirectionalLight('#ffe0b5', 3.2);
  sun.position.copy(sunDir).multiplyScalar(70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = sun.shadow.camera;
  s.left = -42;
  s.right = 42;
  s.top = 42;
  s.bottom = -42;
  s.near = 1;
  s.far = 180;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 2;
  scene.add(sun, sun.target);

  const hemi = new THREE.HemisphereLight('#c4d8ff', '#6a5a3a', 0.3);
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

  // --- Figuren ---
  const characters = addCharacters(scene, colliders, obstacles);

  return { scene, sun, ground, colliders, obstacles, characters };
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
