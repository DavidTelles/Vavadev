import { ARMOR_ABSORB, KILL_REWARD, MAX_CREDITS, MAX_HP, ULT_POINT_KILL, WALK_SPEED } from '../../constants';
import { falloffMult, type WeaponDef } from '../../data/weapons';
import type { BodyPart, Vec3 } from '../../types';
import type { Agent } from '../Agent';
import type { Simulation } from '../Simulation';
import { rayAgent, type AgentHit } from './Hitbox';

const tmpEye: Vec3 = { x: 0, y: 0, z: 0 };
const tmpDir: Vec3 = { x: 0, y: 0, z: 0 };

export class CombatSystem {
  constructor(private readonly sim: Simulation) {}

  updateAgent(a: Agent, dt: number): void {
    const time = this.sim.time;
    const inp = a.input;
    const prev = a.prevInput;
    const w = a.weapon;
    const def = w.def;

    if (inp.slot && inp.slot !== prev.slot) this.switchSlot(a, inp.slot);
    if (inp.drop && !prev.drop) this.sim.dropCurrentWeapon(a);

    const reloading = time < a.reloadEnd;
    if (reloading && time + dt >= a.reloadEnd) this.finishReload(a);

    if (inp.reload && !prev.reload) this.startReload(a);

    const firePressed = inp.fire && (def.auto || !prev.fire);
    const canFire = time >= a.nextFireTime && time >= a.equipEnd && time >= a.reloadEnd && !this.sim.isFrozen(a);
    let fired = false;
    if (firePressed && canFire) {
      if (w.ammo <= 0 && def.category !== 'corpo') {
        this.startReload(a);
      } else {
        this.fire(a, w.def);
        fired = true;
        if (def.category !== 'corpo' && def.mag > 0) w.ammo--;
        const interval = 60 / def.rpm;
        a.nextFireTime = time + interval * (time < a.furyUntil ? 0.8 : 1);
        if (w.ammo <= 0 && def.category !== 'corpo') {
          if (a.ultWeapon === w) this.sim.endUltWeapon(a);
          else a.nextFireTime = Math.max(a.nextFireTime, time + 0.2);
        }
      }
    }

    if (!fired && time - a.lastShotTime > 60 / def.rpm + 0.02) {
      const rec = def.recoilRecovery * dt;
      a.recoilPitch = Math.max(0, a.recoilPitch - rec * (1 + a.recoilPitch * 3));
      a.recoilYaw *= Math.max(0, 1 - dt * 6);
      a.spread = Math.max(0, a.spread - def.spreadMax * dt * 3);
      a.shotsInBurst = 0;
    }
  }

  switchSlot(a: Agent, slot: number): void {
    if (a.ultWeapon) return;
    const target = slot === 3 ? 3 : slot === 2 ? 2 : 1;
    if (!a.slots[target] || a.current === target) return;
    a.previous = a.current;
    a.current = target;
    a.reloadEnd = 0;
    a.equipEnd = this.sim.time + a.slots[target]!.def.equipTime;
    a.spread = 0;
    this.sim.events.emit('equip', { agentId: a.id, weaponId: a.slots[target]!.def.id });
  }

  startReload(a: Agent): void {
    const w = a.weapon;
    if (w.def.category === 'corpo' || w.def.reloadTime <= 0) return;
    if (w.ammo >= w.def.mag || w.reserve <= 0 || this.sim.time < a.reloadEnd) return;
    a.reloadEnd = this.sim.time + w.def.reloadTime * (this.sim.time < a.furyUntil ? 0.6 : 1);
    this.sim.events.emit('reloadStart', { agentId: a.id, weaponId: w.def.id });
  }

  private finishReload(a: Agent): void {
    const w = a.weapon;
    const need = w.def.mag - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take;
    w.reserve -= take;
    a.reloadEnd = 0;
  }

