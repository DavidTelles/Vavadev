import type { Vec3 } from '../../types';
import type { BoxKind, CoverPoint, FloorKind, FloorPatch, LightSpot, MapBox, MapDefinition, MapZone, SiteInfo } from './MapDefinition';

export const CELL = 2.5;
export const WALL_HEIGHT = 6.5;

const RAISED: Record<string, number> = { '1': 0.5, '2': 1.0, '3': 1.5 };
const SOLID: Record<string, { kind: BoxKind; h: number }> = {
  '#': { kind: 'wall', h: WALL_HEIGHT },
  c: { kind: 'crate', h: 1.25 },
  C: { kind: 'tallcrate', h: 2.5 },
  m: { kind: 'machine', h: 3.4 },
};

export interface CellRect { i0: number; j0: number; i1: number; j1: number }

export interface GridMapSpec {
  id: string;
  name: string;
  width: number;
  height: number;
  carve: Array<[string, number, number, number, number]>;
  lintels: CellRect[];
  zones: Array<{ id: string; name: string } & CellRect>;
  sites: Record<'A' | 'B', { zone: CellRect; name: string; hold: Array<[number, number]>; staging: Array<[number, number]>; retake: Array<[number, number]> }>;
  spawnZones: Record<'atk' | 'def', CellRect>;
  spawnYaw: Record<'atk' | 'def', number>;
  midPoints: Array<[number, number]>;
  lights: Array<[number, number, number, number]>;
}

export class GridMap {
  readonly cells: string[][];
  readonly ox: number;
  readonly oz: number;

  constructor(readonly w: number, readonly h: number) {
    this.cells = Array.from({ length: h }, () => Array.from({ length: w }, () => '#'));
    this.ox = -(w * CELL) / 2;
    this.oz = -(h * CELL) / 2;
  }

  fill(ch: string, i0: number, j0: number, i1: number, j1: number): void {
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (this.inside(i, j)) this.cells[j][i] = ch;
  }

  inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  at(i: number, j: number): string {
    return this.inside(i, j) ? this.cells[j][i] : '#';
  }

  cellX(i: number): number { return this.ox + i * CELL; }
  cellZ(j: number): number { return this.oz + j * CELL; }
  centerOf(i: number, j: number): Vec3 {
    return { x: this.cellX(i) + CELL / 2, y: this.floorH(this.at(i, j)), z: this.cellZ(j) + CELL / 2 };
  }
  toCell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.ox) / CELL), Math.floor((z - this.oz) / CELL)];
  }
  floorH(ch: string): number { return RAISED[ch] ?? 0; }
  isSolid(ch: string): boolean { return ch in SOLID; }

  rectsOf(pred: (ch: string) => boolean, key: (ch: string) => string): Array<CellRect & { ch: string }> {
    const used = Array.from({ length: this.h }, () => new Array<boolean>(this.w).fill(false));
    const out: Array<CellRect & { ch: string }> = [];
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const ch = this.cells[j][i];
        if (used[j][i] || !pred(ch)) continue;
        const k = key(ch);
        let i1 = i;
        while (i1 + 1 < this.w && !used[j][i1 + 1] && pred(this.cells[j][i1 + 1]) && key(this.cells[j][i1 + 1]) === k) i1++;
        let j1 = j;
        let grow = true;
        while (grow && j1 + 1 < this.h) {
          for (let x = i; x <= i1; x++) {
            const c = this.cells[j1 + 1][x];
            if (used[j1 + 1][x] || !pred(c) || key(c) !== k) { grow = false; break; }
          }
          if (grow) j1++;
        }
        for (let y = j; y <= j1; y++) for (let x = i; x <= i1; x++) used[y][x] = true;
        out.push({ i0: i, j0: j, i1, j1, ch });
      }
    }
    return out;
  }
}

function zoneFrom(g: GridMap, id: string, name: string, r: CellRect): MapZone {
  return { id, name, minX: g.cellX(r.i0), minZ: g.cellZ(r.j0), maxX: g.cellX(r.i1 + 1), maxZ: g.cellZ(r.j1 + 1) };
}

