import Phaser from 'phaser';
import { DECK_SIZE } from '../../core/cards';
import { drawCardBack, type CardBackId } from './backs';
import { drawCardFace, type FaceStyle } from './faces';
import { drawGlow, drawSlot, type SlotIcon } from './table';

/**
 * Textures des cartes, générées en code à la taille exacte d'affichage
 * (pixels physiques) pour une netteté parfaite, et redessinées quand la
 * mise en page change (rotation, redimensionnement, langue).
 */

export const TEX = {
  face: (card: number): string => `face-${card}`,
  back: 'card-back',
  slot: (icon: SlotIcon): string => `slot-${icon}`,
  glow: 'card-glow',
  table: 'table',
} as const;

const SLOT_ICONS: readonly SlotIcon[] = ['none', 'ace', 'king', 'recycle', 'empty'];

export interface CardMetrics {
  readonly cardW: number;
  readonly cardH: number;
  /** Marge transparente autour de la carte (ombre portée). */
  readonly margin: number;
  readonly texW: number;
  readonly texH: number;
}

export interface CardArtStyle extends FaceStyle {
  readonly back: CardBackId;
  readonly aceLabel: string;
}

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
): Phaser.Textures.CanvasTexture {
  const existing = scene.textures.exists(key) ? scene.textures.get(key) : null;
  if (existing instanceof Phaser.Textures.CanvasTexture) {
    existing.setSize(w, h);
    existing.context.clearRect(0, 0, w, h);
    return existing;
  }
  if (existing) scene.textures.remove(key);
  const created = scene.textures.createCanvas(key, w, h);
  if (!created) throw new Error(`Impossible de créer la texture ${key}.`);
  return created;
}

function withShadow(
  ctx: CanvasRenderingContext2D,
  m: number,
  cardW: number,
  draw: () => void,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(0, 20, 28, 0.32)';
  ctx.shadowBlur = m * 0.9;
  ctx.shadowOffsetY = Math.max(1, cardW * 0.018);
  draw();
  ctx.restore();
}

let lastSignature = '';

/** Génère (ou régénère) toutes les textures de cartes. Renvoie les dimensions utilisées. */
export function generateCardTextures(
  scene: Phaser.Scene,
  cardW: number,
  cardH: number,
  style: CardArtStyle,
): CardMetrics {
  const w = Math.max(8, Math.round(cardW));
  const h = Math.max(12, Math.round(cardH));
  const margin = Math.max(2, Math.round(w * 0.06));
  const texW = w + margin * 2;
  const texH = h + margin * 2;
  const metrics: CardMetrics = { cardW: w, cardH: h, margin, texW, texH };
  const signature = `${w}x${h}|${style.rankLabels.join('')}|${style.back}|${style.aceLabel}`;
  if (signature === lastSignature && scene.textures.exists(TEX.back)) return metrics;
  lastSignature = signature;

  for (let card = 0; card < DECK_SIZE; card++) {
    const tex = canvasTexture(scene, TEX.face(card), texW, texH);
    const ctx = tex.context;
    // Ombre dessinée séparément (silhouette), puis la face nette par-dessus.
    withShadow(ctx, margin, w, () => {
      ctx.beginPath();
      ctx.roundRect(margin + 1, margin + 1, w - 2, h - 2, w * 0.085);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    });
    drawCardFace(ctx, card, margin, margin, w, h, style);
    tex.refresh();
  }

  const back = canvasTexture(scene, TEX.back, texW, texH);
  withShadow(back.context, margin, w, () => {
    back.context.beginPath();
    back.context.roundRect(margin + 1, margin + 1, w - 2, h - 2, w * 0.085);
    back.context.fillStyle = '#12355B';
    back.context.fill();
  });
  drawCardBack(back.context, margin, margin, w, h, style.back);
  back.refresh();

  for (const icon of SLOT_ICONS) {
    const slot = canvasTexture(scene, TEX.slot(icon), texW, texH);
    drawSlot(slot.context, margin, margin, w, h, icon, { ace: style.aceLabel });
    slot.refresh();
  }

  const glowMargin = Math.round(margin * 1.6);
  const glow = canvasTexture(scene, TEX.glow, w + glowMargin * 2, h + glowMargin * 2);
  drawGlow(glow.context, w + glowMargin * 2, h + glowMargin * 2, glowMargin);
  glow.refresh();

  return metrics;
}
