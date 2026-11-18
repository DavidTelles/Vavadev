import { ARMOR_ITEMS, WEAPONS } from '../../data/weapons';
import type { AbilityDef } from '../../data/characters';
import type { Side, Team, Vec3, Difficulty, AbilitySlot, InputCommand } from '../../types';
import { emptyInput } from '../../types';
import type { Agent } from '../Agent';
import type { Controller, Simulation } from '../Simulation';
import { NavGrid } from '../nav/NavGrid';

/**
 * Bot AI. Each bot is a 12-state machine producing the same InputCommand a
 * human would, so bots obey every sim rule (movement, recoil, buy phase...).
 *
 *   buy -> advance/hold -> combat <-> reload/cover -> investigate -> ...
 *   plant / defuse / retake / idle / dead
 *
 * Perception is honest: vision cone + line of sight (smoke blocks it) +
 * hearing (shots, loud footsteps, being hit). Bots only know where an enemy
 * is if they saw or heard it, and remember the last known position.
 */

export type BotState = 'buy' | 'idle' | 'advance' | 'hold' | 'investigate' | 'combat' | 'reload' | 'cover' | 'plant' | 'defuse' | 'retake' | 'dead';

interface Skill {
  reaction: number;
  aimErr: number;
  turn: number;
  head: number;
  recoilControl: number;
  fov: number;
  burst: number;
  burstPause: number;
  stopToShoot: number;
  strafe: number;
}

export const SKILL: Record<Difficulty, Skill> = {
  facil: { reaction: 0.6, aimErr: 0.075, turn: 4.5, head: 0.08, recoilControl: 0.25, fov: 100, burst: 6, burstPause: 0.45, stopToShoot: 0.2, strafe: 0.2 },
  normal: { reaction: 0.36, aimErr: 0.038, turn: 8, head: 0.22, recoilControl: 0.6, fov: 115, burst: 5, burstPause: 0.3, stopToShoot: 0.55, strafe: 0.55 },
  dificil: { reaction: 0.2, aimErr: 0.018, turn: 14, head: 0.42, recoilControl: 0.88, fov: 130, burst: 7, burstPause: 0.18, stopToShoot: 0.85, strafe: 0.8 },
};

interface Memory { pos: Vec3; time: number }

interface Brain {
  agent: Agent;
  skill: Skill;
  state: BotState;
  stateSince: number;
  // navigation
  goal: Vec3 | null;
  goalKey: string;
  path: Vec3[];
  pathIdx: number;
  repathAt: number;
  progressPos: Vec3;
  progressTime: number;
  // perception
  targetId: number;
  reactReadyAt: number;
  enemies: Map<number, Memory>;
  noise: Memory | null;
  // aim
  aimYaw: number;
  aimPitch: number;
  errYaw: number;
  errPitch: number;
  errAt: number;
  headAim: boolean;
  burstLeft: number;
  burstPauseUntil: number;
  tapToggle: boolean;
  strafeDir: number;
  strafeAt: number;
  crouch: boolean;
  // plan
  hold: Vec3 | null;
  lookAt: Vec3 | null;
  bought: boolean;
  buyAt: number;
  nextAbilityAt: number;
  placedThisRound: boolean;
  investigateUntil: number;
  sidestepUntil: number;
  stuckCount: number;
  detour: Vec3 | null;
  detourUntil: number;
}

interface TeamPlan {
  site: Side;
  executeAt: number;
  staging: Vec3;
}

const TAU = Math.PI * 2;
const wrap = (a: number): number => {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
};
const d2 = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (from: Vec3, to: Vec3): number => Math.atan2(-(to.x - from.x), -(to.z - from.z));

export class BotController implements Controller {
  readonly nav: NavGrid;
  private readonly brains = new Map<number, Brain>();
  private plan: TeamPlan = { site: 'A', executeAt: 0, staging: { x: 0, y: 0, z: 0 } };
  private defSplit: Side[] = [];
  private tick = 0;
  private readonly unsub: (() => void)[] = [];

  constructor(private readonly sim: Simulation) {
    this.nav = new NavGrid(sim.map);
    for (const a of sim.agents) if (a.isBot) this.brains.set(a.id, this.makeBrain(a));
    const ev = sim.events;
    this.unsub.push(
      ev.on('shot', (p) => this.hear(p.agentId, p.origin, 40)),
      ev.on('footstep', (p) => { if (p.loud) this.hear(p.agentId, p.pos, 18); }),
      ev.on('damage', (p) => {
        const b = this.brains.get(p.victimId);
        if (b && p.attackerId >= 0 && p.attackerId !== p.victimId) {
          b.noise = { pos: { ...p.from }, time: this.sim.time };
          const att = this.sim.agentById(p.attackerId);
          if (att && att.team !== b.agent.team) b.enemies.set(att.id, { pos: { ...att.pos }, time: this.sim.time });
        }
      }),
      ev.on('spikePlanted', () => this.onPlanted()),
    );
  }

