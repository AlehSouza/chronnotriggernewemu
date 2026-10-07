import Phaser from 'phaser';
import { ACTION_LABEL, ACTION_ORDER, CHARACTERS, ELEMENT_LABEL, ROSTER } from '../../shared/characters';
import type { CharacterId } from '../../shared/types';
import { spriteKey } from '../sprites';
import type { DuelData, SelectData } from '../types';
import { bar, COLORS, fit, HEIGHT, panel, text, timeBackground, WIDTH } from '../ui';

const CELL = 84;
const GAP = 10;
const GRID_Y = 455;

interface PlayerSlot {
  index: number;
  locked: boolean;
  color: number;
  cursor: Phaser.GameObjects.Graphics;
  preview: Preview;
}

interface Preview {
  update(id: CharacterId, locked: boolean, pulse?: boolean): void;
}

export class SelectScene extends Phaser.Scene {
  private mode: SelectData['mode'] = 'cpu';
  private players: PlayerSlot[] = [];
  private starting = false;

  constructor() {
    super('Select');
  }

  init(data: SelectData) {
    this.mode = data.mode ?? 'cpu';
    this.players = [];
    this.starting = false;
  }

  create() {
    timeBackground(this);
    text(this, WIDTH / 2, 34, 'ESCOLHA SEU LUTADOR', 20, COLORS.gold).setOrigin(0.5).setStroke('#000', 6);
    text(this, WIDTH / 2, 64, this.mode === 'cpu' ? 'VOCÊ  vs  CPU' : 'JOGADOR 1  vs  JOGADOR 2', 10, '#8fa8ff').setOrigin(0.5);

    const totalW = ROSTER.length * CELL + (ROSTER.length - 1) * GAP;
    const startX = WIDTH / 2 - totalW / 2 + CELL / 2;
    ROSTER.forEach((id, i) => {
      const x = startX + i * (CELL + GAP);
      panel(this, x - CELL / 2, GRID_Y - CELL / 2, CELL, CELL);
      const img = fit(this.add.image(x, GRID_Y, spriteKey(this, id, 'portrait')), CELL - 8, CELL - 8);
      img.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.pointerPick(i));
    });

    const p1Index = 0;
    const p2Index = ROSTER.length - 1;
    this.players = [
      this.makePlayer(p1Index, COLORS.p1, 'left', this.mode === 'cpu' ? 'VOCÊ' : 'P1'),
      this.makePlayer(p2Index, COLORS.p2, 'right', this.mode === 'cpu' ? 'CPU' : 'P2'),
    ];
    this.players.forEach((_, i) => this.refresh(i));

    const kb = this.input.keyboard!;
    kb.on('keydown-A', () => this.move(0, -1));
    kb.on('keydown-D', () => this.move(0, 1));
    kb.on('keydown-F', () => this.lock(0));
    kb.on('keydown-SPACE', () => this.lock(0));
    const arrowsPlayer = this.mode === 'cpu' ? 0 : 1;
    kb.on('keydown-LEFT', () => this.move(arrowsPlayer, -1));
    kb.on('keydown-RIGHT', () => this.move(arrowsPlayer, 1));
    kb.on('keydown-ENTER', () => this.lock(arrowsPlayer));
    kb.on('keydown-ESC', () => this.back());

