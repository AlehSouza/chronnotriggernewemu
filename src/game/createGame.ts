import * as Phaser from 'phaser';
import { ArenaScene } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { SelectScene } from './scenes/SelectScene';
import { SkillsScene } from './scenes/SkillsScene';
import { COLORS, HEIGHT, WIDTH } from './ui';

export async function createGame(parent: HTMLElement): Promise<Phaser.Game> {
  // Espera a fonte pixelada (se a rede permitir) para o texto não nascer com a fonte errada.
  try {
    await Promise.race([document.fonts.load('12px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))]);
  } catch {
    /* sem fonte, usa monospace */
  }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WIDTH,
    height: HEIGHT,
    backgroundColor: COLORS.bg,
    pixelArt: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, MenuScene, SelectScene, SkillsScene, ArenaScene],
  });
}
