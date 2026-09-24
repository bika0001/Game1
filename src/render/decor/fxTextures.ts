import type Phaser from 'phaser';
import { canvasTexture } from '../cardart/textures';
import {
  drawBubble,
  drawCaustics,
  drawCloud,
  drawFish,
  drawGull,
  drawGullShadow,
  drawRipple,
  drawScallop,
  drawSeaweed,
  drawSparkle,
  drawStarfish,
  drawWaveBand,
  seeded,
} from './art';

/** Textures partagées des décors et des effets, dessinées à la densité de l'écran. */
export const FX = {
  bubble: 'fx-bubble',
  sparkle: 'fx-sparkle',
  sparkleGold: 'fx-sparkle-gold',
  ripple: 'fx-ripple',
  fish: 'fx-fish',
  gullShadow: 'fx-gull-shadow',
  seaweed: 'fx-seaweed',
  caustics: 'fx-caustics',
  cloud: (i: number): string => `fx-cloud-${i}`,
  waveBand: (i: number): string => `fx-wave-${i}`,
  gullUp: 'fx-gull-up',
  gullDown: 'fx-gull-down',
  confettiStar: 'fx-confetti-star',
  confettiShell: 'fx-confetti-shell',
  /** Planche de confettis (cadres : star, shell, dot, spark, ribbon). */
  confetti: 'fx-confetti',
  dot: 'fx-dot',
} as const;

export const CONFETTI_FRAMES = ['star', 'shell', 'dot', 'spark', 'ribbon'] as const;

let generatedFor = 0;
let causticsReady = false;

function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): void {
  const tex = canvasTexture(scene, key, Math.max(2, Math.round(w)), Math.max(2, Math.round(h)));
  draw(tex.context, tex.width, tex.height);
  tex.refresh();
}

/** Génère les textures d'effets si la densité a changé (ou au premier appel). */
export function ensureFxTextures(scene: Phaser.Scene, dpr: number): void {
  if (!causticsReady || !scene.textures.exists(FX.caustics)) {
    // Motif raccordable en puissance de deux (répétition par la carte graphique).
    paint(scene, FX.caustics, 512, 512, (ctx, w) => drawCaustics(ctx, w, 6, 7));
    causticsReady = true;
  }
  if (generatedFor === dpr && scene.textures.exists(FX.dot)) return;
  generatedFor = dpr;
  const d = dpr;
  paint(scene, FX.bubble, 16 * d, 16 * d, (ctx, w) => drawBubble(ctx, w));
  paint(scene, FX.sparkle, 26 * d, 26 * d, (ctx, w) => drawSparkle(ctx, w));
  paint(scene, FX.sparkleGold, 30 * d, 30 * d, (ctx, w) => drawSparkle(ctx, w, '255, 214, 120'));
  paint(scene, FX.ripple, 120 * d, 120 * d, (ctx, w, h) => drawRipple(ctx, w, h));
  paint(scene, FX.fish, 42 * d, 17 * d, (ctx, w, h) => drawFish(ctx, w, h));
  paint(scene, FX.gullShadow, 80 * d, 34 * d, (ctx, w, h) => drawGullShadow(ctx, w, h));
  const weedRnd = seeded(99);
  paint(scene, FX.seaweed, 60 * d, 90 * d, (ctx, w, h) => drawSeaweed(ctx, w, h, weedRnd));
  const cloudRnd = seeded(5);
  for (let i = 0; i < 3; i++) {
    paint(scene, FX.cloud(i), (150 + i * 30) * d, (60 + i * 8) * d, (ctx, w, h) =>
      drawCloud(ctx, w, h, cloudRnd),
    );
  }
  // Bandes de vagues : largeur en puissance de deux pour une répétition nette.
  const bands: Array<[string, string]> = [
    ['rgba(255,255,255,0.55)', 'rgba(63, 182, 192, 0.85)'],
    ['rgba(255,255,255,0.6)', 'rgba(42, 157, 143, 0.9)'],
    ['rgba(255,255,255,0.5)', 'rgba(24, 90, 120, 0.92)'],
  ];
  bands.forEach(([crest, body], i) => {
    paint(scene, FX.waveBand(i), 512, 128, (ctx, w, h) => drawWaveBand(ctx, w, h, crest, body));
  });
  paint(scene, FX.gullUp, 46 * d, 22 * d, (ctx, w, h) => drawGull(ctx, w, h, true));
  paint(scene, FX.gullDown, 46 * d, 22 * d, (ctx, w, h) => drawGull(ctx, w, h, false));
  paint(scene, FX.confettiStar, 18 * d, 18 * d, (ctx, w) =>
    drawStarfish(ctx, w / 2, w / 2, w * 0.4, 0, '#F28A5B'),
  );
  paint(scene, FX.confettiShell, 18 * d, 18 * d, (ctx, w) =>
    drawScallop(ctx, w / 2, w / 2, w * 0.4, 0, '#F8E3C8'),
  );
  paint(scene, FX.dot, 10 * d, 10 * d, (ctx, w) => {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(w / 2, w / 2, w / 2 - 0.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Confettis marins : une seule texture découpée en cadres (un seul émetteur).
  const cell = Math.round(20 * d);
  const sheet = canvasTexture(scene, FX.confetti, cell * CONFETTI_FRAMES.length, cell);
  const ctx = sheet.context;
  const c = cell / 2;
  drawStarfish(ctx, c, c, cell * 0.42, 0.3, '#F28A5B');
  drawScallop(ctx, cell + c, c, cell * 0.4, 0, '#FBE3CF');
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cell * 2 + c, c, cell * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cell * 3, 0);
  drawSparkle(ctx, cell, '255, 214, 120');
  ctx.restore();
  ctx.fillStyle = '#3FC1C9';
  ctx.fillRect(cell * 4 + cell * 0.3, cell * 0.12, cell * 0.4, cell * 0.76);
  sheet.refresh();
  CONFETTI_FRAMES.forEach((name, i) => {
    if (sheet.has(name)) sheet.remove(name);
    sheet.add(name, 0, i * cell, 0, cell, cell);
  });
}
