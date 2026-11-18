import type RAPIER from '@dimforge/rapier3d-compat';
import { MAX_HP } from '../../constants';
import type { AbilityDef } from '../../data/characters';
import type { AbilitySlot, Team, Vec3 } from '../../types';
import { makeWeapon, type Agent } from '../Agent';
import type { Simulation } from '../Simulation';

export type EffectKind = 'smoke' | 'molly' | 'slow' | 'sensor' | 'trap' | 'turret' | 'wall' | 'poison' | 'lockdown';

export interface Effect {
  id: number;
  kind: EffectKind;
  ability: AbilityDef;
  owner: Agent;
  team: Team;
  pos: Vec3;
  radius: number;
  until: number;
  rotY: number;
  hp: number;
  collider: RAPIER.Collider | null;
  nextTick: number;
  half?: Vec3;
}

export interface Projectile {
  id: number;
  ability: AbilityDef;
  owner: Agent;
  pos: Vec3;
  vel: Vec3;
  detonateAt: number;
  rest: boolean;
}

interface Scheduled {
  at: number;
  run: () => void;
}

const DEG = Math.PI / 180;

export class AbilitySystem {
  readonly effects: Effect[] = [];
  readonly projectiles: Projectile[] = [];
  private scheduled: Scheduled[] = [];
  private nextId = 1;

  constructor(private readonly sim: Simulation) {}

  canCast(a: Agent, slot: AbilitySlot): boolean {
    if (!a.alive) return false;
    const phase = this.sim.match.phase;
    if (phase !== 'combat' && phase !== 'planted' && phase !== 'warmup') return false;
    if (a.plantProgress > 0 || a.defuseProgress > 0) return false;
    const st = a.abilities[slot];
    if (slot === 'X') return a.ultReady;
    return st.charges > 0;
  }

  cast(a: Agent, slot: AbilitySlot): boolean {
    if (!this.canCast(a, slot)) return false;
    const st = a.abilities[slot];
    const def = st.def;
    const ok = this.execute(a, def);
    if (!ok) return false;
    if (slot === 'X') {
      a.ultPoints = 0;
      this.sim.events.emit('voice', { agentId: a.id, line: 'ult' });
    } else {
      st.charges--;
      if (def.cooldown > 0 && st.cooldownLeft <= 0) st.cooldownLeft = def.cooldown;
    }
    this.sim.events.emit('abilityCast', { agentId: a.id, slot, abilityId: def.id, pos: { ...a.pos } });
    return true;
  }

  private aimPoint(a: Agent, range: number, pullBack = 0.6): Vec3 {
    const eye = a.eye();
    const f = a.forward();
    const hit = this.sim.physics.raycast(eye, f, range);
    const d = hit ? Math.max(0, hit.dist - pullBack) : range;
    const p = { x: eye.x + f.x * d, y: eye.y + f.y * d, z: eye.z + f.z * d };
    return this.groundAt(p);
  }

  private groundAt(p: Vec3): Vec3 {
    const down = this.sim.physics.raycast({ x: p.x, y: p.y + 0.3, z: p.z }, { x: 0, y: -1, z: 0 }, 30);
    return { x: p.x, y: down ? down.point.y : 0, z: p.z };
  }

  private inFront(a: Agent, dist: number): Vec3 {
    const f = a.forward();
    const len = Math.hypot(f.x, f.z) || 1;
    const dir = { x: f.x / len, y: 0, z: f.z / len };
    const origin = { x: a.pos.x, y: a.pos.y + 0.5, z: a.pos.z };
    const hit = this.sim.physics.raycast(origin, dir, dist);
    const d = hit ? Math.max(0.2, hit.dist - 0.4) : dist;
    return this.groundAt({ x: origin.x + dir.x * d, y: origin.y, z: origin.z + dir.z * d });
  }

