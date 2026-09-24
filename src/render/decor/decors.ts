import Phaser from 'phaser';
import type { DecorId } from '../../core/settings';
import { canvasTexture } from '../cardart/textures';
import { drawTable } from '../cardart/table';
import type { QualityLevel } from '../quality';
import { drawLagoonFloor, drawSeascape, seascapeGeometry } from './art';
import { ensureFxTextures, FX } from './fxTextures';

/**
 * Décors animés, toujours derrière les cartes (profondeur négative) et
 * adaptés à la qualité courante : l'ambiance s'allège si l'appareil peine.
 */

export interface DecorEnv {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** Ligne où reposent les objets du fond (juste au-dessus de la barre d'outils). */
  readonly floorBottom: number;
}

export interface Decor {
  build(env: DecorEnv): void;
  update(time: number, delta: number): void;
  setQuality(level: QualityLevel): void;
  destroy(): void;
}

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

const LAGOON_KEY = 'decor-lagoon';
const CLASSIC_KEY = 'decor-classic';
const painted = new Map<string, string>();

/** Dessine une texture plein écran, sauf si elle l'est déjà pour ces dimensions. */
function paintOnce(
  scene: Phaser.Scene,
  key: string,
  signature: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (painted.get(key) === signature && scene.textures.exists(key)) return;
  const tex = canvasTexture(scene, key, w, h);
  draw(tex.context);
  tex.refresh();
  painted.set(key, signature);
}

/**
 * Prépare le fond du décor (le plus coûteux à dessiner). Appelé aussi depuis le
 * menu, pour que la partie démarre sans attendre.
 */
export function prepareDecorTexture(scene: Phaser.Scene, id: DecorId, env: DecorEnv): string {
  const { width: W, height: H, dpr, floorBottom } = env;
  if (id === 'classic') {
    paintOnce(scene, CLASSIC_KEY, `${W}x${H}`, W, H, (ctx) => drawTable(ctx, W, H));
    return CLASSIC_KEY;
  }
  paintOnce(scene, LAGOON_KEY, `${W}x${H}|${dpr}|${Math.round(floorBottom)}`, W, H, (ctx) =>
    drawLagoonFloor(ctx, { width: W, height: H, dpr, floorBottom }),
  );
  return LAGOON_KEY;
}

/** Base commune : suivi des objets et minuteries créés, pour tout détruire proprement. */
abstract class BaseDecor<E extends DecorEnv> {
  protected objects: Phaser.GameObjects.GameObject[] = [];
  protected readonly timers = new Map<string, Phaser.Time.TimerEvent>();
  protected level: QualityLevel = 2;
  protected env: E | null = null;

  constructor(protected readonly scene: Phaser.Scene) {}

  protected track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    return obj;
  }

  protected untrack(obj: Phaser.GameObjects.GameObject): void {
    this.objects = this.objects.filter((o) => o !== obj);
    obj.destroy();
  }

  /** Répète une animation d'ambiance à intervalles irréguliers (une seule minuterie par nom). */
  protected every(name: string, first: number, min: number, max: number, fn: () => void): void {
    const plan = (delay: number): void => {
      this.timers.set(
        name,
        this.scene.time.delayedCall(delay, () => {
          if (this.level > 0) fn();
          plan(Phaser.Math.Between(min, max) * (this.level === 1 ? 1.6 : 1));
        }),
      );
    };
    plan(first);
  }

  protected clear(): void {
    for (const t of this.timers.values()) t.remove(false);
    this.timers.clear();
    for (const o of this.objects) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objects = [];
  }

  abstract build(env: E): void;
  update(_time: number, _delta: number): void {}
  setQuality(level: QualityLevel): void {
    this.level = level;
  }
  destroy(): void {
    this.clear();
    this.env = null;
  }
}

// ---------------------------------------------------------------------------
// Lagon : eau turquoise sur sable, caustiques, poissons, bulles, reflets
// ---------------------------------------------------------------------------

export class LagoonDecor extends BaseDecor<DecorEnv> implements Decor {
  private causticsA: Phaser.GameObjects.TileSprite | null = null;
  private causticsB: Phaser.GameObjects.TileSprite | null = null;
  private bubbles: Emitter[] = [];
  private glints: Emitter | null = null;
  private weeds: Phaser.GameObjects.Image[] = [];

