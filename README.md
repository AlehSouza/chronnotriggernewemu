# Chrono Duel

Duelo 1x1 **em tempo real** com os personagens jogáveis de Chrono Trigger (Crono, Marle, Lucca, Frog, Robo,
Ayla e Magus), numa arena vista de cima em 3/4, como os mapas do jogo original. Você anda livre pelo
cenário em 8 direções, desvia das habilidades e usa 4 ações: **Ataque**, **Parry**, **Habilidade** e **Ultimate**.

## Como rodar

```bash
npm install
npm run dev               # http://localhost:3000
npm test                  # testes da simulação
npm run build             # site estático em out/ (npm start serve essa pasta)
npm run build:standalone  # página única em standalone/, sem Next.js (para testes rápidos)
```

## Controles

| | Jogador 1 | Jogador 2 (mesmo teclado) |
| --- | --- | --- |
| Mover | W A S D | Setas |
| Ataque | Y | 7 ou Numpad 1 |
| Parry | U | 8 ou Numpad 2 |
| Habilidade | I | 9 ou Numpad 3 |
| Ultimate | O | 0 ou Numpad 4 |
| Dash | Espaço | Enter ou Numpad 0 |

A mira é automática no oponente: o desafio é se mover. Sair da linha de um projétil ou de uma área marcada
no chão é o jeito de desviar. O **dash** vai na direção que você está segurando (sem direção, recua), fica
invulnerável no começo, então dá para atravessar golpes, e tem recarga de 0,8s. Esc pausa.

## Regras

- **Ataque**: golpe ou disparo básico, sem custo.
- **Parry**: janela curta de defesa. Contra ataque normal devolve 60% do dano e atordoa; contra habilidade
  bloqueia tudo; projéteis voltam para quem atirou; ultimate só é bloqueada pela metade. Errar o tempo deixa
  você parado por um instante.
- **Habilidade**: gasta MP e tem recarga. Cada personagem tem a sua (giro, projétil, avanço, cura, área no alvo).
- **Ultimate**: precisa da barra ULT cheia. Ela enche com o tempo, causando e recebendo dano e acertando parry.
  Áreas marcadas no chão e anéis que crescem avisam onde o golpe vai cair: dá tempo de fugir.
- Partida de 99 segundos. Vence quem nocautear ou quem tiver mais HP (proporcional) no fim.

Todos os números ficam em `RULES` (`src/shared/sim.ts`) e nos personagens (`src/shared/characters.ts`).

## Stack

- **Next.js** (App Router, exportado como site estático) como casca da aplicação. A página monta o jogo só no
  navegador (`src/components/GameCanvas.tsx`).
- **Phaser 3** desenha e anima o jogo (`src/game/`): menu, seleção estilo Mortal Kombat, "Como jogar" e a arena.
- **`src/shared/` é lógica pura** (sem Phaser, React ou DOM): a simulação a 60 quadros/s, determinística, a IA da CPU e
  o contrato do socket.io (`protocol.ts`). O servidor online vai rodar essa mesma simulação como autoridade; os
  clientes só mandam entradas.

## Sprites

Hoje cada personagem é um boneco pixelado gerado por código. Para usar os sprites reais do
[videogamesprites.net](https://www.videogamesprites.net/ChronoTrigger/Party/):

1. Baixe os GIFs de cada personagem para `sprites-src/<id>/` (ex.: `sprites-src/crono/Crono - Victory.gif`).
2. Rode `npm run sprites`. O script converte cada GIF animado numa spritesheet em `public/sprites/<id>/`,
   escolhe a animação pelo nome do arquivo (parado e andando de lado, de frente e de costas, ataque, magia, dano,
   defesa, nocaute, vitória) e gera
   `src/game/sprites.generated.json`.
3. Se o nome não bater, crie `sprites-src/<id>/map.json`, por exemplo
   `{ "idle": "Crono - Battle.gif", "facesLeft": true }`.

Animação sem arquivo continua usando o boneco. Os sprites de Chrono Trigger pertencem à Square Enix; mantenha o
projeto como fã e sem fins comerciais.

## Próximos passos

- Importar os sprites reais.
- Servidor `server/` com Node + socket.io rodando `src/shared/sim.ts` e os eventos de `src/shared/protocol.ts`.
  Ele roda à parte do Next (hospedagem estática não mantém WebSocket).
