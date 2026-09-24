/**
 * Symboles des enseignes dessinés en vecteurs (jamais de caractères Unicode,
 * dont le rendu varie selon les appareils et peut devenir un émoji).
 * Chaque tracé est défini dans une boîte unité centrée : [-0,5 ; 0,5]².
 */

type Ctx = CanvasRenderingContext2D;

function heartPath(ctx: Ctx): void {
  ctx.moveTo(0, 0.46);
  ctx.bezierCurveTo(-0.12, 0.33, -0.5, 0.1, -0.5, -0.16);
  ctx.bezierCurveTo(-0.5, -0.38, -0.34, -0.48, -0.23, -0.48);
  ctx.bezierCurveTo(-0.11, -0.48, -0.03, -0.41, 0, -0.3);
  ctx.bezierCurveTo(0.03, -0.41, 0.11, -0.48, 0.23, -0.48);
  ctx.bezierCurveTo(0.34, -0.48, 0.5, -0.38, 0.5, -0.16);
  ctx.bezierCurveTo(0.5, 0.1, 0.12, 0.33, 0, 0.46);
  ctx.closePath();
}

function diamondPath(ctx: Ctx): void {
  ctx.moveTo(0, -0.5);
  ctx.quadraticCurveTo(0.17, -0.22, 0.4, 0);
  ctx.quadraticCurveTo(0.17, 0.22, 0, 0.5);
  ctx.quadraticCurveTo(-0.17, 0.22, -0.4, 0);
  ctx.quadraticCurveTo(-0.17, -0.22, 0, -0.5);
  ctx.closePath();
}

function spadePath(ctx: Ctx): void {
  ctx.moveTo(0, -0.5);
  ctx.bezierCurveTo(0.12, -0.34, 0.5, -0.12, 0.5, 0.12);
  ctx.bezierCurveTo(0.5, 0.32, 0.34, 0.41, 0.22, 0.41);
  ctx.bezierCurveTo(0.12, 0.41, 0.06, 0.36, 0.04, 0.31);
  ctx.quadraticCurveTo(0.07, 0.43, 0.2, 0.5);
  ctx.lineTo(-0.2, 0.5);
  ctx.quadraticCurveTo(-0.07, 0.43, -0.04, 0.31);
  ctx.bezierCurveTo(-0.06, 0.36, -0.12, 0.41, -0.22, 0.41);
  ctx.bezierCurveTo(-0.34, 0.41, -0.5, 0.32, -0.5, 0.12);
  ctx.bezierCurveTo(-0.5, -0.12, -0.12, -0.34, 0, -0.5);
  ctx.closePath();
}

function clubPath(ctx: Ctx): void {
  const lobe = (x: number, y: number, r: number): void => {
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  };
  lobe(0, -0.25, 0.205);
  lobe(-0.235, 0.09, 0.205);
  lobe(0.235, 0.09, 0.205);
  lobe(0, 0.01, 0.12);
  ctx.moveTo(-0.045, 0.1);
  ctx.quadraticCurveTo(-0.05, 0.38, -0.2, 0.5);
  ctx.lineTo(0.2, 0.5);
  ctx.quadraticCurveTo(0.05, 0.38, 0.045, 0.1);
  ctx.closePath();
}

const PATHS = [spadePath, heartPath, clubPath, diamondPath];

/** Dessine une enseigne (0 ♠, 1 ♥, 2 ♣, 3 ♦) centrée en (cx, cy), de hauteur `size`. */
export function drawSuit(
  ctx: Ctx,
  suit: number,
  cx: number,
  cy: number,
  size: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(size, size);
  ctx.beginPath();
  (PATHS[suit] ?? spadePath)(ctx);
  ctx.fillStyle = color;
  ctx.fill('nonzero');
  ctx.restore();
}
