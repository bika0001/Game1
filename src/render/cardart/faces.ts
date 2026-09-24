import { CARD, CSS, FONTS } from '../../config/theme';
import { rankOf, suitOf, type Card } from '../../core/cards';
import { drawFigure } from './figures';
import { drawSuit } from './suits';

type Ctx = CanvasRenderingContext2D;

export interface FaceStyle {
  /** Libellés des 13 rangs (A … R en français). */
  readonly rankLabels: readonly string[];
}

export function suitColor(suit: number): string {
  return (suit & 1) === 1 ? CSS.cardRed : CSS.cardBlack;
}

/** Tracé d'un rectangle arrondi aligné sur les pixels. */
export function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawRankText(
  ctx: Ctx,
  label: string,
  x: number,
  baseline: number,
  size: number,
  maxW: number,
) {
  ctx.font = `700 ${size}px ${FONTS.card}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const width = ctx.measureText(label).width;
  if (width > maxW) {
    ctx.save();
    ctx.translate(x, baseline);
    ctx.scale(maxW / width, 1);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(label, x, baseline);
  }
}

function drawCompassRose(ctx: Ctx, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 8; i++) {
    const long = i % 2 === 0;
    const len = long ? r : r * 0.62;
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.lineTo(len * 0.16, 0);
    ctx.lineTo(0, len * 0.12);
    ctx.lineTo(-len * 0.16, 0);
    ctx.closePath();
    ctx.fillStyle = long ? 'rgba(42, 157, 143, 0.35)' : 'rgba(233, 216, 166, 0.7)';
    ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(42, 157, 143, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.stroke();
  ctx.restore();
}

/**
 * Dessine la face d'une carte dans un rectangle (x, y, w, h).
 * L'index (rang à gauche, enseigne à droite) est grand et placé tout en haut,
 * pour rester lisible quand les cartes se chevauchent au tableau.
 */
export function drawCardFace(
  ctx: Ctx,
  card: Card,
  x: number,
  y: number,
  w: number,
  h: number,
  style: FaceStyle,
) {
  const rank = rankOf(card);
  const suit = suitOf(card);
  const color = suitColor(suit);
  const radius = w * CARD.radius;
  const border = Math.max(1, Math.round(w * 0.014));

  ctx.save();
  roundRectPath(ctx, x + border / 2, y + border / 2, w - border, h - border, radius);
  const bg = ctx.createLinearGradient(0, y, 0, y + h);
  bg.addColorStop(0, '#FFFFFF');
  bg.addColorStop(1, '#F3F0E6');
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.lineWidth = border;
  ctx.strokeStyle = CSS.cardBorder;
  ctx.stroke();
  ctx.restore();

  // Index du haut.
  const pad = w * 0.075;
  const top = h * 0.028;
  const fontSize = h * 0.235;
  const capH = fontSize * 0.72;
  const label = style.rankLabels[rank - 1] ?? '?';
  ctx.fillStyle = color;
  drawRankText(ctx, label, x + pad, y + top + capH, fontSize, w * 0.5);
  const suitSize = capH * 1.05;
  drawSuit(ctx, suit, x + w - pad - suitSize * 0.42, y + top + capH / 2, suitSize, color);

  // Illustration centrale.
  if (rank >= 11) {
    drawFigure(ctx, rank as 11 | 12 | 13, suit, x + w * 0.11, y + h * 0.25, w * 0.78, h * 0.69);
    return;
  }
  const cx = x + w / 2;
  const cy = y + h * 0.61;
  if (rank === 1) {
    if (suit === 0) drawCompassRose(ctx, cx, cy, h * 0.3);
    drawSuit(ctx, suit, cx, cy, h * 0.4, color);
  } else {
    drawSuit(ctx, suit, cx, cy, h * 0.36, color);
  }

  // Petit index renversé en bas à droite, comme sur un jeu classique.
  ctx.save();
  ctx.translate(x + w - pad, y + h - top);
  ctx.rotate(Math.PI);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  drawRankText(ctx, label, 0, fontSize * 0.5 * 0.72, fontSize * 0.5, w * 0.3);
  ctx.restore();
}
