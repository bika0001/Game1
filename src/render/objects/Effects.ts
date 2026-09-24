import Phaser from 'phaser';
import { CSS, FONTS, PALETTE } from '../../config/theme';
import { audio } from '../../services/audio';
import { TEX } from '../cardart/textures';
import { CONFETTI_FRAMES, FX } from '../decor/fxTextures';
import type { CardView } from './CardView';

/** Profondeur des effets passagers : au-dessus des cartes posées et en vol. */
export const FX_DEPTH = 22_000;

/** Onde qui s'élargit sur l'eau autour d'un point (atterrissage d'une carte). */
export function ripple(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  depth: number,
  speed = 1,
  alpha = 0.5,
): void {
  if (!scene.textures.exists(FX.ripple)) return;
  const base = scene.textures.get(FX.ripple).getSourceImage().width || 1;
  for (let i = 0; i < 2; i++) {
    const ring = scene.add
      .image(x, y, FX.ripple)
      .setDepth(depth)
      .setAlpha(0)
      .setScale((size * 0.45) / base);
    scene.tweens.add({
      targets: ring,
      scale: (size * (1.35 - i * 0.3)) / base,
      alpha: { from: alpha * (1 - i * 0.4), to: 0 },
      duration: (700 + i * 160) / speed,
      delay: (i * 120) / speed,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    });
  }
}

export interface BurstOptions {
  readonly count: number;
  /** Distance parcourue par les étincelles (pixels). */
  readonly radius: number;
  readonly depth: number;
  readonly gold?: boolean;
  readonly duration?: number;
}

/** Gerbe d'étincelles (carte posée sur une fondation, victoire). */
export function sparkleBurst(scene: Phaser.Scene, x: number, y: number, o: BurstOptions): void {
  if (o.count <= 0) return;
  const key = o.gold ? FX.sparkleGold : FX.sparkle;
  if (!scene.textures.exists(key)) return;
  const life = o.duration ?? 700;
  const speed = o.radius / (life / 1000);
  const emitter = scene.add.particles(x, y, key, {
    speed: { min: speed * 0.45, max: speed * 1.1 },
    angle: { min: 0, max: 360 },
    lifespan: { min: life * 0.55, max: life },
    scale: { start: 1, end: 0 },
    alpha: { start: 1, end: 0.2 },
    rotate: { min: 0, max: 90 },
    blendMode: Phaser.BlendModes.ADD,
    emitting: false,
  });
  emitter.setDepth(o.depth);
  emitter.explode(o.count);
  scene.time.delayedCall(life + 80, () => emitter.destroy());
}

export interface FloatTextOptions {
  readonly color: string;
  readonly size: number;
  readonly depth: number;
  readonly unit: number;
  readonly speed?: number;
}

/** Texte qui jaillit puis s'envole (points gagnés…). */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  o: FloatTextOptions,
): void {
  const speed = o.speed ?? 1;
  const label = scene.add
    .text(x, y, text, {
      fontFamily: FONTS.display,
      fontStyle: '700',
      fontSize: `${Math.round(o.size)}px`,
      color: o.color,
      stroke: CSS.deep,
      strokeThickness: Math.max(2, o.size * 0.16),
    })
    .setOrigin(0.5)
    .setDepth(o.depth)
    .setScale(0.3)
    .setAlpha(0);
  label.setShadow(0, 2 * o.unit, 'rgba(0,0,0,0.3)', 3 * o.unit, true, true);
  scene.tweens.chain({
    targets: label,
    tweens: [
      { scale: 1.15, alpha: 1, duration: 180 / speed, ease: 'Back.easeOut' },
      { scale: 1, duration: 120 / speed },
      { y: y - 52 * o.unit, alpha: 0, duration: 700 / speed, ease: 'Sine.easeIn' },
    ],
    onComplete: () => label.destroy(),
  });
}

/** Éclair lumineux sur un emplacement (fondation qui reçoit une carte). */
export function flashSlot(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  depth: number,
  speed = 1,
): void {
  const glow = scene.add
    .image(x + w / 2, y + h / 2, TEX.glow)
    .setDepth(depth)
    .setAlpha(0.95);
  scene.tweens.add({
    targets: glow,
    alpha: 0,
    scale: 1.12,
    duration: 520 / speed,
    ease: 'Quad.easeOut',
    onComplete: () => glow.destroy(),
  });
}

