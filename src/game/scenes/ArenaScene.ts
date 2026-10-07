import * as Phaser from 'phaser';
import { CpuController } from '../../shared/ai';
import { CHARACTERS, SLOT_ORDER } from '../../shared/characters';
import {
  ability,
  ARENA,
  createWorld,
  FPS,
  isDashInvulnerable,
  isParrying,
  RULES,
  slotBlockReason,
  step,
  type Fighter,
  type Input,
  type Side,
  type SimEvent,
  type World,
} from '../../shared/sim';
import type { Slot, StatusId } from '../../shared/types';
import { animKey, facesLeft, standingTexture, type AnimName } from '../sprites';
import type { ArenaData } from '../types';
import { bar, button, COLORS, HEIGHT, panel, text, WIDTH } from '../ui';

/** Linha da tela onde fica y = 0 do chão. */
const FLOOR_TOP = 112;
/** Vista de cima em 3/4: o chão aparece um pouco achatado na vertical. */
const VIEW_Y = 0.86;
const BASE_SCALE = 2.6;
const STEP_MS = 1000 / FPS;
const BUFFER_FRAMES = 8;

const STATUS_LABEL: Record<StatusId, string> = { burn: 'QUEIMA', defDown: 'DEF-', atkUp: 'ATQ+', regen: 'REGEN' };
const PARRY_LABEL = { reflect: 'DEVOLVEU!', block: 'BLOQUEOU!', partial: 'GUARDA QUEBRADA!' } as const;

interface KeyMap {
  up: string[];
  down: string[];
  left: string[];
  right: string[];
  slots: Record<Slot, string[]>;
  dash: string[];
  labels: string;
  dashLabel: string;
}

const P1_KEYS: KeyMap = {
  up: ['W'],
  down: ['S'],
  left: ['A'],
  right: ['D'],
  slots: { attack: ['Y'], parry: ['U'], skill: ['I'], ultimate: ['O'] },
  dash: ['SPACE'],
  labels: 'YUIO',
  dashLabel: 'ESP',
};

const P2_KEYS: KeyMap = {
  up: ['UP'],
  down: ['DOWN'],
  left: ['LEFT'],
  right: ['RIGHT'],
  slots: {
    attack: ['NUMPAD_ONE', 'SEVEN'],
    parry: ['NUMPAD_TWO', 'EIGHT'],
    skill: ['NUMPAD_THREE', 'NINE'],
    ultimate: ['NUMPAD_FOUR', 'ZERO'],
  },
  dash: ['ENTER', 'NUMPAD_ZERO'],
  labels: '7890',
  dashLabel: 'ENT',
};

/** Lê teclado de um jogador e guarda os apertos por alguns quadros (buffer). */
class KeyboardPlayer {
  private dirs: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key[]>;
  private pressedAt: Partial<Record<Slot | 'dash', number>> = {};
  private slotKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor(
    scene: Phaser.Scene,
    map: KeyMap,
    private readonly clock: () => number,
  ) {
    const kb = scene.input.keyboard!;
    const keys = (names: string[]) => names.map((n) => kb.addKey(n, true));
    this.dirs = { up: keys(map.up), down: keys(map.down), left: keys(map.left), right: keys(map.right) };
    const buttons: Array<[Slot | 'dash', string[]]> = [...SLOT_ORDER.map((s) => [s, map.slots[s]] as [Slot, string[]]), ['dash', map.dash]];
    for (const [slot, names] of buttons) {
      for (const k of keys(names)) {
        k.on('down', () => (this.pressedAt[slot] = this.clock()));
        this.slotKeys.push(k);
      }
    }
    scene.events.once('shutdown', () => this.slotKeys.forEach((k) => k.removeAllListeners('down')));
  }

