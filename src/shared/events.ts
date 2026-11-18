import type { AbilitySlot, BodyPart, Side, Team, Vec3 } from './types';

export type RoundEndReason = 'eliminacao' | 'explosao' | 'desarme' | 'tempo';
export type MatchPhase = 'warmup' | 'buy' | 'combat' | 'planted' | 'roundEnd' | 'matchEnd';

export interface SimEvents {
  shot: { agentId: number; weaponId: string; origin: Vec3; end: Vec3; hitAgent: boolean };
  impact: { point: Vec3; normal: Vec3; surface: 'world' | 'barrier' };
  damage: { attackerId: number; victimId: number; amount: number; part: BodyPart | 'ability'; source: string; from: Vec3 };
  kill: { killerId: number; victimId: number; weaponId: string; headshot: boolean; assists: number[] };
  reloadStart: { agentId: number; weaponId: string };
  equip: { agentId: number; weaponId: string };
  footstep: { agentId: number; pos: Vec3; loud: boolean };
  jump: { agentId: number };
  land: { agentId: number };
  abilityCast: { agentId: number; slot: AbilitySlot; abilityId: string; pos: Vec3 };
  effectSpawn: { effectId: number; kind: string; abilityId: string; ownerId: number; pos: Vec3; radius: number; color: number; duration: number; rotY: number; team: Team };
  effectEnd: { effectId: number };
  projectileSpawn: { projId: number; abilityId: string; color: number; pos: Vec3 };
  projectileEnd: { projId: number };
  explosion: { pos: Vec3; radius: number; color: number; big: boolean };
  flashPop: { pos: Vec3; color: number };
  blinded: { agentId: number; duration: number };
  revealed: { agentId: number; byTeam: Team; duration: number };
  phase: { phase: MatchPhase; time: number };
  roundStart: { round: number };
  roundEnd: { winner: Team; reason: RoundEndReason; round: number };
  sideSwap: Record<string, never>;
  matchEnd: { winner: Team; score: Record<Team, number> };
  spikePickup: { agentId: number };
  spikeDrop: { pos: Vec3 };
  spikePlanted: { agentId: number; pos: Vec3; site: Side };
  spikeDefused: { agentId: number };
  spikeExploded: { pos: Vec3 };
  plantProgress: { agentId: number; t: number };
  defuseProgress: { agentId: number; t: number };
  revive: { agentId: number };
  purchase: { agentId: number; item: string };
  voice: { agentId: number; line: 'select' | 'ult' | 'kill' | 'plant' | 'win' };
  notice: { text: string; team: Team | null };
}

type Handler<T> = (payload: T) => void;

export class EventBus<E extends object = SimEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
