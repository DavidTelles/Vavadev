import {
  BUY_TIME, DEFUSE_HALF, DEFUSE_TIME, HEAVY_ARMOR, LIGHT_ARMOR, LOSS_REWARDS, MAX_CREDITS, MAX_HP, PLANT_REWARD, PLANT_TIME,
  ROUND_END_TIME, ROUND_TIME, ROUNDS_PER_HALF_FULL, ROUNDS_PER_HALF_QUICK, ROUNDS_TO_WIN_FULL, ROUNDS_TO_WIN_QUICK,
  SPIKE_BLAST_RADIUS, SPIKE_TIME, START_CREDITS, ULT_POINT_DEFUSE, ULT_POINT_PLANT, WIN_REWARD,
} from '../../constants';
import { ARMOR_ITEMS, WEAPONS } from '../../data/weapons';
import { inZone } from '../../data/maps/MapDefinition';
import type { MatchPhase, RoundEndReason } from '../../events';
import type { AbilitySlot, Side, Team, Vec3 } from '../../types';
import { makeWeapon, type Agent } from '../Agent';
import type { Simulation } from '../Simulation';

export type SpikeStatus = 'none' | 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded';

export interface SpikeState {
  status: SpikeStatus;
  carrierId: number;
  pos: Vec3;
  site: Side | null;
  plantedAt: number;
  defuseCheckpoint: boolean;
}

export interface RoundRecord {
  round: number;
  winnerSquad: 0 | 1;
  reason: RoundEndReason;
}

export class MatchController {
  phase: MatchPhase = 'warmup';
  phaseEnd = 0;
  round = 0;
  readonly squadScore: [number, number] = [0, 0];
  private lossStreak: [number, number] = [0, 0];
  readonly history: RoundRecord[] = [];
  spike: SpikeState = { status: 'none', carrierId: -1, pos: { x: 0, y: 0, z: 0 }, site: null, plantedAt: 0, defuseCheckpoint: false };
  winnerSquad: 0 | 1 | null = null;
  lastRoundWinner: Team | null = null;
  lastRoundReason: RoundEndReason | null = null;
  private plantedThisRound = false;

  constructor(private readonly sim: Simulation) {}

  get halfLength(): number {
    return this.sim.mode === 'rapida' ? ROUNDS_PER_HALF_QUICK : ROUNDS_PER_HALF_FULL;
  }

  get roundsToWin(): number {
    return this.sim.mode === 'rapida' ? ROUNDS_TO_WIN_QUICK : ROUNDS_TO_WIN_FULL;
  }

  get timeLeft(): number {
    return Math.max(0, this.phaseEnd - this.sim.time);
  }

  sideOfSquad(squad: 0 | 1): Team {
    const swapped = this.round > this.halfLength;
    const base: Team = squad === 0 ? 'atk' : 'def';
    return swapped ? (base === 'atk' ? 'def' : 'atk') : base;
  }

  scoreOf(team: Team): number {
    return this.squadScore[this.sideOfSquad(0) === team ? 0 : 1];
  }

  start(): void {
    if (this.sim.mode === 'treino') {
      this.phase = 'warmup';
      this.round = 1;
      for (const a of this.sim.agents) {
        a.credits = MAX_CREDITS;
        a.resetForRound(this.spawnFor(a), this.sim.map.spawnYaw[a.team], false);
        for (const s of ['C', 'Q', 'E'] as AbilitySlot[]) a.abilities[s].charges = a.abilities[s].def.maxCharges;
        a.ultPoints = a.abilities.X.def.ultPoints;
      }
      this.sim.events.emit('phase', { phase: 'warmup', time: 0 });
      return;
    }
    for (const a of this.sim.agents) a.credits = START_CREDITS;
    this.startRound();
  }

  private spawnFor(a: Agent): Vec3 {
    const team = this.sim.agents.filter((x) => x.team === a.team);
    const idx = team.indexOf(a);
    return this.sim.map.spawns[a.team][idx % 5];
  }

