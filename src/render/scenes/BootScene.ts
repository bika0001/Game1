import Phaser from 'phaser';
import { bankKey, loadBank } from '../../core/deals';
import { app } from '../app';

/** Chargement de la sauvegarde, puis menu principal. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    void this.boot();
  }

  private async boot(): Promise<void> {
    await app.load();
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
