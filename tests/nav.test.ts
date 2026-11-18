import { describe, expect, it } from 'vitest';
import { getUsinaMap } from '../src/shared/data/maps/usina';
import { NavGrid } from '../src/shared/sim/nav/NavGrid';

describe('NavGrid on Usina', () => {
  const map = getUsinaMap();
  const nav = new NavGrid(map);

  it('every spawn reaches both sites and the other spawn', () => {
    for (const team of ['atk', 'def'] as const) {
      for (const sp of map.spawns[team]) {
        for (const side of ['A', 'B'] as const) {
          const p = nav.findPath(sp, map.sites[side].center);
          expect(p, `${team} -> ${side}`).not.toBeNull();
        }
        const other = map.spawns[team === 'atk' ? 'def' : 'atk'][0];
        expect(nav.findPath(sp, other)).not.toBeNull();
      }
    }
  });

  it('smoothed path segments are all walkable', () => {
    const from = map.spawns.atk[2];
    const p = nav.findPath(from, map.sites.A.center)!;
    let prev = from;
    for (const w of p) {
      expect(nav.lineWalkable(prev, w)).toBe(true);
      prev = w;
    }
    expect(p.length).toBeLessThan(20);
  });

  it('hold, staging and retake points are reachable', () => {
    for (const side of ['A', 'B'] as const) {
      const s = map.sites[side];
      for (const pt of [...s.holdPoints, ...s.stagingPoints, ...s.retakePoints]) {
        expect(nav.findPath(map.spawns.def[0], pt), `${side} ${pt.x},${pt.z}`).not.toBeNull();
      }
    }
  });
});
