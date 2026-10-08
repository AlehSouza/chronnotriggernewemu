import * as Phaser from 'phaser';
import { CHARACTERS, ROSTER } from '../shared/characters';
import type { CharacterId } from '../shared/types';
import { SPRITE_MANIFEST, type AnimName } from './spriteManifest';

export type { AnimName };

export const ANIMS: AnimName[] = [
  'idle',
  'idle_down',
  'idle_up',
  'walk',
  'walk_down',
  'walk_up',
  'attack',
  'cast',
  'hurt',
  'parry',
  'ko',
  'victory',
];

const LOOPING = new Set<AnimName>(['idle', 'idle_down', 'idle_up', 'walk', 'walk_down', 'walk_up', 'victory']);

/** Se faltar a versão de frente/costas real, usa a de lado real antes de cair no boneco. */
const REAL_FALLBACK: Partial<Record<AnimName, AnimName>> = {
  idle_down: 'idle',
  idle_up: 'idle',
  walk_down: 'walk',
  walk_up: 'walk',
};

/** Quadros do boneco gerado por código, por animação. */
const PLACEHOLDER_FRAMES: Record<AnimName, Pose[]> = {
  idle: ['idle', 'idle2'],
  idle_down: ['front', 'front2'],
  idle_up: ['back'],
  walk: ['walk1', 'idle', 'walk2', 'idle'],
  walk_down: ['front_w1', 'front', 'front_w2', 'front'],
  walk_up: ['back_w1', 'back', 'back_w2', 'back'],
  attack: ['attack'],
  cast: ['cast'],
  hurt: ['hurt'],
  parry: ['parry'],
  ko: ['ko'],
  victory: ['cast', 'idle'],
};

type SidePose = 'idle' | 'idle2' | 'walk1' | 'walk2' | 'attack' | 'cast' | 'hurt' | 'parry' | 'ko';
type FacePose = 'front' | 'front2' | 'front_w1' | 'front_w2' | 'back' | 'back_w1' | 'back_w2';
type Pose = SidePose | FacePose;
const SIDE_POSES: SidePose[] = ['idle', 'idle2', 'walk1', 'walk2', 'attack', 'cast', 'hurt', 'parry', 'ko'];
const FACE_POSES: FacePose[] = ['front', 'front2', 'front_w1', 'front_w2', 'back', 'back_w1', 'back_w2'];

const realSheetKey = (id: CharacterId, anim: AnimName) => `real-${id}-${anim}`;
const poseKey = (id: CharacterId, pose: Pose) => `ph-${id}-${pose}`;
export const animKey = (id: CharacterId, anim: AnimName) => `${id}-${anim}`;
export const portraitKey = (id: CharacterId) => `portrait-${id}`;

/** O sprite real desse personagem olha para a esquerda? (o boneco provisório olha para a direita) */
export function facesLeft(scene: Phaser.Scene, id: CharacterId): boolean {
  return !!SPRITE_MANIFEST[id]?.facesLeft && scene.textures.exists(realSheetKey(id, 'idle'));
}

/** Escala do sprite real em relação ao boneco provisório. */
export function spriteScale(scene: Phaser.Scene, id: CharacterId): number {
  return scene.textures.exists(realSheetKey(id, 'idle')) ? (SPRITE_MANIFEST[id]?.scale ?? 1) : 1;
}

