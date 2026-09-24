import type Phaser from 'phaser';
import { PALETTE } from '../../config/theme';

/** Petit voilier stylisé (logo du jeu), dessiné en vecteurs autour de (0, 0). */
export function drawSailboat(g: Phaser.GameObjects.Graphics, size: number, waves = true): void {
  const s = size / 2;
  // Grand-voile et foc.
  g.fillStyle(PALETTE.foam, 1);
  g.fillTriangle(-s * 0.06, -s * 0.95, -s * 0.06, s * 0.28, -s * 0.72, s * 0.28);
  g.fillStyle(PALETTE.sand, 1);
  g.fillTriangle(s * 0.04, -s * 0.78, s * 0.04, s * 0.28, s * 0.58, s * 0.28);
  // Mât et fanion.
  g.fillStyle(PALETTE.sand, 1);
  g.fillRect(-s * 0.06, -s * 1.02, s * 0.1, s * 1.32);
  g.fillStyle(PALETTE.coral, 1);
  g.fillTriangle(s * 0.04, -s * 1.02, s * 0.04, -s * 0.88, s * 0.26, -s * 0.95);
  // Coque.
  g.fillStyle(PALETTE.coral, 1);
  g.beginPath();
  g.moveTo(-s * 0.9, s * 0.36);
  g.lineTo(s * 0.9, s * 0.36);
  g.lineTo(s * 0.62, s * 0.66);
  g.lineTo(-s * 0.6, s * 0.66);
  g.closePath();
  g.fillPath();
  g.fillStyle(PALETTE.navy, 0.35);
  g.fillRect(-s * 0.8, s * 0.46, s * 1.58, s * 0.06);
  if (!waves) return;
  // Vagues.
  g.lineStyle(Math.max(2, s * 0.07), PALETTE.turquoise, 1);
  for (const [dy, alpha] of [
    [0.76, 1],
    [0.92, 0.55],
  ] as const) {
    g.lineStyle(Math.max(2, s * 0.07), PALETTE.turquoise, alpha);
    g.beginPath();
    for (let i = 0; i <= 24; i++) {
      const x = -s * 1.2 + (i / 24) * s * 2.4;
      const y = s * dy + Math.sin(i * 0.9 + dy * 4) * s * 0.05;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}