    const help =
      this.mode === 'cpu'
        ? 'Setas ou A/D: mover · Enter: confirmar · Esc: voltar'
        : 'P1: A/D + F    ·    P2: Setas + Enter    ·    Esc: voltar';
    text(this, WIDTH / 2, HEIGHT - 18, help, 8, COLORS.muted).setOrigin(0.5);
  }

  private makePlayer(index: number, color: number, side: 'left' | 'right', tag: string): PlayerSlot {
    const cursor = this.add.graphics();
    return { index, locked: false, color, cursor, preview: this.makePreview(side, tag, color) };
  }

  private makePreview(side: 'left' | 'right', tag: string, color: number): Preview {
    const x = side === 'left' ? 24 : WIDTH - 24 - 300;
    const y = 90;
    panel(this, x, y, 300, 300);
    const colorHex = `#${color.toString(16).padStart(6, '0')}`;
    text(this, x + 14, y + 14, tag, 10, colorHex);
    const sprite = this.add.image(side === 'left' ? x + 70 : x + 230, y + 120, spriteKey(this, 'crono', 'battle'));
    const name = text(this, x + 14, y + 210, '', 16, COLORS.gold);
    const title = text(this, x + 14, y + 234, '', 8, COLORS.muted);
    const info = text(this, side === 'left' ? x + 130 : x + 14, y + 40, '', 8, COLORS.text, { wordWrap: { width: 156 } });

    const barsX = x + 14;
    const barsY = y + 254;
    const hpBar = bar(this, barsX + 40, barsY, 90, 5, COLORS.hp);
    const atkBar = bar(this, barsX + 40, barsY + 10, 90, 5, 0xff8a4a);
    const magBar = bar(this, barsX + 190, barsY, 90, 5, 0xc06aff);
    const defBar = bar(this, barsX + 190, barsY + 10, 90, 5, 0x9ab0c8);
    text(this, barsX, barsY - 2, 'HP', 6, COLORS.muted);
    text(this, barsX, barsY + 8, 'ATQ', 6, COLORS.muted);
    text(this, barsX + 150, barsY - 2, 'MAG', 6, COLORS.muted);
    text(this, barsX + 150, barsY + 8, 'DEF', 6, COLORS.muted);

    return {
      update: (id, locked, pulse = false) => {
        const c = CHARACTERS[id];
        sprite.setTexture(spriteKey(this, id, 'battle')).setFlipX(side === 'right');
        fit(sprite, 112, 168);
        name.setText(c.name.toUpperCase());
        title.setText(`${c.title} · ${c.era}`);
        info.setText(
          `${ELEMENT_LABEL[c.element]}\n\n` + ACTION_ORDER.map((a) => `${ACTION_LABEL[a]}:\n ${c.abilities[a].name}`).join('\n'),
        );
        hpBar(c.stats.maxHp / 420);
        atkBar(c.stats.atk / 28);
        magBar(c.stats.mag / 28);
        defBar(c.stats.def / 26);
        sprite.setTint(locked ? 0xffffff : 0xb8b8c8);
        if (pulse) {
          this.tweens.add({ targets: sprite, scale: sprite.scale * 1.1, duration: 120, yoyo: true });
        }
      },
    };
  }

  private cellX(index: number): number {
    const totalW = ROSTER.length * CELL + (ROSTER.length - 1) * GAP;
    return WIDTH / 2 - totalW / 2 + CELL / 2 + index * (CELL + GAP);
  }

  private refresh(p: number, pulse = false) {
    const player = this.players[p];
    const other = this.players[1 - p];
    const inset = other && other.index === player.index ? (p === 0 ? -4 : 4) : 0;
    const g = player.cursor;
    g.clear();
    g.lineStyle(player.locked ? 5 : 3, player.color, 1);
    const x = this.cellX(player.index) - CELL / 2 - 4 + inset;
    g.strokeRect(x, GRID_Y - CELL / 2 - 4 + inset, CELL + 8, CELL + 8);
    player.preview.update(ROSTER[player.index], player.locked, pulse);
  }

  private move(p: number, dir: number) {
    const player = this.players[p];
    if (!player || player.locked || this.starting) return;
    if (p === 1 && this.mode === 'cpu') return;
    player.index = (player.index + dir + ROSTER.length) % ROSTER.length;
    this.refresh(p);
    this.refresh(1 - p);
  }

  private pointerPick(index: number) {
    const p = this.players.findIndex((pl, i) => !pl.locked && !(i === 1 && this.mode === 'cpu'));
    if (p < 0) return;
    this.players[p].index = index;
    this.refresh(p);
    this.lock(p);
  }

  private lock(p: number) {
    const player = this.players[p];
    if (!player || player.locked || this.starting) return;
    player.locked = true;
    this.refresh(p, true);
    this.cameras.main.flash(120, 255, 255, 255);

    if (this.mode === 'cpu' && p === 0) this.cpuPick();
    this.tryStart();
  }

  private cpuPick() {
    const cpu = this.players[1];
    const final = Phaser.Math.Between(0, ROSTER.length - 1);
    let steps = 12;
    this.time.addEvent({
      delay: 90,
      repeat: steps - 1,
      callback: () => {
        steps -= 1;
        cpu.index = steps === 0 ? final : Phaser.Math.Between(0, ROSTER.length - 1);
        this.refresh(1);
        this.refresh(0);
        if (steps === 0) {
          cpu.locked = true;
          this.refresh(1, true);
          this.tryStart();
        }
      },
    });
  }

  private tryStart() {
    if (!this.players.every((p) => p.locked) || this.starting) return;
    this.starting = true;
    const fight = text(this, WIDTH / 2, 250, 'LUTEM!', 48, '#ff5a5a').setOrigin(0.5).setStroke('#000', 8).setScale(0);
    this.tweens.add({ targets: fight, scale: 1, duration: 300, ease: 'Back.out' });
    this.time.delayedCall(1100, () => {
      const data: DuelData = { mode: this.mode, p1: ROSTER[this.players[0].index], p2: ROSTER[this.players[1].index] };
      this.scene.start('Duel', data);
    });
  }

  private back() {
    if (this.starting) return;
    const lockedIdx = [1, 0].find((i) => this.players[i].locked && !(i === 1 && this.mode === 'cpu'));
    if (lockedIdx !== undefined) {
      this.players[lockedIdx].locked = false;
      this.refresh(lockedIdx);
    } else {
      this.scene.start('Menu');
    }
  }
}
