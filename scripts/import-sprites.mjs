// Converte os GIFs de public/assets/Party/<Nome>/ em spritesheets que o Phaser lê.
//
//   npm run sprites
//
// Cada animação do jogo aponta para um GIF (animado ou parado) ou para uma lista de GIFs
// parados que viram os quadros em sequência. Os quadros de uma animação são colados num
// mesmo tamanho, com o pé do personagem no centro e na base do quadro, para nada "pular"
// quando a animação troca. Saída: public/sprites/<id>/<anim>.png + src/game/sprites.generated.json.
//
// Os sprites dessa pasta são de lado olhando para a esquerda, em escala 2x.

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SRC = 'public/assets/Party';
const OUT = 'public/sprites';
const MANIFEST = 'src/game/sprites.generated.json';
/** Os GIFs têm o dobro do tamanho original do SNES. */
const SCALE = 0.5;

const seq = (name, n, view = 'Left') => Array.from({ length: n }, (_, i) => `${name}${i + 1} (${view})`);
/** Parado/andando nas três vistas a partir dos nomes base. */
const views = (idle, walk) => ({
  idle: `${idle} (Left)`,
  idle_down: `${idle} (Front)`,
  idle_up: `${idle} (Back)`,
  walk: `${walk} (Left)`,
  walk_down: `${walk} (Front)`,
  walk_up: `${walk} (Back)`,
});

// Arquivo sem ".gif" e sem o prefixo "<Nome> - ". Use "=" para o arquivo "<Nome> (Left).gif".
// { files, fps } fixa a velocidade (quadros por segundo).
const MAP = {
  crono: {
    dir: 'Crono',
    anims: {
      ...views('Battle', 'Walk'),
      attack: { files: seq('Ready', 3), fps: 10 },
      cast: 'Spell (Left)',
      hurt: 'Hit (Left)',
      parry: 'Ready1 (Left)',
      ko: 'Dead',
      victory: 'Victory',
    },
  },
  marle: {
    dir: 'Marle',
    anims: {
      ...views('=', 'Walk'),
      // Não tem "Walk (Left)": anda de lado com a pose parada.
      walk: '= (Left)',
      attack: { files: seq('Ready', 4), fps: 12 },
      cast: 'Spell (Left)',
      hurt: 'Hit (Left)',
      parry: 'Outstretched (Left)',
      ko: 'Dead',
      victory: 'Victory',
    },
  },
  lucca: {
    dir: 'Lucca',
    anims: {
      ...views('=', 'Walk'),
      attack: { files: seq('Ready', 3), fps: 10 },
      cast: 'Arms Up (Front)',
      hurt: 'Hit (Left)',
      parry: 'Mallet (Left)',
      ko: 'Dead',
      victory: 'Victory',
    },
  },
  frog: {
    dir: 'Frog',
    anims: {
      ...views('=', 'Walk'),
      attack: { files: seq('Ready', 3), fps: 10 },
      cast: 'Spell (Left)',
      hurt: 'Hit (Left)',
      parry: 'Ready1 (Left)',
      ko: 'Dead (Left)',
      victory: 'Victory',
    },
  },
  robo: {
    dir: 'Robo',
    anims: {
      ...views('=', 'Walk'),
      attack: { files: seq('Attack', 5), fps: 14 },
      cast: 'Arms Up (Front)',
      hurt: 'Hit (Left)',
      parry: 'Defend (Left)',
      ko: 'Dead',
      victory: { files: ['Victory1 (Left)', 'Victory2 (Left)'], fps: 4 },
    },
  },
  ayla: {
    dir: 'Ayla',
    anims: {
      ...views('Battle', 'Walk'),
      attack: 'Attack (Left)',
      cast: 'Spell (Left)',
      hurt: 'Hit (Left)',
      parry: 'Defend (Left)',
      ko: 'Dead',
      victory: 'Victory',
    },
  },
  magus: {
    dir: 'Magus',
    anims: {
      ...views('=', 'Walk'),
      attack: { files: seq('Ready', 4), fps: 12 },
      cast: 'Summon',
      hurt: 'Hit (Left)',
      parry: 'Cloak (Left)',
      ko: 'Dead',
      victory: 'Laugh (Left)',
    },
  },
};

