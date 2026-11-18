import type { Engine } from '@client/core/Engine';
import { Loop } from '@client/core/Loop';
import { Input } from '@client/core/Input';
import { MapRenderer } from '@client/maps/MapRenderer';
import { ViewModel } from '@client/weapons/ViewModel';
import type { ViewModelState } from '@client/weapons/ViewModel';
import { FX } from '@client/fx/FX';
import { AgentRenderer } from '@client/player/AgentRenderer';
import { WorldRenderer } from '@client/fx/WorldRenderer';
import { HUD } from '@client/ui/HUD';
import type { Settings } from '@client/Profile';
import { Simulation, type AgentSetup } from '@shared/sim/Simulation';
import type { Agent } from '@shared/sim/Agent';
import { getUsinaMap } from '@shared/data/maps/usina';
import { CHARACTERS } from '@shared/data/characters';
import { WEAPONS } from '@shared/data/weapons';
import { emptyInput, type Difficulty, type InputCommand, type MatchMode, type Team, v3dist } from '@shared/types';
import { TICK_DT } from '@shared/constants';
import { t } from '@shared/i18n/pt-BR';

const abilityName = (id: string): string => {
  if (id === 'spike') return 'Spike';
  for (const c of CHARACTERS) for (const a of Object.values(c.abilities)) if (a.id === id) return a.name;
  return id;
};

export interface GameOptions {
  mode: MatchMode;
  difficulty: Difficulty;
  characterId: string;
  settings: Settings;
}

export interface GameResult {
  won: boolean;
  score: Record<Team, number>;
  kills: number;
  deaths: number;
  assists: number;
}

/**
 * The single-player client. Runs the shared Simulation (LocalAuthority) and
 * renders it: map, bot agents (third-person), first-person camera + viewmodel,
 * FX tracers/impacts, and a minimal DOM HUD.
 *
 * Input -> Simulation (fixed 60 Hz) -> render (rAF with interpolation).
 * Swapping to NetworkAuthority (Phase 8) only replaces the input/sync layer;
 * the sim and renderer stay identical.
 */
export class Game {
  readonly input: Input;
  readonly fx: FX;
  readonly viewModel: ViewModel;
  readonly mapRenderer: MapRenderer;
  readonly loop: Loop;

  private _sim!: Simulation;
  get sim(): Simulation { return this._sim; }

  private readonly botRenderers = new Map<number, AgentRenderer>();
  private hud!: HUD;
  private world!: WorldRenderer;
  private spectateId = -1;
  private readonly hudRoot: HTMLElement;
  private readonly pauseEl: HTMLElement;
  private humanAgentId = -1;
  private ended = false;
  private exitTimer = 0;

  // ViewModel animation state
  private readonly vmState: ViewModelState = {
    speed: 0, grounded: true, aiming: false, reloadT: 0, equipT: 0,
    lookDX: 0, lookDY: 0, planting: false,
  };
  private prevHumanYaw = 0;
  private prevHumanPitch = 0;
  private lastWeaponId = '';

  constructor(readonly engine: Engine, private readonly opts: GameOptions, private readonly onExit: (r: GameResult | null) => void) {
    const canvas = engine.canvas;
    this.viewModel = new ViewModel();
    this.viewModel.useRenderer(engine.renderer);
    this.fx = new FX();
    this.mapRenderer = new MapRenderer(getUsinaMap(), opts.settings.quality);
    this.input = new Input(canvas, {
      onShop: () => this.openShop(),
      onScoreboard: () => this.toggleScoreboard(),
      onPause: () => this.pause(),
      onLockChange: (locked) => this.pauseEl.classList.toggle('on', !locked && !this.ended && !this.hud?.shopOpen),
    });
    this.input.sensitivity = opts.settings.sensitivity;
    engine.setQuality(opts.settings.quality);
    engine.setFov(opts.settings.fov);
    engine.renderer.autoClear = false;
    engine.scene.add(this.mapRenderer.group);
    engine.scene.add(this.fx.group);

    this.loop = new Loop(
      TICK_DT,
      (dt) => this.fixedUpdate(dt),
      (dt, alpha) => this.frameUpdate(dt, alpha),
    );

    window.addEventListener('resize', this.resize);
    this.resize();

    const root = document.getElementById('ui-root')!;
    this.hudRoot = document.createElement('div');
    this.hudRoot.className = 'game-hud';
    root.appendChild(this.hudRoot);
    this.pauseEl = this.buildPause();
  }

  async init(): Promise<void> {
    const sim = await Simulation.create({
      mode: this.opts.mode,
      agents: this.buildAgentSetups(),
    });
    this.humanAgentId = sim.agents[0].id;
    this._sim = sim;
    this.hud = new HUD(this.hudRoot, sim, this.humanAgentId);
    this.hudRoot.appendChild(this.pauseEl);
    this.world = new WorldRenderer(sim);
    this.engine.scene.add(this.world.group);
    this.wireEvents();
    this.sim.start();

    for (const a of this.sim.agents) {
      if (a.id === this.humanAgentId) continue;
      const r = new AgentRenderer(a);
      this.botRenderers.set(a.id, r);
      this.engine.scene.add(r.root);
    }

    this.input.requestLock();
    this.loop.start();
  }

