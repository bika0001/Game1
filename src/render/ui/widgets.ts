import Phaser from 'phaser';
import { CSS, FONTS, PALETTE } from '../../config/theme';
import { audio } from '../../services/audio';
import { FX } from '../decor/fxTextures';
import { drawIcon, type IconName } from './icons';

/**
 * Petit kit d'interface : boutons « bonbons » en relief, bulles de la barre
 * d'outils, pastilles d'information, dialogue modal animé, sélecteur segmenté.
 * Toutes les tailles sont en pixels physiques ; `unit` = 1 px CSS × échelle d'interface.
 */

export type ButtonStyle = 'primary' | 'secondary' | 'toolbar' | 'toolbarAccent' | 'accent';

export interface ButtonOptions {
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly icon?: IconName;
  readonly style: ButtonStyle;
  readonly unit: number;
  readonly onClick: () => void;
}

/** Un clic n'est valide que si le doigt n'a presque pas bougé (pas de clic en fin de défilement). */
export function isTap(pointer: Phaser.Input.Pointer, unit: number): boolean {
  return pointer.getDistance() < 14 * unit;
}

interface Palette {
  readonly face: number;
  readonly edge: number;
  readonly text: string;
  readonly icon: number;
}

const BUTTON_COLORS: Record<Exclude<ButtonStyle, 'toolbar' | 'toolbarAccent'>, Palette> = {
  primary: { face: PALETTE.coral, edge: PALETTE.coralDark, text: CSS.foam, icon: PALETTE.foam },
  accent: {
    face: PALETTE.turquoise,
    edge: PALETTE.turquoiseDark,
    text: CSS.foam,
    icon: PALETTE.foam,
  },
  secondary: { face: PALETTE.foam, edge: PALETTE.foamShade, text: CSS.navy, icon: PALETTE.navy },
};

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly iconG: Phaser.GameObjects.Graphics | null;
  private readonly text: Phaser.GameObjects.Text;
  private pressed = false;
  private enabled = true;
  private busy = false;
  private opts: ButtonOptions;
  private scaleTween: Phaser.Tweens.Tween | null = null;
  private busyTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.bg = scene.add.graphics();
    this.iconG = opts.icon ? scene.add.graphics() : null;
    const toolbar = this.isToolbar;
    this.text = scene.add.text(0, 0, opts.label, {
      fontFamily: FONTS.display,
      fontStyle: toolbar ? '600' : '600',
      fontSize: `${Math.round((toolbar ? 14 : 19) * opts.unit)}px`,
      color: toolbar ? CSS.foam : this.palette().text,
      align: 'center',
    });
    if (toolbar) {
      this.text.setStroke(CSS.deep, Math.max(2, 3.5 * opts.unit));
      this.text.setShadow(0, opts.unit, 'rgba(0,0,0,0.35)', 2 * opts.unit, true, false);
    }
    this.text.setOrigin(0.5, 0.5);
    this.add(this.bg);
    if (this.iconG) this.add(this.iconG);
    this.add(this.text);
    this.setSize(opts.width, opts.height);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      if (!this.enabled) return;
      this.pressed = true;
      this.redraw();
      this.animateScale(0.93, 70, 'Quad.easeOut');
    });
    this.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (this.enabled && !pointer.isDown && !pointer.wasTouch) {
        this.animateScale(1.04, 120, 'Quad.easeOut');
      }
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.redraw();
      this.animateScale(1, 160, 'Quad.easeOut');
    });
    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const wasPressed = this.pressed;
      this.pressed = false;
      this.redraw();
      this.animateScale(1, 260, 'Back.easeOut');
      if (!wasPressed || !this.enabled || !isTap(pointer, this.opts.unit)) return;
      audio.play('click');
      this.opts.onClick();
    });
    this.redraw();
    scene.add.existing(this);
  }

  private get isToolbar(): boolean {
    return this.opts.style === 'toolbar' || this.opts.style === 'toolbarAccent';
  }

  private palette(): Palette {
    const style = this.opts.style;
    if (style === 'toolbar') {
      return { face: PALETTE.foam, edge: PALETTE.foamShade, text: CSS.foam, icon: PALETTE.navy };
    }
    if (style === 'toolbarAccent') {
      return { face: PALETTE.coral, edge: PALETTE.coralDark, text: CSS.foam, icon: PALETTE.foam };
    }
    return BUTTON_COLORS[style];
  }

  private animateScale(to: number, duration: number, ease: string): void {
    this.scaleTween?.stop();
    this.scaleTween = this.scene.tweens.add({ targets: this, scale: to, duration, ease });
  }

  setEnabled(enabled: boolean): this {
    if (enabled === this.enabled) return this;
    this.enabled = enabled;
    this.scene.tweens.add({ targets: this, alpha: enabled ? 1 : 0.42, duration: 160 });
    return this;
  }

  /** Indique un calcul en cours (ex. : indice) sans bloquer l'interface. */
  setBusy(busy: boolean): this {
    this.busy = busy;
    this.busyTween?.stop();
    this.busyTween = null;
    if (this.iconG) {
      this.iconG.setAlpha(1);
      if (busy) {
        this.busyTween = this.scene.tweens.add({
          targets: this.iconG,
          alpha: 0.35,
          duration: 380,
          yoyo: true,
          repeat: -1,
        });
      }
    }
    this.redraw();
    return this;
  }

  setLabel(label: string): this {
    this.text.setText(label);
    this.redraw();
    return this;
  }

  /** Petit rebond pour attirer l'œil (ex. : bouton qui apparaît). */
  bounce(): this {
    this.setScale(0.6);
    this.animateScale(1, 420, 'Back.easeOut');
    return this;
  }

  resize(width: number, height: number): this {
    this.opts = { ...this.opts, width, height };
    this.setSize(width, height);
    if (this.input?.hitArea instanceof Phaser.Geom.Rectangle)
      this.input.hitArea.setTo(0, 0, width, height);
    this.redraw();
    return this;
  }

  private redraw(): void {
    const { width: w, height: h, unit } = this.opts;
    const g = this.bg;
    const colors = this.palette();
    g.clear();
    if (this.iconG) this.iconG.clear();
    if (this.isToolbar) {
      // Bulle ronde et libellé dessous.
      const labelH = this.text.height;
      const d = Math.max(20 * unit, Math.min(w * 0.72, h - labelH - 10 * unit, 52 * unit));
      const edge = 3.5 * unit;
      const top = -(d + edge + 2 * unit + labelH) / 2;
      const cy = top + d / 2;
      const press = this.pressed ? edge * 0.8 : 0;
      g.fillStyle(0x000000, 0.22);
      g.fillCircle(0, cy + edge + 2 * unit, d / 2);
      g.fillStyle(colors.edge, 1);
      g.fillCircle(0, cy + edge, d / 2);
      g.fillStyle(colors.face, this.busy ? 0.8 : 1);
      g.fillCircle(0, cy + press, d / 2);
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(-d * 0.14, cy + press - d * 0.24, d * 0.46, d * 0.22);
      if (this.iconG && this.opts.icon) {
        drawIcon(this.iconG, this.opts.icon, 0, cy + press, d * 0.5, colors.icon);
      }
      this.text.setPosition(0, top + d + edge + 2 * unit + labelH / 2);
      return;
    }
    const edge = 5 * unit;
    const faceH = h - edge;
    const r = Math.min(faceH / 2, 16 * unit);
    const press = this.pressed ? edge * 0.75 : 0;
    const top = -h / 2;
    g.fillStyle(0x000000, 0.2);
    g.fillRoundedRect(-w / 2, top + edge + 3 * unit, w, faceH, r);
    g.fillStyle(colors.edge, 1);
    g.fillRoundedRect(-w / 2, top + edge, w, faceH, r);
    g.fillStyle(colors.face, 1);
    g.fillRoundedRect(-w / 2, top + press, w, faceH, r);
    // Reflet en haut du bouton.
    const hr = Math.max(1, Math.min(r - 3 * unit, faceH * 0.2));
    g.fillStyle(0xffffff, this.opts.style === 'secondary' ? 0.6 : 0.2);
    g.fillRoundedRect(-w / 2 + 5 * unit, top + press + 3 * unit, w - 10 * unit, faceH * 0.38, {
      tl: hr,
      tr: hr,
      bl: hr * 0.5,
      br: hr * 0.5,
    });
    if (this.opts.style === 'secondary') {
      g.lineStyle(Math.max(1, 1.5 * unit), PALETTE.navy, 0.18);
      g.strokeRoundedRect(-w / 2, top + press, w, faceH, r);
    }
    const cy = top + press + faceH / 2;
    if (this.iconG && this.opts.icon) {
      const size = faceH * 0.4;
      const textW = this.text.width;
      const total = size + 10 * unit + textW;
      drawIcon(this.iconG, this.opts.icon, -total / 2 + size / 2, cy, size, colors.icon);
      this.text.setPosition(-total / 2 + size + 10 * unit + textW / 2, cy);
    } else {
      this.text.setPosition(0, cy);
    }
  }
}

