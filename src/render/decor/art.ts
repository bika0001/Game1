/**
 * Dessins procéduraux des décors, rendus à la densité de l'écran (nets).
 * Tout est original et généré en code.
 */

type Ctx = CanvasRenderingContext2D;

/** Générateur pseudo-aléatoire local (décors stables d'une fois à l'autre). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Petits objets du fond
// ---------------------------------------------------------------------------

export function drawStarfish(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    const px = Math.cos(a) * rr;
    const py = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.28;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.stroke();
  ctx.fill();
  // Petits points en relief.
  ctx.fillStyle = 'rgba(255, 240, 220, 0.55)';
  for (let i = 0; i < 5; i++) {
    const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    for (let k = 1; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.3 * k, Math.sin(a) * r * 0.3 * k, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function drawScallop(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  angle: number,
  color: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.75);
  ctx.bezierCurveTo(-r * 1.25, r * 0.05, -r * 0.85, -r, 0, -r * 0.9);
  ctx.bezierCurveTo(r * 0.85, -r, r * 1.25, r * 0.05, 0, r * 0.75);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(120, 80, 60, 0.35)';
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, r * 0.7);
    ctx.lineTo(i * r * 0.26, -r * 0.8 + Math.abs(i) * r * 0.1);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.28, r * 0.6, r * 0.56, r * 0.22);
  ctx.restore();
}

export function drawConch(ctx: Ctx, x: number, y: number, r: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const g = ctx.createLinearGradient(-r, 0, r, 0);
  g.addColorStop(0, '#F6D7B8');
  g.addColorStop(1, '#E7A98C');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.75, r, -r * 0.1);
  ctx.quadraticCurveTo(r * 0.1, r * 0.65, -r, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(150, 90, 70, 0.4)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(
      -r * 0.2 + i * r * 0.28,
      -r * 0.05,
      r * (0.45 - i * 0.1),
      -Math.PI * 0.8,
      Math.PI * 0.2,
    );
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPebble(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.72, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCoral(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  rnd: () => number,
) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  const branch = (
    bx: number,
    by: number,
    len: number,
    angle: number,
    width: number,
    depth: number,
  ): void => {
    const ex = bx + Math.cos(angle) * len;
    const ey = by + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(
      (bx + ex) / 2 + (rnd() - 0.5) * len * 0.4,
      (by + ey) / 2 + (rnd() - 0.5) * len * 0.4,
      ex,
      ey,
    );
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, len * 0.72, angle - 0.5 - rnd() * 0.3, width * 0.72, depth - 1);
      branch(ex, ey, len * 0.72, angle + 0.5 + rnd() * 0.3, width * 0.72, depth - 1);
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(ex, ey, width * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  for (let i = 0; i < 5; i++) {
    branch(x, y, r * (0.45 + rnd() * 0.25), (i / 5) * Math.PI * 2 + rnd() * 0.6, r * 0.16, 2);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Fond de lagon (vue du dessus : eau claire sur sable)
// ---------------------------------------------------------------------------

export interface FloorOptions {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** Ligne où reposent les objets du bas (juste au-dessus de la barre d'outils). */
  readonly floorBottom: number;
}

