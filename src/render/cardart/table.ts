import { CARD, CSS } from '../../config/theme';
import { roundRectPath } from './faces';

type Ctx = CanvasRenderingContext2D;

/** Tapis bleu-vert profond, léger dégradé, grain discret et lignes de houle à peine visibles. */
export function drawTable(ctx: Ctx, w: number, h: number): void {
  const grad = ctx.createRadialGradient(
    w / 2,
    h * 0.38,
    0,
    w / 2,
    h * 0.45,
    Math.hypot(w, h) * 0.62,
  );
  grad.addColorStop(0, '#166B77');
  grad.addColorStop(0.55, '#0F5260');
  grad.addColorStop(1, '#0A3642');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Houle : longues courbes très pâles.
  ctx.lineWidth = Math.max(1, w * 0.0025);
  for (let i = 0; i < 14; i++) {
    const y0 = (h / 14) * i + h * 0.03;
    ctx.beginPath();
    for (let x = 0; x <= w; x += w / 60) {
      const y = y0 + Math.sin((x / w) * Math.PI * 2 * 1.5 + i * 0.9) * h * 0.012;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${i % 2 === 0 ? 0.03 : 0.018})`;
    ctx.stroke();
  }

  // Grain (déterministe, pour un rendu stable).
  const image = ctx.getImageData(0, 0, w, h);
  const data = image.data;
  let seed = 12345;
  for (let i = 0; i < data.length; i += 4) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const n = ((seed >> 16) & 15) - 7;
    data[i] = (data[i] as number) + n;
    data[i + 1] = (data[i + 1] as number) + n;
    data[i + 2] = (data[i + 2] as number) + n;
  }
  ctx.putImageData(image, 0, 0);
}

export type SlotIcon = 'none' | 'ace' | 'king' | 'recycle' | 'empty';

/** Emplacement vide : verre dépoli, contour clair et pictogramme lisible sur tous les décors. */
export function drawSlot(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  icon: SlotIcon,
  labels: { ace: string },
) {
  const radius = w * CARD.radius;
  const line = Math.max(1, Math.round(w * 0.028));
  roundRectPath(ctx, x + line / 2, y + line / 2, w - line, h - line, radius);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fill();
  ctx.lineWidth = line;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.62)';
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = Math.max(1, w * 0.045);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (icon) {
    case 'ace': {
      ctx.font = `600 ${h * 0.36}px Fredoka, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels.ace, cx, cy + h * 0.02);
      break;
    }
    case 'king': {
      // Couronne : seul un Roi peut venir ici.
      const s = w * 0.42;
      ctx.beginPath();
      ctx.moveTo(cx - s / 2, cy + s * 0.3);
      ctx.lineTo(cx - s / 2, cy - s * 0.25);
      ctx.lineTo(cx - s / 4, cy);
      ctx.lineTo(cx, cy - s * 0.38);
      ctx.lineTo(cx + s / 4, cy);
      ctx.lineTo(cx + s / 2, cy - s * 0.25);
      ctx.lineTo(cx + s / 2, cy + s * 0.3);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'recycle': {
      const r = w * 0.22;
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI * 0.35, Math.PI * 1.35);
      ctx.stroke();
      const ax = cx + Math.cos(-Math.PI * 0.35) * r;
      const ay = cy + Math.sin(-Math.PI * 0.35) * r;
      ctx.beginPath();
      ctx.moveTo(ax + r * 0.45, ay - r * 0.05);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax + r * 0.05, ay + r * 0.5);
      ctx.stroke();
      break;
    }
    case 'empty': {
      const r = w * 0.16;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r);
      ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r);
      ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
      break;
    }
    case 'none':
      break;
  }
  ctx.restore();
}

/** Halo doré utilisé pour les indices et la cible d'un glisser-déposer. */
export function drawGlow(ctx: Ctx, w: number, h: number, margin: number): void {
  const radius = (w - margin * 2) * CARD.radius;
  ctx.save();
  ctx.shadowColor = 'rgba(255, 209, 102, 0.95)';
  ctx.shadowBlur = margin * 0.9;
  ctx.lineWidth = Math.max(2, margin * 0.35);
  ctx.strokeStyle = 'rgba(255, 214, 120, 1)';
  roundRectPath(ctx, margin, margin, w - margin * 2, h - margin * 2, radius);
  ctx.stroke();
  ctx.restore();
  void CSS;
}