  input(): Input {
    const held = (ks: Phaser.Input.Keyboard.Key[]) => ks.some((k) => k.isDown);
    const now = this.clock();
    const fresh = (s: Slot | 'dash') => this.pressedAt[s] !== undefined && now - this.pressedAt[s]! <= BUFFER_FRAMES;
    return {
      moveX: held(this.dirs.left) ? -1 : held(this.dirs.right) ? 1 : 0,
      moveY: held(this.dirs.up) ? -1 : held(this.dirs.down) ? 1 : 0,
      attack: fresh('attack'),
      parry: fresh('parry'),
      skill: fresh('skill'),
      ultimate: fresh('ultimate'),
      dash: fresh('dash'),
    };
  }

  consume() {
    this.pressedAt = {};
  }
}

interface FighterView {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  shield: Phaser.GameObjects.Ellipse;
  charge: Phaser.GameObjects.Graphics;
  anim: AnimName | null;
  leapFrom: { x: number; y: number } | null;
}

interface Hud {
  update(f: Fighter): void;
}

export class ArenaScene extends Phaser.Scene {
  private cfg!: ArenaData;
  private world!: World;
  private controllers: Array<{ input(w: World): Input; consume?(): void }> = [];
  private views: FighterView[] = [];
  private huds: Hud[] = [];
  private projectileViews = new Map<number, Phaser.GameObjects.Arc>();
  private zoneViews = new Map<number, Phaser.GameObjects.Graphics>();
  private accumulator = 0;
  private running = false;
  private paused = false;
  private finished = false;
  private timerText!: Phaser.GameObjects.Text;
  private pauseLayer: Phaser.GameObjects.Container | null = null;

  constructor() {
    super('Arena');
  }

  init(data: ArenaData) {
    this.cfg = data;
    this.world = createWorld(data.p1, data.p2, (Math.random() * 2 ** 32) >>> 0);
    this.views = [];
    this.huds = [];
    this.projectileViews = new Map();
    this.zoneViews = new Map();
    this.accumulator = 0;
    this.running = false;
    this.paused = false;
    this.finished = false;
    this.pauseLayer = null;
  }

  create() {
    this.drawStage();

    const clock = () => this.world.frame;
    const p1 = new KeyboardPlayer(this, P1_KEYS, clock);
    const p2 =
      this.cfg.mode === 'local'
        ? new KeyboardPlayer(this, P2_KEYS, clock)
        : new CpuController(1, Math.random, 7);
    this.controllers = [p1, p2];

    for (const f of this.world.fighters) this.views.push(this.makeFighterView(f));
    this.huds = [this.makeHud(0), this.makeHud(1)];
    this.makeSlotBar(0, P1_KEYS.labels, P1_KEYS.dashLabel);
    this.makeSlotBar(1, this.cfg.mode === 'local' ? P2_KEYS.labels : '', this.cfg.mode === 'local' ? P2_KEYS.dashLabel : '');
    this.timerText = text(this, WIDTH / 2, 30, '99', 22, COLORS.gold).setOrigin(0.5).setStroke('#000', 6).setDepth(1000);

    this.input.keyboard!.on('keydown-ESC', () => this.togglePause());
    this.render();
    this.countdown();
  }

  // ---------- laço principal ----------

  update(_time: number, delta: number) {
    if (this.running && !this.paused && !this.finished) {
      this.accumulator += Math.min(delta, 100);
      let steps = 0;
      while (this.accumulator >= STEP_MS && steps < 5) {
        this.accumulator -= STEP_MS;
        steps += 1;
        const inputs = this.controllers.map((c) => c.input(this.world)) as [Input, Input];
        const events = step(this.world, inputs);
        for (const e of events) {
          if (e.type === 'cast' || e.type === 'dash') this.controllers[e.side].consume?.();
        }
        this.handleEvents(events);
        if (this.world.winner !== null) {
          this.finish();
          break;
        }
      }
    }
    this.render();
  }

  private countdown() {
    const label = text(this, WIDTH / 2, 220, 'PRONTOS...', 30, COLORS.gold).setOrigin(0.5).setStroke('#000', 8).setDepth(2000);
    this.time.delayedCall(900, () => {
      label.setText('LUTEM!').setColor('#ff5a5a');
      this.tweens.add({ targets: label, scale: 1.4, alpha: 0, delay: 300, duration: 400, onComplete: () => label.destroy() });
      this.running = true;
    });
  }

