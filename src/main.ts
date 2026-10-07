import Phaser from 'phaser';
import { BootScene } from './game/scenes/BootScene';
import { DuelScene } from './game/scenes/DuelScene';
import { MenuScene } from './game/scenes/MenuScene';
import { SelectScene } from './game/scenes/SelectScene';
import { SkillsScene } from './game/scenes/SkillsScene';
import { COLORS, HEIGHT, WIDTH } from './game/ui';

async function start() {
  // Espera a fonte pixelada (se a rede permitir) para o texto não nascer com a fonte errada.
  try {
    await Promise.race([document.fonts.load('12px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* sem fonte, usa monospace */
  }
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'app',
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.bg,
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, SelectScene, SkillsScene, DuelScene],
  });
}

start();
