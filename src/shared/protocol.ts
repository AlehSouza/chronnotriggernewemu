// Contrato planejado para o modo online (socket.io). Ainda não usado pelo cliente,
// mas fica aqui para cliente e servidor compartilharem os mesmos tipos.
//
// Modelo: o servidor roda `step()` a 60 quadros/s como autoridade. Os clientes mandam
// só as entradas (WASD + UIJK) e recebem o mundo periodicamente para desenhar,
// com predição local do próprio personagem.

import type { Input, Side, SimEvent, World } from './sim';
import type { CharacterId } from './types';

export interface ClientToServerEvents {
  'lobby:join': (payload: { name: string }) => void;
  'select:character': (payload: { characterId: CharacterId; locked: boolean }) => void;
  /** Entrada de um quadro. `frame` permite descartar pacotes atrasados. */
  'match:input': (payload: { frame: number; input: Input }) => void;
}

export interface ServerToClientEvents {
  'lobby:matched': (payload: { roomId: string; side: Side; opponentName: string }) => void;
  'select:update': (payload: { picks: [CharacterId | null, CharacterId | null]; locked: [boolean, boolean] }) => void;
  'match:start': (payload: { world: World }) => void;
  /** Foto do mundo + eventos desde a última foto (para efeitos visuais). */
  'match:snapshot': (payload: { world: World; events: SimEvent[] }) => void;
  'match:opponentLeft': () => void;
}
