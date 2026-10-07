import Phaser from 'phaser';
import { CHARACTERS, ROSTER } from '../shared/characters';
import type { CharacterId } from '../shared/types';

/**
 * Sprites reais (opcionais). Coloque os arquivos em public/assets/characters/<id>/
 * e registre aqui. Enquanto um personagem não tiver arquivo, o jogo usa um boneco
 * gerado por código com as cores dele.
 *
 * Exemplo:
 *   crono: { portrait: 'assets/characters/crono/portrait.png', battle: 'assets/characters/crono/battle.png' },
 */
export const SPRITE_MANIFEST: Partial<Record<CharacterId, { portrait?: string; battle?: string }>> = {};

export type SpriteKind = 'portrait' | 'battle';

const realKey = (id: CharacterId, kind: SpriteKind) => `real-${kind}-${id}`;
const placeholderKey = (id: CharacterId, kind: SpriteKind) => `ph-${kind}-${id}`;

export function preloadRealSprites(loader: Phaser.Loader.LoaderPlugin): void {
  for (const id of ROSTER) {
    const entry = SPRITE_MANIFEST[id];
    if (entry?.portrait) loader.image(realKey(id, 'portrait'), entry.portrait);
    if (entry?.battle) loader.image(realKey(id, 'battle'), entry.battle);
  }
}

export function spriteKey(scene: Phaser.Scene, id: CharacterId, kind: SpriteKind): string {
  const real = realKey(id, kind);
  return scene.textures.exists(real) ? real : placeholderKey(id, kind);
}

/** Desenha um boneco pixelado 16x24 por personagem. Mostrado com escala inteira. */
export function generatePlaceholders(scene: Phaser.Scene): void {
  for (const id of ROSTER) {
    const { palette } = CHARACTERS[id];
    const g = scene.make.graphics({}, false);
    const px = (x: number, y: number, w: number, h: number, color: number) => {
      g.fillStyle(color, 1);
      g.fillRect(x, y, w, h);
    };
    const dark = Phaser.Display.Color.IntegerToColor(palette.outfit).darken(35).color;

    if (id === 'robo') {
      px(4, 2, 8, 7, palette.skin); // cabeça
      px(5, 4, 2, 2, palette.accent);
      px(9, 4, 2, 2, palette.accent);
      px(3, 9, 10, 8, palette.hair); // corpo
      px(1, 10, 2, 6, palette.outfit);
      px(13, 10, 2, 6, palette.outfit);
      px(4, 17, 3, 6, dark);
      px(9, 17, 3, 6, dark);
    } else {
      px(4, 3, 8, 7, palette.skin); // rosto
      px(3, 1, 10, 3, palette.hair); // cabelo
      px(3, 3, 2, 4, palette.hair);
      if (id === 'crono') px(5, 0, 7, 2, palette.hair);
      if (id === 'magus') px(2, 3, 2, 9, palette.hair);
      px(6, 6, 1, 1, 0x1a1a2a); // olhos
      px(9, 6, 1, 1, 0x1a1a2a);
      px(4, 10, 8, 7, palette.outfit); // tronco
      px(2, 11, 2, 5, palette.skin); // braços
      px(12, 11, 2, 5, palette.skin);
      px(4, 16, 8, 1, palette.accent); // cinto
      px(5, 17, 2, 6, dark); // pernas
      px(9, 17, 2, 6, dark);
      if (id === 'magus') px(1, 9, 3, 14, palette.accent); // capa
    }
    px(14, 4, 1, 13, palette.accent); // arma / detalhe
    g.generateTexture(placeholderKey(id, 'battle'), 16, 24);

    // Retrato: fundo com a cor do elemento e o boneco centralizado.
    g.clear();
    g.fillStyle(dark, 1);
    g.fillRect(0, 0, 32, 32);
    g.fillStyle(palette.outfit, 0.5);
    g.fillRect(0, 20, 32, 12);
    g.generateTexture(`${placeholderKey(id, 'portrait')}-bg`, 32, 32);
    g.destroy();

    const rt = scene.make.renderTexture({ x: 0, y: 0, width: 32, height: 32 }, false);
    rt.draw(`${placeholderKey(id, 'portrait')}-bg`, 0, 0);
    rt.draw(placeholderKey(id, 'battle'), 8, 6);
    rt.saveTexture(placeholderKey(id, 'portrait'));
  }
}
