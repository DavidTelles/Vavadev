import type { BodyPart, Vec3 } from '../../types';
import type { Agent } from '../Agent';

export interface AgentHit {
  agent: Agent;
  part: BodyPart;
  dist: number;
}

function raySphere(o: Vec3, d: Vec3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return Infinity;
  const s = Math.sqrt(disc);
  const t = -b - s;
  if (t >= 0) return t;
  const t2 = -b + s;
  return t2 >= 0 ? 0 : Infinity;
}

function rayVCapsule(o: Vec3, d: Vec3, cx: number, cz: number, y0: number, y1: number, r: number): number {
  const ox = o.x - cx;
  const oz = o.z - cz;
  const a = d.x * d.x + d.z * d.z;
  let best = Infinity;
  if (a > 1e-8) {
    const b = ox * d.x + oz * d.z;
    const c = ox * ox + oz * oz - r * r;
    const disc = b * b - a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / a;
      if (t >= 0) {
        const y = o.y + d.y * t;
        if (y >= y0 && y <= y1) best = t;
      }
    }
  }
  if (best === Infinity) {
    best = Math.min(raySphere(o, d, cx, y0, cz, r), raySphere(o, d, cx, y1, cz, r));
  }
  return best;
}

export function rayAgent(o: Vec3, d: Vec3, agent: Agent, maxDist: number): AgentHit | null {
  const p = agent.pos;
  const dx = p.x - o.x;
  const dz = p.z - o.z;
  const along = dx * d.x + dz * d.z;
  if (along < -1 || along > maxDist + 1) return null;
  const h = agent.motor.bodyHeight;
  const eyeY = p.y + agent.motor.eyeHeight;
  const s = h / 1.8;
  const head = raySphere(o, d, p.x, eyeY + 0.04, p.z, 0.2);
  const body = rayVCapsule(o, d, p.x, p.z, p.y + 0.95 * s, eyeY - 0.3, 0.3);
  const legs = rayVCapsule(o, d, p.x, p.z, p.y + 0.15, p.y + 0.95 * s, 0.22);
  let part: BodyPart = 'head';
  let best = head;
  if (body < best) { best = body; part = 'body'; }
  if (legs < best) { best = legs; part = 'legs'; }
  if (best > maxDist) return null;
  return { agent, part, dist: best };
}
