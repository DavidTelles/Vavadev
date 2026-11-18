import RAPIER from '@dimforge/rapier3d-compat';
import { GROUP_AGENT, GROUP_BARRIER, GROUP_WORLD } from '../../constants';
import type { MapDefinition } from '../../data/maps/MapDefinition';
import type { Vec3 } from '../../types';

let initPromise: Promise<void> | null = null;

export function initPhysics(): Promise<void> {
  if (!initPromise) initPromise = RAPIER.init();
  return initPromise;
}

export const groups = (membership: number, filter: number): number => ((membership & 0xffff) << 16) | (filter & 0xffff);

export const MOVE_FILTER = groups(GROUP_AGENT, GROUP_WORLD | GROUP_AGENT | GROUP_BARRIER);
export const SHOT_FILTER = groups(0xffff, GROUP_WORLD | GROUP_BARRIER);
export const SIGHT_FILTER = groups(0xffff, GROUP_WORLD | GROUP_BARRIER);

export interface RayHit {
  dist: number;
  point: Vec3;
  normal: Vec3;
  barrierId: number | null;
}

export class PhysicsWorld {
  readonly world: RAPIER.World;
  private readonly ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  private readonly barrierIds = new Map<number, number>();

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  }

  loadMap(map: MapDefinition): void {
    for (const b of map.boxes) this.addStaticBox(b.min, b.max, GROUP_WORLD);
    const pad = 0.5;
    const h = 30;
    this.addStaticBox({ x: map.minX - pad, y: -1, z: map.minZ - pad }, { x: map.minX, y: h, z: map.maxZ + pad }, GROUP_WORLD);
    this.addStaticBox({ x: map.maxX, y: -1, z: map.minZ - pad }, { x: map.maxX + pad, y: h, z: map.maxZ + pad }, GROUP_WORLD);
    this.addStaticBox({ x: map.minX, y: -1, z: map.minZ - pad }, { x: map.maxX, y: h, z: map.minZ }, GROUP_WORLD);
    this.addStaticBox({ x: map.minX, y: -1, z: map.maxZ }, { x: map.maxX, y: h, z: map.maxZ + pad }, GROUP_WORLD);
    this.world.step();
  }

  addStaticBox(min: Vec3, max: Vec3, group: number, rotY = 0): RAPIER.Collider {
    const hx = (max.x - min.x) / 2;
    const hy = (max.y - min.y) / 2;
    const hz = (max.z - min.z) / 2;
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(min.x + hx, min.y + hy, min.z + hz)
      .setCollisionGroups(groups(group, 0xffff));
    if (rotY) desc.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    return this.world.createCollider(desc);
  }

  addBarrier(center: Vec3, half: Vec3, rotY: number, id: number): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      .setTranslation(center.x, center.y, center.z)
      .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) })
      .setCollisionGroups(groups(GROUP_BARRIER, 0xffff));
    const c = this.world.createCollider(desc);
    this.barrierIds.set(c.handle, id);
    return c;
  }

  removeCollider(c: RAPIER.Collider): void {
    this.barrierIds.delete(c.handle);
    this.world.removeCollider(c, false);
  }

  raycast(origin: Vec3, dir: Vec3, maxDist: number, filter = SHOT_FILTER): RayHit | null {
    this.ray.origin = origin;
    this.ray.dir = dir;
    const hit = this.world.castRayAndGetNormal(this.ray, maxDist, true, undefined, filter);
    if (!hit) return null;
    const t = hit.timeOfImpact;
    return {
      dist: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      normal: { x: hit.normal.x, y: hit.normal.y, z: hit.normal.z },
      barrierId: this.barrierIds.get(hit.collider.handle) ?? null,
    };
  }

  lineClear(a: Vec3, b: Vec3, filter = SIGHT_FILTER): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    const inv = 1 / d;
    return this.raycast(a, { x: dx * inv, y: dy * inv, z: dz * inv }, d, filter) === null;
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
  }
}