  private buildAgentSetups(): AgentSetup[] {
    const { characterId, difficulty, settings } = this.opts;
    const others = CHARACTERS.filter((c) => c.id !== characterId);
    const setups: AgentSetup[] = [{ name: settings.playerName, team: 'atk', characterId, isBot: false, difficulty }];
    others.slice(0, 4).forEach((c) => setups.push({ name: c.name, team: 'atk', characterId: c.id, isBot: true, difficulty }));
    others.slice(4, 9).forEach((c) => setups.push({ name: c.name, team: 'def', characterId: c.id, isBot: true, difficulty }));
    return setups;
  }

  private wireEvents(): void {
    const e = this.sim.events;
    const human = (): Agent => this.sim.agentById(this.humanAgentId)!;
    e.on('shot', (p) => this.fx.spawnTracer(p.origin, p.end, 0xffd28a));
    e.on('impact', (p) => this.fx.spawnImpact(p.point, p.normal, 0xffd28a));
    e.on('damage', (p) => {
      if (p.attackerId === this.humanAgentId) this.hud.hitMarker(p.part === 'head');
    });
    e.on('kill', (p) => {
      const victim = this.sim.agentById(p.victimId);
      if (!victim) return;
      const wname = WEAPONS[p.weaponId]?.name ?? abilityName(p.weaponId);
      this.hud.killFeed(this.sim.agentById(p.killerId), victim, p.headshot, wname);
    });
    e.on('roundStart', (p) => {
      this.hud.showBanner(`${t('hud.rodada').toUpperCase()} ${p.round}`, t(human().team === 'atk' ? 'hud.atacando' : 'hud.defendendo'), true, 2500);
    });
    e.on('roundEnd', (p) => {
      const won = p.winner === human().team;
      this.hud.toggleShop(false);
      this.hud.showBanner(t(won ? 'result.vitoria' : 'result.derrota'), t('reason.' + p.reason).toUpperCase(), won, 4000);
    });
    e.on('spikePlanted', () => this.hud.showBanner(t('notice.spikePlantada').toUpperCase(), '', human().team === 'atk', 2000));
    e.on('spikeDefused', () => this.hud.showBanner(t('notice.spikeDesarmada').toUpperCase(), '', human().team === 'def', 2000));
    e.on('sideSwap', () => this.hud.showBanner(t('notice.ladoTrocado').toUpperCase(), '', true, 2500));
    e.on('matchEnd', (p) => this.finish(p.winner, p.score));
  }

  private finish(winner: Team, score: Record<Team, number>): void {
    if (this.ended) return;
    this.ended = true;
    const human = this.sim.agentById(this.humanAgentId)!;
    const won = winner === human.team;
    const banner = document.createElement('div');
    banner.className = 'game-result';
    this.hud.toggleShop(false);
    this.hud.showBoard(false);
    banner.innerHTML = `<b>${t(won ? 'result.vitoria' : 'result.derrota')}</b><span>${score.atk} : ${score.def}</span>`;
    this.hudRoot.appendChild(banner);
    this.input.exitLock();
    const result: GameResult = { won, score, kills: human.stats.kills, deaths: human.stats.deaths, assists: human.stats.assists };
    this.exitTimer = window.setTimeout(() => this.onExit(result), 5000);
  }

  private fixedUpdate(dt: number): void {
    const humanCmd = this.input.sample();
    this.sim.setInput(this.humanAgentId, humanCmd);
    this.input.consumeOneShots();

    for (const a of this.sim.agents) {
      if (a.id === this.humanAgentId || !a.isBot || !a.alive) continue;
      const cmd = this.botCommand(a);
      this.sim.setInput(a.id, cmd);
    }

    for (const r of this.botRenderers.values()) r.snapshot();
    this.sim.step(dt);

    const human = this.sim.agentById(this.humanAgentId);
    if (human && human.weapon.def.id !== this.lastWeaponId) {
      this.lastWeaponId = human.weapon.def.id;
      this.viewModel.setWeapon(this.lastWeaponId);
      this.viewModel.setArmColors(0x2a3a55, 0xd9a07a);
    }
  }

