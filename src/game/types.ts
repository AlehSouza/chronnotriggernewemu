import type { CharacterId } from '../shared/types';

export type GameMode = 'cpu' | 'local';

export interface SelectData {
  mode: GameMode;
}

export interface ArenaData {
  mode: GameMode;
  p1: CharacterId;
  p2: CharacterId;
}
