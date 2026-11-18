import * as THREE from 'three';

export type GraphicsQuality = 'baixa' | 'media' | 'alta';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly sun: THREE.DirectionalLight;
  readonly hemi: THREE.HemisphereLight;
  private quality: GraphicsQuality = 'alta';

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.camera = new THREE.PerspectiveCamera(90, 1, 0.05, 400);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);

    this.scene.background = new THREE.Color(0x9fc4e0);
    this.scene.fog = new THREE.Fog(0xb8cfe0, 60, 220);

    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x5a4a3a, 1.1);
    this.scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.position.set(-40, 70, 30);
    this.sun.castShadow = true;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    const s = this.sun.shadow.camera;
    s.left = -75; s.right = 75; s.top = 75; s.bottom = -75; s.near = 1; s.far = 220;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.setQuality('alta');
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  setQuality(q: GraphicsQuality): void {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio, q === 'alta' ? 2 : q === 'media' ? 1.25 : 1);
    this.renderer.setPixelRatio(dpr);
    const size = q === 'alta' ? 4096 : q === 'media' ? 2048 : 1024;
    this.renderer.shadowMap.enabled = true;
    this.sun.shadow.mapSize.set(size, size);
    this.sun.shadow.map?.dispose();
    this.sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
    this.renderer.shadowMap.type = q === 'baixa' ? THREE.PCFShadowMap : THREE.PCFShadowMap;
    this.resize();
  }

  getQuality(): GraphicsQuality {
    return this.quality;
  }

  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  clearScene(keep: THREE.Object3D[]): void {
    for (const child of [...this.scene.children]) {
      if (keep.includes(child)) continue;
      this.scene.remove(child);
      disposeObject(child);
    }
  }
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
}
