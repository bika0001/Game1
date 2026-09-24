import { CARD, CSS } from '../../config/theme';
import { roundRectPath } from './faces';

type Ctx = CanvasRenderingContext2D;

/** Dos de cartes disponibles (les autres motifs arrivent avec le voyage, phase 2). */
export type CardBackId = 'waves';

function drawStar(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.18, -r * 0.18);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.18, -r * 0.18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.rotate(Math.PI / 4);
  ctx.globalAlpha = 0.6;
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.lineTo(r * 0.12, -r * 0.12);
    ctx.lineTo(0, 0);
    ctx.lineTo(-r * 0.12, -r * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Dos « vagues » : écailles de vagues turquoise sur bleu marine, rose des vents au centre. */
function drawWaves(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const radius = w * CARD.radius;
  const border = Math.max(1, Math.round(w * 0.014));
  roundRectPath(ctx, x + border / 2, y + border / 2, w - border, h - border, radius);
  ctx.fillStyle = CSS.navy;
  ctx.fill();
  ctx.lineWidth = border;
  ctx.strokeStyle = '#0B2440';
  ctx.stroke();

  const inset = w * 0.07;
  const ix = x + inset;
  const iy = y + inset;
  const iw = w - inset * 2;
  const ih = h - inset * 2;
  ctx.save();
  roundRectPath(ctx, ix, iy, iw, ih, radius * 0.6);
  ctx.clip();
  const r = w * 0.075;
  const row = r * 1.05;
  ctx.lineWidth = Math.max(1, w * 0.016);
  for (let j = 0, yy = iy - r; yy < iy + ih + r; j++, yy += row) {
    ctx.strokeStyle = j % 2 === 0 ? 'rgba(42, 157, 143, 0.75)' : 'rgba(120, 190, 200, 0.45)';
    const shift = j % 2 === 0 ? 0 : r;
    for (let xx = ix - r * 2 + shift; xx < ix + iw + r * 2; xx += r * 2) {
      ctx.beginPath();
      ctx.arc(xx, yy, r, 0.05 * Math.PI, 0.95 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();

  roundRectPath(ctx, ix, iy, iw, ih, radius * 0.6);
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.strokeStyle = CSS.sand;
  ctx.stroke();

  // Médaillon central.
  const mr = w * 0.2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h / 2, mr, 0, Math.PI * 2);
  ctx.fillStyle = CSS.navy;
  ctx.fill();
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.strokeStyle = CSS.sand;
  ctx.stroke();
  drawStar(ctx, x + w / 2, y + h / 2, mr * 0.82, CSS.sand);
}

export function drawCardBack(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  id: CardBackId = 'waves',
) {
  switch (id) {
    case 'waves':
      drawWaves(ctx, x, y, w, h);
  }
}