export function buildGridMap(spec: GridMapSpec): MapDefinition {
  const g = new GridMap(spec.width, spec.height);
  for (const [ch, i0, j0, i1, j1] of spec.carve) g.fill(ch, i0, j0, i1, j1);

  const boxes: MapBox[] = [];
  const W = g.w * CELL;
  const H = g.h * CELL;
  boxes.push({ kind: 'ground', min: { x: g.ox - 2, y: -1, z: g.oz - 2 }, max: { x: g.ox + W + 2, y: 0, z: g.oz + H + 2 } });

  for (const r of g.rectsOf((c) => g.isSolid(c), (c) => c)) {
    const s = SOLID[r.ch];
    if (s.kind === 'crate' || s.kind === 'tallcrate') {
      for (let j = r.j0; j <= r.j1; j++) for (let i = r.i0; i <= r.i1; i++) {
        boxes.push({ kind: s.kind, min: { x: g.cellX(i), y: 0, z: g.cellZ(j) }, max: { x: g.cellX(i + 1), y: s.h, z: g.cellZ(j + 1) } });
      }
      continue;
    }
    boxes.push({ kind: s.kind, min: { x: g.cellX(r.i0), y: 0, z: g.cellZ(r.j0) }, max: { x: g.cellX(r.i1 + 1), y: s.h, z: g.cellZ(r.j1 + 1) } });
  }

  for (const r of g.rectsOf((c) => c in RAISED, (c) => c)) {
    boxes.push({ kind: 'platform', min: { x: g.cellX(r.i0), y: 0, z: g.cellZ(r.j0) }, max: { x: g.cellX(r.i1 + 1), y: RAISED[r.ch], z: g.cellZ(r.j1 + 1) } });
  }

  for (const l of spec.lintels) {
    boxes.push({ kind: 'lintel', min: { x: g.cellX(l.i0), y: 3.4, z: g.cellZ(l.j0) }, max: { x: g.cellX(l.i1 + 1), y: WALL_HEIGHT, z: g.cellZ(l.j1 + 1) } });
  }

  const floorKind = (c: string): FloorKind => (c === 'A' || c === 'B' ? 'site' : c === 'a' || c === 'd' ? 'spawn' : c in RAISED ? 'platform' : 'floor');
  const floors: FloorPatch[] = g
    .rectsOf((c) => !g.isSolid(c), (c) => `${floorKind(c)}${g.floorH(c)}`)
    .map((r) => {
      const y = g.floorH(r.ch);
      return { kind: floorKind(r.ch), min: { x: g.cellX(r.i0), y, z: g.cellZ(r.j0) }, max: { x: g.cellX(r.i1 + 1), y, z: g.cellZ(r.j1 + 1) } };
    });

  const coverPoints: CoverPoint[] = [];
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) {
    const ch = g.at(i, j);
    if (g.isSolid(ch) || ch in RAISED) continue;
    for (const [di, dj] of dirs) {
      const n = g.at(i + di, j + dj);
      if (n === 'c' || n === 'C' || n === 'm') {
        const c = g.centerOf(i, j);
        coverPoints.push({ pos: { x: c.x + di * 0.5, y: 0, z: c.z + dj * 0.5 }, nx: di, nz: dj });
      }
    }
  }

  const pt = ([i, j]: [number, number]): Vec3 => g.centerOf(i, j);
  const sites = {} as Record<'A' | 'B', SiteInfo>;
  for (const side of ['A', 'B'] as const) {
    const s = spec.sites[side];
    const zone = zoneFrom(g, `site${side}`, s.name, s.zone);
    sites[side] = {
      side,
      zone,
      center: { x: (zone.minX + zone.maxX) / 2, y: 0, z: (zone.minZ + zone.maxZ) / 2 },
      holdPoints: s.hold.map(pt),
      stagingPoints: s.staging.map(pt),
      retakePoints: s.retake.map(pt),
    };
  }

  const spawnPoints = (r: CellRect): Vec3[] => {
    const out: Vec3[] = [];
    const cj = Math.floor((r.j0 + r.j1) / 2);
    const span = r.i1 - r.i0;
    for (let k = 0; k < 5; k++) out.push(g.centerOf(r.i0 + Math.round(((k + 1) * span) / 6), cj));
    return out;
  };

  const lights: LightSpot[] = spec.lights.map(([i, j, color, intensity]) => {
    const c = g.centerOf(i, j);
    return { pos: { x: c.x, y: 5.2, z: c.z }, color, intensity };
  });

  return {
    id: spec.id,
    name: spec.name,
    minX: g.ox,
    maxX: g.ox + W,
    minZ: g.oz,
    maxZ: g.oz + H,
    boxes,
    floors,
    spawns: { atk: spawnPoints(spec.spawnZones.atk), def: spawnPoints(spec.spawnZones.def) },
    spawnYaw: spec.spawnYaw,
    spawnZones: { atk: zoneFrom(g, 'spawnAtk', 'Base Atacante', spec.spawnZones.atk), def: zoneFrom(g, 'spawnDef', 'Base Defensora', spec.spawnZones.def) },
    sites,
    callouts: spec.zones.map((z) => zoneFrom(g, z.id, z.name, z)),
    coverPoints,
    midPoints: spec.midPoints.map(pt),
    lights,
    solidAt: (x, z) => {
      const [i, j] = g.toCell(x, z);
      return g.isSolid(g.at(i, j));
    },
    floorHeightAt: (x, z) => {
      const [i, j] = g.toCell(x, z);
      return g.floorH(g.at(i, j));
    },
  };
}