  build(env: DecorEnv): void {
    this.clear();
    this.env = env;
    const { scene } = this;
    const { width: W, height: H, dpr, floorBottom: fb } = env;
    const u = Math.min(W, H) / 100;
    ensureFxTextures(scene, dpr);

    const floor = prepareDecorTexture(scene, 'lagoon', env);
    this.track(scene.add.image(0, 0, floor).setOrigin(0, 0).setDepth(-100));

    // Algues qui ondulent près des coraux.
    const weedSpots: Array<[number, number, number]> = [
      [W * 0.12, fb + u * 2.5, 1.05],
      [W * 0.93, fb + u * 1.5, 0.8],
    ];
    this.weeds = weedSpots.map(([x, y, s], i) => {
      const weed = this.track(
        scene.add.image(x, y, FX.seaweed).setOrigin(0.5, 1).setScale(s).setDepth(-85),
      );
      weed.setAlpha(0.85);
      scene.tweens.add({
        targets: weed,
        angle: { from: -5, to: 5 },
        scaleY: { from: s, to: s * 1.04 },
        duration: 2600 + i * 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      return weed;
    });

    // Caustiques : deux calques qui dérivent en sens opposés et se superposent.
    const scale = dpr * 1.05;
    this.causticsA = this.track(
      scene.add
        .tileSprite(0, 0, W, H, FX.caustics)
        .setOrigin(0, 0)
        .setDepth(-90)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.17)
        .setTileScale(scale, scale),
    );
    this.causticsB = this.track(
      scene.add
        .tileSprite(0, 0, W, H, FX.caustics)
        .setOrigin(0, 0)
        .setDepth(-89)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.11)
        .setTileScale(scale * 1.45, scale * 1.45),
    );

    // Bulles qui montent des coraux et de l'étoile de mer.
    const sources: Array<[number, number]> = [
      [W * 0.03, W * 0.2],
      [W * 0.8, W * 0.95],
    ];
    this.bubbles = sources.map(([x0, x1], i) => {
      const emitter = scene.add.particles(0, 0, FX.bubble, {
        x: { min: x0, max: x1 },
        y: { min: fb - u * 8, max: fb },
        lifespan: { min: 1600, max: 2800 },
        speedY: { min: -24 * dpr, max: -9 * dpr },
        speedX: { min: -5 * dpr, max: 5 * dpr },
        scale: { start: 0.35, end: 1.05 },
        alpha: { start: 0.8, end: 0 },
        frequency: 650 + i * 200,
        quantity: 1,
      });
      emitter.setDepth(-75);
      return this.track(emitter);
    });

    // Reflets du soleil qui scintillent à la surface.
    const glints = scene.add.particles(0, 0, FX.sparkle, {
      x: { min: 0, max: W },
      y: { min: 0, max: H },
      lifespan: { min: 600, max: 1100 },
      scale: { start: 0.75, end: 0 },
      alpha: { start: 0.9, end: 0 },
      frequency: 240,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
    });
    glints.setDepth(-65);
    this.glints = this.track(glints);

    this.every('fish', 3000, 8000, 16000, () => this.swimSchool());
    this.every('gull', 11000, 20000, 38000, () => this.glideGull());
    this.applyQuality();
  }

