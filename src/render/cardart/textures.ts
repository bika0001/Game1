import Phaser from 'phaser';
import { CARD } from '../../config/theme';
import { DECK_SIZE } from '../../core/cards';
import { drawCardBack, type CardBackId } from './backs';
import { drawCardFace, roundRectPath, type FaceStyle } from './faces';
import { drawGlow, drawSlot, type SlotIcon } from './table';

/**
 * Textures des cartes, générées en code à la taille exacte d'affichage
 * (pixels physiques) pour une netteté parfaite, et redessinées quand la
 * mise en page change (rotation, redimensionnement, langue).
 *
 * L'ombre n'est plus « cuite » dans les faces : c'est une texture floue à
 * part, que chaque carte déplace et agrandit quand elle se soulève.
 */

export const TEX = {
  face: (card: number): string => `face-${card}`,
  back: 'card-back',
  shadow: 'card-shadow',
  sheen: 'card-sheen',
  slot: (icon: SlotIcon): string => `slot-${icon}`,
  glow: 'card-glow',
} as const;

const SLOT_ICONS: readonly SlotIcon[] = ['none', 'ace', 'king', 'recycle', 'empty'];

export interface CardMetrics {
  readonly cardW: number;
  readonly cardH: number;
  /** Marge transparente autour de la face (anticrénelage des bords). */
  readonly margin: number;
  readonly texW: number;
  readonly texH: number;
}

export interface CardArtStyle extends FaceStyle {
  readonly back: CardBackId;
  readonly aceLabel: string;
}

export function canvasTexture(
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

/** Ombre douce : on dessine la carte hors du canevas et on ne garde que son ombre. */
function drawShadow(ctx: CanvasRenderingContext2D, w: number, h: number, sm: number): void {
  const away = (w + sm * 2) * 3;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 30, 40, 0.62)';
  ctx.shadowBlur = sm * 0.9;
  ctx.shadowOffsetX = away;
  roundRectPath(ctx, sm - away, sm, w, h, w * CARD.radius);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

/** Reflet diagonal (éclat furtif pendant un retournement). */
function drawSheen(ctx: CanvasRenderingContext2D, m: number, w: number, h: number): void {
  ctx.save();
  roundRectPath(ctx, m, m, w, h, w * CARD.radius);
  ctx.clip();
  const g = ctx.createLinearGradient(m, m, m + w, m + h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.38, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.62, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(m, m, w, h);
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
  const margin = 2;
  const texW = w + margin * 2;
  const texH = h + margin * 2;
  const metrics: CardMetrics = { cardW: w, cardH: h, margin, texW, texH };
  const signature = `${w}x${h}|${style.rankLabels.join('')}|${style.back}|${style.aceLabel}`;
  if (signature === lastSignature && scene.textures.exists(TEX.back)) return metrics;
  lastSignature = signature;

  for (let card = 0; card < DECK_SIZE; card++) {
    const tex = canvasTexture(scene, TEX.face(card), texW, texH);
    drawCardFace(tex.context, card, margin, margin, w, h, style);
    tex.refresh();
  }

  const back = canvasTexture(scene, TEX.back, texW, texH);
  drawCardBack(back.context, margin, margin, w, h, style.back);
  back.refresh();

  const sm = Math.max(4, Math.round(w * 0.16));
  const shadow = canvasTexture(scene, TEX.shadow, w + sm * 2, h + sm * 2);
  drawShadow(shadow.context, w, h, sm);
  shadow.refresh();

  const sheen = canvasTexture(scene, TEX.sheen, texW, texH);
  drawSheen(sheen.context, margin, w, h);
  sheen.refresh();

  const slotMargin = Math.max(2, Math.round(w * 0.06));
  for (const icon of SLOT_ICONS) {
    const slot = canvasTexture(scene, TEX.slot(icon), w + slotMargin * 2, h + slotMargin * 2);
    drawSlot(slot.context, slotMargin, slotMargin, w, h, icon, { ace: style.aceLabel });
    slot.refresh();
  }

  const glowMargin = Math.round(w * 0.1);
  const glow = canvasTexture(scene, TEX.glow, w + glowMargin * 2, h + glowMargin * 2);
  drawGlow(glow.context, w + glowMargin * 2, h + glowMargin * 2, glowMargin);
  glow.refresh();

  return metrics;
}
