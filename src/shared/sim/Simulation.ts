import { TICK_DT } from '../constants';
import { WEAPONS, type WeaponDef } from '../data/weapons';
import type { MapDefinition } from '../data/maps/MapDefinition';
import { inZone } from '../data/maps/MapDefinition';
import { getUsinaMap } from '../data/maps/usina';
import { EventBus } from '../events';
import type { Difficulty, InputCommand, MatchMode, Team, Vec3 } from '../types';
import { Agent, makeWeapon, type WeaponState } from './Agent';
import { AbilitySystem } from './abilities/AbilitySystem';
import { CombatSystem } from './combat/CombatSystem';
import { MatchController } from './match/MatchController';
import { initPhysics, PhysicsWorld } from './physics/PhysicsWorld';
import { BotController } from './bots/BotController';

export interface AgentSetup {
  name: string;
  team: Team;
  characterId: string;
  isBot: boolean;
  difficulty: Difficulty;
}

export interface SimOptions {
  mode: MatchMode;
  agents: AgentSetup[];
  seed?: number;
  mapId?: string;
  /** Attach the bot AI to every isBot agent (default true). */
  bots?: boolean;
}

export interface GroundWeapon {
  id: number;
  weapon: WeaponState;
  pos: Vec3;
  droppedAt: number;
}

export interface Controller {
  update(dt: number): void;
  onRoundStart?(): void;
  dispose?(): void;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tmpEye: Vec3 = { x: 0, y: 0, z: 0 };

export class Simulation {
  readonly events = new EventBus();
  readonly physics: PhysicsWorld;
  readonly map: MapDefinition;
  readonly agents: Agent[] = [];
  readonly combat: CombatSystem;
  readonly abilities: AbilitySystem;
  readonly match: MatchController;
  readonly controllers: Controller[] = [];
  readonly groundWeapons: GroundWeapon[] = [];
  readonly rng: () => number;
  time = 0;
  tick = 0;
  private nextGroundId = 1;

  static async create(opts: SimOptions): Promise<Simulation> {
    await initPhysics();
    const sim = new Simulation(opts);
    if (opts.bots !== false) sim.controllers.push(new BotController(sim));
    return sim;
  }

  private constructor(readonly opts: SimOptions) {
    this.rng = mulberry32(opts.seed ?? (Date.now() & 0xffffffff));
    this.map = getUsinaMap();
    this.physics = new PhysicsWorld();
    this.physics.loadMap(this.map);
    this.combat = new CombatSystem(this);
    this.abilities = new AbilitySystem(this);
    let id = 1;
    const counters: Record<Team, number> = { atk: 0, def: 0 };
    for (const s of opts.agents) {
      const spawn = this.map.spawns[s.team][counters[s.team]++ % 5];
      this.agents.push(new Agent(id++, s.name, s.team, s.characterId, s.isBot, s.difficulty, this.physics, spawn));
    }
    this.match = new MatchController(this);
  }

  get mode(): MatchMode {
    return this.opts.mode;
  }

  start(): void {
    this.match.start();
  }

  agentById(id: number): Agent | undefined {
    return this.agents.find((a) => a.id === id);
  }

  weaponDefById(id: string): WeaponDef | undefined {
    return WEAPONS[id];
  }

  setInput(agentId: number, cmd: InputCommand): void {
    const a = this.agentById(agentId);
    if (a) Object.assign(a.input, cmd);
  }

  isFrozen(a: Agent): boolean {
    return this.match.phase === 'matchEnd' || (a.plantProgress > 0 || a.defuseProgress > 0);
  }

  step(dt = TICK_DT): void {
    this.time += dt;
    this.tick++;
    for (const c of this.controllers) c.update(dt);

    for (const a of this.agents) {
      if (!a.alive) {
        a.prevInput = { ...a.input };
        continue;
      }
      this.updateAgent(a, dt);
      a.prevInput = { ...a.input };
      a.input.ability = null;
    }
    this.abilities.update(dt);
    this.match.update(dt);
    this.physics.step();
  }

