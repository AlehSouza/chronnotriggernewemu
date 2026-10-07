import { CHARACTERS } from './characters';
import { availableActions, getAbility, type DuelState, type Side } from './engine';
import type { ActionKind } from './types';

/** IA simples para o modo contra CPU (e para bots no servidor no futuro). */
export function chooseCpuAction(state: DuelState, side: Side, rand: () => number = Math.random): ActionKind {
  const me = state.fighters[side];
  const foe = state.fighters[1 - side];
  const options = availableActions(state, side);
  const can = (a: ActionKind) => options.includes(a);

  if (can('ultimate') && rand() < 0.8) return 'ultimate';

  const skill = getAbility(me, 'skill');
  const hpPct = me.hp / CHARACTERS[me.characterId].stats.maxHp;
  if (can('skill') && skill.healPct && hpPct < 0.5 && rand() < 0.7) return 'skill';

  // O oponente vai soltar a ultimate? Vale defender.
  if (can('parry') && foe.gauge >= 100 && rand() < 0.5) return 'parry';

  const weights: Array<[ActionKind, number]> = [
    ['attack', 50],
    ['skill', can('skill') && !skill.healPct ? 30 : can('skill') ? 10 : 0],
    ['parry', can('parry') ? 20 : 0],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [action, w] of weights) {
    if ((roll -= w) < 0) return action;
  }
  return 'attack';
}