  private execute(a: Agent, def: AbilityDef): boolean {
    const p = def.params;
    const t = this.sim.time;
    switch (def.kind) {
      case 'grenade':
      case 'flash':
      case 'molly':
      case 'slow':
        this.throwProjectile(a, def);
        return true;
      case 'smoke':
        this.spawnEffect('smoke', a, def, this.aimPoint(a, p.range ?? 40), p.radius ?? 4, p.duration ?? 15);
        return true;
      case 'blackout': {
        const pt = this.aimPoint(a, p.range ?? 50);
        this.spawnEffect('smoke', a, def, pt, p.radius ?? 10, p.duration ?? 14);
        this.spawnEffect('slow', a, def, pt, p.radius ?? 10, p.duration ?? 14);
        return true;
      }
      case 'poisonField':
        this.spawnEffect('poison', a, def, this.aimPoint(a, p.range ?? 50), p.radius ?? 8, p.duration ?? 9);
        return true;
      case 'reveal': {
        const pt = this.aimPoint(a, p.range ?? 45);
        this.sim.events.emit('flashPop', { pos: { x: pt.x, y: pt.y + 1, z: pt.z }, color: def.color });
        this.schedule(0.6, () => this.revealPulse(a.team, { x: pt.x, y: pt.y + 1.2, z: pt.z }, p.radius ?? 14, p.duration ?? 3));
        return true;
      }
      case 'revealAll': {
        const n = p.count ?? 3;
        for (let i = 0; i < n; i++) {
          this.schedule(0.4 + i * 2, () => {
            for (const e of this.sim.agents) if (e.alive && e.team !== a.team) this.reveal(e, a.team, p.duration ?? 1.6);
          });
        }
        return true;
      }
      case 'sensor':
        this.spawnEffect('sensor', a, def, this.inFront(a, 1.2), p.radius ?? 7, p.duration ?? 30);
        return true;
      case 'trap':
        this.spawnEffect('trap', a, def, this.inFront(a, 1.6), p.radius ?? 2, 600);
        return true;
      case 'turret': {
        const e = this.spawnEffect('turret', a, def, this.inFront(a, 1.4), 0.5, p.duration ?? 45);
        e.rotY = a.yaw;
        e.hp = 120;
        e.half = { x: 0.35, y: 0.5, z: 0.35 };
        e.collider = this.sim.physics.addBarrier({ x: e.pos.x, y: e.pos.y + 0.5, z: e.pos.z }, e.half, 0, e.id);
        return true;
      }
      case 'wall': {
        const range = p.range ?? 10;
        const pt = this.inFront(a, range);
        const e = this.spawnEffect('wall', a, def, pt, 3.6, p.duration ?? 20);
        e.rotY = a.yaw;
        e.hp = p.amount ?? 600;
        e.half = { x: 3.6, y: 1.9, z: 0.3 };
        e.collider = this.sim.physics.addBarrier({ x: pt.x, y: pt.y + 1.9, z: pt.z }, e.half, a.yaw, e.id);
        this.unstickAgents(e);
        return true;
      }
      case 'heal': {
        let target = a;
        if (def.delivery === 'aim') target = this.allyInAim(a, p.range ?? 20) ?? a;
        if (target.hp >= MAX_HP && target === a && def.delivery === 'aim') return false;
        const dur = p.duration ?? 3;
        target.healPerSec = (p.amount ?? 60) / dur;
        target.healUntil = t + dur;
        return true;
      }
      case 'dash': {
        const inp = a.input;
        let dx = inp.moveX * Math.cos(a.yaw) - inp.moveZ * Math.sin(a.yaw);
        let dz = -inp.moveX * Math.sin(a.yaw) - inp.moveZ * Math.cos(a.yaw);
        let l = Math.hypot(dx, dz);
        if (l < 0.1) { dx = -Math.sin(a.yaw); dz = -Math.cos(a.yaw); l = 1; }
        const s = p.speed ?? 18;
        a.motor.vel.x = (dx / l) * s;
        a.motor.vel.z = (dz / l) * s;
        a.motor.vel.y = Math.max(a.motor.vel.y, 1.5);
        return true;
      }
      case 'updraft':
        a.motor.impulse(0, (p.speed ?? 9) - Math.min(0, a.motor.vel.y), 0);
        return true;
      case 'blink': {
        const pt = this.inFront(a, p.range ?? 9);
        const head = this.sim.physics.raycast({ x: pt.x, y: pt.y + 0.1, z: pt.z }, { x: 0, y: 1, z: 0 }, 1.9);
        if (head) return false;
        this.sim.events.emit('flashPop', { pos: { x: a.pos.x, y: a.pos.y + 1, z: a.pos.z }, color: def.color });
        a.motor.teleport({ x: pt.x, y: pt.y + 0.05, z: pt.z });
        return true;
      }
      case 'shield':
        a.armor = Math.min(100, a.armor + (p.amount ?? 50));
        return true;
      case 'fury':
        a.furyUntil = t + (p.duration ?? 10);
        a.shieldRegen = p.amount ?? 50;
        a.hp = MAX_HP;
        return true;
      case 'ultWeapon':
        a.ultWeapon = makeWeapon(p.weapon ?? 'tempestade');
        a.ultWeaponUntil = t + (p.duration ?? 12);
        a.equipEnd = t + a.ultWeapon.def.equipTime;
        a.reloadEnd = 0;
        this.sim.events.emit('equip', { agentId: a.id, weaponId: a.ultWeapon.def.id });
        return true;
      case 'revive': {
        const ally = this.deadAllyInAim(a, p.range ?? 40);
        if (!ally) return false;
        this.sim.match.revive(ally);
        return true;
      }
      case 'airstrike': {
        const pt = this.aimPoint(a, p.range ?? 70);
        const n = p.count ?? 5;
        const r = p.radius ?? 5;
        this.sim.events.emit('flashPop', { pos: { x: pt.x, y: pt.y + 0.3, z: pt.z }, color: def.color });
        for (let i = 0; i < n; i++) {
          const ang = (i / n) * Math.PI * 2;
          const off = i === 0 ? 0 : r * 0.9;
          const ep = this.groundAt({ x: pt.x + Math.cos(ang) * off, y: pt.y + 2, z: pt.z + Math.sin(ang) * off });
          this.schedule((p.fuse ?? 2) + i * 0.3, () => this.explode(a, def, ep, r, p.damage ?? 120, true));
        }
        return true;
      }
      case 'wave': {
        const eye = a.eye();
        const radius = p.radius ?? 20;
        this.sim.events.emit('explosion', { pos: { ...a.pos }, radius, color: def.color, big: true });
        for (const e of this.sim.agents) {
          if (!e.alive || e.team === a.team) continue;
          const ee = e.eye();
          if (Math.hypot(ee.x - eye.x, ee.y - eye.y, ee.z - eye.z) > radius) continue;
          if (!this.sim.physics.lineClear(eye, ee)) continue;
          this.blind(e, p.duration ?? 3, 1);
          e.slowUntil = t + (p.duration ?? 3) + 1;
          e.slowMult = p.slow ?? 0.5;
        }
        return true;
      }
      case 'lockdown': {
        if (def.delivery === 'self') {
          this.spawnEffect('lockdown', a, def, { ...a.pos }, p.radius ?? 15, p.duration ?? 10);
        } else {
          const n = p.count ?? 6;
          const f = a.forward();
          const len = Math.hypot(f.x, f.z) || 1;
          const step = (p.range ?? 40) / n;
          for (let i = 0; i < n; i++) {
            const d = step * (i + 0.5);
            const probe = { x: a.pos.x, y: a.pos.y + 0.8, z: a.pos.z };
            const dir = { x: f.x / len, y: 0, z: f.z / len };
            const hit = this.sim.physics.raycast(probe, dir, d);
            if (hit) break;
            const pt = this.groundAt({ x: probe.x + dir.x * d, y: probe.y, z: probe.z + dir.z * d });
            this.schedule(i * 0.12, () => this.spawnEffect('lockdown', a, def, pt, p.radius ?? 6, p.duration ?? 5));
          }
        }
        return true;
      }
    }
    return false;
  }

