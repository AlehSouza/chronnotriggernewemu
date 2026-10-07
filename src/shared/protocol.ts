// Contrato planejado para o modo online (socket.io). Ainda não usado pelo cliente,
// mas fica aqui para cliente e servidor compartilharem os mesmos tipos.

import type { DuelEvent, DuelState, Side } from './engine';
import type { ActionKind, CharacterId } from './types';

export interface ClientToServerEvents {
  'lobby:join': (payload: { name: string }) => void;
  'select:character': (payload: { characterId: CharacterId }) => void;
  'duel:action': (payload: { turn: number; action: ActionKind }) => void;
}

export interface ServerToClientEvents {
  'lobby:matched': (payload: { roomId: string; side: Side; opponentName: string }) => void;
  'select:update': (payload: { picks: [CharacterId | null, CharacterId | null]; locked: [boolean, boolean] }) => void;
  'duel:start': (payload: { state: DuelState }) => void;
  /** O oponente já escolheu (sem revelar o quê). */
  'duel:opponentReady': () => void;
  'duel:turn': (payload: { actions: [ActionKind, ActionKind]; events: DuelEvent[]; state: DuelState }) => void;
  'duel:opponentLeft': () => void;
}