export function drawLagoonFloor(ctx: Ctx, o: FloorOptions): void {
  const { width: W, height: H, dpr } = o;
  const rnd = seeded(20240917);

  // Eau turquoise : claire en haut (peu profond), plus soutenue en bas.
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, '#6DD5D1');
  base.addColorStop(0.42, '#3DBAC3');
  base.addColorStop(1, '#1E8FAA');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Plaques de sable clair et creux plus sombres.
  for (let i = 0; i < 14; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = (0.18 + rnd() * 0.3) * Math.max(W, H) * 0.5;
    const light = i % 3 !== 0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, light ? 'rgba(247, 236, 196, 0.22)' : 'rgba(10, 80, 100, 0.16)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Rides de sable : bandes ondulées claires et leur ombre.
  const spacing = 26 * dpr;
  for (let y0 = -spacing; y0 < H + spacing; y0 += spacing * (0.8 + rnd() * 0.45)) {
    const phase = rnd() * Math.PI * 2;
    const f1 = (0.9 + rnd() * 0.6) / (140 * dpr);
    const f2 = (0.9 + rnd() * 0.8) / (57 * dpr);
    const amp = (5 + rnd() * 6) * dpr;
    const path = (dy: number): void => {
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 6 * dpr) {
        const y =
          y0 +
          dy +
          Math.sin(x * f1 * Math.PI * 2 + phase) * amp +
          Math.sin(x * f2 + phase * 2) * amp * 0.35;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    };
    ctx.lineWidth = 2.2 * dpr;
    ctx.strokeStyle = 'rgba(8, 70, 90, 0.07)';
    path(2.5 * dpr);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.085)';
    path(0);
    ctx.stroke();
  }

  // Banc de sable clair le long du bas, où reposent coraux et coquillages.
  const fb = o.floorBottom;
  const u = Math.min(W, H) / 100;
  const bank = ctx.createLinearGradient(0, fb - u * 22, 0, fb + u * 4);
  bank.addColorStop(0, 'rgba(250, 238, 200, 0)');
  bank.addColorStop(1, 'rgba(250, 238, 200, 0.3)');
  ctx.fillStyle = bank;
  ctx.fillRect(0, fb - u * 22, W, u * 26);
  if (H > fb) {
    ctx.fillStyle = 'rgba(250, 238, 200, 0.3)';
    ctx.fillRect(0, fb + u * 4, W, H - fb);
  }

  // Objets posés sur le sable, surtout dans les coins et le bas de l'écran.
  drawCoral(ctx, W * 0.07, fb - u * 1.5, u * 9, 'rgba(236, 120, 140, 0.8)', rnd);
  drawCoral(ctx, W * 0.17, fb + u * 0.5, u * 5.5, 'rgba(250, 170, 120, 0.75)', rnd);
  drawPebble(ctx, W * 0.25, fb - u * 2.5, u * 1.8, 'rgba(90, 130, 140, 0.8)');
  drawPebble(ctx, W * 0.28, fb - u * 1, u * 1.2, 'rgba(110, 150, 150, 0.8)');
  drawConch(ctx, W * 0.5, fb - u * 3.5, u * 3.4, 0.4);
  drawScallop(ctx, W * 0.7, fb - u * 2, u * 3, -0.3, 'rgba(250, 226, 200, 0.92)');
  drawStarfish(ctx, W * 0.87, fb - u * 5, u * 5.2, 0.4, 'rgba(242, 124, 82, 0.9)');
  drawPebble(ctx, W * 0.95, fb - u * 1.5, u * 1.4, 'rgba(100, 140, 150, 0.75)');
  drawStarfish(ctx, W * 0.035, H * 0.6, u * 3, 1.1, 'rgba(250, 196, 90, 0.7)');
  drawScallop(ctx, W * 0.965, H * 0.47, u * 2.4, 0.9, 'rgba(255, 214, 220, 0.75)');

  // Vignette douce : le centre attire l'œil, les bords s'assombrissent un peu.
  const v = ctx.createRadialGradient(
    W / 2,
    H * 0.45,
    Math.min(W, H) * 0.35,
    W / 2,
    H * 0.5,
    Math.hypot(W, H) * 0.62,
  );
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(4, 50, 70, 0.28)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Caustiques (reflets du soleil sur le fond), motif raccordable
// ---------------------------------------------------------------------------

