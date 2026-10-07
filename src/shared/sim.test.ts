import { describe, expect, it } from 'vitest';
import { CpuController } from './ai';
import { ROSTER } from './characters';
import { ability, createWorld, NO_INPUT, RULES, step, type Input, type SimEvent, type World } from './sim';
import { nextRandom } from './rng';

const press = (k: Partial<Input>): Input => ({ ...NO_INPUT, ...k });

function run(w: World, frames: number, p1: Partial<Input> = {}, p2: Partial<Input> = {}): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...step(w, [press(p1), press(p2)]));
  return events;
}

/** Coloca os dois frente a frente, colados na mesma faixa. */
function faceOff(p1: Parameters<typeof createWorld>[0], p2: Parameters<typeof createWorld>[1], gap = 50) {
  const w = createWorld(p1, p2, 1);
  w.fighters[0].x = 400;
  w.fighters[1].x = 400 + gap;
  return w;
}

describe('simulação', () => {
  it('ataque corpo a corpo acerta quem está na mesma faixa', () => {
    const w = faceOff('crono', 'magus');
    run(w, 1, { attack: true });
    run(w, 30);
    expect(w.fighters[1].hp).toBeLessThan(580);
  });

  it('mudar de faixa (profundidade) desvia do golpe', () => {
    const w = faceOff('crono', 'magus');
    w.fighters[1].y = w.fighters[0].y + 60;
    run(w, 1, { attack: true });
    run(w, 30);
    expect(w.fighters[1].hp).toBe(580);
  });

  it('parry devolve dano do ataque normal e atordoa o atacante', () => {
    const w = faceOff('crono', 'frog');
    run(w, 1, { attack: true }, { parry: true });
    const events = run(w, 30);
    expect(w.fighters[1].hp).toBe(610);
    expect(w.fighters[0].hp).toBeLessThan(630);
    expect(events).toContainEqual({ type: 'parry', side: 1, result: 'reflect' });
  });

  it('parry rebate projétil de volta para quem atirou', () => {
    const w = faceOff('lucca', 'robo', 200);
    run(w, 1, { attack: true });
    // Robo segura o parry quando o tiro chega perto.
    for (let i = 0; i < 60; i++) {
      const p = w.projectiles[0];
      const near = p && Math.abs(p.x - w.fighters[1].x) < 80;
      step(w, [NO_INPUT, press({ parry: near })]);
    }
    expect(w.fighters[1].hp).toBe(680);
    expect(w.fighters[0].hp).toBeLessThan(560);
  });

  it('área no alvo cai onde o alvo estava: sair de lá desvia', () => {
    const w = faceOff('magus', 'crono', 300);
    w.fighters[0].gauge = RULES.gaugeMax;
    run(w, 1, { ultimate: true });
    expect(w.zones).toHaveLength(1);
    run(w, 70, {}, { moveX: 1 });
    expect(w.fighters[1].hp).toBe(630);

    const w2 = faceOff('magus', 'crono', 300);
    w2.fighters[0].gauge = RULES.gaugeMax;
    run(w2, 70, { ultimate: true });
    expect(w2.fighters[1].hp).toBeLessThan(630);
  });

  it('ultimate exige barra cheia e a esvazia', () => {
    const w = faceOff('crono', 'marle');
    run(w, 1, { ultimate: true });
    expect(w.fighters[0].action).toBeNull();
    w.fighters[0].gauge = RULES.gaugeMax;
    run(w, 1, { ultimate: true });
    expect(w.fighters[0].action?.slot).toBe('ultimate');
    expect(w.fighters[0].gauge).toBe(0);
  });

  it('habilidade gasta MP e entra em recarga', () => {
    const w = faceOff('lucca', 'marle', 300);
    run(w, 1, { skill: true });
    expect(w.fighters[0].mp).toBeLessThan(90);
    expect(w.fighters[0].cooldowns.skill).toBeGreaterThan(0);
    expect(ability(w.fighters[0], 'skill').name).toBe('Napalm');
  });

  it('é determinístico com a mesma semente', () => {
    const a = faceOff('ayla', 'frog');
    const b = faceOff('ayla', 'frog');
    run(a, 120, { attack: true }, { attack: true });
    run(b, 120, { attack: true }, { attack: true });
    expect(a).toEqual(b);
  });

  it('todo duelo CPU x CPU termina dentro do tempo', () => {
    let seed = 99;
    const rand = () => {
      const [v, s] = nextRandom(seed);
      seed = s;
      return v;
    };
    for (const p1 of ROSTER) {
      for (const p2 of ROSTER) {
        const w = createWorld(p1, p2, 5);
        const cpus = [new CpuController(0, rand), new CpuController(1, rand)];
        while (w.winner === null) step(w, [cpus[0].input(w), cpus[1].input(w)]);
        expect(w.winner, `${p1} x ${p2}`).not.toBeNull();
      }
    }
  });
});
