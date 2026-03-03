// models/Terrain.js
export class Terrain {
  constructor({ id, name, x, y, radius, types = [] }) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.types = types;
  }

  contains(px, py) {
    const dx = px - this.x;
    const dy = py - this.y;
    return Math.hypot(dx, dy) <= this.radius;
  }

  intersectsLine(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const fx = x1 - this.x;
    const fy = y1 - this.y;
    const a = dx*dx + dy*dy;
    if (a === 0) return this.contains(x1, y1);
    const b = 2*(fx*dx + fy*dy);
    const c = fx*fx + fy*fy - this.radius*this.radius;
    const disc = b*b - 4*a*c;
    if (disc < 0) return false;
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / (2*a);
    const t2 = (-b + sqrtDisc) / (2*a);
    return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1);
  }
}