  private makeBrain(a: Agent): Brain {
    return {
      agent: a, skill: SKILL[a.difficulty], state: 'buy', stateSince: 0,
      goal: null, goalKey: '', path: [], pathIdx: 0, repathAt: 0, progressPos: { ...a.pos }, progressTime: 0,
      targetId: -1, reactReadyAt: 0, enemies: new Map(), noise: null,
      aimYaw: a.yaw, aimPitch: 0, errYaw: 0, errPitch: 0, errAt: 0, headAim: false,
      burstLeft: 0, burstPauseUntil: 0, tapToggle: false, strafeDir: 1, strafeAt: 0, crouch: false,
      hold: null, lookAt: null, bought: false, buyAt: 0, nextAbilityAt: 0, placedThisRound: false, investigateUntil: 0, sidestepUntil: 0, stuckCount: 0, detour: null, detourUntil: 0,
    };
  }

  brainOf(id: number): Readonly<Brain> | undefined {
    return this.brains.get(id);
  }

  private hear(sourceId: number, pos: Vec3, range: number): void {
    const src = this.sim.agentById(sourceId);
    if (!src) return;
    for (const b of this.brains.values()) {
      const a = b.agent;
      if (!a.alive || a.team === src.team) continue;
      if (d2(a.pos, pos) > range) continue;
      b.noise = { pos: { ...pos }, time: this.sim.time };
      b.enemies.set(src.id, { pos: { ...pos }, time: this.sim.time });
    }
  }

  // ---------- round planning ----------

  onRoundStart(): void {
    const rng = this.sim.rng;
    const map = this.sim.map;
    const site: Side = rng() < 0.5 ? 'A' : 'B';
    const st = map.sites[site].stagingPoints;
    this.plan = { site, executeAt: this.sim.time + 30 + 12 + rng() * 22, staging: st[Math.floor(rng() * st.length)] };
    const defenders = this.sim.agents.filter((a) => a.team === 'def');
    const heavy: Side = rng() < 0.5 ? 'A' : 'B';
    const light: Side = heavy === 'A' ? 'B' : 'A';
    this.defSplit = defenders.map((_, i) => (i % 5 < 3 ? heavy : light));
    let di = 0;
    const usedHolds = new Set<string>();
    for (const b of this.brains.values()) {
      const a = b.agent;
      b.state = 'buy';
      b.stateSince = this.sim.time;
      b.bought = false;
      b.buyAt = this.sim.time + 0.5 + rng() * 3;
      b.enemies.clear();
      b.noise = null;
      b.targetId = -1;
      b.path = [];
      b.goal = null;
      b.goalKey = '';
      b.placedThisRound = false;
      b.aimYaw = a.yaw;
      b.aimPitch = 0;
      b.hold = null;
      b.lookAt = null;
      if (a.team === 'def') {
        const idx = defenders.indexOf(a);
        const side = this.defSplit[idx >= 0 ? idx : di++ % 5];
        const s = map.sites[side];
        const pts = s.holdPoints.filter((p) => !usedHolds.has(`${p.x},${p.z}`));
        const hp = pts.length ? pts[Math.floor(rng() * pts.length)] : s.holdPoints[0];
        usedHolds.add(`${hp.x},${hp.z}`);
        b.hold = hp;
        b.lookAt = s.stagingPoints.reduce((best, p) => (d2(p, hp) < d2(best, hp) ? p : best), s.stagingPoints[0]);
      }
    }
  }

  private onPlanted(): void {
    const sp = this.sim.match.spike;
    const site = sp.site ?? this.plan.site;
    const s = this.sim.map.sites[site];
    const rng = this.sim.rng;
    for (const b of this.brains.values()) {
      const a = b.agent;
      if (!a.alive) continue;
      if (a.team === 'atk') {
        const pts = [...s.holdPoints];
        b.hold = this.nav.nearest(pts[Math.floor(rng() * pts.length)]) ?? sp.pos;
        b.lookAt = { ...sp.pos };
        this.setState(b, 'hold');
      } else {
        this.setState(b, 'retake');
        const r = s.retakePoints;
        b.hold = r[Math.floor(rng() * r.length)];
      }
    }
  }

  // ---------- main update ----------

  update(dt: number): void {
    this.tick++;
    const phase = this.sim.match.phase;
    for (const b of this.brains.values()) {
      const a = b.agent;
      if (!a.alive) {
        if (b.state !== 'dead') this.setState(b, 'dead');
        continue;
      }
      if (b.state === 'dead') this.setState(b, 'idle');
      if ((this.tick + a.id) % 2 === 0) this.perceive(b);
      const cmd = emptyInput();
      if (this.sim.mode === 'treino') this.trainingDummy(b, cmd, dt);
      else if (phase === 'buy') this.buyPhase(b, cmd);
      else if (phase === 'combat' || phase === 'planted') this.think(b, cmd, dt);
      else this.idleLook(b, cmd, dt);
      this.sim.setInput(a.id, cmd);
    }
  }

