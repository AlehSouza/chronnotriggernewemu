// Motor de duelo por turnos simultâneos: os dois jogadores escolhem em segredo,
// depois o turno é resolvido de uma vez. É uma função pura e determinística
// (RNG com semente dentro do estado), então o servidor pode ser a autoridade
// no modo online e os clientes só reproduzem os eventos.

import { CHARACTERS } from './characters';
import { nextRandom } from './rng';
import type { Ability, ActionKind, CharacterId, StatusId } from './types';

export type Side = 0 | 1;

export const RULES = {
  gaugeMax: 100,
  gaugePerTurn: 12,
  gaugePerDamageTaken: 0.4,
  gaugePerDamageDealt: 0.2,
  gaugeOnParry: 25,
  mpRegenPerTurn: 5,
  parryReflect: 0.6,
  parryUltimateBlock: 0.5,
  critChance: 0.1,
  critMultiplier: 1.5,
  burnPctPerTurn: 0.04,
  regenPctPerTurn: 0.05,
  atkUpMultiplier: 1.3,
  defDownMultiplier: 0.7,
} as const;

export interface StatusInstance {
  id: StatusId;
  turns: number;
}

export interface FighterState {
  characterId: CharacterId;
  hp: number;
  mp: number;
  gauge: number;
  statuses: StatusInstance[];
  /** >0 enquanto o parry não pode ser usado. */
  parryCooldown: number;
  lastAction: ActionKind | null;
}

export type Winner = Side | 'draw' | null;

export interface DuelState {
  turn: number;
  seed: number;
  fighters: [FighterState, FighterState];
  winner: Winner;
}

export type ParryResult = 'reflect' | 'block' | 'partial' | 'whiff';

export type DuelEvent =
  | { type: 'action'; side: Side; action: ActionKind; abilityName: string }
  | { type: 'parry'; side: Side; result: ParryResult }
  | { type: 'damage'; target: Side; amount: number; source: 'hit' | 'reflect' | 'burn'; crit?: boolean }
  | { type: 'heal'; target: Side; amount: number; source: 'skill' | 'regen' }
  | { type: 'status'; target: Side; status: StatusId; turns: number }
  | { type: 'ko'; side: Side }
  | { type: 'end'; winner: Exclude<Winner, null> };

export interface TurnResult {
  state: DuelState;
  events: DuelEvent[];
}

export function createDuel(p1: CharacterId, p2: CharacterId, seed = Date.now() >>> 0): DuelState {
  return {
    turn: 1,
    seed,
    winner: null,
    fighters: [createFighter(p1), createFighter(p2)],
  };
}

function createFighter(id: CharacterId): FighterState {
  const { stats } = CHARACTERS[id];
  return {
    characterId: id,
    hp: stats.maxHp,
    mp: stats.maxMp,
    gauge: 0,
    statuses: [],
    parryCooldown: 0,
    lastAction: null,
  };
}

export function getAbility(f: FighterState, action: ActionKind): Ability {
  return CHARACTERS[f.characterId].abilities[action];
}

/** Por que uma ação não pode ser usada agora (ou null se pode). */
export function actionBlockReason(state: DuelState, side: Side, action: ActionKind): string | null {
  const f = state.fighters[side];
  switch (action) {
    case 'attack':
      return null;
    case 'parry':
      return f.parryCooldown > 0 ? 'Recarregando' : null;
    case 'skill': {
      const cost = getAbility(f, 'skill').mpCost;
      return f.mp < cost ? `Precisa ${cost} MP` : null;
    }
    case 'ultimate':
      return f.gauge < RULES.gaugeMax ? 'Barra incompleta' : null;
  }
}

export function availableActions(state: DuelState, side: Side): ActionKind[] {
  return (['attack', 'parry', 'skill', 'ultimate'] as ActionKind[]).filter(
    (a) => actionBlockReason(state, side, a) === null,
  );
}

function hasStatus(f: FighterState, id: StatusId): boolean {
  return f.statuses.some((s) => s.id === id);
}

function addStatus(f: FighterState, id: StatusId, turns: number): void {
  const existing = f.statuses.find((s) => s.id === id);
  if (existing) existing.turns = Math.max(existing.turns, turns);
  else f.statuses.push({ id, turns });
}

function cloneState(s: DuelState): DuelState {
  return {
    ...s,
    fighters: s.fighters.map((f) => ({ ...f, statuses: f.statuses.map((x) => ({ ...x })) })) as [
      FighterState,
      FighterState,
    ],
  };
}