  currentSpread(a: Agent, def: WeaponDef): number {
    const speed = a.motor.horizontalSpeed();
    const moveFrac = Math.max(0, (speed - WALK_SPEED * 0.45) / (6.6 - WALK_SPEED * 0.45));
    let s = def.spreadBase + def.spreadMove * Math.min(1, moveFrac) + a.spread;
    if (!a.motor.grounded) s += def.spreadAir;
    if (a.motor.crouch > 0.5) s *= def.spreadCrouch;
    if (a.input.aim && def.zoom > 1.2) s *= def.spreadAim;
    if (this.sim.time < a.slowUntil && a.slowMult < 0.6) s += 1.5 * (Math.PI / 180);
    return Math.min(s, def.spreadMax + def.spreadMove + def.spreadAir);
  }

  private fire(a: Agent, def: WeaponDef): void {
    const time = this.sim.time;
    const rng = this.sim.rng;
    a.eye(tmpEye);
    const spread = this.currentSpread(a, def);
    const baseYaw = a.yaw + a.recoilYaw;
    const basePitch = a.pitch + a.recoilPitch;
    const pellets = def.pellets;
    const range = def.range;
    let anyHit = false;
    let lastEnd: Vec3 = { x: 0, y: 0, z: 0 };

    for (let p = 0; p < pellets; p++) {
      const r = spread * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const yaw = baseYaw + Math.cos(th) * r;
      const pitch = basePitch + Math.sin(th) * r;
      const cp = Math.cos(pitch);
      tmpDir.x = -Math.sin(yaw) * cp;
      tmpDir.y = Math.sin(pitch);
      tmpDir.z = -Math.cos(yaw) * cp;
      const res = this.trace(a, tmpEye, tmpDir, range, def);
      if (res.agentHit) anyHit = true;
      lastEnd = res.end;
      if (pellets === 1 || p % 4 === 0) {
        this.sim.events.emit('shot', { agentId: a.id, weaponId: def.id, origin: { ...tmpEye }, end: res.end, hitAgent: !!res.agentHit });
      }
    }
    void lastEnd;
    void anyHit;

    a.lastShotTime = time;
    a.shotsInBurst++;
    if (def.category !== 'corpo') {
      const kick = def.recoilPitch * (a.shotsInBurst > 8 ? 0.35 : 1);
      a.recoilPitch = Math.min(a.recoilPitch + kick, 14 * (Math.PI / 180));
      const sway = a.shotsInBurst > 6 ? Math.sin(a.shotsInBurst * 0.55) * 2.2 : (rng() - 0.5);
      a.recoilYaw += def.recoilYaw * sway;
      a.spread = Math.min(a.spread + def.spreadPerShot, def.spreadMax);
    }
    a.lastNoiseTime = time;
    a.lastNoisePos = { ...a.pos };
  }

  private trace(a: Agent, origin: Vec3, dir: Vec3, range: number, def: WeaponDef): { end: Vec3; agentHit: AgentHit | null } {
    let dmgMult = 1;
    let start = origin;
    let travelled = 0;
    for (let pass = 0; pass < 3; pass++) {
      const remaining = range - travelled;
      const world = this.sim.physics.raycast(start, dir, remaining);
      const worldDist = world ? world.dist : remaining;
      let best: AgentHit | null = null;
      for (const t of this.sim.agents) {
        if (t === a || !t.alive || t.team === a.team) continue;
        const h = rayAgent(start, dir, t, worldDist);
        if (h && (!best || h.dist < best.dist)) best = h;
      }
      if (best) {
        const total = travelled + best.dist;
        const end = { x: start.x + dir.x * best.dist, y: start.y + dir.y * best.dist, z: start.z + dir.z * best.dist };
        const base = def.damage[best.part] * falloffMult(def, total) * dmgMult;
        this.applyDamage(a, best.agent, base, best.part, def.id, origin);
        return { end, agentHit: best };
      }
      if (!world) {
        return { end: { x: start.x + dir.x * remaining, y: start.y + dir.y * remaining, z: start.z + dir.z * remaining }, agentHit: null };
      }
      this.sim.events.emit('impact', { point: world.point, normal: world.normal, surface: world.barrierId !== null ? 'barrier' : 'world' });
      if (world.barrierId !== null) {
        this.sim.abilities.damageBarrier(world.barrierId, def.damage.body * dmgMult);
        if (def.penetration >= 2) {
          dmgMult *= 0.6;
          travelled += world.dist + 0.8;
          start = { x: world.point.x + dir.x * 0.8, y: world.point.y + dir.y * 0.8, z: world.point.z + dir.z * 0.8 };
          continue;
        }
      }
      return { end: world.point, agentHit: null };
    }
    return { end: start, agentHit: null };
  }