  private startRound(): void {
    this.round++;
    const swap = this.round === this.halfLength + 1;
    if (swap) {
      for (const a of this.sim.agents) {
        a.team = a.team === 'atk' ? 'def' : 'atk';
        a.credits = START_CREDITS;
        for (const s of ['C', 'Q', 'E'] as AbilitySlot[]) a.abilities[s].charges = 0;
        a.survivedRound = false;
      }
      this.lossStreak = [0, 0];
      this.sim.events.emit('sideSwap', {});
    }
    this.sim.abilities.clearAll();
    this.sim.clearGroundWeapons();
    this.plantedThisRound = false;
    for (const a of this.sim.agents) {
      a.resetForRound(this.spawnFor(a), this.sim.map.spawnYaw[a.team], a.survivedRound && !swap);
      a.boughtThisRound = [];
      a.survivedRound = false;
    }
    const attackers = this.sim.agents.filter((a) => a.team === 'atk');
    const carrier = attackers[Math.floor(this.sim.rng() * attackers.length)];
    this.spike = { status: 'carried', carrierId: carrier.id, pos: { ...carrier.pos }, site: null, plantedAt: 0, defuseCheckpoint: false };
    carrier.hasSpike = true;
    this.setPhase('buy', BUY_TIME);
    this.sim.events.emit('roundStart', { round: this.round });
    for (const c of this.sim.controllers) c.onRoundStart?.();
  }

  private setPhase(p: MatchPhase, duration: number): void {
    this.phase = p;
    this.phaseEnd = this.sim.time + duration;
    this.sim.events.emit('phase', { phase: p, time: duration });
  }

  skipBuy(): void {
    if (this.phase === 'buy') this.phaseEnd = this.sim.time;
  }

  isMovementLocked(a: Agent): boolean {
    return this.phase === 'matchEnd' || a.plantProgress > 0 || a.defuseProgress > 0;
  }

  clampToBuyZone(a: Agent): void {
    if (this.phase !== 'buy') return;
    const z = this.sim.map.spawnZones[a.team];
    const m = 0.45;
    a.pos.x = Math.min(z.maxX - m, Math.max(z.minX + m, a.pos.x));
    a.pos.z = Math.min(z.maxZ - m, Math.max(z.minZ + m, a.pos.z));
  }

  canBuy(a: Agent): boolean {
    if (this.sim.mode === 'treino') return true;
    return a.alive && (this.phase === 'buy' || (this.phase === 'combat' && this.sim.time < this.phaseEnd - ROUND_TIME + 10 && this.sim.inSpawnZone(a)));
  }

  buy(a: Agent, item: string): boolean {
    if (!this.canBuy(a)) return false;
    const w = WEAPONS[item];
    if (w && w.cost > 0) {
      if (a.slots[w.slot]?.def.id === item) return false;
      if (a.credits < w.cost) return false;
      const old = a.slots[w.slot];
      if (old && old.def.id !== 'faisca' && a.boughtThisRound.includes(old.def.id)) {
        a.credits += old.def.cost;
        a.boughtThisRound = a.boughtThisRound.filter((x) => x !== old.def.id);
      } else if (old && old.def.id !== 'faisca') {
        this.sim.spawnGround(old, a.pos);
      }
      a.credits -= w.cost;
      a.slots[w.slot] = makeWeapon(item);
      a.current = w.slot;
      a.equipEnd = this.sim.time + 0.3;
      a.boughtThisRound.push(item);
      this.sim.events.emit('purchase', { agentId: a.id, item });
      this.sim.events.emit('equip', { agentId: a.id, weaponId: item });
      return true;
    }
    const armor = ARMOR_ITEMS.find((x) => x.id === item);
    if (armor) {
      if (a.armor >= armor.amount || a.credits < armor.cost) return false;
      a.credits -= armor.cost;
      a.armor = armor.amount;
      this.sim.events.emit('purchase', { agentId: a.id, item });
      return true;
    }
    const slot = item as AbilitySlot;
    if (slot === 'C' || slot === 'Q' || slot === 'E') {
      const st = a.abilities[slot];
      if (st.def.cost <= 0 || st.charges >= st.def.maxCharges || a.credits < st.def.cost) return false;
      a.credits -= st.def.cost;
      st.charges++;
      this.sim.events.emit('purchase', { agentId: a.id, item: st.def.id });
      return true;
    }
    return false;
  }

  revive(a: Agent): void {
    a.alive = true;
    a.hp = MAX_HP;
    a.motor.setEnabled(true);
    a.motor.teleport({ ...a.deathPos });
    a.damageBy.clear();
    this.sim.events.emit('revive', { agentId: a.id });
  }

  dropSpike(a: Agent): void {
    if (!a.hasSpike) return;
    a.hasSpike = false;
    this.spike.status = 'dropped';
    this.spike.carrierId = -1;
    this.spike.pos = { ...a.pos };
    this.sim.events.emit('spikeDrop', { pos: { ...a.pos } });
  }

