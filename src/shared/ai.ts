import { CHARACTERS } from './characters';
import {
  ability,
  ARENA,
  canAct,
  inCircle,
  NO_INPUT,
  slotBlockReason,
  type Fighter,
  type Input,
  type Side,
  type World,
} from './sim';
import type { Slot } from './types';

/** Converte um vetor em direção de teclado (8 direções). */
function toKeys(vx: number, vy: number): Pick<Input, 'moveX' | 'moveY'> {
  const len = Math.hypot(vx, vy);
  if (len < 0.001) return { moveX: 0, moveY: 0 };
  const sx = vx / len;
  const sy = vy / len;
  return {
    moveX: sx > 0.38 ? 1 : sx < -0.38 ? -1 : 0,
    moveY: sy > 0.38 ? 1 : sy < -0.38 ? -1 : 0,
  };
}

/** Evita encostar na parede: puxa o vetor para o centro quando está perto da borda. */
function avoidWalls(me: Fighter, vx: number, vy: number): [number, number] {
  const cx = (ARENA.minX + ARENA.maxX) / 2;
  const cy = (ARENA.minY + ARENA.maxY) / 2;
  if (me.x < ARENA.minX + 50 || me.x > ARENA.maxX - 50) vx += (cx - me.x) / 200;
  if (me.y < ARENA.minY + 40 || me.y > ARENA.maxY - 40) vy += (cy - me.y) / 120;
  return [vx, vy];
}

/**
 * CPU em tempo real. Reage com atraso (como uma pessoa), foge de áreas marcadas,
 * sai da linha de projéteis, tenta parry às vezes e mantém a distância certa
 * para o kit. Também serve para bots no servidor no futuro.
 */
export class CpuController {
  private plan: Input = NO_INPUT;
  private nextDecision = 0;
  private parryDecidedFor = -1;
  private strafe: 1 | -1 = 1;

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

  private away(me: Fighter, x: number, y: number): Input {
    let vx = me.x - x;
    let vy = me.y - y;
    if (Math.hypot(vx, vy) < 1) vx = 1;
    [vx, vy] = avoidWalls(me, vx / Math.hypot(vx, vy), vy / Math.hypot(vx, vy));
    return { ...NO_INPUT, ...toKeys(vx, vy) };
  }

  private dodge(w: World, me: Fighter, foe: Fighter): Input | null {
    // Áreas marcadas no chão: sair de dentro.
    for (const z of w.zones) {
      if (z.owner === me.side) continue;
      if (inCircle(me.x, me.y, z.x, z.y, ability(z, z.slot).range + 24)) return this.away(me, z.x, z.y);
    }
    // Área em volta do oponente carregando.
    const fa = foe.action && ability(foe, foe.action.slot);
    if (foe.action && fa && fa.kind === 'aoeSelf' && foe.action.frame < fa.startup) {
      if (inCircle(me.x, me.y, foe.x, foe.y, fa.range + 30)) return this.away(me, foe.x, foe.y);
    }
    // Golpe de perto vindo: às vezes parry.
    if (foe.action && fa && (fa.kind === 'melee' || fa.kind === 'dash') && foe.action.frame < fa.startup) {
      const key = w.frame - foe.action.frame;
      if (this.parryDecidedFor !== key) {
        this.parryDecidedFor = key;
        const near = inCircle(me.x, me.y, foe.x, foe.y, fa.range + 20);
        if (near && slotBlockReason(me, 'parry') === null && this.rand() < 0.3) return { ...NO_INPUT, parry: true };
      }
    }
    // Projéteis vindo na minha direção: sair da linha (andar de lado) ou parry.
    for (const p of w.projectiles) {
      if (p.owner === me.side) continue;
      const pa = ability(p, p.slot);
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const ux = p.vx / speed;
      const uy = p.vy / speed;
      const rx = me.x - p.x;
      const ry = me.y - p.y;
      const ahead = rx * ux + ry * uy;
      const side = rx * uy - ry * ux;
      if (ahead <= 0 || ahead > 220 || Math.abs(side) > Math.max(22, pa.depth) + 18) continue;
      if (this.parryDecidedFor !== -1000 - p.id) {
        this.parryDecidedFor = -1000 - p.id;
        if (slotBlockReason(me, 'parry') === null && ahead < 70 && this.rand() < 0.35) return { ...NO_INPUT, parry: true };
      }
      // Anda perpendicular ao tiro, para o lado em que já está.
      const s = side >= 0 ? 1 : -1;
      const [vx, vy] = avoidWalls(me, uy * s, -ux * s);
      return { ...NO_INPUT, ...toKeys(vx, vy) };
    }
    return null;
  }

  private decide(me: Fighter, foe: Fighter): Input {
    const dist = Math.hypot(foe.x - me.x, foe.y - me.y);
    const ready = (s: Slot) => slotBlockReason(me, s) === null;
    const hpPct = me.hp / CHARACTERS[me.characterId].stats.maxHp;
    const fits = (s: Slot) => {
      const a = ability(me, s);
      switch (a.kind) {
        case 'melee':
          return dist <= a.range * 0.9;
        case 'dash':
          return dist <= a.range * 0.9;
        case 'projectile':
          return dist <= a.range * 0.8;
        case 'aoeSelf':
          return dist <= a.range * 0.8;
        case 'aoeTarget':
          return true;
        case 'buff':
          return (a.healPct ?? 0) > 0.15 ? hpPct < 0.6 : dist < 160;
        default:
          return false;
      }
    };

    if (ready('ultimate') && fits('ultimate') && this.rand() < 0.7) return { ...NO_INPUT, ultimate: true };
    if (ready('skill') && fits('skill') && this.rand() < 0.5) return { ...NO_INPUT, skill: true };
    if (ready('attack') && fits('attack') && this.rand() < 0.75) return { ...NO_INPUT, attack: true };

    // Posicionamento: chegar perto ou manter distância, andando de lado de vez em quando.
    const basic = ability(me, 'attack');
    const ideal = basic.kind === 'projectile' ? 280 : basic.range * 0.7;
    const ux = (foe.x - me.x) / (dist || 1);
    const uy = (foe.y - me.y) / (dist || 1);
    let toward = 0;
    if (dist > ideal + 20) toward = 1;
    else if (dist < ideal - 40) toward = -1;
    if (this.rand() < 0.1) this.strafe = this.strafe === 1 ? -1 : 1;
    const strafeAmount = basic.kind === 'projectile' ? 0.8 : 0.3;
    let vx = ux * toward + -uy * this.strafe * strafeAmount;
    let vy = uy * toward + ux * this.strafe * strafeAmount;
    [vx, vy] = avoidWalls(me, vx, vy);
    return { ...NO_INPUT, ...toKeys(vx, vy) };
  }
}
