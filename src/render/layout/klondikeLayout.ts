import { CARD } from '../../config/theme';
import type { CardFace } from '../../core/games/types';

/**
 * Mise en page du Klondike, en pixels physiques.
 *
 * Portrait : barre d'infos, rangée du haut (fondations + défausse + pioche),
 * 7 colonnes, barre d'outils en bas.
 * Paysage : fondations en colonne sur un côté, pioche et défausse de l'autre,
 * tableau au centre (toute la hauteur), barre d'outils verticale sur le bord.
 * Mode gaucher : pioche et fondations inversées.
 * On calcule plusieurs variantes et on garde celle qui donne les plus grandes cartes.
 */

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Insets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

export interface LayoutInput {
  /** Taille de l'écran en pixels physiques. */
  readonly width: number;
  readonly height: number;
  /** Pixels physiques par pixel CSS. */
  readonly dpr: number;
  readonly safe: Insets;
  readonly leftHanded: boolean;
  readonly drawCount: 1 | 3;
  /** Hauteur réservée à la bannière publicitaire (0 si aucune). */
  readonly bannerHeight: number;
  /** Échelle de l'interface (texte « grand » : > 1). */
  readonly uiScale: number;
}

export interface PilePlacement {
  readonly x: number;
  readonly y: number;
}

export type Orientation = 'portrait' | 'landscape';

export interface KlondikeLayout {
  readonly orientation: Orientation;
  readonly cardW: number;
  readonly cardH: number;
  /** Emplacements (coin haut-gauche) de chaque pile. */
  readonly piles: Readonly<Record<string, PilePlacement>>;
  /** Éventail de la défausse en pioche 3. */
  readonly wasteFan: { readonly dx: number; readonly dy: number };
  /** Limite basse des colonnes du tableau. */
  readonly tableauBottom: number;
  readonly infoBar: Rect;
  readonly toolbar: Rect & { readonly vertical: boolean };
  /** Zone du bouton « Terminer » (auto-complétion). */
  readonly finishButton: Rect;
  /** Unité d'interface : 1 pixel CSS × échelle de l'interface. */
  readonly unit: number;
}

interface Candidate {
  readonly layout: KlondikeLayout;
  readonly score: number;
}

/** Hauteur minimale nécessaire à la pire colonne (6 cachées + 13 visibles) aux écarts minimaux. */
const WORST_COLUMN = 1 + 6 * CARD.faceDownMin + 12 * CARD.faceUpMin;

function portrait(input: LayoutInput): Candidate {
  const { width: W, height: H, safe, dpr, uiScale } = input;
  const u = dpr * uiScale;
  const side = Math.max(safe.left, safe.right) + 6 * dpr;
  const infoH = 40 * u;
  const toolH = 66 * u;
  const top = safe.top + infoH;
  const bottom = H - safe.bottom - input.bannerHeight - toolH;
  const gapY = 10 * dpr;

  const availW = W - side * 2;
  let cardW = availW / (7 + 6 * CARD.gap);
  // La rangée du haut + la pire colonne doivent tenir en hauteur.
  const availH = bottom - top - gapY * 2;
  cardW = Math.min(cardW, availH / (CARD.aspect * (1 + WORST_COLUMN)), CARD.maxWidthCss * dpr);
  cardW = Math.floor(cardW);
  const cardH = Math.floor(cardW * CARD.aspect);
  const gap = Math.floor(cardW * CARD.gap);
  const rowW = cardW * 7 + gap * 6;
  const x0 = Math.floor((W - rowW) / 2);
  const col = (i: number): number => x0 + i * (cardW + gap);
  const rowY = top + gapY;
  const tabY = rowY + cardH + gapY * 1.4;

  const piles: Record<string, PilePlacement> = {};
  const left = input.leftHanded;
  // Droitier : fondations à gauche (colonnes 0-3), défausse en 4, pioche en 6.
  // Gaucher : pioche en 0, défausse en 1, fondations en 3-6.
  piles.stock = { x: col(left ? 0 : 6), y: rowY };
  piles.waste = { x: col(left ? 1 : 4), y: rowY };
  for (let i = 0; i < 4; i++) piles[`f${i}`] = { x: col(left ? 3 + i : i), y: rowY };
  for (let i = 0; i < 7; i++) piles[`t${i}`] = { x: col(i), y: tabY };

  const toolbar = { x: 0, y: bottom, w: W, h: toolH, vertical: false };
  const finishH = 52 * u;
  return {
    score: cardW,
    layout: {
      orientation: 'portrait',
      cardW,
      cardH,
      piles,
      wasteFan: { dx: Math.floor(cardW * CARD.wasteFanX), dy: 0 },
      tableauBottom: bottom - gapY,
      infoBar: { x: 0, y: safe.top, w: W, h: infoH },
      toolbar,
      finishButton: { x: W / 2 - 90 * u, y: bottom - finishH - 14 * u, w: 180 * u, h: finishH },
      unit: u,
    },
  };
}

