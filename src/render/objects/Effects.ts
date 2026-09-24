import Phaser from 'phaser';
import { CSS, FONTS, PALETTE } from '../../config/theme';
import { TEX } from '../cardart/textures';
import type { CardView } from './CardView';

/**
 * Victoire : les cartes s'envolent comme des mouettes, en arcs doux vers le
 * ciel, puis disparaissent. Court (≈ 2,5 s) et passable d'un tap.
 */
export function playWinAnimation(
  scene: Phaser.Scene,
  cards: readonly CardView[],
  speed: number,
  onDone: () => void,
): { skip: () => void } {
  const { width: W } = scene.scale;
  const tweens: Phaser.Tweens.Tween[] = [];
  let remaining = cards.length;
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    onDone();
  };
  const order = [...cards].sort((a, b) => (a.card % 13) - (b.card % 13) || a.card - b.card);
  order.forEach((view, i) => {
    const dir = i % 2 === 0 ? 1 : -1;
    const startX = view.x;
    const startY = view.y;
    const endX = W / 2 + dir * (W * 0.35 + ((i * 37) % 100) * W * 0.004);
    const endY = -view.cardH * (1 + (i % 5) * 0.4);
    const wobble = view.cardH * (0.15 + (i % 3) * 0.08);
    const duration = (1300 + (i % 7) * 90) / speed;
    view.setDepth(30_000 + i);
    const t = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      delay: (i * 34) / speed,
      ease: 'Sine.easeIn',
      onUpdate: (tw) => {
        const p = tw.getValue() ?? 0;
        view.x = startX + (endX - startX) * Phaser.Math.Easing.Sine.InOut(p);
        view.y = startY + (endY - startY) * p + Math.sin(p * Math.PI * 3) * wobble * (1 - p);
        view.angle = dir * 25 * Math.sin(p * Math.PI * 1.5);
        view.setScale(1 - 0.25 * p, 1 - 0.25 * p);
        view.setAlpha(1 - Math.max(0, p - 0.7) / 0.3);
      },
      onComplete: () => {
        remaining--;
        if (remaining === 0) finish();
      },
    });
    tweens.push(t);
  });
  if (cards.length === 0) finish();
  return {
    skip: () => {
      for (const t of tweens) t.complete();
      finish();
    },
  };
}

/** Remet une carte dans son état normal après l'animation de victoire. */
export function resetCardAppearance(view: CardView): void {
  view.setAngle(0);
  view.setScale(1, 1);
  view.setAlpha(1);
}

/** Message éphémère en pastille, au-dessus de la barre d'outils. */
export function showToast(scene: Phaser.Scene, text: string, y: number, unit: number): void {
  const label = scene.add
    .text(0, 0, text, {
      fontFamily: FONTS.ui,
      fontSize: `${Math.round(16 * unit)}px`,
      color: CSS.navy,
      fontStyle: '600',
      align: 'center',
      wordWrap: { width: scene.scale.width - 64 * unit },
    })
    .setOrigin(0.5, 0.5);
  const padX = 18 * unit;
  const padY = 11 * unit;
  const bg = scene.add.graphics();
  bg.fillStyle(PALETTE.foam, 0.97);
  bg.fillRoundedRect(
    -label.width / 2 - padX,
    -label.height / 2 - padY,
    label.width + padX * 2,
    label.height + padY * 2,
    22 * unit,
  );
  const toast = scene.add
    .container(scene.scale.width / 2, y, [bg, label])
    .setDepth(40_000)
    .setAlpha(0);
  scene.tweens.chain({
    targets: toast,
    tweens: [
      { alpha: 1, y: y - 8 * unit, duration: 180 },
      { alpha: 1, duration: 1900 },
      { alpha: 0, duration: 260 },
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
