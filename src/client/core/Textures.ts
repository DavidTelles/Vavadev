import * as THREE from 'three';

type Painter = (ctx: CanvasRenderingContext2D, s: number, rnd: () => number) => void;

const cache = new Map<string, THREE.CanvasTexture>();

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noise(ctx: CanvasRenderingContext2D, s: number, rnd: () => number, amount: number, alpha: number): void {
  const img = ctx.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    d[i + 3] = Math.max(d[i + 3], alpha);
  }
  ctx.putImageData(img, 0, 0);
}

function blotches(ctx: CanvasRenderingContext2D, s: number, rnd: () => number, color: string, n: number, maxR: number): void {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.04 + rnd() * 0.08;
    ctx.beginPath();
    ctx.arc(rnd() * s, rnd() * s, 4 + rnd() * maxR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function makeTexture(key: string, size: number, paint: Painter, seed = 1): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  paint(ctx, size, rng(seed));
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  cache.set(key, tex);
  return tex;
}

export function grayscaleOf(key: string, src: THREE.CanvasTexture): THREE.CanvasTexture {
  const k = `${key}_g`;
  const hit = cache.get(k);
  if (hit) return hit;
  const img = src.image as HTMLCanvasElement;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace;
  cache.set(k, tex);
  return tex;
}

export const Tex = {
  concrete: () => makeTexture('concrete', 512, (ctx, s, r) => {
    ctx.fillStyle = '#b9b4aa';
    ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, '#8d877c', 90, 40);
    blotches(ctx, s, r, '#d8d2c6', 50, 30);
    ctx.strokeStyle = 'rgba(70,64,58,0.45)';
    ctx.lineWidth = 3;
    for (let y = 0; y <= s; y += s / 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(s, y); ctx.stroke();
    }
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? s / 4 : 0;
      for (let x = off; x <= s; x += s / 2) {
        ctx.beginPath(); ctx.moveTo(x, (row * s) / 4); ctx.lineTo(x, ((row + 1) * s) / 4); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(60,55,50,0.5)';
    for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.arc(r() * s, r() * s, 2.5, 0, 7); ctx.fill(); }
    noise(ctx, s, r, 26, 255);
  }, 11),
  plaster: () => makeTexture('plaster', 512, (ctx, s, r) => {
    ctx.fillStyle = '#d9c7a6';
    ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, '#b89e78', 70, 60);
    ctx.fillStyle = '#7d6a55';
    ctx.fillRect(0, s * 0.82, s, s * 0.18);
    ctx.fillStyle = '#5d4d3e';
    ctx.fillRect(0, s * 0.8, s, 6);
    noise(ctx, s, r, 20, 255);
  }, 12),
  floor: () => makeTexture('floor', 512, (ctx, s, r) => {
    ctx.fillStyle = '#8a8780';
    ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, r, '#6f6b63', 120, 30);
    ctx.strokeStyle = 'rgba(50,48,44,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo((i * s) / 2, 0); ctx.lineTo((i * s) / 2, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, (i * s) / 2); ctx.lineTo(s, (i * s) / 2); ctx.stroke();
    }
    noise(ctx, s, r, 30, 255);
  }, 13),
  site: () => makeTexture('site', 512, (ctx, s, r) => {
    ctx.fillStyle = '#5e6670';
    ctx.fillRect(0, 0, s, s);
    const n = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 88 + Math.floor(r() * 20);
      ctx.fillStyle = `rgb(${v},${v + 6},${v + 14})`;
      ctx.fillRect((x * s) / n + 2, (y * s) / n + 2, s / n - 4, s / n - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect((x * s) / n + 6, (y * s) / n + 6, s / n - 12, 3);
    }
    noise(ctx, s, r, 18, 255);
  }, 14),
  spawn: () => makeTexture('spawn', 512, (ctx, s, r) => {
    ctx.fillStyle = '#c8c2b4';
    ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      ctx.fillStyle = (x + y) % 2 ? '#b3ad9f' : '#d6d0c2';
      ctx.fillRect((x * s) / 4 + 2, (y * s) / 4 + 2, s / 4 - 4, s / 4 - 4);
    }
    noise(ctx, s, r, 14, 255);
  }, 15),
  metal: () => makeTexture('metal', 256, (ctx, s, r) => {
    ctx.fillStyle = '#6b7178';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#7f868e';
    for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < s; x += 16) {
      ctx.save(); ctx.translate(x + 4, y + 4); ctx.rotate(Math.PI / 4); ctx.fillRect(-1.5, -5, 3, 10); ctx.restore();
    }
    ctx.strokeStyle = '#3d4247';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, s, s);
    noise(ctx, s, r, 18, 255);
  }, 16),
  wood: () => makeTexture('wood', 256, (ctx, s, r) => {
    ctx.fillStyle = '#9b6d3e';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#a7794a' : '#8f6236';
      ctx.fillRect(0, (i * s) / 6, s, s / 6 - 3);
    }
    ctx.strokeStyle = 'rgba(60,35,15,0.35)';
    for (let i = 0; i < 60; i++) {
      const y = r() * s;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + r() * 6 - 3, (2 * s) / 3, y + r() * 6 - 3, s, y); ctx.stroke();
    }
    ctx.fillStyle = '#5c3b1d';
    ctx.fillRect(0, 0, s, 14); ctx.fillRect(0, s - 14, s, 14); ctx.fillRect(0, 0, 14, s); ctx.fillRect(s - 14, 0, 14, s);
    ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(Math.atan2(s, s)); ctx.fillRect(-s * 0.7, -7, s * 1.4, 14); ctx.restore();
    noise(ctx, s, r, 20, 255);
  }, 17),
  container: () => makeTexture('container', 256, (ctx, s, r) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x, 0, 6, s);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 8, 0, 3, s);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, s, 10); ctx.fillRect(0, s - 10, s, 10);
    blotches(ctx, s, r, '#5a3a20', 25, 18);
    noise(ctx, s, r, 16, 255);
  }, 18),
  hazard: () => makeTexture('hazard', 128, (ctx, s) => {
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#222';
    for (let i = -s; i < s * 2; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 16, 0); ctx.lineTo(i + 16 - s, s); ctx.lineTo(i - s, s); ctx.closePath(); ctx.fill();
    }
  }, 19),
};

export function textTexture(text: string, color: string, size = 512, font = 'bold 380px "Segoe UI", sans-serif'): THREE.CanvasTexture {
  const key = `text_${text}_${color}_${size}`;
  return makeTexture(key, size, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, s / 2, s / 2 + s * 0.04);
  });
}
