import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildWeaponModel, type WeaponModel } from './WeaponModels';

export interface ViewModelState {
  speed: number;
  grounded: boolean;
  aiming: boolean;
  reloadT: number;
  equipT: number;
  /** Total equip duration of the current weapon (s). */
  equipDur: number;
  /** Weapon has a telescopic scope (viewmodel hides when fully scoped). */
  scope: boolean;
  lookDX: number;
  lookDY: number;
  planting: boolean;
}

interface Hand {
  root: THREE.Group;
  fore: THREE.Group;
  skin: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
}

/** Star-shaped muzzle flash sprite: hot core, orange spikes, soft falloff. */
function makeFlashTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.translate(64, 64);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(255,255,240,1)');
  grad.addColorStop(0.18, 'rgba(255,220,120,0.95)');
  grad.addColorStop(0.5, 'rgba(255,130,30,0.45)');
  grad.addColorStop(1, 'rgba(255,80,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  const spikes = 7;
  for (let i = 0; i <= spikes * 2; i++) {
    const ang = (i / (spikes * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? 62 : 20;
    g.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
  }
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(65, 1, 0.01, 10);
  private readonly holder = new THREE.Group();
  private readonly weaponPivot = new THREE.Group();
  private model: WeaponModel | null = null;
  private readonly models = new Map<string, WeaponModel>();
  private readonly flash: THREE.Mesh;
  private readonly flashLight: THREE.PointLight;
  private currentId = '';
  private bobT = 0;
  private kick = 0;
  private kickRot = 0;
  private swayX = 0;
  private swayY = 0;
  private flashT = 0;
  private aimT = 0;
  private boltT = 0;
  private stabT = 0;
  private stabCombo = 0;
  private equipStyle: 'rifle' | 'pistol' | 'knife' | 'heavy' = 'rifle';
  private readonly handL: Hand;
  private readonly handR: Hand;
  /** Shoulder targets in viewmodel-camera space; forearms point at them. */
  private readonly shoulderR = new THREE.Vector3(0.3, -0.55, 0.25);
  private readonly shoulderL = new THREE.Vector3(-0.28, -0.6, 0.2);
  private readonly tmp = new THREE.Vector3();
  visible = true;

  constructor() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a4a, 1.6));
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
    key.position.set(-1, 2, 1);
    this.scene.add(key);
    this.scene.add(this.camera);
    this.camera.add(this.holder);
    this.holder.add(this.weaponPivot);
    this.weaponPivot.scale.setScalar(0.8);

    const flashMat = new THREE.MeshBasicMaterial({
      map: makeFlashTexture(), color: 0xffe0a0, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.26), flashMat);
    // Side-on flame tongues so the flash also reads from the hip angle.
    for (const ry of [Math.PI / 2, 0]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.34), flashMat);
      side.rotation.set(Math.PI / 2, ry, 0);
      side.position.z = -0.12;
      this.flash.add(side);
    }
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3);
    this.scene.add(this.flashLight);

    this.handR = this.buildHand(1);
    this.handL = this.buildHand(-1);
  }

  /**
   * Procedural gloved hand wrapped around a grip whose axis is local Y, centred
   * at the origin. `side` = 1 right hand (palm on +X), -1 left hand (mirrored).
   * The forearm is a separate child that is aimed at a shoulder point each frame.
   */
  private buildHand(side: 1 | -1): Hand {
    const root = new THREE.Group();
    // Tan tactical glove so the hand reads clearly against dark gun metal.
    const glove = new THREE.MeshStandardMaterial({ color: 0x8a7155, roughness: 0.85, metalness: 0.0 });
    const knuckle = new THREE.MeshStandardMaterial({ color: 0x4a3c2e, roughness: 0.7, metalness: 0.05 });
    const rb = (w: number, h: number, d: number): THREE.BufferGeometry => new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.45);
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a07a, roughness: 0.6 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2a3a55, roughness: 0.85 });
    const add = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x * side, y, z);
      mesh.rotation.set(rx, ry * side, rz * side);
      root.add(mesh);
      return mesh;
    };
    // Palm / back of the hand on the outer side of the grip.
    add(rb(0.03, 0.088, 0.078), glove, 0.036, -0.004, 0.012);
    add(rb(0.012, 0.07, 0.05), knuckle, 0.053, 0.0, 0.0);
    // Four fingers: across the front of the grip, then curling around the far side.
    for (let i = 0; i < 4; i++) {
      const y = 0.03 - i * 0.02;
      const len = i === 3 ? 0.044 : 0.054;
      add(rb(len, 0.017, 0.021), glove, 0.036 - len / 2 + 0.006, y, -0.035);
      add(rb(0.018, 0.016, 0.03), glove, 0.036 - len - 0.0, y, -0.02, 0, 0.25, 0);
    }
    // Thumb along the far side, pointing forward.
    add(rb(0.02, 0.021, 0.06), glove, -0.016, 0.045, -0.012, 0, -0.35, 0);
    // Forearm: cuff of skin + tapered sleeve, built along +Z so lookAt aims it.
    const fore = new THREE.Group();
    fore.position.set(0.036 * side, -0.012, 0.045);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.05, 12), skin);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.z = 0.02;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.05, 0.5, 12), sleeve);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.29;
    fore.add(cuff, arm);
    root.add(fore);
    return { root, fore, skin, sleeve };
  }

  /** Metallic gun materials need reflections; give the viewmodel scene a small studio environment. */
  useRenderer(renderer: THREE.WebGLRenderer): void {
    if (this.scene.environment) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.scene.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.7;
    room.dispose();
    pmrem.dispose();
  }

  setArmColors(sleeve: number, skin: number): void {
    for (const h of [this.handL, this.handR]) {
      h.sleeve.color.setHex(sleeve);
      h.skin.color.setHex(skin);
    }
  }

  setWeapon(id: string): void {
    if (id === this.currentId) return;
    this.currentId = id;
    if (this.model) this.weaponPivot.remove(this.model.root);
    let m = this.models.get(id);
    if (!m) {
      m = buildWeaponModel(id);
      m.root.traverse((o) => { o.castShadow = false; });
      this.models.set(id, m);
    }
    this.model = m;
    this.weaponPivot.add(m.root);
    this.weaponPivot.position.set(0, 0, 0);
    this.weaponPivot.rotation.set(0, 0, 0);
    this.boltT = 0;
    this.stabT = 0;
    this.equipStyle = id === 'faca' || id === 'laminas' ? 'knife'
      : id === 'faisca' || id === 'trovao' ? 'pistol'
      : id === 'rolo' || id === 'marreta' ? 'heavy' : 'rifle';
    m.muzzle.add(this.flash);
    this.flash.position.set(0, 0, -0.06);
    m.grip.add(this.handR.root);
    const L = this.handL.root;
    if (m.support) {
      // Support hand under the handguard: grip axis along the barrel, palm below.
      m.support.add(L);
      L.position.set(0, -0.012, 0);
      L.rotation.set(Math.PI / 2, Math.PI / 2, 0);
      L.visible = true;
    } else if (id === 'faisca' || id === 'trovao') {
      // Pistol cup grip: left hand wraps over the right hand's fingers.
      m.grip.add(L);
      L.position.set(-0.018, -0.012, -0.012);
      L.rotation.set(0, 0.35, 0);
      L.visible = true;
    } else {
      m.grip.add(L);
      L.visible = false;
    }
  }

  /** Point each forearm from its wrist at the matching shoulder (camera space). */
  private aimForearms(): void {
    this.camera.updateMatrixWorld(true);
    for (const [h, sh] of [[this.handR, this.shoulderR], [this.handL, this.shoulderL]] as const) {
      if (!h.root.visible) continue;
      this.tmp.copy(sh);
      this.camera.localToWorld(this.tmp);
      h.fore.lookAt(this.tmp);
    }
  }

  get weaponId(): string {
    return this.currentId;
  }

  /** Gun shot: kick back + muzzle rise scaled by recoil (rad per shot), plus muzzle flash. */
  fire(recoil = 0.015): void {
    const k = Math.min(1, recoil / (6 * Math.PI / 180));
    this.kick = Math.min(0.12, this.kick + 0.025 + k * 0.07);
    this.kickRot = Math.min(0.45, this.kickRot + 0.05 + k * 0.3);
    this.flashT = 0.055;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 0.9 + Math.random() * 0.7 + k * 0.6;
    this.flash.scale.set(s, s, s);
    if (this.currentId === 'gaviao') this.boltT = 0.95;
  }

  /** Knife attack; alternates a forward thrust (0) and a sideways slash (1). */
  stab(combo: number): void {
    this.stabT = 0.32;
    this.stabCombo = combo;
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, st: ViewModelState): void {
    const melee = this.equipStyle === 'knife';
    const aimTarget = st.aiming && !melee && st.equipT <= 0 && st.reloadT <= 0 ? 1 : 0;
    this.aimT += (aimTarget - this.aimT) * Math.min(1, dt * 13);
    const steady = 1 - 0.85 * this.aimT;
    const moving = st.grounded ? Math.min(1, st.speed / 6.6) : 0;
    this.bobT += dt * (4 + st.speed * 1.2);
    const bobX = Math.sin(this.bobT) * 0.012 * moving * steady;
    const bobY = Math.abs(Math.cos(this.bobT)) * 0.012 * moving * steady;
    this.swayX += (-st.lookDX * 0.0006 * steady - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (st.lookDY * 0.0006 * steady - this.swayY) * Math.min(1, dt * 10);
    this.kick += (0 - this.kick) * Math.min(1, dt * 12);
    this.kickRot += (0 - this.kickRot) * Math.min(1, dt * 10);

    const reload = st.reloadT > 0 && st.reloadT < 1 ? Math.sin(st.reloadT * Math.PI) : 0;
    // Equip: progress 0 -> 1 over the weapon's equip time; gun rises from below with an overshoot.
    const prog = st.equipDur > 0 ? 1 - Math.min(1, st.equipT / st.equipDur) : 1;
    const c1 = 1.4, c3 = c1 + 1;
    const ease = prog >= 1 ? 1 : 1 + c3 * Math.pow(prog - 1, 3) + c1 * Math.pow(prog - 1, 2);
    const lowered = 1 - ease;
    const plant = st.planting ? 1 : 0;

    // Hip pose -> ADS pose (sight line centred on screen).
    const sightY = (this.model?.sightY ?? 0.08) * this.weaponPivot.scale.y;
    const a = this.aimT;
    const baseX = 0.17 * (1 - a);
    const baseY = -0.15 * (1 - a) + (-sightY) * a;
    const baseZ = -0.44 * (1 - a) - 0.3 * a;
    this.holder.position.set(
      baseX + bobX + this.swayX + lowered * 0.08,
      baseY - bobY + this.swayY - reload * 0.08 - lowered * 0.32 - plant * 0.3,
      baseZ + this.kick * (1 - a * 0.5),
    );
    this.holder.rotation.set(
      this.kickRot * (1 - a * 0.6) + reload * 0.7 - lowered * 0.9,
      this.swayX * 2 * steady + lowered * 0.35,
      reload * 0.4 + lowered * 0.5,
    );

    // Per-style weapon flourishes on the pivot (equip, bolt cycle, knife attacks).
    const pv = this.weaponPivot;
    pv.position.set(0, 0, 0);
    pv.rotation.set(0, 0, 0);
    if (prog < 1) {
      if (this.equipStyle === 'knife') {
        pv.rotation.z = (1 - Math.min(1, prog / 0.7)) * Math.PI * 2;
      } else if (this.equipStyle === 'rifle' || this.equipStyle === 'heavy') {
        // Charging-handle pull near the end of the draw.
        const t = (prog - 0.6) / 0.25;
        if (t > 0 && t < 1) {
          pv.position.z = Math.sin(t * Math.PI) * 0.03;
          pv.rotation.z = Math.sin(t * Math.PI) * 0.25;
        }
      } else {
        // Pistol: slide rack tilt.
        const t = (prog - 0.55) / 0.3;
        if (t > 0 && t < 1) pv.rotation.y = Math.sin(t * Math.PI) * 0.35;
      }
    }
    if (this.boltT > 0) {
      this.boltT = Math.max(0, this.boltT - dt);
      const t = 1 - this.boltT / 0.95;
      const k = t > 0.15 && t < 0.85 ? Math.sin(((t - 0.15) / 0.7) * Math.PI) : 0;
      pv.rotation.z += k * 0.45;
      pv.position.y -= k * 0.03;
    }
    if (this.stabT > 0) {
      this.stabT = Math.max(0, this.stabT - dt);
      const t = 1 - this.stabT / 0.32;
      const k = Math.sin(Math.min(1, t * 1.6) * Math.PI);
      if (this.stabCombo === 0) {
        pv.position.z -= k * 0.22;
        pv.position.x -= k * 0.08;
        pv.rotation.x -= k * 0.25;
      } else {
        const sw = Math.min(1, t * 1.6);
        pv.position.x += (0.12 - sw * 0.3) * k;
        pv.position.z -= k * 0.1;
        pv.rotation.y += (sw - 0.5) * 1.4 * k;
        pv.rotation.z += (0.9 - sw * 1.8) * k;
      }
    }

    if (this.model?.mag) this.model.mag.visible = !(st.reloadT > 0.3 && st.reloadT < 0.65);
    this.holder.visible = this.visible && !(st.scope && this.aimT > 0.85);
    this.aimForearms();

    this.flashT -= dt;
    const fm = this.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = this.flashT > 0 ? Math.min(1, this.flashT / 0.03) : 0;
    this.flash.visible = this.holder.visible;
    if (this.model) {
      this.model.muzzle.getWorldPosition(this.flashLight.position);
      this.flashLight.intensity = this.flashT > 0 ? 8 : 0;
    }
  }

  get aimProgress(): number {
    return this.aimT;
  }
}
