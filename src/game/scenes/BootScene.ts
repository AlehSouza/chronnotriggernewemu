import * as Phaser from 'phaser';
import { createCharacterAnims, preloadRealSprites } from '../sprites';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Um sprite faltando não pode travar o jogo: cai no boneco gerado.
    this.load.on('loaderror', (file: Phaser.Loader.File) => console.warn('Sprite não encontrado:', file.src));
    preloadRealSprites(this.load);
  }

  create() {
    createCharacterAnims(this);
    this.scene.start('Menu');
  }
}
