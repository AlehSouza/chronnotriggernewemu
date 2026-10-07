import { describe, expect, it } from 'vitest';
import { chooseCpuAction } from './ai';
import { ROSTER } from './characters';
import { actionBlockReason, createDuel, resolveTurn, RULES, type DuelState } from './engine';

describe('resolveTurn', () => {
  it('ataque contra ataque causa dano nos dois', () => {
    const { state } = resolveTurn(createDuel('crono', 'magus', 1), ['attack', 'attack']);
    expect(state.fighters[0].hp).toBeLessThan(370);
    expect(state.fighters[1].hp).toBeLessThan(340);
  });

  it('parry devolve dano de ataque normal', () => {
    const { state, events } = resolveTurn(createDuel('crono', 'frog', 1), ['attack', 'parry']);
    expect(state.fighters[1].hp).toBe(360);
    expect(state.fighters[0].hp).toBeLessThan(370);
    expect(events).toContainEqual({ type: 'parry', side: 1, result: 'reflect' });
  });

  it('parry bloqueia habilidade e seus efeitos', () => {
    const { state } = resolveTurn(createDuel('lucca', 'robo', 1), ['skill', 'parry']);
    expect(state.fighters[1].hp).toBe(390);
    expect(state.fighters[1].statuses).toEqual([]);
  });

  it('parry só reduz metade da ultimate', () => {
    const base = createDuel('magus', 'crono', 1);
    base.fighters[0].gauge = 100;
    const full = resolveTurn(base, ['ultimate', 'attack']).events.find((e) => e.type === 'damage' && e.target === 1);
    const parried = resolveTurn(base, ['ultimate', 'parry']).events.find((e) => e.type === 'damage' && e.target === 1);
    expect(full && parried && full.type === 'damage' && parried.type === 'damage').toBe(true);
    if (full?.type === 'damage' && parried?.type === 'damage') {
      expect(parried.amount).toBeLessThan(full.amount);
    }
  });

  it('parry não pode ser usado dois turnos seguidos', () => {
    const { state } = resolveTurn(createDuel('crono', 'marle', 1), ['parry', 'attack']);
    expect(actionBlockReason(state, 0, 'parry')).not.toBeNull();
    const next = resolveTurn(state, ['attack', 'attack']).state;
    expect(actionBlockReason(next, 0, 'parry')).toBeNull();
  });

  it('ação inválida vira ataque', () => {
    const { events } = resolveTurn(createDuel('crono', 'marle', 1), ['ultimate', 'attack']);
    expect(events[0]).toMatchObject({ type: 'action', side: 0, action: 'attack' });
  });

  it('é determinístico com a mesma semente', () => {
    const a = resolveTurn(createDuel('ayla', 'frog', 42), ['attack', 'skill']);
    const b = resolveTurn(createDuel('ayla', 'frog', 42), ['attack', 'skill']);
    expect(a).toEqual(b);
  });

  it('todo duelo CPU x CPU termina', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (const p1 of ROSTER) {
      for (const p2 of ROSTER) {
        let s: DuelState = createDuel(p1, p2, 3);
        while (s.winner === null && s.turn < 200) {
          s = resolveTurn(s, [chooseCpuAction(s, 0, rand), chooseCpuAction(s, 1, rand)]).state;
        }
        expect(s.winner, `${p1} x ${p2}`).not.toBeNull();
        expect(s.turn).toBeLessThan(60);
      }
    }
  });

  it('barra de ultimate enche com o tempo', () => {
    let s = createDuel('robo', 'robo', 1);
    for (let i = 0; i < 10; i++) s = resolveTurn(s, ['attack', 'attack']).state;
    expect(s.fighters[0].gauge).toBe(RULES.gaugeMax);
  });
});
