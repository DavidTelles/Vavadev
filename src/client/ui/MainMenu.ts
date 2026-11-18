import './menu.css';
import { t } from '@shared/i18n/pt-BR';
import { CHARACTERS, ROLE_NAMES, type CharacterDefinition } from '@shared/data/characters';
import { WEAPONS } from '@shared/data/weapons';
import { getUsinaMap } from '@shared/data/maps/usina';
import type { Difficulty, MatchMode, Role } from '@shared/types';
import type { MenuScene } from '@client/menu/MenuScene';
import { profile } from '@client/Profile';
import { ICON, LOGO, SKYLINE, SPIRIT, TRIANGLE } from './icons';

export interface PlayRequest {
  mode: MatchMode;
  difficulty: Difficulty;
  characterId: string;
}

type PanelId = 'play' | 'agents' | 'arsenal' | 'maps' | 'career' | 'store' | 'social' | 'settings' | 'help' | 'news' | 'notes' | 'events';

interface MenuItem { id: PanelId; label: string; icon: string; soon?: boolean }

const ITEMS: MenuItem[] = [
  { id: 'play', label: 'menu.jogar', icon: ICON.play },
  { id: 'agents', label: 'menu.agentes', icon: ICON.agents },
  { id: 'arsenal', label: 'menu.arsenal', icon: ICON.arsenal },
  { id: 'maps', label: 'menu.mapas', icon: ICON.maps },
  { id: 'career', label: 'menu.carreira', icon: ICON.career },
  { id: 'store', label: 'menu.loja', icon: ICON.store, soon: true },
  { id: 'social', label: 'menu.social', icon: ICON.social, soon: true },
];

const TABS: { id: PanelId | 'home'; label: string }[] = [
  { id: 'home', label: 'menu.tabInicio' },
  { id: 'news', label: 'menu.tabNoticias' },
  { id: 'notes', label: 'menu.tabNotas' },
  { id: 'events', label: 'menu.tabCampeonatos' },
];

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fmt = (n: number): string => n.toLocaleString('pt-BR');
const charById = (id: string): CharacterDefinition => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];

/**
 * Main menu overlay (DOM) on top of the live MenuScene. Layout follows the
 * reference art: brand top-left, tabs top-center, wallet + profile top-right,
 * vertical menu on the left, news + system status cards, footer with hints.
 */
export class MainMenu {
  readonly el: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly panelTitle: HTMLElement;
  private readonly panelBody: HTMLElement;
  private readonly veil: HTMLElement;
  private readonly drop: HTMLElement;
  private active = 0;
  private open: PanelId | null = null;
  private tab = 0;
  private roleFilter: Role | 'all' = 'all';
  private viewAgent = profile.data.agent;
  private unsub: () => void;

  constructor(private readonly root: HTMLElement, private readonly scene: MenuScene, private readonly onPlay: (r: PlayRequest) => void) {
    this.el = document.createElement('div');
    this.el.className = 'mm';
    this.el.innerHTML = this.skeleton();
    root.appendChild(this.el);
    this.panel = this.q('.mm-panel');
    this.panelTitle = this.q('.mm-panel h2');
    this.panelBody = this.q('.mm-body');
    this.veil = this.q('.mm-veil');
    this.drop = this.q('.mm-drop');
    this.bind();
    this.refreshTop();
    this.scene.setAgent(profile.data.agent);
    this.unsub = profile.onChange(() => this.refreshTop());
    window.addEventListener('keydown', this.onKey);
  }

  private q<T extends HTMLElement = HTMLElement>(sel: string): T {
    return this.el.querySelector(sel) as T;
  }

  // ---------- markup ----------