// ---------------------------------------------------------------------------
// Pastille d'information (score, coups, temps)
// ---------------------------------------------------------------------------

export class InfoPill extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly iconG: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private popTween: Phaser.Tweens.Tween | null = null;
  pillWidth = 0;
  pillHeight = 0;

  constructor(
    scene: Phaser.Scene,
    private readonly icon: IconName,
    private unit: number,
  ) {
    super(scene, 0, 0);
    this.bg = scene.add.graphics();
    this.iconG = scene.add.graphics();
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: FONTS.display,
        fontStyle: '600',
        fontSize: `${Math.round(17 * unit)}px`,
        color: CSS.foam,
      })
      .setOrigin(0, 0.5);
    this.add([this.bg, this.iconG, this.label]);
    scene.add.existing(this);
  }

  setUnit(unit: number): this {
    this.unit = unit;
    this.label.setFontSize(Math.round(17 * unit));
    this.redraw();
    return this;
  }

  get value(): string {
    return this.label.text;
  }

  /** Met à jour le texte ; `pop` : petit rebond (valeur qui change). */
  setValue(text: string, pop = false): this {
    if (text === this.label.text) return this;
    this.label.setText(text);
    this.redraw();
    if (pop) {
      this.popTween?.stop();
      this.setScale(1.14);
      this.popTween = this.scene.tweens.add({
        targets: this,
        scale: 1,
        duration: 320,
        ease: 'Back.easeOut',
      });
    }
    return this;
  }

  private redraw(): void {
    const u = this.unit;
    const h = Math.round(this.label.height + 12 * u);
    const iconSize = h * 0.42;
    const padL = 12 * u;
    const gap = 7 * u;
    const padR = 14 * u;
    const w = padL + iconSize + gap + this.label.width + padR;
    this.pillWidth = w;
    this.pillHeight = h;
    const g = this.bg;
    g.clear();
    g.fillStyle(PALETTE.deep, 0.5);
    g.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    g.lineStyle(Math.max(1, 1.2 * u), 0xffffff, 0.22);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    this.iconG.clear();
    drawIcon(this.iconG, this.icon, -w / 2 + padL + iconSize / 2, 0, iconSize, PALETTE.gold);
    this.label.setPosition(-w / 2 + padL + iconSize + gap, 0);
  }
}

