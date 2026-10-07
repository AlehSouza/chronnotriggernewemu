// Simulação do duelo em tempo real, a 60 quadros por segundo.
//
// É código puro e determinístico (RNG com semente dentro do mundo): dado o mesmo
// mundo e as mesmas entradas, o próximo quadro é sempre igual. Assim o servidor
// socket.io pode rodar a mesma simulação como autoridade e os clientes só
// mandam entradas e desenham o que recebem.
//
// Coordenadas: vista de cima (3/4, como os mapas de Chrono Trigger). x e y são o chão,
// na mesma escala; a tela só achata o y um pouco ao desenhar.

import { CHARACTERS } from './characters';
import { nextRandom } from './rng';
import type { Ability, CharacterId, Slot, StatusId } from './types';

export const FPS = 60;

export const ARENA = { minX: 40, maxX: 920, minY: 40, maxY: 420 } as const;

export const RULES = {
  matchSeconds: 99,
  gaugeMax: 100,
  gaugePerSecond: 2,
  gaugePerDamageDealt: 0.35,
  gaugePerDamageTaken: 0.5,
  gaugeOnParry: 20,
  /** Multiplica a velocidade de andar de todos os personagens. */
  moveSpeedScale: 1.2,
  dashFrames: 10,
  dashSpeed: 9,
  /** Quadros do começo do dash em que nada acerta (dá para atravessar golpes). */
  dashInvulnFrames: 8,
  dashCooldown: 48,
  mpPerSecond: 4,
  parryReflect: 0.6,
  parryUltimateBlock: 0.5,
  reflectStun: 40,
  blockStun: 24,
  hitstunBase: 14,
  critChance: 0.1,
  critMultiplier: 1.5,
  burnPctPerSecond: 0.02,
  regenPctPerSecond: 0.03,
  atkUpMultiplier: 1.3,
  defDownMultiplier: 0.7,
  projectileHitR: 22,
  dashHitR: 46,
  /** Quadros que o conjurador fica parado ao marcar uma área no alvo. */
  aoeTargetCast: 16,
} as const;

export type Side = 0 | 1;
export type Winner = Side | 'draw' | null;

export interface Input {
  moveX: -1 | 0 | 1;
  moveY: -1 | 0 | 1;
  attack: boolean;
  parry: boolean;
  skill: boolean;
  ultimate: boolean;
  dash: boolean;
}

export const NO_INPUT: Input = {
  moveX: 0,
  moveY: 0,
  attack: false,
  parry: false,
  skill: false,
  ultimate: false,
  dash: false,
};

export interface ActionState {
  slot: Slot;
  frame: number;
  hitsDone: number;
  /** Direção da mira, travada ao usar (vetor unitário). */
  ax: number;
  ay: number;
}

export interface StatusInstance {
  id: StatusId;
  frames: number;
}

export interface Fighter {
  side: Side;
  characterId: CharacterId;
  x: number;
  y: number;
  /** Para onde o personagem olha (vetor unitário). */
  lookX: number;
  lookY: number;
  hp: number;
  mp: number;
  gauge: number;
  action: ActionState | null;
  hitstun: number;
  cooldowns: Record<Slot, number>;
  statuses: StatusInstance[];
  moving: boolean;
  /** Quadros restantes do dash (0 = não está dando dash). */
  dashFrames: number;
  dashX: number;
  dashY: number;
  dashCooldown: number;
  ko: boolean;
}

export interface Projectile {
  id: number;
  owner: Side;
  characterId: CharacterId;
  slot: Slot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  traveled: number;
  reflected: boolean;
}

export interface Zone {
  id: number;
  owner: Side;
  characterId: CharacterId;
  slot: Slot;
  x: number;
  y: number;
  framesLeft: number;
  total: number;
}

export interface World {
  frame: number;
  seed: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  zones: Zone[];
  nextId: number;
  framesLeft: number;
  winner: Winner;
}

export type ParryResult = 'reflect' | 'block' | 'partial';

