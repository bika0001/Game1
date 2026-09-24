import Phaser from 'phaser';
import { CSS, FONTS } from '../../config/theme';
import { t } from '../../i18n';
import { audio } from '../../services/audio';
import { app } from '../app';
import { drawSailboat } from '../objects/Sailboat';
import { Button } from '../ui/widgets';
import { devicePixelRatio, safeInsets } from '../viewport';
import { ensureTableImage } from './tableBackground';

/** Menu principal : continuer, nouvelle partie, réglages. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    this.build();
    const rebuild = (): void => {
      this.tweens.killAll();
      this.children.removeAll(true);
      this.build();
    };
    this.scale.on('resize', rebuild);
    // Les écouteurs de `this.events` survivent au redémarrage de la scène : on les retire.
    this.events.on(Phaser.Scenes.Events.RESUME, rebuild);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', rebuild);
      this.events.off(Phaser.Scenes.Events.RESUME, rebuild);
    });
    this.input.on('pointerdown', () => audio.unlock());
  }

  private build(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const dpr = devicePixelRatio();
    const u = dpr;
    const safe = safeInsets(dpr);
    ensureTableImage(this);

    const wide = W > H * 1.15;
    const leftCx = wide ? W * 0.3 : W / 2;
    const rightCx = wide ? W * 0.7 : W / 2;
    const usableH = H - safe.top - safe.bottom;
    const boatSize = Math.min(wide ? usableH * 0.42 : usableH * 0.26, wide ? W * 0.3 : W * 0.62);

    // Boutons (calculés d'abord : en portrait, le logo se centre dans l'espace au-dessus).
    const bw = Math.min(W * (wide ? 0.38 : 0.84), 360 * u);
    const bh = 60 * u;
    const gap = 16 * u;
    const buttonCount = app.hasResumableGame() ? 3 : 2;
    const blockH = buttonCount * bh + (buttonCount - 1) * gap;
    const buttonsTop = wide
      ? safe.top + (usableH - blockH) / 2
      : H - safe.bottom - blockH - Math.max(48 * u, usableH * 0.08);

    // Logo : voilier qui tangue doucement, titre et devise.
    const titleSize = Math.round(Math.min(44 * u, W * 0.1));
    const logoH = boatSize * 1.05 + 18 * u + titleSize * 1.25 + 30 * u;
    const logoTop = wide
      ? safe.top + (usableH - logoH) / 2
      : safe.top + Math.max(12 * u, (buttonsTop - safe.top - logoH) / 2);
    const boatY = logoTop + boatSize * 0.5;
    const boat = this.add.graphics();
    drawSailboat(boat, boatSize);
    boat.setPosition(leftCx, boatY);
    if (!app.settings.reducedMotion) {
      this.tweens.add({
        targets: boat,
        angle: { from: -2.5, to: 2.5 },
        y: boatY + 3 * u,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    const title = this.add
      .text(leftCx, boatY + boatSize * 0.5 + 18 * u, t('app.title'), {
        fontFamily: FONTS.title,
        fontSize: `${titleSize}px`,
        fontStyle: 'bold',
        color: CSS.sand,
      })
      .setOrigin(0.5, 0);
    this.add
      .text(leftCx, title.y + title.height + 6 * u, t('app.tagline'), {
        fontFamily: FONTS.title,
        fontStyle: 'italic',
        fontSize: `${Math.round(17 * u)}px`,
        color: CSS.foam,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.85);

    const specs: Array<{
      label: string;
      style: 'primary' | 'secondary';
      icon: 'play' | 'new' | 'settings';
      onClick: () => void;
    }> = [];
    if (app.hasResumableGame()) {
      specs.push({
        label: t('menu.continue'),
        style: 'primary',
        icon: 'play',
        onClick: () => this.play('continue'),
      });
      specs.push({
        label: t('menu.newGame'),
        style: 'secondary',
        icon: 'new',
        onClick: () => this.play('new'),
      });
    } else {
      specs.push({
        label: t('menu.play'),
        style: 'primary',
        icon: 'play',
        onClick: () => this.play('new'),
      });
    }
    specs.push({
      label: t('menu.settings'),
      style: 'secondary',
      icon: 'settings',
      onClick: () => this.openSettings(),
    });
    let y = buttonsTop;
    for (const spec of specs) {
      new Button(this, rightCx, y + bh / 2, { width: bw, height: bh, unit: u, ...spec });
      y += bh + gap;
    }
    this.add
      .text(rightCx, y + 4 * u, t('menu.variant', { draw: app.settings.drawCount }), {
        fontFamily: FONTS.ui,
        fontSize: `${Math.round(15 * u)}px`,
        color: CSS.sand,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.9);
  }

  private play(mode: 'continue' | 'new'): void {
    audio.unlock();
    if (mode === 'new' && app.hasResumableGame()) {
      const session = app.resumeSession();
      if (session) app.trackAbandon(session);
    }
    this.scene.start('Game', { mode });
  }

  private openSettings(): void {
    this.scene.launch('Settings', { from: 'Menu' });
    this.scene.pause();
  }
}
