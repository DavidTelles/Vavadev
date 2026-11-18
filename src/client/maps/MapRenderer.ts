import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { FloorKind, MapBox, MapDefinition } from '@shared/data/maps/MapDefinition';
import { grayscaleOf, Tex, textTexture } from '../core/Textures';

function worldBox(min: THREE.Vector3Like, max: THREE.Vector3Like, tile: number): THREE.BufferGeometry {
  const w = max.x - min.x;
  const h = max.y - min.y;
  const d = max.z - min.z;
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(min.x + w / 2, min.y + h / 2, min.z + d / 2);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i));
    if (ny > 0.5) uv.setXY(i, x / tile, z / tile);
    else if (nx > 0.5) uv.setXY(i, z / tile, y / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  return g;
}

function floorQuad(min: THREE.Vector3Like, max: THREE.Vector3Like, tile: number): THREE.BufferGeometry {
  const w = max.x - min.x;
  const d = max.z - min.z;
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(min.x + w / 2, min.y + 0.002, min.z + d / 2);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
  return g;
}

function pbr(map: THREE.Texture, key: string, rough: number, metal = 0, bumpScale = 1.2): THREE.MeshStandardMaterial {
  const tex = map as THREE.CanvasTexture;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: rough, metalness: metal, bumpMap: grayscaleOf(key, tex), bumpScale });
}

export class MapRenderer {
  readonly group = new THREE.Group();
  readonly collidables: THREE.Mesh[] = [];
  private readonly lights: THREE.PointLight[] = [];
  private readonly lampMats: THREE.MeshStandardMaterial[] = [];

  constructor(private readonly map: MapDefinition, quality: 'baixa' | 'media' | 'alta') {
    this.build(quality);
  }

  private build(quality: string): void {
    const m = this.map;
    const mats = {
      wall: pbr(Tex.concrete(), 'concrete', 0.92),
      wallAlt: pbr(Tex.plaster(), 'plaster', 0.95),
      floor: pbr(Tex.floor(), 'floor', 0.9),
      site: pbr(Tex.site(), 'site', 0.55, 0.35),
      spawn: pbr(Tex.spawn(), 'spawn', 0.7),
      platform: pbr(Tex.metal(), 'metal', 0.45, 0.6),
      ground: new THREE.MeshStandardMaterial({ color: 0x55524c, roughness: 1 }),
      hazard: new THREE.MeshStandardMaterial({ map: Tex.hazard(), roughness: 0.7 }),
    };

    const byKind: Record<string, THREE.BufferGeometry[]> = { wall: [], wallAlt: [], platform: [], lintel: [], hazard: [] };
    const crates: MapBox[] = [];
    const tall: MapBox[] = [];
    const machines: MapBox[] = [];
    for (const b of m.boxes) {
      switch (b.kind) {
        case 'wall': {
          const cx = (b.min.x + b.max.x) / 2;
          const alt = cx < -30 || cx > 30;
          (alt ? byKind.wallAlt : byKind.wall).push(worldBox(b.min, b.max, 5));
          break;
        }
        case 'platform':
          byKind.platform.push(worldBox(b.min, b.max, 2.5));
          byKind.hazard.push(worldBox({ x: b.min.x - 0.01, y: b.max.y - 0.12, z: b.min.z - 0.01 }, { x: b.max.x + 0.01, y: b.max.y + 0.004, z: b.max.z + 0.01 }, 1));
          break;
        case 'lintel':
          byKind.lintel.push(worldBox(b.min, b.max, 5));
          byKind.hazard.push(worldBox({ x: b.min.x - 0.02, y: b.min.y, z: b.min.z - 0.02 }, { x: b.max.x + 0.02, y: b.min.y + 0.35, z: b.max.z + 0.02 }, 1));
          break;
        case 'crate': crates.push(b); break;
        case 'tallcrate': tall.push(b); break;
        case 'machine': machines.push(b); break;
        default: break;
      }
    }

    const addMerged = (geos: THREE.BufferGeometry[], mat: THREE.Material, shadows = true): void => {
      if (!geos.length) return;
      const g = mergeGeometries(geos, false)!;
      geos.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, mat);
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      this.group.add(mesh);
      this.collidables.push(mesh);
    };

