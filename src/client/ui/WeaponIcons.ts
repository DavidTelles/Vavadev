import * as THREE from 'three';
import { buildWeaponModel } from '@client/weapons/WeaponModels';

const W = 256;
const H = 96;
const cache = new Map<string, string>();
const flat = new THREE.MeshBasicMaterial({ color: 0xffffff });

/**
 * Side-view white silhouette of a weapon model as a PNG data URL, rendered
 * once per id with the game renderer. Used as a CSS mask so the HUD can tint it.
 * Small weapons keep a minimum frame so a pistol reads smaller than a rifle.
 */
export function weaponIcon(renderer: THREE.WebGLRenderer, id: string): string {
  const hit = cache.get(id);
  if (hit) return hit;

  const model = buildWeaponModel(id);
  model.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.material = flat;
  });
  const scene = new THREE.Scene();
  scene.add(model.root);
  const bb = new THREE.Box3().setFromObject(model.root);
  const c = bb.getCenter(new THREE.Vector3());
  const size = bb.getSize(new THREE.Vector3());
  const aspect = W / H;
  const halfW = Math.max(size.z / 2, (size.y / 2) * aspect, 0.2) * 1.06;
  const halfH = halfW / aspect;
  // Camera on -X looking +X: the muzzle (-Z) points left in the image.
  const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, 10);
  cam.position.set(c.x - 2, c.y, c.z);
  cam.lookAt(c);

  const rt = new THREE.WebGLRenderTarget(W, H);
  const prevTarget = renderer.getRenderTarget();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(W * H * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  rt.dispose();
  model.root.traverse((o) => (o as THREE.Mesh).geometry?.dispose());

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W * 4;
    img.data.set(px.subarray(src, src + W * 4), y * W * 4);
  }
  ctx.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png');
  cache.set(id, url);
  return url;
}
