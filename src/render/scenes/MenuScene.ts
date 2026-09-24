import Phaser from 'phaser';
import { CSS, FONTS } from '../../config/theme';
import { t } from '../../i18n';
import { audio } from '../../services/audio';
import { app } from '../app';
import { SeascapeDecor } from '../decor/decors';
import { prewarmGame } from '../gameSetup';
import { drawSailboat } from '../objects/Sailboat';
import { Button, type ButtonStyle } from '../ui/widgets';
import { devicePixelRatio, safeInsets } from '../viewport';
import type { IconName } from '../ui/icons';

/** Menu principal : marine animée, voilier qui tangue, titre qui ondule, boutons. */
export class MenuScene extends Phaser.Scene {
  private decor: SeascapeDecor | null = null;
  private leaving = false;

  constructor() {
    super('Menu');
  }

  create(): void {
    this.leaving = false;
    this.decor = new SeascapeDecor(this);
    this.build(true);
    const rebuild = (): void => {
      this.tweens.killAll();
      this.decor?.destroy();
      this.children.removeAll(true);
      this.build(false);
    };
    this.scale.on('resize', rebuild);
    // Les écouteurs de `this.events` survivent au redémarrage de la scène : on les retire.
    this.events.on(Phaser.Scenes.Events.RESUME, rebuild);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', rebuild);
      this.events.off(Phaser.Scenes.Events.RESUME, rebuild);
      this.decor?.destroy();
      this.decor = null;
    });
    this.input.on('pointerdown', () => audio.unlock());
    this.cameras.main.fadeIn(360, 6, 32, 43);
    // Pendant que le joueur regarde le menu, on prépare la table de jeu.
    this.time.delayedCall(1300, () => prewarmGame(this));
  }

  private build(entrance: boolean): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const dpr = devicePixelRatio();
    const u = dpr;
    const safe = safeInsets(dpr);
    const calm = app.settings.reducedMotion;
    const wide = W > H * 1.15;
    const horizon = Math.round(H * (wide ? 0.64 : 0.47));
    this.decor?.build({ width: W, height: H, dpr, floorBottom: H, horizon });
    this.decor?.setQuality(calm ? 0 : 2);

    const leftCx = wide ? W * 0.3 : W / 2;
    const rightCx = wide ? W * 0.72 : W / 2;
    const usableH = H - safe.top - safe.bottom;

    // --- Titre : lettres qui arrivent en rebondissant puis ondulent comme la mer.
    const titleSize = Math.round(Math.min(wide ? W * 0.075 : W * 0.15, 76 * u));
    const titleTop = safe.top + (wide ? usableH * 0.1 : Math.max(24 * u, usableH * 0.06));
    const line1 = this.waveText(
      t('app.title').split(' ')[0] ?? '',
      leftCx,
      titleTop + titleSize * 0.55,
      titleSize * 0.72,
      CSS.foam,
      0,
      entrance,
      calm,
    );
    const rest = t('app.title').split(' ').slice(1).join(' ');
    const line2Y = titleTop + titleSize * 0.55 + titleSize * 0.95;
    this.waveText(rest, leftCx, line2Y, titleSize, CSS.gold, line1, entrance, calm);
    const tagline = this.add
      .text(leftCx, line2Y + titleSize * 0.72, t('app.tagline'), {
        fontFamily: FONTS.display,
        fontStyle: '500',
        fontSize: `${Math.round(Math.min(19 * u, W * 0.045))}px`,
        color: CSS.navy,
        align: 'center',
        wordWrap: { width: (wide ? W * 0.5 : W) - 40 * u },
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.tweens.add({ targets: tagline, alpha: 0.9, duration: 600, delay: entrance ? 700 : 0 });

    // --- Voilier posé sur la mer, qui tangue.
    const boatSize = Math.min(wide ? H * 0.3 : H * 0.2, wide ? W * 0.2 : W * 0.44);
    const boat = this.add.graphics();
    drawSailboat(boat, boatSize, false);
    const boatY = wide ? horizon + (H - horizon) * 0.3 : horizon + boatSize * 0.12;
    boat.setPosition(leftCx, boatY).setDepth(-80);
    const drift = (): void => {
      if (calm) return;
      this.tweens.add({
        targets: boat,
        x: leftCx + W * 0.03,
        duration: 5200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    };
    if (!calm) {
      this.tweens.add({
        targets: boat,
        angle: { from: -3.5, to: 3.5 },
        duration: 2300,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: boat,
        y: boatY + 6 * u,
        duration: 1700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    if (entrance && !calm) {
      // Le voilier entre par la gauche, puis dérive doucement.
      boat.x -= W * 0.6;
      this.tweens.add({
        targets: boat,
        x: leftCx,
        duration: 1400,
        ease: 'Cubic.easeOut',
        onComplete: drift,
      });
    } else {
      drift();
    }

    // --- Boutons.
    const bw = Math.min(W * (wide ? 0.4 : 0.84), 380 * u);
    const bh = 64 * u;
    const gap = 16 * u;
    const specs: Array<{ label: string; style: ButtonStyle; icon: IconName; onClick: () => void }> =
      [];
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
    const blockH = specs.length * bh + (specs.length - 1) * gap + 34 * u;
    const buttonsTop = wide
      ? Math.max(safe.top + 12 * u, safe.top + (usableH - blockH) / 2)
      : H - safe.bottom - blockH - Math.max(28 * u, usableH * 0.05);
    let y = buttonsTop;
    specs.forEach((spec, i) => {
      const button = new Button(this, rightCx, y + bh / 2, {
        width: bw,
        height: bh,
        unit: u,
        ...spec,
      });
      if (entrance) {
        button.setAlpha(0);
        this.tweens.add({
          targets: button,
          alpha: 1,
          y: { from: button.y + 40 * u, to: button.y },
          duration: 520,
          delay: 450 + i * 110,
          ease: 'Back.easeOut',
        });
      }
      y += bh + gap;
    });
    const variant = this.add
      .text(rightCx, y + 2 * u, t('menu.variant', { draw: app.settings.drawCount }), {
        fontFamily: FONTS.display,
        fontStyle: '500',
        fontSize: `${Math.round(17 * u)}px`,
        color: CSS.foam,
        stroke: CSS.deep,
        strokeThickness: 3 * u,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);
    this.tweens.add({ targets: variant, alpha: 0.95, duration: 500, delay: entrance ? 900 : 0 });
  }

  /**
   * Mot du titre, lettre par lettre : arrivée en rebond puis ondulation continue.
   * Renvoie le nombre de lettres (pour enchaîner le mot suivant).
   */
  private waveText(
    word: string,
    cx: number,
    cy: number,
    size: number,
    color: string,
    startIndex: number,
    entrance: boolean,
    calm: boolean,
  ): number {
    const u = devicePixelRatio();
    const style = {
      fontFamily: FONTS.display,
      fontStyle: '700',
      fontSize: `${Math.round(size)}px`,
      color,
      stroke: CSS.deep,
      strokeThickness: Math.max(3, size * 0.12),
    };
    const letters = [...word].map((ch) => this.add.text(0, 0, ch, style).setOrigin(0.5, 0.5));
    const widths = letters.map((l) => l.width - style.strokeThickness * 0.9);
    const total = widths.reduce((a, b) => a + b, 0);
    let x = cx - total / 2;
    letters.forEach((letter, i) => {
      const w = widths[i] as number;
      const lx = x + w / 2;
      x += w;
      const index = startIndex + i;
      letter.setPosition(lx, cy);
      letter.setShadow(0, 4 * u, 'rgba(6, 32, 43, 0.35)', 6 * u, true, true);
      const wave = (): void => {
        if (calm) return;
        this.tweens.add({
          targets: letter,
          y: cy - size * 0.09,
          angle: { from: -3, to: 3 },
          duration: 900,
          delay: index * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      };
      if (entrance && !calm) {
        letter.setY(cy - size * 3).setAlpha(0);
        this.tweens.add({
          targets: letter,
          y: cy,
          alpha: 1,
          duration: 800,
          delay: 120 + index * 55,
          ease: 'Bounce.easeOut',
          onComplete: wave,
        });
      } else {
        wave();
      }
    });
    return startIndex + letters.length;
  }

  private play(mode: 'continue' | 'new'): void {
    if (this.leaving) return;
    this.leaving = true;
    audio.unlock();
    if (mode === 'new' && app.hasResumableGame()) {
      const session = app.resumeSession();
      if (session) app.trackAbandon(session);
    }
    audio.play('whoosh', { pitch: 0.9 });
    this.cameras.main.fadeOut(260, 6, 32, 43);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () =>
      this.scene.start('Game', { mode }),
    );
  }

  private openSettings(): void {
    this.scene.launch('Settings', { from: 'Menu' });
    this.scene.pause();
  }

  override update(time: number, delta: number): void {
    this.decor?.update(time, delta);
  }
}
