import * as THREE from 'three';
import { buildWorld } from './world.js';
import { WalkControls } from './controls.js';
import { groundAt, LAYOUT } from './terrain.js';

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
  manager.onProgress = (_url, loaded, total) => setProgress(0.2 + 0.6 * (loaded / total));
  const assetsLoaded = new Promise((resolve) => (manager.onLoad = resolve));

  const renderer = new THREE.WebGLRenderer({
    antialias: window.devicePixelRatio < 2,
    powerPreference: 'high-performance',
  });
  // Schärfe: so hoch wie möglich (max. 2), wird automatisch gesenkt, falls es ruckelt
  const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio, 2);
  let pixelRatio = MAX_PIXEL_RATIO;
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  // „Neutral“ behält die Farben kräftig (ACES hat Haut und Kleidung ausgewaschen)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.55;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Die Szene steht still: Schatten nur einmal berechnen (spart viel Leistung)
  renderer.shadowMap.autoUpdate = false;
  document.getElementById('app').appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1200);

  setProgress(0.1);
  const world = buildWorld(renderer);
  const { scene } = world;
  await assetsLoaded;
  setProgress(0.85);

  const controls = new WalkControls(camera, renderer.domElement, {
    ground: world.ground,
    obstacles: world.obstacles,
    colliders: world.colliders,
    heightAt: groundAt,
  });
  scene.add(controls.marker);
  // Start auf dem Half-Blood Hill, Blick hinunter aufs Camp (nach Süden)
  const look = LAYOUT.campfire;
  controls.setView(LAYOUT.start.x, LAYOUT.start.z, Math.atan2(LAYOUT.start.x - look.x, LAYOUT.start.z - look.z), -0.17);

  // Shader vorab übersetzen, damit es beim ersten Bild nicht ruckelt
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
  setProgress(1);

  // Größe beim Drehen / Ändern des Fensters anpassen
  const appEl = document.getElementById('app');
  function resize() {
    const w = appEl.clientWidth || window.innerWidth;
    const h = appEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.fov = w < h ? 75 : 65; // im Hochformat etwas mehr Übersicht
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false); // Anzeigegröße regelt das CSS (100 %)
  }
  new ResizeObserver(resize).observe(appEl);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  resize();

  // Bildrate messen und bei Bedarf die Auflösung senken
  let frames = 0;
  let acc = 0;
  let warmup = 1.5;
  function adaptQuality(dt) {
    if (warmup > 0) return void (warmup -= dt);
    frames++;
    acc += dt;
    if (acc < 2) return;
    const fps = frames / acc;
    frames = 0;
    acc = 0;
    if (fps < 42 && pixelRatio > 1) {
      pixelRatio = Math.max(1, pixelRatio - 0.25);
      renderer.setPixelRatio(pixelRatio);
      resize();
    }
  }

  const clock = new THREE.Clock();
  let time = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    time += dt;
    controls.update(dt);
    world.update(time, dt, camera);
    renderer.render(scene, camera);
    adaptQuality(dt);
  });

  // Startknopf mit Anleitung
  document.getElementById('start-area').hidden = false;
  document.getElementById('start-btn').addEventListener('click', () => {
    controls.enabled = true;
    loadingEl.classList.add('fade');
    setTimeout(() => (loadingEl.hidden = true), 700);
  });

  // zum Ausprobieren in der Browser-Konsole
  window.__camp = { scene, camera, controls, renderer, world, getPixelRatio: () => pixelRatio };
  if (import.meta.env.DEV) {
    // Test-Hilfe: look('percy') stellt die Kamera vor eine Figur
    window.look = (id, dist = 2, side = 0, pitch = -0.1) => {
      const r = world.characters.list.find((c) => c.id === id).root;
      const a = r.rotation.y + side;
      const x = r.position.x + Math.sin(a) * dist;
      const z = r.position.z + Math.cos(a) * dist;
      controls.enabled = true;
      loadingEl.hidden = true;
      controls.setView(x, z, Math.atan2(x - r.position.x, z - r.position.z), pitch);
    };
    // Test-Hilfe: goto(x, z, blickX, blickZ) stellt die Kamera an eine Stelle und schaut zu einem Punkt
    window.goto = (x, z, tx, tz, pitch = -0.1) => {
      controls.enabled = true;
      loadingEl.hidden = true;
      controls.setView(x, z, Math.atan2(x - tx, z - tz), pitch);
    };
  }
}
