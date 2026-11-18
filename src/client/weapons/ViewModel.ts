import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWeaponModel, type WeaponModel } from './WeaponModels';

export interface ViewModelState {
  speed: number;
  grounded: boolean;
  aiming: boolean;
  reloadT: number;
  equipT: number;
  lookDX: number;
  lookDY: number;
  planting: boolean;
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
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
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

    const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    this.flash = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), flashMat);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 3);
    this.scene.add(this.flashLight);

    this.armR = this.buildArm(0x2a3a55, 0xd9a07a);
    this.armL = this.buildArm(0x2a3a55, 0xd9a07a);
    this.weaponPivot.add(this.armR, this.armL);
    this.armR.position.set(0.02, -0.07, 0.17);
    this.armR.rotation.set(0.35, 0.15, 0);
    this.armL.position.set(-0.07, -0.05, -0.12);
    this.armL.rotation.set(0.6, -0.5, 0.2);
  }

  private buildArm(sleeve: number, skin: number): THREE.Group {
    const g = new THREE.Group();
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.4, 10), new THREE.MeshStandardMaterial({ color: sleeve, roughness: 0.8 }));
    s.rotation.x = Math.PI / 2;
    s.position.z = 0.22;
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.07, 0.1), new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.7 }));
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.05, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.6 }));
    wrist.rotation.x = Math.PI / 2;
    wrist.position.z = 0.04;
    g.add(s, glove, wrist);
    return g;
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
    for (const arm of [this.armL, this.armR]) {
      ((arm.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(sleeve);
      ((arm.children[2] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.setHex(skin);
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
    m.muzzle.add(this.flash);
    this.flash.position.set(0, 0, -0.06);
    const melee = id === 'faca';
    this.armL.visible = !melee && id !== 'faisca' && id !== 'trovao' && id !== 'laminas';
  }

  get weaponId(): string {
    return this.currentId;
  }

  fire(): void {
    const melee = this.currentId === 'faca' || this.currentId === 'laminas';
    this.kick = melee ? 0.12 : this.currentId === 'gaviao' || this.currentId === 'marreta' || this.currentId === 'trovao' ? 0.09 : 0.035;
    this.kickRot = melee ? -0.6 : this.kick * 2.2;
    if (!melee) {
      this.flashT = 0.05;
      this.flash.rotation.z = Math.random() * Math.PI;
      const s = 0.8 + Math.random() * 0.6;
      this.flash.scale.set(s, s, s);
    }
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, st: ViewModelState): void {
    const aimTarget = st.aiming && (this.currentId === 'gaviao' || this.currentId === 'guardiao') ? 1 : 0;
    this.aimT += (aimTarget - this.aimT) * Math.min(1, dt * 14);
    const moving = st.grounded ? Math.min(1, st.speed / 6.6) : 0;
    this.bobT += dt * (4 + st.speed * 1.2);
    const bobX = Math.sin(this.bobT) * 0.012 * moving;
    const bobY = Math.abs(Math.cos(this.bobT)) * 0.012 * moving;
    this.swayX += (-st.lookDX * 0.0006 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (st.lookDY * 0.0006 - this.swayY) * Math.min(1, dt * 10);
    this.kick += (0 - this.kick) * Math.min(1, dt * 14);
    this.kickRot += (0 - this.kickRot) * Math.min(1, dt * 12);

    const reload = st.reloadT > 0 && st.reloadT < 1 ? Math.sin(st.reloadT * Math.PI) : 0;
    // equipT counts down to 0 while drawing the weapon: 1 = fully lowered, 0 = ready.
    const equip = Math.min(1, st.equipT / 0.45);
    const plant = st.planting ? 1 : 0;

    const baseX = 0.2 * (1 - this.aimT);
    const baseY = -0.19 + 0.08 * this.aimT;
    const baseZ = -0.42 + 0.1 * this.aimT;
    this.holder.position.set(baseX + bobX + this.swayX, baseY - bobY + this.swayY - reload * 0.08 - equip * 0.25 - plant * 0.3, baseZ + this.kick);
    this.holder.rotation.set(this.kickRot + reload * 0.7 - equip * 0.8, this.swayX * 2, reload * 0.4);
    if (this.model?.mag) this.model.mag.visible = !(st.reloadT > 0.3 && st.reloadT < 0.65);
    this.holder.visible = this.visible && this.aimT < 0.95;

    this.flashT -= dt;
    const fm = this.flash.material as THREE.MeshBasicMaterial;
    fm.opacity = this.flashT > 0 ? 1 : 0;
    if (this.model) {
      this.model.muzzle.getWorldPosition(this.flashLight.position);
      this.flashLight.intensity = this.flashT > 0 ? 6 : 0;
    }
  }
}
