import type { Simulation } from '@shared/sim/Simulation';
import type { Agent } from '@shared/sim/Agent';
import type { MapDefinition } from '@shared/data/maps/MapDefinition';

const SIZE = 200; // CSS px
const RES = 2; // backing-store scale
const PX_PER_M = 2.6 * RES;
const REDRAW = 1 / 20;
const LOS_EVERY = 0.15;

/**
 * Player-centred rotating minimap (forward is always up). The map layout is
 * drawn once into an offscreen canvas; each redraw blits it rotated by the
 * viewer's yaw and overlays allies, enemies currently seen by the team, and the Spike.
 */
export class Minimap {
  readonly el: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly layout: HTMLCanvasElement;
  private acc = REDRAW;
  private losAcc = LOS_EVERY;
  private readonly seen = new Set<number>();

  constructor(private readonly sim: Simulation) {
    this.el = document.createElement('canvas');
    this.el.className = 'hud-minimap';
    this.el.width = this.el.height = SIZE * RES;
    this.ctx = this.el.getContext('2d')!;
    this.layout = this.drawLayout(sim.map);
  }

  private drawLayout(map: MapDefinition): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.ceil((map.maxX - map.minX) * PX_PER_M);
    c.height = Math.ceil((map.maxZ - map.minZ) * PX_PER_M);
    const g = c.getContext('2d')!;
    const rect = (minX: number, minZ: number, maxX: number, maxZ: number): void =>
      g.fillRect((minX - map.minX) * PX_PER_M, (minZ - map.minZ) * PX_PER_M, (maxX - minX) * PX_PER_M, (maxZ - minZ) * PX_PER_M);
    // Walkable ground from the collision grid: light where you can walk, dark where solid.
    const step = 0.5;
    g.fillStyle = 'rgba(150, 142, 165, 0.55)';
    for (let z = map.minZ; z < map.maxZ; z += step) {
      for (let x = map.minX; x < map.maxX; x += step) {
        if (!map.solidAt(x + step / 2, z + step / 2)) rect(x, z, x + step, z + step);
      }
    }
    const tint: Partial<Record<string, string>> = { spawn: 'rgba(80, 200, 255, 0.18)', site: 'rgba(255, 70, 120, 0.28)', platform: 'rgba(236, 230, 239, 0.12)' };
    for (const f of map.floors) {
      const col = tint[f.kind];
      if (!col) continue;
      g.fillStyle = col;
      rect(f.min.x, f.min.z, f.max.x, f.max.z);
    }
    // Low cover (crates/machines) as mid-tone blocks inside walkable space.
    g.fillStyle = 'rgba(55, 48, 66, 0.9)';
    for (const b of map.boxes) if (b.kind === 'crate' || b.kind === 'tallcrate' || b.kind === 'machine') rect(b.min.x, b.min.z, b.max.x, b.max.z);
    return c;
  }

  update(dt: number, viewer: Agent): void {
    this.losAcc += dt;
    if (this.losAcc >= LOS_EVERY) {
      this.losAcc = 0;
      this.updateSeen(viewer);
    }
    this.acc += dt;
    if (this.acc < REDRAW) return;
    this.acc = 0;
    this.draw(viewer);
  }

  /** Enemies visible to any living teammate (or revealed by an ability). */
  private updateSeen(viewer: Agent): void {
    this.seen.clear();
    const allies = this.sim.agents.filter((a) => a.alive && a.team === viewer.team);
    for (const e of this.sim.agents) {
      if (!e.alive || e.team === viewer.team) continue;
      if (this.sim.time < e.revealedUntil) { this.seen.add(e.id); continue; }
      const eEye = { x: e.pos.x, y: e.pos.y + 1.4, z: e.pos.z };
      for (const a of allies) {
        if (Math.hypot(a.pos.x - e.pos.x, a.pos.z - e.pos.z) > 60) continue;
        if (this.sim.canSee({ x: a.pos.x, y: a.pos.y + 1.5, z: a.pos.z }, eEye)) { this.seen.add(e.id); break; }
      }
    }
  }

  private draw(viewer: Agent): void {
    const g = this.ctx;
    const map = this.sim.map;
    const S = SIZE * RES;
    const half = S / 2;
    const px = viewer.pos.x;
    const pz = viewer.pos.z;
    const yaw = viewer.yaw;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.roundRect(0, 0, S, S, 6 * RES);
    g.clip();
    g.fillStyle = 'rgba(8, 6, 11, 0.86)';
    g.fillRect(0, 0, S, S);

    g.translate(half, half);
    g.rotate(yaw);
    g.drawImage(this.layout, -(px - map.minX) * PX_PER_M, -(pz - map.minZ) * PX_PER_M);

    const toLocal = (x: number, z: number): [number, number] => [(x - px) * PX_PER_M, (z - pz) * PX_PER_M];
    const sp = this.sim.match.spike;
    if (sp.status === 'planted' || sp.status === 'dropped') {
      const [x, z] = toLocal(sp.pos.x, sp.pos.z);
      const pulse = sp.status === 'planted' ? 1 + 0.25 * Math.sin(this.sim.time * 8) : 1;
      g.fillStyle = '#ff4655';
      g.beginPath();
      g.arc(x, z, 5 * RES * pulse, 0, Math.PI * 2);
      g.fill();
    }
    for (const a of this.sim.agents) {
      if (!a.alive || a.id === viewer.id) continue;
      const ally = a.team === viewer.team;
      if (!ally && !this.seen.has(a.id)) continue;
      const [x, z] = toLocal(a.pos.x, a.pos.z);
      const col = ally ? '#4ad6ff' : '#ff4655';
      // Facing wedge
      const fx = -Math.sin(a.yaw);
      const fz = -Math.cos(a.yaw);
      g.fillStyle = ally ? 'rgba(74, 214, 255, 0.35)' : 'rgba(255, 70, 85, 0.35)';
      g.beginPath();
      g.moveTo(x + fx * 11 * RES, z + fz * 11 * RES);
      g.lineTo(x - fz * 4 * RES, z + fx * 4 * RES);
      g.lineTo(x + fz * 4 * RES, z - fx * 4 * RES);
      g.fill();
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, z, 4 * RES, 0, Math.PI * 2);
      g.fill();
      if (a.hasSpike) {
        g.strokeStyle = '#ff4655';
        g.lineWidth = 1.5 * RES;
        g.stroke();
      }
    }
    g.restore();

    // Site labels stay upright.
    g.save();
    g.font = `700 ${13 * RES}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255, 140, 170, 0.9)';
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    for (const side of Object.keys(map.sites) as Array<keyof typeof map.sites>) {
      const ctr = map.sites[side].center;
      const dx = (ctr.x - px) * PX_PER_M;
      const dz = (ctr.z - pz) * PX_PER_M;
      const x = half + dx * c - dz * s;
      const y = half + dx * s + dz * c;
      if (x < 0 || y < 0 || x > S || y > S) continue;
      g.fillText(String(side).toUpperCase(), x, y);
    }
    g.restore();

    // Viewer arrow, always pointing up.
    g.fillStyle = '#ffe14a';
    g.beginPath();
    g.moveTo(half, half - 8 * RES);
    g.lineTo(half + 5.5 * RES, half + 6 * RES);
    g.lineTo(half, half + 3 * RES);
    g.lineTo(half - 5.5 * RES, half + 6 * RES);
    g.closePath();
    g.fill();
  }
}