export function resolveTurn(prev: DuelState, chosen: [ActionKind, ActionKind]): TurnResult {
  if (prev.winner !== null) return { state: prev, events: [] };

  const state = cloneState(prev);
  const events: DuelEvent[] = [];
  const rand = () => {
    const [value, seed] = nextRandom(state.seed);
    state.seed = seed;
    return value;
  };

  // Ações inválidas viram ataque normal (protege contra cliente trapaceando).
  const actions = chosen.map((a, i) => (actionBlockReason(state, i as Side, a) === null ? a : 'attack')) as [
    ActionKind,
    ActionKind,
  ];

  // Paga custos.
  actions.forEach((action, i) => {
    const f = state.fighters[i];
    const ability = getAbility(f, action);
    f.mp -= ability.mpCost;
    if (action === 'ultimate') f.gauge = 0;
    if (action === 'parry') f.parryCooldown = 2;
    f.lastAction = action;
    events.push({ type: 'action', side: i as Side, action, abilityName: ability.name });
  });

  const damageTaken = [0, 0];
  const damageDealt = [0, 0];
  const parrySucceeded = [false, false];

  for (const i of [0, 1] as Side[]) {
    const j = (1 - i) as Side;
    const me = state.fighters[i];
    const foe = state.fighters[j];
    const action = actions[i];
    const ability = getAbility(me, action);
    const foeParried = actions[j] === 'parry';

    if (action === 'parry') continue;

    if (ability.power > 0) {
      const crit = action === 'attack' && rand() < RULES.critChance;
      let dmg = computeDamage(me, foe, ability, rand());
      if (crit) dmg = Math.round(dmg * RULES.critMultiplier);

      let applyTargetStatuses = true;
      if (foeParried) {
        if (action === 'attack') {
          const reflected = Math.max(1, Math.round(dmg * RULES.parryReflect));
          events.push({ type: 'parry', side: j, result: 'reflect' });
          events.push({ type: 'damage', target: i, amount: reflected, source: 'reflect' });
          damageTaken[i] += reflected;
          damageDealt[j] += reflected;
          parrySucceeded[j] = true;
          dmg = 0;
          applyTargetStatuses = false;
        } else if (action === 'skill') {
          events.push({ type: 'parry', side: j, result: 'block' });
          parrySucceeded[j] = true;
          dmg = 0;
          applyTargetStatuses = false;
        } else {
          events.push({ type: 'parry', side: j, result: 'partial' });
          dmg = Math.round(dmg * (1 - RULES.parryUltimateBlock));
        }
      }

      if (dmg > 0) {
        events.push({ type: 'damage', target: j, amount: dmg, source: 'hit', crit });
        damageTaken[j] += dmg;
        damageDealt[i] += dmg;
      }
      if (applyTargetStatuses) {
        for (const s of ability.applyToTarget ?? []) {
          addStatus(foe, s.id, s.turns);
          events.push({ type: 'status', target: j, status: s.id, turns: s.turns });
        }
      }
    } else if (foeParried) {
      events.push({ type: 'parry', side: j, result: 'whiff' });
    }

    if (ability.healPct) {
      const amount = Math.round(CHARACTERS[me.characterId].stats.maxHp * ability.healPct);
      events.push({ type: 'heal', target: i, amount, source: 'skill' });
      damageTaken[i] -= amount;
    }
    for (const s of ability.applyToSelf ?? []) {
      addStatus(me, s.id, s.turns);
      events.push({ type: 'status', target: i, status: s.id, turns: s.turns });
    }
  }

  // Dano e cura acontecem ao mesmo tempo para os dois lados.
  for (const i of [0, 1] as Side[]) {
    const f = state.fighters[i];
    const maxHp = CHARACTERS[f.characterId].stats.maxHp;
    f.hp = clamp(f.hp - damageTaken[i], 0, maxHp);
    if (actions[i] !== 'ultimate') {
      f.gauge +=
        RULES.gaugePerTurn +
        Math.max(0, damageTaken[i]) * RULES.gaugePerDamageTaken +
        damageDealt[i] * RULES.gaugePerDamageDealt +
        (parrySucceeded[i] ? RULES.gaugeOnParry : 0);
      f.gauge = Math.min(RULES.gaugeMax, Math.round(f.gauge));
    }
  }

  // Fim do turno: efeitos contínuos, MP e recargas.
  for (const i of [0, 1] as Side[]) {
    const f = state.fighters[i];
    if (f.hp <= 0) continue;
    const { maxHp, maxMp } = CHARACTERS[f.characterId].stats;
    if (hasStatus(f, 'burn')) {
      const amount = Math.max(1, Math.round(maxHp * RULES.burnPctPerTurn));
      f.hp = Math.max(0, f.hp - amount);
      events.push({ type: 'damage', target: i, amount, source: 'burn' });
    }
    if (hasStatus(f, 'regen') && f.hp > 0) {
      const amount = Math.round(maxHp * RULES.regenPctPerTurn);
      f.hp = Math.min(maxHp, f.hp + amount);
      events.push({ type: 'heal', target: i, amount, source: 'regen' });
    }
    f.statuses = f.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
    f.mp = Math.min(maxMp, f.mp + RULES.mpRegenPerTurn);
    f.parryCooldown = Math.max(0, f.parryCooldown - 1);
  }

  const ko0 = state.fighters[0].hp <= 0;
  const ko1 = state.fighters[1].hp <= 0;
  if (ko0) events.push({ type: 'ko', side: 0 });
  if (ko1) events.push({ type: 'ko', side: 1 });
  if (ko0 || ko1) {
    state.winner = ko0 && ko1 ? 'draw' : ko0 ? 1 : 0;
    events.push({ type: 'end', winner: state.winner });
  }

  state.turn += 1;
  return { state, events };
}

export function computeDamage(attacker: FighterState, defender: FighterState, ability: Ability, roll: number): number {
  const aStats = CHARACTERS[attacker.characterId].stats;
  const dStats = CHARACTERS[defender.characterId].stats;
  let stat = ability.scaling === 'atk' ? aStats.atk : aStats.mag;
  if (hasStatus(attacker, 'atkUp')) stat *= RULES.atkUpMultiplier;
  let def = dStats.def;
  if (hasStatus(defender, 'defDown')) def *= RULES.defDownMultiplier;

  let power = ability.power;
  if (ability.missingHpBonus) {
    const missing = 1 - attacker.hp / aStats.maxHp;
    power *= 1 + ability.missingHpBonus * missing;
  }
  const variance = 0.9 + roll * 0.2;
  // Com ataque == defesa, o dano é igual ao poder do golpe.
  return Math.max(1, Math.round(((power * 2 * stat) / (stat + def)) * variance));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