  private skeleton(): string {
    const items = ITEMS.map((it, i) => `
      <button class="mm-item${i === 0 ? ' on' : ''}${it.soon ? ' soon' : ''}" data-i="${i}">
        <i class="arrow"></i>${it.icon}<span class="lbl">${esc(t(it.label))}</span>
      </button>`).join('');
    const tabs = TABS.map((tb, i) => `<button class="mm-tab${i === 0 ? ' on' : ''}" data-t="${i}">${esc(t(tb.label))}</button>`).join('');
    const bars = (n: number): string => Array.from({ length: n }, (_, i) => `<i style="animation-delay:${(i * 0.13) % 1}s"></i>`).join('');
    return `
      <div class="mm-vignette"></div>
      <div class="mm-grain"></div>
      ${SPIRIT}
      <div class="mm-brand">
        ${LOGO}
        <div><h1>${esc(t('menu.marca1'))}</h1><h2>${esc(t('menu.marca2'))}</h2></div>
        <p>${esc(t('menu.lema'))}</p>
      </div>
      <nav class="mm-tabs">${tabs}</nav>
      <div class="mm-right">
        <div class="mm-wallet">
          <span title="${esc(t('menu.moedaFragmentos'))}">${ICON.shard}<b data-w="shards"></b></span>
          <span title="${esc(t('menu.moedaFichas'))}">${ICON.token}<b data-w="tokens"></b></span>
        </div>
        <div class="mm-profile" tabindex="0"><img alt=""><b></b></div>
      </div>
      <div class="mm-drop">
        <button data-d="settings">${esc(t('menu.configuracoes'))}</button>
        <button data-d="help">${esc(t('menu.ajuda'))}</button>
      </div>
      <nav class="mm-menu">${items}</nav>
      <section class="mm-card mm-news">
        <div class="mm-tag">${esc(t('menu.noticiaTag'))}</div>
        <h3>${esc(t('menu.noticiaTitulo'))}</h3>
        <p>${esc(t('menu.noticiaTexto'))}</p>
        ${SKYLINE}
        <span class="compass no-hit">${ICON.compass}</span>
      </section>
      <section class="mm-card mm-status no-hit">
        <div class="mm-tag">${esc(t('menu.statusTag'))}</div>
        <h3>${esc(t('menu.statusOnline'))}</h3>
        <p>${esc(t('menu.statusTexto'))}</p>
        <div class="wave l">${bars(9)}</div>
        <div class="wave r">${bars(9)}</div>
      </section>
      <section class="mm-card mm-panel">
        <header><h2></h2><button class="x">${esc(t('menu.dicaVoltar'))}</button></header>
        <div class="mm-body"></div>
      </section>
      <footer class="mm-foot">
        <span>${esc(t('menu.versao'))}</span>
        <span class="motto">${ICON.diamond}${esc(t('menu.frase1'))} <em>${esc(t('menu.frase2'))}</em></span>
        <span class="keys">
          <span>${ICON.enter}${esc(t('menu.dicaSelecionar'))}</span>
          <span>${ICON.esc}${esc(t('menu.dicaVoltar'))}</span>
          <span>${ICON.tab}${esc(t('menu.dicaCanais'))}</span>
          <span>${ICON.f1}${esc(t('menu.dicaAjuda'))}</span>
        </span>
        ${TRIANGLE}
      </footer>
      <div class="mm-veil"><div>${esc(t('menu.carregando'))}<i></i></div></div>`;
  }