/** Motif de caustiques : bords lumineux d'un bruit cellulaire (F2 - F1), raccordable. */
export function drawCaustics(ctx: Ctx, size: number, cells: number, seed: number): void {
  const rnd = seeded(seed);
  const cell = size / cells;
  const px: number[] = [];
  const py: number[] = [];
  for (let j = 0; j < cells; j++) {
    for (let i = 0; i < cells; i++) {
      px.push((i + 0.15 + rnd() * 0.7) * cell);
      py.push((j + 0.15 + rnd() * 0.7) * cell);
    }
  }
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const edge = cell * 0.16;
  for (let y = 0; y < size; y++) {
    const cy = Math.floor(y / cell);
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell);
      let f1 = Infinity;
      let f2 = Infinity;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          let ci = cx + di;
          let cj = cy + dj;
          let ox = 0;
          let oy = 0;
          if (ci < 0) {
            ci += cells;
            ox = -size;
          } else if (ci >= cells) {
            ci -= cells;
            ox = size;
          }
          if (cj < 0) {
            cj += cells;
            oy = -size;
          } else if (cj >= cells) {
            cj -= cells;
            oy = size;
          }
          const k = cj * cells + ci;
          const dx = (px[k] as number) + ox - x;
          const dy = (py[k] as number) + oy - y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < f1) {
            f2 = f1;
            f1 = d;
          } else if (d < f2) {
            f2 = d;
          }
        }
      }
      const t = Math.max(0, 1 - (f2 - f1) / edge);
      const a = t * t * t;
      const o = (y * size + x) * 4;
      data[o] = 235;
      data[o + 1] = 255;
      data[o + 2] = 250;
      data[o + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

// ---------------------------------------------------------------------------
// Sprites d'ambiance
// ---------------------------------------------------------------------------

/** Silhouette de poisson vue du dessus (tête à droite). */
export function drawFish(ctx: Ctx, w: number, h: number): void {
  ctx.fillStyle = 'rgba(6, 58, 72, 1)';
  ctx.beginPath();
  ctx.ellipse(w * 0.55, h / 2, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h / 2);
  ctx.lineTo(w * 0.02, h * 0.12);
  ctx.quadraticCurveTo(w * 0.1, h / 2, w * 0.02, h * 0.88);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.lineTo(w * 0.38, h * 0.02);
  ctx.lineTo(w * 0.62, h * 0.24);
  ctx.moveTo(w * 0.5, h * 0.78);
  ctx.lineTo(w * 0.38, h * 0.98);
  ctx.lineTo(w * 0.62, h * 0.76);
  ctx.fill();
}

export function drawBubble(ctx: Ctx, s: number): void {
  const r = s / 2 - 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.arc(s * 0.36, s * 0.34, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

/** Éclat à quatre branches, cœur lumineux. */
export function drawSparkle(ctx: Ctx, s: number, color = '255, 250, 220'): void {
  const c = s / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, `rgba(${color}, 1)`);
  g.addColorStop(0.25, `rgba(${color}, 0.55)`);
  g.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = `rgba(${color}, 0.95)`;
  for (const [w, h] of [
    [s * 0.08, s * 0.5],
    [s * 0.5, s * 0.08],
  ] as const) {
    ctx.beginPath();
    ctx.ellipse(c, c, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Ombre de mouette planant (vue du dessus, floue). */
export function drawGullShadow(ctx: Ctx, w: number, h: number): void {
  ctx.save();
  ctx.filter = `blur(${Math.max(1, h * 0.08)}px)`;
  ctx.fillStyle = 'rgba(6, 50, 64, 1)';
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.62);
  ctx.quadraticCurveTo(w * 0.3, h * 0.12, w * 0.04, h * 0.4);
  ctx.quadraticCurveTo(w * 0.3, h * 0.36, w * 0.47, h * 0.78);
  ctx.lineTo(w * 0.53, h * 0.78);
  ctx.quadraticCurveTo(w * 0.7, h * 0.36, w * 0.96, h * 0.4);
  ctx.quadraticCurveTo(w * 0.7, h * 0.12, w * 0.5, h * 0.62);
  ctx.fill();
  ctx.restore();
}

/** Touffe d'algues (base en bas au centre). */
export function drawSeaweed(ctx: Ctx, w: number, h: number, rnd: () => number): void {
  for (let i = 0; i < 6; i++) {
    const x0 = w / 2 + (i - 2.5) * w * 0.08;
    const len = h * (0.55 + rnd() * 0.42);
    const bend = (rnd() - 0.5) * w * 0.5;
    const g = ctx.createLinearGradient(0, h, 0, h - len);
    g.addColorStop(0, 'rgba(34, 120, 90, 0.95)');
    g.addColorStop(1, 'rgba(120, 200, 140, 0.9)');
    ctx.fillStyle = g;
    const bw = w * 0.07;
    ctx.beginPath();
    ctx.moveTo(x0 - bw, h);
    ctx.quadraticCurveTo(x0 + bend * 0.5 - bw, h - len * 0.5, x0 + bend, h - len);
    ctx.quadraticCurveTo(x0 + bend * 0.5 + bw, h - len * 0.5, x0 + bw, h);
    ctx.closePath();
    ctx.fill();
  }
}

/** Onde qui s'élargit sur l'eau (anneau clair, légèrement aplati). */
export function drawRipple(ctx: Ctx, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.lineWidth = Math.max(2, w * 0.022);
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w / 2 - ctx.lineWidth, h / 2 - ctx.lineWidth, 0, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Menu : marine (ciel, soleil, mer, île)
// ---------------------------------------------------------------------------

export interface SeascapeGeometry {
  readonly sun: { readonly x: number; readonly y: number; readonly r: number };
  readonly island: { readonly x: number; readonly w: number };
  /** Lanterne du phare. */
  readonly lamp: { readonly x: number; readonly y: number; readonly size: number };
}

/** Positions des éléments fixes de la marine (partagées avec les animations). */
export function seascapeGeometry(W: number, H: number, horizon: number): SeascapeGeometry {
  // En paysage, l'île est plus petite : le titre et la devise passent au-dessus.
  const iw = Math.min(W * 0.34, H * (W > H ? 0.3 : 0.4));
  const ix = W * 0.2;
  const lh = iw * 0.2;
  return {
    sun: { x: W * 0.8, y: horizon * 0.64, r: Math.min(W, H) * 0.07 },
    island: { x: ix, w: iw },
    lamp: { x: ix + iw * 0.3, y: horizon - iw * 0.04 - lh * 1.06, size: lh * 0.3 },
  };
}

export function drawSeascape(ctx: Ctx, W: number, H: number, horizon: number): void {
  const geo = seascapeGeometry(W, H, horizon);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#5DB7DE');
  sky.addColorStop(0.7, '#A9DCEB');
  sky.addColorStop(1, '#FBE7C6');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);

  // Soleil et halo.
  const { x: sx, y: sy, r: sr } = geo.sun;
  const halo = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
  halo.addColorStop(0, 'rgba(255, 244, 214, 0.9)');
  halo.addColorStop(1, 'rgba(255, 244, 214, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#FFF4D6';
  ctx.beginPath();
  ctx.arc(sx, sy, sr, 0, Math.PI * 2);
  ctx.fill();

  // Île lointaine avec palmiers et phare.
  const { x: ix, w: iw } = geo.island;
  ctx.fillStyle = '#3E8C7C';
  ctx.beginPath();
  ctx.moveTo(ix - iw / 2, horizon);
  ctx.quadraticCurveTo(ix - iw * 0.2, horizon - iw * 0.16, ix, horizon - iw * 0.13);
  ctx.quadraticCurveTo(ix + iw * 0.25, horizon - iw * 0.1, ix + iw / 2, horizon);
  ctx.fill();
  ctx.fillStyle = '#E9D8A6';
  ctx.fillRect(ix - iw * 0.4, horizon - iw * 0.012, iw * 0.8, iw * 0.012);
  const palm = (px: number, ph: number): void => {
    ctx.strokeStyle = '#6B4F3A';
    ctx.lineWidth = Math.max(2, iw * 0.012);
    ctx.beginPath();
    ctx.moveTo(px, horizon - iw * 0.1);
    ctx.quadraticCurveTo(
      px + ph * 0.15,
      horizon - iw * 0.1 - ph * 0.5,
      px + ph * 0.05,
      horizon - iw * 0.1 - ph,
    );
    ctx.stroke();
    ctx.fillStyle = '#2F7A58';
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.6;
      ctx.beginPath();
      ctx.ellipse(
        px + ph * 0.05 + Math.cos(a) * ph * 0.22,
        horizon - iw * 0.1 - ph + Math.sin(a) * ph * 0.12 + ph * 0.08,
        ph * 0.26,
        ph * 0.07,
        a,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  };
  palm(ix - iw * 0.08, iw * 0.2);
  palm(ix + iw * 0.06, iw * 0.15);
  // Phare.
  const lx = ix + iw * 0.3;
  const lh = iw * 0.2;
  ctx.fillStyle = '#FAFAF7';
  ctx.beginPath();
  ctx.moveTo(lx - lh * 0.1, horizon - iw * 0.04);
  ctx.lineTo(lx - lh * 0.06, horizon - iw * 0.04 - lh);
  ctx.lineTo(lx + lh * 0.06, horizon - iw * 0.04 - lh);
  ctx.lineTo(lx + lh * 0.1, horizon - iw * 0.04);
  ctx.fill();
  ctx.fillStyle = '#E76F51';
  for (let k = 0; k < 2; k++) {
    ctx.fillRect(
      lx - lh * 0.09 + k * lh * 0.01,
      horizon - iw * 0.04 - lh * (0.3 + k * 0.35),
      lh * 0.18 - k * lh * 0.02,
      lh * 0.12,
    );
  }
  ctx.fillStyle = '#12355B';
  ctx.fillRect(lx - lh * 0.08, horizon - iw * 0.04 - lh * 1.12, lh * 0.16, lh * 0.12);

  // Mer.
  const sea = ctx.createLinearGradient(0, horizon, 0, H);
  sea.addColorStop(0, '#3FB6C0');
  sea.addColorStop(0.35, '#2A9D8F');
  sea.addColorStop(1, '#12355B');
  ctx.fillStyle = sea;
  ctx.fillRect(0, horizon, W, H - horizon);
  // Reflet du soleil : traits de lumière qui s'élargissent vers le bas.
  const rnd = seeded(77);
  for (let i = 0; i < 22; i++) {
    const t = i / 21;
    const y = horizon + (H - horizon) * (0.015 + t * 0.62);
    const half = sr * (0.45 + t * 2.1) * (0.55 + rnd() * 0.5);
    const x = sx + (rnd() - 0.5) * sr * (0.4 + t);
    ctx.fillStyle = `rgba(255, 244, 214, ${(0.55 * (1 - t) + 0.05).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(x, y, half, Math.max(1, sr * 0.045 * (1 + t)), 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Nuage cotonneux : bosses rondes sur une base arrondie, dessous légèrement bleuté. */
export function drawCloud(ctx: Ctx, w: number, h: number, rnd: () => number): void {
  const bumps: Array<[number, number, number]> = [
    [0.18, 0.7, 0.17],
    [0.34, 0.56, 0.27],
    [0.52, 0.45, 0.36],
    [0.7, 0.55, 0.28],
    [0.84, 0.68, 0.18],
  ];
  const shape = (dy: number): void => {
    ctx.beginPath();
    for (const [bx, by, br] of bumps) {
      const r = h * br * (0.92 + rnd() * 0.16);
      ctx.moveTo(w * bx + r, h * by + dy);
      ctx.arc(w * bx, h * by + dy, r, 0, Math.PI * 2);
    }
    ctx.moveTo(w * 0.86, h * 0.76 + dy);
    ctx.ellipse(w * 0.5, h * 0.76 + dy, w * 0.37, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.fillStyle = 'rgba(190, 220, 238, 0.85)';
  shape(h * 0.06);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.97)';
  shape(0);
}

/** Bande de vagues raccordable horizontalement : longues ondulations, crête claire et écume. */
export function drawWaveBand(ctx: Ctx, w: number, h: number, crest: string, body: string): void {
  const waves = 2;
  const wave = (x: number): number =>
    h * 0.42 +
    Math.sin((x / w) * Math.PI * 2 * waves) * h * 0.14 +
    Math.sin((x / w) * Math.PI * 2 * waves * 3) * h * 0.025;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, wave(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  // Reflet clair juste sous la crête.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, wave(x));
  for (let x = w; x >= 0; x -= 2) ctx.lineTo(x, wave(x) + h * 0.14);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = crest;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2, h * 0.06);
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) {
    if (x === 0) ctx.moveTo(x, wave(x));
    else ctx.lineTo(x, wave(x));
  }
  ctx.stroke();
}

/** Mouette (vue de profil), ailes hautes ou basses. */
export function drawGull(ctx: Ctx, w: number, h: number, wingsUp: boolean): void {
  ctx.strokeStyle = '#3D4B57';
  ctx.lineWidth = Math.max(2, h * 0.12);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const cy = h * 0.6;
  const tip = wingsUp ? h * 0.12 : h * 0.95;
  ctx.moveTo(w * 0.04, wingsUp ? tip : cy - h * 0.1);
  ctx.quadraticCurveTo(w * 0.28, wingsUp ? h * 0.18 : h * 0.85, w * 0.5, cy);
  ctx.quadraticCurveTo(
    w * 0.72,
    wingsUp ? h * 0.18 : h * 0.85,
    w * 0.96,
    wingsUp ? tip : cy - h * 0.1,
  );
  ctx.stroke();
  ctx.fillStyle = '#FAFAF7';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, cy + h * 0.02, w * 0.07, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}
