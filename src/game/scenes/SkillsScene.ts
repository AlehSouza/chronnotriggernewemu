import * as Phaser from 'phaser';
import { CHARACTERS, ELEMENT_LABEL, KIND_LABEL, ROSTER, SLOT_LABEL, SLOT_ORDER } from '../../shared/characters';
import type { Ability } from '../../shared/types';
import { animKey, spriteScale, standingTexture } from '../sprites';
import { button, COLORS, HEIGHT, panel, text, timeBackground, WIDTH, type Button } from '../ui';

const SLOT_COLOR = { attack: '#ffffff', parry: '#8fe0ff', skill: '#c08aff', ultimate: '#f5d04a' } as const;
export const P1_KEYS = 'YUIO';

export function abilityInfoLine(a: Ability): string {
  const parts: string[] = [KIND_LABEL[a.kind]];
  if (a.power > 0) parts.push(`Poder ${a.power}${a.hits ? ` (${a.hits} golpes)` : ''}`);
  if (a.power > 0) parts.push(a.scaling === 'atk' ? 'ATQ' : 'MAG');
  if (a.kind !== 'parry' && a.kind !== 'buff') parts.push(ELEMENT_LABEL[a.element]);
  if (a.mpCost) parts.push(`${a.mpCost} MP`);
  if (a.cooldown) parts.push(`recarga ${a.cooldown}s`);
  if (a.slot === 'ultimate') parts.push('barra cheia');
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
    text(this, WIDTH / 2, 24, 'COMO JOGAR', 18, COLORS.gold).setOrigin(0.5).setStroke('#000', 6);

    this.buttons = ROSTER.map((id, i) =>
      button(this, 110, 82 + i * 50, 180, 40, CHARACTERS[id].name.toUpperCase(), () => this.show(i), 11),
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

    button(this, 110, HEIGHT - 34, 180, 36, 'VOLTAR', () => this.scene.start('Menu'), 10);
  }

  private show(i: number) {
    this.selected = i;
    this.buttons.forEach((b, j) => b.setSelected(j === i));
    this.detail.removeAll(true);

    const c = CHARACTERS[ROSTER[i]];
    const x = 220;
    const y = 50;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.detail.add(o);
      return o;
    };

    add(panel(this, x, y, 716, 476));
    const first = standingTexture(this, c.id);
    add(this.add.sprite(x + 66, y + 84, first.key, first.frame).play(animKey(c.id, 'idle')).setScale(4 * spriteScale(this, c.id)));
    add(text(this, x + 140, y + 18, c.name.toUpperCase(), 16, COLORS.gold));
    add(text(this, x + 140, y + 42, `${c.title} · ${c.era} · ${ELEMENT_LABEL[c.element]}`, 8, '#8fa8ff'));
    add(text(this, x + 140, y + 62, c.bio, 8, COLORS.text, { wordWrap: { width: 550 } }));
    const s = c.stats;
    add(text(this, x + 140, y + 104, `HP ${s.maxHp}  MP ${s.maxMp}  ATQ ${s.atk}  MAG ${s.mag}  DEF ${s.def}  VEL ${s.speed}`, 8, COLORS.text));
    add(text(this, x + 140, y + 124, 'Mover: WASD · Dash: Espaço (atravessa golpes no começo)', 7, COLORS.muted));

    SLOT_ORDER.forEach((slot, k) => {
      const a = c.abilities[slot];
      const cy = y + 156 + k * 76;
      add(text(this, x + 20, cy, `[${P1_KEYS[k]}] ${SLOT_LABEL[slot].toUpperCase()}`, 9, SLOT_COLOR[slot]));
      add(text(this, x + 200, cy, a.name, 11, COLORS.gold));
      add(text(this, x + 200, cy + 18, abilityInfoLine(a), 7, COLORS.muted));
      add(text(this, x + 200, cy + 32, a.description, 7, COLORS.text, { wordWrap: { width: 490 } }));
    });
  }
}