  // ---------- cenário ----------

  /** Pátio do castelo de Guardia visto de cima, em 3/4. */
  private drawStage() {
    const g = this.add.graphics().setDepth(-100);
    const left = ARENA.minX - 30;
    const right = ARENA.maxX + 30;
    const top = this.toScreen(0, ARENA.minY).sy - 50;
    const bottom = HEIGHT;

    g.fillStyle(0x0e0a1c, 1);
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // Muro do fundo: topo + face frontal (é a face que dá a sensação de 3/4).
    g.fillStyle(0x5a5068, 1);
    g.fillRect(left - 20, top - 70, right - left + 40, 22);
    g.fillStyle(0x3a3248, 1);
    g.fillRect(left - 20, top - 48, right - left + 40, 48);
    g.fillStyle(0x2a2436, 1);
    for (let x = left - 20; x < right + 20; x += 32) g.fillRect(x, top - 48, 2, 48);
    for (let x = left - 10; x < right + 20; x += 64) g.fillRect(x, top - 76, 24, 8);
    // Estandartes vermelhos no muro.
    for (const x of [WIDTH / 2 - 180, WIDTH / 2 + 160]) {
      g.fillStyle(0x9a2a2a, 1);
      g.fillRect(x, top - 44, 20, 36);
      g.fillStyle(0xf0c040, 1);
      g.fillRect(x + 7, top - 36, 6, 6);
    }

    // Piso de pedra em ladrilhos.
    const tw = 40;
    const th = Math.round(40 * VIEW_Y);
    for (let y = top, row = 0; y < bottom; y += th, row++) {
      for (let x = left, col = 0; x < right; x += tw, col++) {
        g.fillStyle((row + col) % 2 ? 0x8a7f72 : 0x7e7366, 1);
        g.fillRect(x, y, tw, th);
        g.fillStyle(0x6a6056, 1);
        g.fillRect(x, y + th - 2, tw, 2);
        g.fillRect(x + tw - 2, y, 2, th);
      }
    }
    // Tapete real no meio.
    const cy = this.toScreen(0, (ARENA.minY + ARENA.maxY) / 2).sy;
    g.fillStyle(0x8a1e2a, 1);
    g.fillRect(left + 60, cy - 26, right - left - 120, 52);
    g.fillStyle(0xd0a040, 1);
    g.fillRect(left + 60, cy - 26, right - left - 120, 3);
    g.fillRect(left + 60, cy + 23, right - left - 120, 3);

    // Muros laterais (só a borda de cima aparece, vista de cima).
    g.fillStyle(0x4a4058, 1);
    g.fillRect(0, top - 70, left, bottom);
    g.fillRect(right, top - 70, WIDTH - right, bottom);
    g.fillStyle(0x5a5068, 1);
    g.fillRect(left - 8, top - 70, 8, bottom);
    g.fillRect(right, top - 70, 8, bottom);

    // Pilares nos cantos: base no chão, sobem para cima da tela.
    for (const [x, y] of [
      [left + 6, top + 6],
      [right - 30, top + 6],
    ]) {
      g.fillStyle(0x2a2436, 0.5);
      g.fillEllipse(x + 12, y + 22, 34, 12);
      g.fillStyle(0x9a90a8, 1);
      g.fillRect(x, y - 70, 24, 90);
      g.fillStyle(0xb8b0c4, 1);
      g.fillRect(x - 3, y - 76, 30, 8);
      g.fillStyle(0x6a6078, 1);
      g.fillRect(x + 18, y - 70, 6, 90);
    }
  }

  private toScreen(x: number, y: number) {
    return { sx: x, sy: FLOOR_TOP + y * VIEW_Y };
  }

