import Phaser from 'phaser';
import { TEX, type CardMetrics } from '../cardart/textures';

/**
 * Une carte à l'écran : un conteneur (ombre, face, reflet) centré sur la carte.
 *
 * Les coordonnées manipulées par la scène sont celles du coin haut-gauche de
 * la carte. La carte peut se « soulever » (0 = posée, 1 = en l'air) : elle
 * grossit un peu et son ombre s'écarte et s'adoucit, ce qui donne de la
 * profondeur aux vols, aux retournements et au glisser-déposer.
 */

export interface FlightOptions {
  readonly duration: number;
  readonly delay?: number;
  /** Hauteur de l'arc en pixels (par défaut : proportionnelle à la distance). */
  readonly arc?: number;
  /** Soulèvement maximal pendant le vol (0 à 1). */
  readonly lift?: number;
  /** Inclinaison maximale en degrés. */
  readonly tilt?: number;
  /** Petit tassement à l'arrivée (par défaut : oui). */
  readonly settle?: boolean;
  readonly onStart?: () => void;
  readonly onLand?: () => void;
}

export class CardView extends Phaser.GameObjects.Container {
  readonly face: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Image;
  readonly sheen: Phaser.GameObjects.Image;
  faceUp = false;
  /** Position de repos visée (coin haut-gauche). */
  targetX = 0;
  targetY = 0;