function landscape(input: LayoutInput, foundationColumns: 1 | 2): Candidate {
  const { width: W, height: H, safe, dpr, uiScale } = input;
  const u = dpr * uiScale;
  const toolW = 78 * u;
  const infoH = 34 * u;
  const pad = 8 * dpr;
  const top = safe.top + pad;
  const bottom = H - safe.bottom - input.bannerHeight - pad;
  const availH = bottom - top;
  // Largeur : fondations (1 ou 2 colonnes), 7 colonnes, pioche/défausse (1 colonne), barre d'outils.
  const sideGap = 0.35;
  const units =
    foundationColumns + (foundationColumns - 1) * CARD.gap + sideGap * 2 + 7 + 6 * CARD.gap + 1;
  const availW = W - safe.left - safe.right - toolW - pad * 2;
  let cardW = availW / units;
  // Hauteur : la pire colonne sous la barre d'infos ; fondations empilées ; pioche + éventail.
  const rows = 4 / foundationColumns;
  const fanRoom = input.drawCount === 3 ? 2 * CARD.wasteFanY : 0;
  cardW = Math.min(
    cardW,
    (availH - infoH) / (CARD.aspect * WORST_COLUMN),
    availH / (CARD.aspect * (rows + (rows - 1) * CARD.gap)),
    availH / (CARD.aspect * (2 + CARD.gap * 2 + fanRoom)),
    CARD.maxWidthCss * dpr,
  );
  cardW = Math.floor(cardW);
  const cardH = Math.floor(cardW * CARD.aspect);
  const gap = Math.floor(cardW * CARD.gap);
  const sGap = Math.floor(cardW * sideGap);

  const foundationW = foundationColumns * cardW + (foundationColumns - 1) * gap;
  const tableauW = 7 * cardW + 6 * gap;
  const totalW = foundationW + sGap + tableauW + sGap + cardW;
  const contentLeft = safe.left + (input.leftHanded ? toolW : 0);
  const contentW = W - safe.left - safe.right - toolW;
  const x0 = Math.floor(contentLeft + (contentW - totalW) / 2);

  const left = input.leftHanded;
  // Droitier : [fondations][tableau][pioche] + outils à droite. Gaucher : miroir.
  const foundX = left ? x0 + cardW + sGap + tableauW + sGap : x0;
  const tabX = left ? x0 + cardW + sGap : x0 + foundationW + sGap;
  const stockX = left ? x0 : x0 + foundationW + sGap + tableauW + sGap;

  const piles: Record<string, PilePlacement> = {};
  const fRowsH = rows * cardH + (rows - 1) * gap;
  const tabY = top + infoH;
  // Fondations alignées sur le haut du tableau quand la place le permet.
  const fy0 = Math.floor(Math.max(top, Math.min(tabY, bottom - fRowsH)));
  for (let i = 0; i < 4; i++) {
    const c = foundationColumns === 1 ? 0 : i % 2;
    const r = foundationColumns === 1 ? i : Math.floor(i / 2);
    piles[`f${i}`] = { x: foundX + c * (cardW + gap), y: fy0 + r * (cardH + gap) };
  }
  for (let i = 0; i < 7; i++) piles[`t${i}`] = { x: tabX + i * (cardW + gap), y: tabY };
  piles.stock = { x: stockX, y: top + infoH };
  piles.waste = { x: stockX, y: top + infoH + cardH + gap * 2 };

  const toolX = left ? safe.left : W - safe.right - toolW;
  const finishH = 52 * u;
  return {
    score: cardW,
    layout: {
      orientation: 'landscape',
      cardW,
      cardH,
      piles,
      wasteFan: { dx: 0, dy: Math.floor(cardH * CARD.wasteFanY) },
      tableauBottom: bottom,
      infoBar: { x: tabX, y: top - pad / 2, w: tableauW, h: infoH },
      toolbar: {
        x: toolX,
        y: safe.top,
        w: toolW,
        h: H - safe.top - safe.bottom - input.bannerHeight,
        vertical: true,
      },
      finishButton: {
        x: tabX + tableauW / 2 - 90 * u,
        y: bottom - finishH - 10 * u,
        w: 180 * u,
        h: finishH,
      },
      unit: u,
    },
  };
}

