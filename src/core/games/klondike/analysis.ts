import { rankOf, type Card } from '../../cards';
import { BLOCK_DETECTION_MAX_NODES } from '../../../config/balance';
import {
  applyMove,
  canRecycle,
  cloneState,
  column,
  faceDownTotal,
  foundationCount,
  foundationFor,
  foundationId,
  isWon,
  legalMoves,
  moveOf,
  parsePileId,
  tableauId,
  topOf,
  DRAW,
  RECYCLE,
  TABLEAU_COUNT,
  type KlondikeMove,
  type KlondikeState,
} from './rules';

/**
 * Analyse d'une position : auto-complétion, détection de blocage et indice heuristique.
 */

// ---------------------------------------------------------------------------
// Auto-complétion
// ---------------------------------------------------------------------------

/** Meilleur coup vers une fondation (la carte de plus petit rang), ou null. */
function lowestFoundationMove(state: KlondikeState): KlondikeMove | null {
  let best: KlondikeMove | null = null;
  let bestRank = 99;
  const consider = (from: 'waste' | `t${number}`, card: Card | undefined): void => {
    if (card === undefined) return;
    const target = foundationFor(state, card);
    if (target >= 0 && rankOf(card) < bestRank) {
      bestRank = rankOf(card);
      best = moveOf(from, foundationId(target));
    }
  };
  for (let i = 0; i < TABLEAU_COUNT; i++) consider(tableauId(i), topOf(column(state, i).cards));
  consider('waste', topOf(state.waste));
  return best;
}

/**
 * Suite de coups simple (fondations + pioche) qui gagne la partie, ou null si
 * cette méthode gloutonne n'y parvient pas.
 */
function greedyFinish(state: KlondikeState): KlondikeMove[] | null {
  const sim = cloneState(state);
  const moves: KlondikeMove[] = [];
  let progressSinceRecycle = true;
  // Borne de sécurité : largement plus que nécessaire pour 52 cartes.
  for (let guard = 0; guard < 5000; guard++) {
    if (isWon(sim)) return moves;
    const up = lowestFoundationMove(sim);
    let move: KlondikeMove;
    if (up) {
      move = up;
      progressSinceRecycle = true;
    } else if (sim.stock.length > 0) {
      move = DRAW;
    } else if (progressSinceRecycle && canRecycle(sim)) {
      move = RECYCLE;
      progressSinceRecycle = false;
    } else {
      return null;
    }
    applyMove(sim, move);
    moves.push(move);
  }
  /* c8 ignore next */
  return null;
}

/** Toutes les cartes du tableau sont visibles et la fin est triviale. */
export function canAutoComplete(state: KlondikeState): boolean {
  if (isWon(state) || faceDownTotal(state) > 0) return false;
  return greedyFinish(state) !== null;
}

export function autoCompleteMoves(state: KlondikeState): KlondikeMove[] {
  if (!canAutoComplete(state)) return [];
  return greedyFinish(state) ?? [];
}

// ---------------------------------------------------------------------------
// Recherche de progrès (blocage et indice heuristique)
// ---------------------------------------------------------------------------

interface ProgressMark {
  readonly faceDown: number;
  readonly talon: number;
  readonly foundation: number;
}

function mark(state: KlondikeState): ProgressMark {
  return {
    faceDown: faceDownTotal(state),
    talon: state.stock.length + state.waste.length,
    foundation: foundationCount(state),
  };
}

/**
 * Un état « progresse » s'il révèle une carte cachée, vide un peu la pioche
 * ou dépasse le nombre de cartes en fondation de départ. Ces trois mesures
 * ne peuvent pas boucler : sans progrès possible, la partie est perdue.
 */
function isProgress(start: ProgressMark, state: KlondikeState): boolean {
  return (
    faceDownTotal(state) < start.faceDown ||
    state.stock.length + state.waste.length < start.talon ||
    foundationCount(state) > start.foundation
  );
}

