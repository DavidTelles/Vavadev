import { MAX_HP, START_CREDITS } from '../constants';
import { CHARACTER_BY_ID, type AbilityDef, type CharacterDefinition } from '../data/characters';
import { WEAPONS, type WeaponDef } from '../data/weapons';
import type { AbilitySlot, Difficulty, InputCommand, Team, Vec3 } from '../types';
import { emptyInput } from '../types';
import { Motor } from './movement/Motor';
import type { PhysicsWorld } from './physics/PhysicsWorld';

export interface WeaponState {
  def: WeaponDef;
  ammo: number;
  reserve: number;
}

export interface AbilityState {
  def: AbilityDef;
  charges: number;
  cooldownLeft: number;
}

export interface AgentStats {
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damage: number;
  plants: number;
  defuses: number;
}

export const SLOTS: AbilitySlot[] = ['C', 'Q', 'E', 'X'];

export function makeWeapon(id: string): WeaponState {
  const def = WEAPONS[id];
  return { def, ammo: def.mag, reserve: def.reserve };
}

export class Agent {
  readonly motor: Motor;
  readonly character: CharacterDefinition;
  yaw = 0;
  pitch = 0;
  hp = MAX_HP;
  armor = 0;
  alive = true;
  credits = START_CREDITS;
  slots: Array<WeaponState | null> = [null, null, makeWeapon('faisca'), makeWeapon('faca')];
  current = 2;
  previous = 3;
  ultWeapon: WeaponState | null = null;
  ultWeaponUntil = 0;
  abilities: Record<AbilitySlot, AbilityState>;
  ultPoints = 0;
  hasSpike = false;
  stats: AgentStats = { kills: 0, deaths: 0, assists: 0, score: 0, damage: 0, plants: 0, defuses: 0 };
  input: InputCommand = emptyInput();
  prevInput: InputCommand = emptyInput();

  nextFireTime = 0;
  reloadEnd = 0;
  equipEnd = 0;
  spread = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  shotsInBurst = 0;
  lastShotTime = -10;

  blindUntil = 0;
  blindStrength = 0;
  slowUntil = 0;
  slowMult = 1;
  revealedUntil = 0;
  furyUntil = 0;
  healPerSec = 0;
  healUntil = 0;
  shieldRegen = 0;
  diedAt = 0;
  deathPos: Vec3 = { x: 0, y: 0, z: 0 };
  lastDamageTime = -10;
  lastDamageFrom: Vec3 | null = null;
  damageBy = new Map<number, number>();
  stepAcc = 0;
  plantProgress = 0;
  defuseProgress = 0;
  lastNoiseTime = -10;
  lastNoisePos: Vec3 = { x: 0, y: 0, z: 0 };
  survivedRound = false;
  sideKills = 0;
  readonly squad: 0 | 1;
  boughtThisRound: string[] = [];

  constructor(
    readonly id: number,
    readonly name: string,
    public team: Team,
    characterId: string,
    readonly isBot: boolean,
    public difficulty: Difficulty,
    physics: PhysicsWorld,
    spawn: Vec3,
  ) {
    this.squad = team === 'atk' ? 0 : 1;
    this.character = CHARACTER_BY_ID[characterId] ?? CHARACTER_BY_ID.david;
    this.motor = new Motor(physics, spawn);
    this.abilities = {
      C: { def: this.character.abilities.C, charges: 0, cooldownLeft: 0 },
      Q: { def: this.character.abilities.Q, charges: 0, cooldownLeft: 0 },
      E: { def: this.character.abilities.E, charges: 0, cooldownLeft: 0 },
      X: { def: this.character.abilities.X, charges: 0, cooldownLeft: 0 },
    };
  }

  get pos(): Vec3 {
    return this.motor.pos;
  }

  get weapon(): WeaponState {
    if (this.ultWeapon) return this.ultWeapon;
    return this.slots[this.current] ?? this.slots[3]!;
  }

  get primary(): WeaponState | null {
    return this.slots[1];
  }

  get secondary(): WeaponState | null {
    return this.slots[2];
  }

  get ultReady(): boolean {
    return this.ultPoints >= this.abilities.X.def.ultPoints;
  }

  eye(out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    return this.motor.eye(out);
  }

  forward(out: Vec3 = { x: 0, y: 0, z: 0 }): Vec3 {
    const cp = Math.cos(this.pitch);
    out.x = -Math.sin(this.yaw) * cp;
    out.y = Math.sin(this.pitch);
    out.z = -Math.cos(this.yaw) * cp;
    return out;
  }

  isBlind(time: number): boolean {
    return time < this.blindUntil;
  }

  resetForRound(spawn: Vec3, yaw: number, keepLoadout: boolean): void {
    this.alive = true;
    this.hp = MAX_HP;
    this.motor.setEnabled(true);
    this.motor.teleport(spawn);
    this.yaw = yaw;
    this.pitch = 0;
    this.hasSpike = false;
    this.ultWeapon = null;
    this.blindUntil = this.slowUntil = this.revealedUntil = this.furyUntil = this.healUntil = 0;
    this.slowMult = 1;
    this.shieldRegen = 0;
    this.spread = this.recoilPitch = this.recoilYaw = 0;
    this.reloadEnd = this.equipEnd = this.nextFireTime = 0;
    this.damageBy.clear();
    this.plantProgress = this.defuseProgress = 0;
    if (!keepLoadout) {
      this.slots = [null, null, makeWeapon('faisca'), makeWeapon('faca')];
      this.armor = 0;
    } else {
      for (const w of this.slots) if (w) { w.ammo = w.def.mag; w.reserve = w.def.reserve; }
    }
    this.current = this.slots[1] ? 1 : 2;
    for (const s of SLOTS) {
      const a = this.abilities[s];
      a.cooldownLeft = 0;
      if (s === 'X') continue;
      a.charges = Math.max(a.charges, a.def.freeCharges);
    }
  }

  dispose(): void {
    this.motor.dispose();
  }
}
