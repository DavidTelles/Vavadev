import type { AbilitySlot, Role } from '../types';

export type AbilityKind =
  | 'smoke' | 'flash' | 'molly' | 'grenade' | 'wall' | 'slow' | 'reveal' | 'sensor' | 'trap' | 'heal' | 'dash'
  | 'blink' | 'updraft' | 'turret' | 'shield' | 'revive' | 'ultWeapon' | 'airstrike' | 'revealAll' | 'fury'
  | 'lockdown' | 'wave' | 'poisonField' | 'blackout';

export type Delivery = 'throw' | 'aim' | 'self' | 'place';

export interface AbilityParams {
  radius?: number;
  duration?: number;
  damage?: number;
  range?: number;
  amount?: number;
  speed?: number;
  count?: number;
  slow?: number;
  fuse?: number;
  weapon?: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  slot: AbilitySlot;
  kind: AbilityKind;
  delivery: Delivery;
  cost: number;
  maxCharges: number;
  freeCharges: number;
  cooldown: number;
  ultPoints: number;
  color: number;
  params: AbilityParams;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  role: Role;
  title: string;
  bio: string;
  personality: string;
  lines: { select: string; ult: string; kill: string; plant: string; win: string };
  abilities: Record<AbilitySlot, AbilityDef>;
}

export const ROLE_NAMES: Record<Role, string> = {
  duelista: 'Duelista',
  controlador: 'Controlador',
  iniciador: 'Iniciador',
  sentinela: 'Sentinela',
};

type AbilityInput = Omit<AbilityDef, 'slot' | 'id' | 'freeCharges' | 'cooldown' | 'ultPoints' | 'cost' | 'maxCharges'> &
  Partial<Pick<AbilityDef, 'freeCharges' | 'cooldown' | 'ultPoints' | 'cost' | 'maxCharges'>>;

function kit(id: string, c: AbilityInput, q: AbilityInput, e: AbilityInput, x: AbilityInput): Record<AbilitySlot, AbilityDef> {
  const mk = (slot: AbilitySlot, a: AbilityInput, d: Partial<AbilityDef>): AbilityDef => ({
    id: `${id}_${slot}`,
    slot,
    cost: 0,
    maxCharges: 1,
    freeCharges: 0,
    cooldown: 0,
    ultPoints: 0,
    ...d,
    ...a,
  });
  return {
    C: mk('C', c, { cost: 200, maxCharges: 1 }),
    Q: mk('Q', q, { cost: 250, maxCharges: 2 }),
    E: mk('E', e, { cost: 0, maxCharges: 1, freeCharges: 1, cooldown: 40 }),
    X: mk('X', x, { cost: 0, maxCharges: 1, ultPoints: 7 }),
  };
}

