import Phaser from 'phaser';
import { app } from './render/app';
import { BootScene } from './render/scenes/BootScene';
import { GameScene } from './render/scenes/GameScene';
import { MenuScene } from './render/scenes/MenuScene';
import { SettingsScene } from './render/scenes/SettingsScene';
import { cssViewport, devicePixelRatio } from './render/viewport';

/**
 * Point d'entrée. Le canevas est en pixels physiques (net sur écrans haute
 * densité) et réduit par le zoom du ScaleManager ; chaque scène recalcule sa
 * mise en page à chaque redimensionnement (rotation comprise).
 */

const dpr = devicePixelRatio();
const { width, height } = cssViewport();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  backgroundColor: '#0E3B4A',
  banner: false,
  disableContextMenu: true,
  scale: {
    mode: Phaser.Scale.NONE,
    width: Math.round(width * dpr),
    height: Math.round(height * dpr),
    zoom: 1 / dpr,
  },
  render: {
    antialias: true,
    roundPixels: true,
    powerPreference: 'high-performance',
  },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene, SettingsScene],
});

let resizeTimer: ReturnType<typeof setTimeout> | undefined;
function onResize(): void {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const ratio = devicePixelRatio();
    const size = cssViewport();
    game.scale.zoom = 1 / ratio;
    game.scale.resize(Math.round(size.width * ratio), Math.round(size.height * ratio));
  }, 60);
}
window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', onResize);
window.visualViewport?.addEventListener('resize', onResize);

// Sauvegarde immédiate à la mise en arrière-plan (partie en cours, historique compris).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') app.flush();
});
window.addEventListener('pagehide', () => app.flush());

// Accès de débogage (tests automatisés, console).
(globalThis as unknown as { __game?: Phaser.Game }).__game = game;
