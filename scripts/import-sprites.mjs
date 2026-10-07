// Converte os GIFs animados de sprites-src/<personagem>/ em spritesheets PNG
// (public/sprites/<personagem>/<animação>.png) e gera src/game/sprites.generated.json,
// que o jogo lê para trocar o boneco provisório pelos sprites reais.
//
// Uso:
//   1. Baixe os GIFs de https://www.videogamesprites.net/ChronoTrigger/Party/<Nome>/
//      para sprites-src/crono/, sprites-src/marle/ etc. (nomes originais, ex.: "Crono - Victory.gif").
//   2. npm run sprites
//
// Cada animação do jogo é escolhida pelo nome do arquivo (palavras-chave abaixo).
// Para forçar um arquivo, crie sprites-src/<personagem>/map.json, ex.:
//   { "idle": "Crono - Battle Stance.gif", "facesLeft": true }

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const ROSTER = ['crono', 'marle', 'lucca', 'frog', 'robo', 'ayla', 'magus'];

// Cada entrada é uma lista de alternativas; cada alternativa é um conjunto de palavras
// que precisam aparecer todas no nome do arquivo. A primeira que bater ganha.
const KEYWORDS = {
  idle: [['battle stance'], ['stand', 'left'], ['stand', 'right'], ['battle'], ['idle'], ['stand']],
  idle_down: [['stand', 'down'], ['stand', 'front'], ['idle', 'down'], ['front']],
  idle_up: [['stand', 'up'], ['stand', 'back'], ['idle', 'up'], ['back']],
  walk: [['walk', 'left'], ['walk', 'right'], ['run', 'left'], ['run', 'right'], ['walk'], ['run']],
  walk_down: [['walk', 'down'], ['walk', 'front'], ['run', 'down']],
  walk_up: [['walk', 'up'], ['walk', 'back'], ['run', 'up']],
  attack: [['attack'], ['slash'], ['swing'], ['punch'], ['shoot'], ['strike']],
  cast: [['cast'], ['magic'], ['spell'], ['tech'], ['raise']],
  hurt: [['hurt'], ['damage'], ['hit'], ['ouch']],
  parry: [['block'], ['guard'], ['defend'], ['parry']],
  ko: [['dead'], ['ko'], ['faint'], ['down', 'battle']],
  victory: [['victory'], ['win'], ['celebrate']],
};

const SRC = 'sprites-src';
const OUT = 'public/sprites';
const MANIFEST = 'src/game/sprites.generated.json';

function pick(files, anim) {
  const lower = files.map((f) => f.toLowerCase());
  for (const words of KEYWORDS[anim]) {
    const i = lower.findIndex((f) => words.every((w) => f.includes(w)));
    if (i >= 0) return files[i];
  }
  return null;
}

async function convert(file, outFile) {
  const img = sharp(file, { animated: true });
  const meta = await img.metadata();
  const pages = meta.pages ?? 1;
  const frameHeight = meta.pageHeight ?? meta.height;
  const frameWidth = meta.width;
  // sharp empilha os quadros na vertical: o Phaser lê isso como spritesheet direto.
  await img.png().toFile(outFile);
  const delays = (meta.delay ?? []).filter((d) => d > 0);
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 125;
  return { frameWidth, frameHeight, frames: pages, fps: Math.max(1, Math.round(1000 / avg)) };
}

const manifest = {};
for (const id of ROSTER) {
  const dir = join(SRC, id);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter((f) => /\.(gif|png)$/i.test(f));
  const overrides = existsSync(join(dir, 'map.json')) ? JSON.parse(readFileSync(join(dir, 'map.json'), 'utf8')) : {};
  const entry = { facesLeft: overrides.facesLeft ?? false, anims: {} };
  mkdirSync(join(OUT, id), { recursive: true });

  for (const anim of Object.keys(KEYWORDS)) {
    const chosen = overrides[anim] ?? pick(files, anim);
    if (!chosen) continue;
    const info = await convert(join(dir, chosen), join(OUT, id, `${anim}.png`));
    entry.anims[anim] = { file: `sprites/${id}/${anim}.png`, ...info };
    console.log(`${id}.${anim} <- ${chosen} (${info.frames} quadros ${info.frameWidth}x${info.frameHeight})`);
  }
  if (Object.keys(entry.anims).length) manifest[id] = entry;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${Object.keys(manifest).length} personagem(ns) em ${MANIFEST}`);