  private throwProjectile(a: Agent, def: AbilityDef): void {
    const eye = a.eye();
    const f = a.forward();
    const speed = def.kind === 'flash' ? 22 : 17;
    const proj: Projectile = {
      id: this.nextId++,
      ability: def,
      owner: a,
      pos: { x: eye.x + f.x * 0.5, y: eye.y + f.y * 0.5 - 0.1, z: eye.z + f.z * 0.5 },
      vel: { x: f.x * speed + a.motor.vel.x * 0.4, y: f.y * speed + 2.5, z: f.z * speed + a.motor.vel.z * 0.4 },
      detonateAt: this.sim.time + (def.params.fuse ?? 1.2),
      rest: false,
    };
    this.projectiles.push(proj);
    this.sim.events.emit('projectileSpawn', { projId: proj.id, abilityId: def.id, color: def.color, pos: { ...proj.pos } });
  }

  private spawnEffect(kind: EffectKind, owner: Agent, def: AbilityDef, pos: Vec3, radius: number, duration: number): Effect {
    const e: Effect = {
      id: this.nextId++, kind, ability: def, owner, team: owner.team, pos: { ...pos }, radius,
      until: this.sim.time + duration, rotY: 0, hp: 0, collider: null, nextTick: 0,
    };
    this.effects.push(e);
    this.sim.events.emit('effectSpawn', {
      effectId: e.id, kind, abilityId: def.id, ownerId: owner.id, pos: e.pos, radius, color: def.color, duration, rotY: owner.yaw, team: owner.team,
    });
    return e;
  }

