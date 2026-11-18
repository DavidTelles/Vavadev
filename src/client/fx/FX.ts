import * as THREE from 'three';

export interface Tracer {
  id: number;
  mesh: THREE.Line;
  born: number;
  ttl: number;
}

interface Puff {
  mesh: THREE.Points;
  vel: Float32Array;
  born: number;
  ttl: number;
}

interface Flash {
  sprite: THREE.Sprite;
  light: THREE.PointLight;
  t: number;
}

const MAX_HOLES = 140;
const HOLE_R = 0.035;
const UP = new THREE.Vector3(0, 0, 1);

/**
 * World-space combat FX: persistent bullet holes, dust puffs on impact and
 * third-person muzzle flashes. Everything lives in one group the client adds
 * to the scene; holes are a fixed ring buffer so long sprays never leak.
 */
export class FX {
  readonly group = new THREE.Group();
  readonly tracers: Tracer[] = [];
  private nextId = 1;

  private readonly holeGeo = new THREE.CircleGeometry(HOLE_R, 10);
  private readonly holeMat = new THREE.MeshBasicMaterial({
    color: 0x050505, transparent: true, opacity: 0.92, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });
  private readonly holes: THREE.Mesh[] = [];
  private holeCursor = 0;

  private readonly puffMat = new THREE.PointsMaterial({ color: 0xb8ad9a, size: 0.05, transparent: true, opacity: 0.8, depthWrite: false });
  private readonly puffs: Puff[] = [];

  private readonly flashMat: THREE.SpriteMaterial;
  private readonly flashes: Flash[] = [];

  private readonly q = new THREE.Quaternion();
  private readonly n = new THREE.Vector3();

  constructor() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,250,220,1)');
    grad.addColorStop(0.3, 'rgba(255,190,80,0.85)');
    grad.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.flashMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }

  /** Kept for ability visuals that still want a beam line. Gunshots no longer draw tracers. */
  spawnTracer(start: THREE.Vector3Like, end: THREE.Vector3Like, color = 0xffd28a): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([start.x, start.y, start.z, end.x, end.y, end.z], 3));
    const mesh = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    mesh.frustumCulled = false;
    this.tracers.push({ id: this.nextId++, mesh, born: performance.now(), ttl: 0.06 });
    this.group.add(mesh);
  }

  /** Bullet hole (black dot) that stays on the surface, plus a small dust puff. */
  spawnImpact(point: THREE.Vector3Like, normal: THREE.Vector3Like): void {
    this.n.set(normal.x, normal.y, normal.z);
    if (this.n.lengthSq() < 1e-6) this.n.set(0, 1, 0);
    this.n.normalize();

    let hole = this.holes[this.holeCursor];
    if (!hole) {
      hole = new THREE.Mesh(this.holeGeo, this.holeMat);
      hole.frustumCulled = true;
      hole.renderOrder = 1;
      this.holes.push(hole);
      this.group.add(hole);
    }
    this.holeCursor = (this.holeCursor + 1) % MAX_HOLES;
    this.q.setFromUnitVectors(UP, this.n);
    hole.quaternion.copy(this.q);
    hole.rotateZ(Math.random() * Math.PI);
    const s = 0.8 + Math.random() * 0.45;
    hole.scale.set(s, s, 1);
    hole.position.set(point.x + this.n.x * 0.006, point.y + this.n.y * 0.006, point.z + this.n.z * 0.006);
    hole.visible = true;

    const count = 7;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = point.x + this.n.x * 0.02;
      pos[i * 3 + 1] = point.y + this.n.y * 0.02;
      pos[i * 3 + 2] = point.z + this.n.z * 0.02;
      vel[i * 3] = this.n.x * 1.4 + (Math.random() - 0.5) * 1.6;
      vel[i * 3 + 1] = this.n.y * 1.4 + (Math.random() - 0.2) * 1.6;
      vel[i * 3 + 2] = this.n.z * 1.4 + (Math.random() - 0.5) * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mesh = new THREE.Points(geo, this.puffMat.clone());
    mesh.frustumCulled = false;
    this.puffs.push({ mesh, vel, born: performance.now(), ttl: 0.28 });
    this.group.add(mesh);
  }

  /** Third-person muzzle flash for other agents (sprite + short light). */
  spawnMuzzleFlash(pos: THREE.Vector3Like, dir: THREE.Vector3Like): void {
    let f = this.flashes.find((x) => x.t <= 0);
    if (!f) {
      if (this.flashes.length >= 4) f = this.flashes[0];
      else {
        const sprite = new THREE.Sprite(this.flashMat);
        const light = new THREE.PointLight(0xffa040, 0, 5);
        this.group.add(sprite, light);
        f = { sprite, light, t: 0 };
        this.flashes.push(f);
      }
    }
    // Agent eye -> push forward and down to roughly where the gun barrel is.
    const x = pos.x + dir.x * 0.7, y = pos.y + dir.y * 0.7 - 0.18, z = pos.z + dir.z * 0.7;
    f.sprite.position.set(x, y, z);
    f.light.position.set(x, y, z);
    f.sprite.material.rotation = Math.random() * Math.PI;
    f.t = 0.06;
  }

  /** Remove all bullet holes (new round). */
  clearHoles(): void {
    for (const h of this.holes) h.visible = false;
    this.holeCursor = 0;
  }

  update(dt: number): void {
    const now = performance.now();
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      const age = (now - t.born) / 1000;
      if (age > t.ttl) {
        this.group.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        (t.mesh.material as THREE.LineBasicMaterial).opacity = 0.8 * (1 - age / t.ttl);
      }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      const age = (now - p.born) / 1000;
      if (age > p.ttl) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.puffs.splice(i, 1);
        continue;
      }
      const attr = p.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let k = 0; k < arr.length; k += 3) {
        p.vel[k + 1] -= 4 * dt;
        arr[k] += p.vel[k] * dt;
        arr[k + 1] += p.vel[k + 1] * dt;
        arr[k + 2] += p.vel[k + 2] * dt;
      }
      attr.needsUpdate = true;
      (p.mesh.material as THREE.PointsMaterial).opacity = 0.8 * (1 - age / p.ttl);
    }
    for (const f of this.flashes) {
      f.t -= dt;
      const on = f.t > 0;
      f.sprite.visible = on;
      f.light.intensity = on ? 10 : 0;
      if (on) f.sprite.scale.setScalar(0.35 + Math.random() * 0.2);
    }
  }

  dispose(): void {
    for (const t of this.tracers) {
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
    for (const p of this.puffs) {
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.group.clear();
    this.tracers.length = 0;
    this.puffs.length = 0;
    this.holes.length = 0;
    this.flashes.length = 0;
    this.holeGeo.dispose();
    this.holeMat.dispose();
    this.puffMat.dispose();
    this.flashMat.map?.dispose();
    this.flashMat.dispose();
  }
}