export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'david', name: 'David', role: 'duelista', title: 'O Relâmpago',
    bio: 'Engenheiro elétrico que transformou o próprio corpo em bateria. Entra primeiro e sai por último.',
    personality: 'Confiante, competitivo e sempre com uma piada pronta.',
    lines: { select: 'Liga a energia que eu vou na frente!', ult: 'Tempestade chegando!', kill: 'Curto-circuito!', plant: 'Spike ativada, cobrindo!', win: 'Essa foi elétrica!' },
    abilities: kit('david',
      { name: 'Granada Elétrica', description: 'Arremessa uma granada que explode causando dano em área.', kind: 'grenade', delivery: 'throw', color: 0x4fc3ff, params: { radius: 4.5, damage: 110, fuse: 1.4 } },
      { name: 'Clarão Estático', description: 'Lança uma esfera que explode em luz e cega quem estiver olhando.', kind: 'flash', delivery: 'throw', color: 0xbfe8ff, params: { duration: 2.2, fuse: 0.6, radius: 30 } },
      { name: 'Arrancada', description: 'Avança rapidamente na direção do movimento. Recarrega com o tempo.', kind: 'dash', delivery: 'self', color: 0x4fc3ff, params: { speed: 19 }, maxCharges: 1, freeCharges: 1, cooldown: 30 },
      { name: 'Tempestade', description: 'Equipa um fuzil elétrico preciso por 14 segundos.', kind: 'ultWeapon', delivery: 'self', color: 0x6fd6ff, params: { weapon: 'tempestade', duration: 14 }, ultPoints: 7 },
    ),
  },
  {
    id: 'jaogugu', name: 'Jão Gugu', role: 'controlador', title: 'O Fumaceiro',
    bio: 'Mestre do churrasco de domingo que descobriu que fumaça também ganha rodadas.',
    personality: 'Tranquilo, engraçado e sempre fala com calma.',
    lines: { select: 'Calma, deixa que eu fecho a visão.', ult: 'Apagão! Ninguém vê nada!', kill: 'Ao ponto!', plant: 'Plantei, segura aí.', win: 'Rodada no capricho!' },
    abilities: kit('jaogugu',
      { name: 'Lama Grudenta', description: 'Arremessa lama que deixa inimigos lentos na área.', kind: 'slow', delivery: 'throw', color: 0x7a5a3a, params: { radius: 4, duration: 6, slow: 0.5, fuse: 1 } },
      { name: 'Brasa Viva', description: 'Joga carvão em brasa que queima a área por alguns segundos.', kind: 'molly', delivery: 'throw', color: 0xff6a1a, params: { radius: 3.5, duration: 6, damage: 45, fuse: 1.2 } },
      { name: 'Fumaça de Churrasco', description: 'Cria uma nuvem de fumaça no ponto mirado (até 40 m). Até 2 cargas.', kind: 'smoke', delivery: 'aim', color: 0xb8b0a8, params: { radius: 4.2, duration: 16, range: 40 }, maxCharges: 2, freeCharges: 2, cooldown: 35 },
      { name: 'Apagão', description: 'Cobre uma área enorme com fumaça densa e deixa inimigos lentos.', kind: 'blackout', delivery: 'aim', color: 0x50505a, params: { radius: 11, duration: 14, slow: 0.7, range: 50 }, ultPoints: 7 },
    ),
  },
  {
    id: 'china', name: 'China', role: 'iniciador', title: 'A Farejadora',
    bio: 'Programadora que hackeou radares de satélite. Sempre sabe onde você está.',
    personality: 'Analítica, rápida no raciocínio e direta.',
    lines: { select: 'Já mapeei tudo. Vamos.', ult: 'Varredura total! Estão todos marcados!', kill: 'Achei você.', plant: 'Spike no chão!', win: 'Os dados não mentem.' },
    abilities: kit('china',
      { name: 'Choque Atordoante', description: 'Granada que atordoa: inimigos ficam lentos e imprecisos.', kind: 'slow', delivery: 'throw', color: 0xffe14a, params: { radius: 5, duration: 3, slow: 0.4, fuse: 0.9 } },
      { name: 'Flecha Cega', description: 'Projétil luminoso que cega quem olhar para ele.', kind: 'flash', delivery: 'throw', color: 0xfff7c2, params: { duration: 2, fuse: 0.45, radius: 30 }, maxCharges: 2 },
      { name: 'Radar', description: 'Pulso de reconhecimento no ponto mirado que revela inimigos visíveis próximos.', kind: 'reveal', delivery: 'aim', color: 0xffd34a, params: { radius: 14, duration: 3, range: 45 }, cooldown: 35 },
      { name: 'Varredura Total', description: 'Revela a posição de todos os inimigos em três pulsos.', kind: 'revealAll', delivery: 'self', color: 0xffd34a, params: { count: 3, duration: 1.6 }, ultPoints: 7 },
    ),
  },
  {
    id: 'mallcon', name: 'Mallcon', role: 'duelista', title: 'O Furacão',
    bio: 'Atleta de parkour que nunca encontrou uma parede que não pudesse escalar.',
    personality: 'Explosivo, barulhento e cheio de energia.',
    lines: { select: 'Bora pra cima deles!', ult: 'Agora é FÚRIA!', kill: 'Atropelado!', plant: 'Plantadíssimo!', win: 'Ninguém segura!' },
    abilities: kit('mallcon',
      { name: 'Salto Turbo', description: 'Impulso vertical para alcançar posições elevadas.', kind: 'updraft', delivery: 'self', color: 0x9dff7a, params: { speed: 9.5 }, maxCharges: 2 },
      { name: 'Granada de Fragmentação', description: 'Granada clássica com grande dano em área.', kind: 'grenade', delivery: 'throw', color: 0xff9a3a, params: { radius: 5, damage: 125, fuse: 1.6 }, maxCharges: 1, cost: 300 },
      { name: 'Vida Roubada', description: 'Recupera vida rapidamente por alguns segundos.', kind: 'heal', delivery: 'self', color: 0x9dff7a, params: { amount: 60, duration: 3 }, cooldown: 35 },
      { name: 'Fúria', description: 'Por 10 segundos: mais velocidade, cadência e recarga, e escudo regenerativo.', kind: 'fury', delivery: 'self', color: 0xff4a3a, params: { duration: 10, amount: 50 }, ultPoints: 6 },
    ),
  },
  {
    id: 'mirela', name: 'Mirela', role: 'sentinela', title: 'A Guardiã',
    bio: 'Enfermeira de emergência e estrategista nata. Protege o time como protege a família.',
    personality: 'Firme, acolhedora e com liderança natural.',
    lines: { select: 'Ninguém fica pra trás.', ult: 'Levanta! Ainda não acabou!', kill: 'Área protegida.', plant: 'Spike plantada, protejam!', win: 'Time unido vence.' },
    abilities: kit('mirela',
      { name: 'Fio de Alerta', description: 'Instala um fio que revela e deixa lento quem cruzar.', kind: 'trap', delivery: 'place', color: 0xff5ab8, params: { radius: 2.2, duration: 3, slow: 0.5, damage: 0 }, maxCharges: 2 },
      { name: 'Torreta Sentinela', description: 'Posiciona uma torreta que atira em inimigos à vista.', kind: 'turret', delivery: 'place', color: 0xff5ab8, params: { damage: 9, range: 35, duration: 45 }, cost: 300, maxCharges: 1 },
      { name: 'Cuidado', description: 'Cura um aliado mirado (ou a si mesma) ao longo do tempo.', kind: 'heal', delivery: 'aim', color: 0x7affc8, params: { amount: 80, duration: 4, range: 20 }, cooldown: 40 },
      { name: 'Renascer', description: 'Revive o aliado abatido mais próximo da mira com vida total.', kind: 'revive', delivery: 'aim', color: 0x7affc8, params: { range: 40 }, ultPoints: 8 },
    ),
  },
  {
    id: 'caio', name: 'Caio', role: 'controlador', title: 'O Arquiteto',
    bio: 'Estudante de arquitetura que constrói muros e derruba planos inimigos.',
    personality: 'Metódico, calmo e perfeccionista.',
    lines: { select: 'Tudo calculado.', ult: 'Bombardeio a caminho!', kill: 'Estrutura demolida.', plant: 'Spike posicionada conforme o projeto.', win: 'Obra entregue.' },
    abilities: kit('caio',
      { name: 'Muralha', description: 'Ergue uma parede de concreto que bloqueia passagem e tiros.', kind: 'wall', delivery: 'aim', color: 0xc9b8a0, params: { duration: 20, amount: 600, range: 12 } },
      { name: 'Mina de Lentidão', description: 'Arremessa uma mina que deixa a área lenta.', kind: 'slow', delivery: 'throw', color: 0x8ab4ff, params: { radius: 4.5, duration: 5, slow: 0.45, fuse: 0.8 } },
      { name: 'Cúpula', description: 'Cria uma cúpula de fumaça no ponto mirado (até 45 m).', kind: 'smoke', delivery: 'aim', color: 0x9aa4b8, params: { radius: 4.5, duration: 15, range: 45 }, maxCharges: 2, freeCharges: 2, cooldown: 40 },
      { name: 'Bombardeio', description: 'Chama uma série de explosões na área mirada após um curto atraso.', kind: 'airstrike', delivery: 'aim', color: 0xff7a3a, params: { radius: 5, damage: 140, count: 5, range: 70, fuse: 2 }, ultPoints: 8 },
    ),
  },
  {
    id: 'boquinha', name: 'Boquinha', role: 'iniciador', title: 'O Eco',
    bio: 'DJ de festas que transforma ondas sonoras em armas. Escuta até os passos mais leves.',
    personality: 'Brincalhão, falante e carismático.',
    lines: { select: 'Aumenta o som!', ult: 'Microfonia! Tapa os ouvidos!', kill: 'Silenciado.', plant: 'Spike tocando no volume máximo!', win: 'Essa rodada foi um hit!' },
    abilities: kit('boquinha',
      { name: 'Grito', description: 'Um grito ensurdecedor que cega quem estiver à frente, a curta distância.', kind: 'flash', delivery: 'throw', color: 0xd28aff, params: { duration: 1.8, fuse: 0.25, radius: 18 }, maxCharges: 2 },
      { name: 'Fone Espião', description: 'Sensor que revela inimigos que passarem perto por 30 segundos.', kind: 'sensor', delivery: 'place', color: 0xd28aff, params: { radius: 7, duration: 30 } },
      { name: 'Eco', description: 'Onda sonora no ponto mirado que revela inimigos próximos.', kind: 'reveal', delivery: 'aim', color: 0xd28aff, params: { radius: 12, duration: 3, range: 40 }, cooldown: 30 },
      { name: 'Microfonia', description: 'Onda enorme ao seu redor que cega e deixa inimigos lentos.', kind: 'wave', delivery: 'self', color: 0xd28aff, params: { radius: 22, duration: 3, slow: 0.5 }, ultPoints: 7 },
    ),
  },
  {
    id: 'garcia', name: 'Garcia', role: 'sentinela', title: 'A Muralha',
    bio: 'Ex-segurança de show, grande e inabalável. Onde ele está, ninguém passa.',
    personality: 'Bonachão, protetor e muito teimoso.',
    lines: { select: 'Por aqui ninguém passa.', ult: 'Fortaleza ativada!', kill: 'Barrado na porta.', plant: 'Plantei. Agora vem tirar.', win: 'Segurança garantida.' },
    abilities: kit('garcia',
      { name: 'Barricada', description: 'Ergue uma barricada reforçada que bloqueia passagem e tiros.', kind: 'wall', delivery: 'aim', color: 0xffb84a, params: { duration: 25, amount: 900, range: 8 } },
      { name: 'Armadilha de Urso', description: 'Armadilha escondida que causa dano e prende inimigos.', kind: 'trap', delivery: 'place', color: 0xffb84a, params: { radius: 1.8, duration: 3, slow: 0.15, damage: 40 }, maxCharges: 2 },
      { name: 'Couraça', description: 'Recebe 50 de escudo extra até o fim da rodada.', kind: 'shield', delivery: 'self', color: 0xffd27a, params: { amount: 50 }, cooldown: 45 },
      { name: 'Fortaleza', description: 'Cria uma zona enorme ao seu redor que revela e deixa inimigos muito lentos.', kind: 'lockdown', delivery: 'self', color: 0xffb84a, params: { radius: 16, duration: 10, slow: 0.35 }, ultPoints: 7 },
    ),
  },
  {
    id: 'biro', name: 'Biro', role: 'duelista', title: 'O Fantasma',
    bio: 'Mágico de rua que aprendeu a sumir de verdade. Aparece onde menos se espera.',
    personality: 'Misterioso, debochado e muito rápido.',
    lines: { select: 'Agora você me vê...', ult: 'Lâminas fantasmas!', kill: 'Truque de mágica.', plant: 'Spike apareceu do nada.', win: 'E... sumiu!' },
    abilities: kit('biro',
      { name: 'Véu de Fumaça', description: 'Cria uma pequena fumaça no ponto mirado (até 20 m).', kind: 'smoke', delivery: 'aim', color: 0x6a5a8a, params: { radius: 3.2, duration: 8, range: 20 }, maxCharges: 2, cost: 100 },
      { name: 'Clarão Fantasma', description: 'Lança um clarão rápido que cega por pouco tempo.', kind: 'flash', delivery: 'throw', color: 0xd6c8ff, params: { duration: 1.5, fuse: 0.35, radius: 25 }, maxCharges: 2 },
      { name: 'Piscar', description: 'Teleporta alguns metros na direção da mira.', kind: 'blink', delivery: 'aim', color: 0x8a6aff, params: { range: 9 }, cooldown: 25 },
      { name: 'Lâminas Fantasmas', description: 'Equipa 5 facas de arremesso letais. Abates recarregam todas.', kind: 'ultWeapon', delivery: 'self', color: 0x8a6aff, params: { weapon: 'laminas', duration: 20 }, ultPoints: 6 },
    ),
  },
  {
    id: 'isabela', name: 'Isabela', role: 'iniciador', title: 'A Estrategista',
    bio: 'Capitã do time de vôlei que lê o jogo antes de todo mundo.',
    personality: 'Determinada, organizada e incentivadora.',
    lines: { select: 'Sigam o plano!', ult: 'Onda paralisante, avancem!', kill: 'Ponto nosso!', plant: 'Spike plantada, posições!', win: 'Jogada perfeita!' },
    abilities: kit('isabela',
      { name: 'Bomba de Pulso', description: 'Granada que causa dano leve e atordoa inimigos na área.', kind: 'grenade', delivery: 'throw', color: 0x4affd2, params: { radius: 4, damage: 50, fuse: 1 } },
      { name: 'Saque Ofuscante', description: 'Projétil que explode em luz forte após um quique.', kind: 'flash', delivery: 'throw', color: 0xe0fff6, params: { duration: 2.4, fuse: 0.7, radius: 32 }, maxCharges: 2 },
      { name: 'Batedor', description: 'Pulso de reconhecimento de longo alcance no ponto mirado.', kind: 'reveal', delivery: 'aim', color: 0x4affd2, params: { radius: 15, duration: 3, range: 60 }, cooldown: 40 },
      { name: 'Onda Paralisante', description: 'Onda em linha reta que deixa lentos e revela inimigos atingidos.', kind: 'lockdown', delivery: 'aim', color: 0x4affd2, params: { radius: 6, duration: 5, slow: 0.4, range: 40, count: 6 }, ultPoints: 7 },
    ),
  },
  {
    id: 'julia', name: 'Julia', role: 'controlador', title: 'A Jardineira',
    bio: 'Bióloga e botânica que cultiva plantas perigosas no próprio quintal.',
    personality: 'Doce na conversa, impiedosa na partida.',
    lines: { select: 'Vamos plantar algumas surpresas.', ult: 'Jardim venenoso! Cuidado onde pisam.', kill: 'Podado.', plant: 'Plantei a semente.', win: 'Colhemos a vitória.' },
    abilities: kit('julia',
      { name: 'Espinhos', description: 'Semente que brota espinhos venenosos causando dano na área.', kind: 'molly', delivery: 'throw', color: 0x5aff6a, params: { radius: 3.2, duration: 7, damage: 38, fuse: 1 } },
      { name: 'Pólen', description: 'Nuvem de pólen que deixa inimigos lentos.', kind: 'slow', delivery: 'throw', color: 0xfff27a, params: { radius: 4.5, duration: 6, slow: 0.55, fuse: 1 } },
      { name: 'Névoa Floral', description: 'Cria uma névoa verde densa no ponto mirado (até 40 m).', kind: 'smoke', delivery: 'aim', color: 0x8ac89a, params: { radius: 4.3, duration: 15, range: 40 }, maxCharges: 2, freeCharges: 2, cooldown: 38 },
      { name: 'Jardim Venenoso', description: 'Uma área enorme de plantas venenosas causa dano contínuo a inimigos.', kind: 'poisonField', delivery: 'aim', color: 0x5aff6a, params: { radius: 9, duration: 9, damage: 22, range: 50 }, ultPoints: 7 },
    ),
  },
];

export const CHARACTER_BY_ID: Record<string, CharacterDefinition> = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
