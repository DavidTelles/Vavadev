import type { MapDefinition, MapZone } from '../../data/maps/MapDefinition';
import type { Vec3 } from '../../types';

const STEP = 0.55; // max floor height change between neighbouring cells (stairs are 0.5)
const CLEAR = 0.45; // agent radius + margin

/**
 * Walkability grid + A* for bots, built from any MapDefinition via its
 * `solidAt` / `floorHeightAt` queries (render-free, runs in Node and browser).
 *
 * Paths are smoothed by skipping waypoints whenever the straight segment is
 * walkable with clearance, so bots walk natural lines instead of grid zigzags.
 */
export class NavGrid {
  readonly res: number;
  readonly w: number;
  readonly h: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly walk: Uint8Array;
  private readonly floor: Float32Array;
  // A* scratch buffers (reused, no per-query allocation of big arrays).
  private readonly g: Float32Array;
  private readonly f: Float32Array;
  private readonly parent: Int32Array;
  private readonly stamp: Uint32Array;
  private readonly closed: Uint32Array;
  private query = 0;

  constructor(private readonly map: MapDefinition, res = 1.25) {
    this.res = res;
    this.x0 = map.minX;
    this.z0 = map.minZ;
    this.w = Math.ceil((map.maxX - map.minX) / res);
    this.h = Math.ceil((map.maxZ - map.minZ) / res);
    const n = this.w * this.h;
    this.walk = new Uint8Array(n);
    this.floor = new Float32Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const x = this.x0 + (i + 0.5) * res;
        const z = this.z0 + (j + 0.5) * res;
        const k = j * this.w + i;
        this.floor[k] = map.floorHeightAt(x, z);
        this.walk[k] = this.clearAt(x, z) ? 1 : 0;
      }
    }
  }

  /** True if a capsule of radius CLEAR fits at (x,z) on a near-flat floor. */
  private clearAt(x: number, z: number): boolean {
    const m = this.map;
    if (m.solidAt(x, z)) return false;
    const y = m.floorHeightAt(x, z);
    for (const [dx, dz] of [[CLEAR, 0], [-CLEAR, 0], [0, CLEAR], [0, -CLEAR], [CLEAR * 0.7, CLEAR * 0.7], [-CLEAR * 0.7, CLEAR * 0.7], [CLEAR * 0.7, -CLEAR * 0.7], [-CLEAR * 0.7, -CLEAR * 0.7]]) {
      if (m.solidAt(x + dx, z + dz)) return false;
      if (Math.abs(m.floorHeightAt(x + dx, z + dz) - y) > STEP) return false;
    }
    return true;
  }

  cellOf(x: number, z: number): number {
    const i = Math.floor((x - this.x0) / this.res);
    const j = Math.floor((z - this.z0) / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return j * this.w + i;
  }

  center(k: number): Vec3 {
    const i = k % this.w;
    const j = (k - i) / this.w;
    return { x: this.x0 + (i + 0.5) * this.res, y: this.floor[k], z: this.z0 + (j + 0.5) * this.res };
  }

  walkable(x: number, z: number): boolean {
    const k = this.cellOf(x, z);
    return k >= 0 && this.walk[k] === 1;
  }

  /** Nearest walkable cell centre to a point (spiral search). */
  nearest(p: Vec3, maxRing = 6): Vec3 | null {
    const k0 = this.cellOf(p.x, p.z);
    if (k0 >= 0 && this.walk[k0]) return { x: p.x, y: this.floor[k0], z: p.z };
    const i0 = Math.floor((p.x - this.x0) / this.res);
    const j0 = Math.floor((p.z - this.z0) / this.res);
    for (let r = 1; r <= maxRing; r++) {
      let best = -1;
      let bestD = 1e9;
      for (let j = j0 - r; j <= j0 + r; j++) {
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (i < 0 || j < 0 || i >= this.w || j >= this.h) continue;
          const k = j * this.w + i;
          if (!this.walk[k]) continue;
          const c = this.center(k);
          const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
          if (d < bestD) { bestD = d; best = k; }
        }
      }
      if (best >= 0) return this.center(best);
    }
    return null;
  }

  /** Straight segment walkable with clearance and no ledge higher than a step. */
  lineWalkable(a: Vec3, b: Vec3): boolean {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(len / 0.35));
    let prevY = this.map.floorHeightAt(a.x, a.z);
    for (let s = 1; s <= n; s++) {
      const x = a.x + (dx * s) / n;
      const z = a.z + (dz * s) / n;
      if (!this.walkable(x, z)) return false;
      const y = this.map.floorHeightAt(x, z);
      if (Math.abs(y - prevY) > STEP) return false;
      prevY = y;
    }
    return true;
  }

  /** A* from `from` to `to`; returns smoothed waypoints (excluding start) or null. */
  findPath(from: Vec3, to: Vec3): Vec3[] | null {
    const s = this.nearest(from);
    const e = this.nearest(to);
    if (!s || !e) return null;
    const start = this.cellOf(s.x, s.z);
    const goal = this.cellOf(e.x, e.z);
    if (start < 0 || goal < 0) return null;
    if (start === goal) return [e];
    const q = ++this.query;
    const W = this.w;
    const gx = goal % W;
    const gz = (goal - gx) / W;
    const heur = (k: number): number => {
      const x = k % W;
      const z = (k - x) / W;
      const ddx = Math.abs(x - gx);
      const ddz = Math.abs(z - gz);
      return (Math.max(ddx, ddz) + 0.414 * Math.min(ddx, ddz)) * this.res;
    };
    // Binary heap of cell indices keyed by f.
    const heap: number[] = [start];
    const push = (k: number): void => {
      heap.push(k);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (this.f[heap[p]] <= this.f[heap[c]]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]];
        c = p;
      }
    };
    const pop = (): number => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          const l = c * 2 + 1;
          const r = l + 1;
          let m = c;
          if (l < heap.length && this.f[heap[l]] < this.f[heap[m]]) m = l;
          if (r < heap.length && this.f[heap[r]] < this.f[heap[m]]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]];
          c = m;
        }
      }
      return top;
    };
    this.stamp[start] = q;
    this.g[start] = 0;
    this.f[start] = heur(start);
    this.parent[start] = -1;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    let guard = 0;
    while (heap.length && guard++ < 40000) {
      const k = pop();
      if (this.closed[k] === q) continue;
      this.closed[k] = q;
      if (k === goal) { found = true; break; }
      const x = k % W;
      const z = (k - x) / W;
      for (const [di, dj, cost] of D) {
        const nx = x + di;
        const nz = z + dj;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.h) continue;
        const nk = nz * W + nx;
        if (!this.walk[nk] || this.closed[nk] === q) continue;
        if (Math.abs(this.floor[nk] - this.floor[k]) > STEP) continue;
        if (di && dj && (!this.walk[z * W + nx] || !this.walk[nz * W + x])) continue;
        const ng = this.g[k] + cost * this.res;
        if (this.stamp[nk] === q && ng >= this.g[nk]) continue;
        this.stamp[nk] = q;
        this.g[nk] = ng;
        this.f[nk] = ng + heur(nk);
        this.parent[nk] = k;
        push(nk);
      }
    }
    if (!found) return null;
    const cells: Vec3[] = [];
    for (let k = goal; k !== -1 && k !== start; k = this.parent[k]) cells.push(this.center(k));
    cells.reverse();
    cells[cells.length - 1] = e;
    // String-pull: keep the farthest directly reachable waypoint each step.
    const out: Vec3[] = [];
    let anchor = s;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.lineWalkable(anchor, cells[j])) j--;
      out.push(cells[j]);
      anchor = cells[j];
      i = j + 1;
    }
    return out;
  }

  /** Random walkable point inside a zone (rejection sampling). */
  randomIn(z: MapZone, rng: () => number): Vec3 | null {
    for (let n = 0; n < 40; n++) {
      const x = z.minX + rng() * (z.maxX - z.minX);
      const zz = z.minZ + rng() * (z.maxZ - z.minZ);
      if (this.walkable(x, zz)) return { x, y: this.map.floorHeightAt(x, zz), z: zz };
    }
    return null;
  }
}