  private depthScale(y: number) {
    // Leve: quem está mais embaixo na tela parece um pouco mais perto.
    return BASE_SCALE * (0.95 + 0.08 * (y / ARENA.maxY));
  }

  // ---------- personagens ----------

  private makeFighterView(f: Fighter): FighterView {
    const shadow = this.add.ellipse(0, 0, 54, 14, 0x000000, 0.4);
    const charge = this.add.graphics();
    const first = standingTexture(this, f.characterId);
    const sprite = this.add.sprite(0, 0, first.key, first.frame).setOrigin(0.5, 1);
    const shield = this.add.ellipse(0, 0, 70, 96, 0x8fe0ff, 0.2).setStrokeStyle(3, 0x8fe0ff, 0.9).setVisible(false);
    return { sprite, shadow, shield, charge, anim: null, leapFrom: null };
  }

  private animFor(f: Fighter): AnimName {
    if (this.finished && this.world.winner === f.side) return 'victory';
    if (f.ko) return 'ko';
    if (f.hitstun > 0) return 'hurt';
    if (f.action) {
      const a = ability(f, f.action.slot);
      if (a.kind === 'parry') return 'parry';
      if (a.kind === 'melee' || a.kind === 'dash' || f.action.slot === 'attack') return 'attack';
      return 'cast';
    }
    const base = f.moving ? 'walk' : 'idle';
    // Olhando mais para cima/baixo do que para os lados: sprite de costas/frente.
    if (f.lookY < -0.7) return `${base}_up`;
    if (f.lookY > 0.7) return `${base}_down`;
    return base;
  }