  nearSpikeForDefuse(a: Agent): boolean {
    return this.spike.status === 'planted' && a.team === 'def' && Math.hypot(a.pos.x - this.spike.pos.x, a.pos.z - this.spike.pos.z) < 1.8 && Math.abs(a.pos.y - this.spike.pos.y) < 1.5;
  }

  siteAt(p: Vec3): Side | null {
    for (const s of ['A', 'B'] as Side[]) if (inZone(this.sim.map.sites[s].zone, p.x, p.z)) return s;
    return null;
  }

  update(dt: number): void {
    const t = this.sim.time;
    if (this.sim.mode === 'treino') {
      this.updateTraining();
      return;
    }
    if (this.phase === 'matchEnd') return;
    this.updateSpikeCarry(dt);

    switch (this.phase) {
      case 'buy':
        if (t >= this.phaseEnd) this.setPhase('combat', ROUND_TIME);
        break;
      case 'combat':
        this.checkElimination();
        if (this.phase === 'combat' && t >= this.phaseEnd) this.endRound('def', 'tempo');
        break;
      case 'planted':
        this.checkElimination();
        if (this.phase === 'planted' && t >= this.phaseEnd) this.explode();
        break;
      case 'roundEnd':
        if (t >= this.phaseEnd) this.afterRound();
        break;
    }
  }

  private updateTraining(): void {
    const t = this.sim.time;
    for (const a of this.sim.agents) {
      if (!a.alive && t - a.diedAt > 3) {
        a.resetForRound(this.spawnFor(a), this.sim.map.spawnYaw[a.team], true);
      }
      if (!a.isBot) {
        a.credits = MAX_CREDITS;
        if (a.alive && t - a.lastDamageTime > 4) a.hp = MAX_HP;
      }
    }
  }

  private updateSpikeCarry(dt: number): void {
    const sp = this.spike;
    if (sp.status === 'carried') {
      const c = this.sim.agentById(sp.carrierId);
      if (c) sp.pos = { ...c.pos };
    }
    if (sp.status === 'dropped') {
      for (const a of this.sim.agents) {
        if (!a.alive || a.team !== 'atk') continue;
        if (Math.hypot(a.pos.x - sp.pos.x, a.pos.z - sp.pos.z) < 1.3 && Math.abs(a.pos.y - sp.pos.y) < 1.6) {
          a.hasSpike = true;
          sp.status = 'carried';
          sp.carrierId = a.id;
          this.sim.events.emit('spikePickup', { agentId: a.id });
          break;
        }
      }
    }

    for (const a of this.sim.agents) {
      if (!a.alive) {
        a.plantProgress = a.defuseProgress = 0;
        continue;
      }
      const holding = a.input.interact;
      if (a.hasSpike && (this.phase === 'combat') && holding && a.motor.grounded) {
        const site = this.siteAt(a.pos);
        if (site) {
          a.plantProgress += dt;
          this.sim.events.emit('plantProgress', { agentId: a.id, t: a.plantProgress / PLANT_TIME });
          if (a.plantProgress >= PLANT_TIME) this.plant(a, site);
          continue;
        }
      }
      if (a.plantProgress > 0) {
        a.plantProgress = 0;
        this.sim.events.emit('plantProgress', { agentId: a.id, t: 0 });
      }
      if (this.phase === 'planted' && holding && this.nearSpikeForDefuse(a)) {
        if (a.defuseProgress === 0 && sp.defuseCheckpoint) a.defuseProgress = DEFUSE_HALF;
        a.defuseProgress += dt;
        if (a.defuseProgress >= DEFUSE_HALF) sp.defuseCheckpoint = true;
        this.sim.events.emit('defuseProgress', { agentId: a.id, t: a.defuseProgress / DEFUSE_TIME });
        if (a.defuseProgress >= DEFUSE_TIME) this.defuse(a);
      } else if (a.defuseProgress > 0) {
        a.defuseProgress = 0;
        this.sim.events.emit('defuseProgress', { agentId: a.id, t: 0 });
      }
    }
  }

