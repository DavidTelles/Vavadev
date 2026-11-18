import './hud.css';
import { t } from '@shared/i18n/pt-BR';
import { ARMOR_ITEMS, SHOP_WEAPONS, WEAPONS } from '@shared/data/weapons';
import { DEFUSE_TIME, PLANT_TIME, SPIKE_TIME } from '@shared/constants';
import type { Simulation } from '@shared/sim/Simulation';
import type { Agent } from '@shared/sim/Agent';
import type { AbilitySlot, Team } from '@shared/types';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const SLOTS: AbilitySlot[] = ['C', 'Q', 'E', 'X'];

/**
 * In-match HUD in the same visual language as the main menu. Every per-tick
 * write is diffed (`set`) so the DOM is only touched when a value changes.
 */
export class HUD {
  readonly el: HTMLElement;
  private readonly cache = new Map<string, string>();
  private readonly nodes = new Map<string, HTMLElement>();
  private readonly shop: HTMLElement;
  private readonly board: HTMLElement;
  private readonly feed: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly blind: HTMLElement;
  private bannerTimer = 0;
  shopOpen = false;

  constructor(root: HTMLElement, private readonly sim: Simulation, private readonly humanId: number) {
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-blind"></div>
      <div class="hud-cross"><i></i><i></i><i></i><i></i></div>
      <div class="hud-top">
        <div class="hud-score us"><b data-n="us">0</b></div>
        <div class="hud-clock"><small data-n="round"></small><b data-n="time"></b><small data-n="phase"></small></div>
        <div class="hud-score them"><b data-n="them">0</b></div>
      </div>
      <div class="hud-alive"><div data-n="aliveUs"></div><div data-n="aliveThem"></div></div>
      <div class="hud-credits" data-n="credits"></div>
      <div class="hud-vitals">
        <div class="hp"><b data-n="hp"></b><small>${esc(t('hud.hp'))}</small><span class="bar"><i data-n="hpBar"></i></span></div>
        <div class="arm"><b data-n="arm"></b><small>${esc(t('hud.arm'))}</small></div>
      </div>
      <div class="hud-abil">${SLOTS.map((s) => `
        <div class="slot${s === 'X' ? ' ult' : ''}" data-s="${s}">
          <div class="key">${s}</div><div class="charges" data-n="ch${s}"></div><div class="cd" data-n="cd${s}"></div>
        </div>`).join('')}</div>
      <div class="hud-weapon"><small data-n="wname"></small><b data-n="ammo"></b><span data-n="reserve"></span></div>
      <div class="hud-spike" data-n="spike"></div>
      <div class="hud-progress"><small data-n="progLabel"></small><span class="bar"><i data-n="progBar"></i></span></div>
      <div class="hud-spect" data-n="spect"></div>
      <div class="hud-feed"></div>
      <div class="hud-banner"></div>
      <div class="hud-shop"></div>
      <div class="hud-board"></div>`;
    root.appendChild(this.el);
    this.el.querySelectorAll<HTMLElement>('[data-n]').forEach((n) => this.nodes.set(n.dataset.n!, n));
    this.shop = this.el.querySelector('.hud-shop')!;
    this.board = this.el.querySelector('.hud-board')!;
    this.feed = this.el.querySelector('.hud-feed')!;
    this.banner = this.el.querySelector('.hud-banner')!;
    this.blind = this.el.querySelector('.hud-blind')!;
  }

  private get human(): Agent {
    return this.sim.agentById(this.humanId)!;
  }

  private set(key: string, value: string, prop: 'text' | 'width' | 'html' = 'text'): void {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    const n = this.nodes.get(key);
    if (!n) return;
    if (prop === 'width') n.style.width = value;
    else if (prop === 'html') n.innerHTML = value;
    else n.textContent = value;
  }

  // ---------- per frame ----------

  update(spectating: Agent | null): void {
    const h = this.human;
    const m = this.sim.match;
    const us: Team = h.team;
    const them: Team = us === 'atk' ? 'def' : 'atk';
    this.set('us', String(m.scoreOf(us)));
    this.set('them', String(m.scoreOf(them)));
    this.set('round', `${t('hud.rodada').toUpperCase()} ${m.round}`);
    const tl = Math.max(0, m.timeLeft);
    this.set('time', m.phase === 'planted' || m.phase === 'warmup' ? '' : `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`);
    this.set('phase', t('phase.' + m.phase).toUpperCase());
    const pips = (team: Team): string => this.sim.agents.filter((a) => a.team === team).map((a) => `<i class="${a.alive ? '' : 'dead'}"></i>`).join('');
    this.set('aliveUs', pips(us), 'html');
    this.set('aliveThem', pips(them), 'html');
    this.set('credits', m.phase === 'buy' || this.shopOpen ? `¤ ${h.credits}  ·  ${t('hud.comprar').toUpperCase()}` : '');

    const who = spectating ?? h;
    this.set('hp', String(Math.ceil(Math.max(0, who.hp))));
    this.set('hpBar', `${Math.max(0, who.hp)}%`, 'width');
    this.set('arm', String(Math.ceil(who.armor)));
    for (const s of SLOTS) {
      const st = who.abilities[s];
      if (s === 'X') {
        const need = st.def.ultPoints;
        this.set('chX', Array.from({ length: need }, (_, i) => `<i class="${i < who.ultPoints ? 'on' : ''}"></i>`).join(''), 'html');
        this.set('cdX', '');
      } else {
        this.set(`ch${s}`, Array.from({ length: st.def.maxCharges }, (_, i) => `<i class="${i < st.charges ? 'on' : ''}"></i>`).join(''), 'html');
        this.set(`cd${s}`, st.cooldownLeft > 0 && st.charges < st.def.maxCharges && st.def.cooldown > 0 ? String(Math.ceil(st.cooldownLeft)) : '');
      }
    }
    const w = who.weapon;
    this.set('wname', w.def.name.toUpperCase());
    this.set('ammo', w.def.category === 'corpo' ? '' : String(w.ammo));
    this.set('reserve', w.def.category === 'corpo' ? t('hud.faca') : `/ ${w.reserve}`);

    const sp = m.spike;
    if (sp.status === 'planted') {
      const left = Math.max(0, SPIKE_TIME - (this.sim.time - sp.plantedAt));
      this.set('spike', `${t('hud.spikePlantada')} · ${left.toFixed(1)}s`);
    } else this.set('spike', h.alive && h.hasSpike ? t('hud.voceSpike') : '');

    const prog = who.plantProgress > 0 ? who.plantProgress / PLANT_TIME : who.defuseProgress > 0 ? who.defuseProgress / DEFUSE_TIME : 0;
    this.set('progLabel', who.plantProgress > 0 ? t('hud.plantando') : who.defuseProgress > 0 ? t('hud.spikeDesarmando') : '');
    this.set('progBar', `${Math.min(100, prog * 100)}%`, 'width');
    this.el.classList.toggle('progress-on', prog > 0);
    this.set('spect', spectating ? `${t('hud.espectando')} · ${spectating.name.toUpperCase()}` : '');
    this.el.classList.toggle('dead', !h.alive);

    const blind = h.alive && this.sim.time < h.blindUntil ? Math.min(1, (h.blindUntil - this.sim.time) / 0.6) * Math.max(0.3, h.blindStrength || 1) : 0;
    const bs = blind.toFixed(2);
    if (this.cache.get('blind') !== bs) {
      this.cache.set('blind', bs);
      this.blind.style.opacity = bs;
    }
    if (this.shopOpen) this.renderShop(false);
  }

  // ---------- events ----------

  killFeed(killer: Agent | undefined, victim: Agent, headshot: boolean, weaponName: string): void {
    const line = document.createElement('div');
    const side = (a: Agent | undefined): string => (a && a.team === this.human.team ? 'us' : 'them');
    line.innerHTML = `<span class="${side(killer)}">${esc(killer?.name ?? '—')}</span><em>${esc(weaponName)}${headshot ? ' ✦' : ''}</em><span class="${side(victim)}">${esc(victim.name)}</span>`;
    if (killer?.id === this.humanId || victim.id === this.humanId) line.classList.add('me');
    this.feed.prepend(line);
    while (this.feed.children.length > 6) this.feed.lastChild!.remove();
    setTimeout(() => line.remove(), 6000);
  }

  hitMarker(head: boolean): void {
    const el = document.createElement('div');
    el.className = head ? 'hud-hit head' : 'hud-hit';
    this.el.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  showBanner(title: string, sub: string, good: boolean, ms = 3000): void {
    this.banner.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    this.banner.className = `hud-banner on ${good ? 'good' : 'bad'}`;
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.banner.classList.remove('on'), ms);
  }

  // ---------- shop ----------

  toggleShop(open = !this.shopOpen): void {
    this.shopOpen = open;
    this.shop.classList.toggle('on', open);
    if (open) this.renderShop(true);
  }

  private renderShop(force: boolean): void {
    const h = this.human;
    const key = `${h.credits}|${h.armor}|${h.slots[1]?.def.id}|${h.slots[2]?.def.id}|${SLOTS.map((s) => h.abilities[s].charges).join()}|${this.sim.match.canBuy(h)}`;
    if (!force && this.cache.get('shopKey') === key) return;
    this.cache.set('shopKey', key);
    const can = this.sim.match.canBuy(h);
    const owned = (id: string): boolean => h.slots[1]?.def.id === id || h.slots[2]?.def.id === id;
    const card = (id: string, name: string, cost: number, sub: string, own: boolean): string =>
      `<button class="item${own ? ' own' : ''}${!own && (h.credits < cost || !can) ? ' poor' : ''}" data-buy="${id}"><b>${esc(name)}</b><small>${esc(sub)}</small><span>${own ? esc(t('shop.equipado')) : `¤ ${cost}`}</span></button>`;
    const weapons = SHOP_WEAPONS.map((id) => WEAPONS[id]).filter(Boolean)
      .map((w) => card(w.id, w.name, w.cost, t('cat.' + w.category), owned(w.id))).join('');
    const armor = ARMOR_ITEMS.map((a) => card(a.id, a.name, a.cost, `+${a.amount}`, h.armor >= a.amount)).join('');
    const abil = (['C', 'Q', 'E'] as const).map((s) => {
      const st = h.abilities[s];
      if (st.def.cost <= 0) return '';
      return card(s, `${s} · ${st.def.name}`, st.def.cost, `${st.charges}/${st.def.maxCharges}`, st.charges >= st.def.maxCharges);
    }).join('');
    this.shop.innerHTML = `
      <div class="box">
        <header><h2>${esc(t('shop.titulo').toUpperCase())}</h2><b>¤ ${h.credits}</b><small>${esc(can ? t('shop.fechar') : t('shop.fechada'))}</small></header>
        <div class="sec">${esc(t('shop.armas').toUpperCase())}</div><div class="grid">${weapons}</div>
        <div class="sec">${esc(t('shop.armadura').toUpperCase())}</div><div class="grid">${armor}</div>
        <div class="sec">${esc(t('shop.habilidades').toUpperCase())}</div><div class="grid">${abil}</div>
      </div>`;
    this.shop.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) => b.addEventListener('click', () => {
      this.sim.buy(this.humanId, b.dataset.buy!);
      this.renderShop(true);
    }));
  }

  // ---------- scoreboard ----------

  showBoard(on: boolean): void {
    this.board.classList.toggle('on', on);
    if (!on) return;
    const us = this.human.team;
    const row = (a: Agent): string => `<tr class="${a.alive ? '' : 'dead'}${a.id === this.humanId ? ' me' : ''}">
      <td>${esc(a.name)}</td><td>${esc(a.character.name)}</td><td>${a.stats.kills}</td><td>${a.stats.deaths}</td><td>${a.stats.assists}</td>
      <td>${a.stats.score}</td><td>${a.team === us ? `¤ ${a.credits}` : ''}</td></tr>`;
    const team = (tm: Team, cls: string): string => `<tbody class="${cls}">${this.sim.agents.filter((a) => a.team === tm).sort((a, b) => b.stats.score - a.stats.score).map(row).join('')}</tbody>`;
    const them: Team = us === 'atk' ? 'def' : 'atk';
    this.board.innerHTML = `<div class="box"><table>
      <thead><tr><th>${esc(t('placar.jogador'))}</th><th>${esc(t('placar.agente'))}</th><th>${esc(t('placar.kills'))}</th><th>${esc(t('placar.mortes'))}</th><th>${esc(t('placar.assistencias'))}</th><th>${esc(t('placar.pontos'))}</th><th>${esc(t('hud.creditos'))}</th></tr></thead>
      ${team(us, 'us')}${team(them, 'them')}</table></div>`;
  }

  dispose(): void {
    clearTimeout(this.bannerTimer);
    this.el.remove();
  }
}