export function computeKlondikeLayout(input: LayoutInput): KlondikeLayout {
  const candidates = [portrait(input), landscape(input, 1), landscape(input, 2)];
  // En paysage, on préfère la disposition latérale dès qu'elle donne des cartes au moins aussi grandes.
  let best = candidates[0] as Candidate;
  for (const c of candidates.slice(1)) {
    if (c.score > best.score * 1.02) best = c;
  }
  return best.layout;
}

/** Position (coin haut-gauche) de la carte `index` d'une pile. */
export function cardPositions(
  layout: KlondikeLayout,
  pileId: string,
  cards: readonly CardFace[],
  drawCount: 1 | 3,
): Array<{ x: number; y: number }> {
  const base = layout.piles[pileId];
  if (!base) return cards.map(() => ({ x: 0, y: 0 }));
  const n = cards.length;
  if (pileId === 'waste') {
    // En pioche 3, les trois cartes du dessus sont en éventail.
    const fanned = drawCount === 3 ? Math.min(3, n) : 1;
    return cards.map((_, i) => {
      const k = Math.max(0, i - (n - fanned));
      return { x: base.x + k * layout.wasteFan.dx, y: base.y + k * layout.wasteFan.dy };
    });
  }
  if (!pileId.startsWith('t')) return cards.map(() => ({ x: base.x, y: base.y }));

  // Tableau : écarts adaptatifs pour que la colonne tienne toujours à l'écran.
  const { cardH } = layout;
  let down = 0;
  let up = 0;
  for (let i = 0; i < n - 1; i++) {
    if ((cards[i] as CardFace).faceUp) up++;
    else down++;
  }
  const avail = layout.tableauBottom - base.y - cardH;
  let fd = cardH * CARD.faceDownOffset;
  let fu = cardH * CARD.faceUpOffset;
  if (down * fd + up * fu > avail) {
    fu = up > 0 ? (avail - down * fd) / up : fu;
    if (fu < cardH * CARD.faceUpMin) {
      fu = cardH * CARD.faceUpMin;
      fd = down > 0 ? Math.max(cardH * CARD.faceDownMin, (avail - up * fu) / down) : fd;
      if (down * fd + up * fu > avail && up > 0) {
        // Dernier recours : on resserre encore les cartes visibles.
        fu = Math.max(cardH * 0.12, (avail - down * fd) / up);
      }
    }
  }
  const out: Array<{ x: number; y: number }> = [];
  let y = base.y;
  for (let i = 0; i < n; i++) {
    out.push({ x: base.x, y: Math.round(y) });
    y += (cards[i] as CardFace).faceUp ? fu : fd;
  }
  return out;
}
