# Chrono Duel

Jogo de duelo 1x1 com os personagens jogáveis de Chrono Trigger (Crono, Marle, Lucca, Frog, Robo, Ayla e Magus).
Cada personagem tem 4 ações: **Ataque**, **Parry**, **Habilidade** e **Ultimate**.

## Como rodar

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes do motor de duelo
npm run build    # gera a versão estática em dist/
```

## Stack

- **TypeScript + Vite + Phaser 3.** Phaser cuida de sprites, animação, tweens, teclado/mouse e escala em pixel art;
  Vite dá recarga instantânea e build estático. TypeScript mantém o contrato entre cliente e servidor tipado.
- **`src/shared/` é lógica pura**, sem Phaser nem DOM: personagens, motor de duelo (`engine.ts`), IA e o contrato
  socket.io (`protocol.ts`). O servidor Node online vai importar esse mesmo código e ser a autoridade do duelo.
- **`src/game/`** é só apresentação: cenas do Phaser (menu, seleção, habilidades, duelo).

## Regras do duelo

Os dois jogadores escolhem a ação **ao mesmo tempo, em segredo**, e o turno é resolvido junto
(isso funciona igual no local e no online, sem vantagem de quem tem menos latência).

| Ação | Efeito |
| --- | --- |
| Ataque | Dano físico. 10% de chance de crítico. Sem custo. |
| Parry | Contra **ataque**: devolve 60% do dano. Contra **habilidade**: bloqueia tudo (inclusive efeitos). Contra **ultimate**: bloqueia metade. Não pode ser usado dois turnos seguidos. |
| Habilidade | Custa MP. Cada personagem tem a sua (dano, cura, queimadura, buff, debuff). |
| Ultimate | Precisa da barra TECH cheia. A barra enche a cada turno, ao causar/receber dano e ao acertar um parry. |

MP regenera 5 por turno. Todos os números ficam em `RULES` (`src/shared/engine.ts`) e nos personagens
(`src/shared/characters.ts`).

## Controles

- **Menu/Habilidades:** setas ou W/S, Enter, Esc para voltar.
- **Seleção:** vs CPU usa setas ou A/D + Enter. Em 2 jogadores, P1 usa A/D + F e P2 usa setas + Enter. Clique também funciona.
- **Duelo:** teclas 1 a 4 ou clique. No modo local, o P1 escolhe, a tela esconde a escolha e o P2 escolhe.

## Sprites

Por enquanto cada personagem é um boneco pixelado gerado por código com as cores dele.
Para usar sprites reais:

1. Coloque os arquivos em `public/assets/characters/<id>/` (ex.: `public/assets/characters/crono/battle.png`).
2. Registre em `SPRITE_MANIFEST` (`src/game/sprites.ts`). O que não estiver registrado continua usando o boneco.

Fontes de referência: https://www.videogamesprites.net/ChronoTrigger/ . Os sprites de Chrono Trigger pertencem à
Square Enix; mantenha o uso como projeto de fã não comercial.

## Próximos passos

- Sprites reais e animações por ação (ataque, dano, parry, vitória).
- Servidor `server/` com Node + socket.io usando `src/shared/engine.ts` e os eventos de `src/shared/protocol.ts`.
- Mais personagens e balanceamento.
