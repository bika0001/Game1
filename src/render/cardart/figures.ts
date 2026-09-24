import { CSS } from '../../config/theme';
import { drawSuit } from './suits';

/**
 * Figures originales (Valet, Dame, Roi) : bustes à deux têtes, style plat et
 * élégant, légèrement marin (le Roi tient la barre, la Dame un coquillage,
 * le Valet porte une casquette de capitaine et une ancre).
 * Dessinées en code ; un système de skins pourra les remplacer.
 */

type Ctx = CanvasRenderingContext2D;

const GOLD = '#D4A23C';
const GOLD_DARK = '#A8792A';
const SKIN = '#F2D4B5';
const SKIN_SHADE = '#E2B994';
const INK = '#1F2A33';

interface Costume {
  readonly robe: string;
  readonly robeDark: string;
  readonly accent: string;
}

function costumeFor(rank: number, red: boolean): Costume {
  if (rank === 13) {
    return red
      ? { robe: '#A8342C', robeDark: '#7E231D', accent: CSS.turquoise }
      : { robe: CSS.navy, robeDark: '#0B2440', accent: CSS.coral };
  }
  if (rank === 12) {
    return red
      ? { robe: CSS.coral, robeDark: '#C2553B', accent: CSS.navy }
      : { robe: CSS.turquoise, robeDark: '#1F7A6F', accent: CSS.coral };
  }
  return red
    ? { robe: '#C9573F', robeDark: '#9C3F2C', accent: CSS.sand }
    : { robe: '#2F5E8C', robeDark: '#1F4468', accent: CSS.sand };
}