  private schedule(delay: number, run: () => void): void {
    this.scheduled.push({ at: this.sim.time + delay, run });
  }

  private unstickAgents(e: Effect): void {
    for (const ag of this.sim.agents) {
      if (!ag.alive) continue;
      const dx = ag.pos.x - e.pos.x;
      const dz = ag.pos.z - e.pos.z;
      const c = Math.cos(e.rotY);
      const s = Math.sin(e.rotY);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < 3.7 && Math.abs(lz) < 0.75) {
        const push = lz >= 0 ? 0.8 : -0.8;
        const nz = push - lz;
        ag.motor.teleport({ x: ag.pos.x + s * nz, y: ag.pos.y, z: ag.pos.z + c * nz });
      }
    }
  }

  reveal(e: Agent, byTeam: Team, duration: number): void {
    e.revealedUntil = Math.max(e.revealedUntil, this.sim.time + duration);
    this.sim.events.emit('revealed', { agentId: e.id, byTeam, duration });
  }

  private revealPulse(team: Team, center: Vec3, radius: number, duration: number): void {
    for (const e of this.sim.agents) {
      if (!e.alive || e.team === team) continue;
      const ee = e.eye();
      if (Math.hypot(ee.x - center.x, ee.y - center.y, ee.z - center.z) > radius) continue;
      if (!this.sim.physics.lineClear(center, ee)) continue;
      this.reveal(e, team, duration);
    }
  }

  blind(e: Agent, duration: number, strength: number): void {
    const until = this.sim.time + duration * strength;
    if (until > e.blindUntil) {
      e.blindUntil = until;
      e.blindStrength = strength;
    }
    this.sim.events.emit('blinded', { agentId: e.id, duration: duration * strength });
  }

  private flash(owner: Agent, def: AbilityDef, pos: Vec3): void {
    this.sim.events.emit('flashPop', { pos, color: def.color });
    const radius = def.params.radius ?? 30;
    for (const e of this.sim.agents) {
      if (!e.alive || e.team === owner.team) continue;
      const eye = e.eye();
      const dx = pos.x - eye.x;
      const dy = pos.y - eye.y;
      const dz = pos.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > radius || !this.sim.canSee(eye, pos)) continue;
      const f = e.forward();
      const dot = (f.x * dx + f.y * dy + f.z * dz) / (d || 1);
      const strength = dot > 0.5 ? 1 : dot > 0 ? 0.6 : dot > -0.4 ? 0.25 : 0;
      if (strength > 0) this.blind(e, def.params.duration ?? 2, strength);
    }
  }

  private explode(owner: Agent, def: AbilityDef, pos: Vec3, radius: number, damage: number, big: boolean): void {
    this.sim.events.emit('explosion', { pos, radius, color: def.color, big });
    const center = { x: pos.x, y: pos.y + 0.5, z: pos.z };
    for (const e of this.sim.agents) {
      if (!e.alive) continue;
      if (e.team === owner.team && e !== owner) continue;
      const c = { x: e.pos.x, y: e.pos.y + 1, z: e.pos.z };
      const d = Math.hypot(c.x - center.x, c.y - center.y, c.z - center.z);
      if (d > radius || !this.sim.physics.lineClear(center, c)) continue;
      const falloff = 1 - (d / radius) * 0.7;
      const dmg = damage * falloff * (e === owner ? 0.5 : 1);
      this.sim.combat.applyDamage(owner, e, dmg, 'ability', def.id, center);
      if (def.id === 'isabela_C') {
        e.slowUntil = this.sim.time + 2.5;
        e.slowMult = 0.5;
      }
    }
    for (const ef of this.effects) {
      if (ef.collider && Math.hypot(ef.pos.x - pos.x, ef.pos.z - pos.z) < radius + 1) this.damageBarrier(ef.id, damage * 0.8);
    }
  }

  private allyInAim(a: Agent, range: number): Agent | null {
    const eye = a.eye();
    const f = a.forward();
    let best: Agent | null = null;
    let bestDot = Math.cos(8 * DEG);
    for (const o of this.sim.agents) {
      if (o === a || !o.alive || o.team !== a.team) continue;
      const oe = { x: o.pos.x, y: o.pos.y + 1.1, z: o.pos.z };
      const dx = oe.x - eye.x, dy = oe.y - eye.y, dz = oe.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > range) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / d;
      if (dot > bestDot && this.sim.physics.lineClear(eye, oe)) {
        bestDot = dot;
        best = o;
      }
    }
    return best;
  }

  private deadAllyInAim(a: Agent, range: number): Agent | null {
    const eye = a.eye();
    const f = a.forward();
    let best: Agent | null = null;
    let bestScore = -Infinity;
    for (const o of this.sim.agents) {
      if (o.alive || o.team !== a.team || o === a) continue;
      const dp = o.deathPos;
      const dx = dp.x - eye.x, dy = dp.y + 0.3 - eye.y, dz = dp.z - eye.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > range) continue;
      const dot = (dx * f.x + dy * f.y + dz * f.z) / d;
      const score = dot * 2 - d / range;
      if (score > bestScore) {
        bestScore = score;
        best = o;
      }
    }
    return best;
  }

  damageBarrier(effectId: number, amount: number): void {
    const e = this.effects.find((x) => x.id === effectId);
    if (!e || !e.collider) return;
    e.hp -= amount;
    if (e.hp <= 0) e.until = 0;
  }

  segmentBlockedBySmoke(a: Vec3, b: Vec3): boolean {
    for (const e of this.effects) {
      if (e.kind !== 'smoke') continue;
      const r = e.radius;
      const cx = e.pos.x, cy = e.pos.y + r * 0.45, cz = e.pos.z;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const len2 = dx * dx + dy * dy + dz * dz;
      let tt = len2 > 0 ? ((cx - a.x) * dx + (cy - a.y) * dy + (cz - a.z) * dz) / len2 : 0;
      tt = Math.max(0, Math.min(1, tt));
      const px = a.x + dx * tt - cx, py = (a.y + dy * tt - cy) * 1.3, pz = a.z + dz * tt - cz;
      if (px * px + py * py + pz * pz < r * r * 0.85) return true;
    }
    return false;
  }

  pointInSmoke(p: Vec3): boolean {
    for (const e of this.effects) {
      if (e.kind !== 'smoke') continue;
      const dy = (p.y - (e.pos.y + e.radius * 0.45)) * 1.3;
      if ((p.x - e.pos.x) ** 2 + dy * dy + (p.z - e.pos.z) ** 2 < e.radius * e.radius * 0.85) return true;
    }
    return false;
  }

  update(dt: number): void {
    const t = this.sim.time;
    for (const a of this.sim.agents) {
      for (const s of ['C', 'Q', 'E'] as const) {
        const st = a.abilities[s];
        if (st.cooldownLeft > 0) {
          st.cooldownLeft -= dt;
          if (st.cooldownLeft <= 0) {
            st.cooldownLeft = 0;
            if (st.charges < st.def.maxCharges) st.charges++;
            if (st.charges < st.def.maxCharges) st.cooldownLeft = st.def.cooldown;
          }
        }
      }
    }

    for (let i = this.scheduled.length - 1; i >= 0; i--) {
      if (t >= this.scheduled[i].at) {
        const s = this.scheduled[i];
        this.scheduled.splice(i, 1);
        s.run();
      }
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      this.stepProjectile(p, dt);
      if (t >= p.detonateAt) {
        this.projectiles.splice(i, 1);
        this.sim.events.emit('projectileEnd', { projId: p.id });
        this.detonate(p);
      }
    }

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      if (t >= e.until) {
        this.removeEffectAt(i);
        continue;
      }
      this.tickEffect(e, dt);
    }
  }

  private stepProjectile(p: Projectile, dt: number): void {
    if (p.rest) return;
    p.vel.y -= 20 * dt;
    const sp = Math.hypot(p.vel.x, p.vel.y, p.vel.z);
    if (sp < 1e-3) return;
    const dist = sp * dt;
    const dir = { x: p.vel.x / sp, y: p.vel.y / sp, z: p.vel.z / sp };
    const hit = this.sim.physics.raycast(p.pos, dir, dist + 0.1);
    if (hit) {
      p.pos.x = hit.point.x + hit.normal.x * 0.12;
      p.pos.y = hit.point.y + hit.normal.y * 0.12;
      p.pos.z = hit.point.z + hit.normal.z * 0.12;
      const vn = p.vel.x * hit.normal.x + p.vel.y * hit.normal.y + p.vel.z * hit.normal.z;
      p.vel.x = (p.vel.x - 2 * vn * hit.normal.x) * 0.45;
      p.vel.y = (p.vel.y - 2 * vn * hit.normal.y) * 0.45;
      p.vel.z = (p.vel.z - 2 * vn * hit.normal.z) * 0.45;
      if (hit.normal.y > 0.7 && Math.abs(p.vel.y) < 1.5) {
        p.vel.y = 0;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
        if (Math.hypot(p.vel.x, p.vel.z) < 0.4) p.rest = true;
        const k = p.ability.kind;
        if ((k === 'molly' || k === 'slow') && p.detonateAt - this.sim.time > 0.05) p.detonateAt = Math.min(p.detonateAt, this.sim.time + 0.05);
      }
    } else {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
    }
  }

  private detonate(p: Projectile): void {
    const def = p.ability;
    const prm = def.params;
    switch (def.kind) {
      case 'grenade':
        this.explode(p.owner, def, p.pos, prm.radius ?? 4.5, prm.damage ?? 100, false);
        break;
      case 'flash':
        this.flash(p.owner, def, { ...p.pos });
        break;
      case 'molly':
        this.spawnEffect('molly', p.owner, def, this.groundAt(p.pos), prm.radius ?? 3.5, prm.duration ?? 6);
        break;
      case 'slow':
        this.spawnEffect('slow', p.owner, def, this.groundAt(p.pos), prm.radius ?? 4, prm.duration ?? 5);
        break;
    }
  }

  private tickEffect(e: Effect, dt: number): void {
    const t = this.sim.time;
    const prm = e.ability.params;
    switch (e.kind) {
      case 'molly':
      case 'poison':
        for (const ag of this.sim.agents) {
          if (!ag.alive || ag.team === e.team) continue;
          if (this.insideZone(ag, e)) this.sim.combat.applyDamage(e.owner, ag, (prm.damage ?? 40) * dt, 'ability', e.ability.id, e.pos);
        }
        break;
      case 'slow':
      case 'lockdown':
        for (const ag of this.sim.agents) {
          if (!ag.alive || ag.team === e.team) continue;
          if (!this.insideZone(ag, e)) continue;
          const active = ag.slowUntil > t;
          ag.slowMult = Math.min(active ? ag.slowMult : 1, prm.slow ?? 0.5);
          ag.slowUntil = Math.max(ag.slowUntil, t + 0.25);
          if (e.kind === 'lockdown' && t >= e.nextTick) this.reveal(ag, e.team, 1);
        }
        if (e.kind === 'lockdown' && t >= e.nextTick) e.nextTick = t + 0.9;
        break;
      case 'sensor':
        if (t < e.nextTick) break;
        e.nextTick = t + 0.5;
        this.revealPulse(e.team, { x: e.pos.x, y: e.pos.y + 0.6, z: e.pos.z }, e.radius, 1);
        break;
      case 'trap':
        for (const ag of this.sim.agents) {
          if (!ag.alive || ag.team === e.team) continue;
          if (Math.hypot(ag.pos.x - e.pos.x, ag.pos.z - e.pos.z) < e.radius && Math.abs(ag.pos.y - e.pos.y) < 1.5) {
            this.reveal(ag, e.team, prm.duration ?? 3);
            ag.slowUntil = t + (prm.duration ?? 3);
            ag.slowMult = prm.slow ?? 0.5;
            if (prm.damage) this.sim.combat.applyDamage(e.owner, ag, prm.damage, 'ability', e.ability.id, e.pos);
            this.sim.events.emit('flashPop', { pos: { x: e.pos.x, y: e.pos.y + 0.3, z: e.pos.z }, color: e.ability.color });
            e.until = 0;
            break;
          }
        }
        break;
      case 'turret': {
        if (t < e.nextTick) break;
        e.nextTick = t + 0.22;
        const head = { x: e.pos.x, y: e.pos.y + 0.9, z: e.pos.z };
        let target: Agent | null = null;
        let bestD = prm.range ?? 35;
        for (const ag of this.sim.agents) {
          if (!ag.alive || ag.team === e.team) continue;
          const c = { x: ag.pos.x, y: ag.pos.y + 1.2, z: ag.pos.z };
          const d = Math.hypot(c.x - head.x, c.y - head.y, c.z - head.z);
          if (d > bestD) continue;
          const ang = Math.atan2(-(c.x - head.x), -(c.z - head.z));
          let da = ang - e.rotY;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > 65 * DEG) continue;
          if (!this.sim.canSee(head, c)) continue;
          bestD = d;
          target = ag;
        }
        if (target) {
          const c = { x: target.pos.x, y: target.pos.y + 1.2, z: target.pos.z };
          this.sim.events.emit('shot', { agentId: -e.id, weaponId: 'torreta', origin: head, end: c, hitAgent: true });
          this.sim.combat.applyDamage(e.owner, target, prm.damage ?? 9, 'body', e.ability.id, head);
        }
        break;
      }
      default:
        break;
    }
  }

  private insideZone(ag: Agent, e: Effect): boolean {
    return Math.hypot(ag.pos.x - e.pos.x, ag.pos.z - e.pos.z) < e.radius && ag.pos.y - e.pos.y < 2.5 && ag.pos.y - e.pos.y > -1.5;
  }

  private removeEffectAt(i: number): void {
    const e = this.effects[i];
    if (e.collider) this.sim.physics.removeCollider(e.collider);
    this.effects.splice(i, 1);
    this.sim.events.emit('effectEnd', { effectId: e.id });
  }

  clearAll(): void {
    for (let i = this.effects.length - 1; i >= 0; i--) this.removeEffectAt(i);
    for (const p of this.projectiles) this.sim.events.emit('projectileEnd', { projId: p.id });
    this.projectiles.length = 0;
    this.scheduled.length = 0;
  }
}
