// Tipos puros do jogo. Nada aqui depende do Phaser nem do navegador,
// para que o mesmo código rode no servidor socket.io no futuro.

export type CharacterId = 'crono' | 'marle' | 'lucca' | 'frog' | 'robo' | 'ayla' | 'magus';

export type Element = 'raio' | 'agua' | 'fogo' | 'sombra' | 'fisico';

/** As 4 ações de todo personagem. */
export type ActionKind = 'attack' | 'parry' | 'skill' | 'ultimate';

export type StatusId = 'burn' | 'defDown' | 'atkUp' | 'regen';

export interface StatusApply {
  id: StatusId;
  turns: number;
}

export interface Ability {
  kind: ActionKind;
  name: string;
  description: string;
  /** Poder base do golpe. 0 = não causa dano. */
  power: number;
  /** Qual atributo escala o dano. */
  scaling: 'atk' | 'mag';
  element: Element;
  /** Custo de MP (só habilidades). */
  mpCost: number;
  /** Número de golpes, só para animação. */
  hits?: number;
  /** Cura uma fração do HP máximo de quem usa. */
  healPct?: number;
  applyToTarget?: StatusApply[];
  applyToSelf?: StatusApply[];
  /** Poder extra proporcional ao HP perdido (ex.: Frog Squash). 1 = +100% com HP quase zerado. */
  missingHpBonus?: number;
}

export interface CharacterStats {
  maxHp: number;
  maxMp: number;
  atk: number;
  mag: number;
  def: number;
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
  abilities: Record<ActionKind, Ability>;
}
