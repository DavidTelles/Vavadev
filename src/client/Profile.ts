import type { GraphicsQuality } from '@client/core/Engine';
import type { Difficulty, MatchMode, Team } from '@shared/types';
import type { CrosshairColor, CrosshairType } from '@client/ui/Crosshair';

/**
 * Per-browser player profile and settings, persisted in localStorage.
 * Every storage access is wrapped: private windows or blocked storage just
 * fall back to defaults and the game keeps working.
 */
export interface Settings {
  playerName: string;
  sensitivity: number;
  fov: number;
  volumeSfx: number;
  volumeVoice: number;
  volumeMusic: number;
  quality: GraphicsQuality;
  difficulty: Difficulty;
  crosshairType: CrosshairType;
  crosshairColor: CrosshairColor;
}

export interface MatchRecord {
  date: number;
  mode: MatchMode;
  characterId: string;
  won: boolean;
  score: Record<Team, number>;
  kills: number;
  deaths: number;
  assists: number;
}

export interface ProfileData {
  agent: string;
  mode: MatchMode;
  shards: number;
  tokens: number;
  history: MatchRecord[];
  settings: Settings;
}

const KEY = 'esquadrao.profile.v1';

export const DEFAULT_SETTINGS: Settings = {
  playerName: 'JOGADOR-07',
  sensitivity: 1,
  fov: 90,
  volumeSfx: 80,
  volumeVoice: 80,
  volumeMusic: 50,
  quality: 'alta',
  difficulty: 'normal',
  crosshairType: 'cruz',
  crosshairColor: 'verde',
};

function defaults(): ProfileData {
  return { agent: 'david', mode: 'competitivo', shards: 1250, tokens: 350, history: [], settings: { ...DEFAULT_SETTINGS } };
}

function load(): ProfileData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const p = JSON.parse(raw) as Partial<ProfileData>;
    const d = defaults();
    return { ...d, ...p, settings: { ...d.settings, ...(p.settings ?? {}) }, history: Array.isArray(p.history) ? p.history : [] };
  } catch {
    return defaults();
  }
}

type Listener = (p: ProfileData) => void;

class ProfileStore {
  readonly data: ProfileData = load();
  private listeners = new Set<Listener>();

  save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* storage unavailable: keep in memory only */
    }
    for (const l of this.listeners) l(this.data);
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  recordMatch(r: MatchRecord): void {
    this.data.history.unshift(r);
    this.data.history.length = Math.min(this.data.history.length, 30);
    this.data.shards += r.won ? 120 : 40;
    this.data.tokens += r.kills * 5;
    this.save();
  }
}

export const profile = new ProfileStore();