  private lift = 0;
  private flipLift = 0;
  private flipScaleX = 1;
  private flipScaleY = 1;
  private squash = 1;
  /** Carte recouverte par une autre au même endroit (pioche, fondation) : rien à dessiner. */
  private covered = false;
  /** État « recouverte » à appliquer à l'atterrissage (la carte est en vol). */
  private pendingCovered: boolean | null = null;
  private flight: Phaser.Tweens.Tween | null = null;
  private flipTween: Phaser.Tweens.Tween | null = null;
  private settleTween: Phaser.Tweens.Tween | null = null;
  private liftTween: Phaser.Tweens.Tween | null = null;
  private shakeTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly card: number,
    private metrics: CardMetrics,
  ) {
    super(scene, 0, 0);
    this.shadow = scene.make.image({ key: TEX.shadow, add: false });
    this.face = scene.make.image({ key: TEX.back, add: false });
    this.sheen = scene.make.image({ key: TEX.sheen, add: false }).setVisible(false);
    this.add([this.shadow, this.face, this.sheen]);
    this.setSize(metrics.cardW, metrics.cardH);
    scene.add.existing(this);
    this.applyLift();
  }

  get cardW(): number {
    return this.metrics.cardW;
  }

  get cardH(): number {
    return this.metrics.cardH;
  }

  /** Coin haut-gauche affiché (pendant une animation, la position courante). */
  get left(): number {
    return this.x - this.metrics.cardW / 2;
  }

  get top(): number {
    return this.y - this.metrics.cardH / 2;
  }

  get isMoving(): boolean {
    return this.flight !== null;
  }

  get lifted(): number {
    return this.lift;
  }

  setMetrics(metrics: CardMetrics): void {
    this.metrics = metrics;
    this.face.setTexture(this.faceUp ? TEX.face(this.card) : TEX.back);
    this.shadow.setTexture(TEX.shadow);
    this.sheen.setTexture(TEX.sheen);
    this.setSize(metrics.cardW, metrics.cardH);
    this.applyLift();
  }

  private applyLift(): void {
    const z = Math.max(this.lift, this.flipLift);
    const s = (1 + 0.075 * z) * this.squash;
    this.face.setScale(this.flipScaleX * s, this.flipScaleY * s);
    this.sheen.setScale(this.face.scaleX, this.face.scaleY);
    const off = this.metrics.cardH * (0.018 + 0.08 * z);
    this.shadow.setPosition(off * 0.3, off);
    const spread = 1 + 0.09 * z;
    this.shadow.setScale(Math.max(0.08, this.flipScaleX) * spread, spread);
    this.shadow.setAlpha(0.42 - 0.16 * z);
    // Carte au repos exactement recouverte (pioche, fondations) : rien à dessiner.
    // Cela évite aussi que les ombres empilées forment un halo sombre.
    const hidden = this.covered && z < 0.02 && !this.flight && !this.flipTween;
    this.shadow.setVisible(!hidden);
    this.face.setVisible(!hidden);
  }

  /**
   * Indique si la carte est exactement recouverte par la suivante de sa pile.
   * En vol, l'information est gardée pour l'atterrissage : la carte reste
   * visible pendant le trajet et garde son apparence tant qu'elle n'est pas partie.
   */
  setCovered(covered: boolean): void {
    if (this.flight) {
      this.pendingCovered = covered;
      return;
    }
    this.pendingCovered = null;
    if (covered === this.covered) return;
    this.covered = covered;
    this.applyLift();
  }

  private applyPendingCover(): void {
    if (this.pendingCovered === null) return;
    this.covered = this.pendingCovered;
    this.pendingCovered = null;
  }

  /** Place la carte immédiatement, posée et droite. */
  placeAt(x: number, y: number): void {
    this.flight?.stop();
    this.flight = null;
    this.applyPendingCover();
    this.liftTween?.stop();
    this.liftTween = null;
    this.targetX = x;
    this.targetY = y;
    this.setPosition(x + this.metrics.cardW / 2, y + this.metrics.cardH / 2);
    this.angle = 0;
    this.lift = 0;
    this.applyLift();
  }

  /** Suit le doigt pendant un glisser (la position de repos ne change pas). */
  dragTo(x: number, y: number, angle = 0): void {
    this.flight?.stop();
    this.flight = null;
    this.setPosition(x + this.metrics.cardW / 2, y + this.metrics.cardH / 2);
    this.angle = angle;
  }

  isMovingTo(x: number, y: number): boolean {
    return this.targetX === x && this.targetY === y;
  }

  /** Soulève ou repose la carte en douceur. */
  liftTo(z: number, duration: number): void {
    this.liftTween?.stop();
    const from = this.lift;
    if (duration <= 0) {
      this.liftTween = null;
      this.lift = z;
      this.applyLift();
      return;
    }
    this.liftTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: (tw) => {
        this.lift = from + (z - from) * (tw.getValue() ?? 1);
        this.applyLift();
      },
      onComplete: () => {
        this.liftTween = null;
      },
    });
  }

  /**
   * Vol en arc vers (x, y) : départ et arrivée en douceur, soulèvement au
   * milieu du trajet, légère inclinaison dans le sens du mouvement.
   */
  flyTo(x: number, y: number, opts: FlightOptions): void {
    this.targetX = x;
    this.targetY = y;
    this.flight?.stop();
    this.flight = null;
    this.liftTween?.stop();
    this.liftTween = null;
    const w = this.metrics.cardW;
    const h = this.metrics.cardH;
    const ex = x + w / 2;
    const ey = y + h / 2;
    const sx = this.x;
    const sy = this.y;
    const dx = ex - sx;
    const dist = Math.hypot(dx, ey - sy);
    if (opts.duration <= 0 || dist < 0.5) {
      this.setPosition(ex, ey);
      this.angle = 0;
      this.lift = 0;
      this.applyLift();
      opts.onStart?.();
      opts.onLand?.();
      return;
    }
    const arc = opts.arc ?? Math.min(dist * 0.18, h * 0.55);
    const cx = (sx + ex) / 2;
    const cy = (sy + ey) / 2 - arc;
    const liftMax = opts.lift ?? Math.min(1, 0.35 + dist / (h * 4));
    const z0 = this.lift;
    const a0 = this.angle;
    const tilt = (opts.tilt ?? 6) * Phaser.Math.Clamp(dx / (w * 3), -1, 1);
    this.flight = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: opts.duration,
      delay: opts.delay ?? 0,
      ease: 'Sine.easeInOut',
      onStart: () => {
        this.applyLift();
        opts.onStart?.();
      },
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 1;
        const u = 1 - t;
        this.x = u * u * sx + 2 * u * t * cx + t * t * ex;
        this.y = u * u * sy + 2 * u * t * cy + t * t * ey;
        this.lift = Math.max(Math.sin(Math.PI * t) * liftMax, z0 * u);
        this.angle = a0 * u + tilt * Math.sin(Math.PI * t);
        this.applyLift();
      },
      onComplete: () => {
        this.flight = null;
        this.applyPendingCover();
        this.setPosition(ex, ey);
        this.angle = 0;
        this.lift = 0;
        this.applyLift();
        if (opts.settle !== false) this.settle();
        opts.onLand?.();
      },
    });
  }

  /** Léger tassement à l'atterrissage. */
  private settle(): void {
    this.settleTween?.stop();
    this.settleTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 170,
      onUpdate: (tw) => {
        this.squash = 1 - 0.035 * Math.sin(Math.PI * (tw.getValue() ?? 1));
        this.applyLift();
      },
      onComplete: () => {
        this.squash = 1;
        this.settleTween = null;
        this.applyLift();
      },
    });
  }

  /** Retournement en perspective, avec un éclat quand la face apparaît. */
  setFace(faceUp: boolean, duration = 0, delay = 0): void {
    if (faceUp === this.faceUp && !(duration <= 0 && this.flipTween)) return;
    this.faceUp = faceUp;
    this.flipTween?.stop();
    this.flipTween = null;
    const key = faceUp ? TEX.face(this.card) : TEX.back;
    const finish = (): void => {
      this.face.setTexture(key);
      this.flipScaleX = 1;
      this.flipScaleY = 1;
      this.flipLift = 0;
      this.sheen.setVisible(false);
      this.applyLift();
    };
    if (duration <= 0) {
      finish();
      return;
    }
    let swapped = false;
    this.flipTween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      delay,
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 1;
        if (p >= 0.5 && !swapped) {
          swapped = true;
          this.face.setTexture(key);
          this.sheen.setVisible(faceUp);
        }
        this.flipScaleX = Math.abs(Math.cos(p * Math.PI));
        this.flipScaleY = 1 + 0.05 * Math.sin(p * Math.PI);
        this.flipLift = 0.55 * Math.sin(p * Math.PI);
        if (swapped && faceUp) this.sheen.setAlpha(0.6 * (1 - (p - 0.5) * 2));
        this.applyLift();
      },
      onComplete: () => {
        this.flipTween = null;
        finish();
      },
    });
  }

  /** Petite secousse : « aucun coup possible pour cette carte ». */
  shake(amplitude: number, duration: number): void {
    if (this.shakeTween || this.flight) return;
    const baseX = this.targetX + this.metrics.cardW / 2;
    this.shakeTween = this.scene.tweens.add({
      targets: this,
      x: { from: baseX - amplitude, to: baseX + amplitude },
      duration: duration / 6,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.shakeTween = null;
        if (!this.flight) this.x = baseX;
      },
    });
  }

  /** Remet la carte dans son état normal (après l'animation de victoire). */
  resetAppearance(): void {
    this.setAngle(0).setScale(1).setAlpha(1);
    this.lift = 0;
    this.squash = 1;
    this.applyLift();
  }
}
