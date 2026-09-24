import Phaser from 'phaser';
import { CSS, FONTS, PALETTE } from '../../config/theme';
import type { Settings } from '../../core/settings';
import { LOCALES, LOCALE_NAMES, t } from '../../i18n';
import { app } from '../app';
import { Button, Segmented, type SegmentOption } from '../ui/widgets';
import { devicePixelRatio, safeInsets } from '../viewport';

/** Réglages : liste défilante de choix simples, lisibles et grands. */
export class SettingsScene extends Phaser.Scene {
  private from: 'Game' | 'Menu' = 'Menu';
  private content: Phaser.GameObjects.Container | null = null;
  private scroll = 0;
  private maxScroll = 0;
  private contentTop = 0;
  private dragStart: { y: number; scroll: number } | null = null;

  constructor() {
    super('Settings');
  }

  init(data: { from?: 'Game' | 'Menu' }): void {
    this.from = data.from ?? 'Menu';
    this.scroll = 0;
  }

  create(): void {
    this.build();
    const rebuild = (): void => this.rebuild();
    this.scale.on('resize', rebuild);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off('resize', rebuild));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragStart = { y: p.y, scroll: this.scroll };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.dragStart || !p.isDown) return;
      this.setScroll(this.dragStart.scroll + (p.y - this.dragStart.y));
    });
    this.input.on('pointerup', () => {
      this.dragStart = null;
    });
    this.input.on('wheel', (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.setScroll(this.scroll - dy);
    });
    this.input.keyboard?.on('keydown-ESC', () => this.close());
  }

  private rebuild(): void {
    this.children.removeAll(true);
    this.build();
  }

  private setScroll(value: number): void {
    this.scroll = Math.max(-this.maxScroll, Math.min(0, value));
    if (this.content) this.content.y = this.contentTop + this.scroll;
  }

  private build(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const dpr = devicePixelRatio();
    const u = dpr;
    const safe = safeInsets(dpr);
    const s = app.settings;

    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0e4a5a, 0x0e4a5a, 0x082632, 0x082632, 1, 1, 1, 1);
    bg.fillRect(0, 0, W, H);

    // En-tête fixe.
    const headerH = safe.top + 64 * u;
    this.contentTop = headerH + 12 * u;
    const width = Math.min(W - Math.max(safe.left, safe.right) * 2 - 36 * u, 520 * u);
    const x0 = (W - width) / 2;

    const content = this.add.container(x0, this.contentTop);
    this.content = content;
    let y = 0;
    const section = (title: string): void => {
      const text = this.add.text(0, y, title.toUpperCase(), {
        fontFamily: FONTS.display,
        fontSize: `${Math.round(15 * u)}px`,
        fontStyle: '600',
        color: CSS.gold,
      });
      text.setLetterSpacing(2 * u);
      content.add(text);
      y += text.height + 12 * u;
    };
    const choice = <K extends keyof Settings>(
      key: K,
      label: string,
      options: ReadonlyArray<SegmentOption<Settings[K]>>,
      hint?: string,
    ): void => {
      const control = new Segmented<Settings[K]>(this, 0, y, {
        label,
        hint,
        options,
        value: s[key],
        width,
        unit: u,
        onChange: (value) => {
          app.updateSettings({ [key]: value } as Partial<Settings>);
          if (key === 'locale') this.time.delayedCall(0, () => this.rebuild());
        },
      });
      content.add(control);
      y += control.totalHeight + 22 * u;
    };
    const onOff = (key: 'leftHanded' | 'sound' | 'haptics', label: string): void =>
      choice(key, label, [
        { value: true, label: t('settings.on') },
        { value: false, label: t('settings.off') },
      ]);

    section(t('settings.game'));
    choice('drawCount', t('settings.draw'), [
      { value: 1, label: t('settings.draw1') },
      { value: 3, label: t('settings.draw3') },
    ]);
    choice('winnableOnly', t('settings.deals'), [
      { value: true, label: t('settings.winnable') },
      { value: false, label: t('settings.random') },
    ]);
    choice(
      'limitedPasses',
      t('settings.passes'),
      [
        { value: false, label: t('settings.unlimited') },
        { value: true, label: t('settings.limited') },
      ],
      t('settings.limitedHint'),
    );
    choice('scoring', t('settings.scoring'), [
      { value: 'standard', label: t('settings.standard') },
      { value: 'none', label: t('settings.none') },
    ]);
    choice('showTimer', t('settings.timer'), [
      { value: true, label: t('settings.shown') },
      { value: false, label: t('settings.hidden') },
    ]);
    const note = this.add.text(0, y - 6 * u, t('settings.nextGame'), {
      fontFamily: FONTS.ui,
      fontSize: `${Math.round(14 * u)}px`,
      fontStyle: 'italic',
      color: CSS.sand,
      wordWrap: { width },
    });
    content.add(note);
    y += note.height + 26 * u;

    section(t('settings.display'));
    choice('decor', t('settings.decor'), [
      { value: 'lagoon', label: t('settings.lagoon') },
      { value: 'classic', label: t('settings.classic') },
    ]);
    choice('reducedMotion', t('settings.animations'), [
      { value: false, label: t('settings.normal') },
      { value: true, label: t('settings.reduced') },
    ]);
    onOff('leftHanded', t('settings.leftHanded'));
    y += 8 * u;

    section(t('settings.comfort'));
    onOff('sound', t('settings.sound'));
    onOff('haptics', t('settings.haptics'));
    choice(
      'locale',
      t('settings.language'),
      LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l] })),
    );
    y += 12 * u;

    const viewH = H - this.contentTop - safe.bottom;
    this.maxScroll = Math.max(0, y - viewH);
    const mask = this.make.graphics({}, false);
    mask.fillStyle(0xffffff, 1);
    mask.fillRect(0, headerH, W, H - headerH);
    content.setMask(mask.createGeometryMask());
    this.setScroll(this.scroll);

    // En-tête par-dessus le contenu (il bloque les taps sur le contenu masqué).
    const header = this.add.graphics();
    header.fillStyle(PALETTE.deep, 1);
    header.fillRect(0, 0, W, headerH);
    header.fillStyle(PALETTE.turquoise, 1);
    header.fillRect(0, headerH - 4 * u, W, 4 * u);
    // Petites crêtes de vagues sous l'en-tête.
    for (let x = 0; x < W + 12 * u; x += 16 * u) {
      header.fillCircle(x, headerH - 4 * u, 5 * u);
    }
    this.add.zone(0, 0, W, headerH).setOrigin(0, 0).setInteractive();
    this.add
      .text(W / 2, safe.top + 32 * u, t('settings.title'), {
        fontFamily: FONTS.display,
        fontSize: `${Math.round(26 * u)}px`,
        fontStyle: '700',
        color: CSS.foam,
      })
      .setOrigin(0.5, 0.5);
    new Button(this, Math.max(safe.left, 0) + 16 * u + 60 * u, safe.top + 32 * u, {
      width: 120 * u,
      height: 44 * u,
      label: t('settings.back'),
      icon: 'back',
      style: 'secondary',
      unit: u,
      onClick: () => this.close(),
    });
  }

  private close(): void {
    app.persistNow();
    this.scene.stop();
    this.scene.resume(this.from);
  }
}
