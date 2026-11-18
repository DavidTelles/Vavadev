import * as THREE from 'three';
import type { Simulation } from '@shared/sim/Simulation';
import type { Effect } from '@shared/sim/abilities/AbilitySystem';
import { buildWeaponModel } from '@client/weapons/WeaponModels';

/**
 * Draws everything the sim knows about that is not an agent or the map:
 * ability effects (smoke, fire, slow fields, walls, turrets, sensors, traps),
 * thrown projectiles, explosions/flash pops, dropped weapons and the Spike.
 *
 * It polls sim state each frame (effects/projectiles/groundWeapons/spike) and
 * keeps one Object3D per sim id, so it can never drift out of sync with the
 * simulation the way pure event listeners can.
 */

function puffTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Live {
  obj: THREE.Object3D;
  mats: THREE.Material[];
  kind: string;
  born: number;
}

interface Burst {
  obj: THREE.Mesh | THREE.Sprite;
  mat: THREE.MeshBasicMaterial | THREE.SpriteMaterial;
  t: number;
  life: number;
  grow: number;
}

export class WorldRenderer {
  readonly group = new THREE.Group();
  private readonly puff = puffTexture();
  private readonly sphere = new THREE.SphereGeometry(1, 24, 16);
  private readonly disc = new THREE.CircleGeometry(1, 40);
  private readonly ring = new THREE.RingGeometry(0.96, 1, 64);
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly effects = new Map<number, Live>();
  private readonly projectiles = new Map<number, THREE.Mesh>();
  private readonly ground = new Map<number, THREE.Object3D>();
  private readonly bursts: Burst[] = [];
  private readonly spikeObj: THREE.Group;
  private readonly spikeLight: THREE.Mesh;
  private time = 0;
  private readonly unsub: (() => void)[] = [];

