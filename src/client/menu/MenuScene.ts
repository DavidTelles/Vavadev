import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildCharacter, type CharacterRig } from '@client/characters/ProceduralCharacter';
import { APPEARANCES } from '@client/characters/appearances';

/**
 * Source of the 3D model shown for an agent. Today every agent comes from the
 * procedural builder; a GLB loader can implement this later without touching
 * the menu.
 */
export interface CharacterModelProvider {
  build(characterId: string): CharacterRig;
}

export const proceduralProvider: CharacterModelProvider = {
  build: (id) => buildCharacter(APPEARANCES[id] ?? APPEARANCES.david),
};

export type MenuFocus = 'home' | 'agents' | 'panel';

const PINK = 0xff4f9a;
/** Yaw that turns a procedural rig to face +Z (towards the menu camera). */
const FACE_YAW = Math.PI;
const HDR = (hex: number, k: number): THREE.Color => new THREE.Color(hex).multiplyScalar(k);

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  paint(g);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Window grid: 8x8 windows, a few lit pink / warm, the rest dark. */
function windowTexture(rng: () => number): THREE.CanvasTexture {
  const tex = canvasTex(256, 256, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, 256, 256);
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        const r = rng();
        if (r > 0.13) continue;
        g.fillStyle = r < 0.04 ? '#ff5fa8' : r < 0.07 ? '#ffd9ea' : r < 0.1 ? '#b98cff' : '#5a3a52';
        g.globalAlpha = 0.55 + rng() * 0.45;
        g.fillRect(i * 32 + 9, j * 32 + 8, 14, 18);
      }
    }
    g.globalAlpha = 1;
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function signTexture(lines: string[], framed: boolean): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    g.clearRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(12,6,14,0.85)';
    g.fillRect(16, 16, 480, 480);
    g.strokeStyle = '#ff5fa8';
    g.lineWidth = framed ? 10 : 4;
    g.strokeRect(24, 24, 464, 464);
    g.fillStyle = '#ff7ab8';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const size = lines.length > 3 ? 70 : 88;
    g.font = `700 ${size}px Rajdhani, "Segoe UI", sans-serif`;
    lines.forEach((l, i) => g.fillText(l, 256, 256 + (i - (lines.length - 1) / 2) * size * 1.15));
  });
}

