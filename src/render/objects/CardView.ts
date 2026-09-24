import Phaser from 'phaser';
import { TEX, type CardMetrics } from '../cardart/textures';

/**
 * Une carte à l'écran. Les coordonnées manipulées sont celles du coin
 * haut-gauche de la carte (hors ombre) ; l'image est centrée pour pouvoir
 * se retourner autour de son axe vertical.
 */
export class CardView extends Phaser.GameObjects.Image {
  faceUp = false;
  /** Position cible (coin haut-gauche). */
  targetX = 0;
  targetY = 0;
  private moveTween: Phaser.Tweens.Tween | null = null;
  private flipTween: Phaser.Tweens.TweenChain | null = null;
  private shakeTween: Phaser.Tweens.Tween | null = null;

  constructor(
    scene: Phaser.Scene,
    readonly card: number,
    private metrics: CardMetrics,
  ) {
    super(scene, 0, 0, TEX.back);
    this.setOrigin(0.5, 0.5);
    scene.add.existing(this);
  }

  get cardW(): number {
    return this.metrics.cardW;
  }

  get cardH(): number {
    return this.metrics.cardH;
  }

  /** Coin haut-gauche actuel (pendant une animation, la position affichée). */
  get left(): number {
    return this.x - this.metrics.cardW / 2;
  }

  get top(): number {
    return this.y - this.metrics.cardH / 2;
  }

  setMetrics(metrics: CardMetrics): void {
    this.metrics = metrics;
    this.setTexture(this.faceUp ? TEX.face(this.card) : TEX.back);
  }

  /** Place la carte immédiatement (annule toute animation de déplacement). */
  placeAt(x: number, y: number): void {
    this.moveTween?.stop();
    this.moveTween = null;
    this.targetX = x;
    this.targetY = y;
    this.setPosition(x + this.metrics.cardW / 2, y + this.metrics.cardH / 2);
  }

  /** Suit le doigt pendant un glisser (sans modifier la cible). */
  dragTo(x: number, y: number): void {
    this.moveTween?.stop();
    this.moveTween = null;
    this.setPosition(x + this.metrics.cardW / 2, y + this.metrics.cardH / 2);
  }

  isMovingTo(x: number, y: number): boolean {
    return this.targetX === x && this.targetY === y;
  }

  moveTo(
    x: number,
    y: number,
    duration: number,
    delay = 0,
    onComplete?: () => void,
    ease = 'Cubic.easeOut',
  ): void {
    this.targetX = x;
    this.targetY = y;
    this.moveTween?.stop();
    const cx = x + this.metrics.cardW / 2;
    const cy = y + this.metrics.cardH / 2;
    if (duration <= 0) {
      this.setPosition(cx, cy);
      this.moveTween = null;
      onComplete?.();
      return;
    }
    this.moveTween = this.scene.tweens.add({
      targets: this,
      x: cx,
      y: cy,
      duration,
      delay,
      ease,
      onComplete: () => {
        this.moveTween = null;
        onComplete?.();
      },
    });
  }

  get isMoving(): boolean {
    return this.moveTween !== null;
  }

  setFace(faceUp: boolean, duration = 0, delay = 0): void {
    if (faceUp === this.faceUp && !this.flipTween) return;
    this.faceUp = faceUp;
    this.flipTween?.stop();
    this.flipTween = null;
    const key = faceUp ? TEX.face(this.card) : TEX.back;
    if (duration <= 0) {
      this.scaleX = 1;
      this.setTexture(key);
      return;
    }
    this.flipTween = this.scene.tweens.chain({
      targets: this,
      tweens: [
        {
          scaleX: 0,
          duration: duration / 2,
          delay,
          ease: 'Sine.easeIn',
          onComplete: () => this.setTexture(key),
        },
        { scaleX: 1, duration: duration / 2, ease: 'Sine.easeOut' },
      ],
      onComplete: () => {
        this.flipTween = null;
      },
    });
  }

  /** Petite secousse : « aucun coup possible pour cette carte ». */
  shake(amplitude: number, duration: number): void {
    if (this.shakeTween) return;
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
        if (!this.moveTween) this.x = this.targetX + this.metrics.cardW / 2;
      },
    });
  }
}
