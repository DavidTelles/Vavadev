import * as THREE from 'three';

export interface Tracer {
  id: number;
  mesh: THREE.Line;
  born: number;
  ttl: number;
}

export interface Impact {
  id: number;
  mesh: THREE.Mesh;
  born: number;
  ttl: number;
}

/**
 * Lightweight object pool for tracers and impact decals/particles.
 * All visuals are added to a single group the client adds to the scene.
 * No allocations in the hot path beyond per-frame list rebuild.
 */
export class FX {
  readonly group = new THREE.Group();
  readonly tracers: Tracer[] = [];
  readonly impacts: Impact[] = [];
  private nextId = 1;

  private static tracerMat(color: number): THREE.Material {
    return new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
  }

  private static impactMat(color: number): THREE.Material {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  }

  spawnTracer(start: THREE.Vector3Like, end: THREE.Vector3Like, color = 0xffd28a): void {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([start.x, start.y, start.z, end.x, end.y, end.z], 3));
    const mesh = new THREE.Line(geo, FX.tracerMat(color));
    mesh.frustumCulled = false;
    this.tracers.push({ id: this.nextId++, mesh, born: performance.now(), ttl: 0.06 });
    this.group.add(mesh);
  }

  spawnImpact(point: THREE.Vector3Like, normal: THREE.Vector3Like, color = 0xffd28a): void {
    const geo = new THREE.RingGeometry(0.06, 0.14, 8);
    const mesh = new THREE.Mesh(geo, FX.impactMat(color));
    // face along normal
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(normal.x, normal.y, normal.z));
    mesh.quaternion.copy(q);
    mesh.position.set(point.x, point.y, point.z);
    mesh.frustumCulled = false;
    this.impacts.push({ id: this.nextId++, mesh, born: performance.now(), ttl: 0.5 });
    this.group.add(mesh);
  }

  update(_dt: number): void {
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
        const m = t.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.8 * (1 - age / t.ttl);
      }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      const im = this.impacts[i];
      const age = (now - im.born) / 1000;
      if (age > im.ttl) {
        this.group.remove(im.mesh);
        im.mesh.geometry.dispose();
        (im.mesh.material as THREE.Material).dispose();
        this.impacts.splice(i, 1);
      } else {
        const m = im.mesh.material as THREE.MeshBasicMaterial;
        m.opacity = 0.9 * (1 - age / im.ttl);
        im.mesh.scale.setScalar(1 + age);
      }
    }
  }

  dispose(): void {
    for (const t of this.tracers) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
    for (const im of this.impacts) {
      this.group.remove(im.mesh);
      im.mesh.geometry.dispose();
      (im.mesh.material as THREE.Material).dispose();
    }
    this.tracers.length = 0;
    this.impacts.length = 0;
  }
}