// ---------------------------------------------------------------------------
// Dialogue modal
// ---------------------------------------------------------------------------

export interface DialogButton {
  readonly label: string;
  readonly style: ButtonStyle;
  readonly icon?: IconName;
  readonly onClick: () => void;
}

export interface DialogStat {
  readonly label: string;
  readonly value: number;
  readonly format?: (value: number) => string;
}

export interface DialogOptions {
  readonly title: string;
  readonly subtitle?: string;
  readonly body?: string;
  /** Chiffres mis en valeur (ils défilent jusqu'à leur valeur). */
  readonly stats?: readonly DialogStat[];
  readonly buttons: readonly DialogButton[];
  readonly unit: number;
  /** Ambiance de fête : étincelles autour du titre. */
  readonly celebrate?: boolean;
  /** Tap hors du panneau : si défini, ferme le dialogue. */
  readonly onDismiss?: () => void;
}

/** Dialogue modal centré : voile, panneau qui rebondit, titre, texte, chiffres et boutons. */
export class Dialog extends Phaser.GameObjects.Container {
  private readonly panel: Phaser.GameObjects.Container;
  private readonly veil: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene, opts: DialogOptions) {
    super(scene, 0, 0);
    const { width: W, height: H } = scene.scale;
    const u = opts.unit;
    this.veil = scene.add.rectangle(0, 0, W, H, 0x06202b, 0.62).setOrigin(0, 0);
    this.veil.setInteractive();
    this.veil.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (opts.onDismiss && isTap(pointer, u)) opts.onDismiss();
    });
    this.add(this.veil);

    const panelW = Math.min(W - 32 * u, 400 * u);
    const pad = 24 * u;
    const innerW = panelW - pad * 2;
    const title = scene.add
      .text(0, 0, opts.title, {
        fontFamily: FONTS.display,
        fontSize: `${Math.round((opts.celebrate ? 36 : 28) * u)}px`,
        color: CSS.navy,
        fontStyle: '700',
        align: 'center',
        wordWrap: { width: innerW },
      })
      .setOrigin(0.5, 0);
    const subtitle = opts.subtitle
      ? scene.add
          .text(0, 0, opts.subtitle, {
            fontFamily: FONTS.display,
            fontSize: `${Math.round(18 * u)}px`,
            fontStyle: '500',
            color: CSS.turquoise,
            align: 'center',
            wordWrap: { width: innerW },
          })
          .setOrigin(0.5, 0)
      : null;
    const body = opts.body
      ? scene.add
          .text(0, 0, opts.body, {
            fontFamily: FONTS.ui,
            fontSize: `${Math.round(17 * u)}px`,
            color: CSS.text,
            align: 'center',
            lineSpacing: 4 * u,
            wordWrap: { width: innerW },
          })
          .setOrigin(0.5, 0)
      : null;
    const stats = opts.stats ?? [];
    const statH = stats.length > 0 ? 70 * u : 0;
    const buttonH = 58 * u;
    const buttonGap = 12 * u;
    const band = 12 * u;
    let contentH = band + pad + title.height;
    if (subtitle) contentH += 4 * u + subtitle.height;
    if (body) contentH += 12 * u + body.height;
    if (statH) contentH += 16 * u + statH;
    contentH += 22 * u;
    contentH += opts.buttons.length * buttonH + (opts.buttons.length - 1) * buttonGap + pad;
    const panelH = Math.min(contentH, H - 24 * u);

    // Le panneau est dessiné autour de (0, 0) pour pouvoir rebondir sur place.
    const panel = scene.add.container(W / 2, H / 2);
    this.panel = panel;
    const top = -panelH / 2;
    const left = -panelW / 2;
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.28);
    bg.fillRoundedRect(left, top + 8 * u, panelW, panelH, 26 * u);
    bg.fillStyle(PALETTE.foam, 1);
    bg.fillRoundedRect(left, top, panelW, panelH, 26 * u);
    // Bandeau turquoise ondulé en haut du panneau.
    bg.fillStyle(PALETTE.turquoise, 1);
    bg.fillRoundedRect(left, top, panelW, band + 8 * u, { tl: 26 * u, tr: 26 * u, bl: 0, br: 0 });
    bg.fillStyle(PALETTE.foam, 1);
    const waveR = 7 * u;
    for (let x = left + waveR; x < left + panelW; x += waveR * 2) {
      bg.fillCircle(x, top + band + 8 * u, waveR);
    }
    // Le panneau absorbe les taps (ils ne ferment pas le dialogue).
    const blocker = scene.add.zone(0, 0, panelW, panelH).setInteractive();
    panel.add([bg, blocker]);

    let y = top + band + pad;
    title.setPosition(0, y);
    panel.add(title);
    y += title.height;
    if (subtitle) {
      y += 4 * u;
      subtitle.setPosition(0, y);
      panel.add(subtitle);
      y += subtitle.height;
    }
    if (body) {
      y += 12 * u;
      body.setPosition(0, y);
      panel.add(body);
      y += body.height;
    }
    if (statH) {
      y += 16 * u;
      this.addStats(panel, stats, left + pad, y, innerW, statH, u);
      y += statH;
    }
    y += 22 * u;
    opts.buttons.forEach((spec, i) => {
      const button = new Button(scene, 0, y + buttonH / 2, {
        width: innerW,
        height: buttonH,
        label: spec.label,
        icon: spec.icon,
        style: spec.style,
        unit: u,
        onClick: spec.onClick,
      });
      panel.add(button);
      // Les boutons arrivent l'un après l'autre.
      button.setAlpha(0);
      scene.tweens.add({
        targets: button,
        alpha: 1,
        y: { from: button.y + 14 * u, to: button.y },
        duration: 260,
        delay: 160 + i * 70,
        ease: 'Back.easeOut',
      });
      y += buttonH + buttonGap;
    });

    if (opts.celebrate) this.addSparkles(panel, title, u);

    this.add(panel);
    this.setDepth(50_000);
    scene.add.existing(this);
    this.veil.setAlpha(0);
    scene.tweens.add({ targets: this.veil, alpha: 1, duration: 220 });
    panel.setScale(0.82).setAlpha(0);
    panel.y += 36 * u;
    scene.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      y: H / 2,
      duration: 380,
      ease: 'Back.easeOut',
    });
    audio.play('pop', { pitch: 0.9 });
  }

  private addStats(
    panel: Phaser.GameObjects.Container,
    stats: readonly DialogStat[],
    x0: number,
    y0: number,
    width: number,
    height: number,
    u: number,
  ): void {
    const scene = this.scene;
    const n = stats.length;
    const cellW = width / n;
    const g = scene.add.graphics();
    g.fillStyle(PALETTE.turquoise, 0.1);
    g.fillRoundedRect(x0, y0, width, height, 16 * u);
    panel.add(g);
    stats.forEach((stat, i) => {
      const cx = x0 + cellW * (i + 0.5);
      const label = scene.add
        .text(cx, y0 + 12 * u, stat.label.toUpperCase(), {
          fontFamily: FONTS.ui,
          fontSize: `${Math.round(12 * u)}px`,
          fontStyle: '700',
          color: CSS.muted,
        })
        .setOrigin(0.5, 0);
      label.setLetterSpacing(1.5 * u);
      const format = stat.format ?? ((v: number) => String(Math.round(v)));
      const value = scene.add
        .text(cx, y0 + height - 10 * u, format(0), {
          fontFamily: FONTS.display,
          fontSize: `${Math.round(26 * u)}px`,
          fontStyle: '700',
          color: CSS.navy,
        })
        .setOrigin(0.5, 1);
      panel.add([label, value]);
      scene.tweens.addCounter({
        from: 0,
        to: stat.value,
        duration: 900,
        delay: 250 + i * 120,
        ease: 'Cubic.easeOut',
        onUpdate: (tw) => value.setText(format(tw.getValue() ?? stat.value)),
        onComplete: () => {
          value.setText(format(stat.value));
          scene.tweens.add({
            targets: value,
            scale: { from: 1.25, to: 1 },
            duration: 300,
            ease: 'Back.easeOut',
          });
        },
      });
    });
  }

  private addSparkles(
    panel: Phaser.GameObjects.Container,
    title: Phaser.GameObjects.Text,
    u: number,
  ): void {
    if (!this.scene.textures.exists(FX.sparkleGold)) return;
    const cx = title.x;
    const cy = title.y + title.height / 2;
    const rx = title.width / 2 + 26 * u;
    const ry = title.height / 2 + 6 * u;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      const s = this.scene.add
        .image(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, FX.sparkleGold)
        .setScale(0)
        .setBlendMode(Phaser.BlendModes.NORMAL);
      panel.add(s);
      this.scene.tweens.add({
        targets: s,
        scale: { from: 0, to: 0.9 + (i % 3) * 0.25 },
        angle: 90,
        duration: 520,
        delay: 300 + i * 110,
        yoyo: true,
        repeat: -1,
        repeatDelay: 600 + i * 90,
        ease: 'Sine.easeInOut',
      });
    }
  }

  close(): void {
    this.disableInteractive();
    this.veil.disableInteractive();
    this.panel.each((child: Phaser.GameObjects.GameObject) => child.disableInteractive());
    this.scene.tweens.add({ targets: this.veil, alpha: 0, duration: 160 });
    this.scene.tweens.add({
      targets: this.panel,
      alpha: 0,
      scale: 0.92,
      duration: 150,
      ease: 'Quad.easeIn',
      onComplete: () => this.destroy(),
    });
  }
}

