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

function box(g: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, rx = 0): THREE.Mesh {
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
  /** Where the trigger hand closes; hand grip axis = anchor local Y. */
  grip: THREE.Object3D;
  /** Where the support hand holds the handguard (null: one-handed / pistol cup grip). */
  support: THREE.Object3D | null;
  /** Local Y of the sight line (ADS centres this on screen). */
  sightY: number;
}

/** [gripX, gripY, gripZ, gripTiltX, supportZ | null, supportY] per weapon. */
const HOLD: Record<string, [number, number, number, number, number | null, number]> = {
  faca: [0, 0, 0.02, 0, null, 0],
  faisca: [0, -0.045, 0.008, 0.25, null, 0],
  trovao: [0, -0.04, 0.052, 0.35, null, 0],
  vespa: [0, -0.045, 0.032, 0.2, -0.22, 0.0],
  marreta: [0, 0.0, 0.1, -0.4, -0.26, -0.02],
  jaguar: [0, -0.05, 0.052, 0.25, -0.32, -0.005],
  falcao: [0, -0.05, 0.052, 0.25, -0.3, -0.02],
  guardiao: [0, -0.05, 0.052, 0.25, -0.3, -0.015],
  gaviao: [0, -0.05, 0.072, 0.25, -0.34, -0.02],
  rolo: [0, -0.07, 0.082, 0.25, -0.3, -0.045],
  tempestade: [0, -0.05, 0.052, 0.25, -0.3, -0.02],
  laminas: [0, -0.02, 0.0, 0, null, 0],
  spike: [0.12, 0.05, 0.02, 0, null, 0],
};

/** Local Y of each weapon's sight line, used to centre it when aiming (ADS). */
const SIGHT_Y: Record<string, number> = {
  faisca: 0.072, trovao: 0.078, vespa: 0.1, marreta: 0.075, jaguar: 0.105, falcao: 0.13,
  guardiao: 0.125, gaviao: 0.13, rolo: 0.105, tempestade: 0.09,
};

