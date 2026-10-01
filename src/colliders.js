// Einfacher Kollisionsschutz: Kreise, Ellipsen, (gedrehte) Rechtecke und Linien mit Breite.
// Alles wird nur von oben (x/z) betrachtet.

export const PLAYER_RADIUS = 0.35;

export class Colliders {
  constructor(bounds, onPlatform = null) {
    this.bounds = bounds; // { minX, maxX, minZ, maxZ }
    this.onPlatform = onPlatform; // (x, z) => true, wenn dort ein Steg o. Ä. ist
    this.list = [];
  }

  // Wasser: blockiert, außer man steht auf einem Steg
  addWater(x, z, rx, rz) {
    this.list.push({ type: 'ellipse', x, z, rx, rz, water: true });
  }

  addCircle(x, z, r) {
    this.list.push({ type: 'circle', x, z, r });
  }

  addEllipse(x, z, rx, rz) {
    this.list.push({ type: 'ellipse', x, z, rx, rz });
  }

  // hw/hd = halbe Breite/Tiefe, angle = Drehung um die Hochachse
  addBox(x, z, hw, hd, angle = 0) {
    this.list.push({ type: 'box', x, z, hw, hd, cos: Math.cos(angle), sin: Math.sin(angle) });
  }

  // Linie von a nach b mit Radius r (z. B. Bach, Zaun)
  addSegment(ax, az, bx, bz, r) {
    this.list.push({ type: 'seg', ax, az, bx, bz, r });
  }

  addPolyline(pts, r) {
    for (let i = 0; i < pts.length - 1; i++) this.addSegment(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r);
  }

  blocked(x, z, rad = PLAYER_RADIUS) {
    const b = this.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return true;
    return this.hits(x, z, rad);
  }

  // wie blocked, aber ohne den Rand der begehbaren Fläche
  hits(x, z, rad = PLAYER_RADIUS) {
    for (const c of this.list) {
      if (c.water && this.onPlatform?.(x, z)) continue;
      if (c.type === 'circle') {
        if (Math.hypot(x - c.x, z - c.z) < c.r + rad) return true;
      } else if (c.type === 'ellipse') {
        if (((x - c.x) / (c.rx + rad)) ** 2 + ((z - c.z) / (c.rz + rad)) ** 2 < 1) return true;
      } else if (c.type === 'box') {
        // in das gedrehte Koordinatensystem des Rechtecks umrechnen
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
