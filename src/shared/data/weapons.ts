export type WeaponCategory = 'pistola' | 'submetralhadora' | 'escopeta' | 'fuzil' | 'precisao' | 'pesada' | 'corpo' | 'especial';

export interface WeaponDef {
  id: string;
  name: string;
  category: WeaponCategory;
  description: string;
  slot: 1 | 2 | 3;
  cost: number;
  auto: boolean;
  rpm: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  equipTime: number;
  damage: { head: number; body: number; legs: number };
  falloff: Array<[number, number]>;
  pellets: number;
  range: number;
  spreadBase: number;
  spreadMove: number;
  spreadAir: number;
  spreadCrouch: number;
  spreadAim: number;
  spreadPerShot: number;
  spreadMax: number;
  recoilPitch: number;
  recoilYaw: number;
  recoilRecovery: number;
  zoom: number;
  moveMult: number;
  penetration: number;
  killReward: number;
}

const DEG = Math.PI / 180;

const base = {
  spreadAir: 6 * DEG,
  spreadCrouch: 0.75,
  spreadAim: 0.6,
  zoom: 1.15,
  penetration: 0,
  pellets: 1,
  killReward: 200,
  equipTime: 0.75,
};

export const WEAPONS: Record<string, WeaponDef> = {
  faca: {
    ...base, id: 'faca', name: 'Faca Tática', category: 'corpo', description: 'Lâmina leve para combate corpo a corpo. Mais rápido para correr.',
    slot: 3, cost: 0, auto: true, rpm: 120, mag: 1, reserve: 0, reloadTime: 0, equipTime: 0.4,
    damage: { head: 75, body: 50, legs: 50 }, falloff: [[0, 1]], range: 2.2,
    spreadBase: 0, spreadMove: 0, spreadPerShot: 0, spreadMax: 0, recoilPitch: 0, recoilYaw: 0, recoilRecovery: 10, zoom: 1, moveMult: 1.08,
  },
  faisca: {
    ...base, id: 'faisca', name: 'Faísca', category: 'pistola', description: 'Pistola padrão. Precisa no primeiro tiro e rápida para trocar.',
    slot: 2, cost: 0, auto: false, rpm: 400, mag: 12, reserve: 36, reloadTime: 1.5, equipTime: 0.5,
    damage: { head: 78, body: 26, legs: 22 }, falloff: [[0, 1], [30, 0.85]], range: 80,
    spreadBase: 0.35 * DEG, spreadMove: 2.4 * DEG, spreadPerShot: 0.7 * DEG, spreadMax: 3.5 * DEG,
    recoilPitch: 0.9 * DEG, recoilYaw: 0.3 * DEG, recoilRecovery: 9 * DEG, moveMult: 1,
  },
  trovao: {
    ...base, id: 'trovao', name: 'Trovão', category: 'pistola', description: 'Revólver pesado. Um tiro na cabeça elimina a curta distância.',
    slot: 2, cost: 800, auto: false, rpm: 240, mag: 6, reserve: 24, reloadTime: 2.2, equipTime: 0.6,
    damage: { head: 159, body: 55, legs: 46 }, falloff: [[0, 1], [30, 0.9]], range: 90,
    spreadBase: 0.25 * DEG, spreadMove: 3 * DEG, spreadPerShot: 1.8 * DEG, spreadMax: 4.5 * DEG,
    recoilPitch: 3.2 * DEG, recoilYaw: 0.8 * DEG, recoilRecovery: 10 * DEG, moveMult: 1, penetration: 1,
  },
  vespa: {
    ...base, id: 'vespa', name: 'Vespa', category: 'submetralhadora', description: 'Submetralhadora ágil. Ótima em movimento e a curta distância.',
    slot: 1, cost: 1600, auto: true, rpm: 800, mag: 30, reserve: 90, reloadTime: 2.2, killReward: 200,
    damage: { head: 78, body: 26, legs: 22 }, falloff: [[0, 1], [20, 0.85]], range: 60,
    spreadBase: 0.6 * DEG, spreadMove: 1.1 * DEG, spreadPerShot: 0.22 * DEG, spreadMax: 3.6 * DEG,
    recoilPitch: 0.45 * DEG, recoilYaw: 0.35 * DEG, recoilRecovery: 12 * DEG, moveMult: 1.03,
  },
  marreta: {
    ...base, id: 'marreta', name: 'Marreta', category: 'escopeta', description: 'Escopeta semiautomática devastadora em ambientes fechados.',
    slot: 1, cost: 1850, auto: false, rpm: 90, mag: 7, reserve: 21, reloadTime: 2.4, pellets: 12,
    damage: { head: 26, body: 13, legs: 11 }, falloff: [[0, 1], [8, 0.65], [15, 0.35]], range: 30,
    spreadBase: 4.2 * DEG, spreadMove: 0.5 * DEG, spreadPerShot: 0, spreadMax: 4.2 * DEG, spreadAim: 0.85,
    recoilPitch: 4 * DEG, recoilYaw: 1 * DEG, recoilRecovery: 8 * DEG, moveMult: 1,
  },
  jaguar: {
    ...base, id: 'jaguar', name: 'Jaguar', category: 'fuzil', description: 'Fuzil potente. Mata com um tiro na cabeça a qualquer distância.',
    slot: 1, cost: 2900, auto: true, rpm: 590, mag: 25, reserve: 75, reloadTime: 2.5, penetration: 2,
    damage: { head: 160, body: 40, legs: 34 }, falloff: [[0, 1]], range: 120,
    spreadBase: 0.15 * DEG, spreadMove: 4.5 * DEG, spreadPerShot: 0.5 * DEG, spreadMax: 4.5 * DEG,
    recoilPitch: 0.95 * DEG, recoilYaw: 0.55 * DEG, recoilRecovery: 8 * DEG, moveMult: 0.94,
  },
  falcao: {
    ...base, id: 'falcao', name: 'Falcão', category: 'fuzil', description: 'Fuzil estável com recuo controlável e cadência alta.',
    slot: 1, cost: 2900, auto: true, rpm: 660, mag: 30, reserve: 90, reloadTime: 2.5, penetration: 2,
    damage: { head: 140, body: 35, legs: 30 }, falloff: [[0, 1], [15, 0.88], [30, 0.8]], range: 120,
    spreadBase: 0.15 * DEG, spreadMove: 4.2 * DEG, spreadPerShot: 0.4 * DEG, spreadMax: 3.8 * DEG,
    recoilPitch: 0.7 * DEG, recoilYaw: 0.4 * DEG, recoilRecovery: 9 * DEG, moveMult: 0.94,
  },
  guardiao: {
    ...base, id: 'guardiao', name: 'Guardião', category: 'precisao', description: 'Fuzil de precisão semiautomático com mira ampliada.',
    slot: 1, cost: 2300, auto: false, rpm: 285, mag: 12, reserve: 36, reloadTime: 2.4, penetration: 2, zoom: 1.6,
    damage: { head: 158, body: 66, legs: 56 }, falloff: [[0, 1]], range: 140,
    spreadBase: 0.1 * DEG, spreadMove: 5 * DEG, spreadPerShot: 1.6 * DEG, spreadMax: 4.5 * DEG, spreadAim: 0.2,
    recoilPitch: 1.8 * DEG, recoilYaw: 0.3 * DEG, recoilRecovery: 9 * DEG, moveMult: 0.92,
  },
  gaviao: {
    ...base, id: 'gaviao', name: 'Gavião', category: 'precisao', description: 'Rifle de ferrolho. Elimina com um tiro no corpo. Use a mira (botão direito).',
    slot: 1, cost: 4700, auto: false, rpm: 41, mag: 5, reserve: 15, reloadTime: 3.6, equipTime: 1.1, penetration: 3, zoom: 3,
    damage: { head: 255, body: 150, legs: 127 }, falloff: [[0, 1]], range: 200,
    spreadBase: 6 * DEG, spreadMove: 9 * DEG, spreadPerShot: 0, spreadMax: 6 * DEG, spreadAim: 0.005,
    recoilPitch: 5 * DEG, recoilYaw: 0.5 * DEG, recoilRecovery: 6 * DEG, moveMult: 0.82, killReward: 100,
  },
  rolo: {
    ...base, id: 'rolo', name: 'Rolo Compressor', category: 'pesada', description: 'Metralhadora pesada com pente enorme. Atravessa paredes finas.',
    slot: 1, cost: 3200, auto: true, rpm: 720, mag: 100, reserve: 100, reloadTime: 5, equipTime: 1.1, penetration: 3,
    damage: { head: 95, body: 38, legs: 32 }, falloff: [[0, 1], [30, 0.9]], range: 120,
    spreadBase: 0.8 * DEG, spreadMove: 5 * DEG, spreadPerShot: 0.15 * DEG, spreadMax: 4 * DEG,
    recoilPitch: 0.5 * DEG, recoilYaw: 0.6 * DEG, recoilRecovery: 7 * DEG, moveMult: 0.85,
  },
  tempestade: {
    ...base, id: 'tempestade', name: 'Tempestade', category: 'especial', description: 'Fuzil elétrico da ultimate de David.',
    slot: 1, cost: 0, auto: true, rpm: 700, mag: 40, reserve: 0, reloadTime: 0, equipTime: 0.3, penetration: 2,
    damage: { head: 150, body: 50, legs: 45 }, falloff: [[0, 1]], range: 120,
    spreadBase: 0.1 * DEG, spreadMove: 0.6 * DEG, spreadPerShot: 0.15 * DEG, spreadMax: 1.6 * DEG,
    recoilPitch: 0.35 * DEG, recoilYaw: 0.2 * DEG, recoilRecovery: 12 * DEG, moveMult: 1.05, killReward: 200,
  },
  laminas: {
    ...base, id: 'laminas', name: 'Lâminas Fantasmas', category: 'especial', description: 'Facas de arremesso da ultimate de Biro. Abates recarregam.',
    slot: 1, cost: 0, auto: false, rpm: 200, mag: 5, reserve: 0, reloadTime: 0, equipTime: 0.3,
    damage: { head: 150, body: 60, legs: 50 }, falloff: [[0, 1]], range: 60,
    spreadBase: 0.05 * DEG, spreadMove: 0.1 * DEG, spreadPerShot: 0, spreadMax: 0.1 * DEG,
    recoilPitch: 0.4 * DEG, recoilYaw: 0, recoilRecovery: 12 * DEG, moveMult: 1.05,
  },
};

export const SHOP_WEAPONS = ['trovao', 'vespa', 'marreta', 'falcao', 'jaguar', 'guardiao', 'gaviao', 'rolo'];

export const ARMOR_ITEMS = [
  { id: 'colete', name: 'Colete Leve', amount: 25, cost: 400 },
  { id: 'blindagem', name: 'Blindagem Pesada', amount: 50, cost: 1000 },
];

export function falloffMult(w: WeaponDef, dist: number): number {
  let m = 1;
  for (const [d, mult] of w.falloff) if (dist >= d) m = mult;
  return m;
}
