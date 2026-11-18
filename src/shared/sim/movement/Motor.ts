import RAPIER from '@dimforge/rapier3d-compat';
import {
  AIR_ACCEL, CROUCH_EYE, CROUCH_HEIGHT, CROUCH_SPEED, GRAVITY, GROUND_ACCEL, GROUND_FRICTION, GROUP_AGENT, JUMP_VELOCITY,
  MAX_SLOPE_DEG, PLAYER_RADIUS, RUN_SPEED, STAND_EYE, STAND_HEIGHT, STEP_HEIGHT, WALK_SPEED,
} from '../../constants';
import type { Vec3 } from '../../types';
import { groups, MOVE_FILTER, type PhysicsWorld } from '../physics/PhysicsWorld';

export interface MoveIntent {
  moveX: number;
  moveZ: number;
  yaw: number;
  jump: boolean;
  crouch: boolean;
  walk: boolean;
}

export class Motor {
  readonly pos: Vec3;
  readonly vel: Vec3 = { x: 0, y: 0, z: 0 };
  grounded = false;
  crouch = 0;
  wantCrouch = false;
  speedMult = 1;
  landed = false;
  jumped = false;
  airTime = 0;
  private readonly collider: RAPIER.Collider;
  private readonly controller: RAPIER.KinematicCharacterController;
  private height = STAND_HEIGHT;
  private readonly delta = { x: 0, y: 0, z: 0 };

  constructor(private readonly physics: PhysicsWorld, spawn: Vec3) {
    this.pos = { ...spawn };
    const desc = RAPIER.ColliderDesc.capsule(STAND_HEIGHT / 2 - PLAYER_RADIUS, PLAYER_RADIUS)
      .setTranslation(spawn.x, spawn.y + STAND_HEIGHT / 2, spawn.z)
      .setCollisionGroups(groups(GROUP_AGENT, 0xffff));
    this.collider = physics.world.createCollider(desc);
    this.controller = physics.world.createCharacterController(0.02);
    this.controller.enableAutostep(STEP_HEIGHT, 0.15, false);
    this.controller.enableSnapToGround(0.35);
    this.controller.setMaxSlopeClimbAngle((MAX_SLOPE_DEG * Math.PI) / 180);
    this.controller.setApplyImpulsesToDynamicBodies(false);
  }

  get colliderHandle(): number {
    return this.collider.handle;
  }

  get eyeHeight(): number {
    return STAND_EYE + (CROUCH_EYE - STAND_EYE) * this.crouch;
  }

  get bodyHeight(): number {
    return this.height;
  }

  eye(out: Vec3): Vec3 {
    out.x = this.pos.x;
    out.y = this.pos.y + this.eyeHeight;
    out.z = this.pos.z;
    return out;
  }

  horizontalSpeed(): number {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  teleport(p: Vec3): void {
    this.pos.x = p.x;
    this.pos.y = p.y;
    this.pos.z = p.z;
    this.vel.x = this.vel.y = this.vel.z = 0;
    this.crouch = 0;
    this.setHeight(STAND_HEIGHT);
    this.syncCollider();
  }

  setEnabled(on: boolean): void {
    this.collider.setEnabled(on);
  }

  impulse(x: number, y: number, z: number): void {
    this.vel.x += x;
    this.vel.y += y;
    this.vel.z += z;
    if (y > 0) this.grounded = false;
  }

  step(intent: MoveIntent, dt: number): void {
    this.landed = false;
    this.jumped = false;
    this.updateCrouch(intent.crouch, dt);

    const sy = Math.sin(intent.yaw);
    const cy = Math.cos(intent.yaw);
    let wx = intent.moveX * cy - intent.moveZ * sy;
    let wz = -intent.moveX * sy - intent.moveZ * cy;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) { wx /= wl; wz /= wl; }

    const base = this.crouch > 0.5 ? CROUCH_SPEED : intent.walk ? WALK_SPEED : RUN_SPEED;
    const maxSpeed = base * this.speedMult;

    if (this.grounded) {
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const drop = sp * GROUND_FRICTION * dt * (wl > 0.01 ? 0.35 : 1);
        const ns = Math.max(sp - drop, 0) / sp;
        this.vel.x *= ns;
        this.vel.z *= ns;
      }
      this.accelerate(wx, wz, maxSpeed, GROUND_ACCEL, dt);
      if (intent.jump && this.crouch < 0.5) {
        this.vel.y = JUMP_VELOCITY;
        this.grounded = false;
        this.jumped = true;
      }
    } else {
      this.accelerate(wx, wz, maxSpeed, AIR_ACCEL, dt);
    }

    this.vel.y -= GRAVITY * dt;
    if (this.vel.y < -40) this.vel.y = -40;

    this.delta.x = this.vel.x * dt;
    this.delta.y = this.vel.y * dt;
    this.delta.z = this.vel.z * dt;
    this.controller.computeColliderMovement(this.collider, this.delta, undefined, MOVE_FILTER);
    const m = this.controller.computedMovement();
    const wasGrounded = this.grounded;
    this.grounded = this.controller.computedGrounded();

    this.pos.x += m.x;
    this.pos.y += m.y;
    this.pos.z += m.z;

    if (dt > 0) {
      if (Math.abs(m.x - this.delta.x) > 1e-4) this.vel.x = m.x / dt;
      if (Math.abs(m.z - this.delta.z) > 1e-4) this.vel.z = m.z / dt;
    }
    if (this.grounded && this.vel.y < 0) this.vel.y = 0;
    if (this.vel.y > 0 && m.y < this.delta.y - 1e-4) this.vel.y = 0;

    if (this.grounded) {
      if (!wasGrounded && this.airTime > 0.25) this.landed = true;
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }

    if (this.pos.y < -20) this.pos.y = 1;
    this.syncCollider();
  }

  private accelerate(wx: number, wz: number, maxSpeed: number, accel: number, dt: number): void {
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = maxSpeed * Math.hypot(wx, wz) - cur;
    if (add <= 0) return;
    const a = Math.min(accel * maxSpeed * dt, add);
    this.vel.x += a * wx;
    this.vel.z += a * wz;
  }

  private updateCrouch(want: boolean, dt: number): void {
    this.wantCrouch = want;
    const target = want ? 1 : 0;
    if (target === this.crouch) return;
    let next = this.crouch + Math.sign(target - this.crouch) * dt * 8;
    next = Math.min(1, Math.max(0, next));
    const h = STAND_HEIGHT + (CROUCH_HEIGHT - STAND_HEIGHT) * next;
    if (h > this.height && !this.headroom(h)) return;
    this.crouch = next;
    this.setHeight(h);
  }

  private headroom(h: number): boolean {
    const top = this.pos.y + this.height - 0.05;
    const need = h - this.height + 0.1;
    const r = PLAYER_RADIUS * 0.7;
    const offsets = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]];
    for (const [ox, oz] of offsets) {
      if (this.physics.raycast({ x: this.pos.x + ox, y: top, z: this.pos.z + oz }, { x: 0, y: 1, z: 0 }, need)) return false;
    }
    return true;
  }

  private setHeight(h: number): void {
    this.height = h;
    this.collider.setHalfHeight(Math.max(0.05, h / 2 - PLAYER_RADIUS));
  }

  private syncCollider(): void {
    this.collider.setTranslation({ x: this.pos.x, y: this.pos.y + this.height / 2, z: this.pos.z });
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeCollider(this.collider, false);
  }
}
