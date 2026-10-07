import * as Phaser from 'phaser';

export const WIDTH = 960;
export const HEIGHT = 540;

export const FONT = '"Press Start 2P", monospace';

export const COLORS = {
  bg: 0x05060f,
  panel: 0x10163a,
  panelBorder: 0x8fa8ff,
  text: '#f2f4ff',
  muted: '#8a90b8',
  gold: '#f5d04a',
  p1: 0x4aa3ff,
  p2: 0xff5a5a,
  hp: 0x4ade6a,
  mp: 0x4aa3ff,
  gauge: 0xf5d04a,
};

export function text(
  scene: Phaser.Scene,
  x: number,
  y: number,
  value: string,
  size = 12,
  color = COLORS.text,
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  return scene.add.text(x, y, value, { fontFamily: FONT, fontSize: `${size}px`, color, lineSpacing: 6, ...style });
}

/** Painel no estilo das janelas azuis de Chrono Trigger. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillGradientStyle(0x1c2a78, 0x1c2a78, 0x0a0f30, 0x0a0f30, 0.95);
  g.fillRect(x, y, w, h);
  g.lineStyle(2, COLORS.panelBorder, 1);
  g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.lineStyle(1, 0x3a4a9a, 1);
  g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  return g;
}

export interface Button {
  container: Phaser.GameObjects.Container;
  setSelected(on: boolean): void;
  setEnabled(on: boolean): void;
  setLabel(label: string): void;
}

export function button(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
  size = 12,
): Button {
  const bg = scene.add.graphics();
  const t = text(scene, 0, 0, label, size).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, t]);
  let selected = false;
  let enabled = true;

  const draw = () => {
    bg.clear();
    bg.fillStyle(selected ? 0x2c3fa8 : 0x141c4a, enabled ? 1 : 0.5);
    bg.fillRect(-w / 2, -h / 2, w, h);
    bg.lineStyle(2, selected ? 0xf5d04a : 0x5a6ab8, enabled ? 1 : 0.4);
    bg.strokeRect(-w / 2, -h / 2, w, h);
    t.setColor(enabled ? (selected ? COLORS.gold : COLORS.text) : COLORS.muted);
  };
  draw();

  container.setSize(w, h).setInteractive({ useHandCursor: true });
  container.on('pointerover', () => scene.events.emit('button-hover', container));
  container.on('pointerdown', () => enabled && onClick());

  return {
    container,
    setSelected(on) {
      selected = on;
      draw();
    },
    setEnabled(on) {
      enabled = on;
      draw();
    },
    setLabel(label) {
      t.setText(label);
    },
  };
}

/** Menu vertical navegável por teclado (setas/WS + Enter/Espaço) e mouse. */
export function verticalMenu(scene: Phaser.Scene, buttons: Array<{ button: Button; action: () => void; enabled?: boolean }>) {
  let index = buttons.findIndex((b) => b.enabled !== false);
  const refresh = () => buttons.forEach((b, i) => b.button.setSelected(i === index));
  const move = (dir: number) => {
    for (let n = 0; n < buttons.length; n++) {
      index = (index + dir + buttons.length) % buttons.length;
      if (buttons[index].enabled !== false) break;
    }
    refresh();
  };
  buttons.forEach((b, i) => {
    b.button.setEnabled(b.enabled !== false);
    b.button.container.on('pointerover', () => {
      if (b.enabled !== false) {
        index = i;
        refresh();
      }
    });
  });
  refresh();
  const kb = scene.input.keyboard!;
  kb.on('keydown-UP', () => move(-1));
  kb.on('keydown-W', () => move(-1));
  kb.on('keydown-DOWN', () => move(1));
  kb.on('keydown-S', () => move(1));
  const confirm = () => buttons[index]?.action();
  kb.on('keydown-ENTER', confirm);
  kb.on('keydown-SPACE', confirm);
}

export function bar(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  depth = 0,
): (ratio: number, animate?: boolean) => void {
  const bg = scene.add.graphics().setDepth(depth);
  bg.fillStyle(0x000000, 0.7);
  bg.fillRect(x - 1, y - 1, w + 2, h + 2);
  const fill = scene.add.rectangle(x, y, w, h, color).setOrigin(0, 0).setDepth(depth + 2);
  return (ratio, animate = true) => {
    const target = Math.max(0, Math.min(1, ratio)) * w;
    if (animate) scene.tweens.add({ targets: fill, width: target, duration: 300 });
    else fill.width = target;
  };
}

/** Escala uma imagem para caber numa caixa, mantendo pixels inteiros quando possível. */
export function fit<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(img: T, maxW: number, maxH: number): T {
  const scale = Math.min(maxW / img.width, maxH / img.height);
  img.setScale(scale >= 1 ? Math.floor(scale) : scale);
  return img;
}

/** Fundo animado com estrelas e um portal do tempo. */
export function timeBackground(scene: Phaser.Scene): void {
  scene.add.rectangle(0, 0, WIDTH, HEIGHT, COLORS.bg).setOrigin(0);
  for (let i = 0; i < 80; i++) {
    const star = scene.add.rectangle(
      Phaser.Math.Between(0, WIDTH),
      Phaser.Math.Between(0, HEIGHT),
      2,
      2,
      0xffffff,
      Phaser.Math.FloatBetween(0.2, 0.9),
    );
    scene.tweens.add({
      targets: star,
      alpha: 0.1,
      duration: Phaser.Math.Between(800, 2500),
      yoyo: true,
      repeat: -1,
    });
  }
  const gate = scene.add.graphics({ x: WIDTH / 2, y: HEIGHT / 2 });
  for (let r = 260; r > 40; r -= 36) {
    gate.lineStyle(2, 0x3a5aff, 0.12 + (260 - r) / 900);
    gate.strokeEllipse(0, 0, r * 2, r * 1.2);
  }
  scene.tweens.add({ targets: gate, angle: 360, duration: 60000, repeat: -1 });
}