function moonTexture(): THREE.CanvasTexture {
  return canvasTex(512, 512, (g) => {
    const glow = g.createRadialGradient(256, 256, 60, 256, 256, 256);
    glow.addColorStop(0, 'rgba(255,110,170,0.55)');
    glow.addColorStop(0.45, 'rgba(160,60,120,0.18)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, 512, 512);
    // Crescent: draw the disc, then carve it with an offset disc.
    const disc = document.createElement('canvas');
    disc.width = disc.height = 512;
    const d = disc.getContext('2d')!;
    d.fillStyle = '#ffd3e6';
    d.beginPath();
    d.arc(256, 256, 120, 0, Math.PI * 2);
    d.fill();
    d.globalCompositeOperation = 'destination-out';
    d.beginPath();
    d.arc(286, 232, 118, 0, Math.PI * 2);
    d.fill();
    g.drawImage(disc, 0, 0);
    g.strokeStyle = 'rgba(255,95,168,0.35)';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(256, 256, 121, 0, Math.PI * 2);
    g.stroke();
  });
}

function cloudTexture(rng: () => number): THREE.CanvasTexture {
  return canvasTex(512, 256, (g) => {
    for (let i = 0; i < 40; i++) {
      const x = 60 + rng() * 392;
      const y = 80 + rng() * 100;
      const r = 30 + rng() * 70;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(58,44,62,0.55)');
      grad.addColorStop(1, 'rgba(30,22,34,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

function emblemTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.strokeStyle = '#ff6fb0';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 128, 96, 0.2, Math.PI * 2 - 0.2);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.arc(128, 128, 110, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#ffe3f0';
    g.beginPath();
    g.moveTo(140, 44);
    g.lineTo(96, 136);
    g.lineTo(124, 136);
    g.lineTo(110, 212);
    g.lineTo(162, 112);
    g.lineTo(132, 112);
    g.closePath();
    g.fill();
  });
}

function skyTexture(): THREE.CanvasTexture {
  return canvasTex(16, 512, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0c0a10');
    grad.addColorStop(0.35, '#2a2230');
    grad.addColorStop(0.55, '#4a3a4a');
    grad.addColorStop(0.62, '#5a4252');
    grad.addColorStop(0.75, '#2a2029');
    grad.addColorStop(1, '#0a080c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 16, 512);
  });
}

interface CityLayer { count: number; zMin: number; zMax: number; xSpan: number; hMin: number; hMax: number; wMin: number; wMax: number }

/**
 * Main-menu backdrop: a rainy, ruined neon city at night with a crescent moon,
 * wet reflective ground, and the selected agent standing in the foreground.
 * Renders with its own scene/camera through the shared WebGLRenderer.
 */
export class MenuScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly reflector: Reflector;
  private readonly rain: THREE.LineSegments;
  private readonly rainPos: Float32Array;
  private readonly rainSpeed: Float32Array;
  private readonly beaconMat: THREE.MeshBasicMaterial;
  private readonly clouds: THREE.Sprite[] = [];
  private readonly rimLight: THREE.PointLight;
  private readonly agentRoot = new THREE.Group();
  private rig: CharacterRig | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private agentId = '';
  private swapT = 1;
  private focus: MenuFocus = 'home';
  private focusX = 0;
  private mouseX = 0;
  private mouseY = 0;
  private camX = 0;
  private camY = 0;
  private time = 0;
  private rafId = 0;
  private running = false;
  private last = 0;
  private readonly disposables: { dispose(): void }[] = [];

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly provider: CharacterModelProvider = proceduralProvider) {
    const rng = mulberry(7);
    const sky = skyTexture();
    this.scene.background = sky;
    this.scene.fog = new THREE.FogExp2(0x3b2f3d, 0.0062);
    this.disposables.push(sky);

    this.scene.add(new THREE.HemisphereLight(0x6a5878, 0x0a0810, 0.9));
    const key = new THREE.DirectionalLight(0x9aa6c8, 1.3);
    key.position.set(-4, 5, 8);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xff6fa8, 3.2);
    rim.position.set(6, 6, -6);
    this.scene.add(rim);
    this.rimLight = new THREE.PointLight(0xff4f9a, 6, 9, 1.6);
    this.rimLight.position.set(2.6, 2.4, 0.6);
    this.scene.add(this.rimLight);

    this.buildCity(rng);
    this.buildSkyProps(rng);
    this.buildForeground(rng);

    // Wet ground: a real planar reflection, darkened by a translucent sheet on top.
    this.reflector = new Reflector(new THREE.PlaneGeometry(900, 900), {
      textureWidth: Math.floor(window.innerWidth * 0.5),
      textureHeight: Math.floor(window.innerHeight * 0.5),
      color: new THREE.Color(0x6a6070),
      clipBias: 0.003,
    });
    this.reflector.rotation.x = -Math.PI / 2;
    this.reflector.position.y = -0.45;
    this.scene.add(this.reflector);
    const sheetMat = new THREE.MeshStandardMaterial({ color: 0x07060a, transparent: true, opacity: 0.5, roughness: 0.6 });
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), sheetMat);
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.y = -0.42;
    this.scene.add(sheet);

    // Rain.
    const N = 2600;
    this.rainPos = new Float32Array(N * 6);
    this.rainSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      this.resetDrop(i, rng, true);
      this.rainSpeed[i] = 18 + rng() * 10;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3).setUsage(THREE.DynamicDrawUsage));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xb4a2c4, transparent: true, opacity: 0.2, fog: false }));
    this.rain.frustumCulled = false;
    this.scene.add(this.rain);

    const beacon = new THREE.MeshBasicMaterial({ color: HDR(PINK, 4) });
    this.beaconMat = beacon;
    this.addBeacons(beacon);

    this.scene.add(this.agentRoot);

    this.camera.position.set(0, 1.45, 5.2);
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.9);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener('resize', this.resize);
    window.addEventListener('mousemove', this.onMouse);
    this.resize();
  }

  // ---------- construction ----------

  private buildCity(rng: () => number): void {
    const winTex = windowTexture(rng);
    this.disposables.push(winTex);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0d0b11,
      roughness: 0.9,
      emissive: 0xffffff,
      emissiveMap: winTex,
      emissiveIntensity: 1.25,
    });
    const neonMat = new THREE.MeshBasicMaterial({ color: HDR(PINK, 1.5) });
    const layers: CityLayer[] = [
      { count: 40, zMin: -55, zMax: -85, xSpan: 90, hMin: 3, hMax: 9, wMin: 6, wMax: 14 },
      { count: 70, zMin: -100, zMax: -180, xSpan: 170, hMin: 6, hMax: 20, wMin: 8, wMax: 18 },
      { count: 100, zMin: -200, zMax: -360, xSpan: 320, hMin: 12, hMax: 42, wMin: 10, wMax: 26 },
    ];
    const geos: THREE.BufferGeometry[] = [];
    const neon: THREE.BufferGeometry[] = [];
    const addBuilding = (x: number, z: number, w: number, d: number, h: number, stepped: boolean): void => {
      const tiers = stepped ? 3 : 1;
      let y = 0;
      let tw = w;
      let td = d;
      for (let k = 0; k < tiers; k++) {
        const th = stepped ? h * (k === 0 ? 0.62 : k === 1 ? 0.24 : 0.14) : h;
        const g = new THREE.BoxGeometry(tw, th, td);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const ox = Math.floor(rng() * 8) / 8;
        const oy = Math.floor(rng() * 8) / 8;
        for (let i = 0; i < uv.count; i++) {
          uv.setXY(i, uv.getX(i) * (Math.max(tw, td) / 1.1 / 8) + ox, uv.getY(i) * (th / 1.6 / 8) + oy);
        }
        g.translate(x, y + th / 2, z);
        geos.push(g);
        y += th;
        tw *= 0.72;
        td *= 0.72;
      }
      if (rng() < 0.12) {
        const sh = Math.min(10, h * 0.3);
        const strip = new THREE.BoxGeometry(0.25, sh, 0.2);
        strip.translate(x + (rng() - 0.5) * w * 0.7, h * 0.3 + rng() * h * 0.4, z + d / 2 + 0.15);
        neon.push(strip);
      }
    };
    for (const L of layers) {
      for (let i = 0; i < L.count; i++) {
        const w = L.wMin + rng() * (L.wMax - L.wMin);
        const d = L.wMin + rng() * (L.wMax - L.wMin);
        const h = L.hMin + (L.hMax - L.hMin) * Math.pow(rng(), 1.7);
        const x = (rng() * 2 - 1) * L.xSpan;
        const z = L.zMin + (L.zMax - L.zMin) * rng();
        addBuilding(x, z, w, d, h, h > L.hMax * 0.75);
      }
    }
    // Landmark towers, framing the composition like the reference art.
    addBuilding(-22, -150, 12, 12, 78, true);
    addBuilding(-4, -250, 12, 12, 112, true);
    addBuilding(62, -130, 18, 14, 58, false);
    addBuilding(-62, -120, 14, 12, 44, false);
    addBuilding(30, -300, 14, 14, 95, true);
    const city = new THREE.Mesh(mergeGeometries(geos), mat);
    const neonMesh = new THREE.Mesh(mergeGeometries(neon), neonMat);
    for (const g of [...geos, ...neon]) g.dispose();
    this.scene.add(city, neonMesh);

    // Neon signs on the near buildings.
    const signs: [string[], number, number, number, number, number, boolean][] = [
      [['AINDA', 'ESTAMOS', 'AQUI'], -14, 9, -54, 5, 0.1, false],
      [['SILÊNCIO', 'TAMBÉM É', 'UMA ARMA'], 54, 30, -122.8, 11, -0.12, true],
    ];
    for (const [lines, x, y, z, s, ry, framed] of signs) {
      const tex = signTexture(lines, framed);
      this.disposables.push(tex);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(s, s),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: HDR(0xffffff, 1.8) }),
      );
      m.position.set(x, y, z);
      m.rotation.y = ry;
      this.scene.add(m);
    }
  }

  private buildSkyProps(rng: () => number): void {
    const moonTex = moonTexture();
    const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTex, fog: false, depthWrite: false, color: HDR(0xffffff, 1.4) }));
    moon.position.set(110, 62, -330);
    moon.scale.set(105, 105, 1);
    this.scene.add(moon);

    const emblemTex = emblemTexture();
    const emblem = new THREE.Sprite(new THREE.SpriteMaterial({ map: emblemTex, transparent: true, color: HDR(0xffffff, 2.2), fog: false }));
    emblem.position.set(-22, 52, -143);
    emblem.scale.set(13, 13, 1);
    this.scene.add(emblem);

    const cloudTex = cloudTexture(rng);
    this.disposables.push(moonTex, emblemTex, cloudTex);
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
      c.position.set(-200 + rng() * 420, 70 + rng() * 60, -300 - rng() * 30);
      c.scale.set(160 + rng() * 120, 60 + rng() * 40, 1);
      this.clouds.push(c);
      this.scene.add(c);
    }
  }

  private buildForeground(rng: () => number): void {
    const dark = new THREE.MeshStandardMaterial({ color: 0x121016, roughness: 0.75, metalness: 0.15 });
    const wet = new THREE.MeshStandardMaterial({ color: 0x18151d, roughness: 0.32, metalness: 0.35 });
    const geos: THREE.BufferGeometry[] = [];
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0): void => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.rotateX(rx);
      g.rotateY(ry);
      g.rotateZ(rz);
      g.translate(x, y, z);
      geos.push(g);
    };
    // Broken walls on the left.
    box(2.2, 6, 0.6, -7.5, 2.6, -4, 0, 0.3, 0.08);
    box(1.6, 3.4, 0.6, -5.4, 1.3, -6.5, 0, -0.2, -0.12);
    box(3.5, 0.5, 0.5, -6.2, 4.6, -4.4, 0, 0.3, 0.4);
    box(0.4, 9, 0.4, -10, 4, -9, 0, 0, 0.1);
    for (let i = 0; i < 7; i++) box(0.6 + rng(), 0.4 + rng() * 0.6, 0.6 + rng(), -6 + rng() * 4, -0.2, -2 - rng() * 6, rng(), rng(), rng());
    // Lattice tower on the right.
    for (let k = 0; k < 4; k++) {
      const sx = k % 2 ? 1 : -1;
      const sz = k < 2 ? 1 : -1;
      box(0.3, 30, 0.3, 26 + sx * 1.6, 14.5, -30 + sz * 1.6);
    }
    for (let y = 2; y < 30; y += 3.2) {
      box(3.5, 0.18, 0.18, 26, y, -28.4);
      box(4.6, 0.14, 0.14, 26, y + 1.6, -28.4, 0, 0, y % 2 ? 0.75 : -0.75);
    }
    // Railing behind the agent.
    for (let i = 0; i < 9; i++) box(0.08, 1.1, 0.08, -1.5 + i * 1.1, 0.55, -0.9);
    box(9.6, 0.08, 0.08, 2.9, 1.08, -0.9);
    const ruins = new THREE.Mesh(mergeGeometries(geos), dark);
    for (const g of geos) g.dispose();
    this.scene.add(ruins);

    const slab = new THREE.Mesh(new THREE.BoxGeometry(16, 0.6, 7), wet);
    slab.position.set(2, -0.3, 2.6);
    this.scene.add(slab);
  }

  private addBeacons(mat: THREE.MeshBasicMaterial): void {
    const g = new THREE.SphereGeometry(0.6, 8, 6);
    const spots: [number, number, number][] = [[-22, 79, -150], [-4, 113, -250], [26, 30.4, -30], [62, 59, -130]];
    for (const [x, y, z] of spots) {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      this.scene.add(m);
    }
    this.disposables.push(g);
  }

  private resetDrop(i: number, rng: () => number = Math.random, anyHeight = false): void {
    const x = -30 + rng() * 60;
    const z = -40 + rng() * 46;
    const y = anyHeight ? rng() * 26 : 22 + rng() * 6;
    const p = this.rainPos;
    const o = i * 6;
    p[o] = x; p[o + 1] = y; p[o + 2] = z;
    p[o + 3] = x + 0.06; p[o + 4] = y - 0.55; p[o + 5] = z;
  }

  // ---------- agent ----------

  setAgent(id: string): void {
    if (id === this.agentId) return;
    this.agentId = id;
    if (this.rig) {
      this.agentRoot.remove(this.rig.root);
      this.mixer?.stopAllAction();
      this.rig.dispose();
    }
    const rig = this.provider.build(id);
    rig.root.add(rig.mesh);
    rig.mesh.frustumCulled = false;
    this.rig = rig;
    this.mixer = new THREE.AnimationMixer(rig.mesh);
    const clip = rig.clips.find((c) => c.name === 'idle') ?? rig.clips.find((c) => c.name === 'pose');
    if (clip) this.mixer.clipAction(clip).setLoop(THREE.LoopRepeat, Infinity).play();
    this.agentRoot.add(rig.root);
    this.swapT = 0;
  }

  private readonly portraits = new Map<string, string>();

  /** Head-and-shoulders portrait of an agent as a PNG data URL (rendered once, cached). */
  portrait(id: string): string {
    const hit = this.portraits.get(id);
    if (hit) return hit;
    const W = 164;
    const H = 200;
    const rig = this.provider.build(id);
    rig.root.add(rig.mesh);
    const mixer = new THREE.AnimationMixer(rig.mesh);
    const clip = rig.clips.find((c) => c.name === 'pose');
    if (clip) mixer.clipAction(clip).play();
    mixer.update(0.01);
    rig.root.rotation.y = FACE_YAW + 0.35;
    rig.root.updateMatrixWorld(true);
    const sc = new THREE.Scene();
    sc.add(rig.root);
    sc.add(new THREE.HemisphereLight(0xd8cce0, 0x1a1020, 1.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-1, 2, 3);
    sc.add(key);
    const rim = new THREE.DirectionalLight(0xff5fa8, 4);
    rim.position.set(2, 1, -2);
    sc.add(rim);
    const head = rig.bones.head.getWorldPosition(new THREE.Vector3());
    const cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 20);
    cam.position.set(head.x, head.y + 0.12, head.z + 1.05);
    cam.lookAt(head.x, head.y + 0.02, head.z);

    const rt = new THREE.WebGLRenderTarget(W, H, { samples: 4 });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    const r = this.renderer;
    const prevAlpha = r.getClearAlpha();
    const prevColor = r.getClearColor(new THREE.Color());
    r.setClearColor(0x000000, 0);
    r.setRenderTarget(rt);
    r.clear();
    r.render(sc, cam);
    const buf = new Uint8Array(W * H * 4);
    r.readRenderTargetPixels(rt, 0, 0, W, H, buf);
    r.setRenderTarget(null);
    r.setClearColor(prevColor, prevAlpha);

    const tmp = document.createElement('canvas');
    tmp.width = W;
    tmp.height = H;
    const img = tmp.getContext('2d')!.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    tmp.getContext('2d')!.putImageData(img, 0, 0);
    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const g = out.getContext('2d')!;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a1d2c');
    bg.addColorStop(1, '#0c0a10');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.drawImage(tmp, 0, 0);
    const url = out.toDataURL('image/png');

    mixer.stopAllAction();
    rig.dispose();
    rt.dispose();
    this.portraits.set(id, url);
    return url;
  }

  setFocus(f: MenuFocus): void {
    this.focus = f;
  }

  // ---------- loop ----------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.resize();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.update(dt);
    this.composer.render(dt);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private update(dt: number): void {
    this.time += dt;
    // Rain fall.
    const p = this.rainPos;
    for (let i = 0; i < this.rainSpeed.length; i++) {
      const o = i * 6;
      const v = this.rainSpeed[i] * dt;
      p[o + 1] -= v; p[o + 4] -= v;
      p[o] += v * 0.05; p[o + 3] += v * 0.05;
      if (p[o + 4] < -0.45) this.resetDrop(i);
    }
    (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    for (const c of this.clouds) {
      c.position.x += dt * 1.6;
      if (c.position.x > 260) c.position.x = -260;
    }
    const blink = Math.sin(this.time * 3.1) > 0.2 ? 4 : 0.6;
    this.beaconMat.color.copy(HDR(PINK, blink));

    // Agent placement and swap "glitch".
    const targetX = this.focus === 'agents' ? 1.75 : this.focus === 'panel' ? 1.95 : 0.85;
    this.focusX += (targetX - this.focusX) * Math.min(1, dt * 4);
    this.agentRoot.position.set(this.focusX, 0, 2.4);
    this.agentRoot.rotation.y = FACE_YAW - 0.55 + Math.sin(this.time * 0.35) * 0.03;
    if (this.swapT < 1) {
      this.swapT = Math.min(1, this.swapT + dt * 2.5);
      const k = 1 - this.swapT;
      this.agentRoot.scale.set(1 + k * 0.08 * Math.sin(this.time * 90), 1 - k * 0.04, 1);
      this.rimLight.intensity = 6 + k * 30;
    } else {
      this.agentRoot.scale.set(1, 1, 1);
      this.rimLight.intensity = 6 + Math.sin(this.time * 1.7) * 0.8;
    }
    this.mixer?.update(dt);

    // Mouse parallax.
    this.camX += (this.mouseX * 0.35 - this.camX) * Math.min(1, dt * 3);
    this.camY += (-this.mouseY * 0.18 - this.camY) * Math.min(1, dt * 3);
    this.camera.position.set(this.camX, 1.45 + this.camY, 6.4);
    this.camera.lookAt(this.camX * 0.4, 1.2, 2.4);
  }

  private onMouse = (e: MouseEvent): void => {
    this.mouseX = e.clientX / window.innerWidth - 0.5;
    this.mouseY = e.clientY / window.innerHeight - 0.5;
  };

  resize = (): void => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    // Keep the agent framed on narrow screens.
    this.camera.fov = w / h < 1.2 ? 50 : 34;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w / 2, h / 2);
    this.reflector.getRenderTarget().setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
  };

  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('mousemove', this.onMouse);
    this.mixer?.stopAllAction();
    this.rig?.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.reflector.dispose();
    this.composer.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
