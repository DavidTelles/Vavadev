import type { Side, Team, Vec3 } from '../../types';

export type BoxKind = 'wall' | 'crate' | 'tallcrate' | 'machine' | 'platform' | 'lintel' | 'ground';
export type FloorKind = 'floor' | 'site' | 'spawn' | 'platform';

export interface MapBox {
  min: Vec3;
  max: Vec3;
  kind: BoxKind;
}

export interface FloorPatch {
  min: Vec3;
  max: Vec3;
  kind: FloorKind;
}

export interface MapZone {
  id: string;
  name: string;
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface CoverPoint {
  pos: Vec3;
  nx: number;
  nz: number;
}

export interface LightSpot {
  pos: Vec3;
  color: number;
  intensity: number;
}

export interface SiteInfo {
  side: Side;
  zone: MapZone;
  center: Vec3;
  holdPoints: Vec3[];
  stagingPoints: Vec3[];
  retakePoints: Vec3[];
}

export interface MapDefinition {
  id: string;
  name: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  boxes: MapBox[];
  floors: FloorPatch[];
  spawns: Record<Team, Vec3[]>;
  spawnYaw: Record<Team, number>;
  spawnZones: Record<Team, MapZone>;
  sites: Record<Side, SiteInfo>;
  callouts: MapZone[];
  coverPoints: CoverPoint[];
  midPoints: Vec3[];
  lights: LightSpot[];
  solidAt(x: number, z: number): boolean;
  floorHeightAt(x: number, z: number): number;
}

export function inZone(z: MapZone, x: number, zz: number): boolean {
  return x >= z.minX && x <= z.maxX && zz >= z.minZ && zz <= z.maxZ;
}