export type SimEvent =
  | { type: 'cast'; side: Side; slot: Slot; name: string }
  | { type: 'dash'; side: Side }
  | { type: 'hit'; target: Side; amount: number; crit: boolean; source: 'hit' | 'reflect' | 'burn'; color: number }
  | { type: 'parry'; side: Side; result: ParryResult }
  | { type: 'heal'; target: Side; amount: number }
  | { type: 'status'; target: Side; status: StatusId }
  | { type: 'burst'; x: number; y: number; radius: number; color: number }
  | { type: 'ko'; side: Side }
  | { type: 'end'; winner: Exclude<Winner, null> };

export function ability(f: { characterId: CharacterId }, slot: Slot): Ability {
  return CHARACTERS[f.characterId].abilities[slot];
}

export function createWorld(p1: CharacterId, p2: CharacterId, seed = 1): World {
  return {
    frame: 0,
    seed: seed >>> 0,
    fighters: [createFighter(0, p1), createFighter(1, p2)],
    projectiles: [],
    zones: [],
    nextId: 1,
    framesLeft: RULES.matchSeconds * FPS,
    winner: null,
  };
}

function createFighter(side: Side, id: CharacterId): Fighter {
  const { stats } = CHARACTERS[id];
  return {
    side,
    characterId: id,
    x: side === 0 ? 220 : 740,
    y: (ARENA.minY + ARENA.maxY) / 2,
    lookX: side === 0 ? 1 : -1,
    lookY: 0,
    hp: stats.maxHp,
    mp: stats.maxMp,
    gauge: 0,
    action: null,
    hitstun: 0,
    cooldowns: { attack: 0, parry: 0, skill: 0, ultimate: 0 },
    statuses: [],
    moving: false,
    dashFrames: 0,
    dashX: 0,
    dashY: 0,
    dashCooldown: 0,
    ko: false,
  };
}

/** Por que um slot não pode ser usado agora (ou null se pode). */
export function slotBlockReason(f: Fighter, slot: Slot): string | null {
  const a = ability(f, slot);
  if (f.cooldowns[slot] > 0) return 'recarga';
  if (f.mp < a.mpCost) return 'MP';
  if (slot === 'ultimate' && f.gauge < RULES.gaugeMax) return 'barra';
  return null;
}

export function canAct(f: Fighter): boolean {
  return !f.ko && f.hitstun <= 0 && f.action === null;
}

export function isParrying(f: Fighter): boolean {
  const act = f.action;
  if (!act || act.slot !== 'parry') return false;
  const a = ability(f, 'parry');
  return act.frame >= a.startup && act.frame < a.startup + a.active;
}

/** Duração total da ação de quem usa a habilidade, em quadros. */
export function actionLength(a: Ability): number {
  if (a.kind === 'aoeTarget') return (a.leapToTarget ? a.startup : RULES.aoeTargetCast) + a.recovery;
  return a.startup + a.active + a.recovery;
}

export function inCircle(px: number, py: number, cx: number, cy: number, radius: number): boolean {
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= radius * radius;
}

/** Vetor unitário de (x1,y1) para (x2,y2); usa o fallback se os pontos coincidem. */
export function dirTo(x1: number, y1: number, x2: number, y2: number, fx = 1, fy = 0): [number, number] {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  return len < 1 ? [fx, fy] : [dx / len, dy / len];
}

