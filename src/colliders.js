// Einfacher Kollisionsschutz: Kreise, (gedrehte) Rechtecke und Linien mit Breite.
// Alles wird nur von oben (x/z) betrachtet.

export const PLAYER_RADIUS = 0.4;

export class Colliders {
  constructor(limit) {
    this.limit = limit;
    this.list = [];
  }

  addCircle(x, z, r) {
    this.list.push({ type: 'circle', x, z, r });
  }

  // hw/hd = halbe Breite/Tiefe, angle = Drehung um die Hochachse
  addBox(x, z, hw, hd, angle = 0) {
    this.list.push({ type: 'box', x, z, hw, hd, cos: Math.cos(-angle), sin: Math.sin(-angle) });
  }

  // Linie von a nach b mit Radius r (z. B. Bach, Zaun)
  addSegment(ax, az, bx, bz, r) {
    this.list.push({ type: 'seg', ax, az, bx, bz, r });
  }

  blocked(x, z, rad = PLAYER_RADIUS) {
    if (Math.abs(x) > this.limit || Math.abs(z) > this.limit) return true;
    for (const c of this.list) {
      if (c.type === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return true;
      } else if (c.type === 'box') {
        const dx = x - c.x;
        const dz = z - c.z;
        const lx = dx * c.cos - dz * c.sin;
        const lz = dx * c.sin + dz * c.cos;
        if (Math.abs(lx) < c.hw + rad && Math.abs(lz) < c.hd + rad) return true;
      } else {
        const vx = c.bx - c.ax;
        const vz = c.bz - c.az;
        const t = Math.max(0, Math.min(1, ((x - c.ax) * vx + (z - c.az) * vz) / (vx * vx + vz * vz)));
        if (Math.hypot(x - (c.ax + vx * t), z - (c.az + vz * t)) < c.r + rad) return true;
      }
    }
    return false;
  }
}