  /** Placeholder bot brain until Phase 5: chase the nearest visible enemy and shoot. */
  private botCommand(bot: Agent): InputCommand {
    const cmd = emptyInput();
    cmd.yaw = bot.yaw;
    cmd.pitch = bot.pitch;
    if (!bot.alive) return cmd;
    let target: Agent | null = null;
    let bestD = 1e9;
    const eye = bot.eye();
    for (const e of this.sim.agents) {
      if (e.team !== bot.team && e.alive) {
        const d = v3dist(bot.pos, e.pos);
        if (d < bestD) { bestD = d; target = e; }
      }
    }
    if (!target) return cmd;
    const aimPoint = { x: target.pos.x, y: target.pos.y + 1.1, z: target.pos.z };
    const visible = this.sim.canSee(eye, aimPoint);
    const dx = aimPoint.x - eye.x;
    const dy = aimPoint.y - eye.y;
    const dz = aimPoint.z - eye.z;
    cmd.yaw = Math.atan2(-dx, -dz);
    cmd.pitch = Math.max(-1.3, Math.min(1.3, Math.atan2(dy, Math.hypot(dx, dz))));
    if (bestD > 6 || !visible) cmd.moveZ = 1;
    if (visible && bestD < 45) cmd.fire = true;
    return cmd;
  }

  private frameUpdate(dt: number, alpha: number): void {
    const human = this.sim.agentById(this.humanAgentId);
    const spect = human && !human.alive ? this.pickSpectate(human) : null;
    for (const [id, r] of this.botRenderers) r.root.visible = id !== spect?.id;
    if (spect) {
      spect.eye(this.engine.camera.position);
      this.engine.camera.rotation.set(spect.pitch, spect.yaw, 0, 'YXZ');
    }
    if (human && human.alive) {
      human.eye(this.engine.camera.position);
      this.engine.camera.rotation.set(human.pitch, human.yaw, 0, 'YXZ');

      this.viewModel.camera.position.copy(this.engine.camera.position);
      this.viewModel.camera.quaternion.copy(this.engine.camera.quaternion);
      this.vmState.speed = human.motor.horizontalSpeed();
      this.vmState.grounded = human.motor.grounded;
      this.vmState.aiming = human.input.aim;
      this.vmState.lookDX = this.input.yaw - this.prevHumanYaw;
      this.vmState.lookDY = this.input.pitch - this.prevHumanPitch;
      this.prevHumanYaw = this.input.yaw;
      this.prevHumanPitch = this.input.pitch;
      this.vmState.planting = human.plantProgress > 0;
      const now = this.sim.time;
      this.vmState.reloadT = Math.max(0, human.reloadEnd - now);
      this.vmState.equipT = Math.max(0, human.equipEnd - now);
      this.viewModel.update(dt, this.vmState);
    }

    for (const r of this.botRenderers.values()) r.update(dt, alpha);
    this.fx.update(dt);
    this.world.update(dt);
    this.hud.update(spect);

    const r = this.engine.renderer;
    r.clear();
    this.engine.render();
    if (human && human.alive) {
      r.clearDepth();
      r.render(this.viewModel.scene, this.viewModel.camera);
    }
  }

  private pickSpectate(human: Agent): Agent | null {
    const cur = this.sim.agentById(this.spectateId);
    if (cur && cur.alive && cur.team === human.team) return cur;
    const next = this.sim.agents.find((a) => a.alive && a.team === human.team && a.id !== human.id) ?? null;
    this.spectateId = next?.id ?? -1;
    return next;
  }

  private resize = (): void => {
    this.engine.resize();
    this.viewModel.resize(this.engine.camera.aspect);
  };

  private buildPause(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'game-pause on';
    el.innerHTML = `
      <div class="box">
        <h2>${t('pausa.titulo').toUpperCase()}</h2>
        <button data-a="go">${t('pausa.continuar').toUpperCase()}</button>
        <button data-a="exit">${t('pausa.sairMenu').toUpperCase()}</button>
      </div>`;
    el.querySelector('[data-a="go"]')!.addEventListener('click', () => this.input.requestLock());
    el.querySelector('[data-a="exit"]')!.addEventListener('click', () => this.onExit(null));
    return el;
  }

  private openShop(): void {
    if (!this.hud || this.ended) return;
    const human = this.sim.agentById(this.humanAgentId)!;
    const open = !this.hud.shopOpen && human.alive;
    this.hud.toggleShop(open);
    if (open) this.input.exitLock();
    else this.input.requestLock();
  }

  private toggleScoreboard(show = true): void {
    this.hud?.showBoard(show);
  }

  private pause(): void {
    if (this.hud?.shopOpen) {
      this.hud.toggleShop(false);
      this.input.requestLock();
      return;
    }
    this.input.exitLock();
  }

  dispose(): void {
    clearTimeout(this.exitTimer);
    this.loop.stop();
    this.input.exitLock();
    this.input.dispose();
    window.removeEventListener('resize', this.resize);
    for (const r of this.botRenderers.values()) {
      this.engine.scene.remove(r.root);
      r.dispose();
    }
    this.botRenderers.clear();
    this.engine.scene.remove(this.mapRenderer.group, this.fx.group);
    if (this.world) {
      this.engine.scene.remove(this.world.group);
      this.world.dispose();
    }
    this.hud?.dispose();
    this.fx.dispose();
    this.mapRenderer.dispose();
    this.hudRoot.remove();
    this.engine.renderer.autoClear = true;
    this._sim?.dispose();
  }
}
