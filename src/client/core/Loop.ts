export type FixedUpdate = (dt: number) => void;
export type FrameUpdate = (dt: number, alpha: number) => void;

export class Loop {
  private acc = 0;
  private last = 0;
  private running = false;
  private rafId = 0;
  fps = 0;
  frameMs = 0;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(
    private readonly step: number,
    private readonly fixed: FixedUpdate,
    private readonly frame: FrameUpdate,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const t0 = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= this.step && steps < 8) {
      this.fixed(this.step);
      this.acc -= this.step;
      steps++;
    }
    if (steps === 8) this.acc = 0;
    this.frame(dt, this.acc / this.step);
    this.frameMs = performance.now() - t0;
    this.fpsAcc += dt;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsAcc);
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
    this.rafId = requestAnimationFrame(this.tick);
  };
}
