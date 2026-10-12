import * as THREE from 'three';

const EYE_HEIGHT = 1.7;
const TAP_THRESHOLD = 10; // Pixel: darunter = Tipp, darüber = Wischen
const MAX_SPEED = 4.5; // Meter pro Sekunde
const PITCH_MIN = -1.0;
const PITCH_MAX = 0.6;

// Touch-first Steuerung: Joystick = laufen, Wischen = umschauen, Tippen = Infobox öffnen.
// Funktioniert gleich mit der Maus (Klicken / Ziehen). Am Computer zusätzlich WASD/Pfeiltasten.
// Alles wird weich geglättet, damit sich Laufen und Umschauen ruhig anfühlen.
export class WalkControls {
  constructor(camera, dom, { ground, obstacles = [], colliders, heightAt }) {
    this.camera = camera;
    this.dom = dom;
    this.ground = ground;
    this.obstacles = obstacles; // Meshes, die einen Tipp "abfangen" (z. B. Hütten)
    this.interactables = []; // Meshes der Infopunkte
    this.onInteract = null;
    this.tapTargets = []; // zusätzliche antippbare Dinge (Namensschilder, See, Kiefer …)
    this.onTapHit = null; // (hit) => true, wenn der Tipp verarbeitet wurde
    this.colliders = colliders;
    this.heightAt = heightAt;
    this.enabled = false;

    this.yaw = 0;
    this.pitch = 0;
    this.yawTarget = 0; // Ziel-Blickrichtung (Wischen setzt das Ziel, die Kamera gleitet hinterher)
    this.pitchTarget = 0;
    this.bobAmp = 0;
    this.pos = new THREE.Vector2(camera.position.x, camera.position.z);
    this.vel = 0;
    this.target = null;
    this.onArrive = null;
    this.bob = 0;
    this.keys = new Set();
    this.joystick = null; // wird in main.js gesetzt
    this.stickVel = new THREE.Vector2();

    this.pointer = null; // aktiver Finger / Maus
    this.pointerCount = 0;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();

    this.marker = this.createMarker();

    dom.addEventListener('pointerdown', (e) => this.onDown(e));
    dom.addEventListener('pointermove', (e) => this.onMove(e));
    dom.addEventListener('pointerup', (e) => this.onUp(e));
    dom.addEventListener('pointercancel', (e) => this.onCancel(e));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    // iOS: Pinch-Zoom der Seite verhindern
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      // beim Tippen in ein Textfeld nicht laufen
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  createMarker() {
    const geo = new THREE.RingGeometry(0.35, 0.5, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.renderOrder = 5;
    return m;
  }

  setView(x, z, yaw, pitch = 0) {
    this.pos.set(x, z);
    this.yaw = this.yawTarget = yaw;
    this.pitch = this.pitchTarget = pitch;
    this.target = null;
    this.stickVel.set(0, 0);
    this.applyCamera(0);
  }

  // --- Eingabe ---------------------------------------------------------

  onDown(e) {
    this.pointerCount++;
    if (!this.enabled) return;
    if (this.pointer) {
      // zweiter Finger: Wischen abbrechen, nichts zoomen
      this.pointer.multi = true;
      return;
    }
    try {
      this.dom.setPointerCapture(e.pointerId);
    } catch {
      // nicht schlimm
    }
    this.pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dragging: false, multi: false };
  }

  onMove(e) {
    const p = this.pointer;
    if (!p || p.id !== e.pointerId || p.multi) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!p.dragging && Math.hypot(p.x - p.x0, p.y - p.y0) > TAP_THRESHOLD) p.dragging = true;
    if (p.dragging) {
      const sens = (Math.PI * 1.1) / Math.max(this.dom.clientWidth, 320);
      this.yawTarget += dx * sens;
      this.pitchTarget = THREE.MathUtils.clamp(this.pitchTarget + dy * sens, PITCH_MIN, PITCH_MAX);
    }
  }

  onUp(e) {
    this.pointerCount = Math.max(0, this.pointerCount - 1);
    const p = this.pointer;
    if (!p || p.id !== e.pointerId) return;
    this.pointer = null;
    if (!p.dragging && !p.multi && e.button <= 0) this.tap(e.clientX, e.clientY);
  }

  onCancel(e) {
    this.pointerCount = Math.max(0, this.pointerCount - 1);
    if (this.pointer && this.pointer.id === e.pointerId) this.pointer = null;
  }

  tap(cx, cy) {
    const rect = this.dom.getBoundingClientRect();
    this.ndc.set(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);

    // 1) Infopunkt getroffen?
    if (this.interactables.length) {
      const hit = this.raycaster.intersectObjects(this.interactables, true)[0];
      if (hit && hit.distance < 60) {
        let obj = hit.object;
        while (obj && !obj.userData.infoId) obj = obj.parent;
        if (obj && this.onInteract) {
          this.onInteract(obj);
          return;
        }
      }
    }

    // 2) Boden, Gebäude, Figuren und Namensschilder
    const hits = this.raycaster.intersectObjects([this.ground, ...this.obstacles, ...this.tapTargets], true);
    // unsichtbare (ausgeblendete) Namensschilder ignorieren
    const hit = hits.find((h) => !(h.object.isSprite && (!h.object.visible || h.object.material.opacity < 0.3)));
    if (!hit) return;
    // Figur, Haus oder Schild angetippt? Dann öffnet sich die Infobox.
    // (Laufen geht nur noch mit dem Joystick, ein Tipp auf den Boden macht nichts.)
    this.onTapHit?.(hit);
  }

