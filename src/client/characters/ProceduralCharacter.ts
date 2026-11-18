import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Appearance } from './appearances';

export type BoneName =
  | 'root' | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'upperArmL' | 'lowerArmL' | 'handL' | 'upperArmR' | 'lowerArmR' | 'handR'
  | 'upperLegL' | 'lowerLegL' | 'footL' | 'upperLegR' | 'lowerLegR' | 'footR';

export interface CharacterRig {
  root: THREE.Group;
  mesh: THREE.SkinnedMesh;
  bones: Record<BoneName, THREE.Bone>;
  weaponSocket: THREE.Object3D;
  clips: THREE.AnimationClip[];
  hipsY: number;
  dispose(): void;
}

interface Part {
  geo: THREE.BufferGeometry;
  bone: BoneName;
  color: number;
  glow?: boolean;
}

type Euler3 = [number, number, number];
type Pose = Partial<Record<BoneName, Euler3>>;

const SLEEVED_LONG = new Set(['jacket', 'hoodie', 'coat', 'sweatervest', 'medic']);
const SLEEVED_SHORT = new Set(['tshirt', 'polo', 'jersey', 'overalls']);

export function buildCharacter(app: Appearance): CharacterRig {
  const s = app.height;
  const b = app.build;
  const fem = app.gender === 'f';
  const upperLeg = 0.47 * s;
  const lowerLeg = 0.45 * s;
  const hipsY = upperLeg + lowerLeg + 0.08;
  const hipW = (fem ? 0.105 : 0.095) * Math.max(1, b * 0.9);
  const shoulderW = (fem ? 0.165 : 0.19) * (0.55 + b * 0.45) * (1 + app.muscle * 0.08);
  const hr = 0.112 * app.headSize * s;
  const upperArm = 0.28 * s;
  const lowerArm = 0.25 * s;

  const bones = {} as Record<BoneName, THREE.Bone>;
  const order: THREE.Bone[] = [];
  const mk = (name: BoneName, parent: THREE.Bone | null, x: number, y: number, z: number): THREE.Bone => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.set(x, y, z);
    if (parent) parent.add(bone);
    bones[name] = bone;
    order.push(bone);
    return bone;
  };
  const root = mk('root', null, 0, 0, 0);
  const hips = mk('hips', root, 0, hipsY, 0);
  const spine = mk('spine', hips, 0, 0.1 * s, 0);
  const chest = mk('chest', spine, 0, 0.17 * s, 0);
  const neck = mk('neck', chest, 0, 0.21 * s, 0);
  mk('head', neck, 0, 0.07 * s, 0);
  for (const [side, sx] of [['R', 1], ['L', -1]] as const) {
    const ua = mk(`upperArm${side}`, chest, sx * shoulderW, 0.17 * s, 0);
    const la = mk(`lowerArm${side}`, ua, 0, -upperArm, 0);
    mk(`hand${side}`, la, 0, -lowerArm, 0);
    const ul = mk(`upperLeg${side}`, hips, sx * hipW, -0.02, 0);
    const ll = mk(`lowerLeg${side}`, ul, 0, -upperLeg, 0);
    mk(`foot${side}`, ll, 0, -lowerLeg, 0);
  }
  root.updateMatrixWorld(true);

  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, bone: BoneName, color: number, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, glow = false, rx = 0, ry = 0, rz = 0): void => {
    if (rx || ry || rz) geo.rotateX(rx), geo.rotateY(ry), geo.rotateZ(rz);
    geo.scale(sx, sy, sz);
    geo.translate(x, y, z);
    parts.push({ geo, bone, color, glow });
  };
  const sphere = (r: number, ws = 14, hs = 10): THREE.BufferGeometry => new THREE.SphereGeometry(r, ws, hs);
  const capsule = (r: number, len: number): THREE.BufferGeometry => new THREE.CapsuleGeometry(r, len, 4, 12);
  const boxG = (w: number, h: number, d: number): THREE.BufferGeometry => new THREE.BoxGeometry(w, h, d);
  const cylG = (r0: number, r1: number, h: number, seg = 14): THREE.BufferGeometry => new THREE.CylinderGeometry(r0, r1, h, seg);
  const torus = (r: number, t: number, arc = Math.PI * 2): THREE.BufferGeometry => new THREE.TorusGeometry(r, t, 8, 20, arc);

  const skin = app.skin;
  const top = app.top;
  const torsoColor = top === 'overalls' ? app.topColor2 : app.topColor;
  const longSleeve = SLEEVED_LONG.has(top);
  const shortSleeve = SLEEVED_SHORT.has(top);
  const sleeveColor = top === 'sweatervest' ? app.topColor2 : top === 'overalls' ? app.topColor2 : app.topColor;
  const gloves = app.accessories.includes('gloves');
  const handColor = gloves ? 0x1e1e22 : skin;
  const legLower = app.pants === 'shorts' ? skin : app.pantsColor;
  const torsoW = (fem ? 0.135 : 0.15) * b;
  const sh = shoulderW / 0.19;

  add(capsule(torsoW, 0.16 * s), 'chest', torsoColor, 0, 0.09 * s, 0, 1.25 * sh, 1, 0.72 + app.belly * 0.15);
  if (fem) add(sphere(0.07), 'chest', torsoColor, 0, 0.1 * s, -0.075 * b, 1.9, 0.75, 0.75);
  add(capsule(torsoW * 0.92, 0.1 * s), 'spine', top === 'overalls' ? app.topColor : torsoColor, 0, 0.06 * s, 0, 1.15 * (fem ? 0.92 : 1) * Math.max(1, b * 0.85), 1, 0.75);
  if (app.belly > 0) add(sphere(0.2 * app.belly * b), 'spine', torsoColor, 0, 0.04, -0.06 * b, 1.05, 0.95, 0.9);
  add(capsule(0.13 * Math.max(1, b * 0.9) * (fem ? 1.08 : 1), 0.12), 'hips', app.pantsColor, 0, -0.03, 0, 1.15, 0.6, 0.75, false, 0, 0, Math.PI / 2);
  add(boxG(0.3 * Math.max(1, b * 0.9), 0.04, 0.2 * Math.max(1, b * 0.8)), 'hips', 0x2a2420, 0, 0.04, 0);
  add(cylG(0.05 * Math.max(1, b * 0.8), 0.055 * Math.max(1, b * 0.8), 0.1), 'neck', skin, 0, 0.02, 0);

  add(sphere(hr, 20, 16), 'head', skin, 0, hr * 0.85, 0, 0.92, 1.06, 1);
  if (!fem) add(sphere(hr * 0.7), 'head', skin, 0, hr * 0.42, -hr * 0.18, 1.05, 0.7, 1);
  else add(sphere(hr * 0.6), 'head', skin, 0, hr * 0.45, -hr * 0.2, 0.95, 0.7, 1);
  for (const sx of [1, -1]) {
    add(sphere(hr * 0.2), 'head', skin, sx * hr * 0.9, hr * 0.8, 0.0, 0.5, 1, 0.8);
    add(sphere(hr * 0.17, 10, 8), 'head', 0xffffff, sx * hr * 0.36, hr * 0.92, -hr * 0.82, 1.1, 0.9, 0.6);
    add(sphere(hr * 0.095, 8, 6), 'head', app.eyeColor, sx * hr * 0.36, hr * 0.92, -hr * 0.93, 1, 1, 0.5);
    add(sphere(hr * 0.04, 6, 4), 'head', 0x0a0a0a, sx * hr * 0.36, hr * 0.92, -hr * 0.97, 1, 1, 0.5);
    add(boxG(hr * 0.38, hr * 0.07, hr * 0.08), 'head', app.hair === 'bald' ? 0x2a1a10 : app.hairColor, sx * hr * 0.36, hr * 1.12, -hr * 0.86, 1, 1, 1, false, 0, 0, sx * (fem ? -0.12 : -0.05));
  }
  add(new THREE.ConeGeometry(hr * 0.14, hr * 0.3, 8), 'head', darken(skin, 0.92), 0, hr * 0.72, -hr * 1.0, 1, 1, 0.8, false, -Math.PI / 2 + 0.3, 0, 0);
  add(boxG(hr * 0.42, hr * 0.06, hr * 0.06), 'head', fem ? 0xb04a5a : darken(skin, 0.6), 0, hr * 0.46, -hr * 0.88);

  for (const side of ['R', 'L'] as const) {
    const armScale = (1 + app.muscle * 0.45) * Math.sqrt(b);
    const upColor = longSleeve || shortSleeve ? sleeveColor : skin;
    add(capsule(0.048 * armScale, upperArm * 0.7), `upperArm${side}`, upColor, 0, -upperArm * 0.5, 0);
    if (top === 'tank') add(sphere(0.06 * armScale), `upperArm${side}`, skin, 0, -0.01, 0);
    else add(sphere(0.062 * armScale), `upperArm${side}`, upColor, 0, -0.01, 0);
    add(capsule(0.04 * armScale, lowerArm * 0.7), `lowerArm${side}`, longSleeve ? sleeveColor : skin, 0, -lowerArm * 0.5, 0);
    if (longSleeve) add(cylG(0.046 * armScale, 0.046 * armScale, 0.04), `lowerArm${side}`, app.topColor2, 0, -lowerArm * 0.88, 0);
    add(boxG(0.07, 0.09, 0.05), `hand${side}`, handColor, 0, -0.045, 0);
    add(boxG(0.025, 0.05, 0.03), `hand${side}`, handColor, side === 'R' ? -0.035 : 0.035, -0.03, -0.02);

    const legScale = Math.pow(b, 0.7);
    const shortsCut = app.pants === 'shorts';
    const leggings = app.pants === 'leggings' ? 0.85 : 1;
    add(capsule(0.075 * legScale * leggings * (fem ? 1.05 : 1), upperLeg * 0.7), `upperLeg${side}`, app.pantsColor, 0, -upperLeg * 0.5, 0);
    add(capsule(0.058 * legScale * leggings, lowerLeg * 0.72), `lowerLeg${side}`, legLower, 0, -lowerLeg * 0.5, 0);
    if (shortsCut) add(cylG(0.08 * legScale, 0.08 * legScale, 0.06), `upperLeg${side}`, app.pantsColor, 0, -upperLeg * 0.62, 0);
    if (app.pants === 'cargo') add(boxG(0.04, 0.12, 0.1), `upperLeg${side}`, darken(app.pantsColor, 0.85), (side === 'R' ? 1 : -1) * 0.075 * legScale, -upperLeg * 0.55, 0);
    if (app.pants === 'track') add(boxG(0.012, upperLeg * 0.9, 0.03), `upperLeg${side}`, 0xffffff, (side === 'R' ? 1 : -1) * 0.075 * legScale, -upperLeg * 0.5, 0);
    add(boxG(0.105, 0.08, 0.25), `foot${side}`, app.shoes, 0, -0.035, -0.055);
    add(boxG(0.11, 0.02, 0.26), `foot${side}`, 0xf0f0f0, 0, -0.07, -0.055);
  }

  const glowLine = (bone: BoneName, x: number, y: number, z: number, w: number, h: number, d: number): void =>
    add(boxG(w, h, d), bone, app.accent, x, y, z, 1, 1, 1, true);

  switch (top) {
    case 'jacket':
      add(torus(0.075, 0.03), 'chest', app.topColor2, 0, 0.21 * s, 0, 1.2, 1, 1, false, Math.PI / 2);
      glowLine('chest', 0, 0.08 * s, -torsoW * 0.75, 0.012, 0.22 * s, 0.01);
      glowLine('chest', shoulderW * 0.75, 0.2 * s, -0.02, 0.07, 0.012, 0.012);
      glowLine('chest', -shoulderW * 0.75, 0.2 * s, -0.02, 0.07, 0.012, 0.012);
      break;
    case 'hoodie':
      add(torus(0.1, 0.045), 'chest', app.topColor2, 0, 0.19 * s, 0.05, 1.1, 1, 1, false, Math.PI / 2.4);
      add(boxG(0.18, 0.08, 0.03), 'spine', app.topColor2, 0, 0.06, -torsoW * 0.75);
      glowLine('chest', 0.03, 0.12 * s, -torsoW * 0.72, 0.006, 0.12, 0.006);
      glowLine('chest', -0.03, 0.12 * s, -torsoW * 0.72, 0.006, 0.12, 0.006);
      break;
    case 'tank':
      add(boxG(0.03, 0.12, 0.2), 'chest', app.topColor, shoulderW * 0.55, 0.2 * s, 0);
      add(boxG(0.03, 0.12, 0.2), 'chest', app.topColor, -shoulderW * 0.55, 0.2 * s, 0);
      glowLine('chest', 0, 0.05 * s, -torsoW * 0.73, 0.1, 0.012, 0.01);
      break;
    case 'coat':
      add(boxG(0.34 * sh, 0.55 * s, 0.05), 'hips', app.topColor, 0, -0.2 * s, 0.11);
      add(boxG(0.05, 0.5 * s, 0.22), 'hips', app.topColor, 0.17 * sh, -0.18 * s, 0.0);
      add(boxG(0.05, 0.5 * s, 0.22), 'hips', app.topColor, -0.17 * sh, -0.18 * s, 0.0);
      add(cylG(0.09, 0.11, 0.12), 'chest', app.topColor, 0, 0.23 * s, 0.01);
      glowLine('chest', 0.06, 0.08 * s, -torsoW * 0.74, 0.01, 0.26 * s, 0.01);
      glowLine('chest', -0.06, 0.08 * s, -torsoW * 0.74, 0.01, 0.26 * s, 0.01);
      break;
    case 'sweatervest':
      add(torus(0.065, 0.022), 'chest', 0xf4f4f4, 0, 0.21 * s, -0.01, 1.2, 1, 1, false, Math.PI / 2);
      add(boxG(0.1, 0.12, 0.02), 'chest', app.topColor2, 0, 0.17 * s, -torsoW * 0.7, 1, 1, 1, false, 0, 0, Math.PI / 4);
      glowLine('chest', 0, 0.0, -torsoW * 0.75, 0.2, 0.01, 0.01);
      break;
    case 'polo':
      add(torus(0.07, 0.025), 'chest', app.topColor2, 0, 0.21 * s, -0.005, 1.25, 1, 1, false, Math.PI / 2);
      glowLine('chest', torsoW * 0.5, 0.15 * s, -torsoW * 0.78, 0.05, 0.035, 0.01);
      add(boxG(0.36 * sh, 0.025, 0.24), 'chest', app.topColor2, 0, -0.04, 0);
      break;
    case 'jersey':
      add(boxG(0.02, 0.28 * s, 0.01), 'chest', app.topColor2, torsoW * 0.6, 0.08 * s, -torsoW * 0.72);
      add(boxG(0.02, 0.28 * s, 0.01), 'chest', app.topColor2, -torsoW * 0.6, 0.08 * s, -torsoW * 0.72);
      glowLine('chest', 0, 0.12 * s, -torsoW * 0.76, 0.07, 0.09, 0.008);
      break;
    case 'overalls':
      add(boxG(0.2, 0.2 * s, 0.03), 'chest', app.topColor, 0, 0.06 * s, -torsoW * 0.7);
      add(boxG(0.03, 0.26 * s, 0.25), 'chest', app.topColor, 0.08, 0.12 * s, 0);
      add(boxG(0.03, 0.26 * s, 0.25), 'chest', app.topColor, -0.08, 0.12 * s, 0);
      glowLine('chest', 0, 0.12 * s, -torsoW * 0.74, 0.06, 0.05, 0.008);
      break;
    case 'medic':
      add(boxG(0.1, 0.03, 0.01), 'chest', app.topColor2, -torsoW * 0.5, 0.15 * s, -torsoW * 0.78);
      add(boxG(0.03, 0.1, 0.01), 'chest', app.topColor2, -torsoW * 0.5, 0.15 * s, -torsoW * 0.78);
      add(torus(0.075, 0.028), 'chest', app.topColor2, 0, 0.21 * s, 0, 1.2, 1, 1, false, Math.PI / 2);
      glowLine('chest', torsoW * 0.5, 0.06 * s, -torsoW * 0.76, 0.012, 0.18 * s, 0.01);
      break;
    case 'tshirt':
      add(torus(0.065, 0.02), 'chest', app.topColor2, 0, 0.21 * s, -0.005, 1.2, 1, 1, false, Math.PI / 2);
      glowLine('chest', 0, 0.12 * s, -torsoW * 0.75, 0.08, 0.08, 0.008);
      break;
  }

  const hairC = app.hairColor;
  const cap = (scale = 1.06, theta = 0.55): THREE.BufferGeometry => new THREE.SphereGeometry(hr * scale, 20, 12, 0, Math.PI * 2, 0, Math.PI * theta);
  switch (app.hair) {
    case 'fade':
      add(cap(1.05, 0.5), 'head', hairC, 0, hr * 0.92, 0.01, 0.95, 1.05, 1.02);
      add(boxG(hr * 1.2, hr * 0.25, hr * 0.9), 'head', hairC, 0, hr * 1.85, -0.005, 1, 1, 1, false, -0.15);
      break;
    case 'curly':
      add(cap(1.06, 0.5), 'head', hairC, 0, hr * 0.9, 0, 0.96, 1.05, 1);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 * 3.1;
        const r = hr * (0.35 + (i % 4) * 0.17);
        add(sphere(hr * 0.26, 8, 6), 'head', hairC, Math.cos(a) * r * 0.9, hr * (1.62 + (i % 3) * 0.07), Math.sin(a) * r * 0.9 + 0.01);
      }
      break;
    case 'ponytail':
      add(cap(1.07, 0.56), 'head', hairC, 0, hr * 0.88, 0.01, 0.97, 1.05, 1.03);
      add(capsule(hr * 0.24, hr * 1.6), 'head', hairC, 0, hr * 0.9, hr * 1.25, 1, 1, 1, false, 0.5);
      add(torus(hr * 0.2, hr * 0.06), 'head', app.accent, 0, hr * 1.45, hr * 0.98, 1, 1, 1, false, 0.5);
      add(boxG(hr * 1.7, hr * 0.5, hr * 0.3), 'head', hairC, 0, hr * 1.42, -hr * 0.72, 1, 1, 1, false, 0.35);
      break;
    case 'buzz':
      add(cap(1.02, 0.5), 'head', hairC, 0, hr * 0.92, 0.005, 0.95, 1.05, 1.01);
      break;
    case 'afro':
      add(sphere(hr * 1.75, 22, 16), 'head', hairC, 0, hr * 1.45, hr * 0.35, 1.0, 0.9, 0.95);
      add(cap(1.07, 0.55), 'head', hairC, 0, hr * 0.88, 0.01, 0.97, 1.05, 1.03);
      break;
    case 'sidepart':
      add(cap(1.06, 0.52), 'head', hairC, 0, hr * 0.9, 0.01, 0.96, 1.05, 1.02);
      add(sphere(hr * 0.55, 12, 8), 'head', hairC, hr * 0.25, hr * 1.7, -hr * 0.45, 1.5, 0.55, 0.9);
      break;
    case 'mohawk':
      add(cap(1.02, 0.5), 'head', darken(hairC, 0.5), 0, hr * 0.92, 0.005, 0.95, 1.05, 1.01);
      for (let i = 0; i < 6; i++) {
        add(boxG(hr * 0.25, hr * (0.55 + Math.sin(i * 0.6) * 0.2), hr * 0.3), 'head', hairC, 0, hr * 1.98, hr * (-0.75 + i * 0.3), 1, 1, 1, false, -0.25 + i * 0.1);
      }
      break;
    case 'longtied':
      add(cap(1.06, 0.56), 'head', hairC, 0, hr * 0.88, 0.01, 0.97, 1.05, 1.03);
      add(capsule(hr * 0.22, hr * 2.2), 'neck', hairC, 0, -0.02, hr * 1.1, 1, 1, 1, false, -0.12);
      for (const sx of [1, -1]) add(boxG(hr * 0.25, hr * 0.9, hr * 0.25), 'head', hairC, sx * hr * 0.82, hr * 0.85, -hr * 0.45);
      break;
    case 'braid':
      add(cap(1.06, 0.55), 'head', hairC, 0, hr * 0.88, 0.01, 0.97, 1.05, 1.03);
      for (let i = 0; i < 6; i++) add(sphere(hr * (0.26 - i * 0.02), 8, 6), 'neck', hairC, 0, 0.1 - i * hr * 0.42, hr * 1.05 + i * 0.004);
      break;
    case 'buns':
      add(cap(1.06, 0.55), 'head', hairC, 0, hr * 0.88, 0.01, 0.97, 1.05, 1.03);
      for (const sx of [1, -1]) add(sphere(hr * 0.42, 12, 10), 'head', hairC, sx * hr * 0.7, hr * 1.82, hr * 0.1);
      add(boxG(hr * 1.7, hr * 0.35, hr * 0.3), 'head', hairC, 0, hr * 1.5, -hr * 0.75, 1, 1, 1, false, 0.3);
      break;
    case 'bald':
      break;
  }

  for (const acc of app.accessories) {
    switch (acc) {
      case 'glasses':
        for (const sx of [1, -1]) add(boxG(hr * 0.5, hr * 0.32, hr * 0.04), 'head', 0x111111, sx * hr * 0.36, hr * 0.92, -hr * 1.0);
        add(boxG(hr * 0.25, hr * 0.05, hr * 0.04), 'head', 0x111111, 0, hr * 0.98, -hr * 1.0);
        break;
      case 'roundGlasses':
        for (const sx of [1, -1]) add(torus(hr * 0.2, hr * 0.03), 'head', 0x2a2a2a, sx * hr * 0.36, hr * 0.92, -hr * 1.0);
        add(boxG(hr * 0.2, hr * 0.04, hr * 0.04), 'head', 0x2a2a2a, 0, hr * 0.95, -hr * 1.0);
        break;
      case 'sunglasses':
        add(boxG(hr * 1.4, hr * 0.28, hr * 0.06), 'head', 0x0a0a0c, 0, hr * 0.93, -hr * 0.98);
        break;
      case 'capBack':
        add(cap(1.12, 0.45), 'head', app.topColor2, 0, hr * 0.95, 0, 0.97, 1.0, 1.02);
        add(boxG(hr * 1.1, hr * 0.06, hr * 0.8), 'head', app.topColor2, 0, hr * 1.4, hr * 1.1, 1, 1, 1, false, -0.1);
        break;
      case 'headphonesNeck':
        add(torus(0.12, 0.022, Math.PI * 1.3), 'neck', 0x1a1a1a, 0, 0.02, 0, 1, 1, 1, false, Math.PI / 2, 0, Math.PI * 0.85);
        for (const sx of [1, -1]) add(cylG(0.045, 0.045, 0.035), 'neck', app.accent, sx * 0.12, 0.02, -0.02, 1, 1, 1, true, 0, 0, Math.PI / 2);
        break;
      case 'headset':
        add(torus(hr * 1.05, hr * 0.06, Math.PI), 'head', 0x1a1a1a, 0, hr * 0.9, 0);
        add(cylG(hr * 0.3, hr * 0.3, hr * 0.15), 'head', 0x1a1a1a, hr * 1.02, hr * 0.85, 0, 1, 1, 1, false, 0, 0, Math.PI / 2);
        add(cylG(hr * 0.3, hr * 0.3, hr * 0.15), 'head', 0x1a1a1a, -hr * 1.02, hr * 0.85, 0, 1, 1, 1, false, 0, 0, Math.PI / 2);
        add(boxG(hr * 0.06, hr * 0.06, hr * 0.8), 'head', 0x1a1a1a, hr * 0.9, hr * 0.6, -hr * 0.45, 1, 1, 1, false, 0, 0.5);
        add(sphere(hr * 0.08, 6, 4), 'head', app.accent, hr * 0.62, hr * 0.55, -hr * 0.83, 1, 1, 1, true);
        break;
      case 'beard':
        add(sphere(hr * 0.75, 14, 10), 'head', hairC, 0, hr * 0.38, -hr * 0.25, 1.05, 0.85, 1.0);
        add(boxG(hr * 0.6, hr * 0.12, hr * 0.12), 'head', hairC, 0, hr * 0.58, -hr * 0.9);
        break;
      case 'mustache':
        add(capsule(hr * 0.09, hr * 0.4), 'head', 0x1c120c, 0, hr * 0.58, -hr * 0.94, 1, 1, 1, false, 0, 0, Math.PI / 2);
        break;
      case 'stubble':
        add(sphere(hr * 0.72, 14, 10), 'head', darken(skin, 0.75), 0, hr * 0.38, -hr * 0.18, 1.03, 0.75, 1.0);
        break;
      case 'hoops':
        for (const sx of [1, -1]) add(torus(hr * 0.15, hr * 0.025), 'head', 0xf2c230, sx * hr * 0.95, hr * 0.48, 0, 1, 1, 1, false, 0, Math.PI / 2);
        break;
      case 'chain':
        add(torus(0.095, 0.01), 'chest', 0xf2c230, 0, 0.2 * s, -0.03, 1.1, 1, 1.3, false, Math.PI / 2.2);
        break;
      case 'headband':
        add(torus(hr * 0.98, hr * 0.08), 'head', app.gender === 'm' ? 0xd23a2a : app.topColor2, 0, hr * 1.2, 0, 1, 1, 1, false, Math.PI / 2);
        break;
      case 'scarfMask':
        add(cylG(hr * 0.85, hr * 0.9, hr * 0.55), 'head', 0x1c1a24, 0, hr * 0.45, -hr * 0.05, 1, 1, 1.05);
        add(boxG(0.06, 0.25, 0.02), 'chest', app.accent, 0.05, 0.12 * s, -torsoW * 0.8, 1, 1, 1, true);
        break;
      case 'tophat':
        add(cylG(hr * 0.75, hr * 0.75, hr * 1.0, 16), 'head', 0x141218, 0, hr * 2.15, 0);
        add(cylG(hr * 1.25, hr * 1.25, hr * 0.06, 18), 'head', 0x141218, 0, hr * 1.68, 0);
        add(cylG(hr * 0.77, hr * 0.77, hr * 0.15, 16), 'head', app.accent, 0, hr * 1.78, 0, 1, 1, 1, true);
        break;
      case 'flower':
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          add(sphere(hr * 0.1, 6, 4), 'head', 0xff7ab8, hr * 0.85 + Math.cos(a) * hr * 0.1, hr * 1.35 + Math.sin(a) * hr * 0.1, -hr * 0.2);
        }
        add(sphere(hr * 0.07, 6, 4), 'head', 0xffe14a, hr * 0.9, hr * 1.35, -hr * 0.22);
        break;
      case 'kneepads':
        for (const side of ['R', 'L'] as const) add(boxG(0.1, 0.09, 0.05), `lowerLeg${side}`, 0x1a1a1a, 0, -0.03, -0.055);
        break;
      case 'apron':
        add(boxG(0.3 * sh, 0.5 * s, 0.02), 'spine', 0xe8dfcf, 0, -0.07 * s, -torsoW * 0.85);
        break;
      case 'hairband':
        add(torus(hr * 1.02, hr * 0.09), 'head', app.accent, 0, hr * 1.25, 0.02, 1, 1, 1, true, Math.PI / 2.3);
        break;
      case 'watch':
        add(boxG(0.05, 0.03, 0.05), 'lowerArmL', 0x222222, 0, -lowerArm * 0.85, 0);
        break;
      case 'backpack':
        add(boxG(0.26, 0.32, 0.12), 'chest', 0x3a3a3a, 0, 0.05, 0.16);
        break;
      case 'sunhat':
        add(cylG(hr * 1.8, hr * 1.8, hr * 0.06, 20), 'head', 0xe6d29a, 0, hr * 1.65, 0.0, 1, 1, 1, false, -0.12);
        add(cap(0.95, 0.5), 'head', 0xe6d29a, 0, hr * 1.55, 0.0, 1, 0.9, 1);
        add(torus(hr * 0.92, hr * 0.06), 'head', 0x3f8a4a, 0, hr * 1.62, 0, 1, 1, 1, false, Math.PI / 2);
        break;
      case 'gloves':
        break;
    }
  }

  const boneIndex = new Map<string, number>();
  order.forEach((bn, i) => boneIndex.set(bn.name, i));
  const tmpColor = new THREE.Color();
  const normal: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  for (const p of parts) {
    const g = p.geo.index ? p.geo : p.geo;
    const bone = bones[p.bone];
    g.applyMatrix4(bone.matrixWorld);
    const n = g.attributes.position.count;
    const colors = new Float32Array(n * 3);
    tmpColor.setHex(p.color, THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const si = new Uint16Array(n * 4);
    const sw = new Float32Array(n * 4);
    const bi = boneIndex.get(p.bone)!;
    for (let i = 0; i < n; i++) {
      si[i * 4] = bi;
      sw[i * 4] = 1;
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    if (!g.index) {
      const idx = new Uint32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    (p.glow ? glow : normal).push(g);
  }
  const mergedNormal = mergeGeometries(normal, false)!;
  const groups = [mergedNormal];
  if (glow.length) groups.push(mergeGeometries(glow, false)!);
  const geometry = mergeGeometries(groups, true)!;
  normal.forEach((g) => g.dispose());
  glow.forEach((g) => g.dispose());
  groups.forEach((g) => g.dispose());

  const matBody = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.05 });
  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const mesh = new THREE.SkinnedMesh(geometry, [matBody, matGlow]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.add(root);
  const skeleton = new THREE.Skeleton(order);
  mesh.bind(skeleton);
  mesh.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh);
  const socket = new THREE.Object3D();
  socket.position.set(0.12, 0.03 * s, -0.3);
  bones.chest.add(socket);

  const clips = buildClips(bones, hipsY, s);

  return {
    root: group,
    mesh,
    bones,
    weaponSocket: socket,
    clips,
    hipsY,
    dispose: () => {
      geometry.dispose();
      matBody.dispose();
      matGlow.dispose();
      skeleton.dispose();
    },
  };
}

