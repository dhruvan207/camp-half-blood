import * as THREE from 'three';
import { LAYOUT, heightAt, inFrontOf } from './terrain.js';
import { BIG_HOUSE, bigHouseSpot } from './buildings.js';
import { makeLabel } from './characters.js';

// Infoboxen für Figuren, Hütten und Orte.
// Die Texte kommen aus public/content.json. Beim Arbeiten auf dem Mac (npm run dev)
// kann man sie direkt in der Infobox bearbeiten und speichern.

const BASE = import.meta.env.BASE_URL;
const EDIT = import.meta.env.DEV; // Bearbeiten nur lokal, nie auf GitHub Pages

// ---------------------------------------------------------------------------
// Inhalte laden (kaputtes JSON darf die Seite nicht zerstören)

export async function loadContent() {
  let raw = '';
  try {
    const res = await fetch(BASE + 'content.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('Datei nicht gefunden (' + res.status + ')');
    raw = await res.text();
    return { data: JSON.parse(raw), error: null };
  } catch (e) {
    let where = '';
    const m = /position (\d+)/i.exec(e.message) || /column (\d+)/i.exec(e.message);
    if (m && raw) {
      const pos = Number(m[1]);
      const line = raw.slice(0, pos).split('\n').length;
      where = ` (ungefähr Zeile ${line})`;
    } else {
      const l = /line (\d+)/i.exec(e.message);
      if (l) where = ` (Zeile ${l[1]})`;
    }
    return {
      data: { figuren: [], huetten: [], orte: [], infopunkte: [] },
      error: `In content.json ist ein Fehler${where}. Oft fehlt ein Komma oder ein Anführungszeichen. Die Seite läuft trotzdem, nur die Texte fehlen.`,
    };
  }
}

function showError(msg) {
  const el = document.createElement('div');
  el.className = 'content-error';
  el.setAttribute('role', 'alert');
  el.textContent = msg;
  const x = document.createElement('button');
  x.type = 'button';
  x.textContent = '×';
  x.setAttribute('aria-label', 'Hinweis schließen');
  x.addEventListener('click', () => el.remove());
  el.appendChild(x);
  document.body.appendChild(el);
}

// ---------------------------------------------------------------------------
// Orte: wo ein Tipp auf ein Gebäude welche Infobox öffnet, und wo das Namensschild steht

function localOf(base, x, z) {
  const dx = x - base.x;
  const dz = z - base.z;
  const c = Math.cos(base.facing);
  const s = Math.sin(base.facing);
  return { lx: dx * c - dz * s, lz: dx * s + dz * c };
}

function buildPlaces() {
  const L = LAYOUT;
  const places = [];
  for (const c of L.cabins) {
    const size = c.size ?? { w: 5, d: 7.2, front: 4.5 };
    const temple = c.nr <= 2;
    const door = inFrontOf(c, size.front);
    places.push({
      id: 'huette-' + c.nr,
      label: { x: door.x, z: door.z, y: heightAt(c.x, c.z) + (temple ? 7.6 : 4.4), text: `Hütte ${c.nr} · ${c.god === 'Apollo' ? 'Apollon' : c.god}` },
      hit: (x, z) => {
        const { lx, lz } = localOf(c, x, z);
        return Math.abs(lx) < size.w / 2 + 0.7 && lz > -size.d / 2 - 0.7 && lz < size.front + 0.3;
      },
    });
  }
  const b = L.bigHouse;
  const H = BIG_HOUSE;
  const bh = bigHouseSpot(0, H.d / 2 + H.porch + 0.5);
  places.push({
    id: 'big-house',
    label: { x: bh.x, z: bh.z, y: bh.y + 4.6, text: 'Das Big House' },
    hit: (x, z) => {
      const { lx, lz } = localOf(b, x, z);
      return lx > -H.w / 2 - H.porch - 0.6 && lx < H.w / 2 + 0.8 && lz > -H.d / 2 - 0.8 && lz < H.d / 2 + H.porch + 1.5;
    },
  });
  const p = L.pavilion;
  places.push({
    id: 'speisepavillon',
    label: { x: p.x, z: p.z - p.d / 2 - 1, y: heightAt(p.x, p.z) + 5.6, text: 'Speisepavillon' },
    hit: (x, z) => Math.abs(x - p.x) < p.w / 2 + 1.3 && Math.abs(z - p.z) < p.d / 2 + 1.3,
  });
  const a = L.arena;
  places.push({
    id: 'arena',
    label: { x: a.x - a.rx, z: a.z, y: heightAt(a.x - a.rx, a.z) + 3.2, text: 'Arena' },
    hit: (x, z) => ((x - a.x) / (a.rx + 4.5)) ** 2 + ((z - a.z) / (a.rz + 4.5)) ** 2 < 1,
  });
  const am = L.amphitheater;
  places.push({
    id: 'amphitheater',
    label: { x: am.x, z: am.z - 3.5, y: heightAt(am.x, am.z) + 3.2, text: 'Amphitheater' },
    hit: (x, z) => Math.hypot(x - am.x, z - am.z) < 11.5,
  });
  const st = L.stables;
  places.push({
    id: 'staelle',
    label: { x: st.x, z: st.z + 3.6, y: heightAt(st.x, st.z) + 5.8, text: 'Ställe' },
    hit: (x, z) => Math.abs(x - st.x) < 6 && z > st.z - 3.6 && z < st.z + 15,
  });
  const ar = L.archery;
  places.push({
    id: 'bogenschiessen',
    label: { x: ar.x - 3, z: ar.z, y: heightAt(ar.x - 3, ar.z) + 2.8, text: 'Bogenschießplatz' },
    hit: (x, z) => x > ar.x - 5.5 && x < ar.x + 8.5 && Math.abs(z - ar.z) < 7.5,
  });
  const lk = L.lake;
  places.push({
    id: 'kanusee',
    label: { x: lk.x + lk.rx - 0.5, z: lk.z, y: lk.level + 2.6, text: 'Kanusee' },
    hit: (x, z) => ((x - lk.x) / (lk.rx + 3)) ** 2 + ((z - lk.z) / (lk.rz + 2)) ** 2 < 1,
  });
  const sf = L.strawberries;
  places.push({
    id: 'erdbeerfelder',
    label: { x: sf.x, z: sf.z + sf.d / 2, y: heightAt(sf.x, sf.z + sf.d / 2) + 2.2, text: 'Erdbeerfelder' },
    hit: (x, z) => Math.abs(x - sf.x) < sf.w / 2 + 0.5 && Math.abs(z - sf.z) < sf.d / 2 + 0.5,
  });
  const tp = L.thaliaPine;
  places.push({
    id: 'kiefer',
    label: { x: tp.x, z: tp.z + 2.5, y: heightAt(tp.x, tp.z) + 2.8, text: 'Die Kiefer' },
    hit: (x, z) => Math.hypot(x - tp.x, z - tp.z) < 5,
  });
  return places;
}

// ---------------------------------------------------------------------------
// Die Infobox (Karte) auf dem Bildschirm

class InfoCard {
  constructor({ onOpen, onClose, onSave }) {
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.onSave = onSave;
    this.entry = null;

    const root = document.createElement('div');
    root.className = 'card-backdrop';
    root.hidden = true;
    root.innerHTML = `
      <div class="card" role="dialog" aria-modal="true" aria-labelledby="card-title">
        <button type="button" class="card-close" aria-label="Infobox schließen">×</button>
        <img class="card-img" alt="" hidden />
        <h2 id="card-title" class="card-title"></h2>
        <div class="card-text"></div>
        <form class="card-edit" hidden>
          <label>Titel<input name="titel" type="text" autocomplete="off" /></label>
          <label>Text<textarea name="text" rows="9"></textarea></label>
          <label>Bild (optional, Dateiname aus dem Ordner public/bilder)<input name="bild" type="text" autocomplete="off" placeholder="z. B. percy.jpg" /></label>
          <div class="card-buttons">
            <button type="submit" class="btn-primary">Speichern</button>
            <button type="button" class="btn-secondary card-cancel">Abbrechen</button>
          </div>
        </form>
        <div class="card-footer" hidden>
          <button type="button" class="btn-secondary card-edit-btn">✏️ Text bearbeiten</button>
          <span class="card-status" role="status"></span>
        </div>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.card = root.querySelector('.card');
    this.title = root.querySelector('.card-title');
    this.text = root.querySelector('.card-text');
    this.img = root.querySelector('.card-img');
    this.form = root.querySelector('.card-edit');
    this.footer = root.querySelector('.card-footer');
    this.status = root.querySelector('.card-status');

    root.querySelector('.card-close').addEventListener('click', () => this.close());
    // Tipp neben die Karte schließt sie
    root.addEventListener('pointerdown', (e) => {
      if (e.target === root) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !root.hidden) this.close();
    });
    this.img.addEventListener('error', () => (this.img.hidden = true));
    root.querySelector('.card-edit-btn').addEventListener('click', () => this.startEdit());
    root.querySelector('.card-cancel').addEventListener('click', () => this.stopEdit());
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
  }

  get isOpen() {
    return !this.root.hidden;
  }

  open(entry) {
    this.entry = entry;
    this.render();
    this.stopEdit();
    this.status.textContent = '';
    this.footer.hidden = !EDIT;
    this.root.hidden = false;
    this.onOpen?.();
    this.root.querySelector('.card-close').focus({ preventScroll: true });
  }

  render() {
    const e = this.entry;
    this.title.textContent = e.titel || '';
    this.text.replaceChildren(
      ...String(e.text || '')
        .split(/\n\s*\n|\n/)
        .filter((t) => t.trim())
        .map((t) => {
          const p = document.createElement('p');
          p.textContent = t;
          return p;
        }),
    );
    this.text.classList.toggle('placeholder', /^Hier deinen/i.test(e.text || ''));
    if (e.bild) {
      this.img.hidden = false;
      this.img.src = BASE + 'bilder/' + e.bild;
      this.img.alt = e.titel || '';
    } else {
      this.img.hidden = true;
      this.img.removeAttribute('src');
    }
  }

  close() {
    if (this.root.hidden) return;
    this.root.hidden = true;
    this.onClose?.();
  }

  startEdit() {
    const f = this.form.elements;
    f.titel.value = this.entry.titel || '';
    f.text.value = /^Hier deinen/i.test(this.entry.text || '') ? '' : this.entry.text || '';
    f.text.placeholder = this.entry.text || '';
    f.bild.value = this.entry.bild || '';
    this.form.hidden = false;
    this.text.hidden = true;
    this.footer.hidden = true;
    f.text.focus();
  }

  stopEdit() {
    this.form.hidden = true;
    this.text.hidden = false;
    this.footer.hidden = !EDIT;
  }

  async save() {
    const f = this.form.elements;
    const before = { ...this.entry };
    this.entry.titel = f.titel.value.trim() || before.titel;
    this.entry.text = f.text.value.trim() || before.text;
    this.entry.bild = f.bild.value.trim();
    this.render();
    this.stopEdit();
    this.status.textContent = 'Speichere …';
    const ok = await this.onSave?.();
    this.status.textContent = ok === true ? 'Gespeichert ✓' : 'Nicht gespeichert: ' + ok;
  }
}

// ---------------------------------------------------------------------------

export class InfoSystem {
  constructor({ scene, controls, world, content }) {
    this.content = content.data;
    if (content.error) showError(content.error);
    this.controls = controls;
    this.world = world;
    this.places = buildPlaces();
    this.buildingGroups = new Set(world.obstacles.slice(0, 2));

    // Namensschilder an den Gebäuden
    this.labels = [];
    const group = new THREE.Group();
    for (const p of this.places) {
      const s = makeLabel(p.label.text);
      s.position.set(p.label.x, p.label.y, p.label.z);
      s.scale.multiplyScalar(1.15);
      s.userData.placeId = p.id;
      group.add(s);
      this.labels.push(s);
    }
    scene.add(group);

    this.card = new InfoCard({
      onOpen: () => {
        controls.enabled = false;
        controls.keys.clear();
        controls.target = null;
      },
      onClose: () => (controls.enabled = true),
      onSave: () => this.save(),
    });

    // Tipp-Erkennung in die Steuerung einhängen
    controls.tapTargets.push(...this.labels, ...world.tapTargets);
    controls.onTapHit = (hit) => this.handleHit(hit);
  }

  // Eintrag aus content.json suchen (oder Platzhalter erzeugen)
  entry(section, id, fallbackTitle = id) {
    const list = (this.content[section] ??= []);
    let e = list.find((x) => x.id === id);
    if (!e) {
      e = { id, titel: fallbackTitle, text: `Hier deinen Text zu ${fallbackTitle} schreiben.`, bild: '' };
      list.push(e);
    }
    return e;
  }

  sectionOf(placeId) {
    return placeId.startsWith('huette-') ? 'huetten' : 'orte';
  }

  // Wird bei jedem Tipp aufgerufen. true = Infobox geöffnet, nicht hinlaufen.
  handleHit(hit) {
    let o = hit.object;
    let inBuilding = false;
    while (o) {
      if (o.userData.figureId) {
        const ch = this.world.characters.list.find((c) => c.id === o.userData.figureId);
        this.card.open(this.entry('figuren', o.userData.figureId, ch?.name));
        return true;
      }
      if (o.userData.placeId) {
        this.openPlace(o.userData.placeId);
        return true;
      }
      if (this.buildingGroups.has(o)) inBuilding = true;
      o = o.parent;
    }
    if (inBuilding) {
      const p = this.places.find((pl) => pl.hit(hit.point.x, hit.point.z));
      if (p) {
        this.openPlace(p.id);
        return true;
      }
    }
    return false;
  }

  openPlace(id) {
    const p = this.places.find((pl) => pl.id === id);
    this.card.open(this.entry(this.sectionOf(id), id, p?.label.text ?? id));
  }

  async save() {
    try {
      const res = await fetch('/__inhalt-speichern', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.content),
      });
      const r = await res.json();
      return r.ok ? true : r.fehler || 'unbekannter Fehler';
    } catch {
      return 'Die Vorschau auf dem Mac läuft nicht.';
    }
  }

  update(camera) {
    for (const s of this.labels) {
      const d = s.position.distanceTo(camera.position);
      const want = d > 3 && d < 20 ? 1 : 0;
      const m = s.material;
      m.opacity += (want - m.opacity) * 0.15;
      s.visible = m.opacity > 0.02;
    }
  }
}