export function buildWeaponModel(id: string): WeaponModel {
  const g = new THREE.Group();
  const dark = mat(0x23262b, 0.45, 0.7);
  const mid = mat(0x4a4f57, 0.4, 0.75);
  const muzzle = new THREE.Object3D();
  let magMesh: THREE.Object3D | null = null;

  switch (id) {
    case 'faca': {
      // Black handle, steel blade with a neon-green edge.
      const blade = mat(0xd8dde3, 0.15, 1);
      const edge = mat(0x3aff9a, 0.2, 0.1, 2.2);
      box(g, 0.03, 0.09, 0.12, 0, 0, 0.02, mat(0x141414, 0.8, 0.1));
      box(g, 0.032, 0.012, 0.1, 0, -0.02, 0.02, edge);
      box(g, 0.012, 0.05, 0.26, 0, 0.015, -0.17, blade);
      box(g, 0.014, 0.008, 0.25, 0, -0.012, -0.17, edge);
      box(g, 0.06, 0.02, 0.022, 0, 0.0, -0.045, mat(0x1a1a1a, 0.4, 0.8));
      muzzle.position.set(0, 0, -0.3);
      break;
    }
    case 'faisca': {
      // Slim graphite pistol with a cyan stripe on the slide.
      const body = mat(0x1e2a33, 0.35, 0.7);
      const cyan = mat(0x35e0ff, 0.2, 0.1, 1.8);
      box(g, 0.045, 0.06, 0.2, 0, 0.03, -0.06, body);
      box(g, 0.047, 0.01, 0.16, 0, 0.045, -0.07, cyan);
      box(g, 0.04, 0.11, 0.05, 0, -0.04, 0.0, mat(0x10161a, 0.8, 0.2), 0.25);
      magMesh = box(g, 0.032, 0.06, 0.035, 0, -0.1, 0.012, dark);
      box(g, 0.01, 0.015, 0.01, 0, 0.068, -0.15, cyan);
      box(g, 0.03, 0.012, 0.01, 0, 0.066, 0.025, cyan);
      muzzle.position.set(0, 0.035, -0.17);
      break;
    }
    case 'trovao': {
      // Gold revolver, chunky cylinder, dark-red grip.
      const gold = mat(0xd4a83a, 0.25, 0.9);
      cyl(g, 0.02, 0.22, 0, 0.045, -0.15, gold);
      box(g, 0.012, 0.03, 0.2, 0, 0.065, -0.15, gold);
      cyl(g, 0.042, 0.07, 0, 0.035, -0.03, mat(0x8a6a28, 0.3, 0.85), 6);
      box(g, 0.04, 0.05, 0.1, 0, 0.04, 0.02, gold);
      box(g, 0.04, 0.11, 0.05, 0, -0.035, 0.05, mat(0x5a1414, 0.6, 0.1), 0.35);
      box(g, 0.01, 0.018, 0.01, 0, 0.085, -0.24, mat(0xffd34a, 0.3, 0.2, 1.2));
      muzzle.position.set(0, 0.045, -0.27);
      break;
    }
    case 'vespa': {
      // Yellow SMG with black wasp stripes and a short stock.
      const yel = mat(0xf0c419, 0.45, 0.3);
      const blk = mat(0x111111, 0.6, 0.3);
      box(g, 0.06, 0.08, 0.3, 0, 0.03, -0.08, yel);
      for (let i = 0; i < 4; i++) box(g, 0.062, 0.082, 0.025, 0, 0.03, -0.2 + i * 0.07, blk);
      cyl(g, 0.016, 0.12, 0, 0.04, -0.28, dark);
      box(g, 0.04, 0.1, 0.045, 0, -0.04, 0.03, blk, 0.2);
      magMesh = box(g, 0.03, 0.16, 0.04, 0, -0.08, -0.12, blk, -0.1);
      box(g, 0.03, 0.03, 0.1, 0, 0.03, 0.12, blk);
      box(g, 0.025, 0.025, 0.06, 0, 0.085, -0.05, mat(0xffe066, 0.3, 0.2, 1.2));
      muzzle.position.set(0, 0.04, -0.35);
      break;
    }
    case 'marreta': {
      // Double-barrel shotgun, wood with orange accents.
      const wood = mat(0x7a4a26, 0.7, 0.05);
      const orange = mat(0xff7a1a, 0.3, 0.2, 1.4);
      cyl(g, 0.024, 0.5, -0.024, 0.05, -0.25, dark);
      cyl(g, 0.024, 0.5, 0.024, 0.05, -0.25, dark);
      box(g, 0.1, 0.012, 0.03, 0, 0.05, -0.49, orange);
      box(g, 0.09, 0.07, 0.18, 0, 0.03, 0.02, dark);
      box(g, 0.05, 0.06, 0.22, 0, -0.005, 0.2, wood);
      box(g, 0.085, 0.045, 0.16, 0, 0.005, -0.26, wood);
      box(g, 0.092, 0.012, 0.03, 0, 0.005, -0.18, orange);
      muzzle.position.set(0, 0.05, -0.5);
      break;
    }
    case 'jaguar': {
      // Green camo rifle with a curved magazine.
      const g1 = mat(0x3d5a2a, 0.6, 0.2);
      const g2 = mat(0x6b7a3a, 0.6, 0.2);
      const g3 = mat(0x22301a, 0.6, 0.2);
      box(g, 0.06, 0.08, 0.36, 0, 0.03, -0.06, g1);
      box(g, 0.062, 0.04, 0.08, 0, 0.045, -0.15, g2);
      box(g, 0.062, 0.03, 0.06, 0, 0.02, 0.02, g3);
      cyl(g, 0.017, 0.3, 0, 0.045, -0.38, dark);
      box(g, 0.05, 0.06, 0.2, 0, 0.03, -0.32, g2);
      box(g, 0.052, 0.03, 0.06, 0, 0.04, -0.36, g3);
      box(g, 0.05, 0.09, 0.22, 0, 0.0, 0.22, g1);
      box(g, 0.052, 0.04, 0.07, 0, 0.02, 0.25, g3);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      const magG = new THREE.Group();
      magG.position.set(0, -0.03, -0.08);
      magG.rotation.x = 0.2;
      box(magG, 0.035, 0.08, 0.06, 0, -0.03, 0, dark);
      box(magG, 0.035, 0.08, 0.06, 0, -0.1, 0.025, dark, 0.4);
      g.add(magG);
      magMesh = magG;
      box(g, 0.012, 0.04, 0.012, 0, 0.09, -0.48, dark);
      box(g, 0.012, 0.03, 0.012, 0, 0.085, 0.06, dark);
      muzzle.position.set(0, 0.045, -0.53);
      break;
    }
    case 'falcao': {
      // White rifle with blue accents and a top rail.
      const white = mat(0xe8ebf0, 0.35, 0.3);
      const blue = mat(0x2a7aff, 0.2, 0.2, 1.4);
      box(g, 0.065, 0.085, 0.4, 0, 0.03, -0.06, white);
      box(g, 0.067, 0.012, 0.3, 0, 0.0, -0.1, blue);
      cyl(g, 0.022, 0.22, 0, 0.04, -0.36, dark);
      cyl(g, 0.03, 0.12, 0, 0.04, -0.5, dark);
      box(g, 0.045, 0.09, 0.2, 0, 0.02, 0.23, white);
      box(g, 0.047, 0.015, 0.12, 0, 0.05, 0.23, blue);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      magMesh = box(g, 0.035, 0.15, 0.06, 0, -0.07, -0.08, mat(0x2a3440, 0.4, 0.6), 0.05);
      box(g, 0.03, 0.012, 0.36, 0, 0.078, -0.08, dark);
      box(g, 0.04, 0.035, 0.1, 0, 0.1, -0.02, mat(0x101318, 0.3, 0.8));
      box(g, 0.02, 0.012, 0.012, 0, 0.12, -0.02, blue);
      muzzle.position.set(0, 0.04, -0.57);
      break;
    }
    case 'guardiao': {
      // Graphite marksman rifle with a purple stripe and a red-dot sight.
      const body = mat(0x3a3d42, 0.45, 0.6);
      const purple = mat(0xa24aff, 0.2, 0.1, 1.8);
      box(g, 0.06, 0.08, 0.42, 0, 0.03, -0.05, body);
      box(g, 0.062, 0.012, 0.36, 0, 0.055, -0.08, purple);
      cyl(g, 0.016, 0.34, 0, 0.045, -0.42, dark);
      box(g, 0.05, 0.1, 0.22, 0, 0.0, 0.24, body);
      box(g, 0.052, 0.012, 0.18, 0, 0.03, 0.24, purple);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.05, dark, 0.25);
      magMesh = box(g, 0.035, 0.1, 0.06, 0, -0.05, -0.08, mid);
      box(g, 0.035, 0.012, 0.06, 0, 0.08, -0.03, dark);
      box(g, 0.006, 0.05, 0.02, -0.016, 0.1, -0.03, dark);
      box(g, 0.006, 0.05, 0.02, 0.016, 0.1, -0.03, dark);
      box(g, 0.035, 0.006, 0.02, 0, 0.127, -0.03, dark);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.004, 10), mat(0xff2a2a, 0.2, 0.1, 3));
      dot.position.set(0, 0.105, -0.03);
      g.add(dot);
      muzzle.position.set(0, 0.045, -0.6);
      break;
    }
    case 'gaviao': {
      // Black sniper with red details, long barrel and a big scope.
      const body = mat(0x18191d, 0.4, 0.6);
      const red = mat(0xff2a3a, 0.2, 0.1, 1.8);
      box(g, 0.065, 0.085, 0.5, 0, 0.03, -0.05, body);
      box(g, 0.067, 0.014, 0.4, 0, 0.0, -0.08, red);
      cyl(g, 0.019, 0.55, 0, 0.045, -0.55, dark);
      cyl(g, 0.032, 0.12, 0, 0.045, -0.86, red);
      box(g, 0.055, 0.12, 0.26, 0, -0.01, 0.28, body);
      box(g, 0.057, 0.02, 0.2, 0, 0.03, 0.28, red);
      box(g, 0.04, 0.1, 0.045, 0, -0.045, 0.07, dark, 0.25);
      magMesh = box(g, 0.035, 0.07, 0.07, 0, -0.04, -0.06, mid);
      cyl(g, 0.04, 0.34, 0, 0.13, -0.05, dark);
      cyl(g, 0.05, 0.05, 0, 0.13, -0.24, dark);
      cyl(g, 0.046, 0.04, 0, 0.13, 0.13, dark);
      box(g, 0.012, 0.03, 0.03, 0.035, 0.1, 0.05, red);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.036, 16), mat(0xff5a3a, 0.1, 0.5, 0.6));
      lens.position.set(0, 0.13, 0.151);
      g.add(lens);
      muzzle.position.set(0, 0.045, -0.92);
      break;
    }
    case 'rolo': {
      // Red heavy machine gun with a drum magazine.
      const body = mat(0x9a2620, 0.5, 0.5);
      box(g, 0.1, 0.12, 0.45, 0, 0.02, -0.05, body);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        cyl(g, 0.012, 0.42, Math.cos(a) * 0.025, 0.03 + Math.sin(a) * 0.025, -0.45, dark, 8);
      }
      cyl(g, 0.05, 0.08, 0, 0.03, -0.3, mid);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 18), mat(0x2a2a2a, 0.5, 0.6));
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0, -0.09, -0.08);
      g.add(drum);
      magMesh = drum;
      box(g, 0.075, 0.02, 0.02, 0, -0.09, -0.08, mat(0xffaa2a, 0.3, 0.2, 1.2));
      box(g, 0.05, 0.1, 0.05, 0, -0.07, 0.08, dark, 0.25);
      box(g, 0.06, 0.08, 0.2, 0, 0.0, 0.24, body);
      box(g, 0.012, 0.03, 0.012, 0, 0.095, -0.2, dark);
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
  const [gx, gy, gz, gt, sz, sy] = HOLD[id] ?? [0, -0.04, 0.02, 0.2, null, 0];
  const grip = new THREE.Object3D();
  grip.position.set(gx, gy, gz);
  grip.rotation.x = gt;
  g.add(grip);
  let support: THREE.Object3D | null = null;
  if (sz !== null) {
    support = new THREE.Object3D();
    support.position.set(0, sy, sz);
    g.add(support);
  }
  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root: g, muzzle, mag: magMesh, grip, support, sightY: SIGHT_Y[id] ?? 0.08 };
}