function darken(hex: number, f: number): number {
  const c = new THREE.Color(hex);
  c.multiplyScalar(f);
  return c.getHex();
}

const ARMS: Pose = {
  upperArmR: [0.55, 0, 0.35],
  lowerArmR: [1.25, 0.1, 0],
  handR: [-0.2, 0, 0],
  upperArmL: [1.0, 0, -0.65],
  lowerArmL: [0.75, 0, 0],
  handL: [0, 0, 0],
};

function buildClips(bones: Record<BoneName, THREE.Bone>, hipsY: number, s: number): THREE.AnimationClip[] {
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const names = Object.keys(bones) as BoneName[];

  const clip = (name: string, frames: Array<{ t: number; pose: Pose; hy?: number; hz?: number }>, loop = true): THREE.AnimationClip => {
    const tracks: THREE.KeyframeTrack[] = [];
    const duration = frames[frames.length - 1].t;
    for (const bn of names) {
      if (bn === 'root') continue;
      const times: number[] = [];
      const values: number[] = [];
      for (const f of frames) {
        const r = f.pose[bn] ?? ARMS[bn] ?? [0, 0, 0];
        e.set(r[0], r[1], r[2]);
        q.setFromEuler(e);
        times.push(f.t);
        values.push(q.x, q.y, q.z, q.w);
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${bn}.quaternion`, times, values));
    }
    const ptimes: number[] = [];
    const pvals: number[] = [];
    for (const f of frames) {
      ptimes.push(f.t);
      pvals.push(0, f.hy ?? hipsY, f.hz ?? 0);
    }
    tracks.push(new THREE.VectorKeyframeTrack('hips.position', ptimes, pvals));
    const c = new THREE.AnimationClip(name, duration, tracks);
    c.userData = { loop };
    return c;
  };

  const legs = (l: number, r: number, kl: number, kr: number, extra: Pose = {}): Pose => ({
    upperLegL: [l, 0, 0],
    upperLegR: [r, 0, 0],
    lowerLegL: [-kl, 0, 0],
    lowerLegR: [-kr, 0, 0],
    footL: [kl * 0.3, 0, 0],
    footR: [kr * 0.3, 0, 0],
    ...extra,
  });

  const idle = clip('idle', [
    { t: 0, pose: { ...legs(0.05, -0.05, 0.1, 0.1), chest: [0, 0, 0] } },
    { t: 1, pose: { ...legs(0.05, -0.05, 0.1, 0.1), chest: [-0.04, 0, 0] }, hy: hipsY - 0.01 },
    { t: 2, pose: { ...legs(0.05, -0.05, 0.1, 0.1), chest: [0, 0, 0] } },
  ]);

  const walkFrames = (amp: number, knee: number, period: number, lean: number, crouch = 0) => {
    const out: Array<{ t: number; pose: Pose; hy?: number }> = [];
    const n = 8;
    const baseY = hipsY - crouch;
    for (let i = 0; i <= n; i++) {
      const ph = (i / n) * Math.PI * 2;
      const l = Math.sin(ph) * amp;
      const r = -l;
      const kl = Math.max(0, Math.cos(ph)) * knee + 0.1 + crouch * 2.6;
      const kr = Math.max(0, -Math.cos(ph)) * knee + 0.1 + crouch * 2.6;
      const tilt = crouch > 0 ? crouch * 2.2 : 0;
      out.push({
        t: (i / n) * period,
        pose: { ...legs(l + tilt, r + tilt, kl, kr), spine: [lean, Math.sin(ph) * 0.06, 0], chest: [0, -Math.sin(ph) * 0.08, 0] },
        hy: baseY - Math.abs(Math.cos(ph)) * 0.04 * (amp > 0.5 ? 1.5 : 1),
      });
    }
    return out;
  };

  const walk = clip('walk', walkFrames(0.42, 0.55, 1.05, -0.04));
  const run = clip('run', walkFrames(0.85, 1.25, 0.68, -0.16));
  const crouchK = 0.36 * s;
  const crouchIdle = clip('crouch', [
    { t: 0, pose: { ...legs(1.15, 0.85, 1.75, 1.45), spine: [-0.18, 0, 0] }, hy: hipsY - crouchK },
    { t: 1, pose: { ...legs(1.15, 0.85, 1.75, 1.45), spine: [-0.2, 0, 0] }, hy: hipsY - crouchK - 0.01 },
    { t: 2, pose: { ...legs(1.15, 0.85, 1.75, 1.45), spine: [-0.18, 0, 0] }, hy: hipsY - crouchK },
  ]);
  const crouchWalk = clip('crouchWalk', walkFrames(0.35, 0.5, 0.95, -0.2, crouchK * 0.42).map((f) => ({ ...f, hy: (f.hy ?? hipsY) - crouchK * 0.58 })));
  const jump = clip('jump', [
    { t: 0, pose: { ...legs(0.7, 0.2, 1.1, 0.5), spine: [-0.08, 0, 0] } },
    { t: 0.5, pose: { ...legs(0.75, 0.25, 1.2, 0.6), spine: [-0.1, 0, 0] } },
  ]);
  const death = clip('death', [
    { t: 0, pose: { ...legs(0, 0, 0.1, 0.1) } },
    { t: 0.25, pose: { ...legs(0.3, 0.6, 1.0, 1.2), spine: [0.3, 0, 0.1], upperArmR: [0.2, 0, 0.6], upperArmL: [0.4, 0, -0.6] }, hy: hipsY * 0.7 },
    { t: 0.7, pose: { hips: [1.45, 0, 0.1], ...legs(-0.2, 0.1, 0.4, 0.2), spine: [0.15, 0, 0], neck: [0.3, 0.4, 0], upperArmR: [-0.2, 0, 1.4], lowerArmR: [0.3, 0, 0], upperArmL: [0.2, 0, -1.3], lowerArmL: [0.4, 0, 0] }, hy: 0.18, hz: 0.25 },
    { t: 1.2, pose: { hips: [1.52, 0, 0.1], ...legs(-0.25, 0.12, 0.35, 0.15), spine: [0.1, 0, 0], neck: [0.3, 0.5, 0], upperArmR: [-0.2, 0, 1.5], lowerArmR: [0.2, 0, 0], upperArmL: [0.2, 0, -1.4], lowerArmL: [0.3, 0, 0] }, hy: 0.15, hz: 0.3 },
  ], false);
  const plantPose: Pose = { ...legs(1.3, -0.1, 1.9, 1.6), spine: [-0.45, 0, 0], upperArmR: [0.9, 0, 0.2], lowerArmR: [0.4, 0, 0], upperArmL: [0.9, 0, -0.2], lowerArmL: [0.4, 0, 0] };
  const plant = clip('plant', [
    { t: 0, pose: plantPose, hy: hipsY * 0.55 },
    { t: 0.5, pose: { ...plantPose, lowerArmR: [0.6, 0, 0], lowerArmL: [0.6, 0, 0] }, hy: hipsY * 0.55 },
    { t: 1, pose: plantPose, hy: hipsY * 0.55 },
  ]);
  const pose = clip('pose', [
    { t: 0, pose: { ...legs(0.1, -0.15, 0.2, 0.15), spine: [0.02, 0.1, 0], chest: [0, 0.15, 0], neck: [0.05, -0.2, 0] } },
    { t: 1.5, pose: { ...legs(0.1, -0.15, 0.2, 0.15), spine: [0.0, 0.12, 0], chest: [-0.04, 0.18, 0], neck: [0.0, -0.15, 0] }, hy: hipsY - 0.012 },
    { t: 3, pose: { ...legs(0.1, -0.15, 0.2, 0.15), spine: [0.02, 0.1, 0], chest: [0, 0.15, 0], neck: [0.05, -0.2, 0] } },
  ]);
  return [idle, walk, run, crouchIdle, crouchWalk, jump, death, plant, pose];
}