  private setState(b: Brain, s: BotState): void {
    if (b.state === s) return;
    b.state = s;
    b.stateSince = this.sim.time;
  }

  // ---------- perception ----------

  private perceive(b: Brain): void {
    const a = b.agent;
    const now = this.sim.time;
    if (a.isBlind(now)) return;
    const eye = a.eye();
    const half = (b.skill.fov / 2) * (Math.PI / 180);
    let best: Agent | null = null;
    let bestD = 1e9;
    for (const e of this.sim.agents) {
      if (e.team === a.team || !e.alive) continue;
      const d = d2(a.pos, e.pos);
      if (d > 70) continue;
      const ang = Math.abs(wrap(yawTo(a.pos, e.pos) - b.aimYaw));
      if (ang > half && d > 3.5) continue;
      const chest = { x: e.pos.x, y: e.pos.y + 1.25, z: e.pos.z };
      const head = { x: e.pos.x, y: e.pos.y + 1.62, z: e.pos.z };
      if (!this.sim.canSee(eye, chest) && !this.sim.canSee(eye, head)) continue;
      b.enemies.set(e.id, { pos: { ...e.pos }, time: now });
      // Prefer the current target slightly to avoid flicking between enemies.
      const score = d - (e.id === b.targetId ? 6 : 0);
      if (score < bestD) { bestD = score; best = e; }
    }
    if (best) {
      if (best.id !== b.targetId) {
        b.targetId = best.id;
        b.reactReadyAt = now + b.skill.reaction * (0.7 + this.sim.rng() * 0.6);
        b.headAim = this.sim.rng() < b.skill.head;
        b.burstLeft = b.skill.burst;
      }
    } else if (b.targetId >= 0) {
      const m = b.enemies.get(b.targetId);
      if (!m || now - m.time > 0.25) b.targetId = -1;
    }
  }

  private visibleTarget(b: Brain): Agent | null {
    if (b.targetId < 0) return null;
    const t = this.sim.agentById(b.targetId);
    if (!t || !t.alive) {
      b.targetId = -1;
      return null;
    }
    return t;
  }

  private freshestMemory(b: Brain, maxAge: number): Memory | null {
    let best: Memory | null = null;
    for (const [id, m] of b.enemies) {
      const e = this.sim.agentById(id);
      if (!e || !e.alive) continue;
      if (this.sim.time - m.time > maxAge) continue;
      if (!best || m.time > best.time) best = m;
    }
    return best;
  }

  // ---------- phases ----------

  private buyPhase(b: Brain, cmd: InputCommand): void {
    const a = b.agent;
    this.setState(b, 'buy');
    if (!b.bought && this.sim.time >= b.buyAt) {
      b.bought = true;
      this.buy(a);
    }
    // Defenders walk towards their hold during buy; attackers wait in spawn.
    if (a.team === 'def' && b.hold) this.moveTo(b, cmd, b.hold, 'hold', false);
    this.lookTowards(b, cmd, b.lookAt ?? this.sim.map.sites[this.plan.site].center, 0.016);
  }

  private buy(a: Agent): void {
    const sim = this.sim;
    const rng = sim.rng;
    const c = a.credits;
    const round = sim.match.round;
    const pistolRound = round === 1 || round === sim.match.halfLength + 1;
    const has1 = !!a.slots[1];
    if (!pistolRound && !has1) {
      if (c >= 4700 + 1000 && rng() < (a.difficulty === 'dificil' ? 0.35 : 0.15)) sim.buy(a.id, 'gaviao');
      else if (c >= 2900 + 400) sim.buy(a.id, rng() < 0.5 ? 'falcao' : 'jaguar');
      else if (c >= 2300 + 400 && rng() < 0.3) sim.buy(a.id, 'guardiao');
      else if (c >= 1600 + 400 && c < 2900 && rng() < 0.6) sim.buy(a.id, rng() < 0.7 ? 'vespa' : 'marreta');
    } else if (pistolRound && c >= 800 && rng() < 0.4) {
      sim.buy(a.id, 'trovao');
    }
    const left = a.credits;
    const heavy = ARMOR_ITEMS.find((x) => x.id === 'blindagem')!;
    const light = ARMOR_ITEMS.find((x) => x.id === 'colete')!;
    if (left >= heavy.cost + 600 && !pistolRound) sim.buy(a.id, heavy.id);
    else if (left >= light.cost) sim.buy(a.id, light.id);
    for (const s of ['C', 'Q'] as const) {
      const st = a.abilities[s];
      while (st.charges < st.def.maxCharges && a.credits >= st.def.cost && st.def.cost > 0 && a.credits > 300) {
        if (!sim.buy(a.id, s)) break;
      }
    }
  }