function stateKey(state: KlondikeState): string {
  const parts: string[] = [String(state.waste.length)];
  if (state.options.maxPasses !== null) parts.push(String(state.recycles));
  for (const pile of state.foundations) parts.push(String(topOf(pile) ?? -1));
  for (const col of state.tableau) parts.push(`${col.faceDown}:${col.cards.join(',')}`);
  return parts.join('|');
}

/** Priorité d'un coup qui progresse immédiatement (pour choisir l'indice). */
function progressPriority(before: KlondikeState, move: KlondikeMove, after: KlondikeState): number {
  if (move.type !== 'move') return 10;
  let priority = 0;
  if (faceDownTotal(after) < faceDownTotal(before)) {
    const src = parsePileId(move.from);
    priority += 100 + (src?.kind === 'tableau' ? column(before, src.index).faceDown : 0);
  }
  if (move.to.startsWith('f')) {
    const card = topOf(after.foundations[Number(move.to.slice(1))] ?? []) as Card;
    priority += 60 + (13 - rankOf(card));
  } else if (move.from === 'waste') {
    priority += 40;
  }
  return priority;
}

export interface ProgressSearch {
  /** Aucune suite de coups ne permet de progresser. */
  readonly blocked: boolean;
  /** Premier coup du plus court chemin vers un progrès (null si bloqué ou gagné). */
  readonly firstMove: KlondikeMove | null;
  /** La recherche a atteint sa limite : conclusion prudente « non bloqué ». */
  readonly truncated: boolean;
}

export function searchProgress(
  state: KlondikeState,
  maxNodes: number = BLOCK_DETECTION_MAX_NODES,
): ProgressSearch {
  if (isWon(state)) return { blocked: false, firstMove: null, truncated: false };
  const finish = canAutoComplete(state) ? autoCompleteMoves(state) : null;
  if (finish && finish.length > 0) {
    return { blocked: false, firstMove: finish[0] as KlondikeMove, truncated: false };
  }

  const start = mark(state);
  const visited = new Set<string>([stateKey(state)]);
  let frontier: Array<{ state: KlondikeState; first: KlondikeMove }> = [];

  // Niveau 1 : on choisit le meilleur coup parmi ceux qui progressent tout de suite.
  let best: KlondikeMove | null = null;
  let bestPriority = -1;
  for (const move of legalMoves(state)) {
    const next = cloneState(state);
    applyMove(next, move);
    if (isProgress(start, next)) {
      const priority = progressPriority(state, move, next);
      if (priority > bestPriority) {
        bestPriority = priority;
        best = move;
      }
      continue;
    }
    const key = stateKey(next);
    if (visited.has(key)) continue;
    visited.add(key);
    frontier.push({ state: next, first: move });
  }
  if (best) return { blocked: false, firstMove: best, truncated: false };

  // Niveaux suivants : largeur d'abord, jusqu'au premier progrès.
  let nodes = frontier.length;
  while (frontier.length > 0) {
    const nextFrontier: typeof frontier = [];
    for (const node of frontier) {
      for (const move of legalMoves(node.state)) {
        const next = cloneState(node.state);
        applyMove(next, move);
        if (isProgress(start, next)) {
          return { blocked: false, firstMove: node.first, truncated: false };
        }
        const key = stateKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        if (++nodes > maxNodes) return { blocked: false, firstMove: null, truncated: true };
        nextFrontier.push({ state: next, first: node.first });
      }
    }
    frontier = nextFrontier;
  }
  return { blocked: true, firstMove: null, truncated: false };
}

export function isBlocked(state: KlondikeState, maxNodes?: number): boolean {
  return searchProgress(state, maxNodes).blocked;
}

/** Indice heuristique : premier pas vers le progrès le plus proche. */
export function heuristicHint(state: KlondikeState, maxNodes?: number): KlondikeMove | null {
  const result = searchProgress(state, maxNodes);
  if (result.firstMove) return result.firstMove;
  if (result.truncated) {
    if (state.stock.length > 0) return DRAW;
    if (canRecycle(state)) return RECYCLE;
  }
  return null;
}