// ---------------------------------------------------------------------------
// Sélecteur segmenté (réglages)
// ---------------------------------------------------------------------------

export interface SegmentOption<T> {
  readonly value: T;
  readonly label: string;
}

export interface SegmentedOptions<T> {
  readonly label: string;
  readonly hint?: string;
  readonly options: readonly SegmentOption<T>[];
  readonly value: T;
  readonly width: number;
  readonly unit: number;
  readonly onChange: (value: T) => void;
}

/** Réglage à choix : libellé au-dessus, options en pastilles côte à côte. */
export class Segmented<T> extends Phaser.GameObjects.Container {
  readonly totalHeight: number;
  private value: T;
  private readonly pills: Array<{
    g: Phaser.GameObjects.Graphics;
    text: Phaser.GameObjects.Text;
    value: T;
  }> = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly opts: SegmentedOptions<T>,
  ) {
    super(scene, x, y);
    const u = opts.unit;
    this.value = opts.value;
    const label = scene.add.text(0, 0, opts.label, {
      fontFamily: FONTS.display,
      fontSize: `${Math.round(18 * u)}px`,
      fontStyle: '600',
      color: CSS.foam,
    });
    this.add(label);
    let y0 = label.height + 8 * u;
    if (opts.hint) {
      const hint = scene.add.text(0, y0 - 4 * u, opts.hint, {
        fontFamily: FONTS.ui,
        fontSize: `${Math.round(13 * u)}px`,
        color: CSS.sand,
        wordWrap: { width: opts.width },
      });
      this.add(hint);
      y0 += hint.height + 4 * u;
    }
    const pillH = 48 * u;
    const gap = 8 * u;
    const n = opts.options.length;
    const pillW = (opts.width - gap * (n - 1)) / n;
    opts.options.forEach((option, i) => {
      const px = i * (pillW + gap);
      const g = scene.add.graphics();
      const text = scene.add
        .text(px + pillW / 2, y0 + pillH / 2, option.label, {
          fontFamily: FONTS.display,
          fontSize: `${Math.round(17 * u)}px`,
          fontStyle: '600',
          color: CSS.foam,
        })
        .setOrigin(0.5, 0.5);
      const zone = scene.add
        .zone(px + pillW / 2, y0 + pillH / 2, pillW, pillH)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!isTap(pointer, u) || this.value === option.value) return;
        this.value = option.value;
        audio.play('click');
        this.redraw(pillW, pillH, y0);
        scene.tweens.add({
          targets: text,
          scale: { from: 1.18, to: 1 },
          duration: 280,
          ease: 'Back.easeOut',
        });
        opts.onChange(option.value);
      });
      this.pills.push({ g, text, value: option.value });
      this.add([g, text, zone]);
    });
    this.redraw(pillW, pillH, y0);
    this.totalHeight = y0 + pillH;
    scene.add.existing(this);
  }

  private redraw(pillW: number, pillH: number, y0: number): void {
    const u = this.opts.unit;
    this.pills.forEach((pill, i) => {
      const selected = pill.value === this.value;
      const px = i * (pillW + 8 * u);
      pill.g.clear();
      if (selected) {
        pill.g.fillStyle(PALETTE.turquoiseDark, 1);
        pill.g.fillRoundedRect(px, y0 + 3 * u, pillW, pillH, pillH / 2);
        pill.g.fillStyle(PALETTE.turquoise, 1);
        pill.g.fillRoundedRect(px, y0, pillW, pillH, pillH / 2);
        pill.g.fillStyle(0xffffff, 0.18);
        pill.g.fillRoundedRect(px + 6 * u, y0 + 3 * u, pillW - 12 * u, pillH * 0.36, pillH * 0.18);
      } else {
        pill.g.fillStyle(0xffffff, 0.08);
        pill.g.fillRoundedRect(px, y0, pillW, pillH, pillH / 2);
        pill.g.lineStyle(Math.max(1, 1.5 * u), PALETTE.sand, 0.4);
        pill.g.strokeRoundedRect(px, y0, pillW, pillH, pillH / 2);
      }
      pill.text.setColor(selected ? CSS.foam : CSS.sand);
    });
  }
}