  private trainingDummy(b: Brain, cmd: InputCommand, dt: number): void {
    // Practice targets: wander between random points, never shoot.
    const a = b.agent;
    if (!b.goal || d2(a.pos, b.goal) < 1 || this.sim.time > b.repathAt + 12) {
      const zone = this.sim.map.callouts[Math.floor(this.sim.rng() * this.sim.map.callouts.length)];
      b.goal = this.nav.randomIn(zone, this.sim.rng);
      b.goalKey = '';
    }
    if (b.goal) this.moveTo(b, cmd, b.goal, 'wander', true);
    this.lookAlongPath(b, cmd, dt);
    cmd.walk = true;
  }

  private idleLook(b: Brain, cmd: InputCommand, dt: number): void {
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    void dt;
  }

  // ---------- decision ----------

  private think(b: Brain, cmd: InputCommand, dt: number): void {
    const a = b.agent;
    const now = this.sim.time;
    const target = this.visibleTarget(b);
    const w = a.weapon;
    cmd.slot = a.slots[1] ? 1 : 2;

    // Reload decisions.
    const reloading = now < a.reloadEnd;
    const empty = w.ammo === 0 && w.def.category !== 'corpo';
    if (empty && w.reserve > 0 && !reloading) cmd.reload = !a.prevInput.reload;
    if (!target && !reloading && w.reserve > 0 && w.ammo < w.def.mag * 0.45 && w.def.category !== 'corpo') cmd.reload = !a.prevInput.reload;
    if (empty && w.reserve === 0 && a.slots[2] && a.current !== 2) cmd.slot = 2;

    if (target) {
      if (reloading || empty) this.setState(b, 'cover');
      else this.setState(b, 'combat');
    } else if (b.state === 'combat' || b.state === 'cover') {
      const mem = this.freshestMemory(b, 6);
      if (mem) {
        this.setState(b, 'investigate');
        b.investigateUntil = now + 4 + this.sim.rng() * 3;
        b.noise = mem;
      } else this.setState(b, 'idle');
    } else if (reloading && b.state !== 'plant' && b.state !== 'defuse') {
      if (b.state !== 'reload') this.setState(b, 'reload');
    } else if (b.state === 'reload') {
      this.setState(b, 'idle');
    }

    // Objective overrides (when not shooting).
    if (!target && this.objective(b, cmd, dt)) {
      this.useAbilities(b, cmd, null);
      return;
    }

    switch (b.state) {
      case 'combat': this.combat(b, cmd, dt, target!); break;
      case 'cover': this.cover(b, cmd, dt, target!); break;
      case 'investigate': this.investigate(b, cmd, dt); break;
      case 'reload': this.planMove(b, cmd, dt, true); break;
      default: this.planMove(b, cmd, dt, false);
    }
    this.useAbilities(b, cmd, target);
  }

  /** Plant / defuse / pick up the Spike. Returns true if it took control of the bot this tick. */
  private objective(b: Brain, cmd: InputCommand, dt: number): boolean {
    const a = b.agent;
    const m = this.sim.match;
    const sp = m.spike;
    // Plant.
    if (a.hasSpike && m.phase === 'combat') {
      const site = this.siteZoneAt(a.pos);
      const executing = this.sim.time >= this.plan.executeAt || m.timeLeft < 30;
      if (site && executing) {
        this.setState(b, 'plant');
        cmd.interact = true;
        cmd.crouch = false;
        cmd.yaw = b.aimYaw;
        cmd.pitch = -0.5;
        return true;
      }
    }
    // Pick up a dropped Spike (nearest living attacker).
    if (a.team === 'atk' && sp.status === 'dropped') {
      const nearest = this.sim.agents.filter((x) => x.alive && x.team === 'atk').sort((x, y) => d2(x.pos, sp.pos) - d2(y.pos, sp.pos))[0];
      if (nearest === a) {
        this.setState(b, 'advance');
        this.moveTo(b, cmd, sp.pos, 'spike', true);
        this.lookAlongPath(b, cmd, dt);
        return true;
      }
    }
    // Defuse.
    if (a.team === 'def' && m.phase === 'planted') {
      const dist = d2(a.pos, sp.pos);
      const defusers = this.sim.agents.filter((x) => x.alive && x.team === 'def').sort((x, y) => d2(x.pos, sp.pos) - d2(y.pos, sp.pos));
      if (defusers[0] === a) {
        if (dist < 1.3) {
          this.setState(b, 'defuse');
          cmd.interact = true;
          cmd.yaw = b.aimYaw;
          cmd.pitch = -0.5;
          return true;
        }
        const left = 45 - (this.sim.time - sp.plantedAt);
        if (left < 12 || b.state === 'retake' && dist < 14) {
          this.setState(b, 'retake');
          this.moveTo(b, cmd, sp.pos, 'defuse', true);
          this.lookAlongPath(b, cmd, dt);
          return true;
        }
      }
    }
    return false;
  }