  private render() {
    const w = this.world;
    w.fighters.forEach((f, i) => {
      const v = this.views[i];
      const { sx, sy } = this.toScreen(f.x, f.y);
      const scale = this.depthScale(f.y);
      let drawX = sx;
      let drawY = sy;
      let lift = 0;

      // Frog Squash: arco do salto até a área marcada.
      const act = f.action;
      if (act && ability(f, act.slot).leapToTarget && v.leapFrom) {
        const a = ability(f, act.slot);
        const t = Math.min(1, act.frame / a.startup);
        const zone = w.zones.find((z) => z.owner === f.side && z.slot === act.slot);
        if (zone && t < 1) {
          drawX = Phaser.Math.Linear(v.leapFrom.x, zone.x, t);
          drawY = this.toScreen(0, Phaser.Math.Linear(v.leapFrom.y, zone.y, t)).sy;
          lift = Math.sin(t * Math.PI) * 160;
        }
      } else {
        v.leapFrom = null;
      }

      const anim = this.animFor(f);
      const sideView = !anim.endsWith('_up') && !anim.endsWith('_down');
      const flip = sideView && (f.lookX < 0) !== facesLeft(this, f.characterId);
      v.sprite.setPosition(drawX, drawY - lift).setScale(scale).setFlipX(flip).setDepth(drawY);
      v.shadow.setPosition(drawX, drawY).setScale((scale / BASE_SCALE) * (1 - lift / 400)).setDepth(drawY - 1);
      if (anim !== v.anim) {
        v.anim = anim;
        v.sprite.play(animKey(f.characterId, anim));
      }

      // Tons de status.
      if (f.hitstun <= 0 && !f.ko) {
        if (f.statuses.some((s) => s.id === 'burn') && w.frame % 20 < 6) v.sprite.setTint(0xff9a5a);
        else if (f.action?.slot === 'ultimate') v.sprite.setTint(w.frame % 8 < 4 ? 0xfff2a0 : 0xffffff);
        else v.sprite.clearTint();
      }

      v.sprite.setAlpha(isDashInvulnerable(f) ? 0.55 : 1);
      v.shield.setVisible(isParrying(f)).setPosition(drawX, drawY - 36 * (scale / BASE_SCALE)).setDepth(drawY + 1);

      // Área em volta carregando: anel que cresce (aviso para fugir).
      v.charge.clear();
      if (act) {
        const a = ability(f, act.slot);
        if (a.kind === 'aoeSelf' && act.frame < a.startup) {
          const t = act.frame / a.startup;
          v.charge.lineStyle(2, a.color, 0.4 + 0.5 * t);
          v.charge.strokeEllipse(sx, sy, a.range * 2 * t, a.range * 2 * VIEW_Y * t);
          v.charge.lineStyle(1, a.color, 0.35);
          v.charge.strokeEllipse(sx, sy, a.range * 2, a.range * 2 * VIEW_Y);
          v.charge.setDepth(sy - 2);
        }
      }
    });

    // Projéteis.
    const alive = new Set<number>();
    for (const p of w.projectiles) {
      alive.add(p.id);
      let view = this.projectileViews.get(p.id);
      const a = ability(p, p.slot);
      if (!view) {
        view = this.add.circle(0, 0, p.slot === 'skill' ? 10 : 6, a.color).setStrokeStyle(2, 0xffffff, 0.8);
        this.projectileViews.set(p.id, view);
      }
      const { sx, sy } = this.toScreen(p.x, p.y);
      view.setPosition(sx, sy - 34).setDepth(sy);
      if (p.reflected) view.setStrokeStyle(2, 0x8fe0ff, 1);
    }
    for (const [id, view] of this.projectileViews) {
      if (!alive.has(id)) {
        view.destroy();
        this.projectileViews.delete(id);
      }
    }

    // Áreas marcadas no chão.
    const zones = new Set<number>();
    for (const z of w.zones) {
      zones.add(z.id);
      let g = this.zoneViews.get(z.id);
      if (!g) {
        g = this.add.graphics();
        this.zoneViews.set(z.id, g);
      }
      const a = ability(z, z.slot);
      const { sx, sy } = this.toScreen(z.x, z.y);
      const t = 1 - z.framesLeft / z.total;
      const rx = a.range;
      const ry = a.range * VIEW_Y;
      g.clear().setDepth(sy - 3);
      g.fillStyle(a.color, 0.12 + 0.25 * t);
      g.fillEllipse(sx, sy, rx * 2 * t, ry * 2 * t);
      g.lineStyle(2, w.frame % 10 < 5 ? 0xff4040 : a.color, 0.9);
      g.strokeEllipse(sx, sy, rx * 2, ry * 2);
    }
    for (const [id, g] of this.zoneViews) {
      if (!zones.has(id)) {
        g.destroy();
        this.zoneViews.delete(id);
      }
    }

    w.fighters.forEach((f, i) => this.huds[i].update(f));
    this.timerText.setText(String(Math.max(0, Math.ceil(w.framesLeft / FPS))));
  }

  // ---------- eventos visuais ----------

