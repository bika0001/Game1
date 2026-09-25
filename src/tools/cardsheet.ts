/**
 * Outil de développement (non inclus dans le build) : planche des 52 faces et
 * du dos, pour juger l'art des cartes. Ouvrir /cardsheet.html?w=160 avec `npm run dev`.
 */
import { drawCardBack } from '../render/cardart/backs';
import { RANK_LABELS } from '../core/cards';
import { drawCardFace } from '../render/cardart/faces';

const params = new URLSearchParams(location.search);
const w = Number(params.get('w') ?? 160);
const h = Math.round(w * 1.4);
const gap = Math.round(w * 0.12);
const facesOnly = params.get('only') === 'faces';
const ranks = facesOnly ? [10, 11, 12] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const cols = ranks.length;
const rows = 5;
const canvas = document.getElementById('sheet') as HTMLCanvasElement;
canvas.width = cols * (w + gap) + gap;
canvas.height = rows * (h + gap) + gap;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
ctx.fillStyle = '#0f5260';
ctx.fillRect(0, 0, canvas.width, canvas.height);
const style = { rankLabels: RANK_LABELS };
for (let suit = 0; suit < 4; suit++) {
  ranks.forEach((r, i) => {
    drawCardFace(ctx, r * 4 + suit, gap + i * (w + gap), gap + suit * (h + gap), w, h, style);
  });
}
drawCardBack(ctx, gap, gap + 4 * (h + gap), w, h, 'waves');
document.title += ' ✓';
