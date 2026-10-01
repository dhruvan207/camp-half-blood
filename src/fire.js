import * as THREE from 'three';
import { canvasTexture } from './kit.js';

// Flammen, Funken und Rauch aus leuchtenden Bildchen (Sprites). Sehr sparsam für Handys.

let flameTex;
let smokeTex;

function flameTexture() {
  flameTex ??= canvasTexture(
    128,
    256,
    (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.72, 4, w / 2, h * 0.62, h * 0.55);
      grd.addColorStop(0, 'rgba(255,250,220,1)');
      grd.addColorStop(0.18, 'rgba(255,214,110,0.95)');
      grd.addColorStop(0.45, 'rgba(255,120,30,0.6)');
      grd.addColorStop(0.75, 'rgba(200,40,10,0.15)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      // Flammenform: unten rund, oben spitz
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.bezierCurveTo(w * 0.95, h * 0.45, w * 1.05, h * 0.95, w / 2, h);
      g.bezierCurveTo(-w * 0.05, h * 0.95, w * 0.05, h * 0.45, w / 2, 0);
      g.fill();
    },
    { repeat: false },
  );
  return flameTex;
}

function smokeTexture() {
  smokeTex ??= canvasTexture(
    128,
    128,
    (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      grd.addColorStop(0, 'rgba(235,235,235,0.55)');
      grd.addColorStop(0.6, 'rgba(200,200,200,0.2)');
      grd.addColorStop(1, 'rgba(200,200,200,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);
    },
    { repeat: false },
  );
  return smokeTex;
}

export class Fire {
  constructor({ x, y, z, scale = 1, light = false, color = '#ff8a3a', intensity = 8, distance = 12, embers = false }) {
    this.object = new THREE.Group();
    this.object.position.set(x, y, z);
    this.scale = scale;
    this.flames = [];
    const n = scale > 0.8 ? 7 : 3;
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: i % 2 ? '#ffd27a' : '#ff9a4a' });
      const s = new THREE.Sprite(m);
      const a = (i / n) * Math.PI * 2;
      const r = i === 0 ? 0 : 0.25 * scale;
      s.userData = { ox: Math.cos(a) * r, oz: Math.sin(a) * r, phase: Math.random() * 10, size: (i === 0 ? 1.1 : 0.75) * scale };
      this.object.add(s);
      this.flames.push(s);
    }
    this.embers = [];
    if (embers) {
      for (let i = 0; i < 14; i++) {
        const m = new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: '#ffb050' });
        const s = new THREE.Sprite(m);
        s.userData = { life: Math.random(), speed: 0.6 + Math.random() * 0.8, dx: (Math.random() - 0.5) * 0.6, dz: (Math.random() - 0.5) * 0.6 };
        s.scale.setScalar(0.06);
        this.object.add(s);
        this.embers.push(s);
      }
    }
    if (light) {
      this.light = new THREE.PointLight(color, intensity, distance, 1.6);
      this.light.position.y = 0.6 * scale;
      this.base = intensity;
      this.object.add(this.light);
    }
  }

  update(t, dt) {
    for (const s of this.flames) {
      const u = s.userData;
      const f = Math.sin(t * 9 + u.phase) * 0.12 + Math.sin(t * 15.7 + u.phase * 2) * 0.08;
      const h = u.size * (1.5 + f);
      s.scale.set(u.size * (0.75 - f * 0.3), h, 1);
      s.position.set(u.ox + Math.sin(t * 3 + u.phase) * 0.04 * this.scale, h * 0.42, u.oz);
    }
    for (const e of this.embers) {
      const u = e.userData;
      u.life += dt * u.speed * 0.5;
      if (u.life > 1) {
        u.life = 0;
        u.dx = (Math.random() - 0.5) * 0.6;
        u.dz = (Math.random() - 0.5) * 0.6;
      }
      e.position.set(u.dx * u.life + Math.sin(t * 4 + u.speed * 9) * 0.1, 0.4 + u.life * 3 * this.scale, u.dz * u.life);
      e.material.opacity = 1 - u.life;
    }
    if (this.light) this.light.intensity = this.base * (0.85 + Math.sin(t * 11) * 0.08 + Math.sin(t * 23.3) * 0.07);
  }
}

export class Smoke {
  constructor(position) {
    this.object = new THREE.Group();
    this.object.position.copy(position);
    this.puffs = [];
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false, color: '#9a9a9a' }));
      s.userData = { life: i / 8, drift: (Math.random() - 0.5) * 0.4 };
      this.object.add(s);
      this.puffs.push(s);
    }
  }

  update(t, dt) {
    for (const s of this.puffs) {
      const u = s.userData;
      u.life += dt * 0.12;
      if (u.life > 1) u.life -= 1;
      const L = u.life;
      s.position.set(u.drift * L * 3 + L * 1.2, L * 4, Math.sin(L * 5 + u.drift * 10) * 0.2);
      s.scale.setScalar(0.5 + L * 2.2);
      s.material.opacity = Math.sin(L * Math.PI) * 0.55;
    }
  }
}
