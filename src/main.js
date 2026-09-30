import * as THREE from 'three';
import { buildWorld } from './world.js';
import { WalkControls } from './controls.js';
import { heightAt, LAYOUT } from './terrain.js';

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

const loadingEl = document.getElementById('loading');
const barEl = document.getElementById('bar-fill');
const percentEl = document.getElementById('percent');

function setProgress(p) {
  const v = Math.round(Math.min(Math.max(p, 0), 1) * 100);
  barEl.style.width = v + '%';
  percentEl.textContent = v + ' %';
}

if (!hasWebGL()) {
  loadingEl.hidden = true;
  document.getElementById('fallback').hidden = false;
} else {
  start().catch((err) => {
    console.error(err);
    loadingEl.hidden = true;
    const fb = document.getElementById('fallback');
    fb.querySelector('p').textContent = 'Beim Laden ist ein Fehler aufgetreten. Bitte lade die Seite neu.';
    fb.hidden = false;
  });
}

async function start() {
  // Alles, was später geladen wird (Texturen, Modelle), meldet hier seinen Fortschritt.
  const manager = THREE.DefaultLoadingManager;
  manager.onProgress = (_url, loaded, total) => setProgress(loaded / total);

  const renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.6;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Die Szene steht still: Schatten nur einmal berechnen (spart viel Leistung)
  renderer.shadowMap.autoUpdate = false;
  document.getElementById('app').appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);

  setProgress(0.3);
  const world = buildWorld(renderer);
  const { scene } = world;
  setProgress(0.7);

  const controls = new WalkControls(camera, renderer.domElement, {
    ground: world.ground,
    obstacles: world.obstacles,
    colliders: world.colliders,
    heightAt,
  });
  scene.add(controls.marker);
  // Start auf dem Half-Blood Hill, Blick hinunter aufs Camp (nach Süden)
  controls.setView(LAYOUT.hill.x, LAYOUT.hill.z + 4, Math.PI, -0.12);

  // Shader vorab übersetzen, damit es beim ersten Bild nicht ruckelt
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  setProgress(1);

  // Größe beim Drehen / Ändern des Fensters anpassen
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 65; // im Hochformat etwas mehr Übersicht
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = clock.getDelta();
    controls.update(dt);
    renderer.render(scene, camera);
  });

  // Startknopf mit Anleitung
  document.getElementById('start-area').hidden = false;
  document.getElementById('start-btn').addEventListener('click', () => {
    controls.enabled = true;
    loadingEl.classList.add('fade');
    setTimeout(() => (loadingEl.hidden = true), 700);
  });

  // zum Ausprobieren in der Browser-Konsole
  window.__camp = { scene, camera, controls, renderer };
}