  private handleEvents(events: SimEvent[]) {
    for (const e of events) {
      switch (e.type) {
        case 'dash':
          this.dashGhosts(e.side);
          break;
        case 'cast': {
          const f = this.world.fighters[e.side];
          const a = ability(f, e.slot);
          if (a.leapToTarget) this.views[e.side].leapFrom = { x: f.x, y: f.y };
          if (e.slot === 'skill' || e.slot === 'ultimate') {
            this.floatText(e.side, e.name.toUpperCase(), e.slot === 'ultimate' ? '#f5d04a' : '#c08aff', -110, 12);
          }
          if (e.slot === 'ultimate') {
            this.cameras.main.flash(180, 255, 240, 180);
          }
          break;
        }
        case 'hit': {
          const v = this.views[e.target];
          v.sprite.setTintFill(0xffffff);
          this.time.delayedCall(60, () => v.sprite.clearTint());
          const color = e.source === 'burn' ? '#ff9a3a' : e.crit ? '#f5d04a' : e.source === 'reflect' ? '#8fe0ff' : '#ff6a6a';
          this.floatText(e.target, `${e.crit ? 'CRÍTICO ' : ''}${e.amount}`, color, -90, e.amount > 50 ? 18 : 13);
          if (e.source !== 'burn') {
            this.spark(e.target, e.color);
            this.cameras.main.shake(e.amount > 50 ? 260 : 90, e.amount > 50 ? 0.012 : 0.004);
          }
          break;
        }
        case 'parry':
          this.floatText(e.side, PARRY_LABEL[e.result], '#8fe0ff', -130, 12);
          this.cameras.main.flash(80, 140, 220, 255);
          break;
        case 'heal':
          this.floatText(e.target, `+${e.amount}`, '#6aff8a', -90, 13);
          break;
        case 'status':
          this.floatText(e.target, STATUS_LABEL[e.status], '#f5d04a', -60, 9);
          break;
        case 'burst': {
          const { sx, sy } = this.toScreen(e.x, e.y);
          const ring = this.add
            .ellipse(sx, sy, 20, 20 * VIEW_Y, e.color, 0.5)
            .setStrokeStyle(3, 0xffffff, 0.8)
            .setDepth(sy + 50);
          this.tweens.add({
            targets: ring,
            width: e.radius * 2,
            height: e.radius * 2 * VIEW_Y,
            alpha: 0,
            duration: 380,
            ease: 'Quad.out',
            onComplete: () => ring.destroy(),
          });
          const pillar = this.add.rectangle(sx, sy, Math.min(80, e.radius * 0.6), 160, e.color, 0.3).setOrigin(0.5, 1).setDepth(sy + 49);
          this.tweens.add({ targets: pillar, scaleX: 0.1, alpha: 0, duration: 420, onComplete: () => pillar.destroy() });
          break;
        }
        case 'ko':
          this.cameras.main.shake(400, 0.015);
          break;
        case 'end':
          break;
      }
    }
  }

  /** Rastro de "fantasmas" atrás de quem deu dash. */
  private dashGhosts(side: Side) {
    const v = this.views[side];
    for (let i = 0; i < 4; i++) {
      this.time.delayedCall(i * 35, () => {
        const ghost = this.add
          .sprite(v.sprite.x, v.sprite.y, v.sprite.texture.key, v.sprite.frame.name)
          .setOrigin(0.5, 1)
          .setScale(v.sprite.scaleX)
          .setFlipX(v.sprite.flipX)
          .setTintFill(0x8fe0ff)
          .setAlpha(0.5)
          .setDepth(v.sprite.depth - 1);
        this.tweens.add({ targets: ghost, alpha: 0, duration: 220, onComplete: () => ghost.destroy() });
      });
    }
  }

