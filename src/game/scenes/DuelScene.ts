import Phaser from 'phaser';
import { chooseCpuAction } from '../../shared/ai';
import { ACTION_LABEL, ACTION_ORDER, CHARACTERS } from '../../shared/characters';
import {
  actionBlockReason,
  createDuel,
  getAbility,
  resolveTurn,
  RULES,
  type DuelEvent,
  type DuelState,
  type Side,
} from '../../shared/engine';
import type { ActionKind, StatusId } from '../../shared/types';
import { spriteKey } from '../sprites';
import type { DuelData } from '../types';
import { bar, button, COLORS, HEIGHT, panel, text, WIDTH, type Button } from '../ui';
import { abilityCostLine } from './SkillsScene';

const FLOOR_Y = 360;
const FIGHTER_X: [number, number] = [260, 700];
const STATUS_LABEL: Record<StatusId, string> = { burn: 'QUEIMA', defDown: 'DEF-', atkUp: 'ATQ+', regen: 'REGEN' };
const PARRY_LABEL = { reflect: 'DEVOLVEU!', block: 'BLOQUEOU!', partial: 'GUARDA QUEBRADA!', whiff: 'NADA...' } as const;

interface Hud {
  setHp(hp: number): void;
  sync(state: DuelState): void;
}

export class DuelScene extends Phaser.Scene {
  private data0!: DuelData;
  private state!: DuelState;
  private chooser: Side = 0;
  private pending: (ActionKind | null)[] = [null, null];
  private busy = false;
  private fighters: Phaser.GameObjects.Image[] = [];
  private huds: Hud[] = [];
  private actionButtons: Button[] = [];
  private highlighted = 0;
  private prompt!: Phaser.GameObjects.Text;
  private turnLabel!: Phaser.GameObjects.Text;
  private infoTitle!: Phaser.GameObjects.Text;
  private infoCost!: Phaser.GameObjects.Text;
  private infoDesc!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];

  constructor() {
    super('Duel');
  }

  init(data: DuelData) {
    this.data0 = data;
    this.state = createDuel(data.p1, data.p2);
    this.chooser = 0;
    this.pending = [null, null];
    this.busy = false;
    this.fighters = [];
    this.huds = [];
    this.logLines = [];
    this.highlighted = 0;
  }

  create() {
    this.drawStage();
    ([0, 1] as Side[]).forEach((side) => {
      const id = this.state.fighters[side].characterId;
      const img = this.add.image(FIGHTER_X[side], FLOOR_Y, spriteKey(this, id, 'battle')).setOrigin(0.5, 1);
      const scale = 144 / img.height;
      img.setScale(scale >= 1 ? Math.floor(scale) : scale).setFlipX(side === 1);
      this.tweens.add({ targets: img, y: FLOOR_Y - 3, duration: 700 + side * 90, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.fighters.push(img);
      this.huds.push(this.makeHud(side));
    });

    this.turnLabel = text(this, WIDTH / 2, 30, '', 12, COLORS.gold).setOrigin(0.5);
    this.prompt = text(this, WIDTH / 2, 380, '', 10, COLORS.text).setOrigin(0.5).setStroke('#000', 4);

    panel(this, 12, 396, 450, 134);
    panel(this, 470, 396, 478, 134);
    this.actionButtons = ACTION_ORDER.map((kind, i) => {
      const bx = 128 + (i % 2) * 218;
      const by = 432 + Math.floor(i / 2) * 58;
      const b = button(this, bx, by, 206, 46, '', () => this.choose(kind), 9);
      b.container.on('pointerover', () => this.highlight(i));
      return b;
    });
    this.infoTitle = text(this, 488, 410, '', 10, COLORS.gold);
    this.infoCost = text(this, 488, 428, '', 7, COLORS.muted);
    this.infoDesc = text(this, 488, 442, '', 7, COLORS.text, { wordWrap: { width: 446 } });
    this.logText = text(this, 488, 484, '', 7, '#8fa8ff', { lineSpacing: 4 });

    const kb = this.input.keyboard!;
    ACTION_ORDER.forEach((kind, i) => {
      const keys = ['ONE', 'TWO', 'THREE', 'FOUR'][i];
      kb.on(`keydown-${keys}`, () => this.choose(kind));
    });
    kb.on('keydown-LEFT', () => this.highlight(this.highlighted ^ 1));
    kb.on('keydown-RIGHT', () => this.highlight(this.highlighted ^ 1));
    kb.on('keydown-UP', () => this.highlight(this.highlighted ^ 2));
    kb.on('keydown-DOWN', () => this.highlight(this.highlighted ^ 2));
    kb.on('keydown-ENTER', () => this.choose(ACTION_ORDER[this.highlighted]));
    kb.on('keydown-SPACE', () => this.choose(ACTION_ORDER[this.highlighted]));

    this.log(`${this.name(0)} vs ${this.name(1)}. Que comece o duelo!`);
    this.startChoosing(0);
  }

  // ---------- cenário e HUD ----------

  private drawStage() {
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1450, 0x1a1450, 0x5a2a6a, 0x5a2a6a, 1);
    g.fillRect(0, 0, WIDTH, FLOOR_Y);
    g.fillStyle(0x2a1a3a, 1);
    g.fillRect(0, FLOOR_Y, WIDTH, HEIGHT - FLOOR_Y);
    g.fillStyle(0x3a2a4a, 1);
    for (let x = 0; x < WIDTH; x += 48) g.fillRect(x, FLOOR_Y + 8, 40, 4);
    // Lua e montanhas ao fundo.
    g.fillStyle(0xf0e8c0, 0.9);
    g.fillCircle(WIDTH / 2, 200, 30);
    g.fillStyle(0x24184a, 1);
    for (let i = 0; i < 9; i++) {
      const x = i * 130 - 40;
      g.fillTriangle(x, FLOOR_Y, x + 90, FLOOR_Y - 120 - (i % 3) * 30, x + 180, FLOOR_Y);
    }
  }

  private makeHud(side: Side): Hud {
    const c = CHARACTERS[this.state.fighters[side].characterId];
    const x = side === 0 ? 12 : WIDTH / 2 + 30;
    const w = WIDTH / 2 - 42;
    panel(this, x, 50, w, 92);
    const tag = this.data0.mode === 'cpu' ? (side === 0 ? 'VOCÊ' : 'CPU') : `P${side + 1}`;
    text(this, x + 14, 62, `${tag}  ${c.name.toUpperCase()}`, 10, side === 0 ? '#8fc8ff' : '#ff9a9a');
    const statusText = text(this, x + w - 14, 62, '', 7, COLORS.gold).setOrigin(1, 0);
    const barW = w - 90;
    const hpValue = text(this, x + 14, 82, '', 7, COLORS.text);
    const setHpBar = bar(this, x + 76, 84, barW, 8, COLORS.hp);
    text(this, x + 14, 102, 'MP', 7, COLORS.muted);
    const setMp = bar(this, x + 76, 104, barW, 5, COLORS.mp);
    const gaugeLabel = text(this, x + 14, 118, 'TECH', 7, COLORS.muted);
    const setGauge = bar(this, x + 76, 120, barW, 6, COLORS.gauge);
    const maxHp = c.stats.maxHp;

    const setHp = (hp: number) => {
      hpValue.setText(`${Math.max(0, hp)}`);
      setHpBar(hp / maxHp);
    };
    setHp(maxHp);

    return {
      setHp,
      sync: (state) => {
        const f = state.fighters[side];
        setHp(f.hp);
        setMp(f.mp / c.stats.maxMp);
        setGauge(f.gauge / RULES.gaugeMax);
        const full = f.gauge >= RULES.gaugeMax;
        gaugeLabel.setColor(full ? COLORS.gold : COLORS.muted).setText(full ? 'ULT!' : 'TECH');
        statusText.setText(f.statuses.map((s) => `${STATUS_LABEL[s.id]}(${s.turns})`).join(' '));
      },
    };
  }

  // ---------- escolha de ação ----------

  private startChoosing(side: Side) {
    this.chooser = side;
    this.turnLabel.setText(`TURNO ${this.state.turn}`);
    this.huds.forEach((h) => h.sync(this.state));
    const who = this.data0.mode === 'cpu' ? 'Escolha sua ação' : `JOGADOR ${side + 1}: escolha sua ação`;
    this.prompt.setText(`${who}  (1-4)`);
    const f = this.state.fighters[side];
    this.actionButtons.forEach((b, i) => {
      const kind = ACTION_ORDER[i];
      const reason = actionBlockReason(this.state, side, kind);
      b.setLabel(`${i + 1}. ${ACTION_LABEL[kind].toUpperCase()}${reason ? `\n${reason}` : `\n${getAbility(f, kind).name}`}`);
      b.setEnabled(reason === null);
      b.container.setVisible(true);
    });
    this.highlight(0);
    this.busy = false;
  }

  private highlight(i: number) {
    this.highlighted = i;
    this.actionButtons.forEach((b, j) => b.setSelected(i === j));
    const ability = getAbility(this.state.fighters[this.chooser], ACTION_ORDER[i]);
    this.infoTitle.setText(ability.name);
    this.infoCost.setText(abilityCostLine(ability));
    this.infoDesc.setText(ability.description);
  }

  private choose(kind: ActionKind) {
    if (this.busy || this.state.winner !== null) return;
    if (actionBlockReason(this.state, this.chooser, kind) !== null) {
      this.cameras.main.shake(80, 0.003);
      return;
    }
    this.busy = true;
    this.pending[this.chooser] = kind;

    if (this.data0.mode === 'local' && this.chooser === 0) {
      // Esconde a escolha do P1 antes do P2 olhar a tela.
      this.prompt.setText('P1 escolheu! Vez do JOGADOR 2...');
      this.actionButtons.forEach((b) => b.container.setVisible(false));
      this.time.delayedCall(700, () => this.startChoosing(1));
      return;
    }
    if (this.data0.mode === 'cpu') this.pending[1] = chooseCpuAction(this.state, 1);
    this.actionButtons.forEach((b) => b.container.setVisible(false));
    this.runTurn();
  }

  // ---------- resolução e animação ----------

  private async runTurn() {
    const actions = this.pending as [ActionKind, ActionKind];
    this.pending = [null, null];
    this.prompt.setText('');
    [this.infoTitle, this.infoCost, this.infoDesc].forEach((t) => t.setText(''));
    const { state, events } = resolveTurn(this.state, actions);
    const displayHp = this.state.fighters.map((f) => f.hp);
    const maxHp = this.state.fighters.map((f) => CHARACTERS[f.characterId].stats.maxHp);

    // As duas ações aparecem juntas, como no jogo original.
    const actionEvents = events.filter((e): e is Extract<DuelEvent, { type: 'action' }> => e.type === 'action');
    for (const e of actionEvents) this.animateAction(e.side, e.action, e.abilityName);
    this.log(actionEvents.map((e) => `${this.name(e.side)}: ${e.abilityName}`).join('  |  '));
    await this.wait(650);

    for (const e of events) {
      switch (e.type) {
        case 'action':
          continue;
        case 'parry':
          this.float(e.side, PARRY_LABEL[e.result], '#8fe0ff', 0);
          if (e.result === 'reflect') this.log(`${this.name(e.side)} devolveu o golpe!`);
          if (e.result === 'block') this.log(`${this.name(e.side)} bloqueou a habilidade!`);
          if (e.result === 'partial') this.log(`A ultimate quebrou a guarda de ${this.name(e.side)}!`);
          break;
        case 'damage': {
          displayHp[e.target] = Math.max(0, displayHp[e.target] - e.amount);
          this.huds[e.target].setHp(displayHp[e.target]);
          this.hitFlash(e.target);
          const color = e.source === 'burn' ? '#ff9a3a' : e.crit ? '#f5d04a' : '#ff6a6a';
          this.float(e.target, `${e.crit ? 'CRÍTICO ' : ''}-${e.amount}`, color);
          if (e.source === 'burn') this.log(`${this.name(e.target)} sofre ${e.amount} de queimadura.`);
          break;
        }
        case 'heal':
          displayHp[e.target] = Math.min(maxHp[e.target], displayHp[e.target] + e.amount);
          this.huds[e.target].setHp(displayHp[e.target]);
          this.float(e.target, `+${e.amount}`, '#6aff8a');
          break;
        case 'status':
          this.float(e.target, STATUS_LABEL[e.status], '#f5d04a', 40);
          break;
        case 'ko':
          this.tweens.killTweensOf(this.fighters[e.side]);
          this.tweens.add({ targets: this.fighters[e.side], angle: e.side === 0 ? -90 : 90, alpha: 0.6, duration: 500 });
          this.log(`${this.name(e.side)} caiu!`);
          break;
        case 'end':
          break;
      }
      await this.wait(380);
    }

    this.state = state;
    this.huds.forEach((h) => h.sync(state));
    if (state.winner !== null) {
      await this.wait(500);
      this.showResult();
    } else {
      this.startChoosing(0);
    }
  }

  private animateAction(side: Side, action: ActionKind, abilityName: string) {
    const img = this.fighters[side];
    const banner = text(this, FIGHTER_X[side], FLOOR_Y - 178, abilityName.toUpperCase(), 11, COLORS.gold)
      .setOrigin(0.5)
      .setStroke('#000', 5);
    this.tweens.add({ targets: banner, y: banner.y - 14, alpha: 0, delay: 700, duration: 400, onComplete: () => banner.destroy() });

    if (action === 'parry') {
      const shield = this.add.circle(img.x, img.y - img.displayHeight / 2, img.displayHeight * 0.6, 0x8fe0ff, 0.25);
      shield.setStrokeStyle(3, 0x8fe0ff, 0.9);
      this.tweens.add({ targets: shield, alpha: 0, scale: 1.2, delay: 500, duration: 500, onComplete: () => shield.destroy() });
      return;
    }
    const dir = side === 0 ? 1 : -1;
    const distance = action === 'attack' ? 110 : 60;
    this.tweens.add({ targets: img, x: FIGHTER_X[side] + dir * distance, duration: 160, yoyo: true, ease: 'Quad.out' });
    if (action === 'skill') img.setTint(0xc08aff);
    if (action === 'ultimate') {
      img.setTint(0xf5d04a);
      this.cameras.main.flash(250, 255, 240, 180);
      this.cameras.main.shake(350, 0.012);
    }
    this.time.delayedCall(450, () => img.clearTint());
  }

  private hitFlash(side: Side) {
    const img = this.fighters[side];
    img.setTintFill(0xffffff);
    this.time.delayedCall(90, () => img.setTint(0xff6a6a));
    this.time.delayedCall(220, () => img.clearTint());
    this.tweens.add({ targets: img, x: FIGHTER_X[side] + (side === 0 ? -8 : 8), duration: 50, yoyo: true, repeat: 1 });
  }

  private float(side: Side, value: string, color: string, offset = -30) {
    const img = this.fighters[side];
    const t = text(this, img.x + Phaser.Math.Between(-16, 16), img.y - img.displayHeight + offset, value, 14, color)
      .setOrigin(0.5)
      .setStroke('#000', 5);
    this.tweens.add({ targets: t, y: t.y - 36, alpha: 0, duration: 1000, ease: 'Quad.out', onComplete: () => t.destroy() });
  }

  private showResult() {
    const w = this.state.winner;
    const label =
      w === 'draw'
        ? 'EMPATE!'
        : this.data0.mode === 'cpu'
          ? w === 0
            ? 'VOCÊ VENCEU!'
            : 'CPU VENCEU!'
          : `${this.name(w as Side).toUpperCase()} VENCE!`;
    this.add.rectangle(0, 0, WIDTH, HEIGHT, 0x000000, 0.6).setOrigin(0);
    const t = text(this, WIDTH / 2, 190, label, 32, COLORS.gold).setOrigin(0.5).setStroke('#000', 8).setScale(0);
    this.tweens.add({ targets: t, scale: 1, duration: 350, ease: 'Back.out' });
    text(this, WIDTH / 2, 240, `Duelo decidido no turno ${this.state.turn - 1}`, 9, COLORS.muted).setOrigin(0.5);

    const options = [
      { label: 'REVANCHE', action: () => this.scene.restart(this.data0) },
      { label: 'TROCAR PERSONAGEM', action: () => this.scene.start('Select', { mode: this.data0.mode }) },
      { label: 'MENU', action: () => this.scene.start('Menu') },
    ];
    const buttons = options.map((o, i) => button(this, WIDTH / 2, 300 + i * 52, 320, 40, o.label, o.action, 10));
    let idx = 0;
    const refresh = () => buttons.forEach((b, i) => b.setSelected(i === idx));
    buttons.forEach((b, i) => b.container.on('pointerover', () => ((idx = i), refresh())));
    refresh();
    const kb = this.input.keyboard!;
    kb.removeAllListeners();
    kb.on('keydown-UP', () => ((idx = (idx + 2) % 3), refresh()));
    kb.on('keydown-DOWN', () => ((idx = (idx + 1) % 3), refresh()));
    kb.on('keydown-ENTER', () => options[idx].action());
    kb.on('keydown-ESC', () => this.scene.start('Menu'));
  }

  // ---------- utilidades ----------

  private name(side: Side): string {
    return CHARACTERS[this.state.fighters[side].characterId].name;
  }

  private log(line: string) {
    this.logLines = [...this.logLines, line].slice(-3);
    this.logText.setText(this.logLines.join('\n'));
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => this.time.delayedCall(ms, resolve));
  }
}
