import Phaser from 'phaser';
import { CSS, FONTS, PALETTE } from '../../config/theme';
import { audio } from '../../services/audio';
import { drawIcon, type IconName } from './icons';

/**
 * Petit kit d'interface : boutons, dialogue modal, sélecteur segmenté.
 * Toutes les tailles sont en pixels physiques ; `unit` = 1 px CSS × échelle d'interface.
 */

export type ButtonStyle = 'primary' | 'secondary' | 'toolbar' | 'accent';

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

export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly iconG: Phaser.GameObjects.Graphics | null;
  private readonly text: Phaser.GameObjects.Text;
  private pressed = false;
  private enabled = true;
  private busy = false;
  private opts: ButtonOptions;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.bg = scene.add.graphics();
    this.iconG = opts.icon ? scene.add.graphics() : null;
    this.text = scene.add.text(0, 0, opts.label, {
      fontFamily: FONTS.ui,
      fontStyle: opts.style === 'toolbar' ? '600' : '700',
      fontSize: `${Math.round((opts.style === 'toolbar' ? 13 : 17) * opts.unit)}px`,
      color: this.textColor(),
      align: 'center',
    });
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
    });
    this.on('pointerout', () => {
      this.pressed = false;
      this.redraw();
    });
    this.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const wasPressed = this.pressed;
      this.pressed = false;
      this.redraw();
      if (!wasPressed || !this.enabled || !isTap(pointer, this.opts.unit)) return;
      audio.play('click');
      this.opts.onClick();
    });
    this.redraw();
    scene.add.existing(this);
  }

  private textColor(): string {
    switch (this.opts.style) {
      case 'primary':
      case 'accent':
        return CSS.foam;
      case 'secondary':
        return CSS.navy;
      case 'toolbar':
        return CSS.foam;
    }
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.4);
    return this;
  }

  /** Indique un calcul en cours (ex. : indice) sans bloquer l'interface. */
  setBusy(busy: boolean): this {
    this.busy = busy;
    this.redraw();
    return this;
  }

  setLabel(label: string): this {
    this.text.setText(label);
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
    const { width: w, height: h, style, unit } = this.opts;
    const g = this.bg;
    g.clear();
    const r = Math.min(h / 2, 14 * unit);
    if (style === 'toolbar') {
      if (this.pressed || this.busy) {
        g.fillStyle(0xffffff, this.busy ? 0.1 : 0.16);
        g.fillRoundedRect(
          -w / 2 + 4 * unit,
          -h / 2 + 4 * unit,
          w - 8 * unit,
          h - 8 * unit,
          12 * unit,
        );
      }
    } else {
      const fill =
        style === 'primary' ? PALETTE.navy : style === 'accent' ? PALETTE.turquoise : 0xffffff;
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(-w / 2, -h / 2 + 3 * unit, w, h, r);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -h / 2 + (this.pressed ? 2 * unit : 0), w, h, r);
      if (style === 'secondary') {
        g.lineStyle(Math.max(1, 1.5 * unit), PALETTE.navy, 0.5);
        g.strokeRoundedRect(-w / 2, -h / 2 + (this.pressed ? 2 * unit : 0), w, h, r);
      }
    }
    const press = this.pressed ? 2 * unit : 0;
    const iconColor =
      style === 'secondary' ? PALETTE.navy : style === 'toolbar' ? PALETTE.sand : PALETTE.foam;
    if (this.iconG && this.opts.icon) {
      this.iconG.clear();
      if (style === 'toolbar') {
        const size = Math.min(26 * unit, h * 0.42);
        drawIcon(this.iconG, this.opts.icon, 0, -h * 0.14 + press, size, iconColor);
        this.text.setPosition(0, h * 0.26 + press);
      } else {
        const size = h * 0.42;
        const textW = this.text.width;
        const total = size + 10 * unit + textW;
        drawIcon(this.iconG, this.opts.icon, -total / 2 + size / 2, press, size, iconColor);
        this.text.setPosition(-total / 2 + size + 10 * unit + textW / 2, press);
      }
    } else {
      this.text.setPosition(0, press);
    }
  }
}

export interface DialogButton {
  readonly label: string;
  readonly style: ButtonStyle;
  readonly icon?: IconName;
  readonly onClick: () => void;
}

export interface DialogOptions {
  readonly title: string;
  readonly body?: string;
  readonly buttons: readonly DialogButton[];
  readonly unit: number;
  /** Tap hors du panneau : si défini, ferme le dialogue. */
  readonly onDismiss?: () => void;
}