  private bind(): void {
    this.el.querySelectorAll<HTMLButtonElement>('.mm-item').forEach((b) => {
      const i = Number(b.dataset.i);
      b.addEventListener('mouseenter', () => this.setActive(i));
      b.addEventListener('click', () => this.activate(i));
    });
    this.el.querySelectorAll<HTMLButtonElement>('.mm-tab').forEach((b) => {
      b.addEventListener('click', () => this.setTab(Number(b.dataset.t)));
    });
    this.q('.mm-panel .x').addEventListener('click', () => this.closePanel());
    this.q('.mm-news').addEventListener('click', () => this.setTab(1));
    const prof = this.q('.mm-profile');
    prof.addEventListener('click', (e) => {
      e.stopPropagation();
      this.drop.classList.toggle('on');
    });
    this.drop.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.addEventListener('click', () => {
        this.drop.classList.remove('on');
        this.openPanel(b.dataset.d as PanelId);
      });
    });
    this.el.addEventListener('click', () => this.drop.classList.remove('on'));
  }

  private refreshTop(): void {
    const p = profile.data;
    this.q('[data-w="shards"]').textContent = fmt(p.shards);
    this.q('[data-w="tokens"]').textContent = fmt(p.tokens);
    this.q<HTMLImageElement>('.mm-profile img').src = this.scene.portrait(p.agent);
    this.q('.mm-profile b').textContent = `${p.settings.playerName} ▾`;
  }

  // ---------- navigation ----------

  private setActive(i: number): void {
    this.active = (i + ITEMS.length) % ITEMS.length;
    this.el.querySelectorAll('.mm-item').forEach((b, k) => b.classList.toggle('on', k === this.active));
  }

  private activate(i: number): void {
    this.setActive(i);
    this.openPanel(ITEMS[i].id);
  }

  private setTab(i: number): void {
    this.tab = (i + TABS.length) % TABS.length;
    this.el.querySelectorAll('.mm-tab').forEach((b, k) => b.classList.toggle('on', k === this.tab));
    const id = TABS[this.tab].id;
    if (id === 'home') this.closePanel();
    else this.openPanel(id);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (!this.el.isConnected || this.veil.classList.contains('on')) return;
    const typing = (e.target as HTMLElement)?.tagName === 'INPUT';
    if (e.key === 'Escape') {
      if (this.drop.classList.contains('on')) this.drop.classList.remove('on');
      else this.closePanel();
    } else if (e.key === 'F1') {
      e.preventDefault();
      this.openPanel('help');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.setTab(this.tab + (e.shiftKey ? -1 : 1));
    } else if (typing) {
      return;
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.setActive(this.active + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.setActive(this.active - 1);
    } else if (e.key === 'Enter') {
      if (this.open === 'play') this.start();
      else this.activate(this.active);
    }
  };

  private openPanel(id: PanelId): void {
    this.open = id;
    this.panel.classList.add('on');
    this.el.querySelectorAll<HTMLElement>('.mm-item').forEach((b, k) => b.classList.toggle('open', ITEMS[k].id === id));
    this.scene.setFocus(id === 'agents' ? 'agents' : 'panel');
    this.renderPanel();
  }

  private closePanel(): void {
    this.open = null;
    this.panel.classList.remove('on');
    this.el.querySelectorAll('.mm-item').forEach((b) => b.classList.remove('open'));
    this.scene.setFocus('home');
    if (this.viewAgent !== profile.data.agent) {
      this.viewAgent = profile.data.agent;
      this.scene.setAgent(profile.data.agent);
    }
    if (TABS[this.tab].id !== 'home') {
      this.tab = 0;
      this.el.querySelectorAll('.mm-tab').forEach((b, k) => b.classList.toggle('on', k === 0));
    }
  }

  private renderPanel(): void {
    const id = this.open;
    if (!id) return;
    const titles: Record<PanelId, string> = {
      play: 'menu.jogar', agents: 'menu.agentes', arsenal: 'menu.arsenal', maps: 'menu.mapas', career: 'menu.carreira',
      store: 'menu.loja', social: 'menu.social', settings: 'menu.configuracoes', help: 'menu.ajuda',
      news: 'menu.tabNoticias', notes: 'menu.tabNotas', events: 'menu.tabCampeonatos',
    };
    this.panelTitle.textContent = t(titles[id]).toUpperCase();
    const b = this.panelBody;
    b.scrollTop = 0;
    switch (id) {
      case 'play': this.panelPlay(b); break;
      case 'agents': this.panelAgents(b); break;
      case 'arsenal': this.panelArsenal(b); break;
      case 'maps': this.panelMaps(b); break;
      case 'career': this.panelCareer(b); break;
      case 'settings': this.panelSettings(b); break;
      case 'help': b.innerHTML = `<div class="mm-sec">${esc(t('menu.ajudaTitulo'))}</div><p>${esc(t('menu.controles'))}</p>`; break;
      case 'news': b.innerHTML = `<div class="mm-sec">${esc(t('menu.noticiaTitulo'))}</div><p>${esc(t('menu.noticiasTexto'))}</p>`; break;
      case 'notes': b.innerHTML = `<div class="mm-sec">${esc(t('menu.versao'))}</div><p>${esc(t('menu.notasTexto'))}</p>`; break;
      default: b.innerHTML = `<div class="mm-soon"><div><b>${esc(t('menu.emBreve'))}</b><p>${esc(t('menu.emBreveTexto'))}</p></div></div>`;
    }
  }

  // ---------- panels ----------

  private panelPlay(b: HTMLElement): void {
    const p = profile.data;
    const modes: [MatchMode, string, string][] = [
      ['competitivo', 'mode.competitivo', 'mode.competitivoDesc'],
      ['rapida', 'mode.rapida', 'mode.rapidaDesc'],
      ['treino', 'mode.treino', 'mode.treinoDesc'],
    ];
    const diffs: [Difficulty, string][] = [['facil', 'settings.dificuldadeFacil'], ['normal', 'settings.dificuldadeNormal'], ['dificil', 'settings.dificuldadeDificil']];
    const c = charById(p.agent);
    b.innerHTML = `
      <div class="mm-sec">${esc(t('menu.modo'))}</div>
      <div class="mm-opts">${modes.map(([m, n, d]) => `<button class="mm-opt${p.mode === m ? ' on' : ''}" data-m="${m}"><b>${esc(t(n))}</b><small>${esc(t(d))}</small></button>`).join('')}</div>
      <div class="mm-sec">${esc(t('menu.dificuldade'))}</div>
      <div class="mm-seg">${diffs.map(([d, n]) => `<button class="${p.settings.difficulty === d ? 'on' : ''}" data-d="${d}">${esc(t(n))}</button>`).join('')}</div>
      <div class="mm-sec">${esc(t('menu.agente'))} · ${esc(t('menu.mapa'))}</div>
      <div class="mm-chip">
        <img src="${this.scene.portrait(c.id)}" alt="">
        <div><b>${esc(c.name.toUpperCase())}</b><small>${esc(ROLE_NAMES[c.role])} · ${esc(t('menu.mapaUsina'))}</small></div>
        <button class="mm-link link">${esc(t('menu.trocar'))} ›</button>
      </div>
      <button class="mm-go">${esc(t('menu.iniciar'))}</button>`;
    b.querySelectorAll<HTMLButtonElement>('[data-m]').forEach((x) => x.addEventListener('click', () => {
      p.mode = x.dataset.m as MatchMode;
      profile.save();
      this.panelPlay(b);
    }));
    b.querySelectorAll<HTMLButtonElement>('[data-d]').forEach((x) => x.addEventListener('click', () => {
      p.settings.difficulty = x.dataset.d as Difficulty;
      profile.save();
      this.panelPlay(b);
    }));
    b.querySelector('.link')!.addEventListener('click', () => this.activate(1));
    b.querySelector('.mm-go')!.addEventListener('click', () => this.start());
  }

  private start(): void {
    const p = profile.data;
    this.veil.classList.add('on');
    this.onPlay({ mode: p.mode, difficulty: p.settings.difficulty, characterId: p.agent });
  }

  private panelAgents(b: HTMLElement): void {
    const roles: (Role | 'all')[] = ['all', 'duelista', 'controlador', 'iniciador', 'sentinela'];
    const list = CHARACTERS.filter((c) => this.roleFilter === 'all' || c.role === this.roleFilter);
    const c = charById(this.viewAgent);
    const mine = profile.data.agent;
    const slots = ['C', 'Q', 'E', 'X'] as const;
    b.innerHTML = `
      <div class="mm-roles">${roles.map((r) => `<button class="${this.roleFilter === r ? 'on' : ''}" data-r="${r}">${esc(r === 'all' ? t('menu.todos') : ROLE_NAMES[r])}</button>`).join('')}</div>
      <div class="mm-grid">${list.map((a) => `
        <button class="mm-agent${a.id === c.id ? ' on' : ''}${a.id === mine ? ' mine' : ''}" data-a="${a.id}">
          <img src="${this.scene.portrait(a.id)}" alt=""><span>${esc(a.name)}</span>
        </button>`).join('')}</div>
      <div class="mm-detail">
        <h3>${esc(c.name.toUpperCase())}</h3>
        <div class="role">${esc(ROLE_NAMES[c.role])} · ${esc(c.title)}</div>
        <p>${esc(c.bio)}</p>
        <div class="mm-sec">${esc(t('menu.habilidades'))}</div>
        ${slots.map((s) => {
          const a = c.abilities[s];
          const meta = s === 'X'
            ? `${a.ultPoints} ${t('menu.pontosUlt')}`
            : [a.cost ? `${a.cost} ¤` : t('menu.gratis'), `${a.maxCharges} ${t('menu.cargas')}`, a.cooldown ? `${a.cooldown}s ${t('menu.recarga')}` : ''].filter(Boolean).join(' · ');
          return `<div class="mm-abil"><kbd class="${s === 'X' ? 'ult' : ''}">${s}</kbd><b>${esc(a.name)}<small>${esc(meta)}</small></b><p>${esc(a.description)}</p></div>`;
        }).join('')}
        <button class="mm-go" ${c.id === mine ? 'disabled' : ''}>${esc(c.id === mine ? t('menu.selecionado') : t('menu.selecionar'))}</button>
      </div>`;
    b.querySelectorAll<HTMLButtonElement>('[data-r]').forEach((x) => x.addEventListener('click', () => {
      this.roleFilter = x.dataset.r as Role | 'all';
      this.panelAgents(b);
    }));
    b.querySelectorAll<HTMLButtonElement>('[data-a]').forEach((x) => x.addEventListener('click', () => {
      this.viewAgent = x.dataset.a!;
      this.scene.setAgent(this.viewAgent);
      const top = b.scrollTop;
      this.panelAgents(b);
      b.scrollTop = top;
    }));
    const go = b.querySelector<HTMLButtonElement>('.mm-go')!;
    go.addEventListener('click', () => {
      profile.data.agent = c.id;
      profile.save();
      this.panelAgents(b);
    });
  }

  private panelArsenal(b: HTMLElement): void {
    const list = Object.values(WEAPONS).filter((w) => w.category !== 'especial');
    const maxDmg = Math.max(...list.map((w) => w.damage.body * w.pellets));
    const maxRpm = Math.max(...list.map((w) => w.rpm));
    const order = ['corpo', 'pistola', 'submetralhadora', 'escopeta', 'fuzil', 'precisao', 'pesada'];
    list.sort((a, b2) => order.indexOf(a.category) - order.indexOf(b2.category) || a.cost - b2.cost);
    let html = `<div class="mm-wpn"><span class="h">${esc(t('menu.arsenal'))}</span><span class="h">${esc(t('menu.preco'))}</span><span class="h">${esc(t('menu.danoCorpo'))}</span><span class="h">${esc(t('menu.cadencia'))}</span><span class="h">${esc(t('menu.pente'))}</span>`;
    let cat = '';
    for (const w of list) {
      if (w.category !== cat) {
        cat = w.category;
        html += `<span class="mm-sec" style="grid-column:1/-1">${esc(t('cat.' + cat))}</span>`;
      }
      const dmg = w.damage.body * w.pellets;
      html += `<span class="n">${esc(w.name)}</span><span>${w.cost ? fmt(w.cost) : esc(t('menu.gratuita'))}</span>
        <span class="mm-bar" title="${dmg}"><i style="width:${(dmg / maxDmg) * 100}%"></i></span>
        <span class="mm-bar" title="${w.rpm}"><i style="width:${(w.rpm / maxRpm) * 100}%"></i></span>
        <span>${w.category === 'corpo' ? '—' : w.mag}</span>`;
    }
    b.innerHTML = html + '</div>';
  }

  private panelMaps(b: HTMLElement): void {
    b.innerHTML = `
      <div class="mm-sec">${esc(t('menu.mapaUsina'))}</div>
      <canvas class="mm-map" width="960" height="720"></canvas>
      <p style="margin-top:14px">${esc(t('menu.mapaUsinaDesc'))}</p>`;
    const cv = b.querySelector('canvas')!;
    const g = cv.getContext('2d')!;
    const m = getUsinaMap();
    const sx = cv.width / (m.maxX - m.minX);
    const sz = cv.height / (m.maxZ - m.minZ);
    const X = (x: number): number => (x - m.minX) * sx;
    const Z = (z: number): number => (z - m.minZ) * sz;
    for (const f of m.floors) {
      g.fillStyle = f.kind === 'site' ? 'rgba(255,95,168,0.22)' : f.kind === 'spawn' ? 'rgba(160,140,200,0.18)' : 'rgba(236,230,239,0.07)';
      g.fillRect(X(f.min.x), Z(f.min.z), (f.max.x - f.min.x) * sx, (f.max.z - f.min.z) * sz);
    }
    for (const bx of m.boxes) {
      if (bx.kind === 'ground' || bx.kind === 'lintel') continue;
      g.fillStyle = bx.kind === 'wall' ? '#4a4352' : '#2c2733';
      g.fillRect(X(bx.min.x), Z(bx.min.z), (bx.max.x - bx.min.x) * sx, (bx.max.z - bx.min.z) * sz);
    }
    g.font = '700 54px Rajdhani, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const side of ['A', 'B'] as const) {
      const c = m.sites[side].center;
      g.fillStyle = '#ff5fa8';
      g.fillText(side, X(c.x), Z(c.z));
    }
    g.font = '600 26px Rajdhani, sans-serif';
    for (const team of ['atk', 'def'] as const) {
      const z = m.spawnZones[team];
      g.fillStyle = '#ece6ef';
      g.fillText(t(team === 'atk' ? 'menu.atacantesBase' : 'menu.defensoresBase').toUpperCase(), X((z.minX + z.maxX) / 2), Z((z.minZ + z.maxZ) / 2));
    }
  }

  private panelCareer(b: HTMLElement): void {
    const h = profile.data.history;
    const wins = h.filter((r) => r.won).length;
    const k = h.reduce((s, r) => s + r.kills, 0);
    const d = h.reduce((s, r) => s + r.deaths, 0);
    const modeName: Record<MatchMode, string> = { competitivo: t('mode.competitivo'), rapida: t('mode.rapida'), treino: t('mode.treino') };
    b.innerHTML = `
      <div class="mm-stats">
        <div class="mm-stat"><b>${h.length}</b><small>${esc(t('menu.partidas'))}</small></div>
        <div class="mm-stat"><b>${wins}</b><small>${esc(t('menu.vitorias'))}</small></div>
        <div class="mm-stat"><b>${h.length ? Math.round((wins / h.length) * 100) : 0}%</b><small>${esc(t('menu.taxaVitoria'))}</small></div>
        <div class="mm-stat"><b>${d ? (k / d).toFixed(2) : k}</b><small>${esc(t('menu.kd'))}</small></div>
      </div>
      <div class="mm-sec">${esc(t('menu.historico'))}</div>
      ${h.length ? h.map((r) => `
        <div class="mm-hist">
          <span class="${r.won ? 'w' : 'l'}">${esc(t(r.won ? 'result.vitoria' : 'result.derrota'))}</span>
          <span>${esc(charById(r.characterId).name)} · ${esc(modeName[r.mode])}</span>
          <span>${r.score.atk} : ${r.score.def}</span>
          <span>${r.kills} / ${r.deaths} / ${r.assists}</span>
        </div>`).join('') : `<p>${esc(t('menu.semPartidas'))}</p>`}`;
  }

  private panelSettings(b: HTMLElement): void {
    const s = profile.data.settings;
    const range = (key: keyof typeof s, label: string, min: number, max: number, step: number): string =>
      `<label class="mm-field"><span>${esc(t(label))}</span><input type="range" data-k="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"><output>${s[key]}</output></label>`;
    const seg = (key: 'quality' | 'difficulty', label: string, opts: [string, string][]): string =>
      `<div class="mm-field"><span>${esc(t(label))}</span><div class="mm-seg">${opts.map(([v, n]) => `<button data-k="${key}" data-v="${v}" class="${s[key] === v ? 'on' : ''}">${esc(t(n))}</button>`).join('')}</div></div>`;
    b.innerHTML = `
      <label class="mm-field"><span>${esc(t('menu.nomeJogador'))}</span><input type="text" maxlength="14" value="${esc(s.playerName)}"></label>
      ${range('sensitivity', 'settings.sensibilidade', 0.2, 3, 0.05)}
      ${range('fov', 'settings.fov', 70, 110, 1)}
      ${range('volumeSfx', 'settings.volumeSfx', 0, 100, 1)}
      ${range('volumeVoice', 'settings.volumeVoz', 0, 100, 1)}
      ${range('volumeMusic', 'settings.volumeMusica', 0, 100, 1)}
      ${seg('quality', 'settings.graficos', [['baixa', 'settings.graficoBaixa'], ['media', 'settings.graficoMedia'], ['alta', 'settings.graficoAlta']])}
      ${seg('difficulty', 'settings.dificuldade', [['facil', 'settings.dificuldadeFacil'], ['normal', 'settings.dificuldadeNormal'], ['dificil', 'settings.dificuldadeDificil']])}`;
    b.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      (s as unknown as Record<string, number>)[inp.dataset.k!] = Number(inp.value);
      inp.nextElementSibling!.textContent = inp.value;
      profile.save();
    }));
    const name = b.querySelector<HTMLInputElement>('input[type=text]')!;
    name.addEventListener('input', () => {
      s.playerName = name.value.trim().toUpperCase() || 'JOGADOR';
      profile.save();
    });
    b.querySelectorAll<HTMLButtonElement>('button[data-k]').forEach((x) => x.addEventListener('click', () => {
      (s as unknown as Record<string, string>)[x.dataset.k!] = x.dataset.v!;
      profile.save();
      this.panelSettings(b);
    }));
  }

  // ---------- lifecycle ----------

  setLoading(on: boolean): void {
    this.veil.classList.toggle('on', on);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    this.unsub();
    this.el.remove();
    void this.root;
  }
}