    addMerged(byKind.wall, mats.wall);
    addMerged(byKind.wallAlt, mats.wallAlt);
    addMerged(byKind.platform, mats.platform);
    addMerged(byKind.lintel, mats.wall);
    addMerged(byKind.hazard, mats.hazard, false);

    const floorGeos: Record<FloorKind, THREE.BufferGeometry[]> = { floor: [], site: [], spawn: [], platform: [] };
    for (const f of m.floors) if (f.kind !== 'platform') floorGeos[f.kind].push(floorQuad(f.min, f.max, 5));
    addMerged(floorGeos.floor, mats.floor, false);
    addMerged(floorGeos.site, mats.site, false);
    addMerged(floorGeos.spawn, mats.spawn, false);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.group.add(ground);

    this.buildCrates(crates, tall);
    this.buildMachines(machines);
    this.buildSiteMarkers();
    this.buildPipes();
    this.buildLights(quality);
    this.buildSky();
  }

  private buildCrates(crates: MapBox[], tall: MapBox[]): void {
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    if (crates.length) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      const mat = pbr(Tex.wood(), 'wood', 0.8, 0, 1.6);
      const inst = new THREE.InstancedMesh(g, mat, crates.length);
      crates.forEach((b, i) => {
        dummy.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        dummy.scale.set(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, color.setHSL(0.08, 0.3, 0.75 + (i % 3) * 0.08));
      });
      inst.castShadow = inst.receiveShadow = true;
      this.group.add(inst);
      this.collidables.push(inst);
    }
    if (tall.length) {
      const g = new THREE.BoxGeometry(1, 1, 1);
      const mat = pbr(Tex.container(), 'container', 0.55, 0.45, 1.4);
      const inst = new THREE.InstancedMesh(g, mat, tall.length);
      const palette = [0x2d6fb5, 0xb5452d, 0x3d8a4a, 0xc9a227, 0x7a4ab5];
      tall.forEach((b, i) => {
        dummy.position.set((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        dummy.scale.set(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        inst.setColorAt(i, color.set(palette[i % palette.length]));
      });
      inst.castShadow = inst.receiveShadow = true;
      this.group.add(inst);
      this.collidables.push(inst);
    }
  }

  private buildMachines(machines: MapBox[]): void {
    const body = new THREE.MeshStandardMaterial({ color: 0x3f6b7a, roughness: 0.4, metalness: 0.7 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xd9a03a, roughness: 0.5, metalness: 0.5 });
    const glow = new THREE.MeshStandardMaterial({ color: 0x113344, emissive: 0x33d1ff, emissiveIntensity: 2.2 });
    for (const b of machines) {
      const w = b.max.x - b.min.x;
      const d = b.max.z - b.min.z;
      const h = b.max.y - b.min.y;
      const cx = b.min.x + w / 2;
      const cz = b.min.z + d / 2;
      const grp = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.45, d), body);
      base.position.set(cx, h * 0.225, cz);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.42, Math.min(w, d) * 0.48, h * 0.55, 24), body);
      drum.position.set(cx, h * 0.45 + h * 0.275, cz);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.46, 0.09, 8, 32), accent);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, h * 0.62, cz);
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, h * 0.58, 16), glow);
      core.position.set(cx, h * 0.73, cz);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, d + 0.02), new THREE.MeshBasicMaterial({ visible: false }));
      box.position.set(cx, h / 2, cz);
      for (const mm of [base, drum, ring]) { mm.castShadow = true; mm.receiveShadow = true; }
      grp.add(base, drum, ring, core, box);
      this.group.add(grp);
      this.collidables.push(box);
    }
  }

  private buildSiteMarkers(): void {
    for (const side of ['A', 'B'] as const) {
      const s = this.map.sites[side];
      const tex = textTexture(side, '#ff4655');
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(s.center.x, 0.02, s.center.z);
      this.group.add(plane);
      const z = s.zone;
      const border = new THREE.MeshBasicMaterial({ color: 0xff4655, transparent: true, opacity: 0.5, depthWrite: false });
      const lines = [
        [z.minX, z.minZ, z.maxX, z.minZ], [z.minX, z.maxZ, z.maxX, z.maxZ],
        [z.minX, z.minZ, z.minX, z.maxZ], [z.maxX, z.minZ, z.maxX, z.maxZ],
      ];
      for (const [x0, z0, x1, z1] of lines) {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.18), border);
        strip.rotation.x = -Math.PI / 2;
        strip.rotation.z = x0 === x1 ? Math.PI / 2 : 0;
        strip.position.set((x0 + x1) / 2, 0.025, (z0 + z1) / 2);
        this.group.add(strip);
      }
      const signTex = textTexture(side, '#ffffff', 256, 'bold 200px "Segoe UI", sans-serif');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, color: 0xff4655, emissive: 0xff4655, emissiveIntensity: 0.6 }));
      sign.position.set(s.center.x, 4.6, this.map.minZ + 12.5 + 0.03);
      this.group.add(sign);
    }
  }

  private buildPipes(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8a3b2a, roughness: 0.5, metalness: 0.6 });
    const mat2 = new THREE.MeshStandardMaterial({ color: 0x2f5d6b, roughness: 0.5, metalness: 0.6 });
    const geos: THREE.BufferGeometry[] = [];
    const geos2: THREE.BufferGeometry[] = [];
    const run = (x0: number, z0: number, x1: number, z1: number, y: number, r: number, alt: boolean): void => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.CylinderGeometry(r, r, len, 12);
      g.rotateZ(Math.PI / 2);
      g.rotateY(-Math.atan2(z1 - z0, x1 - x0));
      g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
      (alt ? geos2 : geos).push(g);
    };
    const m = this.map;
    run(m.minX + 0.3, m.minZ + 14, m.minX + 0.3, m.minZ + 40, 5.2, 0.28, false);
    run(m.maxX - 0.3, m.minZ + 14, m.maxX - 0.3, m.minZ + 40, 5.2, 0.28, false);
    run(-15, m.minZ + 2.8, 15, m.minZ + 2.8, 5.6, 0.22, true);
    run(-15, m.maxZ - 2.8, 15, m.maxZ - 2.8, 5.6, 0.22, true);
    run(m.minX + 5.3, 5, m.minX + 5.3, 25, 5.8, 0.18, true);
    run(m.maxX - 5.3, 5, m.maxX - 5.3, 25, 5.8, 0.18, true);
    for (const [arr, mm] of [[geos, mat], [geos2, mat2]] as const) {
      if (!arr.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(arr as THREE.BufferGeometry[]), mm);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
  }

  private buildLights(quality: string): void {
    const maxLights = quality === 'baixa' ? 0 : quality === 'media' ? 4 : 10;
    const housing = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.6 });
    this.map.lights.forEach((l, i) => {
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: l.color, emissiveIntensity: 3 });
      this.lampMats.push(lampMat);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5), lampMat);
      lamp.position.set(l.pos.x, l.pos.y, l.pos.z);
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.15, 0.6), housing);
      top.position.set(l.pos.x, l.pos.y + 0.12, l.pos.z);
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.3, 6), housing);
      rod.position.set(l.pos.x, l.pos.y + 0.8, l.pos.z);
      this.group.add(lamp, top, rod);
      if (i < maxLights) {
        const pl = new THREE.PointLight(l.color, l.intensity, 16, 1.6);
        pl.position.set(l.pos.x, l.pos.y - 0.3, l.pos.z);
        this.group.add(pl);
        this.lights.push(pl);
      }
    });
  }

  private buildSky(): void {
    const geo = new THREE.SphereGeometry(300, 32, 16);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: new THREE.Color(0x3d7fc4) }, mid: { value: new THREE.Color(0xa9cbe6) }, bottom: { value: new THREE.Color(0xe8d9c0) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.6)) : mix(mid, bottom, pow(-h, 0.5)); gl_FragColor = vec4(c, 1.0); }',
    });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -1;
    this.group.add(sky);

    const hillMat = new THREE.MeshStandardMaterial({ color: 0x6f7f5a, roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 150 + (i % 3) * 20;
      const hill = new THREE.Mesh(new THREE.ConeGeometry(30 + (i % 4) * 8, 25 + (i % 5) * 8, 6), hillMat);
      hill.position.set(Math.cos(a) * r, 8, Math.sin(a) * r);
      this.group.add(hill);
    }
  }

  dispose(): void {
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mat = mesh.material as THREE.Material | undefined;
      if (mat && !Array.isArray(mat)) mat.dispose();
    });
  }
}
