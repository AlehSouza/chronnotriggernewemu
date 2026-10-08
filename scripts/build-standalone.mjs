// Gera standalone/index.html + game.js: o jogo inteiro numa página estática, sem Next.js.
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';

mkdirSync('standalone', { recursive: true });
await build({
  entryPoints: ['src/game/standalone.ts'],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  outfile: 'standalone/game.js',
  define: { 'process.env.NODE_ENV': '"production"' },
});
writeFileSync(
  'standalone/index.html',
  `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Chrono Duel</title>
<link rel="icon" href="data:," />
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet" />
<style>html,body{margin:0;height:100%;background:#05060f;overflow:hidden}#game{width:100vw;height:100vh}canvas{image-rendering:pixelated}</style>
</head>
<body><div id="game"></div><script type="module" src="game.js"></script></body>
</html>
`,
);
if (existsSync('public/sprites')) cpSync('public/sprites', 'standalone/sprites', { recursive: true });
console.log('standalone/ pronto');