/** Coordonnées normalisées dans une boîte carrée de côté `s` (origine en haut à gauche). */
class Pen {
  constructor(
    readonly ctx: Ctx,
    readonly x0: number,
    readonly y0: number,
    readonly s: number,
  ) {}
  x(u: number): number {
    return this.x0 + u * this.s;
  }
  y(v: number): number {
    return this.y0 + v * this.s;
  }
  circle(u: number, v: number, r: number, fill: string): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.arc(this.x(u), this.y(v), r * this.s, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  poly(points: ReadonlyArray<readonly [number, number]>, fill: string): void {
    const { ctx } = this;
    ctx.beginPath();
    points.forEach(([u, v], i) =>
      i === 0 ? ctx.moveTo(this.x(u), this.y(v)) : ctx.lineTo(this.x(u), this.y(v)),
    );
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function drawRobe(p: Pen, c: Costume): void {
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(p.x(0.03), p.y(1.02));
  ctx.lineTo(p.x(0.06), p.y(0.8));
  ctx.bezierCurveTo(p.x(0.08), p.y(0.66), p.x(0.22), p.y(0.6), p.x(0.38), p.y(0.58));
  ctx.lineTo(p.x(0.62), p.y(0.58));
  ctx.bezierCurveTo(p.x(0.78), p.y(0.6), p.x(0.92), p.y(0.66), p.x(0.94), p.y(0.8));
  ctx.lineTo(p.x(0.97), p.y(1.02));
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, p.y(0.58), 0, p.y(1));
  grad.addColorStop(0, c.robe);
  grad.addColorStop(1, c.robeDark);
  ctx.fillStyle = grad;
  ctx.fill();
  // Galon central.
  p.poly(
    [
      [0.47, 0.64],
      [0.53, 0.64],
      [0.54, 1.02],
      [0.46, 1.02],
    ],
    c.accent,
  );
}

function drawHead(p: Pen): void {
  p.poly(
    [
      [0.44, 0.45],
      [0.56, 0.45],
      [0.57, 0.6],
      [0.43, 0.6],
    ],
    SKIN_SHADE,
  );
  p.circle(0.5, 0.36, 0.165, SKIN);
}

function drawFace(p: Pen, mouth = true): void {
  if (p.s < 26) return; // trop petit : les traits deviendraient du bruit
  p.circle(0.443, 0.36, 0.019, INK);
  p.circle(0.557, 0.36, 0.019, INK);
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha = 0.3;
  p.circle(0.415, 0.405, 0.028, '#E0786A');
  p.circle(0.585, 0.405, 0.028, '#E0786A');
  ctx.restore();
  if (!mouth) return;
  ctx.beginPath();
  ctx.arc(p.x(0.5), p.y(0.4), 0.05 * p.s, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.strokeStyle = '#B5654E';
  ctx.lineWidth = Math.max(1, 0.016 * p.s);
  ctx.stroke();
}

function drawCrown(p: Pen, tall: boolean, jewel: string): void {
  const top = tall ? 0.03 : 0.1;
  p.poly(
    [
      [0.33, 0.235],
      [0.32, top],
      [0.42, 0.15],
      [0.5, top - 0.03],
      [0.58, 0.15],
      [0.68, top],
      [0.67, 0.235],
    ],
    GOLD,
  );
  p.poly(
    [
      [0.33, 0.215],
      [0.67, 0.215],
      [0.67, 0.25],
      [0.33, 0.25],
    ],
    GOLD_DARK,
  );
  p.circle(0.5, top - 0.03, 0.03, jewel);
  p.circle(0.32, top, 0.024, jewel);
  p.circle(0.68, top, 0.024, jewel);
}

function drawShipWheel(p: Pen, u: number, v: number, r: number): void {
  const { ctx } = p;
  const cx = p.x(u);
  const cy = p.y(v);
  const R = r * p.s;
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, R * 0.16);
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = Math.max(1, R * 0.12);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.15, cy + Math.sin(a) * R * 0.15);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
  }
  ctx.fillStyle = GOLD_DARK;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShell(p: Pen, u: number, v: number, r: number): void {
  const { ctx } = p;
  const cx = p.x(u);
  const cy = p.y(v);
  const R = r * p.s;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy + R * 0.75);
  ctx.bezierCurveTo(cx - R * 1.25, cy + R * 0.1, cx - R * 0.8, cy - R, cx, cy - R * 0.85);
  ctx.bezierCurveTo(cx + R * 0.8, cy - R, cx + R * 1.25, cy + R * 0.1, cx, cy + R * 0.75);
  ctx.fillStyle = CSS.sand;
  ctx.fill();
  ctx.strokeStyle = GOLD_DARK;
  ctx.lineWidth = Math.max(1, R * 0.09);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + R * 0.7);
    ctx.lineTo(cx + i * R * 0.34, cy - R * 0.72 + Math.abs(i) * R * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAnchor(p: Pen, u: number, v: number, r: number): void {
  const { ctx } = p;
  const cx = p.x(u);
  const cy = p.y(v);
  const R = r * p.s;
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, R * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy - R * 0.85, R * 0.18, 0, Math.PI * 2);
  ctx.moveTo(cx, cy - R * 0.67);
  ctx.lineTo(cx, cy + R * 0.9);
  ctx.moveTo(cx - R * 0.45, cy - R * 0.4);
  ctx.lineTo(cx + R * 0.45, cy - R * 0.4);
  ctx.moveTo(cx - R * 0.8, cy + R * 0.2);
  ctx.quadraticCurveTo(cx - R * 0.6, cy + R * 0.95, cx, cy + R * 0.9);
  ctx.quadraticCurveTo(cx + R * 0.6, cy + R * 0.95, cx + R * 0.8, cy + R * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawKing(p: Pen, c: Costume): void {
  drawRobe(p, c);
  // Col d'hermine.
  p.poly(
    [
      [0.28, 0.6],
      [0.72, 0.6],
      [0.65, 0.71],
      [0.5, 0.67],
      [0.35, 0.71],
    ],
    '#F7F4EC',
  );
  [0.36, 0.5, 0.64].forEach((u) => p.circle(u, 0.65, 0.013, INK));
  drawHead(p);
  // Barbe argentée.
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(p.x(0.34), p.y(0.37));
  ctx.quadraticCurveTo(p.x(0.35), p.y(0.58), p.x(0.5), p.y(0.6));
  ctx.quadraticCurveTo(p.x(0.65), p.y(0.58), p.x(0.66), p.y(0.37));
  ctx.quadraticCurveTo(p.x(0.5), p.y(0.47), p.x(0.34), p.y(0.37));
  ctx.fillStyle = '#DCD9D1';
  ctx.fill();
  drawFace(p, false);
  drawCrown(p, true, c.accent);
  drawShipWheel(p, 1.1, 0.8, 0.17);
}

function drawQueen(p: Pen, c: Costume): void {
  // Chevelure longue, derrière la tête.
  const { ctx } = p;
  ctx.beginPath();
  ctx.moveTo(p.x(0.31), p.y(0.3));
  ctx.quadraticCurveTo(p.x(0.24), p.y(0.56), p.x(0.28), p.y(0.68));
  ctx.lineTo(p.x(0.72), p.y(0.68));
  ctx.quadraticCurveTo(p.x(0.76), p.y(0.56), p.x(0.69), p.y(0.3));
  ctx.closePath();
  ctx.fillStyle = '#5B3A29';
  ctx.fill();
  drawRobe(p, c);
  drawHead(p);
  ctx.beginPath();
  ctx.arc(p.x(0.5), p.y(0.35), 0.17 * p.s, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fillStyle = '#5B3A29';
  ctx.fill();
  drawFace(p);
  // Collier de perles.
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 6);
    p.circle(0.5 + Math.cos(a) * 0.14, 0.58 + Math.sin(a) * 0.07, 0.018, '#FFFFFF');
  }
  drawCrown(p, false, '#FFFFFF');
  drawShell(p, -0.1, 0.8, 0.17);
}

function drawJack(p: Pen, c: Costume): void {
  drawRobe(p, c);
  // Foulard.
  p.poly(
    [
      [0.38, 0.58],
      [0.62, 0.58],
      [0.5, 0.74],
    ],
    c.accent,
  );
  [0.84, 0.94].forEach((v) => p.circle(0.5, v, 0.022, GOLD));
  drawHead(p);
  // Favoris.
  p.poly(
    [
      [0.335, 0.3],
      [0.37, 0.3],
      [0.37, 0.42],
      [0.345, 0.4],
    ],
    '#3B2A20',
  );
  p.poly(
    [
      [0.665, 0.3],
      [0.63, 0.3],
      [0.63, 0.42],
      [0.655, 0.4],
    ],
    '#3B2A20',
  );
  drawFace(p);
  // Casquette de capitaine.
  const { ctx } = p;
  ctx.beginPath();
  ctx.ellipse(p.x(0.5), p.y(0.2), 0.21 * p.s, 0.085 * p.s, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FAFAF7';
  ctx.fill();
  p.poly(
    [
      [0.33, 0.21],
      [0.67, 0.21],
      [0.66, 0.27],
      [0.34, 0.27],
    ],
    CSS.navy,
  );
  ctx.beginPath();
  ctx.ellipse(p.x(0.5), p.y(0.275), 0.17 * p.s, 0.035 * p.s, 0, 0, Math.PI);
  ctx.fillStyle = INK;
  ctx.fill();
  p.circle(0.5, 0.24, 0.026, GOLD);
  drawAnchor(p, 1.1, 0.8, 0.17);
}

/**
 * Dessine le panneau de figure (deux bustes tête-bêche) dans le rectangle donné.
 */
export function drawFigure(
  ctx: Ctx,
  rank: 11 | 12 | 13,
  suit: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const red = (suit & 1) === 1;
  const suitColor = red ? CSS.cardRed : CSS.cardBlack;
  const costume = costumeFor(rank, red);
  const radius = Math.min(w, h) * 0.08;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = red ? '#FBEDE7' : '#E9F0F4';
  ctx.fill();
  ctx.clip();

  const half = h / 2;
  const s = Math.min(half * 0.93, w * 0.6);
  const draw = (): void => {
    const pen = new Pen(ctx, x + (w - s) / 2, y + half - s, s);
    if (rank === 13) drawKing(pen, costume);
    else if (rank === 12) drawQueen(pen, costume);
    else drawJack(pen, costume);
  };
  draw();
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-(x + w / 2), -(y + h / 2));
  draw();
  ctx.restore();
  ctx.restore();

  // Cadre et ligne médiane.
  ctx.save();
  ctx.strokeStyle = suitColor;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1, w * 0.018);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.08, y + half);
  ctx.lineTo(x + w * 0.92, y + half);
  ctx.stroke();
  ctx.restore();

  // Petites enseignes aux coins du panneau.
  const pip = Math.min(w, h) * 0.14;
  drawSuit(ctx, suit, x + pip * 0.85, y + pip * 0.85, pip, suitColor);
  ctx.save();
  ctx.translate(x + w - pip * 0.85, y + h - pip * 0.85);
  ctx.rotate(Math.PI);
  drawSuit(ctx, suit, 0, 0, pip, suitColor);
  ctx.restore();
}
