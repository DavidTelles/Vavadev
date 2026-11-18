import { Game } from '@client/player/Game';

async function main() {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const game = new Game(canvas);
  await game.init();
}

main().catch((err) => {
  console.error('Falha ao iniciar o jogo:', err);
});
