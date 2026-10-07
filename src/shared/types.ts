// Tipos puros do jogo. Nada aqui depende do Phaser, React ou navegador,
// para que o mesmo código rode no servidor socket.io no futuro.

export type CharacterId = 'crono' | 'marle' | 'lucca' | 'frog' | 'robo' | 'ayla' | 'magus';

export type Element = 'raio' | 'agua' | 'fogo' | 'sombra' | 'fisico';

/** As 4 ações de todo personagem (teclas Y, U, I, O). */
export type Slot = 'attack' | 'parry' | 'skill' | 'ultimate';

export type StatusId = 'burn' | 'defDown' | 'atkUp' | 'regen';

export interface StatusApply {
  id: StatusId;
  /** Duração em segundos. */
  seconds: number;
}

/**
 * Como a habilidade acontece no espaço:
 * - melee: golpe na frente de quem usa
 * - projectile: disparo que anda em linha reta pela faixa de profundidade
 * - aoeSelf: área em volta de quem usa
 * - aoeTarget: área marcada no chão onde o alvo estava; cai depois de um tempo (dá para desviar)
 * - dash: avança causando dano no caminho
 * - buff: cura ou efeito em si mesmo
 * - parry: janela de defesa
 */
export type AbilityKind = 'melee' | 'projectile' | 'aoeSelf' | 'aoeTarget' | 'dash' | 'buff' | 'parry';

export interface Ability {
  slot: Slot;
  kind: AbilityKind;
  name: string;
  description: string;
  /** Poder total (dividido entre os golpes). 0 = sem dano. */
  power: number;
  scaling: 'atk' | 'mag';
  element: Element;
  mpCost: number;
  /** Recarga em segundos depois de usar. */
  cooldown: number;
  /** Quadros (60/s) antes do efeito sair. */
  startup: number;
  /** Quadros em que o efeito está ativo. */
  active: number;
  /** Quadros parado depois do efeito. */
  recovery: number;
  /** Alcance do golpe, raio da área ou distância do avanço, em pixels. */
  range: number;
  /** Tolerância de profundidade (quão alinhado o alvo precisa estar). */
  depth: number;
  /** Velocidade do projétil em px por quadro. */
  speed?: number;
  hits?: number;
  knockback?: number;
  healPct?: number;
  applyToTarget?: StatusApply[];
  applyToSelf?: StatusApply[];
  /** Poder extra proporcional ao HP perdido (Frog Squash). */
  missingHpBonus?: number;
  /** Quem usa salta para o local da área (Frog Squash). */
  leapToTarget?: boolean;
  /** Cor dos efeitos visuais. */
  color: number;
}

export interface CharacterStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  mag: number;
  def: number;
  /** Velocidade de andar em px por quadro. */
  speed: number;
}

export interface Palette {
  hair: number;
  skin: number;
  outfit: number;
  accent: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  era: string;
  element: Element;
  bio: string;
  stats: CharacterStats;
  palette: Palette;
  abilities: Record<Slot, Ability>;
}