  /** Un petit banc de poissons (silhouettes) traverse l'écran. */
  private swimSchool(): void {
    const env = this.env;
    if (!env) return;
    const { width: W, height: H, dpr } = env;
    const leftToRight = Math.random() < 0.5;
    const baseY = H * (0.25 + Math.random() * 0.55);
    const count = 3 + Math.floor(Math.random() * 3);
    const speed = (38 + Math.random() * 24) * dpr;
    const span = W + 200 * dpr;
    const duration = (span / speed) * 1000;
    for (let i = 0; i < count; i++) {
      const fish = this.track(
        this.scene.add
          .image(-500, -500, FX.fish)
          .setDepth(-80)
          .setAlpha(0.28)
          .setFlipX(!leftToRight)
          .setScale(0.8 + Math.random() * 0.4),
      );
      const offX = (i % 2) * 26 * dpr + i * 16 * dpr;
      const offY = (i - count / 2) * 15 * dpr;
      const phase = Math.random() * Math.PI * 2;
      const baseScale = fish.scaleX;
      this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        delay: i * 140,
        onUpdate: (tw) => {
          const p = tw.getValue() ?? 0;
          const x = leftToRight ? -100 * dpr - offX + p * span : W + 100 * dpr + offX - p * span;
          fish.setPosition(x, baseY + offY + Math.sin(p * 9 + phase) * 10 * dpr);
          // Petit frétillement de la queue.
          fish.scaleY = baseScale * (1 + 0.1 * Math.sin(p * 140 + phase));
        },
        onComplete: () => this.untrack(fish),
      });
    }
  }

  /** L'ombre d'une mouette glisse sur le lagon. */
  private glideGull(): void {
    const env = this.env;
    if (!env) return;
    const { width: W, height: H, dpr } = env;
    const gull = this.track(
      this.scene.add
        .image(-90 * dpr, H * (0.12 + Math.random() * 0.4), FX.gullShadow)
        .setDepth(-70)
        .setAlpha(0.15)
        .setAngle(12),
    );
    this.scene.tweens.add({
      targets: gull,
      x: W + 90 * dpr,
      y: gull.y + H * 0.25,
      duration: 7500,
      ease: 'Linear',
      onComplete: () => this.untrack(gull),
    });
    this.scene.tweens.add({
      targets: gull,
      scaleX: { from: 1, to: 0.82 },
      duration: 420,
      yoyo: true,
      repeat: 8,
      ease: 'Sine.easeInOut',
    });
  }

  override update(time: number, _delta = 0): void {
    if (this.causticsA?.visible) {
      this.causticsA.tilePositionX = time * 0.011;
      this.causticsA.tilePositionY = time * 0.006;
    }
    if (this.causticsB?.visible) {
      this.causticsB.tilePositionX = -time * 0.007;
      this.causticsB.tilePositionY = time * 0.009;
    }
  }

  override setQuality(level: QualityLevel): void {
    super.setQuality(level);
    this.applyQuality();
  }

  private applyQuality(): void {
    const l = this.level;
    this.causticsA?.setVisible(l >= 1);
    this.causticsB?.setVisible(l >= 2);
    if (this.glints) {
      if (l >= 2) this.glints.start();
      else this.glints.stop();
    }
    for (const b of this.bubbles) {
      if (l >= 1) b.start();
      else b.stop();
    }
    for (const w of this.weeds) {
      for (const t of this.scene.tweens.getTweensOf(w)) {
        if (l >= 1) t.resume();
        else t.pause();
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Classique : tapis bleu-vert uni (pour qui préfère la sobriété)
// ---------------------------------------------------------------------------

export class ClassicDecor extends BaseDecor<DecorEnv> implements Decor {
  build(env: DecorEnv): void {
    this.clear();
    this.env = env;
    ensureFxTextures(this.scene, env.dpr);
    const key = prepareDecorTexture(this.scene, 'classic', env);
    this.track(this.scene.add.image(0, 0, key).setOrigin(0, 0).setDepth(-100));
  }
}

export function createDecor(scene: Phaser.Scene, id: DecorId): Decor {
  return id === 'classic' ? new ClassicDecor(scene) : new LagoonDecor(scene);
}

// ---------------------------------------------------------------------------
// Marine du menu : ciel, soleil, île, vagues, nuages, mouettes
// ---------------------------------------------------------------------------

export interface SeascapeEnv extends DecorEnv {
  /** Ligne d'horizon. */
  readonly horizon: number;
}

export class SeascapeDecor extends BaseDecor<SeascapeEnv> {
  private bands: Array<{ sprite: Phaser.GameObjects.TileSprite; speed: number }> = [];
  private gulls: Array<{ img: Phaser.GameObjects.Image; flap: number }> = [];

  build(env: SeascapeEnv): void {
    this.clear();
    this.env = env;
    this.bands = [];
    this.gulls = [];
    const { scene } = this;
    const { width: W, height: H, dpr, horizon } = env;
    ensureFxTextures(scene, dpr);
    const geo = seascapeGeometry(W, H, horizon);

    const bg = canvasTexture(scene, 'decor-seascape', W, H);
    drawSeascape(bg.context, W, H, horizon);
    bg.refresh();
    this.track(scene.add.image(0, 0, 'decor-seascape').setOrigin(0, 0).setDepth(-100));

    // Nuages qui dérivent lentement (en boucle).
    for (let i = 0; i < 3; i++) {
      const cloud = this.track(
        scene.add
          .image(0, horizon * (0.52 + i * 0.13), FX.cloud(i))
          .setDepth(-95)
          .setScale(1.15 - i * 0.2)
          .setAlpha(0.96),
      );
      const travel = W + cloud.width * 2;
      const start = (0.15 + i * 0.33) % 1;
      scene.tweens.addCounter({
        from: start,
        to: start + 1,
        duration: 80000 + i * 17000,
        repeat: -1,
        onUpdate: (tw) => {
          cloud.x = -cloud.width + ((tw.getValue() ?? 0) % 1) * travel;
        },
      });
    }

    // Phare qui clignote.
    const beacon = this.track(
      scene.add
        .image(geo.lamp.x, geo.lamp.y, FX.sparkleGold)
        .setDepth(-94)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale((geo.lamp.size * 1.8) / (30 * dpr)),
    );
    scene.tweens.add({
      targets: beacon,
      alpha: { from: 0.1, to: 1 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      hold: 300,
      repeatDelay: 1200,
    });

    // Bandes de vagues en parallaxe (de plus en plus proches et rapides).
    const seaH = H - horizon;
    [0, 1, 2].forEach((i) => {
      const bandH = Math.max(28 * dpr, seaH * (0.1 + i * 0.035));
      const y = horizon + seaH * (0.04 + i * 0.2);
      const sprite = this.track(
        scene.add
          .tileSprite(0, y, W, bandH, FX.waveBand(i))
          .setOrigin(0, 0)
          .setDepth(-90 + i)
          .setTileScale(bandH / 128, bandH / 128),
      );
      this.bands.push({ sprite, speed: (0.6 + i * 0.5) * (i % 2 === 0 ? 1 : -1) * dpr });
      scene.tweens.add({
        targets: sprite,
        y: y + (3 + i * 2) * dpr,
        duration: 1800 + i * 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    });

    // Scintillement du soleil sur l'eau.
    const glints = scene.add.particles(0, 0, FX.sparkle, {
      x: { min: geo.sun.x - geo.sun.r * 2.5, max: geo.sun.x + geo.sun.r * 2.5 },
      y: { min: horizon + 4 * dpr, max: horizon + seaH * 0.5 },
      lifespan: { min: 500, max: 900 },
      scale: { start: 0.85, end: 0 },
      alpha: { start: 1, end: 0 },
      frequency: 120,
      blendMode: Phaser.BlendModes.ADD,
    });
    glints.setDepth(-80);
    this.track(glints);

    // Deux mouettes qui battent des ailes en traversant le ciel.
    for (let i = 0; i < 2; i++) {
      const img = this.track(
        scene.add
          .image(-60 * dpr, horizon * (0.3 + i * 0.25), FX.gullUp)
          .setDepth(-85)
          .setScale(1 - i * 0.25),
      );
      this.gulls.push({ img, flap: i * 90 });
      const fly = (): void => {
        img.setPosition(-60 * dpr, horizon * (0.15 + Math.random() * 0.5));
        scene.tweens.add({
          targets: img,
          x: W + 60 * dpr,
          y: img.y + (Math.random() - 0.5) * horizon * 0.2,
          duration: 14000 + Math.random() * 6000,
          delay: i * 4000 + Math.random() * 5000,
          onComplete: fly,
        });
      };
      fly();
    }
  }

  override update(time: number, _delta = 0): void {
    if (this.level === 0) return;
    for (const b of this.bands) b.sprite.tilePositionX = (time / 16) * b.speed;
    for (const g of this.gulls) {
      g.img.setTexture(Math.floor((time + g.flap) / 170) % 2 === 0 ? FX.gullUp : FX.gullDown);
    }
  }
}
