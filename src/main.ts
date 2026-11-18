import { App } from '@client/App';

function main(): void {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  new App(canvas).showMenu();
}

try {
  main();
} catch (err) {
  console.error('Falha ao iniciar o jogo:', err);
}
