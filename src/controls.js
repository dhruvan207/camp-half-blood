import * as THREE from 'three';

const EYE_HEIGHT = 1.7;
const TAP_THRESHOLD = 10; // Pixel: darunter = Tipp, darüber = Wischen
const MAX_SPEED = 4.5; // Meter pro Sekunde
const PITCH_MIN = -1.0;
const PITCH_MAX = 0.6;

// Touch-first Steuerung: Joystick oder Tippen = laufen, Wischen = umschauen.
// Funktioniert gleich mit der Maus (Klicken / Ziehen). Am Computer zusätzlich WASD/Pfeiltasten.
export class WalkControls {
  constructor(camera, dom, { ground, obstacles = [], colliders, heightAt }) {
    this.camera = camera;
    this.dom = dom;
    this.ground = ground;
    this.obstacles = obstacles; // Meshes, die einen Tipp "abfangen" (z. B. Hütten)
    this.interactables = []; // Meshes der Infopunkte
    this.onInteract = null;
    this.colliders = colliders;
    this.heightAt = heightAt;
    this.enabled = false;

    this.yaw = 0;
    this.pitch = 0;
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
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
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
    this.yaw = yaw;
    this.pitch = pitch;
    this.target = null;
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
      this.yaw += dx * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sens, PITCH_MIN, PITCH_MAX);
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

    // 2) Boden (oder ein Gebäude davor)
    const hit = this.raycaster.intersectObjects([this.ground, ...this.obstacles], true)[0];
    if (!hit) return;
    this.walkTo(hit.point.x, hit.point.z);
    this.showMarker(hit.point.x, hit.point.z);
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

  tryMove(dx, dz) {
    const c = this.colliders;
    const nx = this.pos.x + dx;
    const nz = this.pos.y + dz;
    if (!c.blocked(nx, nz)) {
      this.pos.set(nx, nz);
      return true;
    }
    // an Hindernissen entlang gleiten
    if (Math.abs(dx) > 1e-4 && !c.blocked(nx, this.pos.y)) {
      this.pos.x = nx;
      return true;
    }
    if (Math.abs(dz) > 1e-4 && !c.blocked(this.pos.x, nz)) {
      this.pos.y = nz;
      return true;
    }
    return false;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    let moving = false;

    if (this.enabled) {
      // Tastatur (Computer)
      const k = this.keys;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const turn = (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0);
      if (turn) this.yaw += turn * 1.8 * dt;
      if (f) {
        this.target = null;
        this.onArrive = null;
        const s = f * MAX_SPEED * dt;
        this.tryMove(-Math.sin(this.yaw) * s, -Math.cos(this.yaw) * s);
        moving = true;
      }

      // Joystick: nach vorne/hinten und seitwärts, relativ zur Blickrichtung
      const j = this.joystick;
      const fx = -Math.sin(this.yaw);
      const fz = -Math.cos(this.yaw);
      const rx = Math.cos(this.yaw);
      const rz = -Math.sin(this.yaw);
      let wantX = 0;
      let wantZ = 0;
      if (j && j.active) {
        this.target = null;
        this.onArrive = null;
        const fwd = -j.y;
        const side = j.x;
        wantX = (fx * fwd + rx * side) * MAX_SPEED;
        wantZ = (fz * fwd + rz * side) * MAX_SPEED;
      }
      // weich beschleunigen und abbremsen
      const a = Math.min(1, dt * (j && j.active ? 8 : 16)); // beim Loslassen schneller stehen bleiben
      this.stickVel.x += (wantX - this.stickVel.x) * a;
      this.stickVel.y += (wantZ - this.stickVel.y) * a;
      if (this.stickVel.lengthSq() > 0.0004) {
        if (!this.tryMove(this.stickVel.x * dt, this.stickVel.y * dt)) this.stickVel.set(0, 0);
        moving = true;
      }
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

    if (moving) this.bob += dt * 9;
    else this.bob *= 0.9;

    // Markierung ausblenden
    const m = this.marker.material;
    if (m.opacity > 0) {
      m.opacity = Math.max(0, m.opacity - dt * 1.2);
      this.marker.scale.setScalar(this.marker.scale.x + dt * 0.8);
    }

    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const y = this.heightAt(this.pos.x, this.pos.y) + EYE_HEIGHT + Math.sin(this.bob) * 0.03;
    const cam = this.camera;
    if (dt === 0) cam.position.y = y;
    else cam.position.y += (y - cam.position.y) * Math.min(1, dt * 10);
    cam.position.x = this.pos.x;
    cam.position.z = this.pos.y;
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
