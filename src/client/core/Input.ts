import type { AbilitySlot, InputCommand } from '@shared/types';
import { emptyInput } from '@shared/types';

export interface InputCallbacks {
  onShop(): void;
  onScoreboard(show: boolean): void;
  onPause(): void;
  onLockChange(locked: boolean): void;
}

export class Input {
  yaw = 0;
  pitch = 0;
  sensitivity = 1;
  enabled = true;
  private keys = new Set<string>();
  private mouseLeft = false;
  private mouseRight = false;
  private slot = 0;
  private ability: AbilitySlot | null = null;
  private wantDrop = false;
  private wantReload = false;
  private wheelSteps = 0;
  private lastWheel = 0;
  locked = false;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly cb: InputCallbacks) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('contextmenu', this.prevent);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  requestLock(): void {
    if (document.pointerLockElement === this.canvas) return;
    const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }

  exitLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private prevent = (e: Event): void => e.preventDefault();

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) {
      this.keys.clear();
      this.mouseLeft = this.mouseRight = false;
    }
    this.cb.onLockChange(this.locked);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.mouseLeft = this.mouseRight = false;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (e.code === 'Tab') {
      e.preventDefault();
      this.cb.onScoreboard(true);
      return;
    }
    if (e.code === 'Escape') {
      this.cb.onPause();
      return;
    }
    if (e.code === 'KeyB' && !e.repeat) {
      this.cb.onShop();
      return;
    }
    if (!this.locked) return;
    if (e.ctrlKey || e.code === 'Space') e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    switch (e.code) {
      case 'Digit1': this.slot = 1; break;
      case 'Digit2': this.slot = 2; break;
      case 'Digit3': this.slot = 3; break;
      case 'KeyQ': this.ability = 'Q'; break;
      case 'KeyE': this.ability = 'E'; break;
      case 'KeyC': this.ability = 'C'; break;
      case 'KeyX': this.ability = 'X'; break;
      case 'KeyG': this.wantDrop = true; break;
      case 'KeyR': this.wantReload = true; break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'Tab') {
      e.preventDefault();
      this.cb.onScoreboard(false);
    }
    this.keys.delete(e.code);
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled || !this.locked) return;
    if (e.button === 0) this.mouseLeft = true;
    if (e.button === 2) this.mouseRight = true;
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.mouseLeft = false;
    if (e.button === 2) this.mouseRight = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked || !this.enabled) return;
    const k = 0.0022 * this.sensitivity * this.zoomScale;
    this.yaw -= e.movementX * k;
    this.pitch -= e.movementY * k;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
  };

  /** One weapon step per wheel notch, throttled so a fast flick doesn't skip past a slot. */
  private onWheel = (e: WheelEvent): void => {
    if (!this.locked || !this.enabled || e.deltaY === 0) return;
    e.preventDefault();
    const now = performance.now();
    if (now - this.lastWheel < 80) return;
    this.lastWheel = now;
    this.wheelSteps += Math.sign(e.deltaY);
  };

  /** Pending wheel steps (+ = next weapon, - = previous); clears them. */
  takeWheel(): number {
    const n = this.wheelSteps;
    this.wheelSteps = 0;
    return n;
  }

  /** Request a weapon slot (1-3) for the next sample, as if its number key was pressed. */
  setSlot(slot: number): void {
    this.slot = slot;
  }

  zoomScale = 1;

  sample(): InputCommand {
    const cmd = emptyInput();
    if (!this.enabled || !this.locked) {
      cmd.yaw = this.yaw;
      cmd.pitch = this.pitch;
      return cmd;
    }
    const k = this.keys;
    cmd.moveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    cmd.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    cmd.jump = k.has('Space');
    cmd.crouch = k.has('ControlLeft') || k.has('ControlRight');
    cmd.walk = k.has('ShiftLeft') || k.has('ShiftRight');
    cmd.interact = k.has('KeyF');
    cmd.fire = this.mouseLeft;
    cmd.aim = this.mouseRight;
    cmd.yaw = this.yaw;
    cmd.pitch = this.pitch;
    cmd.slot = this.slot;
    cmd.ability = this.ability;
    cmd.drop = this.wantDrop;
    cmd.reload = this.wantReload;
    return cmd;
  }

  consumeOneShots(): void {
    this.ability = null;
    this.wantDrop = false;
    this.wantReload = false;
    this.slot = 0;
  }

  resetSlot(): void {
    this.slot = 0;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('contextmenu', this.prevent);
    document.removeEventListener('pointerlockchange', this.onLockChange);
  }
}
