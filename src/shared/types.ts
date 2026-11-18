export interface Vec3 { x: number; y: number; z: number }

export type Team = 'atk' | 'def';
export type Side = 'A' | 'B';
export type BodyPart = 'head' | 'body' | 'legs';
export type Role = 'duelista' | 'controlador' | 'iniciador' | 'sentinela';
export type Difficulty = 'facil' | 'normal' | 'dificil';
export type AbilitySlot = 'C' | 'Q' | 'E' | 'X';
export type MatchMode = 'competitivo' | 'rapida' | 'treino';

export interface InputCommand {
  moveX: number;
  moveZ: number;
  yaw: number;
  pitch: number;
  jump: boolean;
  crouch: boolean;
  walk: boolean;
  fire: boolean;
  aim: boolean;
  reload: boolean;
  slot: number;
  ability: AbilitySlot | null;
  interact: boolean;
  drop: boolean;
}

export function emptyInput(): InputCommand {
  return { moveX: 0, moveZ: 0, yaw: 0, pitch: 0, jump: false, crouch: false, walk: false, fire: false, aim: false, reload: false, slot: 0, ability: null, interact: false, drop: false };
}

export const v3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const v3copy = (a: Vec3): Vec3 => ({ x: a.x, y: a.y, z: a.z });
export const v3dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export const v3dist2D = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