function hasStatus(f: Fighter, id: StatusId): boolean {
  return f.statuses.some((s) => s.id === id);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function step(w: World, inputs: [Input, Input]): SimEvent[] {
  const events: SimEvent[] = [];
  if (w.winner !== null) return events;

  const rand = () => {
    const [value, seed] = nextRandom(w.seed);
    w.seed = seed;
    return value;
  };
  const ctx: Ctx = { w, events, rand };

  w.frame += 1;
  w.framesLeft -= 1;

  for (const f of w.fighters) tickTimers(ctx, f);

  for (const side of [0, 1] as Side[]) {
    const f = w.fighters[side];
    const foe = w.fighters[1 - side];
    if (f.ko) continue;
    f.moving = false;
    if (f.hitstun > 0) {
      f.dashFrames = 0;
      continue;
    }
    if (f.action) {
      advanceAction(ctx, f, foe);
      continue;
    }
    if (f.dashFrames > 0) {
      dashStep(f);
      continue;
    }
    const input = inputs[side];
    if (input.dash && f.dashCooldown === 0) {
      startDash(ctx, f, input);
      dashStep(f);
      continue;
    }
    const wanted: Slot | null = input.ultimate
      ? 'ultimate'
      : input.skill
        ? 'skill'
        : input.parry
          ? 'parry'
          : input.attack
            ? 'attack'
            : null;
    if (wanted && slotBlockReason(f, wanted) === null) {
      startAction(ctx, f, foe, wanted);
      advanceAction(ctx, f, foe);
      continue;
    }
    move(f, foe, input);
  }

  updateProjectiles(ctx);
  updateZones(ctx);
  checkEnd(ctx);
  return events;
}

interface Ctx {
  w: World;
  events: SimEvent[];
  rand: () => number;
}

function tickTimers(ctx: Ctx, f: Fighter) {
  if (f.ko) return;
  const { stats } = CHARACTERS[f.characterId];
  for (const slot of Object.keys(f.cooldowns) as Slot[]) f.cooldowns[slot] = Math.max(0, f.cooldowns[slot] - 1);
  f.hitstun = Math.max(0, f.hitstun - 1);
  f.dashCooldown = Math.max(0, f.dashCooldown - 1);
  f.mp = Math.min(stats.maxMp, f.mp + RULES.mpPerSecond / FPS);
  f.gauge = Math.min(RULES.gaugeMax, f.gauge + RULES.gaugePerSecond / FPS);

  if (ctx.w.frame % FPS === 0) {
    if (hasStatus(f, 'burn')) {
      const amount = Math.max(1, Math.round(stats.maxHp * RULES.burnPctPerSecond));
      f.hp -= amount;
      ctx.events.push({ type: 'hit', target: f.side, amount, crit: false, source: 'burn', color: 0xff7a2a });
    }
    if (hasStatus(f, 'regen')) {
      const amount = Math.round(stats.maxHp * RULES.regenPctPerSecond);
      f.hp = Math.min(stats.maxHp, f.hp + amount);
      ctx.events.push({ type: 'heal', target: f.side, amount });
    }
  }
  f.statuses = f.statuses.map((s) => ({ ...s, frames: s.frames - 1 })).filter((s) => s.frames > 0);
}

function move(f: Fighter, foe: Fighter, input: Input) {
  const speed = CHARACTERS[f.characterId].stats.speed * RULES.moveSpeedScale;
  let mx: number = input.moveX;
  let my: number = input.moveY;
  if (mx !== 0 && my !== 0) {
    mx *= Math.SQRT1_2;
    my *= Math.SQRT1_2;
  }
  f.x = clamp(f.x + mx * speed, ARENA.minX, ARENA.maxX);
  f.y = clamp(f.y + my * speed, ARENA.minY, ARENA.maxY);
  f.moving = mx !== 0 || my !== 0;
  // Andando, olha para onde anda; parado, olha para o oponente.
  if (f.moving) [f.lookX, f.lookY] = [mx / Math.hypot(mx, my), my / Math.hypot(mx, my)];
  else [f.lookX, f.lookY] = dirTo(f.x, f.y, foe.x, foe.y, f.lookX, f.lookY);
}

function startAction(ctx: Ctx, f: Fighter, foe: Fighter, slot: Slot) {
  const a = ability(f, slot);
  f.mp -= a.mpCost;
  f.cooldowns[slot] = Math.round(a.cooldown * FPS);
  if (slot === 'ultimate') f.gauge = 0;
  // Mira automática no oponente: o desafio é desviar, não apontar.
  const [ax, ay] = dirTo(f.x, f.y, foe.x, foe.y, f.lookX, f.lookY);
  [f.lookX, f.lookY] = [ax, ay];
  f.action = { slot, frame: 0, hitsDone: 0, ax, ay };
  ctx.events.push({ type: 'cast', side: f.side, slot, name: a.name });

  if (a.kind === 'aoeTarget') {
    ctx.w.zones.push({
      id: ctx.w.nextId++,
      owner: f.side,
      characterId: f.characterId,
      slot,
      x: foe.x,
      y: foe.y,
      framesLeft: a.startup,
      total: a.startup,
    });
  }
}

function advanceAction(ctx: Ctx, f: Fighter, foe: Fighter) {
  const act = f.action!;
  const a = ability(f, act.slot);
  const fr = act.frame;
  const hits = a.hits ?? 1;
  const perHit = a.power / hits;
  const hitFrame = (k: number) => a.startup + Math.floor((k * a.active) / hits);

  switch (a.kind) {
    case 'melee':
      while (act.hitsDone < hits && fr === hitFrame(act.hitsDone)) {
        act.hitsDone += 1;
        const dx = foe.x - f.x;
        const dy = foe.y - f.y;
        const along = dx * act.ax + dy * act.ay;
        const across = Math.abs(dx * act.ay - dy * act.ax);
        if (along >= -12 && along <= a.range && across <= a.depth) tryHit(ctx, f, foe, a, perHit, f.x, f.y);
        if (!f.action) return;
      }
      break;
    case 'aoeSelf':
      while (act.hitsDone < hits && fr === hitFrame(act.hitsDone)) {
        if (act.hitsDone === 0) ctx.events.push({ type: 'burst', x: f.x, y: f.y, radius: a.range, color: a.color });
        act.hitsDone += 1;
        if (inCircle(foe.x, foe.y, f.x, f.y, a.range)) tryHit(ctx, f, foe, a, perHit, f.x, f.y);
        if (!f.action) return;
      }
      break;
    case 'dash':
      if (fr >= a.startup && fr < a.startup + a.active) {
        f.x = clamp(f.x + (act.ax * a.range) / a.active, ARENA.minX, ARENA.maxX);
        f.y = clamp(f.y + (act.ay * a.range) / a.active, ARENA.minY, ARENA.maxY);
        const expected = Math.min(hits, Math.floor(((fr - a.startup) * hits) / a.active) + 1);
        const overlap = inCircle(foe.x, foe.y, f.x, f.y, RULES.dashHitR);
        if (overlap && act.hitsDone < expected) {
          act.hitsDone = expected;
          tryHit(ctx, f, foe, a, perHit, f.x - act.ax * 20, f.y - act.ay * 20);
          if (!f.action) return;
        }
      }
      break;
    case 'projectile':
      if (fr === a.startup) {
        ctx.w.projectiles.push({
          id: ctx.w.nextId++,
          owner: f.side,
          characterId: f.characterId,
          slot: act.slot,
          x: f.x + act.ax * 24,
          y: f.y + act.ay * 24,
          vx: act.ax * (a.speed ?? 8),
          vy: act.ay * (a.speed ?? 8),
          traveled: 0,
          reflected: false,
        });
      }
      break;
    case 'buff':
      if (fr === a.startup) {
        const { maxHp } = CHARACTERS[f.characterId].stats;
        if (a.healPct) {
          const amount = Math.round(maxHp * a.healPct);
          f.hp = Math.min(maxHp, f.hp + amount);
          ctx.events.push({ type: 'heal', target: f.side, amount });
        }
        for (const s of a.applyToSelf ?? []) addStatus(ctx, f, s.id, s.seconds);
      }
      break;
    case 'aoeTarget':
      if (a.leapToTarget && fr === a.startup - 1) {
        const zone = ctx.w.zones.find((z) => z.owner === f.side && z.slot === act.slot);
        if (zone) {
          f.x = zone.x;
          f.y = zone.y;
        }
      }
      break;
    case 'parry':
      break;
  }

  act.frame += 1;
  if (act.frame >= actionLength(a)) f.action = null;
}

function addStatus(ctx: Ctx, f: Fighter, id: StatusId, seconds: number) {
  const frames = Math.round(seconds * FPS);
  const existing = f.statuses.find((s) => s.id === id);
  if (existing) existing.frames = Math.max(existing.frames, frames);
  else f.statuses.push({ id, frames });
  ctx.events.push({ type: 'status', target: f.side, status: id });
}

export function computeDamage(attacker: Fighter, defender: Fighter, a: Ability, power: number, roll: number): number {
  const aStats = CHARACTERS[attacker.characterId].stats;
  const dStats = CHARACTERS[defender.characterId].stats;
  let stat = a.scaling === 'atk' ? aStats.atk : aStats.mag;
  if (hasStatus(attacker, 'atkUp')) stat *= RULES.atkUpMultiplier;
  let def = dStats.def;
  if (hasStatus(defender, 'defDown')) def *= RULES.defDownMultiplier;
  let p = power;
  if (a.missingHpBonus) p *= 1 + a.missingHpBonus * (1 - attacker.hp / aStats.maxHp);
  const variance = 0.9 + roll * 0.2;
  // Com ataque == defesa, o dano é igual ao poder.
  return Math.max(1, Math.round(((p * 2 * stat) / (stat + def)) * variance));
}

/** Resolve um golpe de `attacker` em `target`, considerando parry. */
export function isDashInvulnerable(f: Fighter): boolean {
  return f.dashFrames > RULES.dashFrames - RULES.dashInvulnFrames;
}

/** Dash: na direção que está segurando; sem direção, recua (para longe do oponente). */
function startDash(ctx: Ctx, f: Fighter, input: Input) {
  let dx: number = input.moveX;
  let dy: number = input.moveY;
  if (dx === 0 && dy === 0) {
    dx = -f.lookX;
    dy = -f.lookY;
  }
  const len = Math.hypot(dx, dy) || 1;
  f.dashX = dx / len;
  f.dashY = dy / len;
  f.dashFrames = RULES.dashFrames;
  f.dashCooldown = RULES.dashCooldown;
  ctx.events.push({ type: 'dash', side: f.side });
}

function dashStep(f: Fighter) {
  f.x = clamp(f.x + f.dashX * RULES.dashSpeed, ARENA.minX, ARENA.maxX);
  f.y = clamp(f.y + f.dashY * RULES.dashSpeed, ARENA.minY, ARENA.maxY);
  f.dashFrames -= 1;
  f.moving = true;
}

function tryHit(ctx: Ctx, attacker: Fighter, target: Fighter, a: Ability, power: number, fromX: number, fromY: number) {
  if (target.ko || isDashInvulnerable(target)) return;
  let dmg = computeDamage(attacker, target, a, power, ctx.rand());

  if (isParrying(target)) {
    if (a.slot === 'ultimate') {
      ctx.events.push({ type: 'parry', side: target.side, result: 'partial' });
      dmg = Math.round(dmg * (1 - RULES.parryUltimateBlock));
    } else {
      parrySuccess(target);
      if (a.slot === 'attack') {
        const reflected = Math.max(1, Math.round(dmg * RULES.parryReflect));
        ctx.events.push({ type: 'parry', side: target.side, result: 'reflect' });
        damage(ctx, target, attacker, reflected, false, 'reflect', 0x8fe0ff);
        stun(attacker, RULES.reflectStun);
      } else {
        ctx.events.push({ type: 'parry', side: target.side, result: 'block' });
        if (a.kind !== 'aoeTarget' && a.kind !== 'projectile') stun(attacker, RULES.blockStun);
      }
      return;
    }
  }

  const crit = a.slot === 'attack' && ctx.rand() < RULES.critChance;
  if (crit) dmg = Math.round(dmg * RULES.critMultiplier);
  damage(ctx, attacker, target, dmg, crit, 'hit', a.color);

  const armored = target.action?.slot === 'ultimate';
  if (!armored) {
    const kb = a.knockback ?? 6;
    stun(target, RULES.hitstunBase + kb);
    const [kx, ky] = dirTo(fromX, fromY, target.x, target.y, target.x >= fromX ? 1 : -1, 0);
    target.x = clamp(target.x + kx * kb * 2, ARENA.minX, ARENA.maxX);
    target.y = clamp(target.y + ky * kb * 2, ARENA.minY, ARENA.maxY);
  }
  for (const s of a.applyToTarget ?? []) addStatus(ctx, target, s.id, s.seconds);
}

function parrySuccess(f: Fighter) {
  f.action = null;
  f.cooldowns.parry = 0;
  f.gauge = Math.min(RULES.gaugeMax, f.gauge + RULES.gaugeOnParry);
}

function stun(f: Fighter, frames: number) {
  f.hitstun = Math.max(f.hitstun, frames);
  f.action = null;
}

function damage(
  ctx: Ctx,
  from: Fighter,
  to: Fighter,
  amount: number,
  crit: boolean,
  source: 'hit' | 'reflect',
  color: number,
) {
  to.hp -= amount;
  to.gauge = Math.min(RULES.gaugeMax, to.gauge + amount * RULES.gaugePerDamageTaken);
  if (from.action?.slot !== 'ultimate') {
    from.gauge = Math.min(RULES.gaugeMax, from.gauge + amount * RULES.gaugePerDamageDealt);
  }
  ctx.events.push({ type: 'hit', target: to.side, amount, crit, source, color });
}

function updateProjectiles(ctx: Ctx) {
  const { w } = ctx;
  w.projectiles = w.projectiles.filter((p) => {
    const a = ability(p, p.slot);
    p.x += p.vx;
    p.y += p.vy;
    p.traveled += Math.hypot(p.vx, p.vy);
    const outside = p.x < ARENA.minX - 40 || p.x > ARENA.maxX + 40 || p.y < ARENA.minY - 40 || p.y > ARENA.maxY + 40;
    if (p.traveled > a.range || outside) return false;

    const target = w.fighters[1 - p.owner];
    if (target.ko || isDashInvulnerable(target)) return true;
    if (!inCircle(target.x, target.y, p.x, p.y, Math.max(RULES.projectileHitR, a.depth))) return true;

    if (isParrying(target) && p.slot !== 'ultimate') {
      // Rebate: o projétil passa a ser de quem defendeu.
      parrySuccess(target);
      ctx.events.push({ type: 'parry', side: target.side, result: 'reflect' });
      p.owner = target.side;
      p.vx = -p.vx;
      p.vy = -p.vy;
      p.traveled = 0;
      p.reflected = true;
      return true;
    }
    const shooter = w.fighters[1 - target.side];
    const hits = a.hits ?? 1;
    // Projétil rebatido usa os atributos de quem o criou, mas acerta o dono original.
    const source = p.reflected ? { ...shooter, characterId: p.characterId, statuses: [] } : shooter;
    tryHit(ctx, source as Fighter, target, a, a.power / hits, p.x - p.vx, p.y - p.vy);
    return false;
  });
}

function updateZones(ctx: Ctx) {
  const { w } = ctx;
  w.zones = w.zones.filter((z) => {
    z.framesLeft -= 1;
    if (z.framesLeft > 0) return true;
    const a = ability(z, z.slot);
    ctx.events.push({ type: 'burst', x: z.x, y: z.y, radius: a.range, color: a.color });
    const owner = w.fighters[z.owner];
    const target = w.fighters[1 - z.owner];
    if (inCircle(target.x, target.y, z.x, z.y, a.range)) tryHit(ctx, owner, target, a, a.power, z.x, z.y);
    return false;
  });
}

function checkEnd(ctx: Ctx) {
  const { w } = ctx;
  for (const f of w.fighters) {
    if (!f.ko && f.hp <= 0) {
      f.hp = 0;
      f.ko = true;
      f.action = null;
      ctx.events.push({ type: 'ko', side: f.side });
    }
  }
  const [a, b] = w.fighters;
  if (a.ko || b.ko) {
    w.winner = a.ko && b.ko ? 'draw' : a.ko ? 1 : 0;
  } else if (w.framesLeft <= 0) {
    const ra = a.hp / CHARACTERS[a.characterId].stats.maxHp;
    const rb = b.hp / CHARACTERS[b.characterId].stats.maxHp;
    w.winner = Math.abs(ra - rb) < 0.001 ? 'draw' : ra > rb ? 0 : 1;
  }
  if (w.winner !== null) ctx.events.push({ type: 'end', winner: w.winner });
}