  private siteZoneAt(p: Vec3): Side | null {
    for (const side of ['A', 'B'] as const) {
      const z = this.sim.map.sites[side].zone;
      if (p.x > z.minX + 0.6 && p.x < z.maxX - 0.6 && p.z > z.minZ + 0.6 && p.z < z.maxZ - 0.6) return side;
    }
    return null;
  }

  /** Normal movement following the team plan. */
  private planMove(b: Brain, cmd: InputCommand, dt: number, cautious: boolean): void {
    const a = b.agent;
    const m = this.sim.match;
    const map = this.sim.map;
    let goal: Vec3 | null = null;
    let key = '';
    let holdHere = false;
    if (a.team === 'atk') {
      if (m.phase === 'planted') {
        goal = b.hold;
        key = 'posthold';
        holdHere = true;
      } else {
        const executing = this.sim.time >= this.plan.executeAt || m.timeLeft < 30;
        const site = map.sites[this.plan.site];
        if (!executing) {
          goal = this.plan.staging;
          key = 'staging';
          holdHere = true;
        } else {
          // Carrier heads for the site centre, others spread over the site.
          if (a.hasSpike) {
            goal = site.center;
            key = 'plant';
          } else {
            if (!b.goal || !b.goalKey.startsWith('exec')) {
              goal = this.nav.randomIn(site.zone, this.sim.rng) ?? site.center;
              key = `exec${Math.round(goal.x)}`;
            } else {
              goal = b.goal;
              key = b.goalKey;
            }
            holdHere = true;
          }
        }
      }
    } else {
      if (m.phase === 'planted') {
        // Retake: first the retake entry point, then close in around the Spike.
        const sp = m.spike.pos;
        if (b.hold && d2(b.hold, sp) > 6 && d2(a.pos, b.hold) < 2) {
          const ang = this.sim.rng() * TAU;
          b.hold = this.nav.nearest({ x: sp.x + Math.cos(ang) * 3.5, y: sp.y, z: sp.z + Math.sin(ang) * 3.5 }) ?? { ...sp };
        }
        goal = b.hold;
        key = `retake${b.hold ? Math.round(b.hold.x) : 0}`;
        holdHere = !!b.hold && d2(b.hold, sp) <= 6;
        b.lookAt = { ...sp };
      } else {
        goal = b.hold;
        key = 'hold';
        holdHere = true;
      }
    }
    if (!goal) {
      this.idleLook(b, cmd, dt);
      return;
    }
    // Compare against the goal snapped onto the nav grid (raw points can sit next to crates).
    const snapped = this.nav.nearest(goal) ?? goal;
    const arrived = d2(a.pos, snapped) < 1.2;
    if (arrived && holdHere) {
      this.setState(b, 'hold');
      this.holdLook(b, cmd, dt);
      return;
    }
    if (b.state !== 'retake') this.setState(b, 'advance');
    this.moveTo(b, cmd, goal, key, !cautious);
    if (cautious) cmd.walk = true;
    this.lookAlongPath(b, cmd, dt);
  }

  private holdLook(b: Brain, cmd: InputCommand, dt: number): void {
    const a = b.agent;
    const mem = this.freshestMemory(b, 4);
    const focus = mem?.pos ?? b.lookAt ?? this.sim.map.sites[this.plan.site].center;
    let yaw = yawTo(a.pos, focus);
    // Small idle sweep so holders are not statues.
    yaw += Math.sin(this.sim.time * 0.7 + a.id) * 0.35;
    this.turnTo(b, yaw, 0, dt * 0.6);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    cmd.crouch = a.difficulty !== 'facil' && Math.sin(this.sim.time * 0.3 + a.id * 2) > 0.7;
  }

  private investigate(b: Brain, cmd: InputCommand, dt: number): void {
    const a = b.agent;
    const n = b.noise;
    if (!n || this.sim.time > b.investigateUntil || d2(a.pos, n.pos) < 2) {
      this.setState(b, 'idle');
      this.planMove(b, cmd, dt, false);
      return;
    }
    this.moveTo(b, cmd, n.pos, `inv${Math.round(n.pos.x)}${Math.round(n.pos.z)}`, false);
    cmd.walk = a.difficulty !== 'facil';
    // Look at where the enemy was heard, not along the path.
    this.turnTo(b, yawTo(a.pos, n.pos), 0, dt);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    cmd.moveX = 0;
    cmd.moveZ = 0;
    this.steer(b, cmd);
  }

  // ---------- combat ----------

