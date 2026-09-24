import type Phaser from 'phaser';

export type IconName =
  | 'undo'
  | 'hint'
  | 'new'
  | 'menu'
  | 'settings'
  | 'finish'
  | 'back'
  | 'play'
  | 'replay'
  | 'star'
  | 'clock'
  | 'moves';

/** Pictogrammes simples dessinés en vecteurs (lisibles, sans police d'icônes). */
export function drawIcon(
  g: Phaser.GameObjects.Graphics,
  name: IconName,
  cx: number,
  cy: number,
  size: number,
  color: number,
): void {
  const s = size / 2;
  const line = Math.max(2, size * 0.1);
  g.lineStyle(line, color, 1);
  g.fillStyle(color, 1);
  switch (name) {
    case 'undo': {
      g.beginPath();
      g.arc(cx + s * 0.1, cy + s * 0.15, s * 0.62, Math.PI * 1.05, Math.PI * 0.35, false);
      g.strokePath();
      const ax = cx + s * 0.1 - s * 0.62;
      const ay = cy + s * 0.1;
      g.fillTriangle(ax - s * 0.34, ay - s * 0.05, ax + s * 0.34, ay - s * 0.05, ax, ay + s * 0.42);
      break;
    }
    case 'replay': {
      g.beginPath();
      g.arc(cx, cy, s * 0.62, -Math.PI * 0.4, Math.PI * 1.3, false);
      g.strokePath();
      const ax = cx + Math.cos(-Math.PI * 0.4) * s * 0.62;
      const ay = cy + Math.sin(-Math.PI * 0.4) * s * 0.62;
      g.fillTriangle(
        ax - s * 0.1,
        ay - s * 0.38,
        ax + s * 0.36,
        ay + s * 0.05,
        ax - s * 0.3,
        ay + s * 0.2,
      );
      break;
    }
    case 'hint': {
      g.strokeCircle(cx, cy - s * 0.18, s * 0.5);
      g.fillRect(cx - s * 0.26, cy + s * 0.42, s * 0.52, line);
      g.fillRect(cx - s * 0.18, cy + s * 0.62, s * 0.36, line);
      g.lineStyle(line * 0.8, color, 1);
      g.lineBetween(cx, cy - s * 0.02, cx, cy + s * 0.3);
      g.lineBetween(cx - s * 0.16, cy - s * 0.02, cx + s * 0.16, cy - s * 0.02);
      break;
    }
    case 'new': {
      g.strokeRoundedRect(cx - s * 0.62, cy - s * 0.48, s * 0.86, s * 1.18, s * 0.12);
      g.strokeRoundedRect(cx - s * 0.24, cy - s * 0.76, s * 0.86, s * 1.18, s * 0.12);
      break;
    }
    case 'menu': {
      for (let i = -1; i <= 1; i++)
        g.fillRoundedRect(cx - s * 0.62, cy + i * s * 0.42 - line / 2, s * 1.24, line, line / 2);
      break;
    }
    case 'settings': {
      g.strokeCircle(cx, cy, s * 0.42);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.lineBetween(
          cx + Math.cos(a) * s * 0.52,
          cy + Math.sin(a) * s * 0.52,
          cx + Math.cos(a) * s * 0.78,
          cy + Math.sin(a) * s * 0.78,
        );
      }
      g.fillCircle(cx, cy, s * 0.14);
      break;
    }
    case 'finish': {
      for (const dy of [-0.28, 0.18]) {
        g.beginPath();
        g.moveTo(cx - s * 0.5, cy + (dy + 0.26) * s);
        g.lineTo(cx, cy + dy * s - s * 0.12);
        g.lineTo(cx + s * 0.5, cy + (dy + 0.26) * s);
        g.strokePath();
      }
      break;
    }
    case 'back': {
      g.beginPath();
      g.moveTo(cx + s * 0.2, cy - s * 0.55);
      g.lineTo(cx - s * 0.35, cy);
      g.lineTo(cx + s * 0.2, cy + s * 0.55);
      g.strokePath();
      break;
    }
    case 'play': {
      g.fillTriangle(cx - s * 0.35, cy - s * 0.55, cx - s * 0.35, cy + s * 0.55, cx + s * 0.55, cy);
      break;
    }
    case 'star': {
      const pts: Phaser.Types.Math.Vector2Like[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? s * 0.95 : s * 0.42;
        pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r + s * 0.06 });
      }
      g.fillPoints(pts, true);
      break;
    }
    case 'clock': {
      g.strokeCircle(cx, cy, s * 0.78);
      g.lineBetween(cx, cy, cx, cy - s * 0.48);
      g.lineBetween(cx, cy, cx + s * 0.36, cy + s * 0.14);
      break;
    }
    case 'moves': {
      // Deux cartes décalées et une flèche : « coups joués ».
      g.strokeRoundedRect(cx - s * 0.7, cy - s * 0.55, s * 0.8, s * 1.1, s * 0.12);
      g.fillRoundedRect(cx - s * 0.05, cy - s * 0.4, s * 0.8, s * 1.1, s * 0.12);
      break;
    }
  }
}
