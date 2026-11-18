import * as THREE from 'three';

const matCache = new Map<string, THREE.MeshStandardMaterial>();

function mat(color: number, rough = 0.5, metal = 0.6, emissive = 0): THREE.MeshStandardMaterial {
  const key = `${color}_${rough}_${metal}_${emissive}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ? color : 0x000000, emissiveIntensity: emissive });
    matCache.set(key, m);
  }
  return m;
}

function box(g: THREE.Group, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rx = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  g.add(mesh);
  return mesh;
}

function cyl(g: THREE.Group, r: number, len: number, x: number, y: number, z: number, m: THREE.Material, seg = 12): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}

export interface WeaponModel {
  root: THREE.Group;
  muzzle: THREE.Object3D;
  mag: THREE.Object3D | null;
}

export function buildWeaponModel(id: string): WeaponModel {
  const g = new THREE.Group();
  const dark = mat(0x23262b, 0.45, 0.7);
  const mid = mat(0x4a4f57, 0.4, 0.75);
  const muzzle = new THREE.Object3D();
  let magMesh: THREE.Mesh | null = null;

  switch (id) {
    case 'faca': {
      const blade = mat(0xd8dde3, 0.15, 1);
      box(g, 0.03, 0.09, 0.12, 0, 0, 0.02, mat(0x2b2b2b, 0.8, 0.1));
      const b = box(g, 0.012, 0.05, 0.26, 0, 0.015, -0.17, blade);
      b.scale.set(1, 1, 1);
      box(g, 0.05, 0.02, 0.02, 0, 0.0, -0.045, mid);
      muzzle.position.set(0, 0, -0.3);
      break;
    }
    case 'faisca': {
      const body = mat(0x30343a, 0.4, 0.6);
      box(g, 0.045, 0.06, 0.2, 0, 0.03, -0.06, body);
      box(g, 0.04, 0.11, 0.05, 0, -0.04, 0.0, mat(0x1d1f22, 0.8, 0.2), 0.25);
      magMesh = box(g, 0.032, 0.06, 0.035, 0, -0.1, 0.012, dark);
      box(g, 0.01, 0.015, 0.01, 0, 0.068, -0.15, mat(0xff8a3a, 0.3, 0.2, 0.8));
      muzzle.position.set(0, 0.035, -0.17);
      break;
    }
    case 'trovao': {
      const body = mat(0x6b5a45, 0.35, 0.75);
      cyl(g, 0.018, 0.22, 0, 0.045, -0.15, mid);
      cyl(g, 0.034, 0.06, 0, 0.035, -0.03, body, 6);
      box(g, 0.04, 0.05, 0.1, 0, 0.04, 0.02, body);
      box(g, 0.038, 0.11, 0.05, 0, -0.035, 0.05, mat(0x5a3820, 0.7, 0.1), 0.35);
      muzzle.position.set(0, 0.045, -0.27);
      break;
    }
    case 'vespa': {
      const body = mat(0x2f3d2a, 0.5, 0.5);
      box(g, 0.06, 0.08, 0.3, 0, 0.03, -0.08, body);
      cyl(g, 0.016, 0.12, 0, 0.04, -0.28, dark);
      box(g, 0.04, 0.1, 0.045, 0, -0.04, 0.03, dark, 0.2);
      magMesh = box(g, 0.03, 0.16, 0.04, 0, -0.08, -0.12, mid, -0.1);
      box(g, 0.03, 0.03, 0.14, 0, 0.03, 0.12, dark);
      box(g, 0.025, 0.025, 0.06, 0, 0.085, -0.05, mat(0xffd34a, 0.3, 0.2, 0.6));
      muzzle.position.set(0, 0.04, -0.35);
      break;
    }
    case 'marreta': {
      const wood = mat(0x7a4a26, 0.7, 0.05);
      cyl(g, 0.026, 0.5, 0, 0.05, -0.25, dark);
      cyl(g, 0.022, 0.38, 0, 0.012, -0.2, mid);
      box(g, 0.06, 0.07, 0.18, 0, 0.03, 0.02, dark);
      box(g, 0.05, 0.06, 0.22, 0, -0.005, 0.2, wood);
      box(g, 0.055, 0.045, 0.14, 0, 0.01, -0.26, wood);
      muzzle.position.set(0, 0.05, -0.5);
      break;
    }
    case 'jaguar': {
      const body = mat(0x3a2d24, 0.5, 0.4);
      const wood = mat(0x8a5a30, 0.65, 0.05);
      box(g, 0.06, 0.08, 0.36, 0, 0.03, -0.06, body);
      cyl(g, 0.017, 0.3, 0, 0.045, -0.38, dark);
      box(g, 0.05, 0.06, 0.2, 0, 0.03, -0.32, wood);
      box(g, 0.05, 0.09, 0.22, 0, 0.0, 0.22, wood);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      magMesh = box(g, 0.035, 0.16, 0.06, 0, -0.07, -0.08, mid, 0.35);
      box(g, 0.012, 0.04, 0.012, 0, 0.09, -0.48, dark);
      muzzle.position.set(0, 0.045, -0.53);
      break;
    }
    case 'falcao': {
      const body = mat(0x2b3440, 0.4, 0.6);
      box(g, 0.065, 0.085, 0.4, 0, 0.03, -0.06, body);
      cyl(g, 0.022, 0.22, 0, 0.04, -0.36, dark);
      cyl(g, 0.03, 0.12, 0, 0.04, -0.5, dark);
      box(g, 0.045, 0.09, 0.2, 0, 0.02, 0.23, body);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      magMesh = box(g, 0.035, 0.15, 0.06, 0, -0.07, -0.08, mid, 0.2);
      box(g, 0.04, 0.035, 0.1, 0, 0.1, -0.02, mat(0x101318, 0.3, 0.8));
      box(g, 0.02, 0.012, 0.012, 0, 0.12, -0.02, mat(0x4ad6ff, 0.2, 0.2, 1.5));
      muzzle.position.set(0, 0.04, -0.57);
      break;
    }
    case 'guardiao': {
      const body = mat(0xb8a27a, 0.6, 0.3);
      box(g, 0.06, 0.08, 0.42, 0, 0.03, -0.05, body);
      cyl(g, 0.016, 0.34, 0, 0.045, -0.42, dark);
      box(g, 0.05, 0.1, 0.22, 0, 0.0, 0.24, body);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      magMesh = box(g, 0.035, 0.1, 0.06, 0, -0.05, -0.08, mid);
      cyl(g, 0.026, 0.18, 0, 0.11, -0.03, dark);
      muzzle.position.set(0, 0.045, -0.6);
      break;
    }
    case 'gaviao': {
      const body = mat(0x4b5a3a, 0.6, 0.3);
      box(g, 0.065, 0.085, 0.5, 0, 0.03, -0.05, body);
      cyl(g, 0.019, 0.55, 0, 0.045, -0.55, dark);
      cyl(g, 0.03, 0.1, 0, 0.045, -0.85, dark);
      box(g, 0.055, 0.12, 0.26, 0, -0.01, 0.28, body);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.07, dark, 0.25);
      magMesh = box(g, 0.035, 0.07, 0.07, 0, -0.04, -0.06, mid);
      cyl(g, 0.038, 0.32, 0, 0.13, -0.05, dark);
      cyl(g, 0.045, 0.04, 0, 0.13, -0.22, dark);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 16), mat(0x3a8aff, 0.1, 0.5, 0.6));
      lens.position.set(0, 0.13, 0.11);
      g.add(lens);
      muzzle.position.set(0, 0.045, -0.9);
      break;
    }
    case 'rolo': {
      const body = mat(0x494d3a, 0.55, 0.5);
      box(g, 0.1, 0.12, 0.45, 0, 0.02, -0.05, body);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        cyl(g, 0.012, 0.42, Math.cos(a) * 0.025, 0.03 + Math.sin(a) * 0.025, -0.45, dark, 8);
      }
      cyl(g, 0.05, 0.08, 0, 0.03, -0.3, mid);
      magMesh = box(g, 0.12, 0.12, 0.12, 0.08, -0.06, -0.06, mat(0x6b5a2a, 0.6, 0.4));
      box(g, 0.05, 0.1, 0.05, 0, -0.07, 0.08, dark, 0.25);
      box(g, 0.06, 0.08, 0.2, 0, 0.0, 0.24, body);
      muzzle.position.set(0, 0.03, -0.68);
      break;
    }
    case 'tempestade': {
      const body = mat(0x1a2a40, 0.3, 0.7);
      const glow = mat(0x4fc3ff, 0.2, 0.1, 2.5);
      box(g, 0.07, 0.09, 0.4, 0, 0.03, -0.06, body);
      cyl(g, 0.02, 0.3, 0, 0.04, -0.4, glow);
      box(g, 0.075, 0.02, 0.32, 0, 0.08, -0.06, glow);
      box(g, 0.045, 0.1, 0.045, 0, -0.045, 0.05, body, 0.25);
      box(g, 0.05, 0.08, 0.18, 0, 0.02, 0.22, body);
      muzzle.position.set(0, 0.04, -0.56);
      break;
    }
    case 'laminas': {
      const glow = mat(0x8a6aff, 0.2, 0.2, 2.2);
      for (let i = 0; i < 3; i++) {
        const k = box(g, 0.01, 0.035, 0.22, (i - 1) * 0.035, 0.0, -0.12, glow);
        k.rotation.y = (i - 1) * 0.15;
      }
      box(g, 0.08, 0.03, 0.04, 0, -0.02, 0.0, mat(0x2a2040, 0.6, 0.2));
      muzzle.position.set(0, 0, -0.25);
      break;
    }
    case 'spike': {
      const core = mat(0xff4655, 0.3, 0.3, 1.5);
      box(g, 0.22, 0.12, 0.22, 0, 0.06, 0, mat(0x2a2d33, 0.4, 0.7));
      cyl(g, 0.05, 0.2, 0, 0.18, 0, core).rotation.x = 0;
      box(g, 0.24, 0.02, 0.06, 0, 0.13, 0, core);
      muzzle.position.set(0, 0.2, 0);
      break;
    }
    default:
      box(g, 0.05, 0.07, 0.3, 0, 0.03, -0.1, mid);
      muzzle.position.set(0, 0.03, -0.3);
  }
  g.add(muzzle);
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root: g, muzzle, mag: magMesh };
}