  private combat(b: Brain, cmd: InputCommand, dt: number, t: Agent): void {
    const a = b.agent;
    const now = this.sim.time;
    const sk = b.skill;
    const eye = a.eye();
    const dist = d2(a.pos, t.pos);
    // Aim error drifts so aim is never perfect; worse at range and when moving.
    if (now > b.errAt) {
      b.errAt = now + 0.3 + this.sim.rng() * 0.25;
      const g = (): number => (this.sim.rng() + this.sim.rng() + this.sim.rng() - 1.5) / 1.5;
      b.errYaw = g() * sk.aimErr;
      b.errPitch = g() * sk.aimErr * 0.6;
    }
    const aimY = t.pos.y + (b.headAim ? 1.6 : 1.2) - (t.motor.crouch > 0.5 ? 0.45 : 0);
    const dx = t.pos.x - eye.x;
    const dz = t.pos.z - eye.z;
    const wantYaw = Math.atan2(-dx, -dz) + b.errYaw;
    const wantPitch = Math.atan2(aimY - eye.y, Math.hypot(dx, dz)) + b.errPitch;
    this.turnTo(b, wantYaw, wantPitch, dt);
    cmd.yaw = b.aimYaw;
    // Recoil compensation: a skilled bot pulls down against the kick.
    cmd.pitch = b.aimPitch - a.recoilPitch * sk.recoilControl;
    const err = Math.abs(wrap(b.aimYaw - wantYaw)) + Math.abs(b.aimPitch - wantPitch);
    const tolerance = Math.atan2(0.45, Math.max(1, dist)) + sk.aimErr;

    const w = a.weapon.def;
    let fire = now >= b.reactReadyAt && err < tolerance && dist < w.range;
    if (fire && w.auto) {
      if (now < b.burstPauseUntil) fire = false;
      else if (a.input.fire && a.lastShotTime >= now - 0.02) {
        b.burstLeft--;
        if (b.burstLeft <= 0) {
          b.burstLeft = Math.max(2, Math.round(sk.burst * (dist > 25 ? 0.5 : 1)));
          b.burstPauseUntil = now + sk.burstPause * (dist > 25 ? 1.6 : 1);
        }
      }
    } else if (fire && !w.auto) {
      b.tapToggle = !b.tapToggle;
      fire = b.tapToggle;
    }
    cmd.fire = fire;
    cmd.aim = w.zoom > 1.2 && dist > 15;

    // Movement: strafe between shots; skilled bots stop when they fire.
    if (now > b.strafeAt) {
      b.strafeAt = now + 0.35 + this.sim.rng() * 0.6;
      b.strafeDir = this.sim.rng() < 0.5 ? -1 : 1;
      b.crouch = a.difficulty === 'dificil' && dist > 18 && this.sim.rng() < 0.35;
    }
    const stop = fire && this.sim.rng() < sk.stopToShoot;
    if (!stop && this.sim.rng() < sk.strafe + 0.2) cmd.moveX = b.strafeDir;
    if (w.category === 'corpo' || w.category === 'escopeta') cmd.moveZ = dist > 3 ? 1 : 0;
    cmd.crouch = b.crouch;
    // Never strafe into walls/ledges.
    this.guardEdges(b, cmd);
  }

  private cover(b: Brain, cmd: InputCommand, dt: number, t: Agent): void {
    // Back away from the threat while reloading, still facing it.
    const a = b.agent;
    this.turnTo(b, yawTo(a.pos, t.pos), 0, dt);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    cmd.moveZ = -1;
    cmd.moveX = b.strafeDir;
    if (this.sim.time > b.strafeAt) {
      b.strafeAt = this.sim.time + 0.5;
      b.strafeDir = -b.strafeDir;
    }
    this.guardEdges(b, cmd);
    const w = a.weapon;
    if (w.ammo === 0 && w.reserve > 0 && this.sim.time >= a.reloadEnd) cmd.reload = !a.prevInput.reload;
  }

  /** Cancel local movement that would push the bot into a wall or off the nav grid. */
  private guardEdges(b: Brain, cmd: InputCommand): void {
    const a = b.agent;
    const cy = Math.cos(a.yaw);
    const sy = Math.sin(a.yaw);
    const wx = cmd.moveX * cy - cmd.moveZ * sy;
    const wz = -cmd.moveX * sy - cmd.moveZ * cy;
    if (!wx && !wz) return;
    const l = Math.hypot(wx, wz);
    const probe = { x: a.pos.x + (wx / l) * 1.1, y: a.pos.y, z: a.pos.z + (wz / l) * 1.1 };
    if (!this.nav.lineWalkable(a.pos, probe)) {
      cmd.moveX = -cmd.moveX;
      b.strafeDir = -b.strafeDir;
      const p2 = { x: a.pos.x - (wx / l) * 1.1, y: a.pos.y, z: a.pos.z - (wz / l) * 1.1 };
      if (!this.nav.lineWalkable(a.pos, p2)) { cmd.moveX = 0; cmd.moveZ = 0; }
    }
  }

  // ---------- abilities ----------