  private updateAgent(a: Agent, dt: number): void {
    const inp = a.input;
    const t = this.time;
    a.yaw = inp.yaw;
    a.pitch = Math.max(-1.5, Math.min(1.5, inp.pitch));

    let speedMult = a.weapon.def.moveMult;
    if (t < a.slowUntil) speedMult *= a.slowMult;
    if (t < a.furyUntil) speedMult *= 1.15;
    if (a.plantProgress > 0 || a.defuseProgress > 0) speedMult = 0;
    a.motor.speedMult = speedMult;

    const frozen = this.match.isMovementLocked(a);
    a.motor.step({
      moveX: frozen ? 0 : inp.moveX,
      moveZ: frozen ? 0 : inp.moveZ,
      yaw: a.yaw,
      jump: !frozen && inp.jump && !a.prevInput.jump,
      crouch: inp.crouch,
      walk: inp.walk,
    }, dt);
    this.match.clampToBuyZone(a);

    if (a.motor.jumped) this.events.emit('jump', { agentId: a.id });
    if (a.motor.landed) this.events.emit('land', { agentId: a.id });
    const sp = a.motor.horizontalSpeed();
    if (a.motor.grounded && sp > 1) {
      a.stepAcc += sp * dt;
      if (a.stepAcc > 2.1) {
        a.stepAcc = 0;
        const loud = sp > 4.2 && a.motor.crouch < 0.5;
        this.events.emit('footstep', { agentId: a.id, pos: { ...a.pos }, loud });
        if (loud) {
          a.lastNoiseTime = t;
          a.lastNoisePos = { ...a.pos };
        }
      }
    }

    if (t < a.healUntil) this.combat.heal(a, a.healPerSec * dt);
    if (t < a.furyUntil && a.shieldRegen > 0 && a.armor < a.shieldRegen) a.armor = Math.min(a.shieldRegen, a.armor + 15 * dt);
    if (a.ultWeapon && t > a.ultWeaponUntil) this.endUltWeapon(a);

    if (inp.ability) this.abilities.cast(a, inp.ability);
    this.combat.updateAgent(a, dt);
    this.updatePickup(a);
  }

  endUltWeapon(a: Agent): void {
    if (!a.ultWeapon) return;
    a.ultWeapon = null;
    a.equipEnd = this.time + 0.4;
    this.events.emit('equip', { agentId: a.id, weaponId: a.weapon.def.id });
  }

  private updatePickup(a: Agent): void {
    const pressed = a.input.interact && !a.prevInput.interact;
    for (let i = this.groundWeapons.length - 1; i >= 0; i--) {
      const g = this.groundWeapons[i];
      const d = Math.hypot(g.pos.x - a.pos.x, g.pos.z - a.pos.z);
      if (d > 1.8 || Math.abs(g.pos.y - a.pos.y) > 1.5) continue;
      const slot = g.weapon.def.slot;
      const empty = !a.slots[slot];
      if (empty && this.time - g.droppedAt > 0.6) {
        this.giveGround(a, i);
        return;
      }
      if (pressed && !this.match.nearSpikeForDefuse(a)) {
        const old = a.slots[slot];
        this.giveGround(a, i);
        if (old) this.spawnGround(old, a.pos);
        return;
      }
    }
  }

  private giveGround(a: Agent, index: number): void {
    const g = this.groundWeapons[index];
    this.groundWeapons.splice(index, 1);
    const slot = g.weapon.def.slot;
    a.slots[slot] = g.weapon;
    if (slot <= a.current || a.current === 3) {
      a.current = slot;
      a.equipEnd = this.time + g.weapon.def.equipTime;
      a.reloadEnd = 0;
    }
    this.events.emit('equip', { agentId: a.id, weaponId: a.weapon.def.id });
  }

  spawnGround(w: WeaponState, pos: Vec3): void {
    this.groundWeapons.push({ id: this.nextGroundId++, weapon: w, pos: { x: pos.x, y: pos.y + 0.05, z: pos.z }, droppedAt: this.time });
  }

  dropCurrentWeapon(a: Agent): void {
    if (a.ultWeapon || a.current === 3) return;
    const w = a.slots[a.current];
    if (!w) return;
    a.slots[a.current] = null;
    a.eye(tmpEye);
    const f = a.forward();
    this.spawnGround(w, { x: a.pos.x + f.x * 1.2, y: a.pos.y, z: a.pos.z + f.z * 1.2 });
    a.current = a.slots[1] ? 1 : a.slots[2] ? 2 : 3;
    a.equipEnd = this.time + a.weapon.def.equipTime;
    this.events.emit('equip', { agentId: a.id, weaponId: a.weapon.def.id });
  }

  dropWeaponsOnDeath(a: Agent): void {
    const w = a.slots[1] ?? (a.slots[2] && a.slots[2].def.id !== 'faisca' ? a.slots[2] : null);
    if (w) {
      if (a.slots[1] === w) a.slots[1] = null;
      else a.slots[2] = makeWeapon('faisca');
      this.spawnGround(w, a.pos);
    }
  }

  clearGroundWeapons(): void {
    this.groundWeapons.length = 0;
  }

  dropSpike(a: Agent): void {
    this.match.dropSpike(a);
  }

  buy(agentId: number, item: string): boolean {
    const a = this.agentById(agentId);
    if (!a) return false;
    return this.match.buy(a, item);
  }

  canSee(from: Vec3, to: Vec3): boolean {
    if (this.abilities.segmentBlockedBySmoke(from, to)) return false;
    return this.physics.lineClear(from, to);
  }

  inSpawnZone(a: Agent): boolean {
    return inZone(this.map.spawnZones[a.team], a.pos.x, a.pos.z);
  }

  dispose(): void {
    for (const c of this.controllers) c.dispose?.();
    this.events.clear();
    for (const a of this.agents) a.dispose();
    this.physics.dispose();
  }
}