/** Message éphémère en pastille, au-dessus de la barre d'outils. */
export function showToast(scene: Phaser.Scene, text: string, y: number, unit: number): void {
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: FONTS.display,
      fontSize: `${Math.round(18 * unit)}px`,
      color: CSS.navy,
      fontStyle: '600',
      align: 'center',
      wordWrap: { width: scene.scale.width - 72 * unit },
    })
    .setOrigin(0.5, 0.5);
  const padX = 20 * unit;
  const padY = 12 * unit;
  const w = label.width + padX * 2;
  const h = label.height + padY * 2;
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.2);
  bg.fillRoundedRect(-w / 2, -h / 2 + 4 * unit, w, h, h / 2);
  bg.fillStyle(PALETTE.foam, 0.98);
  bg.fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
  const toast = scene.add
    .container(scene.scale.width / 2, y + 20 * unit, [bg, label])
    .setDepth(40_000)
    .setAlpha(0)
    .setScale(0.8);
  scene.tweens.chain({
    targets: toast,
    tweens: [
      { alpha: 1, y, scale: 1, duration: 260, ease: 'Back.easeOut' },
      { alpha: 1, duration: 2000 },
      { alpha: 0, y: y - 12 * unit, duration: 260 },
    ],
    onComplete: () => toast.destroy(),
  });
}

/** Halo doré pulsant autour d'une carte ou d'un emplacement (indice). */
export function addGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  speed: number,
) {
  const glow = scene.add
    .image(x + w / 2, y + h / 2, TEX.glow)
    .setDepth(20_000)
    .setAlpha(0);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 1 },
    duration: 520 / speed,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return glow;
}

// ---------------------------------------------------------------------------
// Victoire
// ---------------------------------------------------------------------------

export interface CelebrationOptions {
  readonly cards: readonly CardView[];
  readonly title: string;
  readonly skipLabel: string;
  /** Hauteur du message « Touchez pour passer » (au-dessus de la barre d'outils). */
  readonly skipY: number;
  readonly unit: number;
  readonly speed: number;
  /** Nombre d'effets (qualité courante : 0 à 2). */
  readonly quality: number;
  readonly onDone: () => void;
}

/**
 * Fête de victoire : « Bravo ! » qui rebondit lettre par lettre, pluie de
 * confettis marins (étoiles de mer, coquillages, étincelles) et cartes qui
 * bondissent des fondations pour plonger dans le lagon. Passable d'un tap.
 */