const fileFor = (dir, name) =>
  join(SRC, dir, name.startsWith('=') ? `${dir}${name.slice(1)}.gif` : `${dir} - ${name}.gif`);

/** Lê todos os quadros RGBA de um GIF. */
async function readGif(path) {
  const meta = await sharp(path, { animated: true, failOn: 'none' }).metadata();
  const pages = meta.pages ?? 1;
  const w = meta.width;
  const h = meta.pageHeight ?? meta.height;
  const frames = [];
  for (let i = 0; i < pages; i++) {
    frames.push(await sharp(path, { page: i, failOn: 'none' }).ensureAlpha().raw().toBuffer());
  }
  const delays = (meta.delay ?? []).filter((d) => d > 0);
  return { w, h, frames, delays };
}

/** Centro do pé (média x dos pixels nas linhas de baixo) e a última linha com pixel. */
function footOf({ w, h, frames }) {
  const px = frames[0];
  const alpha = (x, y) => px[(y * w + x) * 4 + 3] > 0;
  let bottom = h - 1;
  while (bottom > 0 && ![...Array(w).keys()].some((x) => alpha(x, bottom))) bottom--;
  let sum = 0;
  let n = 0;
  for (let y = Math.max(0, bottom - 5); y <= bottom; y++) {
    for (let x = 0; x < w; x++) if (alpha(x, y)) (sum += x), n++;
  }
  return { fx: n ? Math.round(sum / n) : Math.round(w / 2), bottom };
}

async function buildAnim(dir, spec, outFile) {
  const list = typeof spec === 'string' ? [spec] : spec.files;
  const sources = [];
  for (const name of list) {
    const path = fileFor(dir, name);
    if (!existsSync(path)) throw new Error(`não achei ${path}`);
    const gif = await readGif(path);
    sources.push({ ...gif, ...footOf(gif), name });
  }
  // Quadro comum: largura simétrica em volta do pé, altura até o pé.
  const half = Math.max(...sources.map((s) => Math.max(s.fx, s.w - s.fx)));
  const fw = half * 2;
  const fh = Math.max(...sources.map((s) => s.bottom + 1));
  const frames = sources.flatMap((s) => s.frames.map((buf) => ({ s, buf })));

  const comps = frames.map(({ s, buf }, i) => ({
    input: buf,
    raw: { width: s.w, height: s.h, channels: 4 },
    left: half - s.fx,
    top: i * fh + fh - 1 - s.bottom,
  }));
  await sharp({ create: { width: fw, height: fh * frames.length, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comps)
    .png()
    .toFile(outFile);

  const delays = sources.flatMap((s) => s.delays);
  const avg = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 200;
  const fps = typeof spec === 'string' ? Math.max(1, Math.round(1000 / avg)) : spec.fps;
  return { frameWidth: fw, frameHeight: fh, frames: frames.length, fps, from: list };
}

rmSync(OUT, { recursive: true, force: true });
const manifest = {};
for (const [id, { dir, anims }] of Object.entries(MAP)) {
  if (!existsSync(join(SRC, dir))) continue;
  mkdirSync(join(OUT, id), { recursive: true });
  const entry = { facesLeft: true, scale: SCALE, anims: {} };
  for (const [anim, spec] of Object.entries(anims)) {
    try {
      const { from, ...info } = await buildAnim(dir, spec, join(OUT, id, `${anim}.png`));
      entry.anims[anim] = { file: `sprites/${id}/${anim}.png`, ...info };
      console.log(`${id}.${anim} <- ${from.join(', ')} (${info.frames} quadros ${info.frameWidth}x${info.frameHeight})`);
    } catch (e) {
      console.warn(`${id}.${anim}: ${e.message} (fica o boneco)`);
    }
  }
  const status = fileFor(dir, 'Status');
  if (existsSync(status)) {
    await sharp(status, { failOn: 'none' }).png().toFile(join(OUT, id, 'portrait.png'));
    entry.portrait = `sprites/${id}/portrait.png`;
  }
  manifest[id] = entry;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${Object.keys(manifest).length} personagem(ns) em ${MANIFEST}`);
