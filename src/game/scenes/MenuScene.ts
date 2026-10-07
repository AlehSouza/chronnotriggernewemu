import Phaser from 'phaser';
import type { SelectData } from '../types';
import { button, HEIGHT, text, timeBackground, verticalMenu, WIDTH } from '../ui';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create() {
    timeBackground(this);
    const title = text(this, WIDTH / 2, 120, 'CHRONO DUEL', 44, '#f5d04a').setOrigin(0.5);
    title.setStroke('#7a2a10', 8).setShadow(4, 4, '#000', 0, true, true);
    this.tweens.add({ targets: title, y: 128, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    text(this, WIDTH / 2, 180, 'Duelos através do tempo', 12, '#8fa8ff').setOrigin(0.5);

    const go = (mode: SelectData['mode']) => this.scene.start('Select', { mode } satisfies SelectData);
    const items = [
      { label: 'JOGAR VS CPU', action: () => go('cpu') },
      { label: '2 JOGADORES (LOCAL)', action: () => go('local') },
      { label: 'ONLINE (EM BREVE)', action: () => {}, enabled: false },
      { label: 'HABILIDADES', action: () => this.scene.start('Skills') },
    ];
    verticalMenu(
      this,
      items.map((item, i) => ({
        button: button(this, WIDTH / 2, 270 + i * 54, 360, 42, item.label, item.action),
        action: item.action,
        enabled: item.enabled,
      })),
    );

    text(this, WIDTH / 2, HEIGHT - 30, 'Setas/WS para navegar · Enter para confirmar', 8, '#8a90b8').setOrigin(0.5);
  }
}