export class WinCelebration {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly tweens: Phaser.Tweens.Tween[] = [];
  private readonly timers: Phaser.Time.TimerEvent[] = [];
  private finished = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: CelebrationOptions,
  ) {
    // Toutes les cartes des fondations vont s'envoler : posées, droites et toutes visibles.
    for (const view of o.cards) {
      view.placeAt(view.targetX, view.targetY);
      view.setCovered(false);
    }
    this.banner();
    this.confetti();
    const cardsDone = this.cardsFountain();
    const hint = this.scene.add
      .text(this.scene.scale.width / 2, o.skipY, o.skipLabel, {
        fontFamily: FONTS.display,
        fontStyle: '500',
        fontSize: `${Math.round(16 * o.unit)}px`,
        color: CSS.foam,
        stroke: CSS.deep,
        strokeThickness: 3 * o.unit,
      })
      .setOrigin(0.5)
      .setDepth(31_000)
      .setAlpha(0);
    this.objects.push(hint);
    this.tweens.push(
      this.scene.tweens.add({ targets: hint, alpha: 0.85, duration: 400, delay: 900 }),
    );
    this.timers.push(this.scene.time.delayedCall(cardsDone + 350 / o.speed, () => this.finish()));
  }

  private banner(): void {
    const { scene, o } = this;
    const { width: W, height: H } = scene.scale;
    const size = Math.round(Math.min(W * 0.17, 96 * o.unit));
    const letters = [...o.title];
    const style = {
      fontFamily: FONTS.display,
      fontStyle: '700',
      fontSize: `${size}px`,
      color: CSS.gold,
      stroke: CSS.deep,
      strokeThickness: Math.max(3, size * 0.12),
    };
    const texts = letters.map((ch) =>
      scene.add.text(0, 0, ch, style).setOrigin(0.5, 0.5).setDepth(31_000),
    );
    const widths = texts.map((t) => (t.text === ' ' ? size * 0.3 : t.width * 0.92));
    const total = widths.reduce((a, b) => a + b, 0);
    let x = W / 2 - total / 2;
    const y = H * 0.3;
    texts.forEach((t, i) => {
      const w = widths[i] as number;
      t.setPosition(x + w / 2, y - H * 0.4);
      t.setShadow(0, 4 * o.unit, 'rgba(0,0,0,0.35)', 6 * o.unit, true, true);
      x += w;
      this.objects.push(t);
      this.tweens.push(
        scene.tweens.add({
          targets: t,
          y,
          duration: 650 / o.speed,
          delay: (i * 70) / o.speed,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            // Ensuite, les lettres ondulent comme sur une vague.
            this.tweens.push(
              scene.tweens.add({
                targets: t,
                y: y - size * 0.12,
                angle: { from: -4, to: 4 },
                duration: 520,
                delay: i * 60,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
              }),
            );
          },
        }),
      );
    });
  }

  private confetti(): void {
    const { scene, o } = this;
    if (!scene.textures.exists(FX.confetti)) return;
    const { width: W } = scene.scale;
    const u = o.unit;
    const emitter = scene.add.particles(0, 0, FX.confetti, {
      frame: [...CONFETTI_FRAMES],
      x: { min: 0, max: W },
      y: -30 * u,
      lifespan: 3400,
      speedY: { min: 90 * u, max: 230 * u },
      speedX: { min: -70 * u, max: 70 * u },
      gravityY: 50 * u,
      rotate: { start: 0, end: 540 },
      scale: { min: 0.8, max: 1.6 },
      alpha: { start: 1, end: 0.5 },
      tint: [0xffffff, 0xffe29a, 0xffc4b5, 0xb8f0ea, 0xffffff],
      frequency: o.quality >= 2 ? 20 : o.quality === 1 ? 40 : 80,
      quantity: 1,
    });
    emitter.setDepth(30_500);
    this.objects.push(emitter);
    this.timers.push(scene.time.delayedCall(2300 / o.speed, () => emitter.stop()));
  }

  /** Les cartes jaillissent des fondations et plongent dans l'eau. Renvoie la durée totale. */
  private cardsFountain(): number {
    const { scene, o } = this;
    const { width: W, height: H } = scene.scale;
    // Du Roi à l'As, en alternant les fondations.
    const order = [...o.cards].sort(
      (a, b) => Math.floor(b.card / 4) - Math.floor(a.card / 4) || (a.card % 4) - (b.card % 4),
    );
    const stagger = 48 / o.speed;
    const flight = 900 / o.speed;
    order.forEach((view, i) => {
      const x0 = view.x;
      const y0 = view.y;
      const side = i % 2 === 0 ? 1 : -1;
      const x1 = Phaser.Math.Clamp(
        x0 + side * W * (0.15 + ((i * 37) % 50) / 100),
        W * 0.06,
        W * 0.94,
      );
      const y1 = H * (0.55 + ((i * 53) % 35) / 100);
      const peak = Math.min(y0, y1) - H * (0.12 + ((i * 29) % 20) / 100);
      const cx = (x0 + x1) / 2;
      const spin = side * (140 + ((i * 41) % 160));
      view.setDepth(30_000 + i);
      const tween = scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: flight,
        delay: i * stagger,
        ease: 'Sine.easeIn',
        onUpdate: (tw) => {
          const t = tw.getValue() ?? 0;
          const u = 1 - t;
          view.x = u * u * x0 + 2 * u * t * cx + t * t * x1;
          view.y = u * u * y0 + 2 * u * t * peak + t * t * y1;
          view.angle = spin * t;
          view.setScale(1 - 0.45 * t);
          view.setAlpha(t < 0.85 ? 1 : 1 - (t - 0.85) / 0.15);
        },
        onComplete: () => {
          view.setAlpha(0);
          ripple(scene, x1, y1, view.cardW * 1.4, 29_000, o.speed, 0.6);
          if (i % 3 === 0) audio.play('splash', { pitch: 0.85 + (i % 7) * 0.06, volume: 0.7 });
        },
      });
      this.tweens.push(tween);
    });
    return order.length * stagger + flight;
  }

  get done(): boolean {
    return this.finished;
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    for (const t of this.timers) t.remove(false);
    for (const t of this.tweens) t.stop();
    for (const obj of this.objects) {
      const target = obj as Phaser.GameObjects.GameObject & { alpha?: number };
      if (typeof target.alpha === 'number') {
        this.scene.tweens.add({
          targets: obj,
          alpha: 0,
          duration: 220,
          onComplete: () => obj.destroy(),
        });
      } else {
        obj.destroy();
      }
    }
    for (const view of this.o.cards) view.setAlpha(0);
    this.o.onDone();
  }

  /** Tap pendant la fête : on passe directement au bilan. */
  skip(): void {
    this.finish();
  }
}
