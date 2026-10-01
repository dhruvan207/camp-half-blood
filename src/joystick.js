// Virtueller Joystick unten links (für Handy und Tablet, geht auch mit der Maus).
// Liefert eine Richtung x/y zwischen -1 und 1: y = -1 heißt „nach vorne“.

const DEADZONE = 0.12;

export class Joystick {
  constructor(parent = document.body) {
    this.x = 0;
    this.y = 0;
    this.pointerId = null;

    this.el = document.createElement('div');
    this.el.className = 'joystick';
    this.el.setAttribute('role', 'application');
    this.el.setAttribute('aria-label', 'Joystick zum Laufen');
    this.el.hidden = true;
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    this.el.appendChild(this.knob);
    parent.appendChild(this.el);

    this.el.addEventListener('pointerdown', (e) => this.onDown(e));
    this.el.addEventListener('pointermove', (e) => this.onMove(e));
    this.el.addEventListener('pointerup', (e) => this.onUp(e));
    this.el.addEventListener('pointercancel', (e) => this.onUp(e));
    this.el.addEventListener('lostpointercapture', (e) => this.onUp(e));
    this.el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  show() {
    this.el.hidden = false;
  }

  onDown(e) {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    this.el.classList.add('active');
    this.onMove(e);
  }

  onMove(e) {
    if (e.pointerId !== this.pointerId) return;
    const r = this.el.getBoundingClientRect();
    const radius = r.width / 2;
    let dx = (e.clientX - (r.left + radius)) / radius;
    let dy = (e.clientY - (r.top + radius)) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    // Knopf folgt dem Finger, bleibt aber im Kreis
    const max = radius - this.knob.offsetWidth / 2;
    this.knob.style.transform = `translate(calc(-50% + ${dx * max}px), calc(-50% + ${dy * max}px))`;
    const m = Math.min(1, len);
    if (m < DEADZONE) {
      this.x = 0;
      this.y = 0;
    } else {
      // Totzone abziehen, damit kleine Bewegungen sanft anfangen
      const k = (m - DEADZONE) / (1 - DEADZONE) / m;
      this.x = dx * k;
      this.y = dy * k;
    }
  }

  onUp(e) {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.el.classList.remove('active');
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  get active() {
    return this.x !== 0 || this.y !== 0;
  }
}
