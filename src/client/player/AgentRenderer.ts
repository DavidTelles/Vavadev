import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from '@client/characters/ProceduralCharacter';
import { APPEARANCES } from '@client/characters/appearances';
import type { Agent } from '@shared/sim/Agent';
import type { Difficulty, Team, Vec3 } from '@shared/types';

/**
 * Renders a single sim Agent as a Three.js skinned character.
 *
 * The sim is authoritative for position/yaw/state. This renderer interpolates
 * between sim ticks for smooth rAF display and drives the AnimationMixer from
 * the motor state (idle / walk / run / crouch / jump / death).
 *
 * Implements the CharacterModelProvider idea: the rig is built from a
 * procedural Appearance today, but a GLB-loaded mesh could be swapped in here
 * without touching the sim.
 */
export class AgentRenderer {
  readonly agent: Agent;
  readonly rig: CharacterRig;
  readonly mesh: THREE.SkinnedMesh;
  readonly mixer: THREE.AnimationMixer;
  readonly root: THREE.Group;

  private readonly actions = new Map<string, THREE.AnimationAction>();
  private currentClip = '';
  private prevPos: Vec3 = { x: 0, y: 0, z: 0 };
  private renderPos: Vec3 = { x: 0, y: 0, z: 0 };
  private renderYaw = 0;

  constructor(agent: Agent) {
    this.agent = agent;
    const app = APPEARANCES[agent.character.id] ?? APPEARANCES.david;
    this.rig = buildCharacter(app);
    this.mesh = this.rig.mesh;
    this.root = this.rig.root;
    this.root.add(this.mesh);
    this.root.position.set(agent.pos.x, agent.pos.y, agent.pos.z);
    this.root.rotation.y = agent.yaw;

    this.mixer = new THREE.AnimationMixer(this.mesh);
    for (const clip of this.rig.clips) {
      const action = this.mixer.clipAction(clip);
      if (clip.name === 'death') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.actions.set(clip.name, action);
    }

    this.prevPos = { ...agent.pos };
    this.renderPos = { ...agent.pos };
    this.renderYaw = agent.yaw;
    this.prevYaw = agent.yaw;
    this.play('idle');
  }

  play(name: string): void {
    const next = this.actions.get(name);
    if (!next) return;
    const cur = this.actions.get(this.currentClip);
    if (cur && cur !== next) cur.fadeOut(0.15);
    next.fadeIn(0.15);
    next.play();
    this.currentClip = name;
  }

  /** Call once per fixed tick, BEFORE sim.step, to remember the previous state. */
  snapshot(): void {
    const a = this.agent;
    this.prevPos.x = a.pos.x;
    this.prevPos.y = a.pos.y;
    this.prevPos.z = a.pos.z;
    this.prevYaw = a.yaw;
  }

  /** Interpolate between the previous tick and the current sim state. */
  setPose(pos: Vec3, yaw: number, alpha: number): void {
    this.renderPos.x = this.prevPos.x + (pos.x - this.prevPos.x) * alpha;
    this.renderPos.y = this.prevPos.y + (pos.y - this.prevPos.y) * alpha;
    this.renderPos.z = this.prevPos.z + (pos.z - this.prevPos.z) * alpha;
    this.renderYaw = this.prevYaw + this.shortestAngle(this.prevYaw, yaw) * alpha;
  }

  private prevYaw = 0;

  private shortestAngle(a: number, b: number): number {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  private motorState(): 'idle' | 'walk' | 'run' | 'crouch' | 'jump' | 'death' {
    const a = this.agent;
    if (!a.alive) return 'death';
    const m = a.motor;
    if (!m.grounded) return 'jump';
    if (m.crouch > 0.5) return m.horizontalSpeed() > 0.1 ? 'crouch' : 'idle';
    return m.horizontalSpeed() > 0.1 ? 'run' : 'idle';
  }

  update(dt: number, alpha: number): void {
    const a = this.agent;
    const state = this.motorState();
    const want = state === 'death' ? 'death' : state === 'jump' ? 'jump' : state;
    if (want !== this.currentClip && want !== 'death') this.play(want);
    else if (want === 'death' && this.currentClip !== 'death') this.play('death');

    this.setPose(a.pos, a.yaw, alpha);
    this.mixer.update(dt);

    this.root.position.set(this.renderPos.x, this.renderPos.y, this.renderPos.z);
    this.root.rotation.y = this.renderYaw;

    // Crouch visual: sink the root a bit.
    const crouchSink = a.motor.crouch * 0.3;
    this.mesh.position.y = -crouchSink;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.rig.dispose();
  }

  get isBot(): boolean {
    return this.agent.isBot;
  }

  get team(): Team {
    return this.agent.team;
  }

  get difficulty(): Difficulty {
    return this.agent.difficulty;
  }
}