  private useAbilities(b: Brain, cmd: InputCommand, target: Agent | null): void {
    const a = b.agent;
    const now = this.sim.time;
    if (now < b.nextAbilityAt || cmd.interact || now < a.reloadEnd) return;
    b.nextAbilityAt = now + 0.6 + this.sim.rng() * 0.8;
    const known = target ? { pos: target.pos, time: now } : this.freshestMemory(b, 3);
    for (const slot of ['X', 'E', 'Q', 'C'] as AbilitySlot[]) {
      if (!this.sim.abilities.canCast(a, slot)) continue;
      const def = a.abilities[slot].def;
      const aim = this.abilityAim(b, def, target, known);
      if (!aim) continue;
      cmd.ability = slot;
      if (aim !== 'self') {
        cmd.yaw = aim.yaw;
        cmd.pitch = aim.pitch;
        b.aimYaw = aim.yaw;
        b.aimPitch = aim.pitch;
      }
      cmd.fire = false;
      return;
    }
  }

  /** Decide if an ability is worth casting now; returns the aim to use, 'self', or null. */
  private abilityAim(b: Brain, def: AbilityDef, target: Agent | null, known: Memory | null): { yaw: number; pitch: number } | 'self' | null {
    const a = b.agent;
    const m = this.sim.match;
    const rng = this.sim.rng;
    const eye = a.eye();
    const at = (p: Vec3, lob = 0): { yaw: number; pitch: number } => {
      const dist = Math.max(1, d2(eye, p));
      return { yaw: yawTo(eye, p), pitch: Math.atan2(p.y + 0.5 - eye.y, dist) + lob * Math.min(0.5, 0.12 + dist * 0.012) };
    };
    const throwAt = (p: Vec3): { yaw: number; pitch: number } => at(p, 1);
    const siteCenter = m.phase === 'planted' ? m.spike.pos : this.sim.map.sites[this.plan.site].center;
    const nearSite = d2(a.pos, siteCenter) < 26;
    const enemyDefusing = this.sim.agents.find((e) => e.team !== a.team && e.alive && e.defuseProgress > 0);
    const knownDist = known ? d2(a.pos, known.pos) : 1e9;

    switch (def.kind) {
      case 'smoke':
      case 'blackout':
        if (a.team === 'atk' && b.state === 'advance' && nearSite && rng() < 0.5) {
          const holds = this.sim.map.sites[this.plan.site].holdPoints;
          return at(holds[Math.floor(rng() * holds.length)]);
        }
        if (target && knownDist > 14 && a.hp < 70) return at(target.pos);
        return null;
      case 'flash':
        if (known && !target && knownDist < 22 && knownDist > 4) return throwAt(known.pos);
        if (a.team === 'atk' && b.state === 'advance' && nearSite && rng() < 0.3) return throwAt(siteCenter);
        return null;
      case 'molly':
      case 'grenade':
      case 'slow':
      case 'poisonField':
        if (enemyDefusing && d2(a.pos, m.spike.pos) < 28) return throwAt(m.spike.pos);
        if (known && knownDist > 5 && knownDist < 24 && (!target || rng() < 0.4)) return throwAt(known.pos);
        return null;
      case 'reveal':
        if (b.state === 'advance' && nearSite) return at(siteCenter);
        if (b.state === 'retake') return at(m.spike.pos);
        return null;
      case 'revealAll':
        return (target || b.state === 'advance' || b.state === 'retake') && rng() < 0.5 ? 'self' : null;
      case 'sensor':
      case 'trap':
      case 'turret':
        if (b.state === 'hold' && !b.placedThisRound) {
          b.placedThisRound = true;
          return b.lookAt ? at(b.lookAt) : 'self';
        }
        return null;
      case 'wall':
        if (target && a.hp < 60) return at(target.pos);
        if (a.team === 'atk' && b.state === 'advance' && nearSite && rng() < 0.3) return at(siteCenter);
        return null;
      case 'heal':
        return a.hp < 60 && !target ? 'self' : null;
      case 'revive': {
        const fallen = this.sim.agents.find((x) => !x.alive && x.team === a.team && d2(x.deathPos, a.pos) < 15);
        return fallen && !target ? at(fallen.deathPos) : null;
      }
      case 'dash':
      case 'blink':
      case 'updraft':
        return target && a.hp < 45 && rng() < 0.4 ? 'self' : null;
      case 'shield':
      case 'fury':
      case 'ultWeapon':
        return target ? 'self' : null;
      case 'airstrike':
      case 'wave':
      case 'lockdown':
        if (target) return at(target.pos);
        if (enemyDefusing) return at(m.spike.pos);
        return null;
    }
    return null;
  }

  // ---------- locomotion ----------

