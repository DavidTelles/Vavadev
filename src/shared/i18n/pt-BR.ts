/**
 * i18n — Portuguese do Brasil (PT-BR)
 *
 * Single source of truth for every player-facing string. UI code must read
 * strings through the `t()` helper below so no English leaks into the UI.
 * Ability/item/weapon names live in src/shared/data (already in PT-BR) and
 * are referenced by id here where a UI label is needed.
 */

export type Lang = 'pt-BR';

const DICT: Record<string, string> = {
  // ---------- Main menu ----------
  'menu.title': 'Esquadrão dos Amigos',
  'menu.jogar': 'Jogar',
  'menu.treinamento': 'Treinamento',
  'menu.personagens': 'Personagens',
  'menu.configuracoes': 'Configurações',
  'menu.sair': 'Sair',
  'menu.conectando': 'Conectando...',
  'menu.marca1': 'ESQUADRÃO',
  'menu.marca2': '// DOS AMIGOS',
  'menu.lema': 'NAS SOMBRAS, ACHAMOS PROPÓSITO',
  'menu.agentes': 'Agentes',
  'menu.arsenal': 'Arsenal',
  'menu.mapas': 'Mapas',
  'menu.carreira': 'Carreira',
  'menu.loja': 'Loja',
  'menu.social': 'Social',
  'menu.tabInicio': 'Início',
  'menu.tabNoticias': 'Notícias',
  'menu.tabNotas': 'Notas da versão',
  'menu.tabCampeonatos': 'Campeonatos',
  'menu.moedaFragmentos': 'Fragmentos',
  'menu.moedaFichas': 'Fichas',
  'menu.noticiaTag': '// NOTÍCIAS',
  'menu.noticiaTitulo': 'A USINA SE LEMBRA',
  'menu.noticiaTexto': 'ALGUMAS PROMESSAS\nNUNCA MORREM',
  'menu.statusTag': 'STATUS DO SISTEMA',
  'menu.statusOnline': 'ONLINE',
  'menu.statusTexto': 'BOTS PRONTOS\nTODAS AS REDES ESTÁVEIS',
  'menu.versao': 'VERSÃO 0.9.7 // USINA',
  'menu.frase1': 'DISCIPLINA HOJE.',
  'menu.frase2': 'LIBERDADE AMANHÃ.',
  'menu.dicaSelecionar': 'ENTER SELECIONAR',
  'menu.dicaVoltar': 'ESC VOLTAR',
  'menu.dicaCanais': 'TAB CANAIS',
  'menu.dicaAjuda': 'F1 AJUDA',
  'menu.emBreve': 'EM BREVE',
  'menu.emBreveTexto': 'Esta área chega numa próxima atualização.',
  'menu.iniciar': 'INICIAR PARTIDA',
  'menu.carregando': 'CARREGANDO PARTIDA...',
  'menu.modo': 'MODO',
  'menu.dificuldade': 'DIFICULDADE',
  'menu.mapa': 'MAPA',
  'menu.agente': 'AGENTE',
  'menu.trocar': 'TROCAR',
  'menu.selecionar': 'SELECIONAR',
  'menu.selecionado': 'SELECIONADO',
  'menu.todos': 'TODOS',
  'menu.habilidades': 'HABILIDADES',
  'menu.cargas': 'cargas',
  'menu.gratis': 'grátis',
  'menu.recarga': 'recarga',
  'menu.pontosUlt': 'pontos',
  'menu.perfil': 'Perfil',
  'menu.ajuda': 'Ajuda',
  'menu.nomeJogador': 'Nome do jogador',
  'menu.partidas': 'PARTIDAS',
  'menu.vitorias': 'VITÓRIAS',
  'menu.taxaVitoria': 'TAXA DE VITÓRIA',
  'menu.kd': 'ABATES / MORTES',
  'menu.historico': 'HISTÓRICO',
  'menu.semPartidas': 'Nenhuma partida jogada ainda. Que tal a primeira?',
  'menu.mapaUsina': 'USINA',
  'menu.mapaUsinaDesc': 'Hidrelétrica abandonada no fim do vale. Dois bombsites, um corredor central e passarelas acima das turbinas.',
  'menu.atacantesBase': 'Base atacante',
  'menu.defensoresBase': 'Base defensora',
  'menu.preco': 'PREÇO',
  'menu.danoCorpo': 'DANO (CORPO)',
  'menu.cadencia': 'CADÊNCIA',
  'menu.pente': 'PENTE',
  'menu.gratuita': 'GRÁTIS',
  'menu.notasTexto': '• Menu principal novo, com a cidade ao vivo e seu agente em 3D.\n• Escolha de agente com as 4 habilidades.\n• Configurações salvas no navegador.\n• Mapa Usina com sites A e B.',
  'menu.noticiasTexto': 'A temporada "Réquiem da Usina" começou. Onze amigos, um vale apagado e uma Spike que ninguém deveria ter achado.',
  'menu.controles': 'WASD mover · Espaço pular · Ctrl agachar · Shift andar\nMouse atirar/mirar · R recarregar · 1/2/3 armas\nQ E C X habilidades · F interagir · G largar arma\nB loja · Tab placar · Esc pausa',
  'menu.ajudaTitulo': 'CONTROLES',
  'cat.pistola': 'Pistola',
  'cat.submetralhadora': 'Submetralhadora',
  'cat.escopeta': 'Escopeta',
  'cat.fuzil': 'Fuzil',
  'cat.precisao': 'Precisão',
  'cat.pesada': 'Pesada',
  'cat.corpo': 'Corpo a corpo',
  'cat.especial': 'Especial',
  'hud.faca': 'FACA',
  'hud.hp': 'VIDA',
  'hud.arm': 'ESCUDO',
  'hud.voceSpike': 'VOCÊ ESTÁ COM A SPIKE · SEGURE 4 NO SITE',
  'hud.plantando': 'Plantando...',
  'hud.espectando': 'ESPECTANDO',
  'hud.atacando': 'ATACANDO',
  'hud.defendendo': 'DEFENDENDO',
  'shop.fechar': 'B PARA FECHAR',
  'shop.fechada': 'LOJA FECHADA',
  'shop.habilidades': 'Habilidades',

  // ---------- Mode selection ----------
  'mode.titulo': 'Escolha o modo',
  'mode.competitivo': 'Competitivo',
  'mode.competitivoDesc': 'Primeiro a 13 rodadas, lados invertem no meio.',
  'mode.rapida': 'Partida rápida',
  'mode.rapidaDesc': 'Primeiro a 5 rodadas, partida curta.',
  'mode.treino': 'Treinamento',
  'mode.treinoDesc': 'Solo contra bots, recursos ilimitados.',
  'mode.voltar': 'Voltar',

  // ---------- Character select ----------
  'select.titulo': 'Escolha seu agente',
  'select.confirmar': 'Confirmar',
  'select.voltar': 'Voltar',
  'select.preview': 'Pré-visualização 3D',
  'select.roleDuelista': 'Duelista',
  'select.roleControlador': 'Controlador',
  'select.roleIniciador': 'Iniciador',
  'select.roleSentinela': 'Sentinela',

  // ---------- HUD ----------
  'hud.rodada': 'Rodada',
  'hud.tempo': 'Tempo',
  'hud.creditos': 'Créditos',
  'hud.vida': 'Vida',
  'hud.armadura': 'Armadura',
  'hud.municao': 'Munição',
  'hud.reserva': 'Reserva',
  'hud.ultimo': 'ÚLTIMO',
  'hud.spikeCarregando': 'Spike carregando',
  'hud.spikePlantada': 'SPIKE PLANTADA',
  'hud.spikeDesarmando': 'Desarmando...',
  'hud.compra': 'Fase de compra',
  'hud.comprar': 'Comprar (B)',
  'hud.placar': 'Placar (Tab)',
  'hud.pausar': 'Pausar (Esc)',
  'hud.interagir': 'Interagir (F)',
  'hud.recarregar': 'Recarregar (R)',
  'hud.semMunicao': 'Sem munição',

  // ---------- Buy shop ----------
  'shop.titulo': 'Loja',
  'shop.armas': 'Armas',
  'shop.armadura': 'Armadura',
  'shop.comprar': 'Comprar',
  'shop.semCreditos': 'Sem créditos suficientes',
  'shop.equipado': 'Equipado',
  'shop.colete': 'Colete Leve',
  'shop.blindagem': 'Blindagem Pesada',

  // ---------- Scoreboard ----------
  'placar.titulo': 'Placar',
  'placar.jogador': 'Jogador',
  'placar.agente': 'Agente',
  'placar.kills': 'Abates',
  'placar.mortes': 'Mortes',
  'placar.assistencias': 'Assistências',
  'placar.dano': 'Dano',
  'placar.pontos': 'Pontos',
  'placar.ping': 'Ping',
  'placar.atacantes': 'Atacantes',
  'placar.defensores': 'Defensores',

  // ---------- Pause ----------
  'pausa.titulo': 'Pausado',
  'pausa.continuar': 'Continuar',
  'pausa.configuracoes': 'Configurações',
  'pausa.sairMenu': 'Sair para o menu',

  // ---------- Settings ----------
  'settings.titulo': 'Configurações',
  'settings.sensibilidade': 'Sensibilidade do mouse',
  'settings.fov': 'Campo de visão (FOV)',
  'settings.volumeSfx': 'Volume de efeitos',
  'settings.volumeVoz': 'Volume de voz',
  'settings.volumeMusica': 'Volume de música',
  'settings.graficos': 'Qualidade gráfica',
  'settings.graficoBaixa': 'Baixa',
  'settings.graficoMedia': 'Média',
  'settings.graficoAlta': 'Alta',
  'settings.dificuldade': 'Dificuldade dos bots',
  'settings.dificuldadeFacil': 'Fácil',
  'settings.dificuldadeNormal': 'Normal',
  'settings.dificuldadeDificil': 'Difícil',
  'settings.aplicar': 'Aplicar',
  'settings.voltar': 'Voltar',

  // ---------- Round / match phases ----------
  'phase.warmup': 'Aquecimento',
  'phase.buy': 'Compra',
  'phase.combat': 'Combate',
  'phase.planted': 'Spike plantada',
  'phase.roundEnd': 'Fim da rodada',
  'phase.matchEnd': 'Fim da partida',

  // ---------- Round end reasons ----------
  'reason.eliminacao': 'Eliminação',
  'reason.explosao': 'Explosão',
  'reason.desarme': 'Desarme',
  'reason.tempo': 'Tempo esgotado',

  // ---------- Victory / defeat ----------
  'result.vitoria': 'VITÓRIA',
  'result.derrota': 'DERROTA',
  'result.empate': 'EMPATE',
  'result.placar': 'Placar',
  'result.proximaRodada': 'Próxima rodada',
  'result.menuPrincipal': 'Menu principal',

  // ---------- Kill feed ----------
  'feed.abate': 'abateu',
  'feed.headshot': 'TIRO NA CABEÇA',

  // ---------- Notices ----------
  'notice.escolhaSeuAgente': 'Escolha seu agente',
  'notice.esperaRodada': 'Aguardando próxima rodada...',
  'notice.spikeEntregue': 'Spike entregue',
  'notice.spikePlantada': 'A Spike foi plantada!',
  'notice.spikeDesarmada': 'A Spike foi desarmada!',
  'notice.spikeExplodiu': 'A Spike explodiu!',
  'notice.ladoTrocado': 'Lados invertidos',
  'notice.venceuRodada': 'Sua equipe venceu a rodada',
  'notice.perdeuRodada': 'Sua equipe perdeu a rodada',

  // ---------- Ability slots ----------
  'slot.C': 'C',
  'slot.Q': 'Q',
  'slot.E': 'E',
  'slot.X': 'X (Ult)',
  'slot.custo': 'Custo',

  // ---------- Voice line categories (labels only; lines are per-character) ----------
  'voice.select': 'Seleção',
  'voice.ult': 'Ultimate',
  'voice.kill': 'Abate',
  'voice.plant': 'Plant',
  'voice.win': 'Vitória',
};

// Fallback for any missing key: return the key itself so it's obvious.
export function t(key: string): string {
  return DICT[key] ?? key;
}

export function tKey(key: string): string {
  return key;
}

export const LANG: Lang = 'pt-BR';