/** Dialogue modal centré : voile, panneau clair, titre, texte et boutons empilés. */
export class Dialog extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, opts: DialogOptions) {
    super(scene, 0, 0);
    const { width: W, height: H } = scene.scale;
    const u = opts.unit;
    const veil = scene.add.rectangle(0, 0, W, H, 0x081e26, 0.66).setOrigin(0, 0);
    veil.setInteractive();
    veil.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (opts.onDismiss && isTap(pointer, u)) opts.onDismiss();
    });
    this.add(veil);

    const panelW = Math.min(W - 32 * u, 380 * u);
    const pad = 22 * u;
    const title = scene.add
      .text(0, 0, opts.title, {
        fontFamily: FONTS.title,
        fontSize: `${Math.round(24 * u)}px`,
        color: CSS.navy,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: panelW - pad * 2 },
      })
      .setOrigin(0.5, 0);
    const body = opts.body
      ? scene.add
          .text(0, 0, opts.body, {
            fontFamily: FONTS.ui,
            fontSize: `${Math.round(17 * u)}px`,
            color: CSS.text,
            align: 'center',
            lineSpacing: 4 * u,
            wordWrap: { width: panelW - pad * 2 },
          })
          .setOrigin(0.5, 0)
      : null;
    const buttonH = 54 * u;
    const buttonGap = 12 * u;
    const band = 6 * u;
    let contentH = band + pad + title.height + (body ? 12 * u + body.height : 0) + 20 * u;
    contentH += opts.buttons.length * buttonH + (opts.buttons.length - 1) * buttonGap + pad;
    const panelH = Math.min(contentH, H - 24 * u);
    const px = W / 2;
    const py = H / 2 - panelH / 2;

    const panel = scene.add.graphics();
    panel.fillStyle(0x000000, 0.25);
    panel.fillRoundedRect(px - panelW / 2, py + 6 * u, panelW, panelH, 20 * u);
    panel.fillStyle(PALETTE.foam, 1);
    panel.fillRoundedRect(px - panelW / 2, py, panelW, panelH, 20 * u);
    panel.fillStyle(PALETTE.turquoise, 1);
    panel.fillRoundedRect(px - panelW / 2, py, panelW, band, {
      tl: 20 * u,
      tr: 20 * u,
      bl: 0,
      br: 0,
    });
    // Le panneau absorbe les taps (ils ne ferment pas le dialogue).
    const blocker = scene.add.zone(px, py + panelH / 2, panelW, panelH).setInteractive();
    this.add([panel, blocker]);

    let y = py + band + pad;
    title.setPosition(px, y);
    this.add(title);
    y += title.height;
    if (body) {
      y += 12 * u;
      body.setPosition(px, y);
      this.add(body);
      y += body.height;
    }
    y += 20 * u;
    for (const spec of opts.buttons) {
      const button = new Button(scene, px, y + buttonH / 2, {
        width: panelW - pad * 2,
        height: buttonH,
        label: spec.label,
        icon: spec.icon,
        style: spec.style,
        unit: u,
        onClick: spec.onClick,
      });
      this.add(button);
      y += buttonH + buttonGap;
    }
    this.setDepth(50_000);
    scene.add.existing(this);
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 160 });
  }

  close(): void {
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 120,
      onComplete: () => this.destroy(),
    });
    this.disableInteractive();
    this.each((child: Phaser.GameObjects.GameObject) => child.disableInteractive());
  }
}

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
      fontFamily: FONTS.ui,
      fontSize: `${Math.round(16 * u)}px`,
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
    const pillH = 46 * u;
    const gap = 8 * u;
    const n = opts.options.length;
    const pillW = (opts.width - gap * (n - 1)) / n;
    opts.options.forEach((option, i) => {
      const px = i * (pillW + gap);
      const g = scene.add.graphics();
      const text = scene.add
        .text(px + pillW / 2, y0 + pillH / 2, option.label, {
          fontFamily: FONTS.ui,
          fontSize: `${Math.round(16 * u)}px`,
          fontStyle: '700',
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
      pill.g.fillStyle(selected ? PALETTE.foam : 0xffffff, selected ? 1 : 0.1);
      pill.g.fillRoundedRect(px, y0, pillW, pillH, pillH / 2);
      if (!selected) {
        pill.g.lineStyle(Math.max(1, 1.5 * u), PALETTE.sand, 0.45);
        pill.g.strokeRoundedRect(px, y0, pillW, pillH, pillH / 2);
      }
      pill.text.setColor(selected ? CSS.navy : CSS.foam);
    });
  }
}
