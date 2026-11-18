import { buildGridMap, type GridMapSpec } from './GridMapBuilder';
import type { MapDefinition } from './MapDefinition';

const W = 48;
const mx = (i: number): number => W - 1 - i;

type Carve = [string, number, number, number, number];

const symmetric: Carve[] = [
  ['.', 8, 2, 17, 3],
  ['.', 8, 4, 9, 4],
  ['.', 1, 5, 14, 15],
  ['.', 15, 10, 17, 11],
  ['.', 2, 16, 6, 24],
  ['.', 2, 25, 14, 29],
  ['.', 13, 30, 15, 31],
  ['.', 7, 20, 17, 20],
  ['3', 1, 5, 3, 7],
  ['2', 4, 5, 4, 6],
  ['1', 5, 5, 5, 6],
  ['2', 18, 22, 20, 24],
  ['1', 21, 22, 21, 24],
  ['C', 7, 9, 7, 9],
  ['c', 8, 9, 8, 9],
  ['c', 10, 11, 10, 11],
  ['C', 12, 5, 13, 5],
  ['c', 6, 13, 6, 13],
  ['C', 1, 12, 1, 13],
  ['c', 12, 14, 12, 14],
  ['c', 5, 18, 5, 18],
  ['c', 9, 27, 9, 27],
  ['C', 12, 25, 12, 25],
  ['C', 20, 10, 20, 10],
  ['c', 21, 10, 21, 10],
  ['#', 18, 13, 19, 18],
  ['c', 20, 17, 20, 17],
  ['c', 18, 31, 18, 31],
];

function mirror(c: Carve): Carve {
  const [ch, i0, j0, i1, j1] = c;
  const out = ch === 'A' ? 'B' : ch;
  return [out, mx(i1), j0, mx(i0), j1];
}

const carve: Carve[] = [
  ['d', 18, 1, 29, 4],
  ['.', 22, 5, 25, 7],
  ['.', 18, 8, 29, 26],
  ['.', 22, 27, 25, 29],
  ['a', 16, 30, 31, 34],
  ...symmetric.filter((c) => c[0] === '.'),
  ...symmetric.filter((c) => c[0] === '.').map(mirror),
  ['A', 4, 8, 11, 12],
  ['B', mx(11), 8, mx(4), 12],
  ...symmetric.filter((c) => c[0] !== '.'),
  ...symmetric.filter((c) => c[0] !== '.').map(mirror),
  ['m', 23, 15, 24, 16],
  ['c', 22, 21, 22, 21],
  ['c', 25, 19, 25, 19],
  ['C', 23, 11, 23, 11],
  ['C', 23, 20, 24, 20],
];

export const usinaSpec: GridMapSpec = {
  id: 'usina',
  name: 'Usina',
  width: W,
  height: 36,
  carve,
  lintels: [
    { i0: 8, j0: 4, i1: 9, j1: 4 },
    { i0: mx(9), j0: 4, i1: mx(8), j1: 4 },
    { i0: 16, j0: 10, i1: 16, j1: 11 },
    { i0: mx(16), j0: 10, i1: mx(16), j1: 11 },
    { i0: 22, j0: 6, i1: 25, j1: 6 },
    { i0: 22, j0: 28, i1: 25, j1: 28 },
    { i0: 15, j0: 30, i1: 15, j1: 31 },
    { i0: mx(15), j0: 30, i1: mx(15), j1: 31 },
    { i0: 12, j0: 20, i1: 12, j1: 20 },
    { i0: mx(12), j0: 20, i1: mx(12), j1: 20 },
  ],
  zones: [
    { id: 'baseDef', name: 'Base Defensora', i0: 18, j0: 1, i1: 29, j1: 4 },
    { id: 'galeriaA', name: 'Galeria A', i0: 8, j0: 2, i1: 17, j1: 4 },
    { id: 'galeriaB', name: 'Galeria B', i0: mx(17), j0: 2, i1: mx(8), j1: 4 },
    { id: 'ceuA', name: 'Céu A', i0: 1, j0: 5, i1: 5, j1: 7 },
    { id: 'ceuB', name: 'Céu B', i0: mx(5), j0: 5, i1: mx(1), j1: 7 },
    { id: 'localA', name: 'Local A', i0: 1, j0: 5, i1: 14, j1: 15 },
    { id: 'localB', name: 'Local B', i0: mx(14), j0: 5, i1: mx(1), j1: 15 },
    { id: 'ligacaoA', name: 'Ligação A', i0: 15, j0: 10, i1: 17, j1: 11 },
    { id: 'ligacaoB', name: 'Ligação B', i0: mx(17), j0: 10, i1: mx(15), j1: 11 },
    { id: 'topoMeio', name: 'Topo do Meio', i0: 18, j0: 5, i1: 29, j1: 12 },
    { id: 'meio', name: 'Meio', i0: 18, j0: 13, i1: 29, j1: 26 },
    { id: 'principalA', name: 'Principal A', i0: 2, j0: 16, i1: 6, j1: 24 },
    { id: 'principalB', name: 'Principal B', i0: mx(6), j0: 16, i1: mx(2), j1: 24 },
    { id: 'atalhoA', name: 'Atalho A', i0: 7, j0: 20, i1: 17, j1: 20 },
    { id: 'atalhoB', name: 'Atalho B', i0: mx(17), j0: 20, i1: mx(7), j1: 20 },
    { id: 'saguaoA', name: 'Saguão A', i0: 2, j0: 25, i1: 15, j1: 29 },
    { id: 'saguaoB', name: 'Saguão B', i0: mx(15), j0: 25, i1: mx(2), j1: 29 },
    { id: 'baseAtk', name: 'Base Atacante', i0: 16, j0: 27, i1: 31, j1: 34 },
  ],
  sites: {
    A: {
      zone: { i0: 4, j0: 8, i1: 11, j1: 12 },
      name: 'Local A',
      hold: [[2, 6], [13, 7], [3, 10], [13, 12], [16, 11]],
      staging: [[4, 20], [21, 11]],
      retake: [[9, 4], [16, 10], [4, 16]],
    },
    B: {
      zone: { i0: mx(11), j0: 8, i1: mx(4), j1: 12 },
      name: 'Local B',
      hold: [[mx(2), 6], [mx(13), 7], [mx(3), 10], [mx(13), 12], [mx(16), 11]],
      staging: [[mx(4), 20], [mx(21), 11]],
      retake: [[mx(9), 4], [mx(16), 10], [mx(4), 16]],
    },
  },
  spawnZones: {
    atk: { i0: 16, j0: 30, i1: 31, j1: 34 },
    def: { i0: 18, j0: 1, i1: 29, j1: 4 },
  },
  spawnYaw: { atk: 0, def: Math.PI },
  midPoints: [[23, 9], [21, 13], [26, 13], [23, 20], [26, 24]],
  lights: [
    [8, 10, 0xffd9a0, 30],
    [mx(8), 10, 0xa0d8ff, 30],
    [23, 13, 0xffe2b8, 26],
    [23, 22, 0xffe2b8, 26],
    [12, 2, 0xfff0d0, 18],
    [mx(12), 2, 0xfff0d0, 18],
    [4, 20, 0xffc890, 20],
    [mx(4), 20, 0xffc890, 20],
    [8, 27, 0xffe0c0, 18],
    [mx(8), 27, 0xffe0c0, 18],
  ],
};

let cached: MapDefinition | null = null;

export function getUsinaMap(): MapDefinition {
  if (!cached) cached = buildGridMap(usinaSpec);
  return cached;
}