  private floatText(side: Side, value: string, color: string, offset: number, size: number) {
    const f = this.world.fighters[side];
    const { sx, sy } = this.toScreen(f.x, f.y);
    const t = text(this, sx + Phaser.Math.Between(-14, 14), sy + offset, value, size, color)
      .setOrigin(0.5)
      .setStroke('#000', 5)
      .setDepth(1500);
    this.tweens.add({ targets: t, y: t.y - 34, alpha: 0, duration: 900, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  private spark(side: Side, color: number) {
    const f = this.world.fighters[side];
    const { sx, sy } = this.toScreen(f.x, f.y);
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(sx, sy - 38, 5, 5, i % 2 ? 0xffffff : color).setDepth(sy + 2);
      const ang = Phaser.Math.FloatBetween(0, Math.PI * 2);
      this.tweens.add({
        targets: p,
        x: sx + Math.cos(ang) * 40,
        y: sy - 38 + Math.sin(ang) * 30,
        alpha: 0,
        duration: 260,
        onComplete: () => p.destroy(),
      });
    }
  }

  // ---------- HUD ----------

  private makeHud(side: Side): Hud {
    const f = this.world.fighters[side];
    const c = CHARACTERS[f.characterId];
    const w = 360;
    const x = side === 0 ? 12 : WIDTH - 12 - w;
    panel(this, x, 8, w, 84).setDepth(900);
    const tag = this.cfg.mode === 'cpu' ? (side === 0 ? 'VOCÊ' : 'CPU') : `P${side + 1}`;
    text(this, x + 12, 18, `${tag}  ${c.name.toUpperCase()}`, 10, side === 0 ? '#8fc8ff' : '#ff9a9a').setDepth(901);
    const statusText = text(this, x + w - 12, 20, '', 7, COLORS.gold).setOrigin(1, 0).setDepth(901);
    const hpText = text(this, x + 12, 38, '', 7, COLORS.text).setDepth(901);
    const barX = x + 64;
    const barW = w - 78;
    const setHp = bar(this, barX, 38, barW, 10, COLORS.hp, 901);
    const lag = this.add.rectangle(barX, 38, barW, 10, 0xff4040).setOrigin(0, 0).setDepth(902);
    text(this, x + 12, 56, 'MP', 7, COLORS.muted).setDepth(901);
    const setMp = bar(this, barX, 57, barW, 5, COLORS.mp, 901);
    const gaugeLabel = text(this, x + 12, 70, 'ULT', 7, COLORS.muted).setDepth(901);
    const setGauge = bar(this, barX, 71, barW, 7, COLORS.gauge, 901);

    let lastHp = f.hp;
    return {
      update: (fr) => {
        const maxHp = c.stats.maxHp;
        if (fr.hp !== lastHp) {
          setHp(fr.hp / maxHp, false);
          this.tweens.add({ targets: lag, width: (Math.max(0, fr.hp) / maxHp) * barW, delay: 300, duration: 400 });
          lastHp = fr.hp;
        }
        hpText.setText(String(Math.max(0, Math.ceil(fr.hp))));
        setMp(fr.mp / c.stats.maxMp, false);
        setGauge(fr.gauge / RULES.gaugeMax, false);
        const full = fr.gauge >= RULES.gaugeMax;
        gaugeLabel.setText(full ? 'ULT!' : 'ULT').setColor(full && this.world.frame % 30 < 15 ? COLORS.gold : COLORS.muted);
        statusText.setText(fr.statuses.map((s) => STATUS_LABEL[s.id]).join(' '));
      },
    };
  }

  private makeSlotBar(side: Side, keys: string, dashLabel: string) {
    const f = this.world.fighters[side];
    const size = 40;
    const gap = 6;
    const dashW = 52;
    const total = 4 * size + 4 * gap + dashW;
    const x0 = side === 0 ? 14 : WIDTH - 14 - total;
    const y = HEIGHT - size - 10;
    const boxes = SLOT_ORDER.map((slot, i) => {
      const x = x0 + i * (size + gap);
      const bg = this.add.rectangle(x, y, size, size, 0x141c4a, 0.9).setOrigin(0).setStrokeStyle(2, 0x5a6ab8).setDepth(950);
      const fill = this.add.rectangle(x, y + size, size, 0, 0x000000, 0.6).setOrigin(0, 1).setDepth(951);
      const color = ability(f, slot).color;
      this.add.rectangle(x + size / 2, y + size / 2 + 2, 14, 14, color, 0.9).setDepth(950);
      const key = text(this, x + 3, y + 3, keys[i] ?? '', 8, COLORS.text).setDepth(952);
      return { slot, bg, fill, key };
    });
    const dx = x0 + 4 * (size + gap);
    const dashBg = this.add.rectangle(dx, y, dashW, size, 0x141c4a, 0.9).setOrigin(0).setStrokeStyle(2, 0x8fa8ff).setDepth(950);
    const dashFill = this.add.rectangle(dx, y + size, dashW, 0, 0x000000, 0.6).setOrigin(0, 1).setDepth(951);
    text(this, dx + 3, y + 3, dashLabel, 7, COLORS.text).setDepth(952);
    text(this, dx + dashW / 2, y + 26, 'DASH', 7, '#8fe0ff').setOrigin(0.5).setDepth(952);
    const update = () => {
      const fr = this.world.fighters[side];
      dashFill.height = size * (fr.dashCooldown / RULES.dashCooldown);
      dashBg.setStrokeStyle(2, fr.dashCooldown > 0 ? 0x5a6ab8 : 0x8fa8ff);
      for (const b of boxes) {
        const a = ability(fr, b.slot);
        const reason = slotBlockReason(fr, b.slot);
        let ratio = 0;
        if (reason === 'recarga') ratio = fr.cooldowns[b.slot] / Math.max(1, a.cooldown * FPS);
        else if (reason === 'barra') ratio = 1 - fr.gauge / RULES.gaugeMax;
        else if (reason === 'MP') ratio = 1;
        b.fill.height = size * ratio;
        b.bg.setStrokeStyle(2, reason ? 0x5a6ab8 : b.slot === 'ultimate' ? 0xf5d04a : 0x8fa8ff);
      }
    };
    this.events.on('postupdate', update);
    this.events.once('shutdown', () => this.events.off('postupdate', update));
  }

  // ---------- pausa e fim ----------

  private togglePause() {
    if (this.finished) {
      this.scene.start('Menu');
      return;
    }
    this.paused = !this.paused;
    if (!this.paused) {
      this.pauseLayer?.destroy();
      this.pauseLayer = null;
      return;
    }
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.6).setOrigin(0);
    const title = text(this, WIDTH / 2, 190, 'PAUSA', 28, COLORS.gold).setOrigin(0.5).setStroke('#000', 6);
    const resume = button(this, WIDTH / 2, 270, 300, 40, 'CONTINUAR (ESC)', () => this.togglePause(), 10);
    const quit = button(this, WIDTH / 2, 322, 300, 40, 'SAIR PARA O MENU', () => this.scene.start('Menu'), 10);
    this.pauseLayer = this.add.container(0, 0, [shade, title, resume.container, quit.container]).setDepth(3000);
  }

  private finish() {
    this.finished = true;
    const w = this.world.winner;
    const label =
      w === 'draw'
        ? 'EMPATE!'
        : this.cfg.mode === 'cpu'
          ? w === 0
            ? 'VOCÊ VENCEU!'
            : 'CPU VENCEU!'
          : `${CHARACTERS[this.world.fighters[w as Side].characterId].name.toUpperCase()} VENCE!`;
    const ko = this.world.fighters.some((f) => f.ko);
    const big = text(this, WIDTH / 2, 200, ko ? 'K.O.!' : 'TEMPO!', 48, '#ff5a5a').setOrigin(0.5).setStroke('#000', 10).setDepth(2000);
    big.setScale(0);
    this.tweens.add({ targets: big, scale: 1, duration: 300, ease: 'Back.out' });

    this.time.delayedCall(1500, () => {
      big.destroy();
      this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.55).setOrigin(0).setDepth(2000);
      text(this, WIDTH / 2, 170, label, 30, COLORS.gold).setOrigin(0.5).setStroke('#000', 8).setDepth(2001);
      const options = [
        { label: 'REVANCHE', action: () => this.scene.restart(this.cfg) },
        { label: 'TROCAR PERSONAGEM', action: () => this.scene.start('Select', { mode: this.cfg.mode }) },
        { label: 'MENU', action: () => this.scene.start('Menu') },
      ];
      const buttons = options.map((o, i) => {
        const b = button(this, WIDTH / 2, 250 + i * 52, 320, 40, o.label, o.action, 10);
        b.container.setDepth(2001);
        return b;
      });
      let idx = 0;
      const refresh = () => buttons.forEach((b, i) => b.setSelected(i === idx));
      buttons.forEach((b, i) => b.container.on('pointerover', () => ((idx = i), refresh())));
      refresh();
      const kb = this.input.keyboard!;
      const up = () => ((idx = (idx + 2) % 3), refresh());
      const down = () => ((idx = (idx + 1) % 3), refresh());
      kb.on('keydown-UP', up);
      kb.on('keydown-W', up);
      kb.on('keydown-DOWN', down);
      kb.on('keydown-S', down);
      kb.on('keydown-ENTER', () => options[idx].action());
    });
  }
}