  constructor(private readonly sim: Simulation) {
    const ev = sim.events;
    this.unsub.push(
      ev.on('explosion', (p) => this.burst(p.pos, p.radius, p.color, p.big ? 0.7 : 0.45)),
      ev.on('flashPop', (p) => this.flash(p.pos, p.color)),
    );
    // Spike model: a squat hex canister with a glowing core.
    this.spikeObj = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 6), new THREE.MeshStandardMaterial({ color: 0x2a2730, roughness: 0.5, metalness: 0.6 }));
    body.position.y = 0.21;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.46, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3d7f).multiplyScalar(2) }));
    core.position.y = 0.23;
    this.spikeLight = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: 0xff3d7f, transparent: true, opacity: 0.35, depthWrite: false }));
    this.spikeLight.scale.setScalar(0.5);
    this.spikeLight.position.y = 0.5;
    this.spikeObj.add(body, core, this.spikeLight);
    this.spikeObj.visible = false;
    this.group.add(this.spikeObj);
  }

  // ---------- effects ----------

  private makeEffect(e: Effect): Live {
    const color = new THREE.Color(e.ability.color);
    const g = new THREE.Group();
    g.position.set(e.pos.x, e.pos.y, e.pos.z);
    const mats: THREE.Material[] = [];
    const add = <M extends THREE.Material>(m: M): M => (mats.push(m), m);
    switch (e.kind) {
      case 'smoke': {
        // Opaque core sphere (blocks sight like the sim) + soft puffs at the rim.
        const core = new THREE.Mesh(this.sphere, add(new THREE.MeshBasicMaterial({
          color: color.clone().multiplyScalar(0.62), transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false, fog: true,
        })));
        core.scale.setScalar(e.radius);
        core.position.y = e.radius * 0.55;
        g.add(core);
        for (let i = 0; i < 26; i++) {
          const s = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: this.puff, color: color.clone().multiplyScalar(0.75 + (i % 5) * 0.06), transparent: true, opacity: 0.85, depthWrite: false })));
          const a = (i / 26) * Math.PI * 2 + i;
          const r = e.radius * (0.75 + (i % 3) * 0.12);
          s.position.set(Math.cos(a) * r, e.radius * (0.25 + (i % 4) * 0.25), Math.sin(a) * r);
          s.scale.setScalar(e.radius * 1.1);
          g.add(s);
        }
        break;
      }
      case 'molly':
      case 'poison': {
        const floor = new THREE.Mesh(this.disc, add(new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.6), transparent: true, opacity: 0.55, depthWrite: false })));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.05;
        floor.scale.setScalar(e.radius);
        g.add(floor);
        for (let i = 0; i < 10; i++) {
          const s = new THREE.Sprite(add(new THREE.SpriteMaterial({ map: this.puff, color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending })));
          const a = Math.random() * Math.PI * 2;
          const r = Math.random() * e.radius * 0.85;
          s.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
          s.scale.set(0.9, 1.4, 1);
          s.userData.phase = Math.random() * 6;
          g.add(s);
        }
        break;
      }
      case 'slow':
      case 'lockdown': {
        const floor = new THREE.Mesh(this.disc, add(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })));
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.04;
        floor.scale.setScalar(e.radius);
        const edge = new THREE.Mesh(this.ring, add(new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })));
        edge.rotation.x = -Math.PI / 2;
        edge.position.y = 0.06;
        edge.scale.setScalar(e.radius);
        g.add(floor, edge);
        if (e.kind === 'lockdown') {
          const dome = new THREE.Mesh(this.sphere, add(new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.25 })));
          dome.scale.setScalar(e.radius);
          g.add(dome);
        }
        break;
      }
      case 'sensor':
      case 'trap': {
        const dev = new THREE.Mesh(this.box, add(new THREE.MeshStandardMaterial({ color: 0x2b2a30, metalness: 0.6, roughness: 0.4 })));
        dev.scale.set(0.25, e.kind === 'sensor' ? 0.6 : 0.12, 0.25);
        dev.position.y = dev.scale.y / 2;
        const lamp = new THREE.Mesh(this.sphere, add(new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) })));
        lamp.scale.setScalar(0.06);
        lamp.position.y = dev.scale.y + 0.05;
        g.add(dev, lamp);
        if (e.kind === 'sensor') {
          const edge = new THREE.Mesh(this.ring, add(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })));
          edge.rotation.x = -Math.PI / 2;
          edge.position.y = 0.05;
          edge.scale.setScalar(e.radius);
          g.add(edge);
        } else {
          const wire = new THREE.Mesh(this.box, add(new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2), transparent: true, opacity: 0.6 })));
          wire.scale.set(e.radius * 2, 0.015, 0.015);
          wire.position.y = 0.3;
          wire.rotation.y = e.rotY;
          g.add(wire);
        }
        break;
      }
      case 'turret': {
        const base = new THREE.Mesh(this.box, add(new THREE.MeshStandardMaterial({ color: 0x34323a, metalness: 0.5, roughness: 0.5 })));
        base.scale.set(0.6, 0.5, 0.6);
        base.position.y = 0.25;
        const head = new THREE.Group();
        head.position.y = 0.65;
        const housing = new THREE.Mesh(this.box, add(new THREE.MeshStandardMaterial({ color: 0x4a4752, metalness: 0.5, roughness: 0.4 })));
        housing.scale.set(0.4, 0.3, 0.5);
        const barrel = new THREE.Mesh(this.box, add(new THREE.MeshStandardMaterial({ color: 0x1b1a1f, metalness: 0.7, roughness: 0.3 })));
        barrel.scale.set(0.08, 0.08, 0.5);
        barrel.position.z = -0.45;
        const eye = new THREE.Mesh(this.sphere, add(new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) })));
        eye.scale.setScalar(0.06);
        eye.position.set(0, 0.06, -0.26);
        head.add(housing, barrel, eye);
        head.rotation.y = e.rotY;
        head.name = 'head';
        g.add(base, head);
        break;
      }
      case 'wall': {
        const h = e.half ?? { x: 3.6, y: 1.9, z: 0.3 };
        const wall = new THREE.Mesh(this.box, add(new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 0.82,
        })));
        wall.scale.set(h.x * 2, h.y * 2, h.z * 2);
        wall.position.y = h.y;
        wall.rotation.y = e.rotY;
        g.add(wall);
        break;
      }
    }
    this.group.add(g);
    return { obj: g, mats, kind: e.kind, born: this.time };
  }

  private syncEffects(): void {
    const seen = new Set<number>();
    const now = this.sim.time;
    for (const e of this.sim.abilities.effects) {
      seen.add(e.id);
      let live = this.effects.get(e.id);
      if (!live) {
        live = this.makeEffect(e);
        this.effects.set(e.id, live);
      }
      const left = e.until - now;
      const fadeIn = Math.min(1, (this.time - live.born) / 0.35);
      const fade = Math.min(fadeIn, Math.max(0, Math.min(1, left / 0.8)));
      live.obj.visible = fade > 0.01;
      for (const m of live.mats) {
        if (m.userData.base === undefined) m.userData.base = (m as THREE.MeshBasicMaterial).opacity ?? 1;
        if (m.transparent) (m as THREE.MeshBasicMaterial).opacity = m.userData.base * fade;
      }
      if (live.kind === 'smoke') live.obj.children.forEach((c, i) => { if (i > 0) c.position.y += Math.sin(this.time * 0.6 + i) * 0.002; });
      if (live.kind === 'molly' || live.kind === 'poison') {
        for (const c of live.obj.children) {
          if (!(c instanceof THREE.Sprite)) continue;
          const ph = (c.userData.phase as number) + this.time * 3;
          c.scale.set(0.8 + Math.sin(ph) * 0.2, 1.2 + Math.sin(ph * 1.7) * 0.4, 1);
          c.position.y = 0.4 + Math.sin(ph * 0.7) * 0.15;
        }
      }
      if (live.kind === 'turret') {
        const head = live.obj.getObjectByName('head');
        if (head) head.rotation.y = e.rotY;
      }
    }
    for (const [id, live] of this.effects) {
      if (seen.has(id)) continue;
      this.group.remove(live.obj);
      for (const m of live.mats) m.dispose();
      this.effects.delete(id);
    }
  }

  private syncProjectiles(): void {
    const seen = new Set<number>();
    for (const p of this.sim.abilities.projectiles) {
      seen.add(p.id);
      let m = this.projectiles.get(p.id);
      if (!m) {
        m = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(p.ability.color).multiplyScalar(2.2) }));
        m.scale.setScalar(0.09);
        this.group.add(m);
        this.projectiles.set(p.id, m);
      }
      m.position.set(p.pos.x, p.pos.y, p.pos.z);
    }
    for (const [id, m] of this.projectiles) {
      if (seen.has(id)) continue;
      this.group.remove(m);
      (m.material as THREE.Material).dispose();
      this.projectiles.delete(id);
    }
  }

  private syncGround(): void {
    const seen = new Set<number>();
    for (const g of this.sim.groundWeapons) {
      seen.add(g.id);
      let o = this.ground.get(g.id);
      if (!o) {
        o = buildWeaponModel(g.weapon.def.id).root;
        o.scale.setScalar(1.25);
        o.rotation.set(0, (g.id * 1.7) % (Math.PI * 2), Math.PI / 2);
        this.group.add(o);
        this.ground.set(g.id, o);
      }
      o.position.set(g.pos.x, g.pos.y + 0.12 + Math.sin(this.time * 2 + g.id) * 0.03, g.pos.z);
    }
    for (const [id, o] of this.ground) {
      if (seen.has(id)) continue;
      this.group.remove(o);
      o.traverse((c) => ((c as THREE.Mesh).geometry?.dispose()));
      this.ground.delete(id);
    }
  }

  private syncSpike(): void {
    const sp = this.sim.match.spike;
    const show = sp.status === 'dropped' || sp.status === 'planted' || sp.status === 'defused';
    this.spikeObj.visible = show;
    if (!show) return;
    this.spikeObj.position.set(sp.pos.x, sp.pos.y, sp.pos.z);
    const m = this.spikeLight.material as THREE.MeshBasicMaterial;
    if (sp.status === 'planted') {
      // Beeps speed up as the timer runs out.
      const elapsed = this.sim.time - sp.plantedAt;
      const rate = 1.2 + elapsed * 0.12;
      const on = Math.sin(elapsed * rate * Math.PI * 2) > 0.6;
      m.opacity = on ? 0.75 : 0.12;
      this.spikeLight.scale.setScalar(on ? 0.7 : 0.45);
    } else {
      m.opacity = 0.2;
      this.spikeLight.scale.setScalar(0.4);
    }
  }

  // ---------- bursts ----------

  private burst(pos: { x: number; y: number; z: number }, radius: number, color: number, life: number): void {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5), transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(this.sphere, mat);
    m.position.set(pos.x, pos.y + 0.4, pos.z);
    m.scale.setScalar(radius * 0.25);
    this.group.add(m);
    this.bursts.push({ obj: m, mat, t: 0, life, grow: radius });
  }

  private flash(pos: { x: number; y: number; z: number }, color: number): void {
    const mat = new THREE.SpriteMaterial({ map: this.puff, color: new THREE.Color(color).multiplyScalar(4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const s = new THREE.Sprite(mat);
    s.position.set(pos.x, pos.y, pos.z);
    s.scale.setScalar(2);
    this.group.add(s);
    this.bursts.push({ obj: s, mat, t: 0, life: 0.35, grow: 6 });
  }

  update(dt: number): void {
    this.time += dt;
    this.syncEffects();
    this.syncProjectiles();
    this.syncGround();
    this.syncSpike();
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.t += dt;
      const k = b.t / b.life;
      if (k >= 1) {
        this.group.remove(b.obj);
        b.mat.dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      b.obj.scale.setScalar(b.grow * (0.25 + 0.75 * Math.sqrt(k)));
      b.mat.opacity = 0.85 * (1 - k);
    }
  }

  dispose(): void {
    for (const u of this.unsub) u();
    for (const live of this.effects.values()) live.mats.forEach((m) => m.dispose());
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      const mat = m.material as THREE.Material | undefined;
      if (mat && !Array.isArray(mat)) mat.dispose();
    });
    for (const o of this.ground.values()) o.traverse((c) => ((c as THREE.Mesh).geometry?.dispose()));
    this.sphere.dispose();
    this.disc.dispose();
    this.ring.dispose();
    this.box.dispose();
    this.puff.dispose();
  }
}