export function preloadRealSprites(loader: Phaser.Loader.LoaderPlugin): void {
  for (const id of ROSTER) {
    const entry = SPRITE_MANIFEST[id];
    if (!entry) continue;
    for (const [anim, sheet] of Object.entries(entry.anims)) {
      loader.spritesheet(realSheetKey(id, anim as AnimName), sheet.file, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    if (entry.portrait) loader.image(`real-portrait-${id}`, entry.portrait);
  }
}

/**
 * Cria as animações de todos os personagens. Se houver spritesheet real para
 * uma animação, usa ela; se não, usa o boneco gerado por código.
 */
export function createCharacterAnims(scene: Phaser.Scene): void {
  for (const id of ROSTER) {
    drawPlaceholderPoses(scene, id);
    for (const anim of ANIMS) {
      const key = animKey(id, anim);
      if (scene.anims.exists(key)) continue;
      const repeat = LOOPING.has(anim) ? -1 : 0;
      const fallback = REAL_FALLBACK[anim];
      const source = scene.textures.exists(realSheetKey(id, anim))
        ? anim
        : fallback && scene.textures.exists(realSheetKey(id, fallback))
          ? fallback
          : null;
      const sheet = source ? SPRITE_MANIFEST[id]?.anims[source] : undefined;
      if (source && sheet) {
        scene.anims.create({
          key,
          frames: scene.anims.generateFrameNumbers(realSheetKey(id, source), {}),
          frameRate: sheet.fps ?? 8,
          repeat,
        });
      } else {
        scene.anims.create({
          key,
          frames: PLACEHOLDER_FRAMES[anim].map((p) => ({ key: poseKey(id, p) })),
          frameRate: anim.startsWith('walk') ? 8 : 3,
          repeat,
        });
      }
    }
    const realPortrait = `real-portrait-${id}`;
    if (scene.textures.exists(realPortrait)) {
      scene.textures.renameTexture(realPortrait, portraitKey(id));
    } else if (!scene.textures.exists(portraitKey(id))) {
      drawPortrait(scene, id);
    }
  }
}

/** Textura parada para menus (primeiro quadro do idle). */
export function standingTexture(scene: Phaser.Scene, id: CharacterId): { key: string; frame?: number } {
  const real = realSheetKey(id, 'idle');
  return scene.textures.exists(real) ? { key: real, frame: 0 } : { key: poseKey(id, 'idle') };
}

function drawPlaceholderPoses(scene: Phaser.Scene, id: CharacterId) {
  const { palette } = CHARACTERS[id];
  const dark = Phaser.Display.Color.IntegerToColor(palette.outfit).darken(35).color;
  const robo = id === 'robo';
  const body = robo ? palette.hair : palette.outfit;
  const limbs = robo ? palette.outfit : palette.skin;

  drawFacePoses(scene, id);
  for (const pose of SIDE_POSES) {
    const key = poseKey(id, pose);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    const px = (x: number, y: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillRect(x, y, w, h);
    };
    // Tela de 24x28: o personagem tem 16 de largura, sobra espaço para braço e arma.
    const ox = 4;
    const bob = pose === 'idle2' ? 1 : 0;

    if (pose === 'ko') {
      px(2, 22, 18, 5, body);
      px(18, 21, 6, 6, robo ? palette.skin : palette.skin);
      px(19, 20, 5, 2, palette.hair);
      px(0, 24, 3, 3, dark);
      g.generateTexture(key, 24, 28);
      g.destroy();
      continue;
    }

    const lean = pose === 'hurt' ? -2 : pose === 'attack' ? 2 : 0;
    const top = 4 + bob;
    // Cabeça
    if (robo) {
      px(ox + 4 + lean, top + 1, 8, 7, palette.skin);
      px(ox + 5 + lean, top + 3, 2, 2, palette.accent);
      px(ox + 9 + lean, top + 3, 2, 2, palette.accent);
    } else {
      px(ox + 4 + lean, top + 2, 8, 7, palette.skin);
      px(ox + 3 + lean, top, 10, 3, palette.hair);
      px(ox + 3 + lean, top + 2, 2, 4, palette.hair);
      if (id === 'crono') px(ox + 5 + lean, top - 2, 7, 2, palette.hair);
      if (id === 'magus') px(ox + 2 + lean, top + 2, 2, 9, palette.hair);
      if (id === 'ayla') px(ox + 11 + lean, top + 2, 2, 7, palette.hair);
      const eye = pose === 'hurt' ? 0xffffff : 0x1a1a2a;
      px(ox + 9 + lean, top + 5, 1, 1, eye);
      px(ox + 11 + lean, top + 5, 1, 1, eye);
    }
    // Tronco
    px(ox + 4 + lean / 2, top + 9, 8, 7, body);
    px(ox + 4 + lean / 2, top + 15, 8, 1, palette.accent);
    if (id === 'magus') px(ox + 1, top + 8, 3, 14, palette.accent);

    // Pernas
    const legY = top + 16;
    const legH = 23 - bob - legY + 4;
    if (pose === 'walk1') {
      px(ox + 3, legY, 3, legH, dark);
      px(ox + 10, legY, 3, legH - 2, dark);
    } else if (pose === 'walk2') {
      px(ox + 5, legY, 3, legH - 2, dark);
      px(ox + 8, legY, 3, legH, dark);
    } else {
      px(ox + 5, legY, 2, legH, dark);
      px(ox + 9, legY, 2, legH, dark);
    }

    // Braços e arma
    if (pose === 'attack') {
      px(ox + 12, top + 10, 6, 2, limbs);
      px(ox + 17, top + 4, 2, 12, palette.accent);
    } else if (pose === 'cast') {
      px(ox + 2, top + 2, 2, 7, limbs);
      px(ox + 12, top + 2, 2, 7, limbs);
      px(ox + 11, top - 1, 4, 3, palette.accent);
    } else if (pose === 'parry') {
      px(ox + 12, top + 8, 4, 2, limbs);
      px(ox + 15, top + 2, 2, 16, 0x8fe0ff);
    } else {
      px(ox + 2 + lean / 2, top + 10, 2, 5, limbs);
      px(ox + 12 + lean / 2, top + 10, 2, 5, limbs);
      px(ox + 14 + lean / 2, top + 5, 1, 12, palette.accent);
    }
    g.generateTexture(key, 24, 28);
    g.destroy();
  }
}

/** Poses de frente (descendo a tela) e de costas (subindo), como os sprites de mapa de Chrono Trigger. */
function drawFacePoses(scene: Phaser.Scene, id: CharacterId) {
  const { palette } = CHARACTERS[id];
  const dark = Phaser.Display.Color.IntegerToColor(palette.outfit).darken(35).color;
  const robo = id === 'robo';
  const body = robo ? palette.hair : palette.outfit;
  const limbs = robo ? palette.outfit : palette.skin;

  for (const pose of FACE_POSES) {
    const key = poseKey(id, pose);
    if (scene.textures.exists(key)) continue;
    const g = scene.make.graphics({}, false);
    const px = (x: number, y: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      g.fillRect(x, y, w, h);
    };
    const back = pose.startsWith('back');
    const ox = 4;
    const top = 4 + (pose === 'front2' ? 1 : 0);

    // Capa do Magus fica atrás do corpo (de frente) ou cobre as costas.
    if (id === 'magus' && !back) px(ox + 2, top + 8, 12, 14, palette.accent);

    // Cabeça
    if (robo) {
      px(ox + 4, top + 1, 8, 7, palette.skin);
      if (!back) {
        px(ox + 5, top + 3, 2, 2, palette.accent);
        px(ox + 9, top + 3, 2, 2, palette.accent);
      }
    } else if (back) {
      px(ox + 3, top, 10, 9, palette.hair);
      if (id === 'crono') px(ox + 4, top - 2, 8, 2, palette.hair);
      if (id === 'magus' || id === 'ayla') px(ox + 4, top + 8, 8, 3, palette.hair);
    } else {
      px(ox + 4, top + 2, 8, 7, palette.skin);
      px(ox + 3, top, 10, 3, palette.hair);
      px(ox + 3, top + 2, 1, 5, palette.hair);
      px(ox + 12, top + 2, 1, 5, palette.hair);
      if (id === 'crono') px(ox + 4, top - 2, 8, 2, palette.hair);
      px(ox + 6, top + 5, 1, 1, 0x1a1a2a);
      px(ox + 9, top + 5, 1, 1, 0x1a1a2a);
    }

    // Tronco e braços
    px(ox + 4, top + 9, 8, 7, body);
    px(ox + 4, top + 15, 8, 1, palette.accent);
    if (id === 'magus' && back) px(ox + 3, top + 9, 10, 13, palette.accent);
    const swing = pose.endsWith('w1') ? 1 : pose.endsWith('w2') ? -1 : 0;
    px(ox + 2, top + 10 + swing, 2, 5, limbs);
    px(ox + 12, top + 10 - swing, 2, 5, limbs);
    if (!back) px(ox + 13, top + 5, 1, 12, palette.accent);

    // Pernas: no passo, uma fica mais curta (levantada).
    const legY = top + 16;
    const legH = 24 - legY + 4 - (pose === 'front2' ? 1 : 0);
    px(ox + 5, legY, 2, swing === 1 ? legH - 2 : legH, dark);
    px(ox + 9, legY, 2, swing === -1 ? legH - 2 : legH, dark);

    g.generateTexture(key, 24, 28);
    g.destroy();
  }
}

function drawPortrait(scene: Phaser.Scene, id: CharacterId) {
  const { palette } = CHARACTERS[id];
  const dark = Phaser.Display.Color.IntegerToColor(palette.outfit).darken(35).color;
  const bgKey = `${portraitKey(id)}-bg`;
  const g = scene.make.graphics({}, false);
  g.fillStyle(dark, 1);
  g.fillRect(0, 0, 32, 32);
  g.fillStyle(palette.outfit, 0.5);
  g.fillRect(0, 20, 32, 12);
  g.generateTexture(bgKey, 32, 32);
  g.destroy();
  const rt = scene.make.renderTexture({ x: 0, y: 0, width: 32, height: 32 }, false);
  rt.draw(bgKey, 0, 0);
  rt.draw(poseKey(id, 'idle'), 4, 4);
  rt.saveTexture(portraitKey(id));
}
