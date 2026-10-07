import { CHARACTERS } from './characters';
import {
  ability,
  canAct,
  inFloorEllipse,
  NO_INPUT,
  slotBlockReason,
  type Fighter,
  type Input,
  type Side,
  type World,
} from './sim';
import type { Slot } from './types';

/**
 * CPU em tempo real. Reage com atraso (como uma pessoa), desvia de áreas marcadas
 * e de projéteis, tenta parry às vezes e escolhe a distância certa para o kit.
 * Também serve para bots no servidor no futuro.
 */
export class CpuController {
  private plan: Input = NO_INPUT;
  private nextDecision = 0;
  private parryDecidedFor = -1;

  constructor(
    private readonly side: Side,
    private readonly rand: () => number = Math.random,
    /** Quadros entre decisões. Menor = CPU mais difícil. */
    private readonly reaction = 8,
  ) {}

  input(w: World): Input {
    const me = w.fighters[this.side];
    const foe = w.fighters[1 - this.side];
    if (!canAct(me) || foe.ko || w.winner !== null) return NO_INPUT;

    const dodge = this.dodge(w, me, foe);
    if (dodge) return dodge;

    if (w.frame < this.nextDecision) return { ...this.plan, attack: false, parry: false, skill: false, ultimate: false };
    this.nextDecision = w.frame + this.reaction + Math.floor(this.rand() * this.reaction);
    this.plan = this.decide(me, foe);
    return this.plan;
  }

  private dodge(w: World, me: Fighter, foe: Fighter): Input | null {
    // Áreas marcadas no chão: sair de dentro.
    for (const z of w.zones) {
      if (z.owner === me.side) continue;
      const r = ability(z, z.slot).range + 24;
      if (inFloorEllipse(me.x, me.y, z.x, z.y, r)) return this.away(me, z.x, z.y);
    }
    // Área em volta do oponente carregando.
    const fa = foe.action && ability(foe, foe.action.slot);
    if (foe.action && fa && fa.kind === 'aoeSelf' && foe.action.frame < fa.startup) {
      if (inFloorEllipse(me.x, me.y, foe.x, foe.y, fa.range + 30)) return this.away(me, foe.x, foe.y);
    }
    // Golpe de perto vindo: às vezes parry.
    if (foe.action && fa && (fa.kind === 'melee' || fa.kind === 'dash') && foe.action.frame < fa.startup) {
      const key = foe.action.frame === 0 ? -1 : w.frame - foe.action.frame;
      if (this.parryDecidedFor !== key) {
        this.parryDecidedFor = key;
        const near = Math.abs(foe.x - me.x) < fa.range + 20 && Math.abs(foe.y - me.y) < fa.depth + 10;
        if (near && slotBlockReason(me, 'parry') === null && this.rand() < 0.3) return { ...NO_INPUT, parry: true };
      }
    }
    // Projéteis chegando na minha faixa.
    for (const p of w.projectiles) {
      if (p.owner === me.side) continue;
      const pa = ability(p, p.slot);
      const coming = (me.x - p.x) * Math.sign(p.vx) > 0;
      if (!coming || Math.abs(me.y - p.y) > pa.depth + 14 || Math.abs(me.x - p.x) > 200) continue;
      if (this.parryDecidedFor !== -1000 - p.id) {
        this.parryDecidedFor = -1000 - p.id;
        if (slotBlockReason(me, 'parry') === null && Math.abs(me.x - p.x) < 70 && this.rand() < 0.35) {
          return { ...NO_INPUT, parry: true };
        }
      }
      return { ...NO_INPUT, moveY: me.y > p.y || (me.y === p.y && me.y < 40) ? 1 : -1 };
    }
    return null;
  }

  private away(me: Fighter, x: number, y: number): Input {
    let moveX: -1 | 0 | 1 = me.x >= x ? 1 : -1;
    if ((moveX === 1 && me.x > 880) || (moveX === -1 && me.x < 80)) moveX = 0;
    const moveY: -1 | 0 | 1 = me.y >= y ? 1 : -1;
    return { ...NO_INPUT, moveX, moveY };
  }

  private decide(me: Fighter, foe: Fighter): Input {
    const dx = foe.x - me.x;
    const dy = foe.y - me.y;
    const adx = Math.abs(dx);
    const ready = (s: Slot) => slotBlockReason(me, s) === null;
    const hpPct = me.hp / CHARACTERS[me.characterId].stats.maxHp;
    const fits = (s: Slot) => {
      const a = ability(me, s);
      switch (a.kind) {
        case 'melee':
          return adx <= a.range * 0.9 && Math.abs(dy) <= a.depth * 0.8;
        case 'dash':
          return adx <= a.range * 0.9 && Math.abs(dy) <= a.depth * 0.8;
        case 'projectile':
          return adx <= a.range * 0.8 && Math.abs(dy) <= a.depth * 0.7;
        case 'aoeSelf':
          return inFloorEllipse(foe.x, foe.y, me.x, me.y, a.range * 0.8);
        case 'aoeTarget':
          return true;
        case 'buff':
          return (a.healPct ?? 0) > 0.15 ? hpPct < 0.6 : adx < 160;
        default:
          return false;
      }
    };

    if (ready('ultimate') && fits('ultimate') && this.rand() < 0.7) return { ...NO_INPUT, ultimate: true };
    if (ready('skill') && fits('skill') && this.rand() < 0.5) return { ...NO_INPUT, skill: true };
    if (ready('attack') && fits('attack') && this.rand() < 0.75) return { ...NO_INPUT, attack: true };

    // Posicionamento: alinhar profundidade e ficar na distância do ataque básico.
    const basic = ability(me, 'attack');
    const ideal = basic.kind === 'projectile' ? 300 : basic.range * 0.7;
    let moveX: -1 | 0 | 1 = 0;
    if (adx > ideal + 20) moveX = dx > 0 ? 1 : -1;
    else if (adx < ideal - 40) moveX = dx > 0 ? -1 : 1;
    let moveY: -1 | 0 | 1 = 0;
    if (Math.abs(dy) > 8) moveY = dy > 0 ? 1 : -1;
    if (this.rand() < 0.15) moveY = this.rand() < 0.5 ? -1 : 1;
    return { ...NO_INPUT, moveX, moveY };
  }
}