  showMarker(x, z) {
    this.marker.position.set(x, this.heightAt(x, z) + 0.05, z);
    this.marker.material.opacity = 0.9;
    this.marker.scale.setScalar(0.6);
  }

  // Läuft zu (x, z). onArrive wird aufgerufen, wenn das Ziel erreicht ist oder der Weg blockiert ist.
  walkTo(x, z, onArrive = null) {
    this.target = new THREE.Vector2(x, z);
    this.onArrive = onArrive;
  }

  stop() {
    this.target = null;
    this.vel = 0;
    const cb = this.onArrive;
    this.onArrive = null;
    if (cb) cb();
  }

  // --- Bewegung --------------------------------------------------------

  // Bewegt um (dx, dz). Gibt zurück: 'ok', 'x' / 'z' (nur entlang einer Achse geglitten) oder false.
  tryMove(dx, dz) {
    const c = this.colliders;
    const nx = this.pos.x + dx;
    const nz = this.pos.y + dz;
    if (!c.blocked(nx, nz)) {
      this.pos.set(nx, nz);
      return 'ok';
    }
    // an Hindernissen entlang gleiten
    if (Math.abs(dx) > 1e-4 && !c.blocked(nx, this.pos.y)) {
      this.pos.x = nx;
      return 'x';
    }
    if (Math.abs(dz) > 1e-4 && !c.blocked(this.pos.x, nz)) {
      this.pos.y = nz;
      return 'z';
    }
    return false;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    let moving = false;

    // Blick weich nachführen (Wischen setzt nur das Ziel)
    const lookK = 1 - Math.exp(-dt * 20);
    let fwd = 0;
    let side = 0;
    let input = false;

    if (this.enabled) {
      // Tastatur (Computer)
      const k = this.keys;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const turn = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0);
      if (turn) this.yawTarget += turn * 1.8 * dt;
      if (f) {
        fwd = f;
        input = true;
      }
      // Joystick: nach vorne/hinten und seitwärts, relativ zur Blickrichtung.
      // Leicht drücken = langsam gehen, ganz drücken = laufen (feinere Kontrolle bei wenig Ausschlag).
      const j = this.joystick;
      if (j && j.active) {
        const mag = Math.min(1, Math.hypot(j.x, j.y));
        const shaped = Math.pow(mag, 1.4) / (mag || 1);
        fwd = -j.y * shaped;
        side = j.x * shaped;
        input = true;
      }
    }

    this.yaw += (this.yawTarget - this.yaw) * lookK;
    this.pitch += (this.pitchTarget - this.pitch) * lookK;

    if (input) {
      this.target = null;
      this.onArrive = null;
    }
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    const wantX = (fx * fwd + rx * side) * MAX_SPEED;
    const wantZ = (fz * fwd + rz * side) * MAX_SPEED;
    // weich beschleunigen (ca. 0,25 s) und abbremsen (ca. 0,15 s), unabhängig von der Bildrate
    const velK = 1 - Math.exp(-dt / (input ? 0.25 : 0.15));
    this.stickVel.x += (wantX - this.stickVel.x) * velK;
    this.stickVel.y += (wantZ - this.stickVel.y) * velK;
    if (this.stickVel.lengthSq() > 0.0004) {
      const r = this.tryMove(this.stickVel.x * dt, this.stickVel.y * dt);
      // an Wänden entlanggleiten statt hart stehen zu bleiben
      if (r === 'x') this.stickVel.y *= 0.6;
      else if (r === 'z') this.stickVel.x *= 0.6;
      else if (!r) this.stickVel.multiplyScalar(0.5);
      moving = !!r;
    } else {
      this.stickVel.set(0, 0);
    }

    if (this.target) {
      const dx = this.target.x - this.pos.x;
      const dz = this.target.y - this.pos.y;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.08) {
        this.stop();
      } else {
        // sanft anfahren und abbremsen
        const desired = Math.min(MAX_SPEED, dist * 2.2 + 0.3);
        this.vel += (desired - this.vel) * Math.min(1, dt * 5);
        const step = Math.min(dist, this.vel * dt);
        if (this.tryMove((dx / dist) * step, (dz / dist) * step)) {
          moving = true;
        } else {
          this.stop();
        }
      }
    }

    // leichtes Wippen beim Gehen: Stärke und Takt hängen vom Tempo ab und klingen weich aus
    const speed = this.stickVel.length() + (this.target ? this.vel : 0);
    const ampK = 1 - Math.exp(-dt * 6);
    this.bobAmp += ((moving ? Math.min(1, speed / MAX_SPEED) * 0.022 : 0) - this.bobAmp) * ampK;
    this.bob += dt * (5 + speed * 1.3);

    // Markierung ausblenden
    const m = this.marker.material;
    if (m.opacity > 0) {
      m.opacity = Math.max(0, m.opacity - dt * 1.2);
      this.marker.scale.setScalar(this.marker.scale.x + dt * 0.8);
    }

    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const y = this.heightAt(this.pos.x, this.pos.y) + EYE_HEIGHT + Math.sin(this.bob) * this.bobAmp;
    const cam = this.camera;
    if (dt === 0) cam.position.y = y;
    else cam.position.y += (y - cam.position.y) * (1 - Math.exp(-dt * 12));
    cam.position.x = this.pos.x;
    cam.position.z = this.pos.y;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