  applyDamage(attacker: Agent | null, victim: Agent, amount: number, part: BodyPart | 'ability', source: string, from: Vec3): void {
    if (!victim.alive || amount <= 0) return;
    if (this.sim.match.phase === 'buy') return;
    let dmg = amount;
    if (victim.armor > 0) {
      const absorbed = Math.min(victim.armor, dmg * ARMOR_ABSORB);
      victim.armor -= absorbed;
      dmg -= absorbed;
    }
    const dealt = Math.min(victim.hp, dmg);
    victim.hp -= dmg;
    victim.lastDamageTime = this.sim.time;
    victim.lastDamageFrom = { ...from };
    if (attacker && attacker !== victim) {
      victim.damageBy.set(attacker.id, (victim.damageBy.get(attacker.id) ?? 0) + dealt);
      attacker.stats.damage += Math.round(dealt);
    }
    this.sim.events.emit('damage', { attackerId: attacker?.id ?? -1, victimId: victim.id, amount: Math.round(amount), part, source, from });
    if (victim.hp <= 0) this.kill(attacker, victim, source, part === 'head');
  }

  kill(killer: Agent | null, victim: Agent, source: string, headshot: boolean): void {
    if (!victim.alive) return;
    victim.hp = 0;
    victim.alive = false;
    victim.diedAt = this.sim.time;
    victim.deathPos = { ...victim.pos };
    victim.stats.deaths++;
    victim.motor.setEnabled(false);
    victim.ultWeapon = null;
    if (this.sim.mode !== 'treino') victim.ultPoints = Math.min(victim.ultPoints + 1, victim.abilities.X.def.ultPoints);
    const assists: number[] = [];
    for (const [id, dmg] of victim.damageBy) {
      if (killer && id === killer.id) continue;
      if (dmg < 25) continue;
      const ag = this.sim.agentById(id);
      if (ag && ag.team !== victim.team) {
        ag.stats.assists++;
        ag.stats.score += 50;
        assists.push(id);
      }
    }
    if (killer && killer !== victim && killer.team !== victim.team) {
      killer.stats.kills++;
      killer.stats.score += 200 + (headshot ? 30 : 0);
      killer.sideKills++;
      const w = this.sim.weaponDefById(source);
      killer.credits = Math.min(MAX_CREDITS, killer.credits + (w ? w.killReward : KILL_REWARD));
      killer.ultPoints = Math.min(killer.ultPoints + ULT_POINT_KILL, killer.abilities.X.def.ultPoints);
      if (killer.ultWeapon && killer.ultWeapon.def.id === 'laminas') killer.ultWeapon.ammo = killer.ultWeapon.def.mag;
    }
    if (victim.hasSpike) this.sim.dropSpike(victim);
    this.sim.dropWeaponsOnDeath(victim);
    this.sim.events.emit('kill', { killerId: killer?.id ?? -1, victimId: victim.id, weaponId: source, headshot, assists });
  }

  heal(a: Agent, amount: number): void {
    if (!a.alive) return;
    a.hp = Math.min(MAX_HP, a.hp + amount);
  }
}
