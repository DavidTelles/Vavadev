import { Engine } from '@client/core/Engine';
import { Loop } from '@client/core/Loop';
import { Input } from '@client/core/Input';
import { MapRenderer } from '@client/maps/MapRenderer';
import { ViewModel } from '@client/weapons/ViewModel';
import type { ViewModelState } from '@client/weapons/ViewModel';
import { FX } from '@client/fx/FX';
import { AgentRenderer } from '@client/player/AgentRenderer';
import { Simulation, type AgentSetup } from '@shared/sim/Simulation';
import { getUsinaMap } from '@shared/data/maps/usina';
import { emptyInput, type InputCommand, v3dist } from '@shared/types';
import { TICK_DT } from '@shared/constants';
import { t } from '@shared/i18n/pt-BR';

const HUMAN_NAME = 'Você';
const HUMAN_CHAR = 'david';

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
  readonly engine: Engine;
  readonly input: Input;
  readonly fx: FX;
  readonly viewModel: ViewModel;
  readonly mapRenderer: MapRenderer;
  readonly loop: Loop;

  private _sim!: Simulation;
  get sim(): Simulation { return this._sim; }

  private readonly botRenderers = new Map<number, AgentRenderer>();
  private readonly hud = new Map<string, HTMLElement>();
  private humanAgentId = -1;

  // ViewModel animation state
  private readonly vmState: ViewModelState = {
    speed: 0, grounded: true, aiming: false, reloadT: 0, equipT: 0,
    lookDX: 0, lookDY: 0, planting: false,
  };
  private prevHumanYaw = 0;
  private prevHumanPitch = 0;
  private lastWeaponId = '';

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.viewModel = new ViewModel();
    this.fx = new FX();
    this.mapRenderer = new MapRenderer(getUsinaMap(), 'alta');
    this.input = new Input(canvas, {
      onShop: () => this.openShop(),
      onScoreboard: () => this.toggleScoreboard(),
      onPause: () => this.pause(),
      onLockChange: () => {},
    });
    this.engine.scene.add(this.mapRenderer.group);
    this.engine.scene.add(this.fx.group);

    this.loop = new Loop(
      TICK_DT,
      (dt) => this.fixedUpdate(dt),
      (dt, alpha) => this.frameUpdate(dt, alpha),
    );

    window.addEventListener('resize', () => this.resize());
    this.resize();

    this.buildHUD();
  }

  async init(): Promise<void> {
    await this.simReady;
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

  private readonly simReady: Promise<void> = (async () => {
    const sim = await Simulation.create({
      mode: 'competitivo',
      seed: 42,
      agents: this.buildAgentSetups(),
    });
    this.humanAgentId = sim.agents[0].id;
    this._sim = sim;
    this.wireEvents();
  })();

  private buildAgentSetups(): AgentSetup[] {
    const setups: AgentSetup[] = [];
    setups.push({ name: HUMAN_NAME, team: 'atk', characterId: HUMAN_CHAR, isBot: false, difficulty: 'normal' });
    const atkBots = ['Jão Gugu', 'Mallcon', 'Biro', 'Caio'];
    const defBots = ['Mirela', 'Isabela', 'Julia', 'China', 'Garcia'];
    for (const name of atkBots) setups.push({ name, team: 'atk', characterId: this.charId(name), isBot: true, difficulty: 'normal' });
    for (const name of defBots) setups.push({ name, team: 'def', characterId: this.charId(name), isBot: true, difficulty: 'normal' });
    return setups;
  }

  private charId(name: string): string {
    const map: Record<string, string> = {
      'Jão Gugu': 'jaogugu', Mallcon: 'mallcon', Biro: 'biro', Caio: 'caio',
      Mirela: 'mirela', Isabela: 'isabela', Julia: 'julia', China: 'china', Garcia: 'garcia',
    };
    return map[name] ?? 'david';
  }

  private wireEvents(): void {
    const e = this.sim.events;
    e.on('shot', (p) => this.fx.spawnTracer(p.origin, p.end, 0xffd28a));
    e.on('impact', (p) => this.fx.spawnImpact(p.point, p.normal, 0xffd28a));
    e.on('damage', (p) => {
      if (p.attackerId === this.humanAgentId) this.showHitMarker(p.part === 'head');
    });
    e.on('kill', (p) => {
      const killer = this.sim.agentById(p.killerId);
      const victim = this.sim.agentById(p.victimId);
      if (killer && victim) {
        this.addKillFeed(`${killer.name} ${t('feed.abate')} ${victim.name}` + (p.headshot ? ` — ${t('feed.headshot')}` : ''));
      }
    });
    e.on('roundEnd', () => this.showNotice(t('notice.venceuRodada')));
    e.on('phase', () => this.updateHUD());
  }

  private fixedUpdate(dt: number): void {
    const humanCmd = this.input.sample();
    this.sim.setInput(this.humanAgentId, humanCmd);

    for (const a of this.sim.agents) {
      if (a.id === this.humanAgentId || !a.isBot || !a.alive) continue;
      const cmd = this.botCommand(a);
      this.sim.setInput(a.id, cmd);
    }

    this.sim.step(dt);

    const human = this.sim.agentById(this.humanAgentId);
    if (human && human.weapon.def.id !== this.lastWeaponId) {
      this.lastWeaponId = human.weapon.def.id;
      this.viewModel.setWeapon(this.lastWeaponId);
      this.viewModel.setArmColors(0x2a3a55, 0xd9a07a);
    }
    this.updateHUD();
  }

  private botCommand(bot: import('@shared/sim/Agent').Agent): InputCommand {
    const cmd = emptyInput();
    if (!bot.alive) return cmd;
    let target: import('@shared/sim/Agent').Agent | null = null;
    let bestD = 1e9;
    for (const e of this.sim.agents) {
      if (e.team !== bot.team && e.alive) {
        const d = v3dist(bot.pos, e.pos);
        if (d < bestD) { bestD = d; target = e; }
      }
    }
    if (!target) return cmd;
    const eye = bot.eye();
    const dx = target.pos.x - eye.x;
    const dy = (target.pos.y + 1.1) - eye.y;
    const dz = target.pos.z - eye.z;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    bot.yaw = yaw;
    bot.pitch = Math.max(-1.3, Math.min(1.3, pitch));
    cmd.yaw = yaw;
    cmd.pitch = bot.pitch;
    if (bestD > 6) cmd.moveZ = 1;
    if (bestD < 45) cmd.fire = true;
    return cmd;
  }
  private frameUpdate(dt: number, alpha: number): void {
    const human = this.sim.agentById(this.humanAgentId);
    if (human && human.alive) {
      human.eye(this.engine.camera.position);
      this.engine.camera.rotation.set(human.pitch, human.yaw, 0, 'YXZ');

      this.viewModel.camera.position.copy(this.engine.camera.position);
      this.viewModel.camera.quaternion.copy(this.engine.camera.quaternion);
      const cur = this.input.sample();
      this.vmState.speed = human.motor.horizontalSpeed();
      this.vmState.grounded = human.motor.grounded;
      this.vmState.aiming = cur.aim;
      this.vmState.lookDX = cur.yaw - this.prevHumanYaw;
      this.vmState.lookDY = cur.pitch - this.prevHumanPitch;
      this.prevHumanYaw = cur.yaw;
      this.prevHumanPitch = cur.pitch;
      this.vmState.planting = human.plantProgress > 0;
      const t = this.sim.time;
      this.vmState.reloadT = Math.max(0, human.reloadEnd - t);
      this.vmState.equipT = Math.max(0, human.equipEnd - t);
      this.viewModel.update(dt, this.vmState);
    }

    for (const r of this.botRenderers.values()) r.update(dt, alpha);
    this.fx.update(dt);

    this.engine.render();
    this.engine.renderer.render(this.viewModel.scene, this.viewModel.camera);
  }

  private resize(): void {
    this.engine.resize();
    this.viewModel.resize(this.engine.camera.aspect);
  }

  private buildHUD(): void {
    const root = document.getElementById('ui-root')!;
    const make = (id: string, text: string): HTMLElement => {
      const el = document.createElement('div');
      el.id = id;
      el.textContent = text;
      el.style.position = 'absolute';
      el.style.pointerEvents = 'none';
      el.style.color = '#eef2f5';
      el.style.fontFamily = "'Segoe UI', Roboto, sans-serif";
      el.style.textShadow = '0 2px 4px rgba(0,0,0,0.8)';
      root.appendChild(el);
      this.hud.set(id, el);
      return el;
    };
    const cross = document.createElement('div');
    cross.id = 'crosshair';
    cross.style.position = 'absolute';
    cross.style.left = '50%'; cross.style.top = '50%';
    cross.style.width = '10px'; cross.style.height = '10px';
    cross.style.border = '2px solid rgba(255,255,255,0.6)';
    cross.style.borderRadius = '50%';
    cross.style.transform = 'translate(-50%,-50%)';
    cross.style.pointerEvents = 'none';
    root.appendChild(cross);

    make('hud-ammo', '');
    make('hud-status', '');
    make('hud-round', '');
    make('killfeed', '');
    const ammo = this.hud.get('hud-ammo')!;
    ammo.style.bottom = '120px'; ammo.style.left = '20px'; ammo.style.fontSize = '1.4rem'; ammo.style.fontWeight = '700';
    const status = this.hud.get('hud-status')!;
    status.style.bottom = '60px'; status.style.left = '20px'; status.style.fontSize = '1.1rem';
    const round = this.hud.get('hud-round')!;
    round.style.top = '20px'; round.style.left = '20px'; round.style.fontSize = '1.2rem'; round.style.fontWeight = '700';
    const kf = this.hud.get('killfeed')!;
    kf.style.bottom = '20px'; kf.style.right = '20px'; kf.style.fontSize = '0.95rem'; kf.style.maxWidth = '320px';
  }

  private updateHUD(): void {
    const human = this.sim.agentById(this.humanAgentId);
    if (!human) return;
    const w = human.weapon;
    const ammoEl = this.hud.get('hud-ammo')!;
    ammoEl.textContent = w.def.category === 'corpo' ? 'FACA' : `${w.ammo} / ${w.reserve}`;
    const statusEl = this.hud.get('hud-status')!;
    statusEl.textContent = `HP ${human.hp} | Arm ${human.armor} | ${t('hud.creditos')} ${human.credits}`;
    const roundEl = this.hud.get('hud-round')!;
    roundEl.textContent = `${t('hud.rodada')} ${this.sim.match.round} · ${t('phase.' + this.sim.match.phase)} (${Math.ceil(this.sim.match.timeLeft)}s)`;
  }

  private showHitMarker(headshot: boolean): void {
    const el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '50%'; el.style.top = '50%';
    el.style.width = '24px'; el.style.height = '24px';
    el.style.border = headshot ? '4px solid #ffd28a' : '2px solid #fff';
    el.style.borderRadius = '50%';
    el.style.transform = 'translate(-50%,-50%)';
    el.style.pointerEvents = 'none';
    el.style.opacity = '1';
    document.getElementById('ui-root')!.appendChild(el);
    let elapsed = 0;
    const tick = () => {
      elapsed += 1 / 60;
      el.style.opacity = String(Math.max(0, 1 - elapsed / 0.15));
      if (elapsed < 0.15) requestAnimationFrame(tick); else el.remove();
    };
    requestAnimationFrame(tick);
  }

  private addKillFeed(text: string): void {
    const kf = this.hud.get('killfeed')!;
    const line = document.createElement('div');
    line.textContent = text;
    line.style.color = '#eef2f5';
    line.style.marginBottom = '4px';
    kf.insertBefore(line, kf.firstChild);
    while (kf.children.length > 6) kf.removeChild(kf.lastChild!);
    setTimeout(() => line.remove(), 5000);
  }

  private showNotice(text: string): void {
    this.addKillFeed(text);
  }

  private openShop(): void { /* full shop UI in Phase 7 */ }
  private toggleScoreboard(): void { /* scoreboard UI in Phase 7 */ }
  private pause(): void { /* pause UI in Phase 7 */ }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.fx.dispose();
    this.mapRenderer.dispose();
    for (const r of this.botRenderers.values()) r.dispose();
    this.botRenderers.clear();
    this.sim.dispose();
  }
}
