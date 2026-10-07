'use client';

import { useEffect, useRef } from 'react';

/** Monta o jogo Phaser só no navegador (Phaser não roda no servidor do Next). */
export default function GameCanvas() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let destroyed = false;
    let game: { destroy(removeCanvas: boolean): void } | undefined;
    import('@/game/createGame').then(async ({ createGame }) => {
      const g = await createGame(ref.current!);
      if (destroyed) g.destroy(true);
      else game = g;
    });
    return () => {
      destroyed = true;
      game?.destroy(true);
    };
  }, []);

  return <div id="game" ref={ref} />;
}
