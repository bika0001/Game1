import {
  canDraw,
  canRecycle,
  column,
  destinationsFor,
  movableCount,
  moveOf,
  parsePileId,
  pileCards,
  DRAW,
  RECYCLE,
  type KlondikeMove,
  type KlondikePileId,
  type KlondikeState,
  type ParsedPile,
} from './games/klondike/rules';

/**
 * « Tap = meilleur coup » : quand le joueur tape une carte, on choisit pour lui
 * la destination légale la plus utile.
 *
 * Ordre de préférence :
 * 1. la fondation (pour une carte seule, hors fondation) ;
 * 2. une colonne non vide (la plus proche de la colonne d'origine, sinon la plus à gauche) ;
 * 3. une colonne vide pour un Roi (la plus à gauche), sauf si le Roi est déjà
 *    au pied d'une colonne sans carte cachée : le déplacer ne servirait à rien.
 */

const FOUNDATION_SCORE = 1000;
const NON_EMPTY_COLUMN_SCORE = 500;
const EMPTY_COLUMN_SCORE = 300;

function destinationScore(
  state: KlondikeState,
  src: ParsedPile,
  cardIndex: number,
  to: KlondikePileId,
): number {
  const dst = parsePileId(to) as ParsedPile;
  if (dst.kind === 'foundation') return FOUNDATION_SCORE - dst.index;

  const distance = src.kind === 'tableau' ? Math.abs(src.index - dst.index) : dst.index;
  if (column(state, dst.index).cards.length > 0) return NON_EMPTY_COLUMN_SCORE - distance;

  // Colonne vide : inutile d'y déplacer un Roi qui est déjà au pied de sa colonne.
  if (src.kind === 'tableau' && cardIndex === 0) return -Infinity;
  return EMPTY_COLUMN_SCORE - dst.index;
}

export function bestMoveForTap(
  state: KlondikeState,
  pileId: string,
  cardIndex: number,
): KlondikeMove | null {
  const parsed = parsePileId(pileId);
  if (!parsed) return null;
  if (parsed.kind === 'stock') {
    if (canDraw(state)) return DRAW;
    if (canRecycle(state)) return RECYCLE;
    return null;
  }

  const from = pileId as KlondikePileId;
  const length = pileCards(state, from).length;
  const count = length - cardIndex;
  // Hors limites, carte cachée ou pas au sommet : rien à faire.
  if (cardIndex < 0 || count < 1 || count > movableCount(state, from)) return null;

  let best: KlondikeMove | null = null;
  let bestScore = -Infinity;
  for (const to of destinationsFor(state, from, count)) {
    const score = destinationScore(state, parsed, cardIndex, to);
    if (score > bestScore) {
      bestScore = score;
      best = moveOf(from, to, count);
    }
  }
  return best;
}