  private plant(a: Agent, site: Side): void {
    a.plantProgress = 0;
    a.hasSpike = false;
    a.stats.plants++;
    a.stats.score += 100;
    a.ultPoints = Math.min(a.ultPoints + ULT_POINT_PLANT, a.abilities.X.def.ultPoints);
    this.plantedThisRound = true;
    this.spike = { status: 'planted', carrierId: -1, pos: { ...a.pos }, site, plantedAt: this.sim.time, defuseCheckpoint: false };
    this.setPhase('planted', SPIKE_TIME);
    this.sim.events.emit('spikePlanted', { agentId: a.id, pos: { ...a.pos }, site });
    this.sim.events.emit('voice', { agentId: a.id, line: 'plant' });
  }

  private defuse(a: Agent): void {
    a.defuseProgress = 0;
    a.stats.defuses++;
    a.stats.score += 100;
    a.ultPoints = Math.min(a.ultPoints + ULT_POINT_DEFUSE, a.abilities.X.def.ultPoints);
    this.spike.status = 'defused';
    this.sim.events.emit('spikeDefused', { agentId: a.id });
    this.endRound('def', 'desarme');
  }

  private explode(): void {
    const sp = this.spike;
    sp.status = 'exploded';
    this.sim.events.emit('spikeExploded', { pos: { ...sp.pos } });
    this.sim.events.emit('explosion', { pos: { ...sp.pos }, radius: SPIKE_BLAST_RADIUS, color: 0xff5a3a, big: true });
    for (const a of this.sim.agents) {
      if (!a.alive) continue;
      const d = Math.hypot(a.pos.x - sp.pos.x, a.pos.y - sp.pos.y, a.pos.z - sp.pos.z);
      if (d < SPIKE_BLAST_RADIUS) this.sim.combat.kill(null, a, 'spike', false);
    }
    this.endRound('atk', 'explosao');
  }

  private checkElimination(): void {
    const atkAlive = this.sim.agents.some((a) => a.alive && a.team === 'atk');
    const defAlive = this.sim.agents.some((a) => a.alive && a.team === 'def');
    if (!defAlive) {
      this.endRound('atk', 'eliminacao');
    } else if (!atkAlive && this.phase === 'combat') {
      this.endRound('def', 'eliminacao');
    }
  }

  private endRound(winner: Team, reason: RoundEndReason): void {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return;
    const winSquad: 0 | 1 = this.sideOfSquad(0) === winner ? 0 : 1;
    const loseSquad: 0 | 1 = winSquad === 0 ? 1 : 0;
    this.squadScore[winSquad]++;
    this.history.push({ round: this.round, winnerSquad: winSquad, reason });
    this.lastRoundWinner = winner;
    this.lastRoundReason = reason;
    const streak = this.lossStreak[loseSquad];
    this.lossStreak[loseSquad] = Math.min(streak + 1, LOSS_REWARDS.length);
    this.lossStreak[winSquad] = 0;
    for (const a of this.sim.agents) {
      const won = a.team === winner;
      let reward = won ? WIN_REWARD : LOSS_REWARDS[Math.min(streak, LOSS_REWARDS.length - 1)];
      if (a.team === 'atk' && this.plantedThisRound) reward += PLANT_REWARD;
      a.credits = Math.min(MAX_CREDITS, a.credits + reward);
      a.survivedRound = a.alive;
      if (a.alive && won) a.stats.score += 20;
    }
    this.setPhase('roundEnd', ROUND_END_TIME);
    this.sim.events.emit('roundEnd', { winner, reason, round: this.round });
    const best = this.sim.agents.filter((a) => a.team === winner && a.alive)[0];
    if (best) this.sim.events.emit('voice', { agentId: best.id, line: 'win' });
  }

  private afterRound(): void {
    const target = this.roundsToWin;
    const [s0, s1] = this.squadScore;
    const tie = target - 1;
    let done: 0 | 1 | null = null;
    if (s0 >= target && s0 > s1) done = 0;
    else if (s1 >= target && s1 > s0) done = 1;
    else if (s0 === tie && s1 === tie && this.sim.mode === 'competitivo') done = null;
    if (done !== null) {
      this.winnerSquad = done;
      this.phase = 'matchEnd';
      this.sim.events.emit('phase', { phase: 'matchEnd', time: 0 });
      this.sim.events.emit('matchEnd', { winner: this.sideOfSquad(done), score: { atk: this.scoreOf('atk'), def: this.scoreOf('def') } });
      return;
    }
    this.startRound();
  }

  get armorValues(): [number, number] {
    return [LIGHT_ARMOR, HEAVY_ARMOR];
  }
}
