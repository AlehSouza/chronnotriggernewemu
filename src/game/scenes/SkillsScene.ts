import Phaser from 'phaser';
import { ACTION_LABEL, ACTION_ORDER, CHARACTERS, ELEMENT_LABEL, ROSTER } from '../../shared/characters';
import type { Ability } from '../../shared/types';
import { spriteKey } from '../sprites';
import { button, COLORS, fit, HEIGHT, panel, text, timeBackground, WIDTH, type Button } from '../ui';

const ACTION_COLOR = { attack: '#ffffff', parry: '#8fe0ff', skill: '#c08aff', ultimate: '#f5d04a' } as const;

export function abilityCostLine(a: Ability): string {
  const parts: string[] = [];
  if (a.power > 0) parts.push(`Poder ${a.power}${a.hits ? ` (${a.hits} golpes)` : ''}`);
  if (a.power > 0) parts.push(a.scaling === 'atk' ? 'usa ATQ' : 'usa MAG');
  if (a.kind !== 'parry') parts.push(ELEMENT_LABEL[a.element]);
  if (a.mpCost) parts.push(`${a.mpCost} MP`);
  if (a.kind === 'ultimate') parts.push('barra cheia');
  if (a.kind === 'parry') parts.push('recarga 1 turno');
  return parts.join(' · ');
}

export class SkillsScene extends Phaser.Scene {
  private selected = 0;
  private buttons: Button[] = [];
  private detail!: Phaser.GameObjects.Container;

  constructor() {
    super('Skills');
  }

  create() {
    timeBackground(this);
    text(this, WIDTH / 2, 28, 'HABILIDADES', 20, COLORS.gold).setOrigin(0.5).setStroke('#000', 6);

    this.buttons = ROSTER.map((id, i) =>
      button(this, 110, 90 + i * 52, 180, 40, CHARACTERS[id].name.toUpperCase(), () => this.show(i), 11),
    );
    this.buttons.forEach((b, i) => b.container.on('pointerover', () => this.show(i)));

    this.detail = this.add.container(0, 0);
    this.show(0);

    const kb = this.input.keyboard!;
    const move = (d: number) => this.show((this.selected + d + ROSTER.length) % ROSTER.length);
    kb.on('keydown-UP', () => move(-1));
    kb.on('keydown-W', () => move(-1));
    kb.on('keydown-DOWN', () => move(1));
    kb.on('keydown-S', () => move(1));
    kb.on('keydown-ESC', () => this.scene.start('Menu'));
    kb.on('keydown-BACKSPACE', () => this.scene.start('Menu'));

    button(this, 110, HEIGHT - 40, 180, 36, 'VOLTAR', () => this.scene.start('Menu'), 10);
  }

  private show(i: number) {
    this.selected = i;
    this.buttons.forEach((b, j) => b.setSelected(j === i));
    this.detail.removeAll(true);

    const c = CHARACTERS[ROSTER[i]];
    const x = 220;
    const y = 64;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.detail.add(o);
      return o;
    };

    add(panel(this, x, y, 716, 450));
    add(fit(this.add.image(x + 70, y + 90, spriteKey(this, c.id, 'battle')), 96, 144));
    add(text(this, x + 140, y + 22, c.name.toUpperCase(), 18, COLORS.gold));
    add(text(this, x + 140, y + 50, `${c.title} · ${c.era} · ${ELEMENT_LABEL[c.element]}`, 8, '#8fa8ff'));
    add(text(this, x + 140, y + 72, c.bio, 8, COLORS.text, { wordWrap: { width: 550 } }));
    const s = c.stats;
    add(text(this, x + 140, y + 120, `HP ${s.maxHp}   MP ${s.maxMp}   ATQ ${s.atk}   MAG ${s.mag}   DEF ${s.def}`, 9, COLORS.text));

    ACTION_ORDER.forEach((kind, k) => {
      const a = c.abilities[kind];
      const cy = y + 170 + k * 68;
      const keyHint = `[${k + 1}]`;
      add(text(this, x + 20, cy, `${keyHint} ${ACTION_LABEL[kind].toUpperCase()}`, 9, ACTION_COLOR[kind]));
      add(text(this, x + 200, cy, a.name, 11, COLORS.gold));
      add(text(this, x + 200, cy + 18, abilityCostLine(a), 7, COLORS.muted));
      add(text(this, x + 200, cy + 32, a.description, 7, COLORS.text, { wordWrap: { width: 490 } }));
    });
  }
}
