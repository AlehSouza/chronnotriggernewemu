import type { CharacterId } from '../shared/types';
import generated from './sprites.generated.json';

/** idle/walk são de lado; _down = de frente, _up = de costas (vista de cima, como em Chrono Trigger). */
export type AnimName =
  | 'idle'
  | 'idle_down'
  | 'idle_up'
  | 'walk'
  | 'walk_down'
  | 'walk_up'
  | 'attack'
  | 'cast'
  | 'hurt'
  | 'parry'
  | 'ko'
  | 'victory';

export interface SheetDef {
  /** Caminho a partir de public/, ex.: 'sprites/crono/walk.png'. */
  file: string;
  frameWidth: number;
  frameHeight: number;
  fps?: number;
}

export interface CharacterSprites {
  /** O sprite original olha para a esquerda (o jogo espelha). */
  facesLeft?: boolean;
  /** Escala extra no jogo (os GIFs vêm em 2x, então 0.5). */
  scale?: number;
  portrait?: string;
  anims: Partial<Record<AnimName, SheetDef>>;
}

/**
 * Spritesheets reais por personagem, gerados por `npm run sprites` a partir dos GIFs
 * em public/assets/Party/. Animação que não estiver aqui usa o boneco gerado por código.
 */
export const SPRITE_MANIFEST = generated as Partial<Record<CharacterId, CharacterSprites>>;
