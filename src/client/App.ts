import { Engine } from '@client/core/Engine';
import { MenuScene } from '@client/menu/MenuScene';
import { MainMenu, type PlayRequest } from '@client/ui/MainMenu';
import { Game, type GameResult } from '@client/player/Game';
import { profile } from '@client/Profile';

/**
 * Top-level screen flow: main menu -> match -> back to the menu.
 * One Engine (one WebGL context) is shared by the menu scene and the match.
 */
export class App {
  private readonly engine: Engine;
  private readonly uiRoot: HTMLElement;
  private menuScene: MenuScene | null = null;
  private menu: MainMenu | null = null;
  private game: Game | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.engine = new Engine(canvas);
    this.uiRoot = document.getElementById('ui-root')!;
  }

  showMenu(): void {
    this.menuScene = new MenuScene(this.engine.renderer);
    this.menu = new MainMenu(this.uiRoot, this.menuScene, (r) => void this.play(r));
    this.menuScene.start();
  }

  private async play(req: PlayRequest): Promise<void> {
    // Pointer lock needs the click's user activation, so ask for it right away.
    try {
      const p = this.engine.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => undefined);
    } catch {
      /* the in-match pause screen offers another click to lock */
    }
    const game = new Game(this.engine, { ...req, settings: { ...profile.data.settings } }, (res) => this.endGame(req, res));
    try {
      await game.init();
    } catch (err) {
      console.error('Falha ao iniciar a partida:', err);
      game.dispose();
      this.menu?.setLoading(false);
      return;
    }
    this.menu?.dispose();
    this.menuScene?.dispose();
    this.menu = null;
    this.menuScene = null;
    this.game = game;
  }

  private endGame(req: PlayRequest, res: GameResult | null): void {
    if (res) {
      profile.recordMatch({ date: Date.now(), mode: req.mode, characterId: req.characterId, ...res });
    }
    this.game?.dispose();
    this.game = null;
    this.showMenu();
  }
}