  private moveTo(b: Brain, cmd: InputCommand, goal: Vec3, key: string, run: boolean): void {
    const a = b.agent;
    const now = this.sim.time;
    const goalMoved = !b.goal || d2(goal, b.goal) > 1.5;
    if (b.goalKey !== key || goalMoved || now > b.repathAt || b.pathIdx >= b.path.length) {
      b.goal = { ...goal };
      b.goalKey = key;
      const path = this.nav.findPath(a.pos, goal);
      b.path = path ?? [];
      b.pathIdx = 0;
      if (!path) {
        // Unreachable goal: drop it so the plan picks another one next tick.
        b.goalKey = '';
        b.repathAt = now + 0.5;
      }
      b.repathAt = now + 4;
      b.progressPos = { ...a.pos };
      b.progressTime = now;
    }
    // Standing on a teammate's head (grounded well above the floor): step off right away.
    if (a.motor.grounded && a.pos.y - this.sim.map.floorHeightAt(a.pos.x, a.pos.z) > 0.75 && !b.detour) {
      const ang = this.sim.rng() * TAU;
      b.detour = this.nav.nearest({ x: a.pos.x + Math.cos(ang) * 2.5, y: a.pos.y, z: a.pos.z + Math.sin(ang) * 2.5 });
      b.detourUntil = now + 1.2;
    }
    // Advance waypoints.
    while (b.pathIdx < b.path.length && d2(a.pos, b.path[b.pathIdx]) < 0.7) b.pathIdx++;
    cmd.walk = !run;
    this.steer(b, cmd);
    // Stuck handling: jump, then sidestep, then repath.
    if (d2(a.pos, b.progressPos) > 1) {
      b.progressPos = { ...a.pos };
      b.progressTime = now;
      b.stuckCount = 0;
    } else if (b.pathIdx < b.path.length || b.detour) {
      const stuck = now - b.progressTime;
      if (stuck > 0.8) cmd.jump = !a.prevInput.jump;
      if (stuck > 1.4 && now > b.sidestepUntil) {
        b.sidestepUntil = now + 0.5;
        b.strafeDir = this.sim.rng() < 0.5 ? -1 : 1;
      }
      if (stuck > 2.5) {
        b.repathAt = 0;
        b.progressTime = now;
        // Repeatedly blocked (teammates, ability barriers): walk around via a random nearby point.
        if (++b.stuckCount >= 1) {
          const ang = this.sim.rng() * TAU;
          const r = 2.5 + this.sim.rng() * 3;
          b.detour = this.nav.nearest({ x: a.pos.x + Math.cos(ang) * r, y: a.pos.y, z: a.pos.z + Math.sin(ang) * r });
          b.detourUntil = now + 1.6;
          b.stuckCount = 0;
        }
      }
    }
  }

  /** Convert the next waypoint into local moveX/moveZ for the bot's current yaw. */
  private steer(b: Brain, cmd: InputCommand): void {
    const a = b.agent;
    if (b.detour && (this.sim.time > b.detourUntil || d2(a.pos, b.detour) < 0.6)) b.detour = null;
    const wp = b.detour ?? b.path[b.pathIdx];
    if (!wp) return;
    const dx = wp.x - a.pos.x;
    const dz = wp.z - a.pos.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) return;
    const yaw = cmd.yaw;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    // Inverse of Motor: wx = mx*cy - mz*sy ; wz = -mx*sy - mz*cy
    const ux = dx / l;
    const uz = dz / l;
    cmd.moveX = ux * cy - uz * sy;
    cmd.moveZ = -ux * sy - uz * cy;
    if (this.sim.time < b.sidestepUntil) cmd.moveX += b.strafeDir * 0.9;
  }

  private lookAlongPath(b: Brain, cmd: InputCommand, dt: number): void {
    const a = b.agent;
    const wp = b.path[Math.min(b.pathIdx + 1, b.path.length - 1)] ?? b.path[b.pathIdx];
    const mem = this.freshestMemory(b, 2);
    if (mem) this.turnTo(b, yawTo(a.pos, mem.pos), 0, dt);
    else if (wp && d2(a.pos, wp) > 0.3) this.turnTo(b, yawTo(a.pos, wp), 0, dt * 0.8);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    this.steer(b, cmd);
  }

  private lookTowards(b: Brain, cmd: InputCommand, p: Vec3, dt: number): void {
    this.turnTo(b, yawTo(b.agent.pos, p), 0, dt);
    cmd.yaw = b.aimYaw;
    cmd.pitch = b.aimPitch;
    this.steer(b, cmd);
  }

  private turnTo(b: Brain, yaw: number, pitch: number, dt: number): void {
    const maxStep = b.skill.turn * dt;
    const dy = wrap(yaw - b.aimYaw);
    b.aimYaw = wrap(b.aimYaw + Math.max(-maxStep, Math.min(maxStep, dy * Math.min(1, dt * 12 + 0.25))));
    const dp = pitch - b.aimPitch;
    b.aimPitch += Math.max(-maxStep, Math.min(maxStep, dp * Math.min(1, dt * 12 + 0.25)));
  }

  dispose(): void {
    for (const u of this.unsub) u();
    this.brains.clear();
  }

  /** For debugging/harness: team of a bot id. */
  teamOf(id: number): Team | undefined {
    return this.brains.get(id)?.agent.team;
  }

  static weaponName(id: string): string {
    return WEAPONS[id]?.name ?? id;
  }
}
