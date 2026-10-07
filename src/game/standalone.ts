// Entrada sem Next.js: usada para gerar uma página única de teste (npm run build:standalone).
import { createGame } from './createGame';

createGame(document.getElementById('game')!);
