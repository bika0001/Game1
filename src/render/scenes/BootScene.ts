import Phaser from 'phaser';
import { bankKey, loadBank } from '../../core/deals';
import { app } from '../app';

/** Attend la police des titres (les textes Phaser sont dessinés une fois pour toutes). */
async function loadFonts(): Promise<void> {
  const fonts = globalThis.document?.fonts;
  if (!fonts) return;
  const wanted = ['500 20px Fredoka', '600 20px Fredoka', '700 20px Fredoka'];
  try {
    await Promise.race([
      Promise.all(wanted.map((f) => fonts.load(f))),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Police de secours du système.
  }
}

/** Chargement de la sauvegarde et de la police, puis menu principal. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    await Promise.all([app.load(), loadFonts()]);
    // Préchauffe la banque de donnes des réglages actuels (morceau chargé à part).
    void loadBank(bankKey(app.settings.drawCount, app.settings.limitedPasses));
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => splash.remove(), 350);
    }
    this.scene.start('Menu');
  }
}
